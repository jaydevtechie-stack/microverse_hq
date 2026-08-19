# workflow

**Status:** not yet implemented — folder scaffold only.

Orchestrates the order lifecycle end to end: customer submits an order →
PM (human or agentic) assigns it as a task/quest to an analyst →
analyst's work is tracked → billed. Ties together
[`order-service`](../order-service/README.md),
[`task-service`](../task-service/README.md),
[`tracking-service`](../../platform-services/tracking-service/README.md), and
[`rustledger`](../../domain-services/rustledger) (billing — there is no
separate billing-service, rustledger owns Stripe collection directly) —
the "narrator" that knows the whole story, rather than any single step
of it.
