package storage

import (
	"testing"
	"time"
)

func TestApplyPoll_accumulatesUptimeAndShares(t *testing.T) {
	now := time.Date(2026, 7, 14, 10, 0, 0, 0, time.UTC)
	payload := []byte(`{"uptimeSeconds":120,"sharesAccepted":5,"sharesRejected":1,"power":100}`)

	got, err := ApplyPoll(Totals{}, now, payload, 0.20)
	if err != nil {
		t.Fatalf("ApplyPoll() unexpected error: %v", err)
	}

	if got.TotalUptimeSeconds != 120 {
		t.Errorf("TotalUptimeSeconds = %d, want 120", got.TotalUptimeSeconds)
	}
	if got.TotalSharesAccepted != 5 {
		t.Errorf("TotalSharesAccepted = %d, want 5", got.TotalSharesAccepted)
	}
	if got.TotalSharesRejected != 1 {
		t.Errorf("TotalSharesRejected = %d, want 1", got.TotalSharesRejected)
	}
	if !got.UpdatedAt.Equal(now) {
		t.Errorf("UpdatedAt = %v, want %v", got.UpdatedAt, now)
	}
}

func TestApplyPoll_electricityCost_accumulatesAcrossPolls(t *testing.T) {
	now := time.Date(2026, 7, 14, 10, 0, 0, 0, time.UTC)

	// First poll: 1h of uptime at 100W, €0.20/kWh -> 0.1 kWh -> €0.02.
	t1, err := ApplyPoll(Totals{}, now, []byte(`{"uptimeSeconds":3600,"power":100}`), 0.20)
	if err != nil {
		t.Fatalf("ApplyPoll() #1 unexpected error: %v", err)
	}
	if got, want := t1.TotalElectricityCost, 0.02; !almostEqual(got, want) {
		t.Errorf("TotalElectricityCost after poll #1 = %v, want %v", got, want)
	}

	// Second poll, one more hour at 100W -- but the rate has since changed
	// to €0.25/kWh. Only this poll's own slice should use the new rate; the
	// first poll's €0.02 must stay exactly as it was computed.
	t2, err := ApplyPoll(t1, now.Add(time.Hour), []byte(`{"uptimeSeconds":7200,"power":100}`), 0.25)
	if err != nil {
		t.Fatalf("ApplyPoll() #2 unexpected error: %v", err)
	}
	if got, want := t2.TotalElectricityCost, 0.045; !almostEqual(got, want) {
		t.Errorf("TotalElectricityCost after poll #2 = %v, want %v", got, want)
	}
}

func TestApplyPoll_electricityCost_deviceRebootBillsOnlyThePostRebootSegment(t *testing.T) {
	seed := Totals{LastUptimeSeconds: 7200}

	// Device rebooted: its own uptime counter reset to 600s (10 min) --
	// only that post-reboot segment should be billed, not a naive
	// current-minus-last (which would go negative).
	got, err := ApplyPoll(seed, time.Now(), []byte(`{"uptimeSeconds":600,"power":150}`), 0.20)
	if err != nil {
		t.Fatalf("ApplyPoll() unexpected error: %v", err)
	}

	want := 0.005 // 150W * (600s/3600s) / 1000 * €0.20/kWh
	if !almostEqual(got.TotalElectricityCost, want) {
		t.Errorf("TotalElectricityCost = %v, want %v", got.TotalElectricityCost, want)
	}
}

func TestApplyPoll_electricityCost_zeroRateAddsNothing(t *testing.T) {
	got, err := ApplyPoll(Totals{}, time.Now(), []byte(`{"uptimeSeconds":3600,"power":100}`), 0)
	if err != nil {
		t.Fatalf("ApplyPoll() unexpected error: %v", err)
	}
	if got.TotalElectricityCost != 0 {
		t.Errorf("TotalElectricityCost = %v, want 0 with no rate configured", got.TotalElectricityCost)
	}
}

func almostEqual(a, b float64) bool {
	const epsilon = 1e-9
	diff := a - b
	if diff < 0 {
		diff = -diff
	}
	return diff < epsilon
}
