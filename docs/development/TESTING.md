# Testing — GoFeeler (Branch 5, LLM sentiment engine)

Scope: `domain-services/gofeeler`, up through Branch 5 in
[docs/roadmap/1.0/domain-services.md](../roadmap/1.0/domain-services.md).
This was the first service to get CI/test-case docs — see below for
`search-service`'s, added in Branch 6.1. Still not a repo-wide convention;
most other services have neither yet.

CI runs this automatically: `.github/workflows/gofeeler-ci.yml`, on any
push/PR touching `domain-services/gofeeler/**`.

## Automated — unit tests (`go test ./...`, CI `unit` job)

No external services required; providers/engines/stores are faked or
hit an `httptest.Server`, never the network or a real DB.

| Area | File | Covers |
|---|---|---|
| Basic engine | `engine/basic_test.go` | Table-driven keyword matching (love/great/awesome → positive, hate/terrible/disappointed → negative, else neutral), case-insensitivity, confidence values, `engine_used` stamp. Locks in pre-Branch-5 behavior — the interface refactor must not change results. |
| Advanced engine | `engine/advanced_test.go` | Default-template resolution when `templateId` omitted, explicit-template lookup, template-resolve failure propagates as an error, provider failure propagates as an error. Provider and resolver are both fakes. |
| OpenAI provider | `provider/openai_test.go` | Request shape (Authorization header, model field) against a local `httptest.Server` — never calls `api.openai.com`. Successful completion parsing, malformed model JSON output → error, non-200 API response → error, `Name()` returns `"openai"`. |
| `/analyze` handler | `handler/analyze_test.go` | Engine omitted defaults to `"basic"`. Requesting `"advanced"` when it isn't registered → `400`, not a silent fallback to basic. Response stamps `template_id`/`llm_provider`/`model_version` when the engine provides them. Missing `text` → `400`. Engine returning an error → `502`. |
| `/templates` handler auth | `handler/templates_test.go` | Unverified JWT `sub` extraction from the `Authorization` header — valid bearer token, missing `Bearer` prefix, empty header, malformed JWT. |

Run locally:

```
cd domain-services/gofeeler/app
go build ./... && go vet ./... && go test ./... -cover
```

## Automated — integration (CI `integration` job)

Builds the real binary and runs it against real Postgres + Mongo
(GitHub Actions `services:`), **no `OPENAI_API_KEY` set** — same "advanced
engine disabled" posture as a default boot with no key configured. Talks
to the service over real HTTP on `localhost:8082`, asserting the actual
request/response contract rather than internals:

1. `POST /analyze` with "great"/"love" text → `sentiment: positive`, `engine_used: basic`.
2. `POST /analyze` with "hate"/"terrible" text → `sentiment: negative`.
3. `POST /analyze` with `engine` omitted → still `engine_used: basic` (pre-Branch-5 callers unaffected).
4. `POST /analyze` with `engine: "advanced"` and no key configured → `400`, not a fallback.
5. `GET /templates` → the 3 system-default templates seeded on boot are present.
6. `POST /templates` with a valid body → `201`, `isSystemDefault: false`.
7. `POST /templates` missing `promptBody` → `400`.
8. `PATCH /templates/:id` with `{"name": ...}` → `200`, name changes, `promptBody` untouched (partial update).
9. `PATCH /templates/:id` with an empty body → `400`.
10. `PATCH /templates/:id` for an unknown id → `404`.

## Manual — end-to-end through the running stack

Needs the full `gofeeler` docker-compose profile up (`docker compose --profile gofeeler up -d`)
so nginx, Keycloak, task-service, and the gofeeler Go service are all
reachable through one origin. Not automated yet — no browser driver or
seeded Keycloak test-login flow in CI.

### Backend reachability (nginx → gofeeler)

The gofeeler Go service has no published Docker port — it's internal-only,
reached via `infrastructure/nginx/conf.d/services/gofeeler-service.conf`.
Confirm both routes resolve through the public origin, not just the
docker-internal network:

