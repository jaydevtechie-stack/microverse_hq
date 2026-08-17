// platform-services/billing-service/services/stripe.js
//
// billing-service is the only service in this stack that talks to Stripe —
// rustledger stays a pure ledger (no Stripe SDK in Rust), per this
// service's role as "middleware in front of rustledger." Test-mode key
// expected in STRIPE_SECRET_KEY (sk_test_...), same env-var-driven config
// posture as rustledger's own DEFAULT_HOURLY_RATE_CENTS.
//
// Lazily constructed — the Stripe SDK throws at `new Stripe(...)` time if
// no API key is set at all, not just when an actual API call is made. Bill
// create/get (rustledger) work fine with no Stripe key configured; only
// checkout-session creation and the webhook handler actually need one, so
// module load must not crash the whole service just because Stripe isn't
// configured yet.
const Stripe = require('stripe');

let stripeClient;

function getStripe() {
  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripeClient;
}

module.exports = { getStripe };
