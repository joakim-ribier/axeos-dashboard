// internal/remotepush/board.go
package remotepush

import (
	"encoding/json"
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
}

// BoardCache bounds how often dashboard-api asks hashboard, whatever the
// number of open tabs -- hashboard rate-limits GET /api/board/info per
// board. A failed fetch is cached too (as an empty Board), so an
// unreachable hashboard isn't retried on every request.
type BoardCache struct {
	mu        sync.Mutex
	key       string
	fetchedAt time.Time
	board     Board
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
		return c.board, nil
	}
	board, err := FetchBoard(pushURL, apiKey)
	c.key, c.fetchedAt, c.board = key, time.Now(), board
	return board, err
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
		return Board{}, fmt.Errorf("unexpected status %s (/board/info)", resp.Status)
	}
	var board Board
	if err := json.NewDecoder(resp.Body).Decode(&board); err != nil {
		return Board{}, fmt.Errorf("invalid /board/info response: %w", err)
	}
	return board, nil
}
