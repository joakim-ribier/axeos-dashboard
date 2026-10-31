package alerts

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

var t0 = time.Date(2026, 10, 28, 10, 0, 0, 0, time.UTC)

func reading(temp, fan float64) Poll {
	return Poll{Temp: temp, FanSpeed: fan, Version: "v2", LatestVersion: "v2"}
}

// observeAll runs polls 2 minutes apart and returns each one's changes, as
// "type state" joined by ", " ("" for none).
func observeAll(s *MinerState, polls []Poll) []string {
	var got []string
	for i, p := range polls {
		var changes []string
		for _, e := range s.Observe(t0.Add(time.Duration(i)*2*time.Minute), p) {
			changes = append(changes, e.Type+" "+string(e.State))
		}
		got = append(got, strings.Join(changes, ", "))
	}
	return got
}

func assertChanges(t *testing.T, got, want []string) {
	t.Helper()
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("poll %d: got %q, want %q", i, got[i], want[i])
		}
	}
}

func TestObserve_tempRaisesAboveThresholdAndClearsUnderTheLowerOne(t *testing.T) {
	got := observeAll(&MinerState{}, []Poll{
		reading(55, 50),
		reading(62, 50), // the threshold itself doesn't raise
		reading(62.5, 50),
		reading(63, 50), // still high: nothing new
		reading(61, 50), // under 62 but not under 60: still raised
		reading(60, 50),
		reading(59.9, 50),
		reading(61, 50), // under 62: stays cleared
	})
	assertChanges(t, got, []string{"", "", "tempHigh raised", "", "", "", "tempHigh cleared", ""})
}

func TestObserve_fanRaisesAboveThresholdAndClearsUnderTheLowerOne(t *testing.T) {
	got := observeAll(&MinerState{}, []Poll{
		reading(50, 75),
		reading(50, 76),
		reading(50, 71),
		reading(50, 70),
		reading(50, 69),
	})
	assertChanges(t, got, []string{"", "fanHigh raised", "", "", "fanHigh cleared"})
}

func TestObserve_offlineAfterTwoFailedPollsInARow(t *testing.T) {
	timeout := Poll{Err: errors.New("timeout")}
	got := observeAll(&MinerState{}, []Poll{
		timeout,
		reading(50, 50), // a single miss is forgotten
		timeout,
		timeout,
		timeout,
		reading(50, 50),
	})
	assertChanges(t, got, []string{"", "", "", "offline raised", "", "offline cleared"})
}

func TestObserve_aMinerThatDoesntAnswerKeepsItsOtherAlerts(t *testing.T) {
	timeout := Poll{Err: errors.New("timeout")}
	got := observeAll(&MinerState{}, []Poll{
		reading(70, 50),
		timeout,
		timeout,
		reading(55, 50),
	})
	assertChanges(t, got, []string{"tempHigh raised", "", "offline raised", "offline cleared, tempHigh cleared"})
}

func TestObserve_macMismatch(t *testing.T) {
	got := observeAll(&MinerState{}, []Poll{
		reading(70, 50),
		{ReportedMac: "ffffffffffff"}, // another device: nothing about this miner's readings
		{ReportedMac: "ffffffffffff"},
		reading(70, 50),
		reading(55, 50),
	})
	assertChanges(t, got, []string{"tempHigh raised", "macMismatch raised", "", "macMismatch cleared", "tempHigh cleared"})
}

func TestObserve_firmware(t *testing.T) {
	got := observeAll(&MinerState{}, []Poll{
		{Version: "v1", LatestVersion: "v2"},
		{Version: "v1"}, // latest unknown: left as it was
		{Version: "v1", LatestVersion: "v2"},
		{Version: "v2", LatestVersion: "v2"},
	})
	assertChanges(t, got, []string{"firmwareUpdate raised", "", "", "firmwareUpdate cleared"})
}

