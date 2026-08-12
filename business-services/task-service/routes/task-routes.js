// business-services/task-service/routes/task-routes.js

const express = require('express');
const router = express.Router();
const {
  findByService,
  findById,
  create,
  assignAnalyst,
  updateOrderDetails,
  moveToReview,
  reassignReviewer,
  approveTask,
  rejectTask,
} = require('../models/task');
const { listForTask, findLatestByCommentId, createComment } = require('../models/comment');
const { getUser, listUsers, ensureAccountForCustomer } = require('../models/user');
const { recommendAnalysts } = require('../models/scout');
const { listPmsForAccount } = require('../models/account');
const { requireRealmRole, requireAnyRealmRole } = require('../middleware/auth');

// The PM(s) a customer should reach out to about this order — ownership
// (pm_accounts, which Accounts a PM can see at all) narrowed to service
// scope (does this PM actually hold service:{task.service}), same two
// independent checks the Project Hub itself uses (ARCHITECTURE.md's
// Roles and permissions). pm_accounts carries no service column of its
// own — a PM's service scope lives on their own `users.roles`, checked
// here rather than in the join.
async function projectManagersFor(task) {
  if (!task.account_id) return [];
  const pms = await listPmsForAccount(task.account_id);
  return pms
    .filter((pm) => pm.roles?.includes(`service:${task.service}`))
    .map((pm) => ({ id: pm.id, name: pm.name, email: pm.email }));
}

// A customer must never see another customer's orders — real privacy
// boundary, not just a display preference (title/context/tags/files are
// all customer-submitted content). Same PM-first precedence
// GofeelerListPanel.js already uses client-side (a PM sees everything,
// a customer sees only their own): platform:project-manager is the
// escape hatch here too, since a PM viewing across accounts is
// legitimate and shouldn't get clipped by also happening to hold
// platform:customer. Analyst/reviewer pool visibility is unaffected —
// that's a different, intentional "see the open queue" design, not the
// privacy boundary this is closing.
function isCustomerOnly(req) {
  const roles = req.claims?.realm_access?.roles || [];
  return roles.includes('platform:customer') && !roles.includes('platform:project-manager');
}

// Fetch tasks tagged with a given domain service, e.g. ?service=gofeeler.
router.get('/tasks', async (req, res) => {
  const { service } = req.query;

  if (!service) {
    return res.status(400).json({ message: 'Missing required "service" query param' });
  }

  try {
    let tasks = await findByService(service);
    if (isCustomerOnly(req)) {
      tasks = tasks.filter((t) => t.customer_id === req.claims?.sub);
    }
    res.status(200).json(tasks);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching tasks', error: err.message });
  }
});

// Single task, for the detail page. project_managers is enrichment, not
// a column — computed fresh on every read from pm_accounts + roles
// rather than stored, so it can't drift out of sync with a PM's actual
// current assignments/roles.
router.get('/tasks/:id', async (req, res) => {
  try {
    const task = await findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    if (isCustomerOnly(req) && task.customer_id !== req.claims?.sub) {
      return res.status(403).json({ message: "Not this customer's order" });
    }
    const projectManagers = await projectManagersFor(task);
    res.status(200).json({ ...task, project_managers: projectManagers });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching task', error: err.message });
  }
});

// Customer submits a new order (4.2). customer_id always comes from
// req.claims.sub (set by middleware/auth.js's syncUser, ahead of every
// /api route) — never from the request body. id is the one exception:
// it's accepted from the client because CreateOrderForm.js mints it
// before this call, to use as the MinIO upload key (the upload has to
// happen first — see models/task.js's create for why). service/title
// are required; context/tags are optional order details.
router.post('/tasks', async (req, res) => {
  const customerId = req.claims?.sub;
  if (!customerId) {
    return res.status(401).json({ message: 'Missing or unparseable Authorization token' });
  }

  const roles = req.claims?.realm_access?.roles || [];
  const { id, service, title, context, tags, dueDate } = req.body;
  if (!service || !title?.trim()) {
    return res.status(400).json({ message: '"service" and "title" are required' });
  }
  if (!roles.includes('platform:customer') || !roles.includes(`service:${service}`)) {
    return res
      .status(403)
      .json({ message: `Requires platform:customer and service:${service}` });
  }

  try {
    const accountId = await ensureAccountForCustomer(customerId);
    const task = await create({
      id,
      service,
      title: title.trim(),
      context,
      tags,
      customerId,
      accountId,
      // Owner starts as the creator — before a PM assigns an analyst,
      // the order is exclusively the customer's to act on, so they're
      // "current owner" in the same sense assignAnalyst later hands
      // that role to whoever the task is actively with.
      ownerEmail: req.claims?.email,
      dueDate: dueDate || null,
    });
    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ message: 'Error creating task', error: err.message });
  }
});

