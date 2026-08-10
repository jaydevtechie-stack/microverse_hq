package engine

import (
	"context"
	"testing"
)

// Locks in the exact word lists/confidences from the pre-Branch-5 handler
// so the interface refactor is behavior-preserving.
func TestBasicEngine_Analyze(t *testing.T) {
	tests := []struct {
		name           string
		text           string
		wantSentiment  string
		wantConfidence float64
	}{
		{"love", "I love this", "positive", 0.9},
		{"great", "This is great", "positive", 0.9},
		{"awesome", "Awesome work", "positive", 0.9},
		{"hate", "I hate this", "negative", 0.9},
		{"terrible", "Terrible experience", "negative", 0.9},
		{"disappointed", "Very disappointed", "negative", 0.9},
		{"neutral", "It happened on Tuesday", "neutral", 0.5},
		{"case-insensitive", "I LOVE this", "positive", 0.9},
	}

	e := NewBasicEngine()
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := e.Analyze(context.Background(), tt.text, Options{})
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if result.Sentiment != tt.wantSentiment {
				t.Errorf("Sentiment = %q, want %q", result.Sentiment, tt.wantSentiment)
			}
			if result.Confidence != tt.wantConfidence {
				t.Errorf("Confidence = %v, want %v", result.Confidence, tt.wantConfidence)
			}
			if result.EngineUsed != "basic" {
				t.Errorf("EngineUsed = %q, want %q", result.EngineUsed, "basic")
			}
		})
	}
}
