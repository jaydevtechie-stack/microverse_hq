# Architecture — business services

The narrator — services that know what an Order or a Quest *is*, owning the plot rather than generic plumbing. See [core.md](core.md) for the tier test and the shared entity/roles/task-workflow model these implement.

| Service | Tech | Role |
|---|---|---|
| order-service | Go | Customer creates an Order, uploads media |
| task-service | Node.js/Express | Owns the shared task pool (see below); PM assigns Tasks to analysts |
| workflow | Java (Camunda/Zeebe) | Orchestrates the full Order → Task → time → bill → kudos sequence as an explicit state machine |

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
