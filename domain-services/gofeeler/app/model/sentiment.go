package model

// SentimentRequest is the /analyze request body. Engine omitted defaults
// to "basic" — preserves the pre-Branch-5 behavior for any caller that
// doesn't opt in. TemplateID/TaskID only matter for the "advanced" engine.
// Text is no longer binding:"required" as of 5.8 — an order can now carry
// analyzable content purely as an uploaded file with no typed context, so
// the handler checks "is there anything to analyze" itself, after folding
// in TaskID's file content, rather than gin rejecting an empty-but-valid
// request up front.
type SentimentRequest struct {
	Text       string  `json:"text"`
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
