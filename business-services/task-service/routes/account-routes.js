// business-services/task-service/routes/account-routes.js

const express = require('express');
const router = express.Router();
const {
  listForPm,
  getAccount,
  listPmsForAccount,
  listProjectsForAccount,
  listAccountsForUser,
  listAllAccounts,
  listUsersForAccount,
  accountEngagement,
  createAccount,
} = require('../models/account');

// Same "frontend is responsible, unverified claims" trust posture as
// the rest of task-service, but scoped server-side by role rather than
// relying on the frontend to only ask for what it should see:
//  - platform:account-manager — every Account, unscoped (they aren't
//    tied to specific ones the way a PM or customer is), each one
//    enriched with its customer contacts ("all accounts and the users
//    of the accounts").
//  - platform:project-manager — ownership-scoped via pm_accounts
//    (unchanged from before this branching existed — ProjectHubPage's
//    Accounts tab already depends on this exact shape).
//  - platform:customer — their own Accounts, `users.account_id` plus
//    any additional `user_accounts` membership (see db.js).
// `engagement` (services actually ordered, per Account) is included
// for every role — cheap to compute, and directly the "services
// engaged, cross-sell/upsell visibility" this page was always meant to
// show (see AmCustomersPage's original placeholder note).
router.get('/accounts', async (req, res) => {
  const userId = req.claims?.sub;
  if (!userId) return res.status(401).json({ message: 'Missing or unparseable Authorization token' });

  const roles = req.claims?.realm_access?.roles || [];
  const isAccountManager = roles.includes('platform:account-manager');

  try {
    let accounts;
    if (isAccountManager) {
      accounts = await listAllAccounts();
    } else if (roles.includes('platform:project-manager')) {
      accounts = await listForPm(userId);
    } else if (roles.includes('platform:customer')) {
      accounts = await listAccountsForUser(userId);
    } else {
      return res.status(403).json({ message: 'No role eligible to view accounts' });
    }

    const enriched = await Promise.all(
      accounts.map(async (account) => ({
        ...account,
        engagement: await accountEngagement(account.id),
        projects: await listProjectsForAccount(account.id),
        ...(isAccountManager ? { customers: await listUsersForAccount(account.id) } : {}),
      }))
    );
    res.status(200).json(enriched);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching accounts', error: err.message });
  }
});

// account-manager only — the customer-facing side creates a Project
// under an existing Account (see project-routes.js's POST /projects);
// the Account itself is account-manager-initiated, matching who owns
// the commercial relationship (ARCHITECTURE.md's Roles and
// permissions).
router.post('/accounts', async (req, res) => {
  const roles = req.claims?.realm_access?.roles || [];
  if (!roles.includes('platform:account-manager')) {
    return res.status(403).json({ message: 'Requires platform:account-manager' });
  }

  const { name, type } = req.body;
  if (!name?.trim() || !['company', 'individual'].includes(type)) {
    return res.status(400).json({ message: '"name" is required and "type" must be "company" or "individual"' });
  }

  try {
    const account = await createAccount({ type, name: name.trim() });
    res.status(201).json({ ...account, engagement: [], projects: [], customers: [] });
  } catch (err) {
    res.status(500).json({ message: 'Error creating account', error: err.message });
  }
});

// Same privacy boundary as task-routes.js's isCustomerOnly — a
// customer must never see another customer's Account (contacts,
// projects, task counts).
router.get('/accounts/:id', async (req, res) => {
  try {
    const account = await getAccount(req.params.id);
    if (!account) return res.status(404).json({ message: 'Account not found' });

    const roles = req.claims?.realm_access?.roles || [];
    const isCustomerOnly = roles.includes('platform:customer') && !roles.includes('platform:project-manager');
    if (isCustomerOnly) {
      const myAccounts = await listAccountsForUser(req.claims.sub);
      if (!myAccounts.some((a) => a.id === account.id)) {
        return res.status(403).json({ message: "Not an Account you belong to" });
      }
    }

    const [pms, projects, customers, engagement] = await Promise.all([
      listPmsForAccount(account.id),
      listProjectsForAccount(account.id),
      listUsersForAccount(account.id),
      accountEngagement(account.id),
    ]);
    res.status(200).json({ ...account, pms, projects, customers, engagement });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching account', error: err.message });
  }
});

module.exports = router;
