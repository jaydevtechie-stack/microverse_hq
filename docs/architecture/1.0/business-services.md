# Architecture — business services

The narrator — services that know what a Task or a Quest *is*, owning the plot rather than generic plumbing. See [core.md](core.md) for the tier test and the shared entity/roles/task-workflow model these implement.

**There is no separate order-service.** An Order isn't its own entity or component — it's the customer-facing name for a `tasks` row across its entire lifecycle: task-service owns creation (`POST /tasks`, a customer submitting an Order) through `analyst`/`reviewer`/`done`/`paid`/`closed`. Every `order_id` referenced elsewhere in this codebase (asset-service's MinIO object keys, the platform-services roadmap's MinIO proposal) has always meant task-service's `tasks.id`, not a lookup against a system of its own — an earlier sketch of a dedicated order-service was scaffolded but never built, and the concept it would have owned turned out to already be task-service's job.

| Service | Tech | Role |
|---|---|---|
| task-service | Node.js/Express | Owns the shared task pool (see below); customer creates an Order (a Task) and uploads media, a PM assigns Tasks to analysts |
| workflow | Java (Camunda/Zeebe) | Orchestrates the full Task (Order → analyst → reviewer → done) → time → bill → kudos sequence as an explicit state machine |

## The task pool — ✅ built

- Lives in **task-service**, backed by **PostgreSQL**.
- **Built as pick-from-list, not a blind "claim next."** An analyst browses `GET /tasks/pool?service=` (every `unassigned` task in a service they hold `service:{name}` for, oldest first — a partial index on `tasks (service, created_at) WHERE status = 'unassigned'` keeps this cheap) and claims a specific one via `POST /tasks/:id/claim`.
- **Concurrency:** claiming a *specific* row by id is race-safe with a plain atomic conditional update — the same shape `assignAnalyst` (PM-push) already uses:
  ```sql
  UPDATE tasks SET status = 'analyst', assignee = $3, owner = $3, assigned_at = now()
  WHERE id = $1 AND service = $2 AND status = 'unassigned'
  RETURNING *;
  ```
  A losing race just gets 0 rows back (→ 409), no row lock or transaction needed. `SELECT ... FOR UPDATE SKIP LOCKED ORDER BY created_at LIMIT 1` (the original design here) is still the right pattern **if** a blind "grab me the next one" endpoint is ever added on top of this — it solves a different problem (picking *which* unclaimed row, under contention, without the caller naming one) than the targeted claim above does.
- No separate pooling service or permission layer needed — the service-scope check is a route-level check against the caller's own claims, same as everywhere else in task-service.
- Coexists with the PM-push assignment path (4.1, `PATCH /tasks/:id`) — a task can be picked up either way; nothing about this restricts the other.
- Publishes `task.claimed` on the same `task-service.tasks` topic every other transition uses — search-service's indexing consumer reindexes it with no code change (it upserts on any event name), and notification-service notifies the account's PM(s) that an analyst self-claimed.

See [core.md](core.md)'s Task workflow section for the full status state machine `workflow` orchestrates, and [docs/roadmap/1.0/business-services.md](../../roadmap/1.0/business-services.md) for build status.
