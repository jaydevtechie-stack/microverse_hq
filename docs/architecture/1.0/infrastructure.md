# Architecture — infrastructure

The ground everything stands on. See [core.md](core.md) for the tier test.

This split-out architecture doc set doesn't yet carry deep design notes for this tier beyond the tier definition itself — the real detail lives with each piece under [`infrastructure/`](../../../infrastructure/) (`keycloak/`, `postgresql/`, `postgis/`, `mongodb/`, `redis/`, `rabbitmq/`, `secrets/`, `nginx/`, `logging/`, `monitoring/`, `minio/`, `geoserver/`).

Notable cross-references from elsewhere in the docs:
- Keycloak fronts all authentication (see [docs/security.md](../../security.md)'s Authentication section) and is themed to match Microverse — see [docs/roadmap/1.0/infrastructure.md](../../roadmap/1.0/infrastructure.md).
- TLS certs and secrets currently live at `infrastructure/secrets` — see [docs/security.md](../../security.md)'s Secrets and credentials section for the honest current posture.
- `nginx` is standing in for `api-gateway` as the actual front door today — see [platform-services.md](platform-services.md).
