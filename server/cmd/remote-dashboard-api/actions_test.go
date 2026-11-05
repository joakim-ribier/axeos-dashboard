package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/hashboardaccess"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/model"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/remoteactions"
)

const (
	actionBoard = "board00000000001"
	actionMac   = "aabbccddeeff"
	actionIP    = "10.0.0.1"
)

var actionSession = strings.Repeat("b", 64)

type actionBoardFixture struct {
	t      *testing.T
	dir    string
	router http.Handler
}

func newActionBoard(t *testing.T, public bool) *actionBoardFixture {
	t.Helper()
	dir := t.TempDir()
	f := &actionBoardFixture{t: t, dir: dir}
	writeFixture(t, filepath.Join(dir, "data", "accounts", actionBoard+".json"), fmt.Sprintf(`{"public":%v}`, public))
	writeFixture(t, filepath.Join(dir, "data", "sessions", actionSession+".json"),
		`{"boardId":"`+actionBoard+`","expiresAt":"2099-01-01T00:00:00Z"}`)
	f.writeSettings(`["restart","switch_primary"]`, 60)
	f.writeMiner(actionMac, actionIP, time.Now())
	cfg := config.Config{Storage: config.StorageConfig{DataDir: dir}}
	f.router = NewRouter(cfg, testVersionChecker(), hashboardaccess.New(filepath.Join(dir, "data")))
	return f
}

func (f *actionBoardFixture) boardPath(parts ...string) string {
	return filepath.Join(append([]string{f.dir, "data", "boards", actionBoard}, parts...)...)
}

func (f *actionBoardFixture) writeSettings(actions string, interval int) {
	f.t.Helper()
	writeFixture(f.t, f.boardPath("settings.json"),
		fmt.Sprintf(`{"remote":{"actions":%s,"pollIntervalSeconds":%d}}`, actions, interval))
}

func (f *actionBoardFixture) writeMiner(mac, ip string, lastSeen time.Time) {
	f.t.Helper()
	writeFixture(f.t, f.boardPath("bitaxes", mac, "latest.json"),
		fmt.Sprintf(`{"ts":%q,"ip":%q,"hostname":"m","model":"bitaxe","feederIntervalSeconds":120,"payload":{}}`, lastSeen.UTC().Format(time.RFC3339), ip))
}

func (f *actionBoardFixture) writeRequest(a remoteactions.Action) {
	f.t.Helper()
	data, err := json.Marshal(a)
	if err != nil {
		f.t.Fatal(err)
	}
	writeFixture(f.t, f.boardPath("actions", a.StorageKey+".json"), string(data))
}

func (f *actionBoardFixture) writeState(id string, polledAt time.Time) {
	f.t.Helper()
	data, err := json.Marshal(remoteactions.State{ID: id, PolledAt: polledAt})
	if err != nil {
		f.t.Fatal(err)
	}
	writeFixture(f.t, f.boardPath("actions", actionMac+".state.json"), string(data))
}

func (f *actionBoardFixture) readRequest(mac string) (remoteactions.Action, bool) {
	f.t.Helper()
	data, err := os.ReadFile(f.boardPath("actions", mac+".json"))
	if err != nil {
		return remoteactions.Action{}, false
	}
	var a remoteactions.Action
	if err := json.Unmarshal(data, &a); err != nil {
		f.t.Fatal(err)
	}
	return a, true
}

func (f *actionBoardFixture) actionFiles() []string {
	f.t.Helper()
	entries, err := os.ReadDir(f.boardPath("actions"))
	if err != nil {
		return nil
	}
	names := []string{}
	for _, e := range entries {
		names = append(names, e.Name())
	}
	return names
}

func (f *actionBoardFixture) post(ip, body string, edit func(*http.Request)) *httptest.ResponseRecorder {
	f.t.Helper()
	r := httptest.NewRequest(http.MethodPost, "/api/"+actionBoard+"/miners/"+ip+"/actions", strings.NewReader(body))
	r.Header.Set("Content-Type", "application/json")
	r.AddCookie(&http.Cookie{Name: "hb_session", Value: actionSession})
	if edit != nil {
		edit(r)
	}
	w := httptest.NewRecorder()
	f.router.ServeHTTP(w, r)
	return w
}

