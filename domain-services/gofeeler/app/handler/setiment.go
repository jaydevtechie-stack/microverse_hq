package handler

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"gofeeler/engine"
	"gofeeler/model"
	"gofeeler/store"
)

// SentimentHandler serves /analyze. engines is keyed by the request's
// "engine" field ("basic" always present, "advanced" present only when an
// LLM provider is configured).
type SentimentHandler struct {
	engines map[string]engine.SentimentEngine
	results *store.Results
}

func NewSentimentHandler(engines map[string]engine.SentimentEngine, results *store.Results) *SentimentHandler {
	return &SentimentHandler{engines: engines, results: results}
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

	result, err := eng.Analyze(c.Request.Context(), req.Text, opts)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}

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
