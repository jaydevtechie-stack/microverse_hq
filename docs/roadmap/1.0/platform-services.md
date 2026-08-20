# Roadmap — platform services

See [docs/roadmap/1.0/core.md](core.md) for the status key and [docs/architecture/1.0/platform-services.md](../../architecture/1.0/platform-services.md) for the service table this builds toward.

## Proposals

### MinIO architecture and permissions
**Approach:** One shared bucket across all services (not bucket-per-service — avoids re-provisioning MinIO for every new domain service). Isolation happens in the object key structure instead: `{service}/{account_id}/{order_id}/{version}/{filename}` — e.g. `gofeeler/acme-forestry/1f0a3c9e-.../v1/support-chat-export.txt`. `order_id` is a UUID (see [docs/architecture/1.0/core.md](../../architecture/1.0/core.md)'s ID convention), not a sequential number — the key alone encodes enough for an access check without a DB lookup, and doesn't leak enumerable order volume. `account_id` is always populated (see [docs/architecture/1.0/core.md](../../architecture/1.0/core.md)'s Account entity) — no fallback logic needed for individual customers without a company.

**Who talks to MinIO:** Only `asset-service` — the frontend never gets direct MinIO credentials.
- Upload: frontend requests a presigned PUT URL from asset-service, which checks `platform:customer` + `service:{x}` + order ownership before minting a short-lived URL. Frontend uploads directly to MinIO from there.
- Download: frontend requests a presigned GET URL; asset-service checks the requester's role **and** the task's current status. This is where "paid unlocks download" actually lives — asset-service refuses to mint a URL unless `task.status IN ('paid', 'closed')` for a customer. MinIO itself has no business-rule awareness; asset-service is the sole gatekeeper.

**Versioning:** Use MinIO's native bucket-level object versioning directly rather than reinventing version numbers — a re-upload to the same key just creates a new tracked version. (Distinct from the versioned notes/comments on a Task, which live in task-service's DB, not MinIO.)

**Orphaned uploads:** If a customer abandons the Create Order form after uploading but before submitting, the object is accepted as an orphan for now rather than building cleanup infrastructure — a conscious deferral, not an oversight. Worth revisiting via `scheduler` if it becomes a real storage cost.

**API shape:**
```
POST /assets/upload-url
  Auth: platform:customer + service:{x}, must own the target order
  Body:    { order_id, filename, content_type }
  Returns: { upload_url, object_key, expires_at }

GET /assets/{order_id}/download-url?filename=...
  Auth: role-dependent — see below
  Returns: { download_url, expires_at }

GET /assets/{order_id}
  Auth: role-dependent — list files attached to an order
  Returns: [{ filename, content_type, size, version, uploaded_at }]
```

**The two auth paths are different in kind, not just detail:**
- Upload: simple ownership check (does this customer own this order).
- Download: role **and** task status. This is the actual enforcement point for "paid unlocks download" — write it as its own explicit function (`can_download(user, order, task_status)`) rather than inline logic, since it's the one rule here encoding a real business decision. Since this needs the task's *current* status, call `task-service` synchronously on every download-URL request rather than trusting a locally cached copy kept fresh via `event-bus` — correctness matters more than shaving a network hop off a request that isn't a hot path.

**Data ownership:** stateless-first — no dedicated Postgres table for file metadata. Rely on MinIO's native `ListObjects` with a prefix for "what files exist for this order," and MinIO's custom object metadata headers for extras like `uploaded_by`. Only add a real table later if a query comes up that MinIO's prefix-listing can't answer cheaply.

**Transfer path:** asset-service only ever mints presigned URLs — actual file bytes flow directly between the frontend and MinIO, never proxied through asset-service. Upload and download requests hit asset-service; the transfer itself bypasses it entirely.

**Implemented as:** Rust/axum, matching rustledger's shape (same Cargo.toml conventions, same Dockerfile). Real deviations from the sketch above, all forced by things that only showed up once it was actually built:
- **MinIO needs its own subdomain, not a path prefix.** First attempt proxied `microverse.local/minio-storage/` to MinIO — every presigned request came back `SignatureDoesNotMatch`. The AWS SDK's SigV4 canonical-request signing doesn't account for a reverse-proxy prefix being stripped on the way through, no matter which side (signing vs. proxying) tries to compensate. Fix: `storage.microverse.local`, its own clean host with a plain root `/` proxy — same pattern as `sso.microverse.local`. Needs its own hosts-file entry and its own `DNS:` SAN on the dev cert.
- **Presigning and real MinIO API calls need different endpoints.** `S3_ENDPOINT` (the public host) works for presigning because that's a local signature computation, no network call. But `list_objects_v2`/`head_bucket`/`create_bucket` are real requests — and `storage.microverse.local` only resolves on the host machine, not inside the container. Split into two clients: `presign_client()` (public endpoint) and `internal_client()` (`S3_INTERNAL_ENDPOINT`, the Docker-network address) for anything that actually talks to MinIO.
- **`service` is an explicit field/query param everywhere**, not inferred — there's no cross-service order registry to resolve "which service does this order_id belong to," so the caller (which already knows it's dealing with, say, a gofeeler task) has to say so.
- **No order-service yet** means no real ownership check on upload (the order doesn't exist as a record anywhere until Create Order actually submits, which it still doesn't) and no `company_id` (there's no company entity anywhere in the stack, just Keycloak users) — `username` stands in for it in the object key.
- **List/download resolve the object by scanning**, not a direct key lookup — `username` sits before `order_id` in the key, and there's no way to know a customer's username from the order_id alone without order-service to ask. `ListObjectsV2` under the service prefix, filtered in memory for `/{order_id}/`. Fine at current scale; would need a real index or a reordered key to stay a cheap prefix lookup once object counts grow.
- **Auth is unverified JWT claim decoding**, not real signature verification against Keycloak's JWKS — matches task-service's current (lack of) auth posture rather than being the one service that quietly does more than its neighbors.
- nginx also got `client_max_body_size 50m` (default is 1m, far too small) and a content-type allowlist on `storage.microverse.local` (text/image/json/pdf for now — GoFeeler-shaped, broaden as other services start uploading).

## Up next

Most platform-service progress today (search-service, notification-service, event-bus, audit) is tracked as part of [GoFeeler's branch plan](domain-services.md) rather than separately here, since each one is being built out as GoFeeler needs it. Billing collection is tracked there too, but lives in `rustledger` (a domain service), not a platform-service — see that plan's Branch 9.
