// business-services/task-service/models/service.js
const { pool } = require('../db');

async function listServices() {
  const { rows } = await pool.query('SELECT * FROM services ORDER BY name');
  return rows;
}

async function getServiceByKey(key) {
  const { rows } = await pool.query('SELECT * FROM services WHERE key = $1', [key]);
  return rows[0] || null;
}

async function createService({ key, name, tech, title, description, status }) {
  const { rows } = await pool.query(
    `INSERT INTO services (key, name, tech, title, description, status)
     VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'planned'))
     RETURNING *`,
    [key, name, tech || null, title || null, description || null, status || null]
  );
  return rows[0];
}

// Partial update — only columns present in `fields` are touched, so a
// caller can PUT just `{ status: 'online' }` for activate/deactivate
// without clobbering the rest of the row's content.
async function updateService(id, fields) {
  const columns = ['name', 'tech', 'title', 'description', 'status'].filter((col) => fields[col] !== undefined);
  if (columns.length === 0) {
    const { rows } = await pool.query('SELECT * FROM services WHERE id = $1', [id]);
    return rows[0] || null;
  }

  const setClause = columns.map((col, i) => `${col} = $${i + 2}`).join(', ');
  const values = columns.map((col) => fields[col]);
  const { rows } = await pool.query(
    `UPDATE services SET ${setClause}, updated_at = now() WHERE id = $1 RETURNING *`,
    [id, ...values]
  );
  return rows[0] || null;
}

module.exports = { listServices, getServiceByKey, createService, updateService };
