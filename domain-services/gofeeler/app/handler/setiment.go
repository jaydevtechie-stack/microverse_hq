package handler

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"gofeeler/assetclient"
	"gofeeler/engine"
	"gofeeler/events"
	"gofeeler/model"
	"gofeeler/store"
)

// The only service gofeeler ever calls asset-service on behalf of — this
// Go service has no callers outside GoFeeler's own analyst panel, so
// there's no request field for it (see model.SentimentRequest).
const service = "gofeeler"

// assetFetchTimeout bounds the file-content fetch (5.8) so a slow or
// unreachable asset-service can't hang /analyze indefinitely — same
// reasoning as OpenAIProvider's completionTimeout.
const assetFetchTimeout = 10 * time.Second

// SentimentHandler serves /analyze. engines is keyed by the request's
// "engine" field ("basic" always present, "advanced" present only when an
// LLM provider is configured).
type SentimentHandler struct {
	engines map[string]engine.SentimentEngine
	results *store.Results
	assets  *assetclient.Client
	events  *events.Publisher
}

func NewSentimentHandler(engines map[string]engine.SentimentEngine, results *store.Results, assets *assetclient.Client, eventsPublisher *events.Publisher) *SentimentHandler {
	return &SentimentHandler{engines: engines, results: results, assets: assets, events: eventsPublisher}
}

// @Summary Analyze sentiment
// @Description Returns sentiment (positive, negative, neutral) of given text, via the "basic" keyword engine or the "advanced" LLM engine
// @Tags sentiment
// @Accept json
// @Produce json
// @Param request body model.SentimentRequest true "Text to analyze"
// @Success 200 {object} model.SentimentResponse
// @Router /analyze [post]
func (h *SentimentHandler) AnalyzeSentiment(c *gin.Context) {
	var req model.SentimentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	engineName := req.Engine
	if engineName == "" {
		engineName = "basic"
	}

	eng, ok := h.engines[engineName]
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("unknown or unconfigured engine %q", engineName)})
		return
	}

	opts := engine.Options{}
	if req.TemplateID != nil {
		opts.TemplateID = *req.TemplateID
	}

	// 5.8: fold in the order's uploaded file content alongside
	// task.context — the actual chat/email exports GoFeeler is meant to
	// analyze. Best-effort: a fetch failure (asset-service down, no
	// files, caller not entitled) is logged and analysis proceeds on
	// task.context alone rather than failing the whole request — file
	// content is a supplement, not a hard requirement.
	if req.TaskID != nil {
		assetCtx, cancel := context.WithTimeout(c.Request.Context(), assetFetchTimeout)
		fileContent, err := h.assets.FetchFileContent(assetCtx, c.GetHeader("Authorization"), service, *req.TaskID)
		cancel()
		if err != nil {
			log.Printf("fetching file content for task %s: %v", *req.TaskID, err)
		} else if fileContent != "" {
			if req.Text != "" {
				req.Text += "\n\n"
			}
			req.Text += fileContent
		}
	}

	if req.Text == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "\"text\" is required (or the order needs an uploaded file to analyze)"})
		return
	}

	start := time.Now()
	result, err := eng.Analyze(c.Request.Context(), req.Text, opts)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	durationMs := time.Since(start).Milliseconds()

	// Fire-and-forget: persistence failures never fail the /analyze
	// response, and this runs past the request's own context lifetime.
	if req.TaskID != nil {
		text, taskID := req.Text, *req.TaskID
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			if err := h.results.Save(ctx, taskID, text, result); err != nil {
				log.Printf("saving sentiment result: %v", err)
			}
		}()

		// Branch 8: the audit-service's processing-time efficiency metric
		// is measured here, at the source, rather than inferred later from
		// two separate events — same fire-and-forget/TaskID-gated posture
		// as the Mongo save above.
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			ev := events.SentimentAnalyzedEvent{
				Event:      "sentiment.analyzed",
				TaskID:     taskID,
				Service:    service,
				Sentiment:  result.Sentiment,
				Confidence: result.Confidence,
				EngineUsed: result.EngineUsed,
				DurationMs: durationMs,
				AnalyzedAt: time.Now().UTC(),
			}
			if result.TemplateID != "" {
				ev.TemplateID = &result.TemplateID
			}
			if result.LLMProvider != "" {
				ev.LLMProvider = &result.LLMProvider
			}
			if result.ModelVersion != "" {
				ev.ModelVersion = &result.ModelVersion
			}
			if err := h.events.PublishSentimentAnalyzed(ctx, ev); err != nil {
				log.Printf("publishing sentiment.analyzed: %v", err)
			}
		}()
	}

	c.JSON(http.StatusOK, toResponse(result))
}

func toResponse(result engine.Result) model.SentimentResponse {
	resp := model.SentimentResponse{
		Sentiment:  result.Sentiment,
		Confidence: result.Confidence,
		EngineUsed: result.EngineUsed,
	}
	if result.TemplateID != "" {
		resp.TemplateID = &result.TemplateID
	}
	if result.LLMProvider != "" {
		resp.LLMProvider = &result.LLMProvider
	}
	if result.ModelVersion != "" {
		resp.ModelVersion = &result.ModelVersion
	}
	return resp
}
