// platform-services/billing-service/routes/billing-routes.js
//
// Per-route role checks inline rather than one blanket gate in index.js —
// PM-create and customer-pay need different roles, same pattern as
// task-routes.js's per-route requireAnyRealmRole rather than
// audit-routes.js's single shared gate.
const express = require('express');
const { requireAnyRealmRole } = require('../middleware/auth');
const { fetchTask } = require('../services/task-client');
const rustledger = require('../services/rustledger-client');
const { getStripe } = require('../services/stripe');

const router = express.Router();

// Where Stripe Checkout sends the browser back to — the task detail page
// customers already land on (applications/taskfusion's /task/:id route),
// same page CustomerProgressPanel.js's button lives on.
const APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost';

// PM creates the bill once a task reaches 'done' (task.approved). Amount
// is entered by the PM, not computed — no price/rate field exists
// anywhere on tasks or projects yet (docs/schema.md), so this is the
// manual v1 the roadmap's Branch 9 bullet describes. task_id/status/owner
// are re-verified against task-service itself (services/task-client.js)
// rather than trusted from the request body — customer_id in particular
// is *derived* from the fetched task, never accepted from the client.
router.post('/bills', requireAnyRealmRole('platform:project-manager'), async (req, res) => {
  const callerEmail = req.claims?.email;
  if (!callerEmail) {
    return res.status(401).json({ message: 'Missing or unparseable Authorization token' });
  }

  const { taskId, amountCents, currency } = req.body;
  if (!taskId || !Number.isInteger(amountCents) || amountCents <= 0 || !currency) {
    return res.status(400).json({ message: 'taskId, a positive integer amountCents, and currency are required' });
  }

  try {
    const task = await fetchTask(taskId);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    if (task.status !== 'done') {
      return res.status(409).json({ message: `Task is "${task.status}", not done` });
    }
    if (task.owner !== callerEmail) {
      return res.status(403).json({ message: "Not this task's owner" });
    }
    if (!task.customer_id) {
      return res.status(409).json({ message: 'Task has no customer to bill' });
    }

    const bill = await rustledger.createBill({
      taskId,
      customerId: task.customer_id,
      amountCents,
      currency: currency.toUpperCase(),
      authHeader: req.headers.authorization,
    });
    res.status(201).json(bill);
  } catch (err) {
    res.status(500).json({ message: 'Error creating bill', error: err.message });
  }
});

// A customer may only ever touch their own bill — PM/admin can see any
// bill (rustledger's own gate already restricted this route to those
// three roles), so the narrowing below only bites when the caller holds
// platform:customer alone.
function forbiddenForCustomer(req, bill) {
  const roles = req.claims?.realm_access?.roles || [];
  const customerOnly = roles.includes('platform:customer') && !roles.includes('platform:project-manager') && !roles.includes('platform:admin');
  return customerOnly && bill.customer_id !== req.claims?.sub;
}

router.get(
  '/bills/by-task/:taskId',
  requireAnyRealmRole('platform:project-manager', 'platform:customer', 'platform:admin'),
  async (req, res) => {
    try {
      const bill = await rustledger.getBillByTask(req.params.taskId, req.headers.authorization);
      if (!bill) return res.status(404).json({ message: 'No bill for that task' });
      if (forbiddenForCustomer(req, bill)) {
        return res.status(403).json({ message: "Not this customer's bill" });
      }
      res.status(200).json(bill);
    } catch (err) {
      res.status(500).json({ message: 'Error fetching bill', error: err.message });
    }
  }
);

// Customer clicks "View invoice" (CustomerProgressPanel.js) — creates a
// Stripe-hosted Checkout Session for the bill's amount and redirects the
// browser there. client_reference_id carries taskId through to the
// webhook (routes/stripe-webhook.js), since that's the one durable
// identifier both sides agree on.
router.post(
  '/bills/by-task/:taskId/checkout-session',
  requireAnyRealmRole('platform:customer'),
  async (req, res) => {
    try {
      const bill = await rustledger.getBillByTask(req.params.taskId, req.headers.authorization);
      if (!bill) return res.status(404).json({ message: 'No bill for that task' });
      if (forbiddenForCustomer(req, bill)) {
        return res.status(403).json({ message: "Not this customer's bill" });
      }
      if (bill.status === 'paid') {
        return res.status(409).json({ message: 'Bill already paid' });
      }

      const session = await getStripe().checkout.sessions.create({
        mode: 'payment',
        client_reference_id: req.params.taskId,
        line_items: [
          {
            price_data: {
              currency: bill.currency.toLowerCase(),
              unit_amount: bill.amount_cents,
              product_data: { name: `Microverse task ${req.params.taskId}` },
            },
            quantity: 1,
          },
        ],
        success_url: `${APP_BASE_URL}/task/${req.params.taskId}`,
        cancel_url: `${APP_BASE_URL}/task/${req.params.taskId}`,
      });

      res.status(200).json({ url: session.url });
    } catch (err) {
      res.status(500).json({ message: 'Error creating checkout session', error: err.message });
    }
  }
);

module.exports = router;
