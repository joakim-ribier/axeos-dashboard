package firmware

import "testing"

func TestIsNewer(t *testing.T) {
	tests := []struct {
		latest, current string
		want            bool
	}{
		{"v2.15.3", "v2.15.0", true},
		{"v1.1.1", "v1.1.0.1", true},
		{"v1.1.0.1", "v1.1.1", false}, // device updated past a stale cached latest
		{"v1.1.1", "v1.1.1", false},
		{"v1.1.0", "v1.1", false},
		{"v1.0.37.4-LTS", "v1.1.1", false},
		{"v1.1.1", "v1.1.1-rc1", true},
		{"v2.10.0", "v2.9.9", true},
		{"nightly", "v1.0.0", true},
		{"nightly", "nightly", false},
	}
	for _, tt := range tests {
		if got := IsNewer(tt.latest, tt.current); got != tt.want {
			t.Errorf("IsNewer(%q, %q) = %v, want %v", tt.latest, tt.current, got, tt.want)
		}
	}
}
