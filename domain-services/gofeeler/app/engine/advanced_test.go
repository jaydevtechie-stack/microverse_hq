package engine

import (
	"context"
	"errors"
	"testing"

	"gofeeler/provider"
)

type fakeProvider struct {
	result provider.Result
	err    error
}

func (f *fakeProvider) Name() string { return "fake-provider" }

func (f *fakeProvider) Complete(_ context.Context, _ string, _ provider.Options) (provider.Result, error) {
	return f.result, f.err
}

type fakeTemplateResolver struct {
	byID    map[string]Template
	dflt    Template
	dfltErr error
}

func (f *fakeTemplateResolver) Resolve(_ context.Context, templateID string) (Template, error) {
	if f.dfltErr != nil {
		return Template{}, f.dfltErr
	}
	if templateID == "" {
		return f.dflt, nil
	}
	tpl, ok := f.byID[templateID]
	if !ok {
		return Template{}, errors.New("template not found")
	}
	return tpl, nil
}

func TestAdvancedEngine_Analyze_DefaultTemplate(t *testing.T) {
	resolver := &fakeTemplateResolver{dflt: Template{ID: "default-id", Name: "Default", PromptBody: "classify:"}}
	p := &fakeProvider{result: provider.Result{Sentiment: "positive", Confidence: 0.8, ModelVersion: "gpt-4o-mini"}}
	e := NewAdvancedEngine(p, resolver, "gpt-4o-mini")

	result, err := e.Analyze(context.Background(), "great service", Options{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.TemplateID != "default-id" {
		t.Errorf("TemplateID = %q, want %q", result.TemplateID, "default-id")
	}
	if result.EngineUsed != "advanced" {
		t.Errorf("EngineUsed = %q, want %q", result.EngineUsed, "advanced")
	}
	if result.LLMProvider != "fake-provider" {
		t.Errorf("LLMProvider = %q, want %q", result.LLMProvider, "fake-provider")
	}
	if result.ModelVersion != "gpt-4o-mini" {
		t.Errorf("ModelVersion = %q, want %q", result.ModelVersion, "gpt-4o-mini")
	}
	if result.Sentiment != "positive" || result.Confidence != 0.8 {
		t.Errorf("got sentiment=%q confidence=%v, want positive/0.8", result.Sentiment, result.Confidence)
	}
}

func TestAdvancedEngine_Analyze_ExplicitTemplate(t *testing.T) {
	resolver := &fakeTemplateResolver{
		byID: map[string]Template{"tpl-1": {ID: "tpl-1", Name: "Custom", PromptBody: "custom prompt"}},
	}
	p := &fakeProvider{result: provider.Result{Sentiment: "neutral", Confidence: 0.5}}
	e := NewAdvancedEngine(p, resolver, "gpt-4o-mini")

	result, err := e.Analyze(context.Background(), "text", Options{TemplateID: "tpl-1"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.TemplateID != "tpl-1" || result.TemplateName != "Custom" {
		t.Errorf("got template id=%q name=%q, want tpl-1/Custom", result.TemplateID, result.TemplateName)
	}
}

func TestAdvancedEngine_Analyze_TemplateResolveError(t *testing.T) {
	resolver := &fakeTemplateResolver{dfltErr: errors.New("db unavailable")}
	p := &fakeProvider{}
	e := NewAdvancedEngine(p, resolver, "gpt-4o-mini")

	_, err := e.Analyze(context.Background(), "text", Options{})
	if err == nil {
		t.Fatal("expected an error, got nil")
	}
}

func TestAdvancedEngine_Analyze_ProviderError(t *testing.T) {
	resolver := &fakeTemplateResolver{dflt: Template{ID: "default-id"}}
	p := &fakeProvider{err: errors.New("provider unavailable")}
	e := NewAdvancedEngine(p, resolver, "gpt-4o-mini")

	_, err := e.Analyze(context.Background(), "text", Options{})
	if err == nil {
		t.Fatal("expected an error, got nil")
	}
}
