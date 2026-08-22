// internal/model/alert.go
package model

// Alert is one alert calculated by the feeder at a single poll -- level
// -triggered (present as long as the condition is true when the sample was
// taken, not just at the moment it first became true). Each tick computes
// its own alerts independently, from that tick's payload alone; there is no
// comparison against a previous poll anywhere on the server. Any smarter
// display logic (grouping consecutive identical alerts, showing only one
// entry for a spike lasting several ticks, etc.) belongs in the frontend.
type Alert struct {
	Type      string  `json:"type"` // "tempHigh", "fanHigh", "offline", "macMismatch", "firmwareUpdate"
	Message   string  `json:"message,omitempty"`
	Value     float64 `json:"value,omitempty"`     // the reading that triggered it (temp/fan), omitted otherwise
	Threshold float64 `json:"threshold,omitempty"` // the threshold in effect at calculation time, omitted otherwise
}

const (
	AlertTempHigh      = "tempHigh"
	AlertFanHigh       = "fanHigh"
	AlertOffline       = "offline"
	AlertMacMismatch   = "macMismatch"
	AlertFirmwareStale = "firmwareUpdate"
)

// Default alert thresholds -- not configurable for this iteration (see
// cmd/feeder's computeAlerts). Matches the values the client used to default
// to before this moved server-side.
const (
	DefaultTempThreshold = 62.0 // °C
	DefaultFanThreshold  = 75.0 // %
)
