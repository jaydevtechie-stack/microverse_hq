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

// Accepts an optional client so callers needing atomicity (see
// models/user.js's ensureAccountForCustomer) can run this inside their
// own transaction instead of grabbing a fresh connection from the pool.
async function createAccount({ type, name }, client = pool) {
  const { rows } = await client.query(
    'INSERT INTO accounts (type, name) VALUES ($1, $2) RETURNING *',
    [type, name]
  );
  return rows[0];
}

// A customer's Accounts beyond their single `users.account_id` default
// — see db.js's user_accounts comment. Includes the default account
// too (unioned, deduplicated) so callers get one complete list rather
// than having to separately fetch account_id and merge it themselves.
async function listAccountsForUser(userId) {
  const { rows } = await pool.query(
    `SELECT DISTINCT a.* FROM accounts a
     WHERE a.id IN (
       SELECT account_id FROM user_accounts WHERE user_id = $1
       UNION
       SELECT account_id FROM users WHERE id = $1 AND account_id IS NOT NULL
     )
     ORDER BY a.name`,
    [userId]
  );
  return rows;
}

async function linkUserToAccount(userId, accountId) {
  await pool.query(
    `INSERT INTO user_accounts (user_id, account_id) VALUES ($1, $2)
     ON CONFLICT (user_id, account_id) DO NOTHING`,
    [userId, accountId]
  );
}

// Every active PM, platform-wide (4.7) — not scoped to an Account,
// unlike listPmsForAccount. Assigning a project's PM (project-routes.js's
// PATCH /projects/:id/pm) is currently the *only* way a PM ever gets
// linked to an Account at all (no standalone "add PM to Account" UI
// exists) — restricting the assign-PM candidate list to
// listPmsForAccount would mean nobody could ever become a project's
// first PM, since pm_accounts starts empty for every Account. This is
// the actual candidate pool; assignPm's caller links pm_accounts as a
// side effect of the assignment, not a precondition for it.
async function listAllPms() {
  const { rows } = await pool.query(
    `SELECT * FROM users WHERE active = true AND roles @> $1::text[] ORDER BY name`,
    [['platform:project-manager']]
  );
  return rows;
}

async function linkPmToAccount(pmId, accountId) {
  await pool.query(
    `INSERT INTO pm_accounts (pm_id, account_id) VALUES ($1, $2)
     ON CONFLICT (pm_id, account_id) DO NOTHING`,
    [pmId, accountId]
  );
}

// account-manager's global view — every Account, unscoped. Distinct
// from listForPm (ownership-scoped) and listAccountsForUser
// (membership-scoped) — an account-manager isn't tied to specific
// Accounts the way a PM or customer is.
async function listAllAccounts() {
  const { rows } = await pool.query('SELECT * FROM accounts ORDER BY name');
  return rows;
}

// The customer contacts on an Account — default-account holders and
// user_accounts members alike, same union shape as listAccountsForUser's
// reverse direction. Used by the account-manager view ("all accounts
// and the users of the accounts") and the Account detail panel.
async function listUsersForAccount(accountId) {
  const { rows } = await pool.query(
    `SELECT DISTINCT u.* FROM users u
     WHERE u.id IN (
       SELECT id FROM users WHERE account_id = $1
       UNION
       SELECT user_id FROM user_accounts WHERE account_id = $1
     )
     ORDER BY u.name`,
    [accountId]
  );
  return rows;
}

// "Services engaged" — which domain services this Account has actually
// ordered from, and how much, straight off tasks.service/account_id
// rather than a separate tracked field. Cheap enough at current data
// volume to compute on read; feeds both the customer's own Accounts
// view and the account-manager's cross-sell/upsell visibility (see
// AmCustomersPage's original placeholder note).
async function accountEngagement(accountId) {
  const { rows } = await pool.query(
    `SELECT service, count(*) AS task_count
     FROM tasks WHERE account_id = $1
     GROUP BY service ORDER BY service`,
    [accountId]
  );
  return rows.map((r) => ({ service: r.service, taskCount: Number(r.task_count) }));
}

module.exports = {
  listForPm,
  getAccount,
  listPmsForAccount,
  listProjectsForAccount,
  createAccount,
  listAccountsForUser,
  linkUserToAccount,
  listAllPms,
  linkPmToAccount,
  listAllAccounts,
  listUsersForAccount,
  accountEngagement,
};
