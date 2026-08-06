// business-services/task-service/routes/project-routes.js

const express = require('express');
const router = express.Router();
const { listForPm, getProject, listTasksForProject } = require('../models/project');

const SERVICE_PREFIX = 'service:';

function serviceScopesFrom(claims) {
  return (claims?.realm_access?.roles || [])
    .filter((role) => role.startsWith(SERVICE_PREFIX))
    .map((role) => role.slice(SERVICE_PREFIX.length));
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
// get you every task type inside it.
router.get('/projects/:id', async (req, res) => {
  try {
    const project = await getProject(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const tasks = await listTasksForProject(project.id, serviceScopesFrom(req.claims));
    res.status(200).json({ ...project, tasks });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching project', error: err.message });
  }
});

module.exports = router;
