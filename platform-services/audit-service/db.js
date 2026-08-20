// platform-services/audit-service/db.js
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://localhost:5432/microverse',
});

// Branch 8 — every row here is written verbatim off the Kafka stream (see
// events/kafka-consumer.js), no diffing against a "previous" row: the
// event name already encodes the transition semantics (task.assigned is
// always unassigned->analyst, etc — see kafka-producer.js's event table in
// task-service), and each event already carries its own post-transition
// status/owner/assignee (or, for sentiment.analyzed, its own complete
// result). task_id is a plain UUID, cross-service reference to
// task-service's tasks.id, not FK-enforced — same posture as
// notification-service's notifications table.
async function ensureSchema() {
  await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      task_id UUID NOT NULL,
      service TEXT NOT NULL,
      event TEXT NOT NULL,
      status TEXT,
      owner TEXT,
      assignee TEXT,
      duration_ms INTEGER,
      occurred_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS audit_log_task_idx ON audit_log (task_id, occurred_at);');
  await pool.query('CREATE INDEX IF NOT EXISTS audit_log_event_idx ON audit_log (event, occurred_at);');
}

module.exports = { pool, ensureSchema };
