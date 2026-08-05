package model

type SentimentRequest struct {
    Text string `json:"text" binding:"required"`
}

type SentimentResponse struct {
    Sentiment  string  `json:"sentiment"`
    Confidence float64 `json:"confidence"`
}
