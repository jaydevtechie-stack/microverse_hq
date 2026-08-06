// business-services/task-service/routes/account-routes.js

const express = require('express');
const router = express.Router();
const { listForPm, getAccount, listPmsForAccount, listProjectsForAccount } = require('../models/account');

// Ownership-scoped to the caller (req.claims.sub, set by
// middleware/auth.js's syncUser) — same "frontend is responsible,
// unverified claims" trust posture as the rest of task-service, but
// this endpoint at least does real server-side filtering rather than
// relying on the frontend to only ask for what it should see.
router.get('/accounts', async (req, res) => {
  const pmId = req.claims?.sub;
  if (!pmId) return res.status(401).json({ message: 'Missing or unparseable Authorization token' });

  try {
    const accounts = await listForPm(pmId);
    res.status(200).json(accounts);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching accounts', error: err.message });
  }
});

router.get('/accounts/:id', async (req, res) => {
  try {
    const account = await getAccount(req.params.id);
    if (!account) return res.status(404).json({ message: 'Account not found' });

    const [pms, projects] = await Promise.all([
      listPmsForAccount(account.id),
      listProjectsForAccount(account.id),
    ]);
    res.status(200).json({ ...account, pms, projects });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching account', error: err.message });
  }
});

module.exports = router;
