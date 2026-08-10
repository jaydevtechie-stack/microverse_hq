package engine

import (
	"context"
	"strings"
)

// BasicEngine is the original keyword matcher, refactored behind
// SentimentEngine with no behavior change — same words, same confidences.
type BasicEngine struct{}

func NewBasicEngine() *BasicEngine {
	return &BasicEngine{}
}

func (e *BasicEngine) Analyze(_ context.Context, text string, _ Options) (Result, error) {
	lower := strings.ToLower(text)
	sentiment := "neutral"
	confidence := 0.5

	if strings.Contains(lower, "love") || strings.Contains(lower, "great") || strings.Contains(lower, "awesome") {
		sentiment = "positive"
		confidence = 0.9
	} else if strings.Contains(lower, "hate") || strings.Contains(lower, "terrible") || strings.Contains(lower, "disappointed") {
		sentiment = "negative"
		confidence = 0.9
	}

	return Result{
		Sentiment:  sentiment,
		Confidence: confidence,
		EngineUsed: "basic",
	}, nil
}
