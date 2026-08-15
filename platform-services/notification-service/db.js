// platform-services/notification-service/db.js
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://localhost:5432/microverse',
});

// Branch 7 — durable notification history, not just a live WebSocket
// push, so the bell can show real unread state on page load. Keyed by
// recipient_email rather than a user id FK, matching task-service's own
// "assignee is a single email column, Keycloak usernames stand in" MVP
// posture (kafka-producer.js's taskToEvent) — lets both the socket auth
// and the REST reads key off the same JWT claim without a users lookup
// of our own.
async function ensureSchema() {
  await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      recipient_email TEXT NOT NULL,
      type TEXT NOT NULL,
      task_id UUID NOT NULL,
      message TEXT NOT NULL,
      read BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(
    'CREATE INDEX IF NOT EXISTS notifications_recipient_idx ON notifications (recipient_email, created_at DESC);'
  );
}

module.exports = { pool, ensureSchema };
