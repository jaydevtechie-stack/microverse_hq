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
}

module.exports = { pool, ensureSchema };
