// Package remoteactions does what a board's owner asks for from the board.
// Nothing is reported back: the outcome is in the audit and in the mail, and
// the miner's next reading shows on the board.
package remoteactions

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/audit"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/axeos"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/remoteactionmail"
)

// Sent to the board with its settings: a request older than 2 of them is
// expired there, never handed out.
const Interval = time.Minute

// What hashboard is trusted with: nothing it sends is a miner's address nor
// a pool, and the bounds below hold even if it misbehaves.
const (
	maxResponseBytes = 1 << 20 // 1 048 576 → 1 Mio
	maxRequestedBy   = 256     // an IP or a User-Agent
	actionCooldown   = 2 * Interval
)

const (
	statusDone     = "done"
	statusFailed   = "failed"
	statusRejected = "rejected"
)

// Mirrors hashboard's storage.Action -- a cross-repo contract.
type Action struct {
	ID          string      `json:"id"`
	StorageKey  string      `json:"storageKey"`
	Action      string      `json:"action"`
	CreatedAt   time.Time   `json:"createdAt"`
	RequestedBy RequestedBy `json:"requestedBy"`
}

type RequestedBy struct {
	IP        string `json:"ip,omitempty"`
	UserAgent string `json:"userAgent,omitempty"`
}

// Mirrors hashboard's storage.ActionState -- a cross-repo contract.
type State struct {
	ID       string    `json:"id"`
	PolledAt time.Time `json:"polledAt"`
}

func IsAction(action string) bool {
	return action == string(config.ActionRestart) || targets[action] != ""
}

var targets = map[string]config.PoolTarget{
	string(config.ActionSwitchPrimary):  config.Primary,
	string(config.ActionSwitchFallback): config.Fallback,
}

type Poller struct {
	logger   *slog.Logger
	config   func() config.Config
	auditLog *audit.Log
	client   *http.Client
	cancel   context.CancelFunc

	mu sync.Mutex
	// By MAC.
	lastAction map[string]time.Time
}

func New(logger *slog.Logger, current func() config.Config, auditLog *audit.Log) *Poller {
	return &Poller{
		logger:     logger.With("namespace", "RemoteActions"),
		config:     current,
		auditLog:   auditLog,
		client:     &http.Client{Timeout: 10 * time.Second},
		lastAction: map[string]time.Time{},
	}
}

func (p *Poller) Start() {
	ctx, cancel := context.WithCancel(context.Background())
	p.cancel = cancel
	go func() {
		ticker := time.NewTicker(Interval)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				p.Poll(ctx)
			case <-ctx.Done():
				return
			}
		}
	}()
}

func (p *Poller) Stop() {
	if p.cancel != nil {
		p.cancel()
	}
}

func (p *Poller) Poll(ctx context.Context) {
	cfg := p.config()
	if !cfg.Remote.Enabled() || len(cfg.Remote.Actions.Allowed()) == 0 {
		return
	}
	actions, err := p.fetchPending(ctx, cfg.Remote)
	if err != nil {
		p.logger.Error("failed to fetch the remote actions", "error", err)
		return
	}
	for _, a := range actions {
		p.handle(ctx, cfg, a)
	}
}

