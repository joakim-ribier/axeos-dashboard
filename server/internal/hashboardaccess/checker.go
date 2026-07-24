// Package hashboardaccess is a small, read-only reader of hashboard's shared
// account/session files, used to gate access to private boards. It does not
// import hashboard's Go module — the two backends never call each other over
// HTTP or share Go code, only a data directory on disk (see both repos'
// CLAUDE.md). The JSON shapes read here (account.public, session.boardId /
// .expiresAt) are a documented cross-repo contract with
// hashboard/server/internal/storage.
package hashboardaccess

import (
	"encoding/json"
	"os"
	"path/filepath"
	"time"
)

const (
	accountsDir = "accounts"
	sessionsDir = "sessions"
)

// Checker reads hashboard's accounts/ and sessions/ directories, which live
// alongside the boards/ directory this service already reads for miner data.
type Checker struct {
	dataDir string
}

// New builds a Checker rooted at hashboard's shared data directory (the
// parent of boards/, accounts/ and sessions/).
func New(dataDir string) *Checker {
	return &Checker{dataDir: dataDir}
}

type account struct {
	Public bool `json:"public"`
}

type session struct {
	BoardID   string    `json:"boardId"`
	ExpiresAt time.Time `json:"expiresAt"`
}

// IsAllowed reports whether a request for boardID should be served: either
// the board is public, or sessionToken (the raw hb_session cookie value, ""
// if absent) resolves to a still-valid session for that exact board.
func (c *Checker) IsAllowed(boardID, sessionToken string) (bool, error) {
	if !isValidBoardID(boardID) {
		return false, nil
	}

	public, err := c.IsPublic(boardID)
	if err != nil {
		return false, err
	}
	if public {
		return true, nil
	}

	if sessionToken == "" || !isValidHexToken(sessionToken) {
		return false, nil
	}
	sess, err := c.readSession(sessionToken)
	if err != nil {
		return false, err
	}
	if sess == nil {
		return false, nil
	}
	if time.Now().UTC().After(sess.ExpiresAt) {
		return false, nil
	}
	return sess.BoardID == boardID, nil
}

// IsPublic reports whether boardID's account is marked public. Also
// exported for handlers that need the current flag directly (e.g. to
// surface it in the miners response), not just as an allow/deny gate.
func (c *Checker) IsPublic(boardID string) (bool, error) {
	path := filepath.Join(c.dataDir, accountsDir, boardID+".json")
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return false, nil
		}
		return false, err
	}
	var a account
	if err := json.Unmarshal(data, &a); err != nil {
		return false, err
	}
	return a.Public, nil
}

func (c *Checker) readSession(token string) (*session, error) {
	path := filepath.Join(c.dataDir, sessionsDir, token+".json")
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	var s session
	if err := json.Unmarshal(data, &s); err != nil {
		return nil, err
	}
	return &s, nil
}

// isValidBoardID accepts hashboard's generated boardId alphabet (lowercase
// alphanumeric, storage.randomID — normally 16 characters) as well as
// shorter hand-picked IDs like the static "demo" board
// (hashboard/internal/demo), which isn't created through the normal
// account-creation flow. Checked defensively before building any path from
// a caller-supplied value — no length floor, but bounded above and
// restricted to a safe alphabet (no "/", "\", "." etc.) to rule out path
// traversal.
func isValidBoardID(id string) bool {
	if id == "" || len(id) > 32 {
		return false
	}
	for _, c := range id {
		if !((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9')) {
			return false
		}
	}
	return true
}

// isValidHexToken matches hashboard's session token format (64 lowercase hex
// characters, storage.randomHex(32)) — checked defensively before building
// any path from a caller-supplied value.
func isValidHexToken(token string) bool {
	if len(token) != 64 {
		return false
	}
	for _, c := range token {
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f')) {
			return false
		}
	}
	return true
}
