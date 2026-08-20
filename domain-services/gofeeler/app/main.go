package main

import (
	"context"
	"log"

	"github.com/gin-gonic/gin"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"

	"gofeeler/assetclient"
	"gofeeler/config"
	"gofeeler/db"
	"gofeeler/engine"
	"gofeeler/events"
	"gofeeler/handler"
	"gofeeler/provider"
	"gofeeler/store"
)

func main() {
	cfg := config.Load()
	ctx := context.Background()

	if cfg.DatabaseURL == "" {
		log.Fatal("DATABASE_URL must be set")
	}
	pool, err := db.ConnectPostgres(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("connecting to postgres: %v", err)
	}
	defer pool.Close()

	mongoDB := db.ConnectMongo(ctx, cfg.MongoURL)

	templates := store.NewTemplates(pool)
	results := store.NewResults(mongoDB)

	engines := map[string]engine.SentimentEngine{
		"basic": engine.NewBasicEngine(),
	}
	if cfg.OpenAIAPIKey != "" {
		llmProvider := provider.NewOpenAIProvider(cfg.OpenAIAPIKey)
		engines["advanced"] = engine.NewAdvancedEngine(llmProvider, templates, cfg.LLMModel)
	} else {
		log.Println("OPENAI_API_KEY not set — advanced engine disabled")
	}

	assets := assetclient.New(cfg.AssetServiceURL)
	eventsPublisher := events.NewPublisher(cfg.KafkaBrokers)
	defer eventsPublisher.Close()
	sentimentHandler := handler.NewSentimentHandler(engines, results, assets, eventsPublisher)
	templatesHandler := handler.NewTemplatesHandler(templates)

	router := gin.Default()

	router.GET("/", func(c *gin.Context) {
		c.JSON(200, gin.H{"message": "GoFeeler service running"})
	})

	router.POST("/analyze", sentimentHandler.AnalyzeSentiment)
	router.GET("/templates", templatesHandler.ListTemplates)
	router.POST("/templates", templatesHandler.CreateTemplate)
	router.PATCH("/templates/:id", templatesHandler.UpdateTemplate)

	router.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	router.Run(":" + cfg.Port)
}
