# Roadmap — core

What's getting built, roughly in order. See [docs/architecture/1.0/core.md](../../architecture/1.0/core.md) for the decisions behind these items.

**Status key:** ✅ Done · 🟢 Now · 🟡 Next · ⚪ Later

Per-component build plans:
- [applications.md](applications.md) — frontend/UI proposals
- [domain-services.md](domain-services.md) — GoFeeler's branch plan (the furthest-along service), plus other domain services still queued
- [business-services.md](business-services.md) — task-service/workflow queue
- [platform-services.md](platform-services.md) — asset-service/MinIO proposal
- [infrastructure.md](infrastructure.md) — Keycloak, CI/CD pipeline

## Security hardening (deferred, tracked)

Not blocking current feature work — see [docs/security.md](../../security.md) for the full honest rundown of current posture. Listed here so these don't get forgotten once real deployment becomes a real question:

- ⚪ Real JWT signature verification against Keycloak's JWKS, replacing unverified claim decoding in `task-service` and `asset-service`
- ⚪ Secrets management — move off plaintext `.env` values before anything is shared/deployed
- ⚪ `api-gateway` as an actual dedicated piece (Kong/Traefik) rather than `nginx` doing that job informally
- ⚪ mTLS or equivalent for internal service-to-service traffic
- ⚪ Rate limiting
- ⚪ Dependency/vulnerability scanning
