# Microverse — security

How this project handles security across the app, APIs, and the domain/platform services — and, just as importantly, where it honestly doesn't yet. Same spirit as [docs/schema.md](schema.md): this reflects what's actually built, not an aspirational policy. A gap stated plainly here is more useful than a policy that doesn't match reality.

## Authentication

- **Identity provider:** Keycloak (OIDC), at `sso.microverse.local`. All login happens there — no service maintains its own password store.
- **Token flow:** every frontend-to-service call carries a JWT. Each service extracts claims from it on the way in — `task-service`'s `syncUser` middleware and `asset-service`'s `auth.rs` both do this today.
- **Known gap, design locked — claim extraction is currently unverified.** Both of the above decode the JWT payload (base64url) without checking its signature against Keycloak's JWKS. A syntactically correct but unsigned/forged token would currently be trusted. Fine for local dev with no real external exposure; this is the single highest-priority item to close before anything here is reachable beyond localhost. Design: `task-service` verifies via `jsonwebtoken` + `jwks-rsa` (cached JWKS client, keyed by `kid`), `asset-service` via the `jsonwebtoken` crate + a small TTL-cached JWKS fetch — both fail closed (401) on a bad signature, with one JWKS refetch on an unrecognized `kid` to tolerate key rotation without a deploy. See [docs/roadmap/1.0/core.md](roadmap/1.0/core.md) for the full design. **The guarantee once built:** any claim a service acts on (roles, `sub`, `email`) has been cryptographically confirmed to have come from Keycloak — a forged or hand-edited token is rejected before any handler runs, not just informally distrusted.
- **Agent identity — Keycloak service accounts, not a separate system.** An `intelligence/agents/` agent is a Keycloak client with service accounts enabled, authenticating via the client-credentials grant instead of a login. Roles get assigned to that service account the same way they'd be assigned to a human user — no separate agent-identity model, per [docs/architecture/1.0/core.md](architecture/1.0/core.md). This also gives a mechanically real way to distinguish human from agentic sessions (login vs. client-credentials grant), used by [docs/roadmap/2.0/intelligence.md](roadmap/2.0/intelligence.md)'s Agent security model for the one action that specifically requires a human. Known implementation gap: `syncUser` currently requires `sub`/`email`/`name` all present before syncing (see [docs/schema.md](schema.md)), and client-credentials tokens don't carry `email`/`name` by default — needs protocol mappers on each agent's client, or a relaxed sync path for service-account tokens specifically. Not yet built.

## Authorization

Full model lives in [docs/architecture/1.0/core.md](architecture/1.0/core.md)'s "Roles and permissions" — summarized here for context:

