package engine

import "context"

// Result is the outcome of a sentiment analysis, regardless of which engine
// produced it. LLMProvider/ModelVersion stay empty for the basic engine —
// two "advanced" results aren't comparable unless TemplateID, LLMProvider,
// and ModelVersion all match (docs/architecture/1.0/domain-services.md).
type Result struct {
	Sentiment    string
	Confidence   float64
	EngineUsed   string
	TemplateID   string
	TemplateName string
	LLMProvider  string
	ModelVersion string
}

// Options carries per-request tuning. TemplateID only matters to the
// advanced engine; the basic engine ignores it.
type Options struct {
	TemplateID string
}

// SentimentEngine is the strategy interface both the keyword matcher and
// the LLM-backed analyzer implement — GoFeeler stays one service with one
// analyst-facing interface, not a second app per engine.
type SentimentEngine interface {
	Analyze(ctx context.Context, text string, opts Options) (Result, error)
}

// Template is the subset of a stored prompt template an engine needs to
// build a prompt.
type Template struct {
	ID         string
	Name       string
	PromptBody string
}

// TemplateResolver looks up a prompt template by id, or the system default
// when templateID is empty.
type TemplateResolver interface {
	Resolve(ctx context.Context, templateID string) (Template, error)
}
