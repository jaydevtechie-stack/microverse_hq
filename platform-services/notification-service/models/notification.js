// platform-services/notification-service/models/notification.js
const { pool } = require('../db');

async function createNotification({ recipientEmail, type, taskId, message }) {
  const { rows } = await pool.query(
    `INSERT INTO notifications (recipient_email, type, task_id, message)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [recipientEmail, type, taskId, message]
  );
  return rows[0];
}

async function listForRecipient(email, limit = 20) {
  const { rows } = await pool.query(
    `SELECT * FROM notifications WHERE recipient_email = $1
     ORDER BY created_at DESC LIMIT $2`,
    [email, limit]
  );
  return rows;
}

async function unreadCountForRecipient(email) {
  const { rows } = await pool.query(
    'SELECT COUNT(*)::int AS count FROM notifications WHERE recipient_email = $1 AND read = false',
    [email]
  );
  return rows[0].count;
}

// Scoped to the owning recipient — a notification's own id isn't enough
// on its own, so one user can't mark another's notification read by
// guessing/enumerating ids.
async function markRead(id, email) {
  const { rows } = await pool.query(
    `UPDATE notifications SET read = true
     WHERE id = $1 AND recipient_email = $2 RETURNING *`,
    [id, email]
  );
  return rows[0] || null;
}

module.exports = { createNotification, listForRecipient, unreadCountForRecipient, markRead };
