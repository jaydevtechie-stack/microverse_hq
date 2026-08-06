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
