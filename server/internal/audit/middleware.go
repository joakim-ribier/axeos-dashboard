package audit

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

// Middleware records every call to the route it's set on as an entryType
// API entry, once the route has answered -- whatever the outcome, so a
// failed attempt shows up too, with its status and error message. Unless
// the route recorded the call in detail itself (see RecordChanges): one
// fact, one entry. Nor a form's refused input (see formTypes).
//
// resolveTarget turns the miner a request addresses (by IP or hostname)
// into its IP, so API entries filter by miner like the scheduler's.
func (l *Log) Middleware(entryType string, resolveTarget func(string) string, logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// The entry needs the response's outcome, so the route answers
			// first -- through rw, which notes it on the way out.
			rw := &errorBody{ResponseWriter: w}
			detailed := new(bool)
			next.ServeHTTP(rw, r.WithContext(context.WithValue(r.Context(), detailedKey{}, detailed)))
			if *detailed {
				return
			}
			if formTypes[entryType] && rw.statusCode() == http.StatusBadRequest {
				return
			}

			if err := l.Record(apiEntry(entryType, r, rw, resolveTarget)); err != nil {
				logger.Error("failed to record audit entry", "type", entryType, "error", err)
			}
		})
	}
}

// formTypes are the routes behind a form: a 400 there is a field the form
// let through and the server refused -- nothing was changed nor done, and
// it would only bury the real failures. Data leaving the Pi and network
// scans keep their 400s: what was asked for is worth knowing there.
var formTypes = map[string]bool{
	TypeSaveMiners:   true,
	TypeSaveSettings: true,
}

func apiEntry(entryType string, r *http.Request, rw *errorBody, resolveTarget func(string) string) Entry {
	e := requestEntry(entryType, r)
	e.Target = target(r, resolveTarget)
	e.Status = rw.statusCode()
	e.Query = query(r)
	e.Error = rw.errorMessage()
	return e
}

// detailedKey carries, through a request, whether its route already
// recorded it in detail -- see Middleware and RecordChanges.
type detailedKey struct{}

// requestEntry is who made r: what every API entry starts from.
func requestEntry(entryType string, r *http.Request) Entry {
	return Entry{
		Timestamp: time.Now(),
		Source:    SourceAPI,
		Type:      entryType,
		IP:        clientIP(r),
		UserAgent: r.UserAgent(),
		RequestID: middleware.GetReqID(r.Context()),
	}
}

// target is the miner the request is about: the route's {hostnameOrIp}
// (restart) or its ?miner= (pool switch) -- empty when it's about every
// miner, or none.
func target(r *http.Request, resolveTarget func(string) string) string {
	miner := chi.URLParam(r, "hostnameOrIp")
	if miner == "" {
		miner = r.URL.Query().Get("miner")
	}
	if miner == "" {
		return ""
	}
	return resolveTarget(miner)
}

// clientIP drops the port: chi's RealIP only rewrites RemoteAddr when a
// proxy header is present -- otherwise it's still "ip:port".
func clientIP(r *http.Request) string {
	if host, _, err := net.SplitHostPort(r.RemoteAddr); err == nil {
		return host
	}
	return r.RemoteAddr
}

// query is the request's query string, unescaped so it reads as typed.
func query(r *http.Request) string {
	if q, err := url.QueryUnescape(r.URL.RawQuery); err == nil {
		return q
	}
	return r.URL.RawQuery
}

// errorBody keeps what a handler writes after an error status (400+) --
// its message, for the entry. Successes, a backup zip included, pass
// straight through.
type errorBody struct {
	http.ResponseWriter
	status int
	body   bytes.Buffer
}

func (e *errorBody) WriteHeader(code int) {
	e.status = code
	e.ResponseWriter.WriteHeader(code)
}

func (e *errorBody) Write(p []byte) (int, error) {
	if e.status >= http.StatusBadRequest {
		e.body.Write(p)
	}
	return e.ResponseWriter.Write(p)
}

// statusCode is what the client got: a handler that writes its body
// without calling WriteHeader (most successes) sends an implicit 200.
func (e *errorBody) statusCode() int {
	if e.status == 0 {
		return http.StatusOK
	}
	return e.status
}

// errorMessage is a failure's reason: the message of the JSON error the
// handlers write (handler.ErrorResponse), or http.Error's plain text.
func (e *errorBody) errorMessage() string {
	if e.status < http.StatusBadRequest {
		return ""
	}
	var resp struct {
		Message string `json:"message"`
	}
	if json.Unmarshal(e.body.Bytes(), &resp) == nil && resp.Message != "" {
		return resp.Message
	}
	return strings.TrimSpace(e.body.String())
}
