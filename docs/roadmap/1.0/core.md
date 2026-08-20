# Roadmap — core

What's getting built, roughly in order. See [docs/architecture/1.0/core.md](../../architecture/1.0/core.md) for the decisions behind these items.

**Status key:** ✅ Done · 🟢 Now · 🟡 Next · ⚪ Later

Per-component build plans:
- [applications.md](applications.md) — frontend/UI proposals
- [domain-services.md](domain-services.md) — GoFeeler's phase plan, the only domain service actually in 1.0's scope now (see that file's note — the other six moved to [docs/roadmap/1.1/domain-services.md](../1.1/domain-services.md))
- [business-services.md](business-services.md) — task-service/workflow queue
- [platform-services.md](platform-services.md) — asset-service/MinIO proposal
- [infrastructure.md](infrastructure.md) — Keycloak, CI/CD pipeline

## Security hardening

See [docs/security.md](../../security.md) for the full honest rundown of current posture. Listed here so these don't get forgotten once real deployment becomes a real question.

### JWT signature verification — 🟢 designed, not yet built

Replaces unverified claim decoding in `task-service`'s `syncUser` and `asset-service`'s `auth.rs` (see [docs/security.md](../../security.md)'s Authentication section for why this is the top-priority gap). Promoted off the deferred list because [docs/roadmap/2.0/intelligence.md](../2.0/intelligence.md)'s Phase 5 raises the stakes — once agents hold write access, a forged token risks impersonating a write-capable identity, not just a mostly-read human one.

**Approach:**
- **Keycloak side:** JWKS already published at the standard realm endpoint (`/realms/{realm}/protocol/openid-connect/certs`) — no Keycloak-side change needed.
- **task-service (Node):** `jsonwebtoken` + `jwks-rsa`. `jwks-rsa` provides a JWKS client with built-in caching keyed by `kid`; `syncUser` calls `jwt.verify(token, getSigningKey, { algorithms: ['RS256'] })` before any claim is trusted, replacing the current base64url-decode-and-trust step.
- **asset-service (Rust):** `jsonwebtoken` crate + a small in-memory JWKS cache (fetched via `reqwest`, keyed by `kid`, TTL-based refresh). Same verify-before-trust replacement in `auth.rs`.
- **Key rotation:** cache miss on an unknown `kid` triggers one JWKS refetch (not a blind trust) before rejecting — handles Keycloak rotating signing keys without a deploy, while still failing closed on a genuinely bad `kid`.
- **Failure mode:** a token that fails verification is rejected outright (401) — no fallback to unverified decoding. This is the actual behavior change from today: currently a bad signature is never even checked; going forward it's a hard reject.

- ⚪ Secrets management — move off plaintext `.env` values before anything is shared/deployed
- ⚪ `api-gateway` as an actual dedicated piece (Kong/Traefik) rather than `nginx` doing that job informally
- ⚪ mTLS or equivalent for internal service-to-service traffic
- ⚪ Rate limiting
- ⚪ Dependency/vulnerability scanning
