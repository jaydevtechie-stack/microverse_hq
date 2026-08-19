# Microverse — database schema

The actual table/collection/index definitions, consolidated in one place so any service (or agent) can refer to the current design without hunting through [docs/architecture](architecture/1.0/core.md)/[docs/roadmap](roadmap/1.0/core.md) prose. See those docs for the *reasoning* behind each decision — this file is just the shape.

**Source of truth once a table is actually built:** the real migration files in that service's repo. This doc is a cross-service reference, kept in sync by hand — if it ever disagrees with a service's actual migrations, the migrations win and this file needs updating, not the other way around.

Status per table: 🟢 designed, not yet migrated · ✅ migrated and live · — not yet designed

---

# task-service database

**PostgreSQL** — `${POSTGRES_DB}` on `microverse-postgis`

*Note: `rustledger` and `springpix` connect to this same `${POSTGRES_DB}` instance — decided to keep this shared for now (practical, one less moving part while the core flow is still being built). Revisit only if there's a concrete reason to split (independent scaling, or a real observed resource conflict between SpringPix's spatial queries and task-service's OLTP pool-claiming).*

## tasks — ✅ live

This is the real, currently-migrated schema — simpler than the normalized target below, and that's intentional for now, not a mistake:

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS tasks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service      TEXT NOT NULL,
  title        TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'unassigned',
  assignee     TEXT,
  owner        TEXT,
  due_date     TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  context      TEXT,
  tags         TEXT[],
  project_id   UUID REFERENCES projects(id),  -- additive, 4.0.2 — see projects below
  assigned_at  TIMESTAMPTZ,  -- set on unassigned -> analyst (4.1); Scout's (4.1.1) v1 availability signal
  customer_id  UUID REFERENCES users(id),  -- who submitted the order (4.2) — see users below, not a separate customers table
  account_id   UUID REFERENCES accounts(id),  -- denormalized copy of users.account_id at creation time, feeds the MinIO key (4.2)
  closed_at    TIMESTAMPTZ,  -- when the task reached a terminal status (done/paid/closed) — column only, nothing sets it yet
  no_index     BOOLEAN NOT NULL DEFAULT false  -- excluded from search-service's index (6.3) — a delete against the ES doc, not a mapping concern
);

CREATE INDEX IF NOT EXISTS idx_tasks_tags ON tasks USING GIN (tags);
```

**`assigned_at` — set once, on assignment, not a general status-transition log.** Scout's recommendation query (`models/scout.js`) uses it as a proxy for analyst availability: no active task → fully available; among analysts with one, the longer since `assigned_at`, the more available they're assumed to be. This is explicitly a starting signal, not real response-time measurement — there's no `completed_at` or first-action timestamp on `tasks` itself. Real response-time tracking is the `audit_log` table below (Branch 8) — it doesn't need a new `tasks` column, since `task.assigned`'s own Kafka event timestamp becomes the reaction-time baseline.

**Tags — reconciled with the Elasticsearch `tags` index (search-service):** the two stores do different jobs, on purpose. Elasticsearch's `tags` index is the shared *vocabulary* — what exists, fuzzy-matched for autocomplete while someone's typing. `tasks.tags` stores which tag *names* are actually applied to this specific task — plain strings in a Postgres array, not a join table. A handful of short tag names per task doesn't need its own relational identity the way `task_comments` does; storing the name directly (not a numeric tag ID) also matches how ES already treats tag identity via `name.keyword` — the tag *is* its name, there's no separate ID anywhere in the design that Postgres would need to reference. The GIN index makes `tags @> ARRAY['Negative']`-style lookups cheap once you want "show me every task tagged Urgency."

**Current vs. target schema — a real, intentional gap, now partially closed.** `customer_id`/`account_id` (4.2) are live FKs — `assignee` and `owner` are still plain `TEXT` (Keycloak usernames stand in, per the "no order-service yet" note in [docs/roadmap/1.0/platform-services.md](roadmap/1.0/platform-services.md)), and `status` is still a free-text column, rather than the normalized `statuses` FK below. That's the pragmatic MVP shape for what's left — not urgent tech debt, just documented as a conscious choice. `statuses` below is the remaining target to migrate `status` toward once there's an actual reason to (wanting FK-enforced status transitions) — not before.

## services — ✅ live

Backs the Dashboard's service grid and Admin's Services tab (see [docs/architecture/1.0/applications.md](architecture/1.0/applications.md)'s Dashboard/UI notes) — replaces the hardcoded `SERVICES` array that used to live in TaskFusion's `data/services.js`. Only the admin-editable content fields live here: icon SVGs, line-art illustrations, dark/light color tokens, `subdomain`, and `required_role` stay static in the frontend (code assets and Keycloak/nginx-provisioning concerns, not something a form should edit), keyed by the same `key`.

```sql
CREATE TABLE IF NOT EXISTS services (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key          TEXT UNIQUE NOT NULL,
  name         TEXT NOT NULL,
  tech         TEXT,
  title        TEXT,
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('online', 'basic', 'building', 'designing', 'planned')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Seeded on every boot (`ON CONFLICT (key) DO NOTHING`) with the 7 known services, so admin edits are never clobbered on restart. `GET /api/services` has no role check (the public per-subdomain "coming soon" page, `ServiceInProgressPage`, needs it while logged out); `POST`/`PUT` require `platform:admin`.

## Target normalized schema (designed, not yet migrated)

The direction `tasks` migrates toward once `customer`/`assignee`/`owner`/`status` need to be more than free text.

### accounts — ✅ live

A Customer is deliberately **not** a separate table — it's a `users` row with `account_id` set (see `users` below and `models/user.js`'s `ensureAccountForCustomer`), same identity path as every other role (PM/analyst/reviewer/admin). An earlier draft of this doc sketched a standalone `customers` table; that predated `users` existing and is superseded — `users` already covers "a login," so a second identity table for the same login would just create two rows per person.

