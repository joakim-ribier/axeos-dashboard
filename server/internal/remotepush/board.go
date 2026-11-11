// internal/remotepush/board.go
package remotepush

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"
)

// Board is what hashboard knows about the board this instance pushes to.
type Board struct {
	BoardID      string     `json:"boardId,omitempty"`
	Public       bool       `json:"public"`
	HashboardURL string     `json:"hashboardURL,omitempty"`
	DashboardURL string     `json:"dashboardURL,omitempty"`
	LastSampleAt *time.Time `json:"lastSampleAt,omitempty"`
	// Miners is how many miners the board holds and may hold -- absent
	// from a hashboard that has no limit.
	Miners *BoardMiners `json:"miners,omitempty"`
}

// BoardMiners is the board's miner limit and how many it holds.
type BoardMiners struct {
	Limit int `json:"limit"`
	Count int `json:"count"`
}

// BoardCache bounds how often dashboard-api asks hashboard, whatever the
// number of open tabs -- hashboard rate-limits GET /api/board/info per
// board. A failed fetch is cached too (an empty Board, and its error), so
// an unreachable hashboard isn't retried on every request.
type BoardCache struct {
	mu        sync.Mutex
	key       string
	fetchedAt time.Time
	board     Board
	err       error
}

// Get returns the cached Board for these credentials, fetching it again
// once older than ttl or when the credentials changed. ttl is the feeder's
// interval: hashboard's lastSampleAt can't change faster than the feeder
// pushes.
func (c *BoardCache) Get(pushURL, apiKey string, ttl time.Duration) (Board, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	key := pushURL + "\x00" + apiKey
	if key == c.key && time.Since(c.fetchedAt) < ttl {
		return c.board, c.err
	}
	c.board, c.err = FetchBoard(pushURL, apiKey)
	c.key, c.fetchedAt = key, time.Now()
	return c.board, c.err
}

// StatusError is hashboard answering /api/board/info with something other
// than a 200 -- a refused API key (401) above all.
type StatusError struct {
	Code int
}

func (e *StatusError) Error() string {
	return fmt.Sprintf("unexpected status %d (/board/info)", e.Code)
}

// The state of the link to hashboard, as the last read of the board says
// it: what Configuration › Remote tells the user.
const (
	StateOK           = "ok"
	StateUnauthorized = "unauthorized" // the API key is refused
	StateRefused      = "refused"      // too many requests (429): hashboard's limits
	StateUnreachable  = "unreachable"  // no answer, or any other status: a wrong URL...
)

// StateOf is the link's state after a read of the board that ended in err.
func StateOf(err error) string {
	var status *StatusError
	switch {
	case err == nil:
		return StateOK
	case errors.As(err, &status) && status.Code == http.StatusUnauthorized:
		return StateUnauthorized
	case errors.As(err, &status) && status.Code == http.StatusTooManyRequests:
		return StateRefused
	default:
		return StateUnreachable
	}
}

// FetchBoard calls hashboard's GET /api/board/info. Its URL is derived from
// pushURL (".../api/push"), the only hashboard URL configured.
func FetchBoard(pushURL, apiKey string) (Board, error) {
	url := strings.TrimSuffix(strings.TrimRight(pushURL, "/"), "/push") + "/board/info"
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return Board{}, err
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return Board{}, err
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return Board{}, &StatusError{Code: resp.StatusCode}
	}
	var board Board
	if err := json.NewDecoder(resp.Body).Decode(&board); err != nil {
		return Board{}, fmt.Errorf("invalid /board/info response: %w", err)
	}
	return board, nil
}