func TestObserve_events(t *testing.T) {
	var s MinerState

	raised := s.Observe(t0, Poll{Temp: 64.4, Version: "v1", LatestVersion: "v2"})
	if len(raised) != 2 {
		t.Fatalf("got %+v, want tempHigh and firmwareUpdate raised", raised)
	}
	if e := raised[0]; e.Type != TypeTempHigh || e.State != Raised || e.Value != 64.4 || e.Threshold != TempThreshold || !e.Timestamp.Equal(t0) {
		t.Errorf("tempHigh raised = %+v", e)
	}
	if e := raised[1]; e.Type != TypeFirmwareUpdate || e.Message != "v2" {
		t.Errorf("firmwareUpdate raised = %+v, want the version available as its message", e)
	}
	withPeak := raised[0]
	withPeak.Peak = 64.4
	if s.Ongoing[TypeTempHigh] != withPeak || s.Ongoing[TypeFirmwareUpdate] != raised[1] {
		t.Errorf("Ongoing = %+v, want the events that raised them (with the peak so far)", s.Ongoing)
	}

	cleared := s.Observe(t0.Add(time.Hour), Poll{Temp: 50, Version: "v2", LatestVersion: "v2"})
	if len(cleared) != 2 {
		t.Fatalf("got %+v, want both cleared", cleared)
	}
	for _, e := range cleared {
		if e.State != Cleared || e.RaisedAt == nil || !e.RaisedAt.Equal(t0) || e.Value != 0 || e.Message != "" {
			t.Errorf("cleared = %+v, want only when it was raised", e)
		}
	}

	if len(s.Ongoing) != 0 {
		t.Errorf("Ongoing after both cleared = %+v, want none", s.Ongoing)
	}

	offline := MinerState{Failures: OfflineAfter - 1}
	if e := offline.Observe(t0, Poll{Err: errors.New("i/o timeout")}); len(e) != 1 || e[0].Message != "i/o timeout" {
		t.Errorf("offline raised = %+v, want the connection error as its message", e)
	}
	mismatch := s.Observe(t0, Poll{ReportedMac: "ffffffffffff"})
	if len(mismatch) != 1 || mismatch[0].Message != "ffffffffffff" {
		t.Errorf("macMismatch raised = %+v, want the reported mac as its message", mismatch)
	}
}

func TestObserve_peak(t *testing.T) {
	var s MinerState
	for _, fan := range []float64{80, 92, 99, 85, 72} {
		if events := s.Observe(t0, reading(50, fan)); len(events) > 0 && events[0].Peak != 0 {
			t.Errorf("raised = %+v, want no peak on it", events[0])
		}
	}
	if peak := s.Ongoing[TypeFanHigh].Peak; peak != 99 {
		t.Errorf("Ongoing peak = %v, want the highest reading so far, 99", peak)
	}

	cleared := s.Observe(t0, reading(50, 60))
	if len(cleared) != 1 || cleared[0].State != Cleared || cleared[0].Peak != 99 {
		t.Errorf("cleared = %+v, want it with its peak, 99", cleared)
	}

	// Raised again later: a peak of its own.
	s.Observe(t0, reading(50, 77))
	if cleared := s.Observe(t0, reading(50, 50)); len(cleared) != 1 || cleared[0].Peak != 77 {
		t.Errorf("second cleared = %+v, want peak 77", cleared)
	}

	// Nothing to measure: no peak.
	s.Observe(t0, Poll{Version: "v1", LatestVersion: "v2"})
	if cleared := s.Observe(t0, Poll{Version: "v2", LatestVersion: "v2"}); len(cleared) != 1 || cleared[0].Peak != 0 {
		t.Errorf("firmware cleared = %+v, want no peak", cleared)
	}
}

func TestState_savedAndLoaded(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "aabbccddeeff")

	empty, err := LoadState(dir)
	if err != nil || empty.Failures != 0 || len(empty.Ongoing) != 0 {
		t.Fatalf("LoadState() with no file = %+v, %v; want an empty state", empty, err)
	}

	raised := Event{Timestamp: t0, Type: TypeTempHigh, State: Raised, Value: 64}
	if err := SaveState(dir, MinerState{Failures: 1, Ongoing: map[string]Event{TypeTempHigh: raised}}); err != nil {
		t.Fatal(err)
	}
	got, err := LoadState(dir)
	if err != nil {
		t.Fatal(err)
	}
	if got.Failures != 1 || got.Ongoing[TypeTempHigh].Value != 64 || !got.Ongoing[TypeTempHigh].Timestamp.Equal(t0) {
		t.Errorf("LoadState() = %+v, want what was saved", got)
	}
	if _, err := os.Stat(filepath.Join(dir, stateFile+".tmp")); !os.IsNotExist(err) {
		t.Errorf("temp file left behind: %v", err)
	}
}
