# asset-service

**Status:** working — Rust/axum, mints presigned MinIO URLs. See
ROADMAP.md's MinIO proposal ("Implemented as" section) for the full
design and the deviations forced by actually building it.

Owns uploaded media itself: storage, versions, and permissions. Separate
from [`order-service`](../order-service/README.md) (not built yet),
which will own the order that references the asset — this service only
cares about the file. Backed by MinIO (`microverse-minio` in
docker-compose.yml), reached through its own subdomain,
`storage.microverse.local` — not a path prefix, S3 presigned URLs don't
survive one.

Three endpoints: `POST /assets/upload-url`, `GET /assets/{order_id}/download-url`,
`GET /assets/{order_id}`. No real ownership check on upload yet (no
order-service to check ownership against), and no signature
verification on the caller's JWT (unverified claim decoding, matching
task-service's current auth posture) — both known gaps, not oversights.
