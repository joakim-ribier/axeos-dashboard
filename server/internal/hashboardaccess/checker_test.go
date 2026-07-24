package hashboardaccess

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func writeJSON(t *testing.T, path string, v any) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	data, err := json.Marshal(v)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, data, 0o644); err != nil {
		t.Fatal(err)
	}
}

func writeAccount(t *testing.T, dataDir, boardID string, public bool) {
	t.Helper()
	writeJSON(t, filepath.Join(dataDir, accountsDir, boardID+".json"), account{Public: public})
}

func writeSession(t *testing.T, dataDir, token, boardID string, expiresAt time.Time) {
	t.Helper()
	writeJSON(t, filepath.Join(dataDir, sessionsDir, token+".json"), session{BoardID: boardID, ExpiresAt: expiresAt})
}

const (
	testBoardID = "abcd1234efgh5678"
	testToken   = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
)

func TestIsAllowed_publicBoardBypassesSession(t *testing.T) {
	dir := t.TempDir()
	writeAccount(t, dir, testBoardID, true)
	c := New(dir)

	allowed, err := c.IsAllowed(testBoardID, "")
	if err != nil {
		t.Fatal(err)
	}
	if !allowed {
		t.Error("public board with no session should be allowed")
	}
}

func TestIsAllowed_privateBoardNoSessionDenied(t *testing.T) {
	dir := t.TempDir()
	writeAccount(t, dir, testBoardID, false)
	c := New(dir)

	allowed, err := c.IsAllowed(testBoardID, "")
	if err != nil {
		t.Fatal(err)
	}
	if allowed {
		t.Error("private board with no session should be denied")
	}
}

func TestIsAllowed_privateBoardValidSessionAllowed(t *testing.T) {
	dir := t.TempDir()
	writeAccount(t, dir, testBoardID, false)
	writeSession(t, dir, testToken, testBoardID, time.Now().UTC().Add(24*time.Hour))
	c := New(dir)

	allowed, err := c.IsAllowed(testBoardID, testToken)
	if err != nil {
		t.Fatal(err)
	}
	if !allowed {
		t.Error("private board with a valid, matching session should be allowed")
	}
}

func TestIsAllowed_expiredSessionDenied(t *testing.T) {
	dir := t.TempDir()
	writeAccount(t, dir, testBoardID, false)
	writeSession(t, dir, testToken, testBoardID, time.Now().UTC().Add(-time.Hour))
	c := New(dir)

	allowed, err := c.IsAllowed(testBoardID, testToken)
	if err != nil {
		t.Fatal(err)
	}
	if allowed {
		t.Error("expired session should be denied")
	}
}

func TestIsAllowed_sessionForDifferentBoardDenied(t *testing.T) {
	dir := t.TempDir()
	writeAccount(t, dir, testBoardID, false)
	otherBoard := "zzzzzzzzzzzzzzzz"
	writeSession(t, dir, testToken, otherBoard, time.Now().UTC().Add(24*time.Hour))
	c := New(dir)

	allowed, err := c.IsAllowed(testBoardID, testToken)
	if err != nil {
		t.Fatal(err)
	}
	if allowed {
		t.Error("a session valid for a different board should be denied")
	}
}

func TestIsAllowed_unknownBoardDenied(t *testing.T) {
	dir := t.TempDir()
	c := New(dir)

	allowed, err := c.IsAllowed(testBoardID, "")
	if err != nil {
		t.Fatal(err)
	}
	if allowed {
		t.Error("a board with no account file should be denied, not error")
	}
}

func TestIsAllowed_malformedBoardIDRejected(t *testing.T) {
	dir := t.TempDir()
	c := New(dir)

	for _, bad := range []string{"", strings.Repeat("a", 33), "abcd1234EFGH5678", "../../etc/passwd", "with/slash"} {
		allowed, err := c.IsAllowed(bad, "")
		if err != nil {
			t.Fatalf("boardID %q: unexpected error %v", bad, err)
		}
		if allowed {
			t.Errorf("boardID %q: should be rejected", bad)
		}
	}
}

func TestIsAllowed_shortHandPickedBoardIDAccepted(t *testing.T) {
	// Not every board goes through the random 16-char generation flow — the
	// static "demo" board (hashboard/internal/demo) uses a short, hand-picked
	// ID and ships with a committed accounts/demo.json marked public.
	dir := t.TempDir()
	writeAccount(t, dir, "demo", true)
	c := New(dir)

	allowed, err := c.IsAllowed("demo", "")
	if err != nil {
		t.Fatal(err)
	}
	if !allowed {
		t.Error("short hand-picked boardId \"demo\" (public) should be allowed")
	}
}

func TestIsAllowed_malformedSessionTokenRejected(t *testing.T) {
	dir := t.TempDir()
	writeAccount(t, dir, testBoardID, false)
	c := New(dir)

	for _, bad := range []string{"short", strings.Repeat("g", 64), "../../etc/passwd"} {
		allowed, err := c.IsAllowed(testBoardID, bad)
		if err != nil {
			t.Fatalf("token %q: unexpected error %v", bad, err)
		}
		if allowed {
			t.Errorf("token %q: should be rejected", bad)
		}
	}
}
