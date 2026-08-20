# Architecture — domain services

Customer-facing, one specialist trick each, real brand names. See [core.md](core.md) for the tier test and the shared entity/roles/task-workflow model these all plug into.

**1.0 scope is GoFeeler + TaskFusion, live — everything else moved to 1.1.** Of the original seven-service polyglot lineup, GoFeeler is the only one actually built out end-to-end; the rest were always further out. Rather than let that stay implicit, 1.0 is now scoped honestly to what's actually shipped: GoFeeler (this table) plus the platform/business services that make it work. The other six domain services live in [docs/architecture/1.1/domain-services.md](../1.1/domain-services.md).

| Service | Tech | What it does | Status |
|---|---|---|---|
| GoFeeler | Go | Sentiment analysis on uploaded chats/emails/comments | Online — `basic` keyword engine + `advanced` LLM engine (OpenAI), see Branch 5 below |
| rustledger | Rust | Billing ledger — owns Stripe collection directly (Checkout Sessions, webhook verification, `async-stripe` crate) for GoFeeler's customer bills | Customer billing collection built and live-verified (Branch 9). Analyst/PM **payout** disbursement (the other half of rustledger's eventual scope, consuming elixtempo's time-entry events) is 1.1 — see [docs/roadmap/1.1/domain-services.md](../../roadmap/1.1/domain-services.md) |

See [applications.md](applications.md) for GoFeeler's full end-to-end worked example, and [docs/roadmap/1.0/domain-services.md](../../roadmap/1.0/domain-services.md) for build status/branch plan.

## GoFeeler — engine abstraction (Branch 5) — ✅ built

GoFeeler stays a single service with a single analyst-facing interface. The LLM upgrade is a second **engine**, not a second app, not a service split — the two engines share the same input/output contract (text in, sentiment result out), which is a strategy pattern, not a bounded-context split. Revisit the split-service question only if the LLM path grows its own independent scaling/cost/queueing concerns.

Built at `domain-services/gofeeler/app/{engine,provider,db,store}/` — see [docs/roadmap/1.0/domain-services.md](../../roadmap/1.0/domain-services.md)'s Branch 5 for what shipped vs. deferred (template edit is the one open item).

```
SentimentEngine (interface)
├── basic     — existing keyword matcher, no external dependency, always available
└── advanced  — LLM-backed, calls out via Provider
                 └── Provider (interface): Complete(prompt, opts) (Result, error)
```

- **`SentimentEngine`** — `Analyze(text, opts) (Result, error)`. Every result stamps `engine_used` so it's traceable after the fact.
- **`Provider`** — the plug-and-play seam underneath `advanced`. A new LLM provider (or a future call into `intelligence/ai-tools`, see [docs/architecture/2.0/intelligence.md](../2.0/intelligence.md)) is a new implementation of this one interface, selected by config — no change to engine logic required. GoFeeler-local for now, deliberately: it's the first consumer of LLM capability in the stack, and the project's own threshold is "introduce as a shared service when a second consumer appears." Not a rewrite risk either way — `ai-tools`, whenever it exists, is just another `Provider` implementation.
- **`sentiment_prompt_templates`** (Postgres) — shared pool visible to all analysts, self-service create/edit, small preconfigured default set (`is_system_default`). This is a runtime, analyst-authored library, distinct from `intelligence/prompts`'s version-controlled, dev-curated prompt text for agent reasoning ([docs/architecture/2.0/intelligence.md](../2.0/intelligence.md)) — same word, different audience and mechanism, worth not conflating.
- Every analysis result stamps `engine_used`, `template_id`, `llm_provider`, `model_version` — reproducibility fields, not decoration. Two `advanced`-engine results aren't comparable unless all four match. See [docs/schema.md](../../schema.md) for storage shape and [docs/security.md](../../security.md) for the governance side (prompt-injection surface, spend exposure).

