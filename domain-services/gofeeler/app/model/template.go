package model

import "time"

type Template struct {
	ID              string    `json:"id"`
	Name            string    `json:"name"`
	PromptBody      string    `json:"promptBody"`
	CreatedBy       *string   `json:"createdBy"`
	IsSystemDefault bool      `json:"isSystemDefault"`
	CreatedAt       time.Time `json:"createdAt"`
}

type CreateTemplateRequest struct {
	Name       string `json:"name" binding:"required"`
	PromptBody string `json:"promptBody" binding:"required"`
}

// UpdateTemplateRequest is a partial update — pointer fields so
// "omitted" and "cleared" are distinguishable, matching PATCH semantics
// rather than CreateTemplateRequest's full-body shape.
type UpdateTemplateRequest struct {
	Name       *string `json:"name"`
	PromptBody *string `json:"promptBody"`
}