// Customer edits their own order — same fields Create Order accepts
// (title/context/tags). Files are a separate asset-service concern with
// its own identical edit window (TaskFilesList's add/remove) — no shared
// transaction between the two services, so each enforces the edit window
// independently against its own record. Open while `unassigned`, and
// reopened during `analyst` (5.7.1) so an analyst short on content can
// ask the customer to add more without a PM having to unassign first;
// locked everywhere else, same boundary as elsewhere customer edit
// rights end (see ARCHITECTURE.md's Role x Action matrix).
const EDITABLE_STATUSES = ['unassigned', 'analyst'];

router.put('/tasks/:id', async (req, res) => {
  const customerId = req.claims?.sub;
  if (!customerId) {
    return res.status(401).json({ message: 'Missing or unparseable Authorization token' });
  }

  const roles = req.claims?.realm_access?.roles || [];
  if (!roles.includes('platform:customer')) {
    return res.status(403).json({ message: 'Requires platform:customer' });
  }

  const { title, context, tags, dueDate } = req.body;
  if (!title?.trim()) {
    return res.status(400).json({ message: '"title" is required' });
  }

  try {
    const task = await findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    if (task.customer_id !== customerId) {
      return res.status(403).json({ message: "Not this customer's order" });
    }
    if (!EDITABLE_STATUSES.includes(task.status)) {
      return res.status(409).json({ message: `Task is already "${task.status}", no longer editable` });
    }

    const updated = await updateOrderDetails(task.id, {
      title: title.trim(),
      context,
      tags,
      dueDate: dueDate || null,
    });
    if (!updated) {
      return res.status(409).json({ message: 'Task status changed just now, no longer editable' });
    }
    res.status(200).json({ ...updated, project_managers: await projectManagersFor(updated) });
  } catch (err) {
    res.status(500).json({ message: 'Error updating task', error: err.message });
  }
});

// PM assigns a specific analyst to a specific unassigned task (4.1) —
// the word-cloud/dropdown flow, not the shared-pool self-claim query
// from ARCHITECTURE.md's "The task pool" (a separate, not-yet-built
// mechanism, tracked in ROADMAP's business-services.md). Body: { assigneeId } — a users.id, not a raw email, so
// the assignee is always a real synced user, not a client-supplied
// string. Validates the assignee is active and actually holds
// platform:analyst + service:{task.service} — real validation, unlike
// most of task-service's still-unenforced routes, since a bad
// assignment here corrupts task-service's own status/role invariants
// (see ARCHITECTURE.md's Task workflow table), not just a display bug.
// requireRealmRole('platform:project-manager') closes the OWASP A01
// finding (docs/security.md) that this route validated the assignee's
// roles but never the caller's, despite being PM-only by design.
router.patch('/tasks/:id', requireRealmRole('platform:project-manager'), async (req, res) => {
  const { assigneeId } = req.body;
  if (!assigneeId) {
    return res.status(400).json({ message: 'Missing required "assigneeId"' });
  }

  try {
    const task = await findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    if (task.status !== 'unassigned') {
      return res.status(409).json({ message: `Task is already "${task.status}", not unassigned` });
    }

    const analyst = await getUser(assigneeId);
    if (!analyst || !analyst.active) {
      return res.status(400).json({ message: 'Assignee must be an active, synced user' });
    }
    const requiredRoles = ['platform:analyst', `service:${task.service}`];
    if (!requiredRoles.every((role) => analyst.roles.includes(role))) {
      return res
        .status(400)
        .json({ message: `Assignee must hold platform:analyst and service:${task.service}` });
    }

    const updated = await assignAnalyst(task.id, analyst.email);
    if (!updated) {
      return res.status(409).json({ message: 'Task was assigned by someone else just now' });
    }
    res.status(200).json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Error assigning task', error: err.message });
  }
});

