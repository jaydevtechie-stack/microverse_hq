package db

import (
	"context"
	"log"
	"time"

	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

// ConnectMongo connects to Mongo for sentiment_results persistence.
// Unlike Postgres, Mongo is not required for GoFeeler to serve requests —
// /analyze's Mongo write is best-effort — so a failure here is logged and
// returns a nil database rather than failing service startup.
func ConnectMongo(ctx context.Context, mongoURL string) *mongo.Database {
	if mongoURL == "" {
		log.Println("MONGO_URL not set — sentiment_results persistence disabled")
		return nil
	}

	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	client, err := mongo.Connect(options.Client().ApplyURI(mongoURL))
	if err != nil {
		log.Printf("mongo connect failed: %v — sentiment_results persistence disabled", err)
		return nil
	}
	if err := client.Ping(pingCtx, nil); err != nil {
		log.Printf("mongo ping failed: %v — sentiment_results persistence disabled", err)
		return nil
	}

	return client.Database("gofeeler")
}
