package firmware

import (
	"strconv"
	"strings"
)

// IsNewer reports whether latest is a newer firmware than current. A plain
// inequality isn't enough: the latest release is cached for a while, so a
// device updated in the meantime runs a version newer than the cached one.
// Firmware versions don't always follow semver (NerdQAxe++ has v1.1.0.1), so
// any number of numeric segments is compared. Same numbers with another
// suffix (v1.1.1-rc1 then v1.1.1), or an unreadable version, still count as
// an update.
func IsNewer(latest, current string) bool {
	l, lok := numericSegments(latest)
	c, cok := numericSegments(current)
	if !lok || !cok {
		return latest != current
	}
	for i := 0; i < max(len(l), len(c)); i++ {
		lv, cv := segmentAt(l, i), segmentAt(c, i)
		if lv != cv {
			return lv > cv
		}
	}
	return suffix(latest) != suffix(current)
}

func suffix(version string) string {
	_, s, _ := strings.Cut(version, "-")
	return s
}

func numericSegments(version string) ([]int, bool) {
	version = strings.TrimPrefix(strings.TrimSpace(version), "v")
	version, _, _ = strings.Cut(version, "-")
	parts := strings.Split(version, ".")
	segments := make([]int, len(parts))
	for i, part := range parts {
		n, err := strconv.Atoi(part)
		if err != nil {
			return nil, false
		}
		segments[i] = n
	}
	return segments, true
}

func segmentAt(segments []int, i int) int {
	if i < len(segments) {
		return segments[i]
	}
	return 0
}
