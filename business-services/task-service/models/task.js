// business-services/task-service/models/task.js
const { pool } = require('../db');

async function findByService(service) {
  const { rows } = await pool.query(
    'SELECT * FROM tasks WHERE service = $1 ORDER BY created_at DESC',
    [service]
  );
  return rows;
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

module.exports = { findByService, pollingCounts };
