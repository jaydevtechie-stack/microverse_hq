# Roadmap — core

What's getting built, roughly in order. See [docs/architecture/1.0/core.md](../../architecture/1.0/core.md) for the decisions behind these items.

**Status key:** ✅ Done · 🟢 Now · 🟡 Next · ⚪ Later

Per-component build plans:
- [applications.md](applications.md) — frontend/UI proposals
- [domain-services.md](domain-services.md) — GoFeeler's branch plan (kept as "branch" for historical continuity — see that file's own note), the only domain service actually in 1.0's scope now (see that file's note — the other six moved to [docs/roadmap/1.1/domain-services.md](../1.1/domain-services.md))
- [business-services.md](business-services.md) — task-service/workflow queue
- [platform-services.md](platform-services.md) — asset-service/MinIO proposal
- [infrastructure.md](infrastructure.md) — Keycloak, CI/CD pipeline

## Security hardening

See [docs/security.md](../../security.md) for the full honest rundown of current posture. Listed here so these don't get forgotten once real deployment becomes a real question.

### JWT signature verification — ✅ done

Replaced unverified claim decoding everywhere it existed — turned out to be 8 services across 4 languages, not just the 2 originally scoped below (`task-service` and `asset-service`): `task-service`, `notification-service`, `blog-service`, `audit-service` (Node), `asset-service`, `rustledger` (Rust), `gofeeler` (Go), `search-service` (Python). Promoted off the deferred list because [docs/roadmap/2.0/intelligence.md](../2.0/intelligence.md)'s Phase 5 raises the stakes — once agents hold write access, a forged token risks impersonating a write-capable identity, not just a mostly-read human one.

**Approach actually used:**
- **Keycloak side:** JWKS published at the standard realm endpoint (`/realms/{realm}/protocol/openid-connect/certs`) — no Keycloak-side change needed.
- **Node services:** `jsonwebtoken` + `jwks-rsa` (turnkey JWKS client with caching keyed by `kid`).
- **Rust services (asset-service, rustledger):** `jsonwebtoken` crate + a hand-rolled in-memory JWKS cache (no Rust equivalent of `jwks-rsa` existed) — TTL-based refresh, cache-miss-triggers-one-refetch on an unrecognized `kid`. Required explicitly disabling `validate_aud` (the crate defaults to requiring an `aud` match with none configured; Keycloak issues `aud: "account"` on every real token) — found only via live testing against real Keycloak, not synthetic tests.
- **Go (gofeeler):** `golang-jwt/jwt/v5` + the same hand-rolled JWKS cache pattern as Rust. No `aud`-validation footgun here — golang-jwt doesn't default to requiring it.
- **Python (search-service):** PyJWT's built-in `PyJWKClient` (turnkey, like Node's `jwks-rsa`). Same `aud` footgun as Rust — caught proactively this time by testing PyJWT's default behavior before writing the real implementation, rather than hitting it live.
- **Key rotation:** cache miss on an unknown `kid` triggers one JWKS refetch (not a blind trust) before rejecting — handles Keycloak rotating signing keys without a deploy, while still failing closed on a genuinely bad `kid`.
- **Failure mode:** a token that fails verification is rejected outright (401) — no fallback to unverified decoding.
- **Testing:** every service's test suite uses a real RSA keypair and a local mock JWKS HTTP server (not mocked-away signature checks), proving forged/tampered/expired/wrong-`kid` tokens are actually rejected. Each fix was also live-verified against the real running Keycloak instance through nginx before merge.

- ⚪ Secrets management — move off plaintext `.env` values before anything is shared/deployed
- ⚪ `api-gateway` as an actual dedicated piece (Kong/Traefik) rather than `nginx` doing that job informally
- ⚪ mTLS or equivalent for internal service-to-service traffic
- ⚪ Rate limiting
- ⚪ Dependency/vulnerability scanning
