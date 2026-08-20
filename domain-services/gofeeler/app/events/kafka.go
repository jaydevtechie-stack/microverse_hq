// Package events publishes gofeeler's own lifecycle events — currently
// just sentiment.analyzed — to Kafka. Deliberately a separate topic from
// task-service's task-service.tasks (see docs/schema.md's audit-service
// section): that topic's consumers (search-service in particular) treat
// every message as a full task-state snapshot with no event-name
// filtering, and a sentiment.analyzed message shares none of those fields.
package events

import (
	"context"
	"encoding/json"
	"time"

	"github.com/segmentio/kafka-go"
)

const Topic = "gofeeler.sentiment"

// SentimentAnalyzedEvent mirrors the /analyze result plus the timing and
// identity fields Branch 8's audit-service needs — duration_ms is how
// GoFeeler's own processing-time efficiency metric gets measured, not
// derived after the fact from two separate events.
type SentimentAnalyzedEvent struct {
	Event        string    `json:"event"`
	TaskID       string    `json:"task_id"`
	Service      string    `json:"service"`
	Sentiment    string    `json:"sentiment"`
	Confidence   float64   `json:"confidence"`
	EngineUsed   string    `json:"engine_used"`
	TemplateID   *string   `json:"template_id,omitempty"`
	LLMProvider  *string   `json:"llm_provider,omitempty"`
	ModelVersion *string   `json:"model_version,omitempty"`
	DurationMs   int64     `json:"duration_ms"`
	AnalyzedAt   time.Time `json:"analyzed_at"`
}

// Publisher wraps a single kafka.Writer for the gofeeler.sentiment topic.
type Publisher struct {
	writer *kafka.Writer
}

func NewPublisher(brokers []string) *Publisher {
	return &Publisher{
		writer: &kafka.Writer{
			Addr:     kafka.TCP(brokers...),
			Topic:    Topic,
			Balancer: &kafka.LeastBytes{},
		},
	}
}

// Close is a no-op on a nil *Publisher, same nil-safety as store.Results
// below, so callers (and tests, which pass nil in place of a real
// broker connection) don't need to nil-check first.
func (p *Publisher) Close() error {
	if p == nil {
		return nil
	}
	return p.writer.Close()
}

// PublishSentimentAnalyzed is a plain blocking write — callers that want
// fire-and-forget semantics (as handler.SentimentHandler does, matching
// store.Results.Save's posture) wrap this in their own goroutine with a
// bounded context, same as the existing Mongo-persistence call site. A
// nil *Publisher (no Kafka configured, or a test) is a no-op.
func (p *Publisher) PublishSentimentAnalyzed(ctx context.Context, ev SentimentAnalyzedEvent) error {
	if p == nil {
		return nil
	}
	value, err := json.Marshal(ev)
	if err != nil {
		return err
	}
	return p.writer.WriteMessages(ctx, kafka.Message{
		Key:   []byte(ev.TaskID),
		Value: value,
	})
}
