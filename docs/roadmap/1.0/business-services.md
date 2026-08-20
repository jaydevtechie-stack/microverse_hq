# Roadmap — business services

See [docs/roadmap/1.0/core.md](core.md) for the status key and [docs/architecture/1.0/business-services.md](../../architecture/1.0/business-services.md) for the service table this builds toward.

## Up next (not yet planned in detail)

- task-service — the shared pool, `FOR UPDATE SKIP LOCKED` claiming (see [docs/architecture/1.0/business-services.md](../../architecture/1.0/business-services.md)'s "The task pool")
- workflow (Camunda) — the Order → Task → paid → closed state machine (see [docs/architecture/1.0/core.md](../../architecture/1.0/core.md)'s Task workflow)

Most of task-service's actual build progress so far has ridden along with [GoFeeler's phase plan](domain-services.md) (Phase 4's `users`/`accounts`/`projects` tables, 4.1's assignment endpoint, etc.) rather than being tracked separately here.
