// platform-services/billing-service/routes/stripe-webhook.js
//
// Mounted in index.js with express.raw({ type: 'application/json' })
// ahead of the app's express.json() — stripe.webhooks.constructEvent
// needs the exact raw request body to verify the signature; a
// JSON-parsed-and-restringified body would fail verification. This is
// the one route in the service that can't go through the normal JSON
// body parsing every other route uses.
const { getStripe } = require('../services/stripe');
const rustledger = require('../services/rustledger-client');
const { publishBillPaid } = require('../events/kafka-producer');

async function stripeWebhookHandler(req, res) {
  const signature = req.headers['stripe-signature'];
  let event;
  try {
    event = getStripe().webhooks.constructEvent(req.body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err.message);
    return res.status(400).json({ message: `Webhook Error: ${err.message}` });
  }

  if (event.type !== 'checkout.session.completed') {
    return res.status(200).json({ received: true });
  }

  const session = event.data.object;
  const taskId = session.client_reference_id;
  if (!taskId) {
    console.error('checkout.session.completed had no client_reference_id, skipping');
    return res.status(200).json({ received: true });
  }

  try {
    const { bill } = await rustledger.markBillPaid(taskId, {
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: session.payment_intent,
    });
    // bill is null on a redelivered webhook for an already-paid bill
    // (rustledger's WHERE status = 'unpaid' guard) — nothing new to
    // publish in that case, same idempotency posture as every Kafka
    // consumer in this stack.
    if (bill) {
      await publishBillPaid(bill);
    }
    res.status(200).json({ received: true });
  } catch (err) {
    console.error(`Error marking bill paid for task ${taskId}:`, err.message);
    res.status(500).json({ message: 'Error processing webhook' });
  }
}

module.exports = { stripeWebhookHandler };
