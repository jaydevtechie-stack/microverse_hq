package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"

	"gofeeler/assetclient"
	"gofeeler/engine"
)

type fakeEngine struct {
	result  engine.Result
	err     error
	gotText string
}

func (f *fakeEngine) Analyze(_ context.Context, text string, _ engine.Options) (engine.Result, error) {
	f.gotText = text
	return f.result, f.err
}

func newTestRouter(engines map[string]engine.SentimentEngine) *gin.Engine {
	return newTestRouterWithAssets(engines, nil)
}

func newTestRouterWithAssets(engines map[string]engine.SentimentEngine, assets *assetclient.Client) *gin.Engine {
	gin.SetMode(gin.TestMode)
	h := NewSentimentHandler(engines, nil, assets)
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

// 5.8: a taskId-bearing request folds the order's uploaded file content
// into the text handed to the engine, even with no typed "text" at all —
// an order can now be analyzable purely from an uploaded file.
func TestAnalyzeSentiment_FoldsInFileContentForTaskID(t *testing.T) {
	assetServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/content") {
			w.Write([]byte("uploaded chat export content"))
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`[{"filename":"export.txt","size":10}]`))
	}))
	defer assetServer.Close()

	fe := &fakeEngine{result: engine.Result{Sentiment: "neutral", Confidence: 0.5, EngineUsed: "basic"}}
	engines := map[string]engine.SentimentEngine{"basic": fe}
	r := newTestRouterWithAssets(engines, assetclient.New(assetServer.URL))

	w := doAnalyze(t, r, `{"taskId":"task-1"}`)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body=%s", w.Code, http.StatusOK, w.Body.String())
	}
	if !strings.Contains(fe.gotText, "uploaded chat export content") {
		t.Errorf("engine received text %q, want it to include fetched file content", fe.gotText)
	}
}

// A fetch failure (asset-service unreachable here) must not fail the
// whole request — file content is a supplement to task.context, not a
// hard requirement, so analysis proceeds on whatever text was sent.
func TestAnalyzeSentiment_FileContentFetchFailureIsNonFatal(t *testing.T) {
	fe := &fakeEngine{result: engine.Result{Sentiment: "neutral", Confidence: 0.5, EngineUsed: "basic"}}
	engines := map[string]engine.SentimentEngine{"basic": fe}
	r := newTestRouterWithAssets(engines, assetclient.New("http://127.0.0.1:0"))

	w := doAnalyze(t, r, `{"text":"hello","taskId":"task-1"}`)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body=%s", w.Code, http.StatusOK, w.Body.String())
	}
	if fe.gotText != "hello" {
		t.Errorf("engine received text %q, want unchanged %q", fe.gotText, "hello")
	}
}
