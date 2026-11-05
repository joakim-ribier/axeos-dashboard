package handler

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/hashboardaccess"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/model"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/remoteactions"
)

// The one thing remote-dashboard-api writes: a miner's latest request,
// {mac}.json, replaced by its next one -- hashboard alone writes {mac}.state.json.
const boardActionsDirName = "actions"

const remoteActionsPerHour = 10

const (
	maxActionRequestBytes = 1 << 10 // 1 024 → 1 Kio
	maxUserAgent          = 256
)

const (
	actionPending = "pending"
	actionPolled  = "polled"
)

type remoteActionRequest struct {
	Action string `json:"action"`
}

type actionsLimiter struct {
	mu   sync.Mutex
	sent map[string][]time.Time
}

func (l *actionsLimiter) allow(boardID string, now time.Time) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	recent := slices.DeleteFunc(l.sent[boardID], func(t time.Time) bool { return now.Sub(t) > time.Hour })
	if len(recent) >= remoteActionsPerHour {
		l.sent[boardID] = recent
		return false
	}
	l.sent[boardID] = append(recent, now)
	return true
}

func boardActionsDir(cfg config.Config, boardID string) string {
	return filepath.Join(cfg.Storage.ResolveBoardsDir(), boardID, boardActionsDirName)
}

// Mirrors hashboard's storage.BoardSettings -- a cross-repo contract.
type boardSettings struct {
	Remote struct {
		Actions             []string `json:"actions"`
		PollIntervalSeconds int      `json:"pollIntervalSeconds"`
	} `json:"remote"`
}

// 2 of the dashboard's polls: one may be missed.
func (s boardSettings) actionLifetime() time.Duration {
	return 2 * time.Duration(s.Remote.PollIntervalSeconds) * time.Second
}

func readBoardSettings(cfg config.Config, boardID string) boardSettings {
	var s boardSettings
	readJSONFile(filepath.Join(cfg.Storage.ResolveBoardsDir(), boardID, "settings.json"), &s)
	return s
}

// @Summary Ask for a remote action (board owner)
// @Description On a private board only (its viewer is its owner): asks the dashboard pushing to the board to restart the miner or switch it to its other pool -- an action that dashboard allows (Configuration › Remote, sent as the board's settings.json), on a miner still sending data. The dashboard picks it up on its next poll and reports nothing back; a request not picked up within 2 of its poll intervals expires. GET /api/{boardId}/miners shows the one in progress. One per miner, 10 per board an hour.
// @Tags Board miners
// @Accept json
// @Produce json
// @Param boardId path string true "hashboard board ID"
// @Param ip path string true "Miner IP, as the board knows it"
// @Param request body handler.remoteActionRequest true "restart, switch_primary or switch_fallback"
// @Success 202 {object} model.RemoteAction
// @Failure 400 {object} handler.ErrorResponse "unknown action"
// @Failure 403 {object} handler.ErrorResponse "public board, or action not allowed by the dashboard"
// @Failure 404 {object} handler.ErrorResponse "no such miner"
// @Failure 409 {object} handler.ErrorResponse "an action is already in progress for this miner, or it sends no data any more"
// @Failure 429 {object} handler.ErrorResponse "too many actions this hour"
// @Router /api/{boardId}/miners/{ip}/actions [post]
func RequestRemoteAction(cfg config.Config, accessChecker *hashboardaccess.Checker) http.HandlerFunc {
	limiter := &actionsLimiter{sent: map[string][]time.Time{}}
	return func(w http.ResponseWriter, r *http.Request) {
		boardID := chi.URLParam(r, "boardId")
		if !privateBoard(w, accessChecker, boardID) {
			return
		}

		// JSON only: another site's plain form can't post here, its
		// Content-Type would need a CORS preflight, which is refused.
		if !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
			writeErrorResponse(w, "expected a JSON body", http.StatusUnsupportedMediaType)
			return
		}
		var req remoteActionRequest
		body := http.MaxBytesReader(w, r.Body, maxActionRequestBytes)
		if err := json.NewDecoder(body).Decode(&req); err != nil || !remoteactions.IsAction(req.Action) {
			writeErrorResponse(w, "unknown action", http.StatusBadRequest)
			return
		}

		root := boardDataRoot(cfg.Storage.ResolveBoardsDir(), boardID)
		mac, err := resolveMacByIP(root, chi.URLParam(r, "ip"))
		if err != nil {
			writeErrorResponse(w, fmt.Sprintf("failed to resolve miner: %v", err), http.StatusInternalServerError)
			return
		}
		if mac == "" {
			writeErrorResponse(w, "no such miner", http.StatusNotFound)
			return
		}
		settings := readBoardSettings(cfg, boardID)
		if !slices.Contains(settings.Remote.Actions, req.Action) {
			writeErrorResponse(w, "this action isn't allowed by the dashboard", http.StatusForbidden)
			return
		}
		latest, err := decodeLatestJSON(filepath.Join(root, mac, "latest.json"))
		if alive, _ := aliveFromTimestamp(latest.Timestamp, latest.FeederIntervalSeconds); err != nil || !alive {
			writeErrorResponse(w, "this miner isn't sending any data: its dashboard may be off", http.StatusConflict)
			return
		}

		now := time.Now().UTC()
		dir := boardActionsDir(cfg, boardID)
		if actionInProgress(dir, mac, settings.actionLifetime(), now) != nil {
			writeErrorResponse(w, "an action is already in progress for this miner", http.StatusConflict)
			return
		}
		if !limiter.allow(boardID, now) {
			writeErrorResponse(w, "too many actions this hour", http.StatusTooManyRequests)
			return
		}

		id, err := newActionID()
		if err != nil {
			writeErrorResponse(w, "failed to create the action", http.StatusInternalServerError)
			return
		}
		action := remoteactions.Action{
			ID: id, StorageKey: mac, Action: req.Action, CreatedAt: now,
			RequestedBy: remoteactions.RequestedBy{IP: clientIP(r), UserAgent: boundedUserAgent(r.UserAgent())},
		}
		if err := writeJSONFile(filepath.Join(dir, mac+".json"), action); err != nil {
			log.Printf("remote: failed to write action %s for board %s: %v", id, boardID, err)
			writeErrorResponse(w, "failed to create the action", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusAccepted)
		_ = json.NewEncoder(w).Encode(model.RemoteAction{Action: req.Action, Status: actionPending, CreatedAt: now})
	}
}

