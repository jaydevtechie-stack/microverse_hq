import os
from fastapi import FastAPI
from elasticsearch import Elasticsearch

ELASTICSEARCH_URL = os.environ.get("ELASTICSEARCH_URL", "http://localhost:9200")

app = FastAPI(title="search-service", version="0.1")
es = Elasticsearch(ELASTICSEARCH_URL)


@app.get("/")
async def root():
    return {"message": "search-service is running"}


@app.get("/health")
async def health():
    # Just proves the Elasticsearch connection works — no indices or
    # query endpoints yet, that's Branch 6 (see ROADMAP.md).
    try:
        return {"elasticsearch": "up" if es.ping() else "down"}
    except Exception as exc:
        return {"elasticsearch": "unreachable", "error": str(exc)}
