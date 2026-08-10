// business-services/task-service/routes/project-routes.js

const express = require('express');
const router = express.Router();
const { listForPm, getProject, listTasksForProject, createProject, approveProject } = require('../models/project');
const { listAccountsForUser } = require('../models/account');

const SERVICE_PREFIX = 'service:';

function serviceScopesFrom(claims) {
  return (claims?.realm_access?.roles || [])
    .filter((role) => role.startsWith(SERVICE_PREFIX))
    .map((role) => role.slice(SERVICE_PREFIX.length));
}

// Same privacy boundary as task-routes.js's isCustomerOnly — a
// customer must never see another customer's data (here: another
// Account's project/task titles), not just another customer's task
// list. PM-first precedence, same reasoning as task-routes.js.
function isCustomerOnly(req) {
  const roles = req.claims?.realm_access?.roles || [];
  return roles.includes('platform:customer') && !roles.includes('platform:project-manager');
}

// Ownership-scoped to the caller, same as /accounts.
router.get('/projects', async (req, res) => {
  const pmId = req.claims?.sub;
  if (!pmId) return res.status(401).json({ message: 'Missing or unparseable Authorization token' });

  try {
    const projects = await listForPm(pmId);
    res.status(200).json(projects);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching projects', error: err.message });
  }
});

// Tasks nested in the response are additionally filtered to the
// caller's own service:* scopes — the second, independent half of the
// Project Hub's access rule (see ARCHITECTURE.md's Roles and
// permissions). Owning the Account gets you the Project; it doesn't
// get you every task type inside it. account-manager is the exception —
// same as platform:admin needing no service pairing at all, an
// account-manager isn't tied to one service either, so their view isn't
// filtered.
router.get('/projects/:id', async (req, res) => {
  try {
    const project = await getProject(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    if (isCustomerOnly(req)) {
      const myAccounts = await listAccountsForUser(req.claims.sub);
      if (!myAccounts.some((a) => a.id === project.account_id)) {
        return res.status(403).json({ message: "Not an Account you belong to" });
      }
    }

    const roles = req.claims?.realm_access?.roles || [];
    const isAccountManager = roles.includes('platform:account-manager');
    const tasks = await listTasksForProject(project.id, isAccountManager ? null : serviceScopesFrom(req.claims));
    res.status(200).json({ ...project, tasks });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching project', error: err.message });
  }
});

// Customer creates a project under one of their own Accounts — starts
// 'dormant', pending account-manager approval (see models/project.js).
// Ownership check reuses listAccountsForUser rather than trusting a
// client-supplied accountId outright — a customer can only propose a
// project on an Account they're actually recognized on.
router.post('/projects', async (req, res) => {
  const customerId = req.claims?.sub;
  if (!customerId) return res.status(401).json({ message: 'Missing or unparseable Authorization token' });

  const roles = req.claims?.realm_access?.roles || [];
  if (!roles.includes('platform:customer')) {
    return res.status(403).json({ message: 'Requires platform:customer' });
  }

  const { accountId, name } = req.body;
  if (!accountId || !name?.trim()) {
    return res.status(400).json({ message: '"accountId" and "name" are required' });
  }

  try {
    const myAccounts = await listAccountsForUser(customerId);
    if (!myAccounts.some((a) => a.id === accountId)) {
      return res.status(403).json({ message: 'Not an Account you belong to' });
    }

    const project = await createProject({ accountId, name: name.trim() });
    res.status(201).json(project);
  } catch (err) {
    res.status(500).json({ message: 'Error creating project', error: err.message });
  }
});

// account-manager moves a dormant (pending) project to active — the
// only project status transition that exists so far, matching how
// little of the rest of the workflow state machine is real yet either
// (see task-routes.js's closed_at comment for the same "stub now, build
// later" posture elsewhere in this service).
router.patch('/projects/:id/approve', async (req, res) => {
  const roles = req.claims?.realm_access?.roles || [];
  if (!roles.includes('platform:account-manager')) {
    return res.status(403).json({ message: 'Requires platform:account-manager' });
  }

  try {
    const project = await approveProject(req.params.id);
    if (!project) {
      return res.status(409).json({ message: 'Project not found or not pending approval' });
    }
    res.status(200).json(project);
  } catch (err) {
    res.status(500).json({ message: 'Error approving project', error: err.message });
  }
});

module.exports = router;