// Anyone may see a public board, so nobody may act from it.
func privateBoard(w http.ResponseWriter, accessChecker *hashboardaccess.Checker, boardID string) bool {
	public, err := accessChecker.IsPublic(boardID)
	if err != nil {
		writeErrorResponse(w, "failed to check board access", http.StatusInternalServerError)
		return false
	}
	if public {
		writeErrorResponse(w, "actions are only offered on a private board", http.StatusForbidden)
		return false
	}
	return true
}

// Past lifetime, a pending request expired (hashboard won't hand it out) and a
// polled one is over: the dashboard reports nothing back.
func actionInProgress(dir, mac string, lifetime time.Duration, now time.Time) *model.RemoteAction {
	var action remoteactions.Action
	if !readJSONFile(filepath.Join(dir, mac+".json"), &action) {
		return nil
	}
	current := model.RemoteAction{Action: action.Action, Status: actionPending, CreatedAt: action.CreatedAt}
	since := action.CreatedAt
	// A state of another ID is about the miner's previous request.
	var state remoteactions.State
	if readJSONFile(filepath.Join(dir, mac+".state.json"), &state) && state.ID == action.ID {
		current.Status, current.PolledAt = actionPolled, &state.PolledAt
		since = state.PolledAt
	}
	if now.Sub(since) > lifetime {
		return nil
	}
	return &current
}

func newActionID() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func boundedUserAgent(ua string) string {
	if runes := []rune(ua); len(runes) > maxUserAgent {
		return string(runes[:maxUserAgent])
	}
	return ua
}

// middleware.RealIP has already put nginx's X-Real-IP there.
func clientIP(r *http.Request) string {
	if host, _, err := net.SplitHostPort(r.RemoteAddr); err == nil {
		return host
	}
	return r.RemoteAddr
}

func readJSONFile(path string, v any) bool {
	data, err := os.ReadFile(path)
	return err == nil && json.Unmarshal(data, v) == nil
}

// Atomic: hashboard never reads a half-written request.
func writeJSONFile(path string, v any) error {
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return err
	}
	tmp, err := os.CreateTemp(dir, ".tmp-*")
	if err != nil {
		return err
	}
	defer func() { _ = os.Remove(tmp.Name()) }()
	if _, err := tmp.Write(data); err != nil {
		_ = tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	if err := os.Chmod(tmp.Name(), 0o644); err != nil {
		return err
	}
	return os.Rename(tmp.Name(), path)
}
