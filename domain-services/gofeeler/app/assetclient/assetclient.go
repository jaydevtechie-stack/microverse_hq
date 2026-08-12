// Package assetclient is gofeeler's HTTP client for asset-service,
// added in 5.8 to pull uploaded file content into /analyze. Mirrors
// asset-service's own task_client.rs pattern (internal Docker-DNS
// default, env override, hand-rolled net/http, no SDK).
package assetclient

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

// Bounded, like OpenAIProvider's completionTimeout — a stuck asset-service
// call shouldn't hang /analyze indefinitely. Internal container-to-
// container call, so this is generous relative to a real network hop.
const requestTimeout = 10 * time.Second

type Client struct {
	baseURL    string
	httpClient *http.Client
}

func New(baseURL string) *Client {
	return &Client{baseURL: baseURL, httpClient: &http.Client{Timeout: requestTimeout}}
}

type assetSummary struct {
	Filename string `json:"filename"`
}

// FetchFileContent concatenates the text content of every file currently
// attached to orderID on asset-service, one order's worth of chat/email
// exports for the engine to analyze alongside task.context. authHeader is
// the caller's own bearer token, forwarded as-is so asset-service's usual
// staff/customer permission checks apply — gofeeler has no identity of
// its own here, it's acting on behalf of whoever called /analyze (see
// AnalysisPanel.js's authHeaders()). Returns "" with no error when the
// order has no files — that's the common case, not a failure.
func (c *Client) FetchFileContent(ctx context.Context, authHeader, service, orderID string) (string, error) {
	filenames, err := c.listFilenames(ctx, authHeader, service, orderID)
	if err != nil {
		return "", fmt.Errorf("listing files: %w", err)
	}

	content := ""
	for _, filename := range filenames {
		body, err := c.fetchOne(ctx, authHeader, service, orderID, filename)
		if err != nil {
			return "", fmt.Errorf("fetching %q: %w", filename, err)
		}
		if content != "" {
			content += "\n\n"
		}
		content += fmt.Sprintf("--- %s ---\n%s", filename, body)
	}
	return content, nil
}

func (c *Client) listFilenames(ctx context.Context, authHeader, service, orderID string) ([]string, error) {
	reqURL := fmt.Sprintf("%s/assets/%s?service=%s", c.baseURL, url.PathEscape(orderID), url.QueryEscape(service))
	resp, err := c.do(ctx, reqURL, authHeader)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var assets []assetSummary
	if err := json.NewDecoder(resp.Body).Decode(&assets); err != nil {
		return nil, err
	}
	filenames := make([]string, len(assets))
	for i, a := range assets {
		filenames[i] = a.Filename
	}
	return filenames, nil
}

func (c *Client) fetchOne(ctx context.Context, authHeader, service, orderID, filename string) (string, error) {
	reqURL := fmt.Sprintf("%s/assets/%s/content?service=%s&filename=%s",
		c.baseURL, url.PathEscape(orderID), url.QueryEscape(service), url.QueryEscape(filename))
	resp, err := c.do(ctx, reqURL, authHeader)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	return string(body), nil
}

func (c *Client) do(ctx context.Context, reqURL, authHeader string) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, err
	}
	if authHeader != "" {
		req.Header.Set("Authorization", authHeader)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		resp.Body.Close()
		return nil, fmt.Errorf("asset-service returned %d", resp.StatusCode)
	}
	return resp, nil
}