func (f *actionBoardFixture) miners() map[string]model.MinerInfo {
	f.t.Helper()
	r := httptest.NewRequest(http.MethodGet, "/api/"+actionBoard+"/miners", nil)
	r.AddCookie(&http.Cookie{Name: "hb_session", Value: actionSession})
	w := httptest.NewRecorder()
	f.router.ServeHTTP(w, r)
	if w.Code != http.StatusOK {
		f.t.Fatalf("GET miners = %d: %s", w.Code, w.Body.String())
	}
	var resp model.MinersResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		f.t.Fatal(err)
	}
	byIP := map[string]model.MinerInfo{}
	for _, m := range resp.Miners {
		byIP[m.IP] = m
	}
	return byIP
}

const restartBody = `{"action":"restart"}`

func TestRequestRemoteAction_writesOneFilePerMiner(t *testing.T) {
	f := newActionBoard(t, false)

	w := f.post(actionIP, restartBody, func(r *http.Request) {
		r.Header.Set("X-Real-IP", "203.0.113.7")
		r.Header.Set("User-Agent", "phone")
	})

	if w.Code != http.StatusAccepted {
		t.Fatalf("status = %d: %s", w.Code, w.Body.String())
	}
	var got model.RemoteAction
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got.Action != "restart" || got.Status != "pending" {
		t.Errorf("response = %+v", got)
	}
	if files := f.actionFiles(); len(files) != 1 || files[0] != actionMac+".json" {
		t.Fatalf("files = %v, want only the miner's request", files)
	}
	a, _ := f.readRequest(actionMac)
	if len(a.ID) != 32 || a.StorageKey != actionMac || a.Action != "restart" {
		t.Errorf("request = %+v", a)
	}
	if a.RequestedBy.IP != "203.0.113.7" || a.RequestedBy.UserAgent != "phone" {
		t.Errorf("requested by = %+v", a.RequestedBy)
	}
}

func TestRequestRemoteAction_boundsTheUserAgent(t *testing.T) {
	f := newActionBoard(t, false)

	w := f.post(actionIP, restartBody, func(r *http.Request) {
		r.Header.Set("User-Agent", strings.Repeat("é", 300))
	})

	if w.Code != http.StatusAccepted {
		t.Fatalf("status = %d", w.Code)
	}
	a, _ := f.readRequest(actionMac)
	if got := len([]rune(a.RequestedBy.UserAgent)); got != 256 {
		t.Errorf("User-Agent = %d runes, want 256", got)
	}
}

func TestRequestRemoteAction_refusesWithoutWriting(t *testing.T) {
	tests := []struct {
		name   string
		ip     string
		body   string
		edit   func(*http.Request)
		setup  func(*actionBoardFixture)
		status int
	}{
		{
			name: "no session", ip: actionIP, body: restartBody, status: http.StatusForbidden,
			edit: func(r *http.Request) { r.Header.Del("Cookie") },
		},
		{
			name: "another site's plain form", ip: actionIP, body: restartBody, status: http.StatusUnsupportedMediaType,
			edit: func(r *http.Request) { r.Header.Set("Content-Type", "text/plain") },
		},
		{name: "unknown action", ip: actionIP, body: `{"action":"set_pool"}`, status: http.StatusBadRequest},
		{name: "not JSON", ip: actionIP, body: `restart`, status: http.StatusBadRequest},
		{name: "body past 1 Kio", ip: actionIP, body: `{"pad":"` + strings.Repeat("x", 1024) + `","action":"restart"}`, status: http.StatusBadRequest},
		{name: "unknown miner", ip: "10.0.0.99", body: restartBody, status: http.StatusNotFound},
		{name: "an action the dashboard doesn't allow", ip: actionIP, body: `{"action":"switch_fallback"}`, status: http.StatusForbidden},
		{
			name: "everything off on the dashboard", ip: actionIP, body: restartBody, status: http.StatusForbidden,
			setup: func(f *actionBoardFixture) { f.writeSettings(`[]`, 60) },
		},
		{
			name: "no settings yet", ip: actionIP, body: restartBody, status: http.StatusForbidden,
			setup: func(f *actionBoardFixture) {
				if err := os.Remove(f.boardPath("settings.json")); err != nil {
					f.t.Fatal(err)
				}
			},
		},
		{
			name: "a miner gone quiet", ip: actionIP, body: restartBody, status: http.StatusConflict,
			setup: func(f *actionBoardFixture) { f.writeMiner(actionMac, actionIP, time.Now().Add(-24*time.Hour)) },
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			f := newActionBoard(t, false)
			if tt.setup != nil {
				tt.setup(f)
			}
			w := f.post(tt.ip, tt.body, tt.edit)
			if w.Code != tt.status {
				t.Errorf("status = %d, want %d: %s", w.Code, tt.status, w.Body.String())
			}
			if files := f.actionFiles(); len(files) != 0 {
				t.Errorf("files = %v, want nothing written", files)
			}
		})
	}
}

