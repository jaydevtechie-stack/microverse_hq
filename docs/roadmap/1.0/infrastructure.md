# Roadmap — infrastructure

See [docs/roadmap/1.0/core.md](core.md) for the status key and [docs/architecture/1.0/infrastructure.md](../../architecture/1.0/infrastructure.md) for context.

## Done

- ✅ Keycloak now builds via its own Dockerfile (`infrastructure/keycloak/Dockerfile`), same pattern as `applications/taskfusion/Dockerfile` — bakes the login theme + `branding/mv-1.0` assets into the image at build time instead of bind-mounting them from the host. Portable (a pushed image is self-contained regardless of repo layout or hosting), and fixes the login background image not resolving — confirmed via the real login page's resource URLs (`/resources/{key}/login/microverse/branding/...`) all now returning 200, not just theorized from the file layout.

## Phase 10 — Tests & CI/CD pipeline (GitHub)

- 🟡 Test suites for the services that actually exist — each in its native tooling, not a bolted-on shared framework: Jest for task-service (Node.js/Express), `cargo test` for asset-service (Rust), `pytest` for search-service (Python). Adding more as other services (SpringPix, rustledger, etc.) come online.
- 🟡 GitHub Actions workflow: run tests + lint on every PR and push — per-service jobs given the polyglot stack, not one monolithic pipeline pretending everything shares a toolchain.
- 🟡 Build step: build each service's Docker image in CI, validating the Dockerfiles stay working — catches drift between "what's documented in docker-compose" and "what actually builds," not just source-level bugs.
- ⚪ *Open question:* CD (actual deployment) isn't scoped yet — no deployment target decided. Pipeline stops at "build passes" for now; treat this as CI only until there's somewhere real to ship to.

See [`cicd/`](../../../cicd/) (github-actions, helm, kubernetes, terraform, scripts) for where this actually lands once built.

## Phase 11 — Keycloak account theme

- 🟡 New Keycloak theme (FreeMarker templates under `themes/microverse/account/`) matching Microverse's visual design — not a custom React page, not a rebuilt form.
- 🟡 Keycloak's native account console functionality is reused entirely as-is (email/name editing, password change) — restyled via Keycloak's own theming system, no custom API calls needed.
- 🟡 "Edit profile" and "Change password" from My Profile continue pointing at Keycloak's account console (unchanged destination) — now themed to match Microverse instead of Keycloak's default look.
