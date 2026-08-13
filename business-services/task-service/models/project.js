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

// account_manager_id (6.2.5) rides along on every getProject call so
// the AM-gated routes below (approve/pm/deactivate/pm-candidates) can
// check ownership without a second query.
async function getProject(id) {
  const { rows } = await pool.query(
    `SELECT p.*, a.name AS account_name, a.account_manager_id, u.name AS responsible_user_name
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
// of the "service:" prefix — null bypasses the filter entirely, for
// account-manager (platform:admin-like "not tied to one service"
// visibility, same reasoning as platform:admin needing no service
// pairing at all per ARCHITECTURE.md's Roles and permissions).
async function listTasksForProject(projectId, serviceScopes) {
  const { rows } = await pool.query(
    serviceScopes === null
      ? 'SELECT * FROM tasks WHERE project_id = $1 ORDER BY created_at DESC'
      : 'SELECT * FROM tasks WHERE project_id = $1 AND service = ANY($2) ORDER BY created_at DESC',
    serviceScopes === null ? [projectId] : [projectId, serviceScopes]
  );
  return rows;
}

// Customer-initiated — starts 'dormant', pending account-manager
// approval (see db.js's status comment). No responsible_user_id yet;
// that's assigned once the project actually becomes real work, not at
// the request stage.
async function createProject({ accountId, name }) {
  const { rows } = await pool.query(
    `INSERT INTO projects (account_id, name, status)
     VALUES ($1, $2, 'dormant')
     RETURNING *`,
    [accountId, name]
  );
  return rows[0];
}

async function approveProject(id) {
  const { rows } = await pool.query(
    `UPDATE projects SET status = 'active' WHERE id = $1 AND status = 'dormant' RETURNING *`,
    [id]
  );
  return rows[0] || null;
}

// account-manager assigns/reassigns who's responsible for a Project
// (4.7) — no status guard, unlike approveProject: an account-manager
// should be able to line up a PM before or after approval, not just
// once. Target eligibility (must already be one of the Account's own
// pm_accounts) is checked by the route handler, same "validate the
// target, not just trust the id" posture task-routes.js's PM-assign
// route uses.
async function assignPm(id, pmId) {
  const { rows } = await pool.query(
    `UPDATE projects SET responsible_user_id = $2 WHERE id = $1 RETURNING *`,
    [id, pmId]
  );
  return rows[0] || null;
}

// Always allowed regardless of open tasks (4.7) — deactivation only
// affects the Project record itself (e.g. hides it from active lists);
// it doesn't touch any Task's own status, so there's nothing to guard
// against on that front.
async function deactivateProject(id) {
  const { rows } = await pool.query(
    `UPDATE projects SET status = 'inactive' WHERE id = $1 RETURNING *`,
    [id]
  );
  return rows[0] || null;
}

// Starting value for tasks created under this Project from here on
// (6.3.1) — never touches any existing task's own no_index. See
// task-service's POST /tasks for the inheritance read, and
// AccountsProjectsView.js's mass-toggle for reconciling existing tasks
// explicitly.
async function setProjectNoIndex(id, noIndex) {
  const { rows } = await pool.query(
    `UPDATE projects SET no_index = $2 WHERE id = $1 RETURNING *`,
    [id, noIndex]
  );
  return rows[0] || null;
}

module.exports = {
  listForPm,
  getProject,
  listTasksForProject,
  createProject,
  approveProject,
  assignPm,
  deactivateProject,
  setProjectNoIndex,
};
