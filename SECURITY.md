# Microverse — security

How this project handles security across the app, APIs, and the domain/platform services — and, just as importantly, where it honestly doesn't yet. Same spirit as `SCHEMA.md`: this reflects what's actually built, not an aspirational policy. A gap stated plainly here is more useful than a policy that doesn't match reality.

## Authentication

- **Identity provider:** Keycloak (OIDC), at `sso.microverse.local`. All login happens there — no service maintains its own password store.
- **Token flow:** every frontend-to-service call carries a JWT. Each service extracts claims from it on the way in — `task-service`'s `syncUser` middleware and `asset-service`'s `auth.rs` both do this today.
- **Known gap — claim extraction is currently unverified.** Both of the above decode the JWT payload (base64url) without checking its signature against Keycloak's JWKS. A syntactically correct but unsigned/forged token would currently be trusted. Fine for local dev with no real external exposure; this is the single highest-priority item to close before anything here is reachable beyond localhost. See "Known gaps" below — tracked in ROADMAP.md.

## Authorization

Full model lives in `ARCHITECTURE.md`'s "Roles and permissions" — summarized here for context:

- Two-dimensional: `platform:{function}` + `service:{name}`, both required except `platform:admin` (needs no service scope — it isn't service-specific work) and the Project Hub (needs *any* service scope, not a specific one).
- Roles are synced locally as `users.roles TEXT[]` on login (see `SCHEMA.md`), not fetched live from Keycloak per-check — a permission check is a Postgres array lookup, not a network call.
- PM data visibility is two independent checks, not one: `pm_accounts` ownership (which Accounts) **and** service scope (which task types within an owned Account) — see `ARCHITECTURE.md`.
- Deactivated users (`users.active = false`) keep the ability to log in but lose everything except My Profile and Keycloak's account console — enforced server-side in the same `syncUser` middleware that already runs per-request, not just the frontend scrim. See `ARCHITECTURE.md` / `ROADMAP.md` 4.0.4.

## Data access boundaries

- **MinIO**: only `asset-service` ever holds credentials or talks to it directly. Frontend gets short-lived presigned URLs for upload/download — never the bucket itself. Download additionally requires `task.status IN ('paid', 'closed')` for a customer, checked live against `task-service` rather than a cached copy. Full detail in `ROADMAP.md`'s Proposals.
- **Search**: `search-service` is the only thing that queries Elasticsearch. Permission filtering (owner/assignee/company scoping) is baked into the query server-side — the frontend never gets a direct path to the ES cluster. Elasticsearch itself currently runs with `xpack.security.enabled: "false"` (see the docker-compose addition) — acceptable *only* because nothing else is allowed to reach it; this assumption breaks if that ever changes.
- **Comments/notes visibility**: `internal` vs `customer` filtering (see `SCHEMA.md`'s `task_comments`) is enforced application-side, not by a DB constraint — worth remembering when auditing this table's access code specifically, since the schema alone doesn't protect it.

## Secrets and credentials

- Current posture: plaintext values in `.env`, referenced via docker-compose (`${KEYCLOAK_PASSWORD}`, `${POSTGRES_PASSWORD}`, `${MINIO_PASSWORD}`, etc.). Fine for local dev, not appropriate for anything shared or deployed.
- No secrets manager (Vault, cloud KMS, etc.) in place yet — a real gap if this ever leaves a single dev machine.
- MinIO credentials specifically never reach the frontend (see Data access boundaries above) — the one credential class handled correctly today.

## Network and transport

- **Edge**: `nginx` currently does what `api-gateway` (Kong/Traefik, per `ARCHITECTURE.md`) is eventually meant to do — it's the actual front door today (TLS certs live at `infrastructure/secrets`, subdomain routing for `storage.microverse.local`, `sso.microverse.local`, etc.). `api-gateway` as its own dedicated piece is still a plan, not a running thing — worth being accurate about this rather than implying it's already in place.
- **Internal service-to-service traffic**: plain HTTP within the Docker network, no mTLS. Relies entirely on Docker network isolation as the boundary, which is a reasonable dev-time assumption and not one to carry into a real deployment unexamined.

## Known gaps (explicit, not hidden)

- JWT signature verification against Keycloak's JWKS — not implemented (see Authentication above).
- No rate limiting anywhere in the stack.
- Elasticsearch security disabled (`xpack.security.enabled: "false"`), acceptable only while access is fully mediated by `search-service`.
- No dependency/vulnerability scanning set up.
- No defined input-validation or CSRF strategy — hasn't come up yet because nothing user-facing handles untrusted form submissions with side effects beyond what Keycloak already fronts.
- Secrets are plaintext env vars, no rotation, no secrets manager.

None of these are urgent for a local passion project with no real users or real money moving — but they're the honest list of what "not production-ready" actually means here, concretely, rather than a vague gesture at "needs more security work."
