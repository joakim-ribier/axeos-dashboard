// Package appversion checks whether a newer build of this dashboard app
// itself has been published: a release build (internal/version.Version set,
// e.g. "0.2.0") against the last vX.Y.Z release, any other build by its git
// SHA (internal/version.GitSHA) against the commit the rolling "latest"
// release points at -- each follows what it was installed from.
//
// This lives server-side (rather than each browser tab checking GitHub
// independently) so a deployment serving many concurrent viewers only
// checks once, and the result survives across devices/browsers instead of
// being tracked per-browser in localStorage.
package appversion

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/firmware"
)

// CheckInterval bounds how often the "latest" release is actually
// re-fetched from GitHub -- every request in between just reads the
// cached result.
const CheckInterval = 24 * time.Hour

// DefaultReleasesAPIURL is the GitHub API URL of this project's releases:
// "/latest" is the last vX.Y.Z, "/tags/latest" the rolling one. Tests
// override it with an httptest server URL.
const DefaultReleasesAPIURL = "https://api.github.com/repos/joakim-ribier/axeos-dashboard/releases"

// Status values reported to the UI.
const (
	StatusUnknown         = "unknown"
	StatusUpToDate        = "upToDate"
	StatusUpdateAvailable = "updateAvailable"
)

// Result is the cached outcome of the last successful check.
type Result struct {
	Status     string
	ReleaseURL string
}

type githubRelease struct {
	TagName         string `json:"tag_name"`
	TargetCommitish string `json:"target_commitish"`
	HTMLURL         string `json:"html_url"`
}

// Checker lazily re-checks GitHub's "latest" release at most once every
// CheckInterval, caching the result in memory so every request (e.g. GET
// /api/miners, polled every 90s by the UI) can read it for free.
type Checker struct {
	mu          sync.Mutex
	lastChecked time.Time
	result      Result

	httpClient     *http.Client
	logger         *slog.Logger
	releasesAPIURL string
	runningSHA     string
	runningVersion string
}

// NewChecker builds a Checker. runningSHA and runningVersion are this
// binary's internal/version.GitSHA and Version; a build with neither (no
// ldflags, e.g. `go run`) has nothing to compare against, so Result always
// reports StatusUnknown without ever hitting the network.
func NewChecker(logger *slog.Logger, releasesAPIURL, runningSHA, runningVersion string) *Checker {
	return &Checker{
		result:         Result{Status: StatusUnknown},
		httpClient:     &http.Client{Timeout: 5 * time.Second},
		logger:         logger.With("namespace", "AppVersionChecker"),
		releasesAPIURL: releasesAPIURL,
		runningSHA:     runningSHA,
		runningVersion: runningVersion,
	}
}

func (c *Checker) isRelease() bool { return c.runningVersion != "dev" && c.runningVersion != "" }

// Result returns the last known check result, refreshing it first
// (synchronously) if the cache is stale or has never been populated. Safe
// to call from concurrent request handlers.
func (c *Checker) Result() Result {
	if c.runningSHA == "dev" && !c.isRelease() {
		return Result{Status: StatusUnknown}
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	if time.Since(c.lastChecked) >= CheckInterval {
		c.refreshLocked()
	}
	return c.result
}

// refreshLocked fetches the latest release and updates c.result. Must be
// called with c.mu held. lastChecked is bumped unconditionally (even on
// failure) so a GitHub outage or rate limit doesn't get retried on every
// single request -- it just waits for the next interval.
func (c *Checker) refreshLocked() {
	c.lastChecked = time.Now()

	release, err := c.fetchLatestRelease()
	if err != nil {
		c.logger.Warn("failed to check latest release", "error", err)
		return
	}

	if c.isRelease() {
		status := StatusUpToDate
		if firmware.IsNewer(release.TagName, c.runningVersion) {
			status = StatusUpdateAvailable
		}
		c.result = Result{Status: status, ReleaseURL: release.HTMLURL}
		return
	}

	if len(release.TargetCommitish) < 7 {
		c.logger.Warn("latest release has no usable target commit", "target_commitish", release.TargetCommitish)
		return
	}

	latestShortSHA := release.TargetCommitish[:7]
	status := StatusUpdateAvailable
	if strings.TrimSuffix(c.runningSHA, "-dirty") == latestShortSHA {
		status = StatusUpToDate
	}

	c.result = Result{Status: status, ReleaseURL: release.HTMLURL}
}

func (c *Checker) fetchLatestRelease() (githubRelease, error) {
	path := "/tags/latest"
	if c.isRelease() {
		path = "/latest"
	}
	req, err := http.NewRequest(http.MethodGet, c.releasesAPIURL+path, nil)
	if err != nil {
		return githubRelease{}, err
	}
	req.Header.Set("User-Agent", "axeos-bitaxe-dashboard")
	req.Header.Set("Accept", "application/vnd.github+json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return githubRelease{}, err
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return githubRelease{}, fmt.Errorf("GitHub API returned %s", resp.Status)
	}

	var release githubRelease
	if err := json.NewDecoder(resp.Body).Decode(&release); err != nil {
		return githubRelease{}, fmt.Errorf("failed to decode release: %w", err)
	}
	return release, nil
}
