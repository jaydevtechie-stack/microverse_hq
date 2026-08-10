package provider

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

// newTestProvider points an OpenAIProvider at a local fake server instead
// of the real OpenAI API — these tests must never make a network call to
// api.openai.com.
func newTestProvider(t *testing.T, handler http.HandlerFunc) (*OpenAIProvider, func()) {
	t.Helper()
	server := httptest.NewServer(handler)
	p := &OpenAIProvider{
		APIKey:     "test-key",
		BaseURL:    server.URL,
		HTTPClient: server.Client(),
	}
	return p, server.Close
}

func TestOpenAIProvider_Complete_Success(t *testing.T) {
	var gotAuth, gotBody string
	p, closeFn := newTestProvider(t, func(w http.ResponseWriter, r *http.Request) {
		gotAuth = r.Header.Get("Authorization")

		var req chatCompletionRequest
		_ = json.NewDecoder(r.Body).Decode(&req)
		gotBody = req.Model

		resp := chatCompletionResponse{
			Model: req.Model,
			Choices: []struct {
				Message chatMessage `json:"message"`
			}{
				{Message: chatMessage{Role: "assistant", Content: `{"sentiment":"positive","confidence":0.87}`}},
			},
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	})
	defer closeFn()

	result, err := p.Complete(context.Background(), "some prompt", Options{Model: "gpt-4o-mini"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if gotAuth != "Bearer test-key" {
		t.Errorf("Authorization header = %q, want %q", gotAuth, "Bearer test-key")
	}
	if gotBody != "gpt-4o-mini" {
		t.Errorf("request model = %q, want %q", gotBody, "gpt-4o-mini")
	}
	if result.Sentiment != "positive" || result.Confidence != 0.87 {
		t.Errorf("got sentiment=%q confidence=%v, want positive/0.87", result.Sentiment, result.Confidence)
	}
	if result.ModelVersion != "gpt-4o-mini" {
		t.Errorf("ModelVersion = %q, want %q", result.ModelVersion, "gpt-4o-mini")
	}
}

func TestOpenAIProvider_Complete_MalformedModelOutput(t *testing.T) {
	p, closeFn := newTestProvider(t, func(w http.ResponseWriter, r *http.Request) {
		resp := chatCompletionResponse{
			Choices: []struct {
				Message chatMessage `json:"message"`
			}{
				{Message: chatMessage{Role: "assistant", Content: "not json"}},
			},
		}
		json.NewEncoder(w).Encode(resp)
	})
	defer closeFn()

	_, err := p.Complete(context.Background(), "prompt", Options{})
	if err == nil {
		t.Fatal("expected an error for malformed model output, got nil")
	}
}

func TestOpenAIProvider_Complete_APIError(t *testing.T) {
	p, closeFn := newTestProvider(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(chatCompletionResponse{
			Error: &struct {
				Message string `json:"message"`
			}{Message: "invalid api key"},
		})
	})
	defer closeFn()

	_, err := p.Complete(context.Background(), "prompt", Options{})
	if err == nil {
		t.Fatal("expected an error for a non-200 response, got nil")
	}
}

func TestOpenAIProvider_Name(t *testing.T) {
	p := NewOpenAIProvider("key")
	if p.Name() != "openai" {
		t.Errorf("Name() = %q, want %q", p.Name(), "openai")
	}
}
