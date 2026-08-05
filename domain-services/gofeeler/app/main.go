package main

import (
	"github.com/gin-gonic/gin"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"

	//"net/http"
	"gofeeler/handler"
	//docs "gofeeler/docs"
)

func main() {
	router := gin.Default()

	router.GET("/", func(c *gin.Context) {
		c.JSON(200, gin.H{"message": "GoFeeler service running"})
	})

	router.POST("/analyze", handler.AnalyzeSentiment)

	router.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	router.Run(":8082") // Runs on port 8080
}