```
curl -X POST https://gofeeler.microverse.local/api/gofeeler/analyze \
  -H 'Content-Type: application/json' -d '{"text":"awesome!"}'
curl https://gofeeler.microverse.local/api/gofeeler/templates
```

### Create Order file upload (asset-service → MinIO)

Two real gaps caught here during Branch 5 testing, both fixed:

- **Duplicate CORS headers.** `infrastructure/nginx/conf.d/assets.conf`
  used to add its own `Access-Control-Allow-*` headers on
  `storage.microverse.local`, written back when MinIO sent none. Current
  MinIO answers CORS natively (preflight + real response). Two sources
  both stamping `Access-Control-Allow-Origin` produces an invalid
  response — browsers reject it outright ("CORS Failed" in Firefox),
  which silently broke every upload. Fixed by removing nginx's manual
  CORS headers and letting MinIO own it; verify with:
  ```
  curl -i -X OPTIONS https://storage.microverse.local/microverse-assets/x \
    -H 'Origin: https://gofeeler.microverse.local' \
    -H 'Access-Control-Request-Method: PUT'
  ```
  should show **exactly one** `Access-Control-Allow-Origin` line.
- **Self-signed cert, per-hostname browser trust.** The dev cert
  (`infrastructure/secrets/microverse.local.crt`) is self-signed and
  covers `storage.microverse.local` as a SAN, but Firefox/Chrome still
  require a manual trust exception *per hostname* — accepting it on
  `gofeeler.microverse.local` (and implicitly `sso.microverse.local` via
  the Keycloak login redirect) does not cover `storage.microverse.local`,
  which the app only ever reaches via a background `fetch()` that can't
  prompt for one. Shows up as a generic `NetworkError when attempting to
  fetch resource` with no CORS detail. **On a fresh browser/profile,
  visit `https://storage.microverse.local` directly once** and accept
  the risk before testing the Create Order file-upload path.

### `taskId` → Mongo persistence (fire-and-forget)

```
curl -X POST https://gofeeler.microverse.local/api/gofeeler/analyze \
  -H 'Content-Type: application/json' \
  -d '{"text":"I love this!","taskId":"<a real task id>"}'
```

Then confirm a matching document landed in Mongo:

```
docker exec microverse-mongodb mongosh gofeeler --quiet \
  --eval 'db.sentiment_results.find({task_id:"<a real task id>"}).toArray()'
```

Should show `engine_used`, `result.sentiment`/`result.confidence`,
`raw_content`, `analyzed_at` — and the request must still return `200`
even if this write is slow/fails (it's fire-and-forget; check the
service logs for `saving sentiment result:` on failure, never a `5xx`).

### Advanced engine, for real (needs a real `OPENAI_API_KEY`)

Not exercised by CI (no key in the pipeline, and this spends real
money) — run manually when validating provider-integration changes:

1. Set `OPENAI_API_KEY` in `.env`, recreate the `microverse-gofeeler`
   container. Confirm the boot log no longer says `advanced engine
   disabled`.
2. `POST /analyze` with `"engine":"advanced"` → `200`, `engine_used:
   advanced`, `llm_provider: openai`, `model_version` populated,
   `template_id` set to the system-default template's id.
3. Repeat with an explicit `templateId` from `GET /templates` → response's
   `template_id` matches the one requested, not the default.
