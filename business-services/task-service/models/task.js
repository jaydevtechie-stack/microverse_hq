// business-services/task-service/models/task.js
const { pool } = require('../db');

async function findByService(service) {
  const { rows } = await pool.query(
    'SELECT * FROM tasks WHERE service = $1 ORDER BY created_at DESC',
    [service]
  );
  return rows;
}

// customer_name/project_name (4.6) — the task detail meta line wants
// display names, not raw customer_id/project_id UUIDs; joined here
// rather than as a separate lookup since every caller of findById
// already wants the enriched row (extra columns are harmless to the
// handful of callers that only read assignee/status/etc off it).
// assignee_name/owner_name (follow-up) — assignee/owner are stored as
// emails, not user ids (assignAnalyst/moveToReview/etc. all write the
// target's email — see their own comments for why), so this joins by
// email rather than id, unlike the customer/project joins above. Both
// can come back null for an email that isn't (or is no longer) a
// synced user — callers fall back to the raw email in that case, same
// pattern project.responsible_user_name already uses.
// a.account_manager_id (6.3) rides along so the no_index toggle route
// can check an account-manager caller's ownership (6.2.5) without a
// second query — same reasoning as models/project.js's getProject.
async function findById(id) {
  const { rows } = await pool.query(
    `SELECT t.*, c.name AS customer_name, p.name AS project_name,
            au.name AS assignee_name, ou.name AS owner_name, a.account_manager_id
     FROM tasks t
     LEFT JOIN users c ON c.id = t.customer_id
     LEFT JOIN projects p ON p.id = t.project_id
     LEFT JOIN users au ON au.email = t.assignee
     LEFT JOIN users ou ON ou.email = t.owner
     LEFT JOIN accounts a ON a.id = t.account_id
     WHERE t.id = $1`,
    [id]
  );
  return rows[0] || null;
}

// unassigned -> analyst, real PM assignment (4.1) — not the pool-claim
// query from ARCHITECTURE.md's "The task pool" (that's a separate,
// not-yet-built mechanism tracked in ROADMAP's business-services.md,
// for an analyst self-claiming from the shared queue). The WHERE
// status = 'unassigned' guard makes this a no-op
// (returns null, not an error) if the task was already claimed between
// the caller reading it and this UPDATE running — cheap protection
// against a double-assign race without needing row locking here.
async function assignAnalyst(id, email) {
  const { rows } = await pool.query(
    `UPDATE tasks SET status = 'analyst', assignee = $2, owner = $2, assigned_at = now()
     WHERE id = $1 AND status = 'unassigned'
     RETURNING *`,
    [id, email]
  );
  return rows[0] || null;
}

