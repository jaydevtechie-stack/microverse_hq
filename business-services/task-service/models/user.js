// business-services/task-service/models/user.js
const { pool } = require('../db');

// JIT upsert — see SCHEMA.md's users. Runs from auth middleware the
// first time task-service sees a given user's JWT in a request, not a
// dedicated login-webhook service. `active` is deliberately excluded
// from the UPDATE branch — it's task-service's own bookkeeping (see
// setActive below), and a deactivated user shouldn't get silently
// reactivated just by making another request. Returns the row —
// middleware/auth.js's syncUser needs `active` right after the upsert
// to enforce 4.0.4's deactivation check.
async function upsertFromClaims({ sub, email, name, picture, roles }) {
  const { rows } = await pool.query(
    `INSERT INTO users (id, email, name, avatar_url, roles)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id) DO UPDATE
       SET email = EXCLUDED.email, name = EXCLUDED.name,
           avatar_url = EXCLUDED.avatar_url, roles = EXCLUDED.roles,
           last_synced_at = now()
     RETURNING *`,
    [sub, email, name, picture || null, roles || []]
  );
  return rows[0];
}

async function listUsers() {
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

module.exports = { upsertFromClaims, listUsers, getUser, setActive };
