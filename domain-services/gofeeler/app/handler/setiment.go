package handler

import (
    "gofeeler/model"
    "github.com/gin-gonic/gin"
    "net/http"
    "strings"
)

// @Summary Analyze sentiment
// @Description Returns sentiment (positive, negative, neutral) of given text
// @Tags sentiment
// @Accept json
// @Produce json
// @Param request body model.SentimentRequest true "Text to analyze"
// @Success 200 {object} model.SentimentResponse
// @Router /analyze [post]
func AnalyzeSentiment(c *gin.Context) {
    var req model.SentimentRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    text := strings.ToLower(req.Text)
    sentiment := "neutral"
    confidence := 0.5

    if strings.Contains(text, "love") || strings.Contains(text, "great") || strings.Contains(text, "awesome") {
        sentiment = "positive"
        confidence = 0.9
    } else if strings.Contains(text, "hate") || strings.Contains(text, "terrible") || strings.Contains(text, "disappointed") {
        sentiment = "negative"
        confidence = 0.9
    }

    c.JSON(http.StatusOK, model.SentimentResponse{
        Sentiment:  sentiment,
        Confidence: confidence,
    })
}
