# asset-service

**Status:** working — Rust/axum, mints presigned MinIO URLs. See
ROADMAP.md's MinIO proposal ("Implemented as" section) for the full
design and the deviations forced by actually building it.

Owns uploaded media itself: storage, versions, and permissions. An
Order is just a
[`task-service`](../../business-services/task-service/README.md) task
across its whole lifecycle — there's no separate order-service or
Order entity — so this service only cares about the file, keyed by the
same `order_id` (task-service's `tasks.id`) task-service already
tracks. Backed by MinIO (`microverse-minio` in docker-compose.yml),
reached through its own subdomain, `storage.microverse.local` — not a
path prefix, S3 presigned URLs don't survive one.

Three endpoints: `POST /assets/upload-url`, `GET /assets/{order_id}/download-url`,
`GET /assets/{order_id}`. No real ownership check on upload yet (would
mean fetching the task's `customer_id` from task-service and comparing
— not implemented, not blocked on anything), and no signature
verification on the caller's JWT (unverified claim decoding, matching
task-service's current auth posture) — both known gaps, not oversights.