// Scout's picks (4.1.1) for this task's service — ordered by the
// availability signal in models/scout.js, enriched per candidate with
// tasks_done/active_tasks/reason for 4.1.1.1's profile detail view.
// Reused as-is (4.5) for the reviewer's reject flow — rejecting sends
// the task back to a newly-picked analyst from this same pool, not
// necessarily the one who did the original work (ARCHITECTURE.md's
// open question, resolved: reviewer picks from the pool).
router.get('/tasks/:id/recommended-analysts', async (req, res) => {
  try {
    const task = await findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const candidates = await recommendAnalysts(task.service);
    res.status(200).json(candidates);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching recommendations', error: err.message });
  }
});

// Who's eligible to review this task (4.5) — the account's PM(s)
// (isDefault: true, same reuse of projectManagersFor the enrichment
// field already uses) plus any dedicated platform:reviewer holder for
// this service. Not exposed as GET /users?platformRole=&service=
// (that route is platform:admin-gated per docs/security.md's OWASP fix)
// — listUsers is called directly here instead, same pattern
// recommendAnalysts already uses for its own role-filtered query.
router.get('/tasks/:id/reviewer-candidates', async (req, res) => {
  try {
    const task = await findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const pms = await projectManagersFor(task);
    const reviewers = await listUsers({ platformRole: 'platform:reviewer', service: task.service });
    const pmIds = new Set(pms.map((pm) => pm.id));
    const candidates = [
      ...pms.map((pm) => ({ id: pm.id, name: pm.name, email: pm.email, isDefault: true })),
      ...reviewers.filter((r) => !pmIds.has(r.id)).map((r) => ({ id: r.id, name: r.name, email: r.email, isDefault: false })),
    ];
    res.status(200).json(candidates);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching reviewer candidates', error: err.message });
  }
});

// Analyst's own "Move to review" action (4.5) — analyst -> reviewer.
// Defaults the reviewer to the account's PM (docs/roadmap/2.0/
// intelligence.md's reviewer-identity model: "the PM, or a dedicated
// service:X + platform:reviewer holder"); reassigning to a dedicated
// reviewer is a separate action (PATCH /tasks/:id/reviewer) available
// once this transition has happened. requireRealmRole plus the
// assignee self-check mirrors PATCH /tasks/:id's own caller-role +
// target-eligibility double-check (docs/security.md's OWASP fix for
// that route) — a self-check alone isn't enough on its own.
router.patch('/tasks/:id/move-to-review', requireRealmRole('platform:analyst'), async (req, res) => {
  const analystEmail = req.claims?.email;
  if (!analystEmail) {
    return res.status(401).json({ message: 'Missing or unparseable Authorization token' });
  }

  try {
    const task = await findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    if (task.status !== 'analyst') {
      return res.status(409).json({ message: `Task is "${task.status}", not analyst` });
    }
    if (task.assignee !== analystEmail) {
      return res.status(403).json({ message: "Not this task's current analyst" });
    }

    const pms = await projectManagersFor(task);
    if (pms.length === 0) {
      return res.status(400).json({ message: 'No project manager available to review this order' });
    }

    const updated = await moveToReview(task.id, analystEmail, pms[0].email);
    if (!updated) {
      return res.status(409).json({ message: 'Task status changed just now' });
    }
    res.status(200).json({ ...updated, project_managers: await projectManagersFor(updated) });
  } catch (err) {
    res.status(500).json({ message: 'Error moving task to review', error: err.message });
  }
});

