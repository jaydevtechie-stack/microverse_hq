# Roadmap — business services

See [docs/roadmap/1.0/core.md](core.md) for the status key and [docs/architecture/1.0/business-services.md](../../architecture/1.0/business-services.md) for the service table this builds toward.

## Up next (not yet planned in detail)

- workflow (Camunda) — the Order → Task → paid → closed state machine (see [docs/architecture/1.0/core.md](../../architecture/1.0/core.md)'s Task workflow)

Most of task-service's actual build progress so far has ridden along with [GoFeeler's branch plan](domain-services.md) (Branch 4's `users`/`accounts`/`projects` tables, 4.1's assignment endpoint, etc.) rather than being tracked separately here.

## Done

- ✅ task-service — the shared pool, analyst self-claim. Pick-from-list, not a blind grab: `GET /tasks/pool?service=` lists every `unassigned` task in the caller's service scope, `POST /tasks/:id/claim` claims a specific one. Race-safety is a plain atomic conditional `UPDATE ... WHERE status = 'unassigned' RETURNING` (same shape as the existing PM-assign path) rather than `FOR UPDATE SKIP LOCKED` — see [docs/architecture/1.0/business-services.md](../../architecture/1.0/business-services.md)'s "The task pool" for why that's still the right primitive for a *blind* claim-next, just not this pick-from-list flow. Coexists with PM assignment (4.1) — both remain, no toggle. Publishes a new `task.claimed` event (search-service reindexes it for free, no consumer change needed) and notifies the account's PM(s) via notification-service. Frontend: `GofeelerListPanel`'s "My tasks / Open pool" toggle (analyst-only) + `ClaimPanel` (`TaskDetailContent`'s action panel for an analyst viewing an unassigned task).
