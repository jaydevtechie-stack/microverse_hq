package model

// SentimentRequest is the /analyze request body. Engine omitted defaults
// to "basic" — preserves the pre-Branch-5 behavior for any caller that
// doesn't opt in. TemplateID/TaskID only matter for the "advanced" engine.
type SentimentRequest struct {
	Text       string  `json:"text" binding:"required"`
	Engine     string  `json:"engine"`
	TemplateID *string `json:"templateId"`
	TaskID     *string `json:"taskId"`
}

// SentimentResponse always stamps the four traceability fields — null for
// the basic engine — so two "advanced" results can be checked for
// comparability (same template/provider/model) wherever they're consumed.
type SentimentResponse struct {
	Sentiment    string  `json:"sentiment"`
	Confidence   float64 `json:"confidence"`
	EngineUsed   string  `json:"engine_used"`
	TemplateID   *string `json:"template_id"`
	LLMProvider  *string `json:"llm_provider"`
	ModelVersion *string `json:"model_version"`
}
