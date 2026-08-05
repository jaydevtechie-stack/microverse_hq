# search-service

**Status:** scaffolded, not yet queried. Python/FastAPI, real but minimal.

Search over human users (analysts, project managers, customers) —
runs on Elasticsearch. `microverse-elasticsearch` and
`microverse-search-service` are both in `docker-compose.yml` now,
under the `gofeeler` profile (plus their own standalone profiles:
`elasticsearch`, `search-service`).

What's actually running (`app/main.py`) is just `GET /` and
`GET /health` (pings Elasticsearch and reports up/down) — no indices,
no query endpoints yet. That's ROADMAP.md's Branch 6: a
permission-scoped search endpoint (owner/assignee/company filter baked
into the query per the role model), plus the tag-suggest endpoint for
GoFeeler's sentiment tag input (server-side fuzzy matching via
Elasticsearch, not a client-side library).
