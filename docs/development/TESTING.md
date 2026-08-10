# Testing — GoFeeler (Branch 5, LLM sentiment engine)

Scope: `domain-services/gofeeler`, up through Branch 5 in
[docs/roadmap/1.0/domain-services.md](../roadmap/1.0/domain-services.md).
Other services have no CI or test-case docs yet — this is the first pass,
not a repo-wide convention (yet).

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