```sql
CREATE TABLE accounts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type                TEXT NOT NULL CHECK (type IN ('company', 'individual')),
  name                TEXT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  account_manager_id  UUID REFERENCES users(id)  -- who owns this Account (6.2.5); nullable — an unowned account is a legitimate transitional state, not an error
);
```

**Individual accounts are auto-created on a customer's first order (4.2)**, not at signup — `ensureAccountForCustomer` checks `users.account_id`; if `NULL`, it creates an `individual`-type Account named after the user and links it, inside a transaction with `SELECT ... FOR UPDATE` on the `users` row so two concurrent first-orders can't create two Accounts. Company-type Accounts have no self-serve creation path yet — those are provisioned some other way (not yet designed) since a company account needs multiple customer logins attached, which is a separate, undesigned flow.

### pm_accounts — ✅ live

Many-to-many on purpose — doesn't force the still-open "one dedicated PM per account, or a pool" question either way.

```sql
CREATE TABLE pm_accounts (
  pm_id       UUID NOT NULL,
  account_id  UUID NOT NULL REFERENCES accounts(id),
  PRIMARY KEY (pm_id, account_id)
);
```

### statuses — 🟢

Deliberately `SMALLINT` PK rather than UUID — a small, fixed, non-secret set of six known states, so the usual enumeration-prevention reasoning for UUIDs doesn't apply here.

```sql
CREATE TABLE statuses (
  id          SMALLINT PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  sort_order  SMALLINT NOT NULL
);

INSERT INTO statuses (id, name, sort_order) VALUES
  (1, 'unassigned', 1),
  (2, 'analyst',    2),
  (3, 'reviewer',   3),
  (4, 'done',       4),
  (5, 'paid',       5),
  (6, 'closed',     6);
```

### users — ✅ live

`id` is the Keycloak `sub` claim directly — no separate local ID, no mapping table between the two.

```sql
CREATE TABLE users (
  id              UUID PRIMARY KEY,   -- = Keycloak `sub`
  email           TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  avatar_url      TEXT,
  active          BOOLEAN NOT NULL DEFAULT true,
  roles           TEXT[],  -- flattened platform:*/service:* claims from the JWT, e.g. {platform:project-manager, service:gofeeler}
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_synced_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  account_id      UUID REFERENCES accounts(id)  -- customers only; NULL until their first order (4.2) — see accounts above
);

CREATE INDEX idx_users_roles ON users USING GIN (roles);
```

