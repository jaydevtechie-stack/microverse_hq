// business-services/task-service/models/comment.js
const { pool } = require('../db');

// One row per (comment_id, task_id) pair — the latest version of every
// thread on the task, top-level and replies alike — then nested one
// level deep by the caller. See SCHEMA.md's task_comments for why this
// is a flat DISTINCT ON rather than a recursive query: replies can't
// themselves have replies, so there's nothing to recurse into.
// visibility filters to 'internal' (staff discussion) or 'customer'
// (notes the customer can see) — omit it to get both, which is only
// ever appropriate for a staff-facing view. See SCHEMA.md's
// task_comments for why this split is one table, not two.
async function listForTask(taskId, { visibility } = {}) {
  const params = visibility ? [taskId, visibility] : [taskId];
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (comment_id) *
     FROM task_comments
     WHERE task_id = $1 ${visibility ? 'AND visibility = $2' : ''}
     ORDER BY comment_id, version DESC`,
    params
  );

  const byCommentId = new Map(rows.map((row) => [row.comment_id, { ...row, replies: [] }]));
  const topLevel = [];

  for (const comment of byCommentId.values()) {
    if (comment.parent_comment_id) {
      byCommentId.get(comment.parent_comment_id)?.replies.push(comment);
    } else {
      topLevel.push(comment);
    }
  }

  const byCreatedAt = (a, b) => new Date(a.created_at) - new Date(b.created_at);
  topLevel.sort(byCreatedAt);
  topLevel.forEach((comment) => comment.replies.sort(byCreatedAt));

  return topLevel;
}

module.exports = { listForTask };
