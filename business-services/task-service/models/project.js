// business-services/task-service/models/project.js
const { pool } = require('../db');

// Ownership half of the access rule — Projects under Accounts this PM
// owns (via pm_accounts). Same reasoning as account.js's listForPm.
async function listForPm(pmId) {
  const { rows } = await pool.query(
    `SELECT p.*, a.name AS account_name FROM projects p
     JOIN accounts a ON a.id = p.account_id
     JOIN pm_accounts pa ON pa.account_id = p.account_id
     WHERE pa.pm_id = $1
     ORDER BY p.name`,
    [pmId]
  );
  return rows;
}

async function getProject(id) {
  const { rows } = await pool.query(
    `SELECT p.*, a.name AS account_name, u.name AS responsible_user_name
     FROM projects p
     JOIN accounts a ON a.id = p.account_id
     LEFT JOIN users u ON u.id = p.responsible_user_id
     WHERE p.id = $1`,
    [id]
  );
  return rows[0] || null;
}

// Service-scope half of the access rule — of this Project's Tasks,
// only the ones whose service the caller actually holds (see
// ARCHITECTURE.md's Roles and permissions: ownership gets you into the
// Account, service scope gets you the specific task types within it).
// serviceScopes is the caller's own service:* claims, already stripped
// of the "service:" prefix.
async function listTasksForProject(projectId, serviceScopes) {
  const { rows } = await pool.query(
    'SELECT * FROM tasks WHERE project_id = $1 AND service = ANY($2) ORDER BY created_at DESC',
    [projectId, serviceScopes]
  );
  return rows;
}

module.exports = { listForPm, getProject, listTasksForProject };