**`roles` — stored locally, not fetched from Keycloak on demand.** Same reasoning as `tasks.tags`: a flat array beats a normalized join table for a small set of simple string claims, and the GIN index makes `roles @> ARRAY['platform:admin']`-style permission checks cheap. Refreshed on every JIT sync (below) rather than requiring a live call to Keycloak's Admin API whenever role info is needed — this is also what resolves 4.0.1's "Permissions (Keycloak) — coming soon" placeholder: once `roles` lives here, that detail-view section just reads the column instead of fetching anything.

**`active` — local flag only, per 4.0.1.** Deactivating a user here does *not* touch their Keycloak account (doesn't disable their login) — it's task-service's own bookkeeping, gating things like task-assignment eligibility. If "deactivate" should eventually also disable Keycloak login, that's a separate, deliberate integration to add later, not implied by this column.

**Sync strategy:** just-in-time upsert, run from auth middleware the first time a service sees a given user's JWT in a request — not a dedicated login-webhook service (that's a cleaner long-term approach, but a new moving part not needed yet, same "practical for now" pattern as everything else in this schema).

```sql
INSERT INTO users (id, email, name, avatar_url, roles)
VALUES (:sub, :email, :name, :avatar, :roles)
ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email, name = EXCLUDED.name,
      avatar_url = EXCLUDED.avatar_url, roles = EXCLUDED.roles, last_synced_at = now();
```

`tasks.customer_id UUID REFERENCES users(id)` (4.2) is that migration, realized — `assignee`/`owner` remain plain `TEXT` for now (they're workflow-state placeholders that change as a task moves, not a fixed identity like `customer_id`; see the `tasks` table's assignee/owner note above).

**Implemented as:** `business-services/task-service/middleware/auth.js`'s `syncUser`, mounted ahead of every `/api` route in `server.js`. Unverified claim extraction (base64url-decode the JWT's payload segment, no JWKS signature check) — same trust posture as `asset-service`'s `auth.rs`, just in Node instead of Rust (`Buffer.from(payload, 'base64url')`, no external JWT library needed). Requires `sub`, `email`, and `name` all present on the token before syncing — if any are missing the request still proceeds normally, just unsynced, since asset-service's `Claims` struct never modeled those fields and there's no other precedent in this codebase for what's guaranteed to be present. The upsert itself is fire-and-forget (errors are logged, never surfaced to the caller) — task-service still enforces no real auth, this only keeps `users` warm for when Branch 4.1's assignee picker needs real rows to query. The frontend didn't send `Authorization` on any task-service fetch before this (`GofeelerListPanel`/`TaskDetailContent`/`TaskComments` were all headerless) — added via a new `authHeaders()` helper in `services/keycloak.js`, omitted entirely (not sent as `Bearer undefined`) when there's no token yet.