// Anyone may see a public board, so nobody may act from it -- not even with a
// session.
func TestRequestRemoteAction_refusedOnAPublicBoard(t *testing.T) {
	f := newActionBoard(t, true)

	w := f.post(actionIP, restartBody, nil)

	if w.Code != http.StatusForbidden {
		t.Errorf("status = %d, want 403", w.Code)
	}
	if files := f.actionFiles(); len(files) != 0 {
		t.Errorf("files = %v, want nothing written", files)
	}
}

func TestRequestRemoteAction_oneInProgressPerMiner(t *testing.T) {
	f := newActionBoard(t, false)
	f.writeMiner("aabbccddee02", "10.0.0.2", time.Now())

	if w := f.post(actionIP, restartBody, nil); w.Code != http.StatusAccepted {
		t.Fatalf("first request = %d", w.Code)
	}
	first, _ := f.readRequest(actionMac)

	if w := f.post(actionIP, restartBody, nil); w.Code != http.StatusConflict {
		t.Errorf("second request = %d, want 409", w.Code)
	}
	if again, _ := f.readRequest(actionMac); again.ID != first.ID {
		t.Errorf("request replaced by %s while in progress", again.ID)
	}
	if w := f.post("10.0.0.2", restartBody, nil); w.Code != http.StatusAccepted {
		t.Errorf("another miner's request = %d, want 202", w.Code)
	}
}

func TestRequestRemoteAction_replacesWhatIsOver(t *testing.T) {
	const lifetime = 2 * time.Minute
	oldID := strings.Repeat("a", 32)
	old := remoteactions.Action{ID: oldID, StorageKey: actionMac, Action: "restart"}
	tests := []struct {
		name  string
		setup func(*actionBoardFixture)
		want  int
	}{
		{"pending within its lifetime", func(f *actionBoardFixture) {
			old.CreatedAt = time.Now().Add(-lifetime + 10*time.Second)
			f.writeRequest(old)
		}, http.StatusConflict},
		{"pending, expired", func(f *actionBoardFixture) {
			old.CreatedAt = time.Now().Add(-lifetime - time.Second)
			f.writeRequest(old)
		}, http.StatusAccepted},
		{"polled within its lifetime, counted from the poll", func(f *actionBoardFixture) {
			old.CreatedAt = time.Now().Add(-time.Hour)
			f.writeRequest(old)
			f.writeState(oldID, time.Now().Add(-lifetime+10*time.Second))
		}, http.StatusConflict},
		{"polled, over", func(f *actionBoardFixture) {
			old.CreatedAt = time.Now().Add(-time.Hour)
			f.writeRequest(old)
			f.writeState(oldID, time.Now().Add(-lifetime-time.Second))
		}, http.StatusAccepted},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			f := newActionBoard(t, false)
			tt.setup(f)

			w := f.post(actionIP, restartBody, nil)

			if w.Code != tt.want {
				t.Fatalf("status = %d, want %d", w.Code, tt.want)
			}
			a, _ := f.readRequest(actionMac)
			if replaced := a.ID != oldID; replaced != (tt.want == http.StatusAccepted) {
				t.Errorf("request ID = %s, replaced = %v", a.ID, replaced)
			}
		})
	}
}