- Two-dimensional: `platform:{function}` + `service:{name}`, both required except `platform:admin` (needs no service scope — it isn't service-specific work) and the Project Hub (needs *any* service scope, not a specific one).
- Roles are synced locally as `users.roles TEXT[]` on login (see [docs/schema.md](schema.md)), not fetched live from Keycloak per-check — a permission check is a Postgres array lookup, not a network call.
- PM data visibility is two independent checks, not one: `pm_accounts` ownership (which Accounts) **and** service scope (which task types within an owned Account) — see [docs/architecture/1.0/core.md](architecture/1.0/core.md).
- Deactivated users (`users.active = false`) keep the ability to log in but lose everything except My Profile and Keycloak's account console — enforced server-side in the same `syncUser` middleware that already runs per-request, not just the frontend scrim. See [docs/architecture/1.0/core.md](architecture/1.0/core.md) / [docs/roadmap/1.0/domain-services.md](roadmap/1.0/domain-services.md) 4.0.4.

## Data access boundaries

- **MinIO**: only `asset-service` ever holds credentials or talks to it directly. Frontend gets short-lived presigned URLs for upload/download — never the bucket itself. Download additionally requires `task.status IN ('paid', 'closed')` for a customer, checked live against `task-service` rather than a cached copy. Full detail in [docs/roadmap/1.0/platform-services.md](roadmap/1.0/platform-services.md)'s Proposals.
- **Search**: `search-service` is the only thing that queries Elasticsearch. Permission filtering (owner/assignee/company scoping) is baked into the query server-side — the frontend never gets a direct path to the ES cluster. Elasticsearch itself currently runs with `xpack.security.enabled: "false"` (see the docker-compose addition) — acceptable *only* because nothing else is allowed to reach it; this assumption breaks if that ever changes.
- **Comments/notes visibility**: `internal` vs `customer` filtering (see [docs/schema.md](schema.md)'s `task_comments`) is enforced application-side, not by a DB constraint — worth remembering when auditing this table's access code specifically, since the schema alone doesn't protect it.

## GoFeeler advanced engine (Branch 5) — LLM-specific exposure

New surface, not covered by the general model above:

- **Prompt injection.** Customer-submitted text (chat/email/comment exports) is untrusted input the moment it's interpolated into an LLM prompt — e.g. uploaded content containing embedded instructions aimed at the model rather than the analyst. Not screened yet; flagged here explicitly rather than assumed handled. Real screening is deferred to whenever `intelligence/ai-tools` ([docs/architecture/2.0/intelligence.md](architecture/2.0/intelligence.md)) exists as a shared chokepoint — GoFeeler's own `Provider` interface ([docs/architecture/1.0/domain-services.md](architecture/1.0/domain-services.md)) is a single, swappable seam specifically so that screening can be added there later without touching engine logic.
- **Spend exposure.** Advanced-engine calls are the first place Microverse spends real external-API money per request. No rate limit or per-analyst/day quota exists yet — same "no rate limiting anywhere in the stack" gap as below, but this is the first place it has a direct dollar cost attached rather than just an availability risk.
- **Template authoring is self-service, deliberately.** Any analyst can create/edit `sentiment_prompt_templates` ([docs/schema.md](schema.md)) — not gated behind review, because blast radius is contained to that analyst's own analyses (no external contractual/business exposure). Worth revisiting only if template content itself becomes a cost or injection vector (e.g. a template that amplifies token usage).

## Secrets and credentials

- Current posture: plaintext values in `.env`, referenced via docker-compose (`${KEYCLOAK_PASSWORD}`, `${POSTGRES_PASSWORD}`, `${MINIO_PASSWORD}`, etc.). Fine for local dev, not appropriate for anything shared or deployed.
- No secrets manager (Vault, cloud KMS, etc.) in place yet — a real gap if this ever leaves a single dev machine.
- MinIO credentials specifically never reach the frontend (see Data access boundaries above) — the one credential class handled correctly today.

## Network and transport

- **Edge**: `nginx` currently does what `api-gateway` (Kong/Traefik, per [docs/architecture/1.0/platform-services.md](architecture/1.0/platform-services.md)) is eventually meant to do — it's the actual front door today (TLS certs live at `infrastructure/secrets`, subdomain routing for `storage.microverse.local`, `sso.microverse.local`, etc.). `api-gateway` as its own dedicated piece is still a plan, not a running thing — worth being accurate about this rather than implying it's already in place.
- **Internal service-to-service traffic**: plain HTTP within the Docker network, no mTLS. Relies entirely on Docker network isolation as the boundary, which is a reasonable dev-time assumption and not one to carry into a real deployment unexamined.

## Known gaps (explicit, not hidden)

- **JWT signature verification against Keycloak's JWKS — design locked, not yet built (see Authentication above).** Already the top-priority gap for human sessions; [docs/roadmap/2.0/intelligence.md](roadmap/2.0/intelligence.md)'s Phase 5 raises the stakes further — once agents hold write access via `mcp/`, a forged token risks impersonating a write-capable agent identity, not just a mostly-read human one. Worth closing before Phase 5 ships, not after.
- **No rate limiting anywhere in the stack.** Same gap, same elevated stakes once agents are live — a bug or a leaked agent client secret can hit the pool-claim query or spam actions at machine speed and volume no human session produces. GoFeeler's advanced engine (see "GoFeeler advanced engine" above) is the first place this gap has a direct dollar cost, not just an availability one.
- **No prompt-injection screening on GoFeeler's advanced engine** — customer-submitted text flows into an LLM prompt unchecked. See "GoFeeler advanced engine" above.
- Elasticsearch security disabled (`xpack.security.enabled: "false"`), acceptable only while access is fully mediated by `search-service`.
- No dependency/vulnerability scanning set up.
- No defined input-validation or CSRF strategy — hasn't come up yet because nothing user-facing handles untrusted form submissions with side effects beyond what Keycloak already fronts.
- **Secrets are plaintext env vars, no rotation, no secrets manager.** Once `intelligence/agents/` clients exist, this posture covers write-capable machine credentials invoked programmatically, not just human-facing service passwords — worth weighing that before agent client secrets get added to the same `.env` files.

None of these are urgent for a local passion project with no real users or real money moving — but they're the honest list of what "not production-ready" actually means here, concretely, rather than a vague gesture at "needs more security work."
