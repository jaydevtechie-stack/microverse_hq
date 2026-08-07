// business-services/task-service/models/task.js
const { pool } = require('../db');

async function findByService(service) {
  const { rows } = await pool.query(
    'SELECT * FROM tasks WHERE service = $1 ORDER BY created_at DESC',
    [service]
  );
  return rows;
}

async function findById(id) {
  const { rows } = await pool.query('SELECT * FROM tasks WHERE id = $1', [id]);
  return rows[0] || null;
}

// unassigned -> analyst, real PM assignment (4.1) — not the pool-claim
// query from ARCHITECTURE.md's "The task pool" (that's a different
// mechanism, 4.1.2, for an analyst self-claiming from the shared
// queue). The WHERE status = 'unassigned' guard makes this a no-op
// (returns null, not an error) if the task was already claimed between
// the caller reading it and this UPDATE running — cheap protection
// against a double-assign race without needing row locking here.
async function assignAnalyst(id, email) {
  const { rows } = await pool.query(
    `UPDATE tasks SET status = 'analyst', assignee = $2, owner = $2, assigned_at = now()
     WHERE id = $1 AND status = 'unassigned'
     RETURNING *`,
    [id, email]
  );
  return rows[0] || null;
}

async function pollingCounts() {
  const { rows } = await pool.query(`
    SELECT
      count(*) FILTER (WHERE status = 'unassigned') AS new_count,
      count(*) FILTER (WHERE status IN ('analyst', 'reviewer')) AS pending_count,
      count(*) FILTER (
        WHERE due_date < now() + interval '24 hours'
          AND status NOT IN ('done', 'paid', 'closed')
      ) AS near_deadline_count
    FROM tasks;
  `);
  return rows[0];
}

module.exports = { findByService, findById, assignAnalyst, pollingCounts };
