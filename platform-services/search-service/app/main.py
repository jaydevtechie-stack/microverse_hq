import os
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from elasticsearch import Elasticsearch

ELASTICSEARCH_URL = os.environ.get("ELASTICSEARCH_URL", "http://localhost:9200")

# One shared index across every domain service that wants tag
# autocomplete — not a per-service table (see ROADMAP.md's "Sentiment
# tag input" proposal). A lowercase normalizer on name.keyword makes
# exact-match lookups (for the upsert-on-create path) case-insensitive,
# so "Urgency" and "urgency" land on the same document.
TAGS_INDEX = "tags"
TAGS_MAPPINGS = {
    "properties": {
        "name": {"type": "text", "fields": {"keyword": {"type": "keyword", "normalizer": "lowercase_normalizer"}}},
        "created_at": {"type": "date"},
        "usage_count": {"type": "integer"},
    }
}
TAGS_SETTINGS = {
    "analysis": {"normalizer": {"lowercase_normalizer": {"type": "custom", "filter": ["lowercase"]}}}
}

# GoFeeler's starter sentiment vocabulary — seeded once, on first index
# creation only, so the tag input isn't empty before anyone's created a
# real tag yet. Not re-seeded on restart; from here on the vocabulary
# just grows from whatever gets typed (see the open-vocabulary approach
# in ROADMAP.md).
SEED_TAGS = [
    "positive", "negative", "neutral", "mixed", "sarcasm",
    "urgency", "frustration", "confusion", "gratitude", "escalation",
]

app = FastAPI(title="search-service", version="0.1")
es = Elasticsearch(ELASTICSEARCH_URL)


@app.on_event("startup")
def ensure_index():
    if es.indices.exists(index=TAGS_INDEX):
        return
    es.indices.create(index=TAGS_INDEX, mappings=TAGS_MAPPINGS, settings=TAGS_SETTINGS)
    now = datetime.now(timezone.utc).isoformat()
    for name in SEED_TAGS:
        es.index(index=TAGS_INDEX, document={"name": name, "created_at": now, "usage_count": 0})


@app.get("/")
async def root():
    return {"message": "search-service is running"}


@app.get("/health")
async def health():
    try:
        return {"elasticsearch": "up" if es.ping() else "down"}
    except Exception as exc:
        return {"elasticsearch": "unreachable", "error": str(exc)}


@app.get("/tags/suggest")
async def suggest_tags(q: str = ""):
    query = q.strip()
    if not query:
        return {"matches": [], "exact_match": False}

    # Two different needs, one query: match_bool_prefix catches
    # mid-typing ("urg" -> "Urgency") since fuzziness alone won't —
    # edit distance between a short prefix and the full word is way
    # past what fuzziness:AUTO allows. The fuzzy match clause is what
    # actually catches typos on a roughly-complete word ("urgncy").
    result = es.search(
        index=TAGS_INDEX,
        query={
            "bool": {
                "should": [
                    {"match_bool_prefix": {"name": query}},
                    {"match": {"name": {"query": query, "fuzziness": "AUTO"}}},
                ]
            }
        },
        size=5,
    )
    matches = [
        {"name": hit["_source"]["name"], "usage_count": hit["_source"].get("usage_count", 0)}
        for hit in result["hits"]["hits"]
    ]
    exact_match = any(m["name"].lower() == query.lower() for m in matches)
    return {"matches": matches, "exact_match": exact_match}


class TagCreate(BaseModel):
    name: str


@app.post("/tags")
async def create_or_bump_tag(payload: TagCreate):
    # Lowercase + trimmed at write time, not just matched case-
    # insensitively at lookup — otherwise whichever casing happened to
    # be typed first ("Urgency" vs "urgency") sticks permanently as the
    # display value for everyone after it.
    name = payload.name.strip().lower()
    if not name:
        raise HTTPException(status_code=400, detail="name is required")

    # Exact (case-insensitive) lookup via the normalized keyword field —
    # fuzzy matching is for suggestions while typing, not for deciding
    # whether a submitted tag is "the same" as an existing one.
    existing = es.search(index=TAGS_INDEX, query={"term": {"name.keyword": name}}, size=1)
    hits = existing["hits"]["hits"]

    if hits:
        doc_id = hits[0]["_id"]
        usage_count = hits[0]["_source"].get("usage_count", 0) + 1
        es.update(index=TAGS_INDEX, id=doc_id, doc={"usage_count": usage_count})
        return {"name": hits[0]["_source"]["name"], "usage_count": usage_count, "created": False}

    doc = {"name": name, "created_at": datetime.now(timezone.utc).isoformat(), "usage_count": 1}
    es.index(index=TAGS_INDEX, document=doc, refresh="wait_for")
    return {"name": name, "usage_count": 1, "created": True}
