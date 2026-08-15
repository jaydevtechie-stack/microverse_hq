// platform-services/notification-service/models/recipients.js
const { pool } = require('../db');

// Mirrors task-service's own projectManagersFor/listPmsForAccount join
// (task-routes.js, models/account.js) — a read-only query against the
// shared microverse-postgis instance rather than new task-service API
// surface, per platform-services.md's "notification-service decides who
// needs to know" split.
async function pmsForAccountAndService(accountId, service) {
  const { rows } = await pool.query(
    `SELECT u.email FROM pm_accounts pa
     JOIN users u ON u.id = pa.pm_id
     WHERE pa.account_id = $1 AND u.roles @> $2::text[]
     ORDER BY u.name`,
    [accountId, [`service:${service}`]]
  );
  return rows.map((row) => row.email);
}

// Best-effort display name for the email-service template — falls back
// to the email itself when unknown (e.g. an assignee whose sync is
// stale) rather than failing the notification over a missing name.
async function nameForEmail(email) {
  const { rows } = await pool.query('SELECT name FROM users WHERE email = $1', [email]);
  return rows[0]?.name || email;
}

module.exports = { pmsForAccountAndService, nameForEmail };
