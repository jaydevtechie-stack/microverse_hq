// business-services/task-service/db.js
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://localhost:5432/microverse',
});

// Status mirrors ARCHITECTURE.md's task workflow:
// unassigned -> analyst -> reviewer -> done -> paid -> closed (with
// reviewer -> analyst on rejection). `service` ties a task to the
// domain service (and matching Keycloak role) it belongs to, e.g.
// 'gofeeler' — that's the filter a PM's role list gets checked against.
async function ensureSchema() {
  // gen_random_uuid() needs pgcrypto — not built into core until PG13,
  // and even then this stays explicit rather than assuming the image
  // has it. Random (v4), not time-ordered (v7): ARCHITECTURE.md's ID
  // convention prefers v7 to avoid B-tree fragmentation on inserts,
  // but there's no built-in v7 generator in plain Postgres yet, and
  // pgcrypto's gen_random_uuid() is the documented fallback.
  await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');
  await pool.query(`
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
  `);

  // Separate table, not JSON on tasks — every edit is a new row sharing
  // the same comment_id (never an UPDATE), which is what makes this an
  // audit trail rather than just mutable text. parent_comment_id is
  // NULL for a top-level comment; when set, it points at another row's
  // comment_id (a thread, not a specific version) and marks this as a
  // reply. One level only — see SCHEMA.md's task_comments for why that
  // can't be a CHECK constraint and is enforced application-side.
  //
  // visibility splits internal staff discussion ('internal') from
  // customer-facing notes the customer can see and reply to
  // ('customer') — one table, not two, since the shape is identical
  // and only who can see it differs. Visibility inheritance (a reply
  // matches its parent's visibility) and the customer ownership check
  // are both application-side too, same reasoning as one-level replies.
  await pool.query(`
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
  `);
  // Idempotent fallback for a task_comments table that already existed
  // without visibility (e.g. mid-session dev environments) — matches
  // the ALTER TABLE ... ADD COLUMN IF NOT EXISTS pattern used elsewhere.
  await pool.query(`
    ALTER TABLE task_comments
      ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'internal';
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments (task_id, created_at);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_task_comments_thread ON task_comments (comment_id, version);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_task_comments_parent ON task_comments (parent_comment_id);');

  // id is the Keycloak `sub` claim directly — no separate local ID, no
  // mapping table between the two (see SCHEMA.md's users). Populated
  // via JIT upsert (models/user.js's upsertFromClaims) the first time
  // task-service sees a given user's JWT, not a login webhook.
  //
  // active is task-service's own bookkeeping (task-assignment
  // eligibility) — deactivating here never touches Keycloak login, see
  // SCHEMA.md. roles is synced from the JWT's realm_access.roles on
  // every JIT upsert, purely for display (Admin Users page's role
  // chips) — it is never consulted for an actual access-control
  // decision, which always reads the live JWT instead.
  await pool.query(`
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
  `);
  // Idempotent fallback for a users table that already existed without
  // these columns (mid-session dev environments).
  await pool.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS roles TEXT[] NOT NULL DEFAULT '{}';
  `);
}

module.exports = { pool, ensureSchema };
