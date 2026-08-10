package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"gofeeler/engine"
)

type fakeEngine struct {
	result engine.Result
	err    error
}

func (f *fakeEngine) Analyze(_ context.Context, _ string, _ engine.Options) (engine.Result, error) {
	return f.result, f.err
}

func newTestRouter(engines map[string]engine.SentimentEngine) *gin.Engine {
	gin.SetMode(gin.TestMode)
	h := NewSentimentHandler(engines, nil)
	r := gin.New()
	r.POST("/analyze", h.AnalyzeSentiment)
	return r
}

func doAnalyze(t *testing.T, r *gin.Engine, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/analyze", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func TestAnalyzeSentiment_DefaultsToBasicEngine(t *testing.T) {
	engines := map[string]engine.SentimentEngine{
		"basic": &fakeEngine{result: engine.Result{Sentiment: "neutral", Confidence: 0.5, EngineUsed: "basic"}},
	}
	r := newTestRouter(engines)

	w := doAnalyze(t, r, `{"text":"hello"}`)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body=%s", w.Code, http.StatusOK, w.Body.String())
	}

	var resp map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if resp["engine_used"] != "basic" {
		t.Errorf("engine_used = %v, want basic", resp["engine_used"])
	}
	if resp["template_id"] != nil {
		t.Errorf("template_id = %v, want nil", resp["template_id"])
	}
}

func TestAnalyzeSentiment_AdvancedEngineNotConfigured(t *testing.T) {
	engines := map[string]engine.SentimentEngine{
		"basic": &fakeEngine{result: engine.Result{Sentiment: "neutral", Confidence: 0.5, EngineUsed: "basic"}},
	}
	r := newTestRouter(engines)

	w := doAnalyze(t, r, `{"text":"hello","engine":"advanced"}`)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d, body=%s", w.Code, http.StatusBadRequest, w.Body.String())
	}
}

func TestAnalyzeSentiment_AdvancedEngineResponseFields(t *testing.T) {
	engines := map[string]engine.SentimentEngine{
		"basic": &fakeEngine{},
		"advanced": &fakeEngine{result: engine.Result{
			Sentiment: "positive", Confidence: 0.9, EngineUsed: "advanced",
			TemplateID: "tpl-1", LLMProvider: "openai", ModelVersion: "gpt-4o-mini",
		}},
	}
	r := newTestRouter(engines)

	w := doAnalyze(t, r, `{"text":"hello","engine":"advanced"}`)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body=%s", w.Code, http.StatusOK, w.Body.String())
	}

	var resp map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if resp["template_id"] != "tpl-1" || resp["llm_provider"] != "openai" || resp["model_version"] != "gpt-4o-mini" {
		t.Errorf("got %+v, want template_id/llm_provider/model_version populated", resp)
	}
}

func TestAnalyzeSentiment_MissingText(t *testing.T) {
	engines := map[string]engine.SentimentEngine{"basic": &fakeEngine{}}
	r := newTestRouter(engines)

	w := doAnalyze(t, r, `{}`)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestAnalyzeSentiment_EngineError(t *testing.T) {
	engines := map[string]engine.SentimentEngine{
		"basic": &fakeEngine{err: context.DeadlineExceeded},
	}
	r := newTestRouter(engines)

	w := doAnalyze(t, r, `{"text":"hello"}`)
	if w.Code != http.StatusBadGateway {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusBadGateway)
	}
}
