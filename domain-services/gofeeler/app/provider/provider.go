package provider

import "context"

// Result is what a Provider hands back after completing a prompt.
type Result struct {
	Sentiment    string
	Confidence   float64
	ModelVersion string
}

// Options carries per-call tuning for a Provider.
type Options struct {
	Model string
}

// Provider is the plug-and-play seam underneath the advanced engine.
// A new LLM provider — or, once it exists, intelligence/ai-tools
// (docs/architecture/2.0/intelligence.md) — is a new implementation of
// this one interface, selected by config. No change to engine logic
// required.
type Provider interface {
	Name() string
	Complete(ctx context.Context, prompt string, opts Options) (Result, error)
}
