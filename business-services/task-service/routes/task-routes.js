// business-services/task-service/routes/task-routes.js

const express = require('express');
const router = express.Router();
const { findByService, findById, assignAnalyst } = require('../models/task');
const { listForTask } = require('../models/comment');
const { getUser } = require('../models/user');

// Fetch tasks tagged with a given domain service, e.g. ?service=gofeeler.
// The caller (taskfusion) is responsible for only requesting a service
// the logged-in user actually holds the matching role for.
router.get('/tasks', async (req, res) => {
  const { service } = req.query;

  if (!service) {
    return res.status(400).json({ message: 'Missing required "service" query param' });
  }

  try {
    const tasks = await findByService(service);
    res.status(200).json(tasks);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching tasks', error: err.message });
  }
});

// Single task, for the detail page — no role/ownership check here yet,
// same as GET /tasks; the frontend route is what's role-gated for now.
router.get('/tasks/:id', async (req, res) => {
  try {
    const task = await findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.status(200).json(task);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching task', error: err.message });
  }
});

// PM assigns a specific analyst to a specific unassigned task (4.1) —
// the word-cloud/dropdown flow, not the shared-pool self-claim query
// from ARCHITECTURE.md's "The task pool" (that's 4.1.2, a different
// mechanism). Body: { assigneeId } — a users.id, not a raw email, so
// the assignee is always a real synced user, not a client-supplied
// string. Validates the assignee is active and actually holds
// platform:analyst + service:{task.service} — real validation, unlike
// most of task-service's still-unenforced routes, since a bad
// assignment here corrupts task-service's own status/role invariants
// (see ARCHITECTURE.md's Task workflow table), not just a display bug.
router.patch('/tasks/:id', async (req, res) => {
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

// Nested one level deep — top-level comments with their (at most one
// level of) replies attached. Read-only for now: no POST yet, comments
// are seeded directly (Branch 3.3 works with seeded data; real
// submission is Branch 4, alongside the rest of the end-to-end rework).
// ?visibility=internal|customer scopes to staff discussion or
// customer-facing notes; omitted, it returns both — callers showing a
// customer their own view MUST pass visibility=customer explicitly,
// same "frontend is responsible" trust posture as the rest of
// task-service until real auth enforcement lands.
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

module.exports = router;
