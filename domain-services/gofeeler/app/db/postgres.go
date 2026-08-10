package db

import (
	"context"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// ConnectPostgres connects with retry — Postgres may still be starting up
// when GoFeeler boots under docker-compose — then ensures the gofeeler
// schema/tables/seed data exist. Same "connect, then idempotent bootstrap
// on every boot" shape as rustledger's db.rs; no separate migration tool.
func ConnectPostgres(ctx context.Context, databaseURL string) (*pgxpool.Pool, error) {
	var pool *pgxpool.Pool
	var err error

	for attempt := 1; attempt <= 10; attempt++ {
		pool, err = pgxpool.New(ctx, databaseURL)
		if err == nil {
			if pingErr := pool.Ping(ctx); pingErr == nil {
				break
			} else {
				err = pingErr
				pool.Close()
			}
		}
		log.Printf("postgres connect attempt %d/10 failed: %v", attempt, err)
		time.Sleep(2 * time.Second)
	}
	if err != nil {
		return nil, err
	}

	if err := ensureSchema(ctx, pool); err != nil {
		pool.Close()
		return nil, err
	}

	return pool, nil
}

func ensureSchema(ctx context.Context, pool *pgxpool.Pool) error {
	statements := []string{
		`CREATE EXTENSION IF NOT EXISTS pgcrypto`,
		`CREATE SCHEMA IF NOT EXISTS gofeeler`,
		`CREATE TABLE IF NOT EXISTS gofeeler.sentiment_prompt_templates (
			id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			name               TEXT NOT NULL,
			prompt_body        TEXT NOT NULL,
			created_by         UUID REFERENCES public.users(id),
			is_system_default  BOOLEAN NOT NULL DEFAULT false,
			created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_sentiment_prompt_templates_default
			ON gofeeler.sentiment_prompt_templates (is_system_default)
			WHERE is_system_default = true`,
	}

	for _, stmt := range statements {
		if _, err := pool.Exec(ctx, stmt); err != nil {
			return err
		}
	}

	return seedDefaultTemplates(ctx, pool)
}

type defaultTemplate struct {
	name string
	body string
}

var defaultTemplates = []defaultTemplate{
	{
		name: "Default sentiment classification",
		body: "Classify the overall sentiment of the following customer-submitted text.",
	},
	{
		name: "Support ticket triage",
		body: "Read the following support ticket text and classify how the customer feels about the issue they're reporting.",
	},
	{
		name: "Customer review analysis",
		body: "Analyze the sentiment of the following customer review.",
	},
}

func seedDefaultTemplates(ctx context.Context, pool *pgxpool.Pool) error {
	for _, t := range defaultTemplates {
		_, err := pool.Exec(ctx, `
			INSERT INTO gofeeler.sentiment_prompt_templates (name, prompt_body, is_system_default)
			SELECT $1, $2, true
			WHERE NOT EXISTS (
				SELECT 1 FROM gofeeler.sentiment_prompt_templates
				WHERE name = $1 AND is_system_default = true
			)
		`, t.name, t.body)
		if err != nil {
			return err
		}
	}
	return nil
}
