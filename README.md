# Microverse

> A universe of applications, services, and intelligent systems where different technologies collaborate to solve real-world problems.

## 🌌 About Microverse

Microverse is a polyglot software platform built as a playground for modern software engineering.

The goal is to explore how different technologies, architectures, and ideas can work together to create a connected ecosystem of applications and services.

Each component of Microverse has its own identity, technology stack, and purpose — demonstrating that great software is not limited to one language or framework.

## 🏗️ Architecture at a glance

Microverse is organized into five tiers — see [docs/architecture/1.0/core.md](docs/architecture/1.0/core.md) for the full philosophy and the test used to place a new service in the right one:

| Tier | Folder | Role |
|---|---|---|
| Applications | [`applications/`](applications/) | The front doors — TaskFusion, Admin, shared UI |
| Domain services | [`domain-services/`](domain-services/) | One specialist trick each, customer-facing brand names (GoFeeler, SpringPix, PyReel, ...) |
| Business services | [`business-services/`](business-services/) | The narrator — owns the Order/Task/Project plot (order-service, task-service, workflow) |
| Platform services | [`platform-services/`](platform-services/) | Plumbing, zero business opinions, fully generic (asset-service, notification-service, ...) |
| Infrastructure | [`infrastructure/`](infrastructure/) | The ground everything stands on — Keycloak, Postgres/PostGIS, MongoDB, Redis, RabbitMQ, MinIO, nginx |

Also present: [`intelligence/`](intelligence/) (AI agents, prompts, models), [`shared/`](shared/) (cross-service libraries/types), [`branding/`](branding/) (the Microverse design system), [`cicd/`](cicd/) and [`deployment/`](deployment/) (build/ship tooling).

## 📚 Documentation

Everything below lives under [`docs/`](docs/), organized two ways at once: by doc-type (architecture/roadmap/business), and within each, by **platform milestone** — `1.0/` is the current GoFeeler-led scope, `2.0/` is the intelligence/agentic-workforce layer that extends it. Mirrors how [`branding/`](branding/) versions itself (`mv-1.0/`, with room for patch folders like `mv-1.0.1/`), though the two version numbers track independently — a branding refresh doesn't imply a platform milestone and vice versa.

**Architecture** — system structure and design decisions ([docs/architecture/](docs/architecture/)):
- **1.0** — the current platform:
  - [core.md](docs/architecture/1.0/core.md) — philosophy, the four tiers, entity model, roles & permissions, task workflow, Kafka vs RabbitMQ
  - [applications.md](docs/architecture/1.0/applications.md) — dashboard/UI notes, GoFeeler's end-to-end flow
  - [domain-services.md](docs/architecture/1.0/domain-services.md)
  - [business-services.md](docs/architecture/1.0/business-services.md) — includes the task pool design
  - [platform-services.md](docs/architecture/1.0/platform-services.md)
  - [infrastructure.md](docs/architecture/1.0/infrastructure.md)
- **2.0** — the agentic-workforce extension:
  - [intelligence.md](docs/architecture/2.0/intelligence.md) — the `intelligence/` folder's design: agents, ai-tools, mcp, knowledge, memory, models, prompts, workflows

**Roadmap** — what's getting built, in order ([docs/roadmap/](docs/roadmap/)):
- **1.0:**
  - [core.md](docs/roadmap/1.0/core.md) — status key, security-hardening backlog
  - [applications.md](docs/roadmap/1.0/applications.md)
  - [domain-services.md](docs/roadmap/1.0/domain-services.md) — GoFeeler's full branch plan, the furthest-along service
  - [business-services.md](docs/roadmap/1.0/business-services.md)
  - [platform-services.md](docs/roadmap/1.0/platform-services.md) — MinIO/asset-service design
  - [infrastructure.md](docs/roadmap/1.0/infrastructure.md) — Keycloak theming, CI/CD pipeline
- **2.0:**
  - [intelligence.md](docs/roadmap/2.0/intelligence.md) — the `intelligence/` build sequence: agent-to-role mapping, agent security model, 7-phase plan

**Business** — actual business decisions, not the `business-services` tech tier ([docs/business/](docs/business/)):
- **1.0:**
  - [overview.md](docs/business/1.0/overview.md) — account management, contracts, payouts, pricing, glossary
  - [product-strategy.md](docs/business/1.0/product-strategy.md) — mission, product portfolio, positioning, value proposition (scaffolded, not yet filled in)
- **2.0:**
  - [intelligence.md](docs/business/2.0/intelligence.md) — the commercial case for the agentic workforce: cost model, agent evaluation/accountability, what stays human-only

**Reference:**
- [docs/schema.md](docs/schema.md) — the actual database shape, kept in sync with real migrations
- [docs/security.md](docs/security.md) — current security posture, gaps included
- [docs/diagrams/](docs/diagrams/) — account/project structure, analyst/PM/reviewer workflows, asset-service architecture, task state diagram, current landscape
- [docs/adr/](docs/adr/), [docs/api/](docs/api/), [docs/runbooks/](docs/runbooks/) — reserved for architecture decision records, API specs, and operational runbooks as they get written

**Development:**
- [docs/development/CONTRIBUTING.md](docs/development/CONTRIBUTING.md)
- [docs/development/CODE_OF_CONDUCT.md](docs/development/CODE_OF_CONDUCT.md)

Per-service READMEs live alongside their code (e.g. [platform-services/asset-service/README.md](platform-services/asset-service/README.md), [domain-services/elixtempo/README.md](domain-services/elixtempo/README.md)) rather than under `docs/` — this index links out to the docs that cut across services, not service-local implementation notes.

## 🧭 Philosophy

Microverse explores:

* Polyglot development
* Microservice architecture
* Event-driven systems
* Cloud-native deployment
* Artificial intelligence integration
* Modern authentication and authorization
* Different approaches to solving engineering problems

## 🚀 Status

Microverse is an evolving project.

The goal is not only to build applications, but to explore architecture, technologies, and the connections between them.

## 📜 License

MIT License

The Microverse name, branding, and visual identity remain reserved.
