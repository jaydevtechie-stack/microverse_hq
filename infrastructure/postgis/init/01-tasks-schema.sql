-- Mirrors business-services/task-service/db.js's ensureSchema() —
-- kept in both places on purpose. This runs once, automatically, only
-- on a brand-new postgres_data volume (docker-entrypoint-initdb.d);
-- db.js's version is the defensive fallback for any environment that
-- skips this init script (e.g. a managed Postgres later on).
CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  service TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unassigned',
  assignee TEXT,
  owner TEXT,
  due_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
