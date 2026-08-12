package config

import "os"

type Config struct {
	Port            string
	DatabaseURL     string
	MongoURL        string
	OpenAIAPIKey    string
	LLMModel        string
	AssetServiceURL string
}

func Load() Config {
	return Config{
		Port:            getEnv("PORT", "8082"),
		DatabaseURL:     os.Getenv("DATABASE_URL"),
		MongoURL:        os.Getenv("MONGO_URL"),
		OpenAIAPIKey:    os.Getenv("OPENAI_API_KEY"),
		LLMModel:        getEnv("GOFEELER_LLM_MODEL", "gpt-4o-mini"),
		AssetServiceURL: getEnv("ASSET_SERVICE_URL", "http://microverse-asset-service:8080"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
