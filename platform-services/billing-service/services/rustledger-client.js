// platform-services/billing-service/services/rustledger-client.js
//
// rustledger is the ledger of record for bills (rustledger/src/bills.rs) —
// billing-service never touches Postgres itself, it's "middleware in front
// of rustledger" per this service's own README. The caller's own
// Authorization header is forwarded on the gated rustledger routes
// (create/get) since rustledger re-checks the role itself rather than
// trusting billing-service's own check — same defense-in-depth posture as
// every other cross-service call in this stack forwarding claims onward
// where the downstream service also gates. mark-paid has no such gate
// (rustledger/src/api.rs's comment on that route) — it's called from the
// Stripe webhook handler, which has no end-user token to forward.
const RUSTLEDGER_URL = process.env.RUSTLEDGER_URL || 'http://microverse-rustledger:8080';

async function createBill({ taskId, customerId, amountCents, currency, authHeader }) {
  const res = await fetch(`${RUSTLEDGER_URL}/api/bills`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authHeader },
    body: JSON.stringify({
      task_id: taskId,
      customer_id: customerId,
      amount_cents: amountCents,
      currency,
    }),
  });
  if (!res.ok) {
    throw new Error(`rustledger create-bill returned ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function getBillByTask(taskId, authHeader) {
  const res = await fetch(`${RUSTLEDGER_URL}/api/bills/by-task/${taskId}`, {
    headers: { Authorization: authHeader },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`rustledger get-bill returned ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function markBillPaid(taskId, { stripeCheckoutSessionId, stripePaymentIntentId }) {
  const res = await fetch(`${RUSTLEDGER_URL}/api/bills/${taskId}/mark-paid`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      stripe_checkout_session_id: stripeCheckoutSessionId,
      stripe_payment_intent_id: stripePaymentIntentId,
    }),
  });
  if (!res.ok) {
    throw new Error(`rustledger mark-paid returned ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

module.exports = { createBill, getBillByTask, markBillPaid };
