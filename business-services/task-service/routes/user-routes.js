// business-services/task-service/routes/user-routes.js

const express = require('express');
const router = express.Router();
const { listUsers, getUser, setActive } = require('../models/user');
const { requireRealmRole } = require('../middleware/auth');

// Admin Users page is the only real caller of GET /users, GET
// /users/:id, and PATCH /users/:id (the ?platformRole=&service= filter
// this comment used to describe has no actual caller — PM assignment
// goes through /tasks/:id/recommended-analysts instead). Previously
// unchecked server-side, relying on the frontend being platform:admin-
// gated only — closed the OWASP A01 finding (docs/security.md) by
// requiring platform:admin here too, matching service-routes.js's
// pattern for the same role.
router.get('/users', requireRealmRole('platform:admin'), async (req, res) => {
  const { platformRole, service } = req.query;
  try {
    const users = await listUsers({ platformRole, service });
    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching users', error: err.message });
  }
});

// The one endpoint an inactive user can still call — see
// middleware/auth.js's ACTIVE_CHECK_ALLOWLIST. Registered before
// '/users/:id' so "me" isn't swallowed as a literal id. Resolves via
// req.claims.sub (set by syncUser) rather than trusting a client-
// supplied id — a user can only ever fetch their own row this way.
router.get('/users/me', async (req, res) => {
  const id = req.claims?.sub;
  if (!id) return res.status(401).json({ message: 'Missing or unparseable Authorization token' });

  try {
    const user = await getUser(id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching user', error: err.message });
  }
});

router.get('/users/:id', requireRealmRole('platform:admin'), async (req, res) => {
  try {
    const user = await getUser(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching user', error: err.message });
  }
});

// Local `active` flag only — never touches Keycloak login, see
// SCHEMA.md's users. Body: { active: boolean }.
router.patch('/users/:id', requireRealmRole('platform:admin'), async (req, res) => {
  const { active } = req.body;
  if (typeof active !== 'boolean') {
    return res.status(400).json({ message: '"active" must be a boolean' });
  }

  try {
    const user = await setActive(req.params.id, active);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ message: 'Error updating user', error: err.message });
  }
});

module.exports = router;
