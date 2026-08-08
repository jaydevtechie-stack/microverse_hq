// business-services/task-service/models/user.js
const { pool } = require('../db');
const { createAccount } = require('./account');

// Keycloak assigns these to every user regardless of app-level
// permissions (realm default roles, refresh-token scope, and
// Authorization Services' UMA scope) — they carry no meaning for
// task-service's own role checks (listUsers' `roles @>` queries,
// PmAssignPanel, etc.) and just clutter admin views, so they're
// stripped before anything reaches `users.roles`.
const KEYCLOAK_NOISE_ROLES = new Set(['default-roles-microverse', 'offline_access', 'uma_authorization']);

// JIT upsert — see SCHEMA.md's users. Runs from auth middleware the
// first time task-service sees a given user's JWT in a request, not a
// dedicated login-webhook service. `active` is deliberately excluded
// from the UPDATE branch — it's task-service's own bookkeeping (see
// setActive below), and a deactivated user shouldn't get silently
// reactivated just by making another request. Returns the row —
// middleware/auth.js's syncUser needs `active` right after the upsert
// to enforce 4.0.4's deactivation check.
async function upsertFromClaims({ sub, email, name, picture, roles }) {
  const filteredRoles = (roles || []).filter((role) => !KEYCLOAK_NOISE_ROLES.has(role));
  const { rows } = await pool.query(
    `INSERT INTO users (id, email, name, avatar_url, roles)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id) DO UPDATE
       SET email = EXCLUDED.email, name = EXCLUDED.name,
           avatar_url = EXCLUDED.avatar_url, roles = EXCLUDED.roles,
           last_synced_at = now()
     RETURNING *`,
    [sub, email, name, picture || null, filteredRoles]
  );
  return rows[0];
}

// platformRole/service filter to candidates for a given assignment,
// e.g. { platformRole: 'platform:analyst', service: 'gofeeler' } for
// PmAssignPanel's word cloud/dropdown — `roles @> ARRAY[...]` reads as
// "holds both of these," using the GIN index from SCHEMA.md's users.
// Excludes deactivated users — see SCHEMA.md's `active` note, a
// deactivated user isn't eligible for new task assignments.
async function listUsers({ platformRole, service } = {}) {
  if (platformRole && service) {
    const { rows } = await pool.query(
      `SELECT * FROM users
       WHERE active = true AND roles @> $1::text[]
       ORDER BY name`,
      [[platformRole, `service:${service}`]]
    );
    return rows;
  }
  const { rows } = await pool.query('SELECT * FROM users ORDER BY name');
  return rows;
}

async function getUser(id) {
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0] || null;
}

// Local flag only — never touches Keycloak login, see SCHEMA.md's users.
async function setActive(id, active) {
  const { rows } = await pool.query(
    'UPDATE users SET active = $2 WHERE id = $1 RETURNING *',
    [id, active]
  );
  return rows[0] || null;
}

// First-order account provisioning (ARCHITECTURE.md's Entity model:
// "an individual gets an Account of their own rather than being
// forced into a fake one-person company"). Transaction + row lock so
// two concurrent first-orders from the same brand-new customer can't
// both create an Account — the second call blocks on the lock, then
// sees account_id already set once the first commits. This is the
// first multi-statement transaction in task-service (everywhere else
// is a single pool.query call) — warranted here because "create an
// Account, then link it" has to be atomic or a half-failure leaves a
// user with an orphaned Account, or a task pointing at a customer with
// no Account at all.
async function ensureAccountForCustomer(userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'SELECT id, name, account_id FROM users WHERE id = $1 FOR UPDATE',
      [userId]
    );
    const user = rows[0];
    if (!user) throw new Error('User not synced yet');
    if (user.account_id) {
      await client.query('COMMIT');
      return user.account_id;
    }
    const account = await createAccount({ type: 'individual', name: user.name }, client);
    await client.query('UPDATE users SET account_id = $1 WHERE id = $2', [account.id, userId]);
    await client.query('COMMIT');
    return account.id;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { upsertFromClaims, listUsers, getUser, setActive, ensureAccountForCustomer };
