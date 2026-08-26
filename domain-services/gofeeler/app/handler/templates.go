package handler

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"gofeeler/auth"
	"gofeeler/model"
	"gofeeler/store"
)

// postgresForeignKeyViolation is Postgres's SQLSTATE for a foreign key
// violation — surfaced here as a 400 (an unrecognized created_by, e.g. an
// unsynced Keycloak sub) rather than a 500.
const postgresForeignKeyViolation = "23503"

type TemplatesHandler struct {
	templates *store.Templates
}

func NewTemplatesHandler(templates *store.Templates) *TemplatesHandler {
	return &TemplatesHandler{templates: templates}
}

// @Summary List sentiment prompt templates
// @Description Shared pool of analyst-authored prompt templates for the advanced engine
// @Tags templates
// @Produce json
// @Success 200 {array} model.Template
// @Router /templates [get]
func (h *TemplatesHandler) ListTemplates(c *gin.Context) {
	templates, err := h.templates.List(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, templates)
}

// @Summary Create a sentiment prompt template
// @Description Self-service — any analyst may create a template, no gating (blast radius is contained to their own analyses)
// @Tags templates
// @Accept json
// @Produce json
// @Param request body model.CreateTemplateRequest true "Template to create"
// @Success 201 {object} model.Template
// @Router /templates [post]
func (h *TemplatesHandler) CreateTemplate(c *gin.Context) {
	var req model.CreateTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var createdBy *string
	if claims := auth.ClaimsFromHeader(c.GetHeader("Authorization")); claims != nil && claims.Subject != "" {
		createdBy = &claims.Subject
	}

	tpl, err := h.templates.Create(c.Request.Context(), req, createdBy)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == postgresForeignKeyViolation {
			c.JSON(http.StatusBadRequest, gin.H{"error": "unrecognized created_by user"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, tpl)
}

// @Summary Update a sentiment prompt template
// @Description Partial update (create's self-service, no-gating posture applies here too) — at least one of name/promptBody required
// @Tags templates
// @Accept json
// @Produce json
// @Param id path string true "Template ID"
// @Param request body model.UpdateTemplateRequest true "Fields to update"
// @Success 200 {object} model.Template
// @Router /templates/{id} [patch]
func (h *TemplatesHandler) UpdateTemplate(c *gin.Context) {
	var req model.UpdateTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Name == nil && req.PromptBody == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": `at least one of "name" or "promptBody" is required`})
		return
	}

	tpl, err := h.templates.Update(c.Request.Context(), c.Param("id"), req)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "template not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, tpl)
}
