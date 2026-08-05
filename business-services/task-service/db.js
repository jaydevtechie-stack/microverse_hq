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
  await pool.query(`
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
  `);
}

module.exports = { pool, ensureSchema };
