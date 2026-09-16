// Package version holds build-time metadata injected via -ldflags, so a
// running binary can report which commit -- and, for a tagged release
// build, which version -- it was built from.
package version

// GitSHA is set at build time via:
//
//	go build -ldflags "-X github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/version.GitSHA=$(git rev-parse --short HEAD)"
//
// Left at its default ("dev") for local `go run`/`go test`, where no ldflags are passed.
var GitSHA = "dev"

// Version is set at build time, the same way as GitSHA, but only by the
// tagged-release workflow (.github/workflows/release.yml) -- e.g.
// "0.1.0" for a build published from tag v0.1.0. Every other build (a
// rolling "latest" build, a local `make build`/`docker-build`, or `go
// run`/`go test`) leaves it at its default ("dev"), so the UI falls back
// to showing GitSHA instead -- see handler.Info and the frontend's
// useAppInfo().
var Version = "dev"
