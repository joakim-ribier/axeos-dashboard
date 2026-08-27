# Testing

See the main [README](../README.md) for architecture and quick start — this
doc covers running the test suites and what CI does with them.

## Backend (Go)

```bash
make test   # go test ./... -race -cover, run from server/
```

Tests live next to the code as `*_test.go` files, using only the standard
library (`testing`, `net/http/httptest`) — no test framework dependency.
Coverage focuses on pure logic (config, payload mapping, firmware cache) and
HTTP handlers.

## Frontend (React)

```bash
cd ui
npm run test         # vitest run — single pass, what CI runs
npm run test:watch   # vitest — watch mode for local development
```

Built with [Vitest](https://vitest.dev) and [React Testing Library](https://testing-library.com/react).

## Continuous Integration

Every push to `main` and every pull request targeting `main` runs
[`.github/workflows/checks.yml`](../.github/workflows/checks.yml):

| Job | Steps |
|-----|-------|
| `go` | `go vet` → `golangci-lint` → `go test -race -cover` |
| `ui` | `npm run typecheck` → `npm run lint` → `npm run test` |

When `checks.yml` succeeds on `main`,
[`.github/workflows/latest.yml`](../.github/workflows/latest.yml) builds the
feeder/dashboard-api/remote-dashboard-api/rebuild-totals binaries for **both
`linux/arm64` (Raspberry Pi) and `linux/amd64` (typical VPS)**, builds the UI once, and
publishes everything to a rolling `latest` GitHub Release. `make latest-fetch`
auto-detects the local architecture (`uname -m`) and pulls the matching
binaries — no need to specify it manually, override with `RELEASE_ARCH=` if
detection ever guesses wrong.

- `make latest-up` / `make latest-down` — Pi: dashboard-api + feeder
- `make latest-remote-up` / `make latest-remote-down` — VPS: remote-dashboard-api only

Neither needs a local Go or npm build — see the Makefile's
`latest-fetch`/`latest-up`/`latest-remote-up` targets.
