package bitaxe

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"time"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
)

type Client struct {
	logger *slog.Logger

	http     *http.Client
	endpoint string
}

func NewClient(logger *slog.Logger, endpoint string, timeout time.Duration) *Client {
	return &Client{
		logger: logger,
		http: &http.Client{
			Timeout: timeout,
		},
		endpoint: endpoint,
	}
}

func (c *Client) FetchSystemInfo(ctx context.Context, addr string) ([]byte, error) {
	url := fmt.Sprintf("http://%s/%s", addr, c.endpoint)
	c.logger.Info("Fetch system info", "ip", addr, "endpoint", c.endpoint)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}

	defer func() {
		if err := resp.Body.Close(); err != nil {
			c.logger.Error("failed to close response body", "error", err)
		}
	}()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("bitaxe %s returned %s", addr, resp.Status)
	}

	return io.ReadAll(resp.Body)
}

func (c *Client) UpdateSystemStratumSettings(addr string, settings config.BitaxeServerSettings) error {
	return c.patch(http.MethodPatch, addr, settings)
}

func (c *Client) Restart(addr string) error {
	return c.patch(http.MethodPost, addr, []byte{})
}

func (c *Client) patch(method, addr string, data any) error {
	c.logger.Info(fmt.Sprintf("[PATCH] %s", c.endpoint), "ip", addr, "endpoint", c.endpoint, "data", data)

	payload, err := json.Marshal(data)
	if err != nil {
		c.logger.Error("error marshaling data", "ip", addr, "endpoint", c.endpoint, "error", err)
		return err
	}

	url := fmt.Sprintf("http://%s/%s", addr, c.endpoint)
	req, err := http.NewRequest(method, url, bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}

	defer func() {
		if err := resp.Body.Close(); err != nil {
			c.logger.Error("failed to close response body", "ip", addr, "endpoint", c.endpoint, "error", err)
		}
	}()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("bitaxe %s returned %s", addr, resp.Status)
	}

	return nil
}
