// platform-services/billing-service/index.js
const express = require('express');
const { syncClaims } = require('./middleware/auth');
const billingRoutes = require('./routes/billing-routes');
const { stripeWebhookHandler } = require('./routes/stripe-webhook');

const app = express();

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Mounted ahead of express.json() below, with express.raw() instead —
// Stripe signature verification needs the raw request body (see
// routes/stripe-webhook.js's header comment). Stripe itself is the
// caller here, so no syncClaims/role gate — signature verification is
// this route's auth.
app.post('/billing/webhooks/stripe', express.raw({ type: 'application/json' }), stripeWebhookHandler);

app.use(express.json());

// Per-route role checks live in billing-routes.js itself (PM-create vs.
// customer-pay need different roles) — syncClaims here just parses the
// token once so every route downstream has req.claims available.
app.use('/billing', syncClaims, billingRoutes);

// No ensureSchema()/Postgres here, unlike audit-service/notification-
// service — billing-service is stateless by design (README: "middleware
// in front of rustledger"), so there's nothing to migrate on boot.

const PORT = process.env.PORT || 4003;
app.listen(PORT, () => {
  console.log(`Billing service listening on port ${PORT}`);
});