## rustledger — Stripe integration (Branch 9) — ✅ built

Customer bill collection needed a real payment processor, not a placeholder — something has to actually take a card number, handle 3D Secure/SCA, and keep PCI compliance entirely off Microverse's own servers. Stripe was already the spec'd choice before this branch started (the original `platform-services.md` billing-service entry named it); this branch is where it actually got built, and confirms the choice held up in practice: **Checkout** (Stripe's own hosted payment page, not a custom card form) means Microverse's code never touches a raw card number at any point, **test mode** is free and fully-featured with no business verification needed to develop against, and **webhook signature verification** is a well-documented, well-trodden pattern — none of it had to be invented here, just wired up correctly.

```
PM creates a bill (rustledger, draft — see Branch 9 in the roadmap for
the create/publish split) ──── AM publishes it
                                      │
                          bill.published (Kafka)
                                      │
                                      ▼
                     notification-service → customer email + in-app
                                      │
customer clicks "View invoice" ──────┘
        │
        ▼
POST .../checkout-session → Stripe-hosted Checkout page
        │
        ▼
customer pays (test card 4242 4242 4242 4242 in dev)
        │
        ├── Stripe redirects the browser back to /task/:id (feels like
        │   confirmation — isn't; see below)
        │
        └── Stripe's own servers separately POST the real confirmation
                    │
                    ▼
        POST /api/billing/webhooks/stripe (HMAC-signed, verified
        against STRIPE_WEBHOOK_SECRET)
                    │
                    ▼
        rustledger marks the bill paid → publishes bill.paid on Kafka
        → task-service flips the task to 'paid'
```

- **rustledger owns Stripe directly** — Checkout Session creation and webhook verification live in `domain-services/rustledger/src/stripe_client.rs`, no separate billing-service in front of it. An earlier pass in this branch built exactly that split (a Node middleware owning Stripe, rustledger staying a "pure ledger"); reversed once it was clear rustledger already owned the billing domain by name and by its existing analyst-payout `line_items` table. See [docs/roadmap/1.0/domain-services.md](../../roadmap/1.0/domain-services.md)'s Branch 9 for the full back-and-forth.
- **`async-stripe` (0.41.0)** is the crate — Rust isn't one of Stripe's officially maintained SDK languages, but this community crate is actively maintained and covers what's needed (`CheckoutSession::create`, `Webhook::construct_event`). Use its **default Cargo features** — a hand-picked `default-features = false` subset leaves a dangling type reference in the crate's own generated webhook-event enum (it references types gated behind *other* domain features regardless of which ones are actually enabled) and fails to compile. Hit this directly; not documented anywhere obvious in the crate itself.
- **The browser redirect and the payment confirmation are two separate paths, not one.** Stripe's `success_url` redirect happens the instant checkout completes client-side and *feels* like confirmation, but the bill only actually flips to `paid` once Stripe's own servers independently POST the webhook — a customer closing their browser right after paying, before that webhook lands, would (correctly) still show the bill as unpaid for a moment. This matters most in local development, since `microverse.local` isn't a publicly reachable HTTPS URL Stripe's servers can call directly: local testing needs the Stripe CLI's `listen` command tunneling events in from a real Stripe test account (a Docker-only path exists too, no native install needed — see [docs/development/TESTING.md](../../development/TESTING.md)'s Branch 9 section).
- **Webhook auth is a shared secret, not an API key — the two are easy to mix up.** `STRIPE_WEBHOOK_SECRET` (a `whsec_...` value, printed by `stripe listen` or found on a Dashboard webhook endpoint's settings page) is used purely for local HMAC verification of the raw request body; it has nothing to do with `STRIPE_SECRET_KEY` (the `sk_test_.../rk_test_...` value actually used to call Stripe's API and create Checkout Sessions). Pasting an API key into the webhook-secret slot by mistake fails signature verification with an opaque 400, not an error that points at the mismatch.
