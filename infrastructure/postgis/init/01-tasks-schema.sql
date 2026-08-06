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
