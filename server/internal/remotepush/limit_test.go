// internal/remotepush/limit_test.go
package remotepush

import (
	"slices"
	"testing"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
)

func TestSplit(t *testing.T) {
	miners := []config.Bitaxe{
		{Hostname: "a", Mac: "aa:aa:aa:aa:aa:01"},
		{Hostname: "no-mac"},
		{Hostname: "b", Mac: "aa:aa:aa:aa:aa:02"},
		{Hostname: "c", Mac: "aa:aa:aa:aa:aa:03"},
	}
	names := func(ms []config.Bitaxe) []string {
		out := []string{}
		for _, m := range ms {
			out = append(out, m.Hostname)
		}
		return out
	}

	tests := []struct {
		name       string
		board      Board
		sent, held []string
	}{
		{"no limit known: every one", Board{}, []string{"a", "b", "c"}, []string{}},
		{"room for all", Board{Miners: &BoardMiners{Limit: 10}}, []string{"a", "b", "c"}, []string{}},
		{"the first ones, in order", Board{Miners: &BoardMiners{Limit: 2}}, []string{"a", "b"}, []string{"c"}},
		{"a limit of 0: none", Board{Miners: &BoardMiners{Limit: 0}}, []string{}, []string{"a", "b", "c"}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			sent, held := Split(miners, tt.board)
			if !slices.Equal(names(sent), tt.sent) || !slices.Equal(names(held), tt.held) {
				t.Errorf("Split() = %v, %v, want %v, %v", names(sent), names(held), tt.sent, tt.held)
			}
		})
	}
}
