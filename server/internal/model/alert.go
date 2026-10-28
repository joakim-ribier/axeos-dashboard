// internal/model/alert.go
package model

// Alert marks a poll the miner didn't answer, on its line of the day's
// history (and of a board's, pushed as is) -- the 24h chart reads it as a
// dip to 0. The alerts themselves are internal/alerts'.
type Alert struct {
	Type    string `json:"type"`
	Message string `json:"message,omitempty"`
}

const AlertOffline = "offline"