func (p *Poller) handle(ctx context.Context, cfg config.Config, a Action) {
	if !IsAction(a.Action) {
		p.logger.Error("unknown remote action, refused", "id", a.ID, "action", a.Action)
		return
	}
	logger := p.logger.With("id", a.ID, "action", a.Action, "storageKey", a.StorageKey)

	// Named by its MAC when it isn't a miner of ours.
	target, name := a.StorageKey, a.StorageKey
	miner, found := minerByKey(cfg, a.StorageKey)
	if found {
		target, name = miner.Ip, miner.DisplayName()
	}

	var entry audit.Entry
	status := statusRejected
	switch {
	case !slices.Contains(cfg.Remote.Actions.Allowed(), a.Action):
		entry = audit.Entry{Target: target, Error: "action not allowed from the board"}
	case !found:
		entry = audit.Entry{Target: target, Error: "unknown or disabled miner"}
	case !p.takeCooldown(a.StorageKey):
		entry = audit.Entry{Target: target, Error: "another action on this miner just ran"}
	default:
		entry = execute(ctx, axeos.NewAxeOs(p.logger, cfg), miner, a.Action)
		status = statusDone
		if entry.Error != "" {
			status = statusFailed
		}
	}
	logger.Info("Remote action handled", "target", target, "status", status, "error", entry.Error)

	entry.Timestamp = time.Now()
	entry.Source, entry.Service = audit.SourceSystem, audit.ServiceRemote
	entry.Type = a.Action
	entry.Status = 0
	entry.IP, entry.UserAgent = bounded(a.RequestedBy.IP), bounded(a.RequestedBy.UserAgent)
	if err := p.auditLog.Record(entry); err != nil {
		logger.Error("failed to record audit entry", "error", err)
	}

	if cfg.Remote.Actions.Mail {
		p.mail(cfg, remoteactionmail.Event{
			Action: a.Action, Miner: name, Status: status, At: entry.Timestamp,
		})
	}
}

// The board's rule of one at a time, held here too: a hashboard handing out
// requests in a loop can't keep a miner rebooting.
func (p *Poller) takeCooldown(key string) bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	now := time.Now()
	if last, ok := p.lastAction[key]; ok && now.Sub(last) < actionCooldown {
		return false
	}
	p.lastAction[key] = now
	return true
}

func bounded(s string) string {
	if runes := []rune(s); len(runes) > maxRequestedBy {
		return string(runes[:maxRequestedBy])
	}
	return s
}

// Like the dashboard's own buttons: a switch activates the slot as the device
// holds it.
func execute(ctx context.Context, axeOs axeos.AxeOs, miner config.Bitaxe, action string) audit.Entry {
	if target, ok := targets[action]; ok {
		was, now, err := axeOs.ActivateSlot(ctx, miner, target)
		return audit.PoolSwitched(action, miner.Ip, was, now, 0, err)
	}
	entry := audit.Entry{Target: miner.Ip}
	if err := axeOs.Restart(miner); err != nil {
		entry.Error = err.Error()
	}
	return entry
}

func minerByKey(cfg config.Config, key string) (config.Bitaxe, bool) {
	for _, miner := range cfg.GetMiners() {
		if miner.StorageKey() == key {
			return miner, true
		}
	}
	return config.Bitaxe{}, false
}

// Derived from pushURL (".../api/push"), the only hashboard URL configured.
func apiURL(pushURL, path string) string {
	return strings.TrimSuffix(strings.TrimRight(pushURL, "/"), "/push") + path
}

func (p *Poller) fetchPending(ctx context.Context, remote config.RemoteConfig) ([]Action, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, apiURL(remote.PushURL, "/actions/pending"), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+remote.APIKey)
	resp, err := p.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status %s (/actions/pending)", resp.Status)
	}
	var body struct {
		Actions []Action `json:"actions"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, maxResponseBytes)).Decode(&body); err != nil {
		return nil, fmt.Errorf("invalid /actions/pending response: %w", err)
	}
	return body.Actions, nil
}

// In the background: a slow SMTP server never holds up the next action.
func (p *Poller) mail(cfg config.Config, event remoteactionmail.Event) {
	body, err := json.Marshal(event)
	if err != nil {
		p.logger.Error("remote action mail: marshal error", "error", err)
		return
	}
	url := "http://" + cfg.Mailer.Address() + "/api/mailer/remote-action"
	go func() {
		client := &http.Client{Timeout: 30 * time.Second}
		resp, err := client.Post(url, "application/json", bytes.NewReader(body))
		if err != nil {
			p.logger.Error("remote action mail: mailer unreachable", "error", err)
			return
		}
		defer func() { _ = resp.Body.Close() }()
		if resp.StatusCode != http.StatusOK {
			var e struct {
				Message string `json:"message"`
			}
			_ = json.NewDecoder(resp.Body).Decode(&e)
			p.logger.Error("remote action mail not sent", "status", resp.StatusCode, "error", e.Message)
		}
	}()
}
