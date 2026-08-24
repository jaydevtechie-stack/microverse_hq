# Architecture — business services

The narrator — services that know what a Task or a Quest *is*, owning the plot rather than generic plumbing. See [core.md](core.md) for the tier test and the shared entity/roles/task-workflow model these implement.

**There is no separate order-service.** An Order isn't its own entity or component — it's the customer-facing name for a `tasks` row across its entire lifecycle: task-service owns creation (`POST /tasks`, a customer submitting an Order) through `analyst`/`reviewer`/`done`/`paid`/`closed`. Every `order_id` referenced elsewhere in this codebase (asset-service's MinIO object keys, the platform-services roadmap's MinIO proposal) has always meant task-service's `tasks.id`, not a lookup against a system of its own — an earlier sketch of a dedicated order-service was scaffolded but never built, and the concept it would have owned turned out to already be task-service's job.

| Service | Tech | Role |
|---|---|---|
| task-service | Node.js/Express | Owns the shared task pool (see below); customer creates an Order (a Task) and uploads media, a PM assigns Tasks to analysts |
| workflow | Java (Camunda/Zeebe) | Orchestrates the full Task (Order → analyst → reviewer → done) → time → bill → kudos sequence as an explicit state machine |

## The task pool

- Lives in **task-service**, backed by **PostgreSQL** (not Mongo — this specifically needs `SELECT ... FOR UPDATE SKIP LOCKED` for safe concurrent claiming).
- Query shape:
  ```sql
  SELECT * FROM tasks
  WHERE status = 'unassigned'
    AND service = ANY(:user_roles)
  ORDER BY created_at
  FOR UPDATE SKIP LOCKED
  LIMIT 1;
  ```
- No separate pooling service or permission layer needed — the role filter is baked into the query itself.

See [core.md](core.md)'s Task workflow section for the full status state machine `workflow` orchestrates, and [docs/roadmap/1.0/business-services.md](../../roadmap/1.0/business-services.md) for build status.
