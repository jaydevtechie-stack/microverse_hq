# workflow

**Status:** not yet implemented — folder scaffold only.

Orchestrates the order lifecycle end to end: customer submits an order →
PM (human or agentic) assigns it as a task/quest to an analyst →
analyst's work is tracked → billed. Ties together
[`order-service`](../order-service/README.md),
[`task-service`](../task-service/README.md), and the
platform-services middleware layers
([`tracking-service`](../../platform-services/tracking-service/README.md),
[`billing-service`](../../platform-services/billing-service/README.md)) —
the "narrator" that knows the whole story, rather than any single step
of it.
