# Microverse — database schema

The actual table/collection/index definitions, consolidated in one place so any service (or agent) can refer to the current design without hunting through ARCHITECTURE.md/ROADMAP.md prose. See those docs for the *reasoning* behind each decision — this file is just the shape.

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
  customer     TEXT,
  context      TEXT,
  tags         TEXT[]
);

CREATE INDEX IF NOT EXISTS idx_tasks_tags ON tasks USING GIN (tags);
```

**Tags — reconciled with the Elasticsearch `tags` index (search-service):** the two stores do different jobs, on purpose. Elasticsearch's `tags` index is the shared *vocabulary* — what exists, fuzzy-matched for autocomplete while someone's typing. `tasks.tags` stores which tag *names* are actually applied to this specific task — plain strings in a Postgres array, not a join table. A handful of short tag names per task doesn't need its own relational identity the way `task_comments` does; storing the name directly (not a numeric tag ID) also matches how ES already treats tag identity via `name.keyword` — the tag *is* its name, there's no separate ID anywhere in the design that Postgres would need to reference. The GIN index makes `tags @> ARRAY['Negative']`-style lookups cheap once you want "show me every task tagged Urgency."

**Current vs. target schema — a real, intentional gap:** this live table uses plain `TEXT` for `customer`, `assignee`, and `owner` (Keycloak usernames stand in, per the "no order-service yet" note in ROADMAP.md) and a free-text `status` column, rather than the normalized FKs below. That's the pragmatic MVP shape while account/customer data doesn't exist as real rows yet — not urgent tech debt, just documented as a conscious choice. The tables below are the target to migrate `tasks` toward once there's an actual reason to (real account-level billing, or wanting FK-enforced status transitions) — not before.

## Target normalized schema (designed, not yet migrated)

The direction `tasks` migrates toward once `customer`/`assignee`/`owner`/`status` need to be more than free text.

### accounts — 🟢

```sql
CREATE TABLE accounts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT NOT NULL CHECK (type IN ('company', 'individual')),
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### customers — 🟢

```sql
CREATE TABLE customers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  UUID NOT NULL REFERENCES accounts(id),
  email       TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### pm_accounts — 🟢

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
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_synced_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Sync strategy:** just-in-time upsert, run from auth middleware the first time a service sees a given user's JWT in a request — not a dedicated login-webhook service (that's a cleaner long-term approach, but a new moving part not needed yet, same "practical for now" pattern as everything else in this schema).

```sql
INSERT INTO users (id, email, name, avatar_url)
VALUES (:sub, :email, :name, :avatar)
ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email, name = EXCLUDED.name,
      avatar_url = EXCLUDED.avatar_url, last_synced_at = now();
```

Once this exists, `tasks.assignee`/`owner`/`customer` (currently plain `TEXT`) are the natural next fields to migrate to `UUID REFERENCES users(id)` — not required for Branch 4.1 itself, but the obvious next step once real user rows exist.

**Implemented as:** `business-services/task-service/middleware/auth.js`'s `syncUser`, mounted ahead of every `/api` route in `server.js`. Unverified claim extraction (base64url-decode the JWT's payload segment, no JWKS signature check) — same trust posture as `asset-service`'s `auth.rs`, just in Node instead of Rust (`Buffer.from(payload, 'base64url')`, no external JWT library needed). Requires `sub`, `email`, and `name` all present on the token before syncing — if any are missing the request still proceeds normally, just unsynced, since asset-service's `Claims` struct never modeled those fields and there's no other precedent in this codebase for what's guaranteed to be present. The upsert itself is fire-and-forget (errors are logged, never surfaced to the caller) — task-service still enforces no real auth, this only keeps `users` warm for when Branch 4.1's assignee picker needs real rows to query. The frontend didn't send `Authorization` on any task-service fetch before this (`GofeelerListPanel`/`TaskDetailContent`/`TaskComments` were all headerless) — added via a new `authHeaders()` helper in `services/keycloak.js`, omitted entirely (not sent as `Bearer undefined`) when there's no token yet.

### tasks (target shape) — 🟢

```sql
-- once accounts/customers/statuses exist, tasks migrates to:
--   customer  TEXT       → customer_id UUID REFERENCES customers(id)
--   (new)                → account_id  UUID REFERENCES accounts(id)  -- denormalized, feeds the MinIO key
--   assignee  TEXT       → assignee_id UUID
--   owner     TEXT       → owner_id    UUID
--   status    TEXT       → status_id   SMALLINT REFERENCES statuses(id)
-- title, due_date, context, tags, created_at stay as-is
```

## task_comments — 🟢 designed, not yet migrated

```sql
CREATE TABLE task_comments (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),  -- unique per row/version
  comment_id         UUID NOT NULL,                                -- stable across edits of "the same" comment — equals the id of its v1 row
  parent_comment_id  UUID,                                         -- NULL = top-level thread; set = a reply, references the parent thread's comment_id
  task_id            UUID NOT NULL REFERENCES tasks(id),
  author             TEXT NOT NULL,       -- matches tasks.assignee/owner/customer being plain TEXT for now, not a FK to a users table that doesn't exist yet
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
- **Ownership check:** a customer can only reply on a `customer`-visibility thread belonging to a task they actually own (`task.customer`/`task.owner` matches their identity) — never on `internal` threads, and never on another customer's task.

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

**PostgreSQL** — `${POSTGRES_DB}` on `microverse-postgis` (shared instance with `task-service`/`springpix`, by decision)

Not yet designed. Will need at minimum an `invoices` table and a way to consume elixtempo's `time_entry.completed` events off the Kafka scroll — see ARCHITECTURE.md's Kafka vs RabbitMQ section.

---

# springpix database

**PostgreSQL + PostGIS** — `${POSTGRES_DB}` on `microverse-postgis` (shared instance with `task-service`/`rustledger`, by decision)

Not yet designed. Will hold raster hotspot-detection results as spatial data (`geometry`/`geography` columns) — this is the actual reason `microverse-postgis` runs the PostGIS extension in the first place. Worth designing alongside SpringPix's Branch 1 equivalent once that work starts, rather than guessing at spatial column shapes ahead of the real analysis pipeline.

---

# gofeeler database

**MongoDB** — db name `gofeeler`, on `microverse-mongodb`

Raw uploaded content (chat/email/comment exports) plus sentiment analysis results — shape varies too much per source to fit relational columns. No fixed collection schema documented yet; worth adding one here once Branch 5 (LLM integration) settles what a stored result actually looks like.

---

# search-service database

**Elasticsearch** — index `tags`

```
{ name, created_at, usage_count }  -- one document per sentiment tag
```

`name.keyword` (lowercase-normalized) is used for exact upsert/lookup; the analyzed `name` field is for fuzzy/prefix suggestion matching only — see ROADMAP.md's "Implemented as" note for the real `match_bool_prefix` + fuzzy `match` query shape (`fuzziness: AUTO` alone wasn't enough for early-keystroke matching). See `task-service`'s `tasks.tags` above for how this vocabulary relates to what actually gets stored on a task.

---

# asset-service / MinIO

**Object storage** — no schema, one shared bucket

Object keys only: `{service}/{account_id}/{order_id}/{version}/{filename}`. No dedicated Postgres metadata table (stateless-first — see ROADMAP.md Proposals); relies on MinIO's native `ListObjects` prefix listing and custom object metadata headers instead.
