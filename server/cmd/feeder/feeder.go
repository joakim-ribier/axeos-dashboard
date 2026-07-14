// ./cmd/feeder/feeder.go
package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/bitaxe"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/firmware"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/storage"
)

type Feeder struct {
	logger *slog.Logger

	config config.Config
}

func NewFeeder(logger *slog.Logger, config config.Config) *Feeder {
	return &Feeder{
		logger: logger.With("namespace", "feeder"),
		config: config,
	}
}

func (f *Feeder) Feed() {
	ctx, stop := signal.NotifyContext(
		context.Background(),
		os.Interrupt,
		syscall.SIGTERM,
	)
	defer stop()

	ticker := time.NewTicker(f.config.Feeder.Interval)
	defer ticker.Stop()

	f.runOnce(ctx)

	for {
		select {
		case <-ctx.Done():
			f.logger.Info("Feeder stopped")
			return
		case <-ticker.C:
			f.runOnce(ctx)
		}
	}
}

func (f *Feeder) runOnce(ctx context.Context) {
	now := time.Now()
	f.logger.Info("Fetching miners stats", "ts", now.UTC().Truncate(time.Second))

	if err := os.MkdirAll(f.config.Storage.BitaxesDir(), 0o755); err != nil {
		log.Fatalf("cannot create data dir: %v", err)
	}

	client := bitaxe.NewClient(f.logger, f.config.Endpoints.Info, f.config.Endpoints.Timeout)
	store := storage.NewRawStorage(f.config.Storage.BitaxesDir(), f.config.Electricity.RatePerKwh)

	for _, bitaxe := range f.config.Bitaxes {
		addr := bitaxe.Ip
		payload, err := client.FetchSystemInfo(ctx, addr)
		if err != nil {
			f.logger.Error("bitaxe fetch error", "ip", addr, "error", err)
			continue
		}

		if err := store.Append(now, addr, payload); err != nil {
			f.logger.Error("storage error", "ip", addr, "error", err)
		} else if f.config.Remote.PushURL != "" && f.config.Remote.APIKey != "" {
			fwCache := firmware.LoadCache(f.config.Storage.BitaxesDir())
			latestFW := fwCache.Models[bitaxe.Model].Version
			go f.pushToRemote(now, addr, bitaxe.Hostname, bitaxe.Model, latestFW, payload)
		}
	}

	models := make(map[string]struct{})
	for _, b := range f.config.GetMiners() {
		models[b.Model] = struct{}{}
	}
	for model := range models {
		firmware.CheckAndCache(model, f.config.Firmware.Repos, f.config.Firmware.CacheTTL, f.config.Storage.BitaxesDir(), f.logger)
	}
}

type pushSample struct {
	Timestamp       time.Time       `json:"ts"`
	IP              string          `json:"ip"`
	Hostname        string          `json:"hostname"`
	Model           string          `json:"model"`
	ElectricityRate float64         `json:"electricityRatePerKwh,omitempty"`
	LatestFirmware  string          `json:"latestFirmware,omitempty"`
	Payload         json.RawMessage `json:"payload"`
}

func (f *Feeder) pushToRemote(now time.Time, ip, hostname, model, latestFirmware string, payload []byte) {
	sample := pushSample{
		Timestamp:       now.UTC().Truncate(time.Second),
		IP:              ip,
		Hostname:        hostname,
		Model:           model,
		ElectricityRate: f.config.Electricity.RatePerKwh,
		LatestFirmware:  latestFirmware,
		Payload:         json.RawMessage(payload),
	}

	body, err := json.Marshal(sample)
	if err != nil {
		f.logger.Error("push: marshal error", "ip", ip, "error", err)
		return
	}

	req, err := http.NewRequest(http.MethodPost, f.config.Remote.PushURL, bytes.NewReader(body))
	if err != nil {
		f.logger.Error("push: request error", "ip", ip, "error", err)
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", f.config.Remote.APIKey))

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		f.logger.Error("push: send error", "ip", ip, "error", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		f.logger.Error("push: unexpected status", "ip", ip, "status", resp.Status)
	}
}
