# Architecture — domain services

Customer-facing, one specialist trick each, real brand names. See [core.md](core.md) for the tier test and the shared entity/roles/task-workflow model these all plug into.

| Service | Tech | What it does | Status |
|---|---|---|---|
| GoFeeler | Go | Sentiment analysis on uploaded chats/emails/comments | Online — `basic` keyword engine + `advanced` LLM engine (OpenAI), see Branch 5 below |
| elixtempo | Elixir | The trust layer between "work happened" and "money/accountability follows" — tracked time feeds customer billing, analyst payouts, and business-efficiency reporting alike (see [docs/business/1.0/product-strategy.md](../../business/1.0/product-strategy.md)'s product definition). OTP concurrency handles many cheap live sessions. | Designing |
| rustledger | Rust | Invoices/billing ledger, consumes elixtempo's time-entry events off Kafka | Designing |
| SpringPix | Java/Spring | Image and GIS processing — does the raster hotspot analysis, backed by PostGIS | Basic app |
| PyReel | Python | Video processing | Basic app |
| NetCruncher | .NET | Calculation engine | Exists |
| Djaboard | Django (renamed from DjaPorts) | Reporting + kudos leaderboard — computes tiers/badges as JSON, React just renders it | Building |
| RubyKudos | Ruby | Raw kudos event capture | Not started |

See [applications.md](applications.md) for GoFeeler's full end-to-end worked example, and [docs/roadmap/1.0/domain-services.md](../../roadmap/1.0/domain-services.md) for build status/branch plan per service.

## GoFeeler — engine abstraction (Branch 5) — ✅ built

GoFeeler stays a single service with a single analyst-facing interface. The LLM upgrade is a second **engine**, not a second app, not a service split — the two engines share the same input/output contract (text in, sentiment result out), which is a strategy pattern, not a bounded-context split. Revisit the split-service question only if the LLM path grows its own independent scaling/cost/queueing concerns.

Built at `domain-services/gofeeler/app/{engine,provider,db,store}/` — see [docs/roadmap/1.0/domain-services.md](../../roadmap/1.0/domain-services.md)'s Branch 5 for what shipped vs. deferred (template edit is the one open item).

```
SentimentEngine (interface)
├── basic     — existing keyword matcher, no external dependency, always available
└── advanced  — LLM-backed, calls out via Provider
                 └── Provider (interface): Complete(prompt, opts) (Result, error)
```

- **`SentimentEngine`** — `Analyze(text, opts) (Result, error)`. Every result stamps `engine_used` so it's traceable after the fact.
- **`Provider`** — the plug-and-play seam underneath `advanced`. A new LLM provider (or a future call into `intelligence/ai-tools`, see [docs/architecture/2.0/intelligence.md](../2.0/intelligence.md)) is a new implementation of this one interface, selected by config — no change to engine logic required. GoFeeler-local for now, deliberately: it's the first consumer of LLM capability in the stack, and the project's own threshold is "introduce as a shared service when a second consumer appears." Not a rewrite risk either way — `ai-tools`, whenever it exists, is just another `Provider` implementation.
- **`sentiment_prompt_templates`** (Postgres) — shared pool visible to all analysts, self-service create/edit, small preconfigured default set (`is_system_default`). This is a runtime, analyst-authored library, distinct from `intelligence/prompts`'s version-controlled, dev-curated prompt text for agent reasoning ([docs/architecture/2.0/intelligence.md](../2.0/intelligence.md)) — same word, different audience and mechanism, worth not conflating.
- Every analysis result stamps `engine_used`, `template_id`, `llm_provider`, `model_version` — reproducibility fields, not decoration. Two `advanced`-engine results aren't comparable unless all four match. See [docs/schema.md](../../schema.md) for storage shape and [docs/security.md](../../security.md) for the governance side (prompt-injection surface, spend exposure).
