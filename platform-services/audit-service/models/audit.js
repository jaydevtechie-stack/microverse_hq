// platform-services/audit-service/models/audit.js
const { pool } = require('../db');

// Recent activity feed for the Admin audit-log page — newest first,
// capped the same way notification-service's /notifications caps its
// popup list (a browse view, not a paginated history).
async function recentEvents(limit = 50) {
  const { rows } = await pool.query(
    `SELECT task_id, service, event, status, owner, assignee, duration_ms, occurred_at
     FROM audit_log ORDER BY occurred_at DESC LIMIT $1`,
    [limit]
  );
  return rows;
}

async function insertEvent({ taskId, service, event, status, owner, assignee, durationMs, occurredAt }) {
  const { rows } = await pool.query(
    `INSERT INTO audit_log (task_id, service, event, status, owner, assignee, duration_ms, occurred_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [taskId, service, event, status, owner, assignee, durationMs, occurredAt]
  );
  return rows[0];
}

// Time-in-status derived at query time via LEAD, not stored — the roadmap's
// "audit trail is built from this stream, not a separate write path".
async function timelineForTask(taskId) {
  const { rows } = await pool.query(
    `SELECT event, status, owner, assignee, duration_ms, occurred_at,
       LEAD(occurred_at) OVER (ORDER BY occurred_at) - occurred_at AS time_in_status
     FROM audit_log WHERE task_id = $1 ORDER BY occurred_at`,
    [taskId]
  );
  return rows;
}

// GoFeeler's own /analyze processing time — measured at the source (see
// gofeeler's events/kafka.go) and just aggregated here.
async function processingTimeMetrics({ from, to }) {
  const { rows } = await pool.query(
    `SELECT avg(duration_ms) AS avg_ms,
       percentile_cont(0.5) WITHIN GROUP (ORDER BY duration_ms) AS p50_ms,
       percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95_ms,
       count(*)::int AS sample_size
     FROM audit_log WHERE event = 'sentiment.analyzed' AND occurred_at BETWEEN $1 AND $2`,
    [from, to]
  );
  return rows[0];
}

// How fast an analyst reacts to a new assignment — the gap between a
// task.assigned row and whatever lifecycle event happens next on that
// same task (move-to-review, in the common case).
async function reactionTimeMetrics({ from, to }) {
  const { rows } = await pool.query(
    `SELECT avg(next_occurred_at - occurred_at) AS avg_reaction,
       percentile_cont(0.5) WITHIN GROUP (ORDER BY (next_occurred_at - occurred_at)) AS p50_reaction,
       count(*)::int AS sample_size
     FROM (
       SELECT task_id, event, occurred_at,
         LEAD(occurred_at) OVER (PARTITION BY task_id ORDER BY occurred_at) AS next_occurred_at
       FROM audit_log
     ) t
     WHERE event = 'task.assigned' AND next_occurred_at IS NOT NULL
       AND occurred_at BETWEEN $1 AND $2`,
    [from, to]
  );
  return rows[0];
}

module.exports = { insertEvent, recentEvents, timelineForTask, processingTimeMetrics, reactionTimeMetrics };
