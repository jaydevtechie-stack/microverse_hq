package store

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/v2/mongo"

	"gofeeler/engine"
)

// Results writes to the gofeeler.sentiment_results collection
// (docs/schema.md's "Branch 5 shape"). Uniform shape across both engines —
// LLM fields simply empty for basic — so downstream consumers like
// Djaboard don't need to branch on engine type.
type Results struct {
	coll *mongo.Collection
}

// NewResults returns nil if db is nil (Mongo unavailable) — Save on a nil
// *Results is a no-op, so callers don't need to nil-check before writing.
func NewResults(db *mongo.Database) *Results {
	if db == nil {
		return nil
	}
	return &Results{coll: db.Collection("sentiment_results")}
}

type resultDoc struct {
	TaskID       string    `bson:"task_id,omitempty"`
	EngineUsed   string    `bson:"engine_used"`
	TemplateID   string    `bson:"template_id,omitempty"`
	TemplateName string    `bson:"template_name,omitempty"`
	LLMProvider  string    `bson:"llm_provider,omitempty"`
	ModelVersion string    `bson:"model_version,omitempty"`
	RawContent   string    `bson:"raw_content"`
	Result       resultVal `bson:"result"`
	AnalyzedAt   time.Time `bson:"analyzed_at"`
}

type resultVal struct {
	Sentiment  string  `bson:"sentiment"`
	Confidence float64 `bson:"confidence"`
}

// Save is fire-and-forget from the caller's perspective: it never blocks
// the /analyze response on Mongo being healthy. taskID is optional — a
// request with no taskId still gets analyzed, it just isn't persisted.
func (r *Results) Save(ctx context.Context, taskID, rawContent string, result engine.Result) error {
	if r == nil {
		return nil
	}

	doc := resultDoc{
		TaskID:       taskID,
		EngineUsed:   result.EngineUsed,
		TemplateID:   result.TemplateID,
		TemplateName: result.TemplateName,
		LLMProvider:  result.LLMProvider,
		ModelVersion: result.ModelVersion,
		RawContent:   rawContent,
		Result: resultVal{
			Sentiment:  result.Sentiment,
			Confidence: result.Confidence,
		},
		AnalyzedAt: time.Now().UTC(),
	}

	_, err := r.coll.InsertOne(ctx, doc)
	return err
}
