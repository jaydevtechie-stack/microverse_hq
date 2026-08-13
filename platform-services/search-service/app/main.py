import base64
import binascii
import json
import os
from datetime import datetime, timezone

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
from elasticsearch import Elasticsearch

from app.kafka_consumer import start_kafka_consumer_thread

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


# One index per service (tasks-<service>), not one flat "tasks" index —
# service-scope becomes index *routing*, not a query-time filter (see
# ROADMAP.md's "Task search index" proposal). A template governs any
# tasks-* index lazily, so a new service's first task write creates a
# correctly-mapped index with no per-service setup needed here. No
# `service` field in the mapping — it's implicit in which index a
# document lives in.
TASKS_INDEX_PATTERN = "tasks-*"
TASKS_TEMPLATE_NAME = "tasks-template"
TASKS_MAPPINGS = {
    "properties": {
        # Analyzed — the actual query targets.
        "title": {"type": "text"},
        "context": {"type": "text"},
        # Keyword — filter/narrowing only, never relevance-matched.
        "status": {"type": "keyword"},
        "tags": {"type": "keyword"},
        "owner": {"type": "keyword"},
        "customer_id": {"type": "keyword"},
        "account_id": {"type": "keyword"},
        "project_id": {"type": "keyword"},
        "assignee_ids": {"type": "keyword"},  # kept for future "my tasks" narrowing, not required for base access
        "created_at": {"type": "date"},
        "assigned_at": {"type": "date"},
    }
}


def service_index_name(service: str) -> str:
    """Single source of truth for the tasks-<service> naming convention."""
    return f"tasks-{service}"


# Permission-scoped search (6.4) — unverified claim extraction, same
# interim trust posture as task-service's auth.js and asset-service's
# auth.rs (Bearer <token> -> split on "." -> base64url-decode the payload
# segment -> parse; no JWKS signature check anywhere in the stack yet,
# see docs/security.md). This follows that existing posture rather than
# being the first service to diverge from it.
def claims_from_header(authorization: str | None) -> dict | None:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    parts = authorization[len("Bearer "):].split(".")
    if len(parts) < 2:
        return None
    segment = parts[1]
    padded = segment + "=" * (-len(segment) % 4)
    try:
        return json.loads(base64.urlsafe_b64decode(padded))
    except (binascii.Error, ValueError, json.JSONDecodeError):
        return None


# Scope resolver (6.4.1) — service membership is already a first-class
# entry in the JWT's realm_access.roles (`service:<name>`, see
# task-service's models/user.js `listUsers`), so this needs no
# task-service round trip. platform:admin resolves to no scope at all
# (least privilege — admin's job is Users/Services administration, not
# task content). Everyone else's scope is exactly the tasks-<service>
# indices for the service:* roles they hold; no service:* roles (or no
# claims at all) resolves to an empty index list, not a wildcard across
# every index — fail-closed.
def resolve_scope(claims: dict | None) -> list[str]:
    roles = (claims or {}).get("realm_access", {}).get("roles", [])
    if "platform:admin" in roles:
        return []
    services = [role.split(":", 1)[1] for role in roles if role.startswith("service:")]
    return [service_index_name(service) for service in services]


# Query assembler (6.4.2) — must/filter only covers within-scope
# narrowing (status, from 6.1.2's keyword fields). There's no service
# filter clause because service isn't a doc field (6.1.1's mapping has
# none) — that access boundary is already enforced by which indices
# resolve_scope selected, not by a query-time filter.
def build_search_query(q: str, status: str | None = None) -> dict:
    query: dict = {"bool": {"must": [{"multi_match": {"query": q, "fields": ["title", "context"]}}]}}
    if status:
        query["bool"]["filter"] = [{"term": {"status": status}}]
    return query


@app.on_event("startup")
def ensure_tasks_template():
    es.indices.put_index_template(
        name=TASKS_TEMPLATE_NAME,
        index_patterns=[TASKS_INDEX_PATTERN],
        template={"mappings": TASKS_MAPPINGS},
    )


# Lifecycle-aware indexing consumer (6.2) — a background thread, not a
# separate process, matching how rustledger owns its own Kafka consumer
# rather than a shared bus-listener service. Runs on a thread (not the
# asyncio event loop) since KafkaConsumer is a blocking/sync client, the
# same posture the Elasticsearch client above already has in this app.
# Starting it on a thread means a Kafka outage at boot doesn't stop the
# rest of search-service (tag suggest, health) from working.
@app.on_event("startup")
def start_kafka_consumer():
    app.state.kafka_thread, app.state.kafka_stop_event = start_kafka_consumer_thread(
        es, service_index_name
    )


@app.on_event("shutdown")
def stop_kafka_consumer():
    stop_event = getattr(app.state, "kafka_stop_event", None)
    if stop_event is None:
        return
    stop_event.set()


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


DEFAULT_SEARCH_SIZE = 10
MAX_SEARCH_SIZE = 50


@app.get("/search")
async def search_tasks(
    q: str = "",
    service: str | None = None,
    status: str | None = None,
    page: int = 1,
    size: int = DEFAULT_SEARCH_SIZE,
    authorization: str | None = Header(default=None),
):
    query_text = q.strip()
    page = max(page, 1)
    size = min(max(size, 1), MAX_SEARCH_SIZE)
    if not query_text:
        return {"hits": [], "total": 0, "page": page, "size": size}

    indices = resolve_scope(claims_from_header(authorization))

    # `service` narrows within scope, it never widens it — a service
    # outside the caller's resolved scope collapses to no results rather
    # than confirming whether that service (or a task in it) exists.
    if service:
        target = service_index_name(service)
        indices = [target] if target in indices else []

    if not indices:
        return {"hits": [], "total": 0, "page": page, "size": size}

    # ignore_unavailable — a service's tasks-<service> index only exists
    # once its first task is written (6.1.1's lazy template-inherited
    # creation), so a caller scoped to a service with no tasks yet is a
    # normal empty result, not a 404.
    result = es.search(
        index=",".join(indices),
        query=build_search_query(query_text, status=status),
        from_=(page - 1) * size,
        size=size,
        ignore_unavailable=True,
    )
    hits = [
        {
            "task_id": hit["_id"],
            "title": hit["_source"].get("title"),
            "snippet": hit["_source"].get("context"),
            # No `service` field in the mapping (6.1.1) — it's implicit
            # in which index the hit came from, not the doc source.
            "service": hit["_index"].removeprefix("tasks-"),
            "score": hit["_score"],
        }
        for hit in result["hits"]["hits"]
    ]
    return {"hits": hits, "total": result["hits"]["total"]["value"], "page": page, "size": size}


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
