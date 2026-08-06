// business-services/task-service/models/account.js
const { pool } = require('../db');

// Ownership half of the Project Hub's access rule (see ARCHITECTURE.md's
// Roles and permissions) — which Accounts a PM can see at all, via
// pm_accounts. Service scope (the other half) is checked separately,
// per-task, not here.
async function listForPm(pmId) {
  const { rows } = await pool.query(
    `SELECT a.* FROM accounts a
     JOIN pm_accounts pa ON pa.account_id = a.id
     WHERE pa.pm_id = $1
     ORDER BY a.name`,
    [pmId]
  );
  return rows;
}

async function getAccount(id) {
  const { rows } = await pool.query('SELECT * FROM accounts WHERE id = $1', [id]);
  return rows[0] || null;
}

async function listPmsForAccount(accountId) {
  const { rows } = await pool.query(
    `SELECT u.* FROM users u
     JOIN pm_accounts pa ON pa.pm_id = u.id
     WHERE pa.account_id = $1
     ORDER BY u.name`,
    [accountId]
  );
  return rows;
}

async function listProjectsForAccount(accountId) {
  const { rows } = await pool.query(
    'SELECT * FROM projects WHERE account_id = $1 ORDER BY name',
    [accountId]
  );
  return rows;
}

module.exports = { listForPm, getAccount, listPmsForAccount, listProjectsForAccount };
