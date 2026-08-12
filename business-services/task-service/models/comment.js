// business-services/task-service/models/comment.js
const { randomUUID } = require('crypto');
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
// author_name (follow-up to task.js's assignee_name/owner_name) —
// `author` is the commenter's email (or preferred_username, if the
// token had no email — see task-routes.js's POST .../comments), not a
// user id, so this joins by email same as findById's assignee/owner
// joins. Falls back to the raw `author` string client-side when no
// synced user matches (e.g. the preferred_username fallback case).
async function listForTask(taskId, { visibility } = {}) {
  const params = visibility ? [taskId, visibility] : [taskId];
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (tc.comment_id) tc.*, u.name AS author_name
     FROM task_comments tc
     LEFT JOIN users u ON u.email = tc.author
     WHERE tc.task_id = $1 ${visibility ? 'AND tc.visibility = $2' : ''}
     ORDER BY tc.comment_id, tc.version DESC`,
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

// Latest version of one thread — used by createComment to check a
// reply's parent (visibility inheritance, one-level-only enforcement).
// Not exposed as its own route; SCHEMA.md's task_comments rules are
// enforced at the route handler, this is just the lookup they need.
async function findLatestByCommentId(commentId) {
  const { rows } = await pool.query(
    'SELECT * FROM task_comments WHERE comment_id = $1 ORDER BY version DESC LIMIT 1',
    [commentId]
  );
  return rows[0] || null;
}

// comment_id has to equal this row's own id for a brand-new thread
// (SCHEMA.md: "the first version of a comment sets comment_id = id") —
// generated here rather than left to the column default so both
// columns can be set to the same value in one INSERT. A reply is its
// own new thread (own id/comment_id), just with parent_comment_id
// pointing at the parent thread's comment_id — not a new version of
// the parent. No edit/versioning support yet (version always 1) —
// wasn't asked for, just create.
async function createComment({ taskId, content, visibility, parentCommentId, author }) {
  const id = randomUUID();
  const { rows } = await pool.query(
    `INSERT INTO task_comments (id, comment_id, parent_comment_id, task_id, author, visibility, content)
     VALUES ($1, $1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [id, parentCommentId || null, taskId, author, visibility, content]
  );
  return rows[0];
}

module.exports = { listForTask, findLatestByCommentId, createComment };