// id is accepted from the caller (client-minted, matching the MinIO
// upload key already built from it before this insert runs — see
// CreateOrderForm.js) and falls back to the column default
// (gen_random_uuid()) if omitted. customer_id/account_id/ownerEmail are
// never taken from a request body — see routes/task-routes.js's
// POST /tasks. owner starts as the creating customer (assignAnalyst
// overwrites it once a PM assigns) — before that, the order is
// exclusively theirs to act on (edit/cancel), so "current owner" is
// the customer, not nobody; leaving it null until assignment left
// customer-only views (Notes, CustomerProgressPanel) keyed on
// `task.owner === username` unable to ever match their own fresh order.
// projectId/noIndex (6.3.1) — optional project association and its
// no_index starting value, resolved by the route handler (project's
// current no_index, or false if no projectId). A one-time copy at
// creation, never revisited — the task's own no_index is independent
// from here on, same as any other no_index change.
async function create({ id, service, title, context, tags, customerId, accountId, ownerEmail, dueDate, projectId, noIndex }) {
  const { rows } = await pool.query(
    `INSERT INTO tasks (id, service, title, context, tags, customer_id, account_id, owner, due_date, project_id, no_index)
     VALUES (COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [id || null, service, title, context || null, tags || [], customerId, accountId, ownerEmail || null, dueDate || null, projectId || null, noIndex || false]
  );
  return rows[0];
}

// Customer self-edit of their own order — same fields Create Order
// accepts (title/context/tags). Files are a separate asset-service
// concern with its own independent, identically-widened gate
// (TaskFilesList's add/remove) — no shared transaction between the two
// services, so each enforces the edit window on its own record.
// customer_id/status ownership+window checks happen in the route
// handler; the WHERE status = ANY(...) guard here is the same
// last-instant race protection as assignAnalyst (returns null, not an
// error, if the order moved past 'analyst' between the caller's read
// and this UPDATE running). Statuses must match task-routes.js's
// EDITABLE_STATUSES — kept as a literal array here rather than a shared
// import since this module has no dependency on the routes layer.
async function updateOrderDetails(id, { title, context, tags, dueDate }) {
  const { rows } = await pool.query(
    `UPDATE tasks SET title = $2, context = $3, tags = $4, due_date = $5
     WHERE id = $1 AND status = ANY($6)
     RETURNING *`,
    [id, title, context || null, tags || [], dueDate || null, ['unassigned', 'analyst']]
  );
  return rows[0] || null;
}

// analyst -> reviewer (4.5) — the analyst's own "Move to review" action.
// reviewerEmail is resolved by the route handler (defaults to the
// account's PM via projectManagersFor) before this runs; the WHERE
// clause guards both status and that the caller is still the task's
// actual assignee, same double-guard shape recommendAnalysts'
// assignAnalyst uses for the unassigned -> analyst transition.
async function moveToReview(id, analystEmail, reviewerEmail) {
  const { rows } = await pool.query(
    `UPDATE tasks SET status = 'reviewer', assignee = $3, owner = $3, assigned_at = now()
     WHERE id = $1 AND status = 'analyst' AND assignee = $2
     RETURNING *`,
    [id, analystEmail, reviewerEmail]
  );
  return rows[0] || null;
}

// reviewer -> reviewer, a handoff between the default PM reviewer and a
// dedicated platform:reviewer (or back) — status doesn't change, only
// who's currently holding it. Guarded on the caller still being the
// current reviewer, so a stale reassign (already handed off by someone
// else) is a no-op, not a silent overwrite.
async function reassignReviewer(id, currentReviewerEmail, newReviewerEmail) {
  const { rows } = await pool.query(
    `UPDATE tasks SET assignee = $3, owner = $3, assigned_at = now()
     WHERE id = $1 AND status = 'reviewer' AND assignee = $2
     RETURNING *`,
    [id, currentReviewerEmail, newReviewerEmail]
  );
  return rows[0] || null;
}

// reviewer -> done. assignee cleared (see SCHEMA.md's Assignee vs Owner
// table — 'done' has no active assignee), owner resolved by the route
// handler (the approving PM's own email, or the account's PM if a
// dedicated reviewer approved).
async function approveTask(id, reviewerEmail, ownerEmail) {
  const { rows } = await pool.query(
    `UPDATE tasks SET status = 'done', assignee = NULL, owner = $3
     WHERE id = $1 AND status = 'reviewer' AND assignee = $2
     RETURNING *`,
    [id, reviewerEmail, ownerEmail]
  );
  return rows[0] || null;
}

// reviewer -> analyst. Rejection requires picking a new assignee
// immediately (ARCHITECTURE.md's Task workflow note) — never sits
// unassigned mid-rejection, so this always carries a validated
// newAnalystEmail rather than clearing assignee first.
async function rejectTask(id, reviewerEmail, newAnalystEmail) {
  const { rows } = await pool.query(
    `UPDATE tasks SET status = 'analyst', assignee = $3, owner = $3, assigned_at = now()
     WHERE id = $1 AND status = 'reviewer' AND assignee = $2
     RETURNING *`,
    [id, reviewerEmail, newAnalystEmail]
  );
  return rows[0] || null;
}

// done -> paid, on rustledger's bill.paid Kafka event (Branch 9) — see
// events/kafka-consumer.js, task-service's first ever consumer.
// WHERE status = 'done' makes this idempotent the same way approveTask's
// WHERE guard does: a redelivered event just no-ops (rows[0] is null)
// rather than double-applying.
async function markPaid(id) {
  const { rows } = await pool.query(
    `UPDATE tasks SET status = 'paid' WHERE id = $1 AND status = 'done' RETURNING *`,
    [id]
  );
  return rows[0] || null;
}

// Visibility flag, not a content edit (6.3) — no status-window guard,
// unlike updateOrderDetails. Settable by an account-manager (their own
// Account, per 6.2.5) or the owning customer, checked by the route
// handler before this runs.
async function setNoIndex(id, noIndex) {
  const { rows } = await pool.query(
    `UPDATE tasks SET no_index = $2 WHERE id = $1 RETURNING *`,
    [id, noIndex]
  );
  return rows[0] || null;
}

async function pollingCounts() {
  const { rows } = await pool.query(`
    SELECT
      count(*) FILTER (WHERE status = 'unassigned') AS new_count,
      count(*) FILTER (WHERE status IN ('analyst', 'reviewer')) AS pending_count,
      count(*) FILTER (
        WHERE due_date < now() + interval '24 hours'
          AND status NOT IN ('done', 'paid', 'closed')
      ) AS near_deadline_count
    FROM tasks;
  `);
  return rows[0];
}

module.exports = {
  findByService,
  findById,
  create,
  assignAnalyst,
  updateOrderDetails,
  moveToReview,
  reassignReviewer,
  approveTask,
  rejectTask,
  markPaid,
  setNoIndex,
  pollingCounts,
};
