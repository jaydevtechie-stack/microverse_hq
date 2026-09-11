# workflow

**Status:** the one concrete gap this was meant to close — `paid → closed`
auto-close — is built, but it lives in
[`task-service`](../task-service/README.md) (`cron/task-polling.js`'s
`initAutoClose`), not here. This folder stays a placeholder for a real
BPMN/Camunda-Zeebe engine.

Why: the rest of the Task state machine (`unassigned → analyst → reviewer →
done → paid`) already works — built and live-verified entirely inside
task-service's own route handlers across GoFeeler Branches 4-9, no external
engine involved. `paid → closed` was the only leg with no human or event
trigger of its own (kudos is 1.1 scope — DjaBoard/RubyKudos aren't started, so
that leg is out of reach regardless), which is exactly the kind of job a
scheduled sweep can own on its own — task-service already had the pattern for
one (`cron/task-polling.js`'s existing 5-minute polling job). Standing up a
first-ever Java service in this repo (new build tooling, base image, CI
workflow) purely to run a daily column-flip would have been disproportionate
to what was actually missing. See
[docs/architecture/1.0/business-services.md](../../docs/architecture/1.0/business-services.md)'s
"workflow — slice 1" for the full writeup.

A real engine here stays deliberately deferred until a second real consumer of
the Task state machine needs one — the leading candidate is
[docs/roadmap/2.0/intelligence.md](../../docs/roadmap/2.0/intelligence.md)'s
agentic workforce. When that happens, this is where it lands: orchestrating the
order lifecycle end to end — customer submits an order (a task-service task,
from `unassigned` on — there is no separate order-service or Order entity) →
PM (human or agentic) assigns it to an analyst → analyst's work is tracked →
billed → closed. Ties together
[`task-service`](../task-service/README.md) and
[`rustledger`](../../domain-services/rustledger) (billing — there is no
separate billing-service, rustledger owns Stripe collection directly) — the
"narrator" that knows the whole story, rather than any single step of it.
