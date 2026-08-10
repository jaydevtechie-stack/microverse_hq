-- Mirrors business-services/task-service/db.js's ensureSchema() —
-- kept in both places on purpose. This runs once, automatically, only
-- on a brand-new postgres_data volume (docker-entrypoint-initdb.d);
-- db.js's version is the defensive fallback for any environment that
-- skips this init script (e.g. a managed Postgres later on).
--
-- id is UUID (gen_random_uuid(), via pgcrypto — not time-ordered v7,
-- there's no built-in generator for that in plain Postgres yet), per
-- ARCHITECTURE.md's ID convention: prevents enumeration, lets services
-- generate IDs independently without coordination.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unassigned',
  assignee TEXT,
  owner TEXT,
  due_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Separate table, not JSON on tasks — every edit is a new row sharing
-- the same comment_id (never an UPDATE), making this an audit trail
-- rather than mutable text. parent_comment_id is NULL for a top-level
-- comment; when set, it points at another row's comment_id (a thread,
-- not a specific version) and marks this as a reply. One level only —
-- see SCHEMA.md's task_comments for why that's enforced application-side
-- rather than as a CHECK constraint.
--
-- visibility splits internal staff discussion from customer-facing
-- notes the customer can see and reply to — one table, not two, since
-- the shape (threading, versioning) is identical. Visibility
-- inheritance and the customer ownership check are application-side
-- too, same reasoning as the one-level rule.
CREATE TABLE IF NOT EXISTS task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL,
  parent_comment_id UUID,
  task_id UUID NOT NULL REFERENCES tasks(id),
  author TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'internal' CHECK (visibility IN ('internal', 'customer')),
  version INT NOT NULL DEFAULT 1,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments (task_id, created_at);
CREATE INDEX IF NOT EXISTS idx_task_comments_thread ON task_comments (comment_id, version);
CREATE INDEX IF NOT EXISTS idx_task_comments_parent ON task_comments (parent_comment_id);

-- id is the Keycloak `sub` claim directly — no separate local ID, no
-- mapping table between the two (see SCHEMA.md's users). Populated via
-- JIT upsert the first time task-service sees a given user's JWT, not
-- a login webhook. active is task-service's own bookkeeping (never
-- touches Keycloak login); roles is synced from the JWT for display
-- only (Admin Users page), never consulted for access control.
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  avatar_url TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  roles TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Company or individual — every Customer belongs to exactly one,
-- always (see ARCHITECTURE.md's Entity model). There is deliberately
-- no separate `customers` table — a Customer is just a `users` row
-- with `account_id` set (see the `account_id` ALTER below).
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('company', 'individual')),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Many-to-many on purpose — the ownership half of the Project Hub's
-- two-independent-checks access rule (see ARCHITECTURE.md's Roles and
-- permissions): which Accounts a PM can see at all, separate from
-- which task types (service scope) they can act on once inside one.
CREATE TABLE IF NOT EXISTS pm_accounts (
  pm_id UUID NOT NULL REFERENCES users(id),
  account_id UUID NOT NULL REFERENCES accounts(id),
  PRIMARY KEY (pm_id, account_id)
);

-- Sits between Account and Order/Task — also the contract unit (see
-- BUSINESS.md), so payment_terms lives here rather than a separate
-- contracts table.
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id),
  name TEXT NOT NULL,
  responsible_user_id UUID REFERENCES users(id),
  payment_terms TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Additive, nullable — lets the Project Hub's detail view show real
-- linked Tasks without pulling in the fuller target-shape migration
-- (customer_id/account_id/assignee_id/owner_id/status_id) that
-- SCHEMA.md documents as still future work.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id);

-- Set when 4.1's PATCH /tasks/:id assigns an analyst — the minimal
-- timestamp Scout's v1 availability signal needs (4.1.1). Not a real
-- response-time measurement (needs a first-action or completed-at
-- timestamp, neither of which exist) — see models/scout.js.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;

-- A customer is a users row (see the accounts comment above) —
-- account_id is set on their first order, not at sync time; NULL
-- means "hasn't ordered yet, no Account exists for them." See
-- models/user.js's ensureAccountForCustomer.
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id);

-- customer_id: who originally submitted the order, fixed for its
-- lifetime — distinct from assignee/owner, which are workflow-state
-- TEXT that changes as the task moves (see ARCHITECTURE.md's
-- assignee/owner table). account_id is a denormalized copy of the
-- customer's users.account_id at creation time, feeding the MinIO
-- key's account segment. context/tags are the order's free-text
-- description and sentiment tags, entered on the Create Order form.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES users(id);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS context TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS tags TEXT[];
CREATE INDEX IF NOT EXISTS idx_tasks_tags ON tasks USING GIN (tags);

-- Backs the Dashboard's service grid and Admin's Services tab. Icon/
-- illustration/color theme and subdomain/required_role stay frontend-
-- only static config — this table owns only the admin-editable content
-- fields. Seed rows are inserted by db.js's ensureSchema() (always runs
-- on boot), not here — DDL only, per this file's header note.
CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  tech TEXT,
  title TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('online', 'basic', 'building', 'designing', 'planned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
