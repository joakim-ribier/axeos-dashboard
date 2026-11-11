// internal/remotepush/limit.go
package remotepush

import "github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"

// Split is which of the enabled miners go to the board, and which are held
// back past its miner limit: the first ones in the configuration's order
// are sent, so the choice stays the same from one poll to the next. With no
// limit known, every one is sent -- hashboard decides. A miner with no mac
// is in neither: it's never pushed.
func Split(miners []config.Bitaxe, board Board) (sent, held []config.Bitaxe) {
	for _, m := range miners {
		if m.StorageKey() == "" {
			continue
		}
		if board.MinerQuota != nil && len(sent) >= board.MinerQuota.Limit {
			held = append(held, m)
			continue
		}
		sent = append(sent, m)
	}
	return sent, held
}
