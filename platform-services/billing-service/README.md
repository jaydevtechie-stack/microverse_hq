# billing-service

Node/Express — matches the shape of [`audit-service`](../audit-service)
and [`notification-service`](../notification-service), not the
"Python (Stripe SDK)" spec in
[docs/architecture/1.0/platform-services.md](../../docs/architecture/1.0/platform-services.md),
which predated those two services and the platform-service conventions
they established.

Middleware in front of
[`rustledger`](../../domain-services/rustledger) (the Rust billing
service) — the layer other platform/domain services talk to instead of
calling RustLedger's bill API directly. Stateless (no Postgres, no
`ensureSchema()`): bills are persisted in rustledger's own database;
billing-service just orchestrates the PM-create / customer-pay flow and
owns the Stripe integration (Checkout Sessions, webhook verification) —
rustledger stays a pure ledger with no Stripe SDK.

Branch 9 — customer billing/collection only. PM/analyst payouts are
separate, undesigned scope (see
[docs/business/1.0/overview.md](../../docs/business/1.0/overview.md)'s
Payouts section).
