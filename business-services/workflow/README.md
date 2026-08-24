# workflow

**Status:** not yet implemented — folder scaffold only.

Orchestrates the order lifecycle end to end: customer submits an order
(a [`task-service`](../task-service/README.md) task, from `unassigned`
on — there is no separate order-service or Order entity, see
[docs/architecture/1.0/business-services.md](../../docs/architecture/1.0/business-services.md))
→ PM (human or agentic) assigns it to an analyst → analyst's work is
tracked → billed. Ties together
[`task-service`](../task-service/README.md),
[`tracking-service`](../../platform-services/tracking-service/README.md), and
[`rustledger`](../../domain-services/rustledger) (billing — there is no
separate billing-service, rustledger owns Stripe collection directly) —
the "narrator" that knows the whole story, rather than any single step
of it.