4. Two `advanced` calls with the same `templateId`/model should be
   directly comparable (5.5's contract) — same `template_id`,
   `llm_provider`, `model_version` on both.

### Role-gated Create Order flow (customer-facing UI)

This is the one that actually caught a real gap during Branch 5 testing —
**not a code bug**, a Keycloak test-user mix-up. `platform:customer` +
`service:gofeeler` are both required to reach `/create`
([docs/architecture/1.0/core.md](../architecture/1.0/core.md)'s two-dimensional
role model). The "+ New" button in the order list is gated only on
`platform:customer` (`GofeelerListPanel.js`), so a user with the wrong
platform role sees a task list but no create button — that's working as
designed, not a bug, if the user genuinely isn't a customer.

Checklist:

1. Confirm which realm role a test user actually holds before reporting a
   "missing Create Order" bug — don't assume from the display name:
   ```
   curl -X POST https://sso.microverse.local/realms/master/protocol/openid-connect/token \
     -d "username=admin&password=<KEYCLOAK_PASSWORD>&grant_type=password&client_id=admin-cli" | ...

   curl https://sso.microverse.local/admin/realms/microverse/users/<id>/role-mappings/realm \
     -H "Authorization: Bearer <admin token>"
   ```
2. Log in as a user holding `platform:customer` + `service:gofeeler`
   (currently `luke@microverse.local` in this environment's seeded Keycloak
   users — see realm-export for the full role → user map).
3. On `gofeeler.microverse.local`, confirm the "+ New" button is visible in
   the order list header, `/create` renders the form (not a bounce back to
   landing), and a successful submit shows the new order in the list
   without a manual refresh (`refreshKey` bump in `GofeelerSplitView.js`).
4. Log in as a user *without* `platform:customer` (e.g. a
   `platform:reviewer`) and confirm the list still loads (their assigned
   tasks) but no "+ New" button appears, and navigating to `/create`
   directly bounces back rather than rendering the form.

---

# Testing — search-service (Branch 6.1, task search index)

Scope: `platform-services/search-service`. CI runs this automatically:
`.github/workflows/search-service-ci.yml`, on any push/PR touching
`platform-services/search-service/**`.

## Automated (`pytest`, CI `test` job)

One job, one real Elasticsearch instance (`services:` in the workflow,
config mirrors `docker-compose.yml`'s `microverse-elasticsearch` exactly)
— same "integration, not mocked" posture as gofeeler's tests above, not
split into separate unit/integration jobs since there's no meaningful
logic here that doesn't ultimately touch ES.

| Test | Covers |
|---|---|
| `test_service_index_name` | Pure function, no ES: `tasks-<service>` naming convention. |
| `test_health_reports_elasticsearch_up` | `/health` reflects a real ES connection. |
| `test_tasks_template_registered` | The `tasks-template` index template (Branch 6.1) exists on boot, pattern `tasks-*`. |
| `test_new_service_index_inherits_tasks_mapping` | Writing to a disposable `tasks-<service>` index lazily creates it with the templated mapping — analyzed `title`/`context`, keyword `status`/`assignee_ids`/etc., no `service` field. Never touches `tasks-gofeeler` itself. |
| `test_tag_suggest_still_works` | Regression check on the pre-existing `/tags/suggest` endpoint, since it shares `main.py` with the new template code. |

Run locally (needs a reachable Elasticsearch — `ELASTICSEARCH_URL` env var,
defaults to `http://localhost:9200`):

```
cd platform-services/search-service
pip install -r requirements.txt
python -m pytest tests/ -v
```

## Manual — end-to-end through the running stack

```
docker compose --profile gofeeler up -d --build microverse-search-service
```

Then, from inside the container (no ES port published to the host by
default):

```
docker exec microverse-search-service python -c "
from app.main import es, TASKS_TEMPLATE_NAME
print(es.indices.get_index_template(name=TASKS_TEMPLATE_NAME).body)
"
```

---

# Testing — search-service (Branch 6.2, lifecycle-aware indexing consumer)

Scope: `platform-services/search-service/app/kafka_consumer.py` (the
consumer) and `business-services/task-service/events/kafka-producer.js`
(the producer). Same CI workflow as 6.1 — no separate job.

## Automated (`pytest`, CI `test` job, `tests/test_kafka_consumer.py`)

Deliberately **no live Kafka broker in CI** — what's actually novel/risky
here is the event → ES upsert logic (`task_event_to_doc`/
`index_task_event`), not the third-party `kafka-python-ng` client's wire
protocol, so these call that logic directly with a fabricated event dict
against the same real Elasticsearch instance the rest of the suite uses,
rather than standing up a broker just to round-trip a message through it.
The real Kafka wiring is exercised manually (below) and was verified live
against the running `gofeeler` docker-compose stack while building this.

| Test | Covers |
|---|---|
| `test_task_event_to_doc_whitelists_fields` | Routing fields (`event`/`task_id`/`service`) don't leak into the ES doc body. |
| `test_task_event_to_doc_defaults_missing_arrays` | Missing `tags`/`assignee_ids` on the event become `[]`, not `null`. |
| `test_index_task_event_upserts_by_task_id` | A `task.assigned` event indexes a doc; a later `task.approved` event for the same `task_id` overwrites it in place (`_id = task_id`, 6.1.3) — asserts exactly one document exists after both, not two. |
| `test_index_task_event_skips_when_missing_task_id_or_service` | Malformed event (no `task_id`/`service`) is a no-op, not a crash — there's nothing to key the upsert on. |

`kafka-python-ng` (pure Python, no C extension) was chosen over `aiokafka`
specifically because `aiokafka`'s C extension has no prebuilt wheel yet
for the Python 3.14 this service (and CI) run — building it from source
needs a C toolchain neither the CI image nor the service's `python:3.14-slim`
base image has. The consumer runs on a background thread (`threading`,
not `asyncio`), matching how the synchronous `Elasticsearch` client is
already called directly from this codebase's `async def` route handlers.

## Manual — end-to-end through the running stack

Needs the full `gofeeler` docker-compose profile up — `microverse-kafka`
is now in that profile (previously `kafka`-profile-only), so this comes
up for free:

```
docker compose --profile gofeeler up -d --build microverse-task-service microverse-search-service
```

Trigger a real lifecycle transition through task-service's actual API
(any of `PATCH /tasks/:id`, `/move-to-review`, `/reviewer`, `/approve`,
`/reject` — see `routes/task-routes.js`), then confirm the doc landed:

```
docker exec microverse-search-service python -c "
from app.main import es, service_index_name
print(es.get(index=service_index_name('gofeeler'), id='<task_id>').body['_source'])
"
```

`status`/`assignee_ids` should match the task's new state. Re-run a
second transition on the same task and confirm `es.count()` on that
index doesn't grow — same task, same `_id`, overwritten in place.

If nothing shows up, check `docker logs microverse-search-service` for
`kafka not reachable yet, retrying in 5s` (broker not up yet — the
consumer thread retries every 5s, no restart needed) and
`docker logs microverse-task-service` for `Error publishing ... for task
...` (producer failure — fire-and-forget, so the API call itself still
succeeds even if this fails).

# Testing — search-service (Branch 6.3, no_index reconcile)

Scope: `platform-services/search-service/app/kafka_consumer.py`'s
delete-vs-upsert branch and `business-services/task-service/routes/
task-routes.js`'s `PATCH /tasks/:id/no-index`. Same CI workflow as 6.1/
6.2 — no separate job. Depends on 6.2.5 (AM account ownership) for the
account-manager side of the route's ownership check.

## Automated (`pytest`, CI `test` job, `tests/test_kafka_consumer.py`)

Same real-ES-integration style as 6.1/6.2 — no mocking, no live Kafka
broker needed, since what's risky is the event → ES delete-or-upsert
logic, not the Kafka wire protocol.

| Test | Covers |
|---|---|
| `test_index_task_event_deletes_on_no_index` | A task indexed via a normal event is actually removed by a later `no_index: true` event — the delete branch, not just a suppressed future write. |
| `test_index_task_event_deleting_missing_doc_is_a_noop` | A `no_index: true` event for a task that was never indexed (or already removed) doesn't raise — `ignore_status=404`. |
| `test_index_task_event_reindexes_after_un_flagging` | A later `no_index: false` event re-indexes the task — reconcile works in both directions, not just delete. |

## Manual — end-to-end through the running stack

Needs the `gofeeler` docker-compose profile up, same as 6.2. `abby`
(the seeded `platform:account-manager` holder, per 6.2.5) needs to own
the target task's Account for the AM path — check via `GET /accounts`
first if unsure.

Flag a task, gated on the caller being either the owning
account-manager or the task's own customer:

```
curl -X PATCH http://localhost:3000/api/tasks/<task_id>/no-index \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"noIndex": true}'
```

Confirm the ES doc is actually gone, not just left stale:

```
docker exec microverse-search-service python -c "
from elasticsearch import NotFoundError
from app.main import es, service_index_name
try:
    print(es.get(index=service_index_name('gofeeler'), id='<task_id>').body['_source'])
except NotFoundError:
    print('deleted, as expected')
"
```

Un-flag (`{"noIndex": false}`) and confirm the same `es.get(...)` call
succeeds again, with the task's current state. Also worth checking that
a caller who neither owns the Account nor the order gets a 403, and
that PM/analyst/reviewer/admin tokens can't reach the route at all
(gated at `requireAnyRealmRole('platform:account-manager',
'platform:customer')` before the ownership check ever runs).

# Testing — notification-service (Branch 7, Notifications & messaging)

Scope: `platform-services/notification-service` end to end (Kafka
consumer, Postgres persistence, REST, WebSocket push, email hand-off) and
`business-services/task-service/routes/task-routes.js`'s new
`task.created` publish on `POST /tasks`.

## Automated (`node --test`, `middleware/auth.test.js`)

Deliberately narrow — the JWT-claims decode helpers
(`claimsFromHeader`/`claimsFromSocketToken`) are pure functions with no
Postgres/Kafka/socket dependency, so they're the one piece covered by a
fast unit test. Everything downstream of "who is this request/socket
from" (recipient resolution, persistence, live push, email hand-off) is
only exercised manually below, against the real stack — same honesty
posture as the rest of this doc: reflects what's actually built, not an
aspirational CI job.

| Test | Covers |
|---|---|
| `claimsFromHeader decodes a Bearer JWT payload` | Happy path — same base64url-payload decode as every other service's unverified claim extraction. |
| `claimsFromHeader returns null without a Bearer prefix` / `for missing/malformed header` | Fails closed rather than throwing on a missing/garbled `Authorization` header. |
| `claimsFromSocketToken decodes the same shape as a raw token` / `returns null for an unparseable token` | Same decode applied to socket.io's `handshake.auth.token` — no `Bearer ` prefix to strip, since a connecting client has no header to attach it to. |

## Manual — end-to-end through the running stack

```
docker compose --profile gofeeler up -d --build microverse-task-service microverse-notification-service microverse-email-service
```

**PM path (`task.created`):** as a customer (`platform:customer` +
`service:gofeeler`), submit an order via `POST /api/tasks`. Confirm a row
landed for the account's PM:

```
docker exec microverse-postgis psql -U <user> -d <db> -c \
  "SELECT recipient_email, type, message, read FROM notifications ORDER BY created_at DESC LIMIT 5;"
```

With that PM's browser session open (bell popover visible), the same row
should appear live via WebSocket without a page refresh — the unread
badge increments and the popup lists the new message.

**Analyst path (`task.assigned`):** as that PM, assign the order to an
analyst (`PATCH /api/tasks/:id`). Same check — a second `notifications`
row for the analyst's email, live-pushed if they're connected.

**Read/navigate:** click a notification in the popup — confirm it
navigates to `/task/:id` and the row's `read` flips to `true`
(`PATCH /api/notifications/:id`), and that a *different* user's
notification id 404s rather than silently succeeding (`markRead`'s
`WHERE id = $1 AND recipient_email = $2`).

**Email hand-off:** check the MailHog UI (`http://localhost:8025` by
default) — both the PM's and the analyst's notification should have
produced an email via `email-service`, sent as
`"GoFeeler" <no-reply@microverse.local>` using its plain `default`
template (`platform-services/email-service/src/templates/default/`) —
dedicated notification-specific templates are a separate, not-yet-scoped
design pass, not part of this branch.

**Retry-on-broker-down:** stop `microverse-kafka` mid-flow, confirm
`docker logs microverse-notification-service` shows `kafka consumer ...,
retrying in 5s` rather than the container exiting, and that consuming
resumes once Kafka's back up — same posture as search-service's 6.2
consumer, verified the same way.

**Non-triggering events:** confirm task-service's other lifecycle events
(`task.moved-to-review`, `task.reviewer-reassigned`, `task.approved`,
`task.rejected`, `task.no-index-changed`) don't produce any
`notifications` rows — this consumer only acts on `task.created`/
`task.assigned`, everything else on the topic is consumed and ignored by
design (Branch 8's audit trail is the intended home for "notify on every
transition").

# Testing — audit-service (Branch 8, Auditing & efficiency)

Scope: `platform-services/audit-service` end to end (dual-topic Kafka
consumer, Postgres persistence, REST) and GoFeeler's new Kafka producer
(`domain-services/gofeeler/app/events/kafka.go`).

## Manual — end-to-end through the running stack

```
docker compose --profile gofeeler up -d --build microverse-gofeeler microverse-audit-service microverse-task-service microverse-nginx
```

Drive a task through create → assign → analyze using real bearer tokens
(a Keycloak login, or — since every service in this stack decodes claims
unverified, see `middleware/auth.js` — an unsigned `header.payload.sig`
JWT with the right `sub`/`email`/`realm_access.roles`, same approach as
the no-index checklist above but against `platform:customer`/
`platform:project-manager`/`platform:analyst`):

```
POST /api/tasks              (platform:customer + service:gofeeler)
PATCH /api/tasks/:id         (platform:project-manager, {"assigneeId": "<analyst's synced user id>"})
POST /api/gofeeler/analyze   (any authenticated caller, {"text": "...", "taskId": "<id>"})
```

Confirm rows landed for all three:

```
docker exec microverse-postgis psql -U <user> -d <db> -c \
  "SELECT event, task_id, status, owner, assignee, duration_ms, occurred_at FROM audit_log ORDER BY occurred_at DESC LIMIT 5;"
```

Expect `task.created` (status `unassigned`), `task.assigned` (status
`analyst`, owner/assignee the analyst's email), and `sentiment.analyzed`
(status/owner/assignee all null, `duration_ms` a real non-negative
number) — confirms both the existing `task-service.tasks` topic and
GoFeeler's new `gofeeler.sentiment` topic are landing in the same table
via `audit-service`'s single dual-topic consumer group
(`audit-service-events`).

**Endpoints + access control:**

```
GET /api/audit/tasks/:taskId              -> timeline, time_in_status via LEAD()
GET /api/audit/metrics/processing-time    -> avg/p50/p95 duration_ms off sentiment.analyzed
GET /api/audit/metrics/reaction-time      -> avg/p50 gap from task.assigned to the next event
```

All three should 200 for `platform:admin` or `platform:project-manager`
tokens and 403 for anything else (no token, `platform:customer`,
`platform:analyst`) — gated by `requireAnyRealmRole` before any route
handler runs, same pattern as task-service's reviewer routes.

**No cross-topic corruption:** after an `/analyze` call, spot-check
search-service's index for the same task is unaffected —
`gofeeler.sentiment` is a separate topic from `task-service.tasks`
specifically so search-service's blind full-state-upsert consumer (6.2)
never sees a `sentiment.analyzed` message:

```
docker exec microverse-search-service python -c "
from app.main import es, service_index_name
print(es.get(index=service_index_name('gofeeler'), id='<task_id>').body['_source'])
"
```

Confirm the task's `title`/`context`/`status`/etc. are all still intact,
not blanked or partially overwritten.

**Retry-on-broker-down:** stop `microverse-kafka` mid-flow, confirm
`docker logs microverse-audit-service` shows `kafka consumer ...,
retrying in 5s` rather than the container exiting, and that both topics
resume consuming once Kafka's back up — same posture as
notification-service's and search-service's own consumers.

**Replay on first boot:** a fresh `audit-service` container (or one
pointed at a new consumer group id) subscribes `fromBeginning: true`, so
it backfills the entire `task-service.tasks` history on first connect —
expect `audit_log` to immediately contain rows for every task lifecycle
event ever published, not just ones that happen after audit-service
started.