// Current reviewer hands the task to someone else (4.5) — the PM
// (default) to a dedicated reviewer, or back. Only the task's current
// reviewer can do this (self-check), same "current holder acts on their
// own task" posture as the analyst-side panels.
router.patch(
  '/tasks/:id/reviewer',
  requireAnyRealmRole('platform:project-manager', 'platform:reviewer'),
  async (req, res) => {
    const callerEmail = req.claims?.email;
    const { reviewerId } = req.body;
    if (!callerEmail) {
      return res.status(401).json({ message: 'Missing or unparseable Authorization token' });
    }
    if (!reviewerId) {
      return res.status(400).json({ message: 'Missing required "reviewerId"' });
    }

    try {
      const task = await findById(req.params.id);
      if (!task) return res.status(404).json({ message: 'Task not found' });
      if (task.status !== 'reviewer') {
        return res.status(409).json({ message: `Task is "${task.status}", not reviewer` });
      }
      if (task.assignee !== callerEmail) {
        return res.status(403).json({ message: "Not this task's current reviewer" });
      }

      const reviewer = await getUser(reviewerId);
      if (!reviewer || !reviewer.active) {
        return res.status(400).json({ message: 'Reviewer must be an active, synced user' });
      }
      const pms = await projectManagersFor(task);
      const isPmCandidate = pms.some((pm) => pm.id === reviewer.id);
      const isDedicatedReviewer =
        reviewer.roles?.includes('platform:reviewer') && reviewer.roles?.includes(`service:${task.service}`);
      if (!isPmCandidate && !isDedicatedReviewer) {
        return res.status(400).json({
          message: `Reviewer must be the account's project manager or hold platform:reviewer and service:${task.service}`,
        });
      }

      const updated = await reassignReviewer(task.id, callerEmail, reviewer.email);
      if (!updated) {
        return res.status(409).json({ message: 'Task was reassigned by someone else just now' });
      }
      res.status(200).json({ ...updated, project_managers: await projectManagersFor(updated) });
    } catch (err) {
      res.status(500).json({ message: 'Error reassigning reviewer', error: err.message });
    }
  }
);

// Reviewer approves the analyst's work (4.5) — reviewer -> done. Owner
// resolution follows SCHEMA.md's Assignee/Owner table (done -> PM): the
// approving PM's own email if they hold platform:project-manager
// (unambiguous), otherwise the account's PM via projectManagersFor —
// this inherits ARCHITECTURE.md's still-open "one dedicated PM per
// company or a pool" question rather than resolving it, same as the
// existing project_managers enrichment field already does.
router.patch(
  '/tasks/:id/approve',
  requireAnyRealmRole('platform:project-manager', 'platform:reviewer'),
  async (req, res) => {
    const callerEmail = req.claims?.email;
    if (!callerEmail) {
      return res.status(401).json({ message: 'Missing or unparseable Authorization token' });
    }

    try {
      const task = await findById(req.params.id);
      if (!task) return res.status(404).json({ message: 'Task not found' });
      if (task.status !== 'reviewer') {
        return res.status(409).json({ message: `Task is "${task.status}", not reviewer` });
      }
      if (task.assignee !== callerEmail) {
        return res.status(403).json({ message: "Not this task's current reviewer" });
      }

      const callerRoles = req.claims?.realm_access?.roles || [];
      let ownerEmail;
      if (callerRoles.includes('platform:project-manager')) {
        ownerEmail = callerEmail;
      } else {
        const pms = await projectManagersFor(task);
        if (pms.length === 0) {
          return res.status(400).json({ message: 'No project manager available to take ownership' });
        }
        ownerEmail = pms[0].email;
      }

      const updated = await approveTask(task.id, callerEmail, ownerEmail);
      if (!updated) {
        return res.status(409).json({ message: 'Task status changed just now' });
      }
      res.status(200).json({ ...updated, project_managers: await projectManagersFor(updated) });
    } catch (err) {
      res.status(500).json({ message: 'Error approving task', error: err.message });
    }
  }
);

