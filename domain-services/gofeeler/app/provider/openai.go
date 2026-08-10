package provider

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const defaultBaseURL = "https://api.openai.com/v1"

// completionTimeout bounds a single call to the LLM. No automatic retries —
// this is the first place Microverse spends real external-API money per
// request, and a retry loop would worsen the stack's documented "no rate
// limiting anywhere" gap rather than help it.
const completionTimeout = 25 * time.Second

// OpenAIProvider implements Provider against OpenAI's Chat Completions API.
// BaseURL is overridable so tests can point it at an httptest.Server fake
// instead of the real API.
type OpenAIProvider struct {
	APIKey     string
	BaseURL    string
	HTTPClient *http.Client
}

func NewOpenAIProvider(apiKey string) *OpenAIProvider {
	return &OpenAIProvider{
		APIKey:     apiKey,
		BaseURL:    defaultBaseURL,
		HTTPClient: &http.Client{Timeout: completionTimeout},
	}
}

func (p *OpenAIProvider) Name() string {
	return "openai"
}

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type chatCompletionRequest struct {
	Model          string          `json:"model"`
	Messages       []chatMessage   `json:"messages"`
	ResponseFormat *responseFormat `json:"response_format,omitempty"`
}

type responseFormat struct {
	Type string `json:"type"`
}

type chatCompletionResponse struct {
	Model   string `json:"model"`
	Choices []struct {
		Message chatMessage `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

// modelOutput is the JSON shape the system prompt instructs the model to
// respond with.
type modelOutput struct {
	Sentiment  string  `json:"sentiment"`
	Confidence float64 `json:"confidence"`
}

const systemPrompt = `You are a sentiment analysis assistant. Respond only with a JSON object of the exact shape {"sentiment": "positive"|"negative"|"neutral", "confidence": <number 0-1>}. No other text.`

func (p *OpenAIProvider) Complete(ctx context.Context, prompt string, opts Options) (Result, error) {
	ctx, cancel := context.WithTimeout(ctx, completionTimeout)
	defer cancel()

	model := opts.Model
	if model == "" {
		model = "gpt-4o-mini"
	}

	reqBody := chatCompletionRequest{
		Model: model,
		Messages: []chatMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: prompt},
		},
		ResponseFormat: &responseFormat{Type: "json_object"},
	}

	payload, err := json.Marshal(reqBody)
	if err != nil {
		return Result{}, fmt.Errorf("marshaling request: %w", err)
	}

	url := p.BaseURL + "/chat/completions"
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return Result{}, fmt.Errorf("building request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+p.APIKey)

	httpResp, err := p.HTTPClient.Do(httpReq)
	if err != nil {
		return Result{}, fmt.Errorf("calling openai: %w", err)
	}
	defer httpResp.Body.Close()

	body, err := io.ReadAll(httpResp.Body)
	if err != nil {
		return Result{}, fmt.Errorf("reading response: %w", err)
	}

	var resp chatCompletionResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return Result{}, fmt.Errorf("parsing response: %w", err)
	}

	if httpResp.StatusCode != http.StatusOK {
		if resp.Error != nil {
			return Result{}, fmt.Errorf("openai error (%d): %s", httpResp.StatusCode, resp.Error.Message)
		}
		return Result{}, fmt.Errorf("openai returned status %d", httpResp.StatusCode)
	}

	if len(resp.Choices) == 0 {
		return Result{}, fmt.Errorf("openai returned no choices")
	}

	var out modelOutput
	if err := json.Unmarshal([]byte(resp.Choices[0].Message.Content), &out); err != nil {
		return Result{}, fmt.Errorf("model output was not valid JSON: %w", err)
	}

	return Result{
		Sentiment:    out.Sentiment,
		Confidence:   out.Confidence,
		ModelVersion: model,
	}, nil
}
