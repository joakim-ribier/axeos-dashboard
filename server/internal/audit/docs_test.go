package audit

import (
	"os"
	"strings"
	"testing"
)

// The docs are the one place that still lists the types by hand: every
// type the API serves must be explained there, in both languages, so a new
// one can't ship undocumented.
func TestTypes_documented(t *testing.T) {
	for _, page := range []string{"../../../docs/audit.md", "../../../docs/en/audit.md"} {
		raw, err := os.ReadFile(page)
		if err != nil {
			t.Fatal(err)
		}
		doc := string(raw)
		for _, typ := range Types {
			// Explained in a table row, and listed in the /api/audit/types example.
			if !strings.Contains(doc, "<code>"+typ+"</code>") {
				t.Errorf("%s: type %q isn't explained in the recorded events tables", page, typ)
			}
			if !strings.Contains(doc, `"`+typ+`"`) {
				t.Errorf("%s: type %q is missing from the GET /api/audit/types example", page, typ)
			}
		}
	}
}