func TestRequestRemoteAction_tenPerBoardAnHour(t *testing.T) {
	f := newActionBoard(t, false)
	for i := range 11 {
		f.writeMiner(fmt.Sprintf("aabbccddef%02d", i), fmt.Sprintf("10.0.1.%d", i), time.Now())
	}

	for i := range 10 {
		if w := f.post(fmt.Sprintf("10.0.1.%d", i), restartBody, nil); w.Code != http.StatusAccepted {
			t.Fatalf("request %d = %d, want 202", i, w.Code)
		}
	}
	if w := f.post("10.0.1.10", restartBody, nil); w.Code != http.StatusTooManyRequests {
		t.Errorf("11th request = %d, want 429", w.Code)
	}
	if _, written := f.readRequest("aabbccddef10"); written {
		t.Error("the 11th request was written")
	}
}

func TestListMiners_showsTheActionInProgress(t *testing.T) {
	f := newActionBoard(t, false)

	if m := f.miners()[actionIP]; m.RemoteAction != nil {
		t.Fatalf("remoteAction = %+v before any request", m.RemoteAction)
	}

	if w := f.post(actionIP, restartBody, nil); w.Code != http.StatusAccepted {
		t.Fatalf("request = %d", w.Code)
	}
	m := f.miners()[actionIP]
	if m.RemoteAction == nil || m.RemoteAction.Status != "pending" || m.RemoteAction.PolledAt != nil {
		t.Fatalf("remoteAction = %+v, want pending", m.RemoteAction)
	}

	a, _ := f.readRequest(actionMac)
	f.writeState(a.ID, time.Now())
	m = f.miners()[actionIP]
	if m.RemoteAction == nil || m.RemoteAction.Status != "polled" || m.RemoteAction.PolledAt == nil {
		t.Fatalf("remoteAction = %+v, want polled", m.RemoteAction)
	}

	f.writeState(a.ID, time.Now().Add(-3*time.Minute))
	if m := f.miners()[actionIP]; m.RemoteAction != nil {
		t.Errorf("remoteAction = %+v, want nothing once over", m.RemoteAction)
	}
}

// The state left by the miner's previous request says nothing of this one.
func TestListMiners_aStateOfAnotherIDLeavesTheRequestPending(t *testing.T) {
	f := newActionBoard(t, false)
	if w := f.post(actionIP, restartBody, nil); w.Code != http.StatusAccepted {
		t.Fatalf("request = %d", w.Code)
	}
	f.writeState(strings.Repeat("c", 32), time.Now())

	m := f.miners()[actionIP]
	if m.RemoteAction == nil || m.RemoteAction.Status != "pending" {
		t.Errorf("remoteAction = %+v, want pending", m.RemoteAction)
	}
}

func TestListMiners_offersActionsOnlyWhereTheyCanRun(t *testing.T) {
	t.Run("a live miner of a private board", func(t *testing.T) {
		f := newActionBoard(t, false)
		if got := f.miners()[actionIP].RemoteActions; len(got) != 2 {
			t.Errorf("remoteActions = %v, want the board's settings", got)
		}
	})
	t.Run("a miner gone quiet", func(t *testing.T) {
		f := newActionBoard(t, false)
		f.writeMiner(actionMac, actionIP, time.Now().Add(-24*time.Hour))
		if got := f.miners()[actionIP].RemoteActions; len(got) != 0 {
			t.Errorf("remoteActions = %v, want none", got)
		}
	})
	t.Run("a public board", func(t *testing.T) {
		f := newActionBoard(t, true)
		f.writeRequest(remoteactions.Action{ID: strings.Repeat("a", 32), StorageKey: actionMac, Action: "restart", CreatedAt: time.Now()})
		m := f.miners()[actionIP]
		if len(m.RemoteActions) != 0 || m.RemoteAction != nil {
			t.Errorf("remoteActions = %v, remoteAction = %+v, want none", m.RemoteActions, m.RemoteAction)
		}
	})
}
