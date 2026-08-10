package store

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"gofeeler/engine"
	"gofeeler/model"
)

// Templates is the sentiment_prompt_templates store — a shared pool
// visible to every analyst, self-service create, no gating (blast radius
// is contained to the creating analyst's own analyses).
type Templates struct {
	pool *pgxpool.Pool
}

func NewTemplates(pool *pgxpool.Pool) *Templates {
	return &Templates{pool: pool}
}

func (t *Templates) List(ctx context.Context) ([]model.Template, error) {
	rows, err := t.pool.Query(ctx, `
		SELECT id, name, prompt_body, created_by, is_system_default, created_at
		FROM gofeeler.sentiment_prompt_templates
		ORDER BY created_at
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var templates []model.Template
	for rows.Next() {
		var tpl model.Template
		var id string
		if err := rows.Scan(&id, &tpl.Name, &tpl.PromptBody, &tpl.CreatedBy, &tpl.IsSystemDefault, &tpl.CreatedAt); err != nil {
			return nil, err
		}
		tpl.ID = id
		templates = append(templates, tpl)
	}
	return templates, rows.Err()
}

func (t *Templates) Create(ctx context.Context, req model.CreateTemplateRequest, createdBy *string) (model.Template, error) {
	var tpl model.Template
	var id string
	err := t.pool.QueryRow(ctx, `
		INSERT INTO gofeeler.sentiment_prompt_templates (name, prompt_body, created_by, is_system_default)
		VALUES ($1, $2, $3, false)
		RETURNING id, name, prompt_body, created_by, is_system_default, created_at
	`, req.Name, req.PromptBody, createdBy).Scan(&id, &tpl.Name, &tpl.PromptBody, &tpl.CreatedBy, &tpl.IsSystemDefault, &tpl.CreatedAt)
	if err != nil {
		return model.Template{}, err
	}
	tpl.ID = id
	return tpl, nil
}

// Resolve implements engine.TemplateResolver: a non-empty templateID looks
// up that specific row; empty falls back to the system default.
func (t *Templates) Resolve(ctx context.Context, templateID string) (engine.Template, error) {
	var row pgx.Row
	if templateID != "" {
		row = t.pool.QueryRow(ctx, `
			SELECT id, name, prompt_body FROM gofeeler.sentiment_prompt_templates WHERE id = $1
		`, templateID)
	} else {
		row = t.pool.QueryRow(ctx, `
			SELECT id, name, prompt_body FROM gofeeler.sentiment_prompt_templates
			WHERE is_system_default = true
			ORDER BY created_at
			LIMIT 1
		`)
	}

	var tpl engine.Template
	if err := row.Scan(&tpl.ID, &tpl.Name, &tpl.PromptBody); err != nil {
		return engine.Template{}, fmt.Errorf("resolving template %q: %w", templateID, err)
	}
	return tpl, nil
}