// Reviewer rejects the analyst's work (4.5) — reviewer -> analyst.
// ARCHITECTURE.md: "rejection requires an assignee — the transition
// isn't complete until a new analyst is picked, so a Task never sits
// unassigned mid-rejection" — and the open question on same-analyst-vs-
// pool is resolved as pool, so this always carries a validated
// assigneeId, same target-eligibility check PATCH /tasks/:id (PM
// assign) already does for the same platform:analyst + service:{x}
// requirement.
router.patch(
  '/tasks/:id/reject',
  requireAnyRealmRole('platform:project-manager', 'platform:reviewer'),
  async (req, res) => {
    const callerEmail = req.claims?.email;
    const { assigneeId } = req.body;
    if (!callerEmail) {
      return res.status(401).json({ message: 'Missing or unparseable Authorization token' });
    }
    if (!assigneeId) {
      return res.status(400).json({ message: 'Missing required "assigneeId"' });
    }

    try {
      const task = await findById(req.params.id);
      if (!task) return res.status(404).json({ message: 'Task not found' });
      if (task.status !== 'reviewer') {
        return res.status(409).json({ message: `Task is "${task.status}", not reviewer` });
      }
      if (task.assignee !== callerEmail) {
        return res.status(403).json({ message: "Not this task's current reviewer" });
      }

      const analyst = await getUser(assigneeId);
      if (!analyst || !analyst.active) {
        return res.status(400).json({ message: 'Assignee must be an active, synced user' });
      }
      const requiredRoles = ['platform:analyst', `service:${task.service}`];
      if (!requiredRoles.every((role) => analyst.roles.includes(role))) {
        return res
          .status(400)
          .json({ message: `Assignee must hold platform:analyst and service:${task.service}` });
      }

      const updated = await rejectTask(task.id, callerEmail, analyst.email);
      if (!updated) {
        return res.status(409).json({ message: 'Task status changed just now' });
      }
      res.status(200).json({ ...updated, project_managers: await projectManagersFor(updated) });
    } catch (err) {
      res.status(500).json({ message: 'Error rejecting task', error: err.message });
    }
  }
);

// Nested one level deep — top-level comments with their (at most one
// level of) replies attached. ?visibility=internal|customer scopes to
// staff discussion or customer-facing notes; omitted, it returns both —
// callers showing a customer their own view MUST pass
// visibility=customer explicitly, same "frontend is responsible" trust
// posture as the rest of task-service until real auth enforcement lands.
router.get('/tasks/:id/comments', async (req, res) => {
  const { visibility } = req.query;
  if (visibility && !['internal', 'customer'].includes(visibility)) {
    return res.status(400).json({ message: 'visibility must be "internal" or "customer"' });
  }

  try {
    const comments = await listForTask(req.params.id, { visibility });
    res.status(200).json(comments);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching comments', error: err.message });
  }
});

// Deliberately independent of the order's edit window (unassigned-only,
// see PUT /tasks/:id) — comments/notes stay postable at any task status,
// by design (a customer needs to be reachable — and reachable back —
// after a PM's already assigned an analyst, not just before).
// SCHEMA.md's task_comments application-side rules, enforced here:
//  - a reply inherits its parent thread's visibility (never
//    client-supplied for a reply — flipping visibility mid-thread isn't
//    allowed)
//  - one level of replies only — replying to something that's itself a
//    reply is rejected
//  - a customer may only post to visibility=customer threads, and only
//    on an order they actually own
router.post('/tasks/:id/comments', async (req, res) => {
  const { content, visibility, parentCommentId } = req.body;
  if (!content?.trim()) {
    return res.status(400).json({ message: '"content" is required' });
  }

  const author = req.claims?.email || req.claims?.preferred_username;
  if (!author) {
    return res.status(401).json({ message: 'Missing or unparseable Authorization token' });
  }

  try {
    const task = await findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    if (isCustomerOnly(req) && task.customer_id !== req.claims?.sub) {
      return res.status(403).json({ message: "Not this customer's order" });
    }

    let resolvedVisibility;
    if (parentCommentId) {
      const parent = await findLatestByCommentId(parentCommentId);
      if (!parent || parent.task_id !== task.id) {
        return res.status(404).json({ message: 'Parent comment not found' });
      }
      if (parent.parent_comment_id) {
        return res.status(400).json({ message: 'Cannot reply to a reply — one level of threading only' });
      }
      resolvedVisibility = parent.visibility;
    } else {
      if (!['internal', 'customer'].includes(visibility)) {
        return res.status(400).json({ message: 'visibility must be "internal" or "customer"' });
      }
      resolvedVisibility = visibility;
    }

    if (isCustomerOnly(req) && resolvedVisibility !== 'customer') {
      return res.status(403).json({ message: 'Customers can only post to customer-visible threads' });
    }

    const comment = await createComment({
      taskId: task.id,
      content: content.trim(),
      visibility: resolvedVisibility,
      parentCommentId: parentCommentId || null,
      author,
    });
    res.status(201).json(comment);
  } catch (err) {
    res.status(500).json({ message: 'Error creating comment', error: err.message });
  }
});

module.exports = router;
