package engine

import (
	"context"
	"fmt"

	"gofeeler/provider"
)

// AdvancedEngine is the LLM-backed SentimentEngine. It resolves a prompt
// template, calls out to a Provider, and stamps every result with the
// traceability fields (engine_used, template_id, llm_provider,
// model_version) needed to tell two "advanced" results apart later.
type AdvancedEngine struct {
	provider  provider.Provider
	templates TemplateResolver
	model     string
}

func NewAdvancedEngine(p provider.Provider, templates TemplateResolver, model string) *AdvancedEngine {
	return &AdvancedEngine{provider: p, templates: templates, model: model}
}

func (e *AdvancedEngine) Analyze(ctx context.Context, text string, opts Options) (Result, error) {
	tmpl, err := e.templates.Resolve(ctx, opts.TemplateID)
	if err != nil {
		return Result{}, fmt.Errorf("resolving prompt template: %w", err)
	}

	// text is customer-submitted (chat/email/comment exports) and untrusted
	// the moment it's interpolated here — prompt-injection surface, not yet
	// screened. Flagged explicitly per docs/security.md; real screening is
	// deferred to intelligence/ai-tools once that exists as a shared
	// chokepoint. This Provider seam is exactly where that screening would
	// slot in later without touching engine logic.
	prompt := tmpl.PromptBody + "\n\n" + text

	res, err := e.provider.Complete(ctx, prompt, provider.Options{Model: e.model})
	if err != nil {
		return Result{}, fmt.Errorf("provider completion: %w", err)
	}

	return Result{
		Sentiment:    res.Sentiment,
		Confidence:   res.Confidence,
		EngineUsed:   "advanced",
		TemplateID:   tmpl.ID,
		TemplateName: tmpl.Name,
		LLMProvider:  e.provider.Name(),
		ModelVersion: res.ModelVersion,
	}, nil
}
