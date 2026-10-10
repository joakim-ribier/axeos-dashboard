package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/audit"
)

// auditFixture records one entry per given type, an hour apart, ending an
// hour ago -- all inside the default last-24h window.
func auditFixture(t *testing.T, entries ...audit.Entry) *audit.Log {
	t.Helper()
	log := audit.NewLog(t.TempDir())
	start := time.Now().Add(-time.Duration(len(entries)+1) * time.Hour)
	for i, e := range entries {
		e.Timestamp = start.Add(time.Duration(i) * time.Hour)
		if err := log.Record(e); err != nil {
			t.Fatal(err)
		}
	}
	return log
}

func getAudit(t *testing.T, h http.HandlerFunc, query string) (*httptest.ResponseRecorder, AuditResponse) {
	t.Helper()
	w := httptest.NewRecorder()
	h(w, httptest.NewRequest(http.MethodGet, "/api/audit?"+query, nil))
	var resp AuditResponse
	if w.Code == http.StatusOK {
		if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
			t.Fatal(err)
		}
	}
	return w, resp
}

func entryTypes(entries []audit.Entry) []string {
	out := make([]string, len(entries))
	for i, e := range entries {
		out[i] = e.Type
	}
	return out
}

func TestListAudit(t *testing.T) {
	log := auditFixture(t,
		audit.Entry{Type: audit.TypeRestart, Target: "10.0.0.1"},
		audit.Entry{Type: audit.TypeSwitchFallback},
		audit.Entry{Type: audit.TypeSaveMiners},
		audit.Entry{Type: audit.TypeRestart, Target: "10.0.0.2"},
	)
	h := ListAudit(log)

	t.Run("defaults to the last 24 hours, newest first", func(t *testing.T) {
		_, resp := getAudit(t, h, "")
		want := []string{audit.TypeRestart, audit.TypeSaveMiners, audit.TypeSwitchFallback, audit.TypeRestart}
		if strings.Join(entryTypes(resp.Entries), ",") != strings.Join(want, ",") {
			t.Errorf("types = %v, want %v", entryTypes(resp.Entries), want)
		}
		if resp.Total != 4 {
			t.Errorf("total = %d, want 4", resp.Total)
		}
	})

	t.Run("a range that ends before every entry is empty, not null", func(t *testing.T) {
		from := time.Now().Add(-72 * time.Hour).UTC().Format(time.RFC3339)
		to := time.Now().Add(-48 * time.Hour).UTC().Format(time.RFC3339)
		_, resp := getAudit(t, h, "from="+from+"&to="+to)
		if resp.Total != 0 {
			t.Errorf("total = %d, want 0", resp.Total)
		}
		if resp.Entries == nil {
			t.Error("entries = null, want []")
		}
	})

	t.Run("ip keeps that miner's entries and pool switches applied to every miner", func(t *testing.T) {
		_, resp := getAudit(t, h, "ip=10.0.0.1")
		want := []string{audit.TypeSwitchFallback, audit.TypeRestart}
		if strings.Join(entryTypes(resp.Entries), ",") != strings.Join(want, ",") {
			t.Errorf("types = %v, want %v", entryTypes(resp.Entries), want)
		}
	})

	t.Run("type keeps only that type", func(t *testing.T) {
		_, resp := getAudit(t, h, "type=restart")
		if resp.Total != 2 {
			t.Errorf("total = %d, want 2", resp.Total)
		}
	})

	t.Run("paginates after filtering", func(t *testing.T) {
		_, resp := getAudit(t, h, "page=2&pageSize=3")
		if resp.Total != 4 || len(resp.Entries) != 1 || resp.Entries[0].Target != "10.0.0.1" {
			t.Errorf("got total %d, entries %+v, want the oldest entry alone on page 2", resp.Total, resp.Entries)
		}
	})

	for name, query := range map[string]string{
		"malformed from":        "from=yesterday",
		"malformed to":          "to=now",
		"from after to":         "from=2026-10-10T00:00:00Z&to=2026-10-09T00:00:00Z",
		"range over seven days": "from=2026-10-01T00:00:00Z&to=2026-10-09T00:00:00Z",
	} {
		t.Run(name+" is rejected", func(t *testing.T) {
			if w, _ := getAudit(t, h, query); w.Code != http.StatusBadRequest {
				t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
			}
		})
	}
}

func TestExportAudit(t *testing.T) {
	log := auditFixture(t,
		audit.Entry{Type: audit.TypeRestart, Target: "10.0.0.1"},
		audit.Entry{Type: audit.TypeSaveSettings},
		audit.Entry{Type: audit.TypeRestart, Target: "10.0.0.2"},
	)

	from := time.Now().Add(-24 * time.Hour).UTC().Truncate(time.Second)
	to := time.Now().UTC().Truncate(time.Second)
	w := httptest.NewRecorder()
	ExportAudit(log)(w, httptest.NewRequest(http.MethodGet,
		"/api/audit/export?type=restart&from="+from.Format(time.RFC3339)+"&to="+to.Format(time.RFC3339), nil))

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
	}
	if cd := w.Header().Get("Content-Disposition"); !strings.HasPrefix(cd, `attachment; filename="audit-`) {
		t.Errorf("Content-Disposition = %q, want an audit-*.json attachment", cd)
	}

	var export AuditExport
	if err := json.NewDecoder(w.Body).Decode(&export); err != nil {
		t.Fatal(err)
	}
	if !export.From.Equal(from) || !export.To.Equal(to) || export.Type != audit.TypeRestart {
		t.Errorf("header = %s → %s, type %q, want the requested range and filter", export.From, export.To, export.Type)
	}
	// Unpaginated: every matching entry, whatever the list's page size.
	if export.Total != 2 || len(export.Entries) != 2 || export.Entries[0].Target != "10.0.0.2" {
		t.Errorf("total %d, entries %+v, want both restarts, newest first", export.Total, export.Entries)
	}
}
