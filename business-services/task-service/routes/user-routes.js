// business-services/task-service/routes/user-routes.js

const express = require('express');
const router = express.Router();
const { listUsers, getUser, setActive } = require('../models/user');

// Users are only ever populated via JIT sync (middleware/auth.js) — no
// role/ownership check here yet, same "frontend is responsible" trust
// posture as the rest of task-service. The Admin Users page is the
// only caller today, gated client-side on platform:admin.
router.get('/users', async (req, res) => {
  try {
    const users = await listUsers();
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

router.get('/users/:id', async (req, res) => {
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
router.patch('/users/:id', async (req, res) => {
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
