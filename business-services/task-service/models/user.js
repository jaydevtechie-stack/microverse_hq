// business-services/task-service/models/user.js
const { pool } = require('../db');

// JIT upsert — see SCHEMA.md's users. Runs from auth middleware the
// first time task-service sees a given user's JWT in a request, not a
// dedicated login-webhook service.
async function upsertFromClaims({ sub, email, name, picture }) {
  await pool.query(
    `INSERT INTO users (id, email, name, avatar_url)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO UPDATE
       SET email = EXCLUDED.email, name = EXCLUDED.name,
           avatar_url = EXCLUDED.avatar_url, last_synced_at = now()`,
    [sub, email, name, picture || null]
  );
}

module.exports = { upsertFromClaims };
