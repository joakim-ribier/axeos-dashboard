// Package version holds build-time metadata injected via -ldflags, so a
// running binary can report which commit it was built from.
package version

// GitSHA is set at build time via:
//
//	go build -ldflags "-X github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/version.GitSHA=$(git rev-parse --short HEAD)"
//
// Left at its default ("dev") for local `go run`/`go test`, where no ldflags are passed.
var GitSHA = "dev"
