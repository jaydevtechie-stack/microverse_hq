# Architecture — domain services (1.1)

The rest of the original seven-service polyglot lineup — moved out of [docs/architecture/1.0/domain-services.md](../1.0/domain-services.md) once 1.0 was scoped down to "GoFeeler + TaskFusion, live." None of these have a phase plan yet; that's 1.1's job, not something to fabricate here ahead of time. See [core.md](../1.0/core.md) for the tier test and shared entity/roles/task-workflow model these will plug into once built.

Ordered roughly by business priority, least-first — SpringPix is explicitly the lowest priority of the group.

| Service | Tech | What it does | Status |
|---|---|---|---|
| elixtempo | Elixir | The trust layer between "work happened" and "money/accountability follows" — tracked time feeds customer billing, analyst payouts, and business-efficiency reporting alike (see [docs/business/1.0/product-strategy.md](../../business/1.0/product-strategy.md)'s product definition). OTP concurrency handles many cheap live sessions. Also the input rustledger's payout side needs — see that service's note in [docs/architecture/1.0/domain-services.md](../1.0/domain-services.md). | Session-lifecycle API + Kafka producer + caller-identity auth built and live-consumed by RustLedger; Postgres persistence in progress — see [docs/roadmap/1.1/domain-services.md](../../roadmap/1.1/domain-services.md)'s phase plan |
| Djaboard | Django (renamed from DjaPorts) | Reporting + kudos leaderboard — computes tiers/badges as JSON, React just renders it | Building |
| PyReel | Python | Video processing | Basic app |
| NetCruncher | .NET | Calculation engine | Exists |
| RubyKudos | Ruby | Raw kudos event capture | Not started |
| SpringPix | Java/Spring | Image and GIS processing — does the raster hotspot analysis, backed by PostGIS | Basic app — **lowest business priority of the six**, build last |

See [docs/roadmap/1.1/domain-services.md](../../roadmap/1.1/domain-services.md) for what's actually queued and in what order.