**4.0.4's active-user enforcement slots in here.** Since `syncUser` already runs on every request and has the upserted row (including `active`) in hand right after the upsert, the real check is just: if `active = false` and the route isn't on an allowlist (My Profile's read endpoint, health checks), reject with 403 rather than letting the request continue unsynced-but-permitted like the missing-claims case above. This turns the scrim from a UI-only affordance into an actual boundary — no separate mechanism needed, just an additional branch in code that already runs first on every call.

### projects — ✅ live

Sits between Account and Order/Task — an Account has many Projects (an ongoing engagement, e.g. "Acme's Q3 Sentiment Monitoring"), and a Project groups many Orders/Tasks under one responsible user. Can reference `users(id)` as a real FK from the start, since `users` is already live — unlike `tasks.assignee`/`owner`, which are still `TEXT` placeholders.

**A Project is also the contract unit** (see [docs/business/1.0/overview.md](business/1.0/overview.md)) — not a separate `contracts` table. `payment_terms` is the first concrete field this implies; more will follow once [docs/business/1.0/overview.md](business/1.0/overview.md)'s open questions (enforcement location, renegotiation/versioning) are settled.

```sql
CREATE TABLE projects (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id            UUID NOT NULL REFERENCES accounts(id),
  name                  TEXT NOT NULL,
  responsible_user_id   UUID REFERENCES users(id),  -- any role — PM, senior analyst, etc., not locked to PM
  payment_terms         TEXT,  -- e.g. 'upfront', 'net_30' — nullable until docs/business/1.0/overview.md's payment-timing question is settled
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  status                TEXT NOT NULL DEFAULT 'active',  -- 'dormant' (pending account-manager approval) -> 'active' -> 'inactive'
  no_index              BOOLEAN NOT NULL DEFAULT false  -- starting value for tasks created under this Project (6.3.1) — never a live cascade onto existing tasks
);
```

### tasks (target shape) — remaining work 🟢

```sql
-- customer_id/account_id/project_id are done (4.0.2, 4.2) — see the
-- live `tasks` schema above. What's left:
--   assignee  TEXT       → assignee_id UUID REFERENCES users(id)
--   owner     TEXT       → owner_id    UUID REFERENCES users(id)
--   status    TEXT       → status_id   SMALLINT REFERENCES statuses(id)
-- title, due_date, context, tags, created_at stay as-is
```

## task_comments — ✅ live

```sql
CREATE TABLE task_comments (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),  -- unique per row/version
  comment_id         UUID NOT NULL,                                -- stable across edits of "the same" comment — equals the id of its v1 row
  parent_comment_id  UUID,                                         -- NULL = top-level thread; set = a reply, references the parent thread's comment_id
  task_id            UUID NOT NULL REFERENCES tasks(id),
  author             TEXT NOT NULL,       -- matches tasks.assignee/owner being plain TEXT for now — task_comments predates 4.2's customer_id migration and hasn't been revisited
  visibility         TEXT NOT NULL DEFAULT 'internal' CHECK (visibility IN ('internal', 'customer')),
  version            INT NOT NULL DEFAULT 1,
  content            TEXT NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_task_comments_task   ON task_comments (task_id, created_at);
CREATE INDEX idx_task_comments_thread ON task_comments (comment_id, version);
CREATE INDEX idx_task_comments_parent ON task_comments (parent_comment_id);
```

**Why `comment_id` exists separately from `id`:** every edit is a brand-new row (never an `UPDATE`), which is what makes this genuinely versioned rather than just mutable text with a counter. But that means `id` alone can't answer "show me every version of this one comment" — `comment_id` is the stable thread identity that all versions of the same comment share; `id` is just that specific row's own identity. The first version of a comment sets `comment_id = id`; every subsequent edit copies that same `comment_id` forward with `version` incremented.

**One level of replies only:** `parent_comment_id` points at a *thread* (`comment_id`), not at a specific row/version — a reply stays attached to "the comment" across all its edits, same as everything else here being versioned by thread rather than by row. A reply can't itself be replied to: `parent_comment_id` is only ever valid on a row whose *target* thread has `parent_comment_id IS NULL`. There's no clean single-table CHECK constraint for "my parent's parent is NULL" (that needs a self-join), so this is enforced application-side, not in the schema — same pragmatic posture as the rest of this table.

**Internal comments vs. customer-facing notes — one table, split by `visibility`:** not two tables, because the shape (threading, versioning) is identical — only who can see it differs. `internal` is the PM/analyst/reviewer working discussion (never shown to the customer). `customer` is a note written *to* the customer — the customer can see it, and can reply to it (still bound by the one-level rule above: a customer's reply is itself a new top-level-shaped row with `parent_comment_id` set, and that reply cannot be further replied to).

Two rules enforced application-side (not as table constraints, same reasoning as the one-level rule):
- **Visibility inheritance:** a reply's `visibility` must equal its parent thread's `visibility` — no flipping a reply to `internal` underneath a `customer` note or vice versa.
- **Ownership check:** a customer can only reply on a `customer`-visibility thread belonging to a task they actually own (`task.customer_id`/`task.owner` matches their identity) — never on `internal` threads, and never on another customer's task.

Staff (PM/analyst/reviewer) see both visibilities; a customer's view is filtered to `visibility = 'customer'` only.

**Getting the current view** (latest version of every thread — both top-level comments and replies — on a task, nested one level by the caller):
```sql
SELECT DISTINCT ON (comment_id) *
FROM task_comments
WHERE task_id = :task_id
ORDER BY comment_id, version DESC;
```
The caller groups the flat result: rows with `parent_comment_id IS NULL` are top-level; every other row nests under the row whose `comment_id` matches its `parent_comment_id`.

Older versions aren't deleted — they're just not what this query returns, which is the whole point of the audit trail this table exists to provide.

---

# rustledger database

**PostgreSQL** — `${POSTGRES_DB}` on `microverse-postgis` (shared instance with `task-service`/`springpix`, by decision), own `rustledger` schema namespace

Two tables, two different flows — analyst payout (existing) and customer billing (Branch 9), not opposite sides of the same one (see [docs/business/1.0/overview.md](business/1.0/overview.md)'s Payouts section on why):

- `line_items` — one row per completed elixtempo tracked-work session, consumed off `elixtempo.sessions`' `session.stopped` events (`id`, `session_id` UNIQUE, `analyst_id`, `quest_id`, `elapsed_seconds`, `rate_cents_per_hour`, `amount_cents`, `currency`, `created_at`). Flat rate from `DEFAULT_HOURLY_RATE_CENTS`/`DEFAULT_CURRENCY` env vars — real per-analyst/contract rates are a follow-up. This is payout-basis groundwork only; there's no Stripe Connect disbursement yet, and no PM payout equivalent — both remain the open question flagged in Branch 9.
- `bills` (Branch 9) — one row per customer bill, one bill per `task_id` (`UNIQUE`): `id`, `task_id`, `customer_id`, `amount_cents`, `currency`, `status` (`unpaid`/`paid`), `stripe_checkout_session_id`, `stripe_payment_intent_id`, `created_at`, `paid_at`. `task_id`/`customer_id` are cross-service references (task-service's `tasks.id`/`tasks.customer_id`), not FK-enforced — same posture as `audit_log.task_id`. Amount is entered manually by the PM at bill-creation time; no price/rate field exists on `tasks`/`projects` to compute it from.

rustledger owns Stripe collection directly — Checkout Session creation and webhook verification (`async-stripe` crate) live in `domain-services/rustledger/src/stripe_client.rs`, alongside the ledger itself. An earlier iteration split that into a separate stateless `platform-services/billing-service` Node middleware in front of rustledger; folded back in since rustledger already owned the billing domain by name and by `line_items`. The original "Python (Stripe SDK)" spec for a standalone billing-service in [docs/architecture/1.0/platform-services.md](architecture/1.0/platform-services.md) no longer applies — that row has been removed, there is no billing-service anymore.

---

# springpix database

**PostgreSQL + PostGIS** — `${POSTGRES_DB}` on `microverse-postgis` (shared instance with `task-service`/`rustledger`, by decision)

Not yet designed. Will hold raster hotspot-detection results as spatial data (`geometry`/`geography` columns) — this is the actual reason `microverse-postgis` runs the PostGIS extension in the first place. Worth designing alongside SpringPix's Branch 1 equivalent once that work starts, rather than guessing at spatial column shapes ahead of the real analysis pipeline.

---

# gofeeler database

**MongoDB** — db name `gofeeler`, on `microverse-mongodb`

Raw uploaded content (chat/email/comment exports) plus sentiment analysis results — shape varies too much per source to fit relational columns.

**`sentiment_results` collection — ✅ live (Branch 5):**
```
{
  task_id,             -- REFERENCES task-service's tasks.id (UUID, cross-database reference, not enforced by an FK)
  engine_used,          -- "basic" | "advanced"
  template_id,          -- Postgres sentiment_prompt_templates.id, null for basic engine
  template_name,         -- denormalized at write time — templates can be renamed later; this captures the name as-used
  llm_provider,          -- null for basic engine
  model_version,         -- null for basic engine
  raw_content,           -- the uploaded chat/email/comment text analyzed
  result,               -- { sentiment, confidence }
  analyzed_at
}
```
Uniform shape across both engines (LLM fields simply absent for `basic`, via `omitempty` — not written as an explicit `null` — rather than two different event shapes) — keeps downstream consumers (Djaboard) from branching on engine type. Written fire-and-forget from `/analyze` only when the request carries an optional `taskId`; a request without one still gets analyzed, it's just not persisted. These same four traceability fields (`engine_used`, `template_id`, `llm_provider`, `model_version`) are expected to flow into Djaboard's reporting schema once that's designed — see [docs/roadmap/1.0/domain-services.md](roadmap/1.0/domain-services.md)'s Branch 5.

## sentiment_prompt_templates — ✅ live (Branch 5)

**PostgreSQL** — same instance as `task-service`/`rustledger` (`microverse-postgis`), own `gofeeler` schema namespace (not `public`) — this is structured, relational, and shared across analysts, unlike the per-analysis results above.

```
gofeeler.sentiment_prompt_templates:
id, name, prompt_body, created_by (REFERENCES public.users(id)), is_system_default BOOLEAN, created_at
```

Shared pool, visible to every analyst; any analyst can create or edit (self-service — blast radius is contained to their own analyses, no gating), reachable via `GET`/`POST /templates` and `PATCH /templates/:id`. Edit is a partial update (only `name`/`promptBody` fields present in the request change) and applies to `is_system_default` rows too, same trust posture as create. System ships a small preconfigured set with `is_system_default = true`, seeded idempotently on service boot. Distinct from `intelligence/prompts` ([docs/architecture/2.0/intelligence.md](architecture/2.0/intelligence.md)), which is version-controlled, dev-curated text for agent reasoning prompts — same word, different mechanism and audience.

---

# search-service database

**Elasticsearch** — index `tags`

```
{ name, created_at, usage_count }  -- one document per sentiment tag
```

`name.keyword` (lowercase-normalized) is used for exact upsert/lookup; the analyzed `name` field is for fuzzy/prefix suggestion matching only — see [docs/roadmap/1.0/domain-services.md](roadmap/1.0/domain-services.md)'s "Implemented as" note for the real `match_bool_prefix` + fuzzy `match` query shape (`fuzziness: AUTO` alone wasn't enough for early-keystroke matching). See `task-service`'s `tasks.tags` above for how this vocabulary relates to what actually gets stored on a task.

## tasks-\<service\> — 🟢 template live, unpopulated (Branch 6.1)

**Elasticsearch** — index template `tasks-template`, pattern `tasks-*`. One index per service (`tasks-gofeeler`, etc.) rather than one flat `tasks` index — see [docs/roadmap/1.0/domain-services.md](roadmap/1.0/domain-services.md)'s "Task search index" proposal for why: service-scope becomes index routing, not a query-time filter. The template governs any matching index lazily — a new service's first task write creates a correctly-mapped index with no manual per-service setup.

```
{
  title, context,                                              -- analyzed (text) — the query targets
  status, tags, owner, customer_id, account_id, project_id,    -- keyword — filter/narrowing only
  assignee_ids,                                                -- keyword[] — kept for future "my tasks" narrowing, not required for base access
  created_at, assigned_at                                      -- date
}
```

Doc `_id = task_id` (REFERENCES `task-service`'s `tasks.id`, cross-service reference, not enforced by an FK — same posture as `gofeeler.sentiment_results.task_id` above), so future lifecycle-driven writes (Branch 6.2) are idempotent upserts, not append-only. No `service` field — implicit in which index a document lives in. Template exists and is documented; nothing writes to it yet — that's Branch 6.2's job.

---

# asset-service / MinIO

**Object storage** — no schema, one shared bucket

Object keys only: `{service}/{account_id}/{order_id}/{version}/{filename}`. No dedicated Postgres metadata table (stateless-first — see [docs/roadmap/1.0/platform-services.md](roadmap/1.0/platform-services.md) Proposals); relies on MinIO's native `ListObjects` prefix listing and custom object metadata headers instead.

---

# notification-service database

**PostgreSQL** — same shared instance as `task-service`/`rustledger`/`springpix` (`microverse-postgis`), by the same decision noted at the top of this file.

## notifications — ✅ live (Branch 7)

```sql
CREATE TABLE notifications (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email  TEXT NOT NULL,
  type             TEXT NOT NULL,   -- 'task.created' | 'task.assigned'
  task_id          UUID NOT NULL,   -- REFERENCES task-service's tasks.id, cross-service, not FK-enforced
  message          TEXT NOT NULL,
  read             BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Keyed by `recipient_email`, not a `users.id` FK — matches `task-service.tasks.assignee`'s own "Keycloak usernames stand in" MVP posture, and lets both the WebSocket handshake and the REST reads key off the same unverified JWT `email` claim without notification-service needing a `users` lookup of its own for the common case. See [docs/roadmap/1.0/domain-services.md](roadmap/1.0/domain-services.md)'s Branch 7 for how rows get created (a second Kafka consumer group on `task-service.tasks`) and read (`GET`/`PATCH /notifications`, both scoped to the caller's own `recipient_email`).

---

# audit-service database

**PostgreSQL** — same shared instance as `task-service`/`notification-service` (`microverse-postgis`).

## audit_log — ✅ live (Branch 8)

```sql
CREATE TABLE audit_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id      UUID NOT NULL,   -- task-service tasks.id, cross-service, not FK-enforced
  service      TEXT NOT NULL,   -- 'gofeeler' only for this PoC
  event        TEXT NOT NULL,   -- 'task.created' | ... | 'task.no-index-changed' | 'sentiment.analyzed'
  status       TEXT,            -- task status after this event; null for sentiment.analyzed
  owner        TEXT,
  assignee     TEXT,
  duration_ms  INTEGER,         -- sentiment.analyzed only
  occurred_at  TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

A third independent Kafka consumer group (`audit-service-events`) on `task-service`'s existing `task-service.tasks` topic — standard fan-out, same as notification-service's own addition in Branch 7, no change needed to that topic's other consumers. Every row is written verbatim off whichever event arrives, with no diffing against a "previous" row and no extra state lookup: the event name already encodes the transition semantics (`task.assigned` is always `unassigned`→`analyst`, etc — see `task-service`'s `kafka-producer.js`), and each event already carries its own post-transition `status`/`owner`/`assignee_ids` (full snapshot). "Time-in-status" and "how fast an analyst reacts to a new assignment" are both derived at query time via `LEAD()` window functions over consecutive rows per `task_id`, not stored — the roadmap's own framing, "audit trail is built from this stream, not a separate write path."

`sentiment.analyzed` — GoFeeler's own new event, published from a Kafka producer added directly to GoFeeler's Go backend (`domain-services/gofeeler/app/events/kafka.go`) — deliberately lands on a **separate** topic, `gofeeler.sentiment`, not `task-service.tasks`: `search-service`'s indexing consumer treats every message on that topic as a full task-state upsert with no event-name filtering (Branch 6.2), and a `sentiment.analyzed` payload (`task_id`/`sentiment`/`confidence`/`engine_used`/`duration_ms`/`analyzed_at`) shares none of `taskToEvent`'s fields — landing it there would blank real Elasticsearch documents on the next re-index. `audit-service` subscribes to both topics from the same consumer group, dispatching on Kafka's `topic` field per message. `duration_ms` is GoFeeler's own processing-time efficiency metric, measured at the source (wrapping the existing `eng.Analyze` call) rather than inferred later from two separate events — this is also how Branch 8's open question ("does the analyze step need its own persisted task status?") got resolved: no, the frontend's loading state stays UI-only, and the real timing lives on this event instead.

`GET /audit/events` (recent activity feed, newest first, `?limit=`), `GET /audit/tasks/:taskId` (timeline), `GET /audit/metrics/processing-time`, `GET /audit/metrics/reaction-time` — all gated `platform:admin` OR `platform:project-manager` (see roadmap's 4.3 resolution, which already earmarked the eventual audit log as Admin's cross-account visibility tool). Backend shipped first as an explicit documented gap (no frontend); the gap is now closed by `AdminAuditLogPage.js`, filling in the `/admin/audit-log` Subnav tab [nav-config.json](architecture/1.0/nav-config.json) already reserved for it — metric cards (processing/reaction time) above a list+detail `SplitView` (`/audit/events` list, drilling into `/audit/tasks/:taskId`'s timeline on click). See [docs/roadmap/1.0/domain-services.md](roadmap/1.0/domain-services.md)'s Branch 8 and its Proposals entry.
