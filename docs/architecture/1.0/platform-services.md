# Architecture — platform services

Plumbing — zero business opinions, fully generic, could get dropped into a totally unrelated app unchanged. See [core.md](core.md) for the tier test and the shared entity/roles model these implement underneath.

| Service | Tech |
|---|---|
| api-gateway | Kong/Traefik (off-the-shelf, no custom code) |
| storage | Go — thin MinIO/S3 wrapper |
| asset-service | Rust — versioning + permissions on top of `storage` |
| event-bus | Go (Watermill) — shared abstraction over Kafka + RabbitMQ (renamed from "messaging" to free that name up for the human-facing feature below) |
| messaging | Human (and possibly agent) communication feature — popup notification, newsfeed entry, email; no dedicated chat, async only |
| notification-service | Node.js/TypeScript — decides who needs to know, hands off to email-service; handles delivery mechanics underneath `messaging` |
| email-service | Node.js/TypeScript (nodemailer → MailHog) |
| search-service | Python (Elasticsearch) — permission-specific search over a user's own work; human-only, not for agents |
| audit | Java |
| scheduler | Java (Quartz) |
| billing-service | Node.js/TypeScript (Stripe SDK) — stateless middleware in front of `rustledger`; owns Stripe Checkout/webhooks for customer payment collection, tells rustledger "payment received" (Branch 9). Corrected from an earlier "Python" spec written before `audit-service`/`notification-service` established the platform-service convention this now matches. PM/analyst payouts (also consuming elixtempo's tracked time) remain separate, undesigned scope — see [docs/business/1.0/overview.md](../../business/1.0/overview.md) |
| tracking-service | .NET — general product usage analytics (not time tracking — that's elixtempo, though tracking-service does consume elixtempo's events as one input for business-efficiency reporting, see [docs/business/1.0/overview.md](../../business/1.0/overview.md)) |

See [core.md](core.md) for Kafka-vs-RabbitMQ (which `event-bus` abstracts over), and [docs/roadmap/1.0/platform-services.md](../../roadmap/1.0/platform-services.md) for build status — most platform-service progress today rides along with [GoFeeler's branch plan](../../roadmap/1.0/domain-services.md).
