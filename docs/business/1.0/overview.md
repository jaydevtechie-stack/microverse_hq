# Microverse — business design

Distinct from [docs/architecture/1.0/core.md](../../architecture/1.0/core.md) (system structure), [docs/roadmap/1.0/core.md](../../roadmap/1.0/core.md) (build sequence), and [docs/schema.md](../../schema.md) (DB shape) — this is where business policy and commercial terms get worked out: pricing, contracts, payment timing, payouts. Decisions made here eventually become rules enforced in `rustledger`, and get their own entry in [docs/schema.md](../../schema.md) once actually designed.

This content is inherently cross-cutting rather than owned by one component folder — Account/Contract/Payout policy touches domain services (GoFeeler, rustledger) and business services (order-service, task-service) all at once.

**Not to be confused with the `business-services` tier** ([docs/architecture/1.0/business-services.md](../../architecture/1.0/business-services.md)/[docs/roadmap/1.0/business-services.md](../../roadmap/1.0/business-services.md)) — that's the technical component group (order-service, task-service, workflow). This `docs/business/` folder is about actual business decisions, made by the people running the business, not the services that implement them. See [docs/business/1.0/product-strategy.md](product-strategy.md) for the product-identity side (what each product does, what it stands for, what's being sold) — this file covers the commercial/operational policy side instead.

## Account management

- **An Account isn't locked to one service.** A client buying a second service (e.g. GoFeeler → GoFeeler + SpringPix) is the **Upsell** in action — the schema was designed to support this from the start (`tasks.service` is per-task, not per-account).
- **Multiple PMs can own the same Account, each scoped to a different service.** Matthew might own Acme Forestry's GoFeeler work while Lydia owns its SpringPix work — same Account, different service lenses. This is a real access control (see [docs/architecture/1.0/core.md](../../architecture/1.0/core.md)'s Roles and permissions: ownership via `pm_accounts` + service scope are two independent checks), but it's also a genuine account-management pattern real agencies use — a large client often has a *team* of Account Managers/specialists rather than one person owning everything.
- **This makes cross-sell/upsell tracking natural rather than bolted on** — since an Account's engagement across services is already visible in one place (the Project Hub), spotting "this Account only has GoFeeler, might they want SpringPix too" is a query away, not a separate analytics project.

## Contracts

**Resolved: a Project *is* the contract unit** — not a separate entity, and not attached at the Account level. Each Project represents one agreed-upon engagement, so contract terms live as fields on `projects` ([docs/schema.md](../../schema.md)) rather than a parallel `contracts` table that would just duplicate the same 1:1 relationship. An Account can still have different terms across different Projects (e.g. a rush engagement with different payment timing than a standing monthly one) — that flexibility was the whole point of Project existing as its own entity in the first place.

Still open:

- **Payment timing** — upfront vs. net terms (e.g. net-30)? Does work start before payment clears, or does `unassigned → analyst` require a contract/payment state check first? This becomes a field on `projects` (e.g. `payment_terms`) once decided.
- **Where the enforcement logic lives** — inside `rustledger` as invoice-generation rules reading `projects.payment_terms`, or a separate concern? Previously deferred as "let it be a business decision" — still undecided.
- **Contract history/renegotiation** — if a Project's terms change mid-engagement, does that need versioning (same pattern as `task_comments`), or is a straight `UPDATE` on `projects` sufficient for now? Not urgent — only matters once contracts actually change after creation.

## Payouts (PMs and analysts)

Flagged in [docs/roadmap/1.0/domain-services.md](../../roadmap/1.0/domain-services.md)'s Phase 9 as genuinely new, undesigned scope — collecting from customers and paying out to staff are different flows, not opposite sides of the same one. Deferred to 1.1 along with the rest of the non-GoFeeler domain-service work — see [docs/roadmap/1.1/domain-services.md](../../roadmap/1.1/domain-services.md) for the open questions.

- **Mechanism** — Stripe Connect is the obvious candidate for payouts, but unconfirmed.
- **Payout basis** — hourly rate from `elixtempo`'s tracked time? A per-task flat rate? Something else?
- **Timing dependency** — does an analyst only get paid once the customer's invoice actually clears (payout gated on collection), or are the two decoupled (Microverse pays staff on its own schedule regardless of customer payment status)? This materially affects cash-flow risk and is worth a deliberate answer, not a default.

## Pricing

Not yet discussed.

## Glossary — business terminology mapped to Microverse concepts

Kept here as a growing reference — the industry term, plain English, and where it shows up in this project.

| Term | Plain English | In Microverse |
|---|---|---|
| **Account** | The organization itself | `accounts` — company or individual, the billing entity |
| **Contact** | A person at an Account | `customers` — a login under an Account |
| **Engagement** | A piece of ongoing work with a client | `projects` — what we call Project |
| **SOW** (Statement of Work) | The document defining an engagement's scope and terms | Merged into `projects.payment_terms` rather than a separate table — normal for smaller service businesses where one SOW = one engagement |
| **Deliverable** | The actual output handed to the client | A completed Order/Task |
| **SLA** (Service Level Agreement) | A commitment on response/turnaround time | Directly relevant to Phase 8's analyst reaction-time tracking |
| **Retainer** | An ongoing paid arrangement, not one-off | A Project with recurring `payment_terms` instead of a single SOW |
| **Milestone** | A checkpoint within an engagement | Could map to task status transitions later |
| **Churn** | When an Account stops renewing/engaging | Not yet tracked — worth revisiting once Accounts has real usage data |
| **Upsell** | Selling more to an existing Account | An Account adding a SpringPix engagement on top of GoFeeler — see "Account management" above for how this is naturally visible, not a separate report |
| **NET-30 / NET-60** | Payment due 30/60 days after invoicing | A concrete value for `projects.payment_terms` |
