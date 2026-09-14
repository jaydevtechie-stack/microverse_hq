# Roadmap — domain services (1.1)

Everything moved out of [docs/roadmap/1.0/domain-services.md](../1.0/domain-services.md) once 1.0 was scoped down to "GoFeeler + TaskFusion, live." None of this has a phase plan yet — that's the point of this file existing separately, so 1.0 isn't carrying an open-ended tail of unstarted work. See [docs/architecture/1.1/domain-services.md](../../architecture/1.1/domain-services.md) for the tech/status table these build toward, and [docs/roadmap/1.0/core.md](../1.0/core.md) for the status key.

## Up next (not yet planned in detail)

Ordered roughly by business priority, least-first.

- ElixTempo — time tracking. Also the near-term dependency for the Payouts item below. See its own section below — it's the first of this group to actually get a phase plan.
- DjaBoard — leaderboard
- PyReel — video analysis. See its own section below.
- NetCruncher — calculation engine
- RubyKudos — kudos capture
- SpringPix — raster/GIS hotspot analysis, PostGIS integration. **Lowest business priority of the six** — build last.

## ElixTempo

**Status key:** ✅ Done · 🟢 Now · 🟡 Next · ⚪ Later (see [docs/roadmap/1.0/core.md](../1.0/core.md))

Ahead of where [docs/architecture/1.1/domain-services.md](../../architecture/1.1/domain-services.md)'s table currently says ("Designing" — stale, corrected below): a working session-lifecycle scaffold already exists at `domain-services/elixtempo/`, not just a design.

### Current state

- ✅ `ElixTempo.Sessions.Session` — one GenServer per active work session (`{analyst_id, quest_id}`), in-memory state, start/pause/resume/stop transitions with elapsed-time accounting
- ✅ `POST /api/sessions`, `GET /api/sessions/:id`, `.../pause`, `.../resume`, `.../stop` — the full lifecycle is reachable over HTTP
- ✅ Every transition publishes to the `elixtempo.sessions` Kafka topic (`ElixTempo.KafkaProducer`, `:brod`), keyed by `session_id`
- ✅ RustLedger already consumes `session.stopped` off that topic and bills the session (`domain-services/rustledger/src/kafka_consumer.rs`) — the one live cross-service link this service has today
- ✅ Wired into `docker-compose.yml` behind its own `elixtempo` profile
- ✅ Phase 1 (below): caller-identity check — a session's `analyst_id` must match the caller's own token `sub` — plus ExUnit coverage for `Sessions`/`Session`/`SessionController` (there was none before)
- ✅ Phase 2.1 (below): `elixtempo.sessions` table on the shared `microverse-postgis` instance, write-behind on every transition
- Gaps still open: sessions aren't yet rehydrated from that table on boot (Phase 2.2 — a BEAM restart today still drops every in-flight session, the `Session` moduledoc's "durability comes from Kafka" claim still isn't true in practice); no query surface beyond a single session's live state, so there's still no way to answer "how many hours did analyst X log last week" (Phase 3 — the table from 2.1 is what makes this cheap now); `quest_id` accepted with no existence check (Phase 4); no frontend — API only, nothing renders a timer anywhere (Phase 5).

### Open questions

- **Query surface fork — leaning resolved, not fully closed.** Phase 2.1 gave ElixTempo its own Postgres history table for crash-recovery reasons, which means a `GET /hours`-style endpoint (Phase 3) is now nearly free to add on ElixTempo itself rather than having RustLedger's payout side consume the `elixtempo.sessions` Kafka stream directly. Treating this as the likely answer, but not committing until Phase 3 actually starts.
- ✅ **Crash recovery approach — resolved:** Postgres write-behind (Phase 2.1), not Kafka replay. Matches this codebase's existing convention everywhere else — Postgres as the queryable source of truth, Kafka for fan-out only, never itself replayed as a system of record. Also strictly simpler than event-sourcing replay: rehydrating a session (Phase 2.2) is one row read, not reconstructing state by walking every event for that `session_id`.
- **Caller identity:** matching this stack's existing "unverified JWT, Bearer → decode → trust the claims" posture (task-service's `auth.js`, asset-service's `auth.rs`) is in scope for Phase 1 below. Real JWKS *signature* verification is explicitly not — that's a cross-service decision already tracked separately, not something to solve piecemeal on one service (see [docs/security.md](../../security.md) and [docs/roadmap/1.0/core.md](../1.0/core.md)'s JWT section).

### Phase plan

- ✅ **Phase 1 — Harden the session API to match the rest of the stack's trust posture.** Unverified-JWT caller-identity check: the `analyst_id` in a request must match the caller's own token `sub`, so one analyst can't start/stop another's session — same decode pattern every other service already uses, not new signature verification. Paired with ExUnit coverage for `ElixTempo.Sessions`/`Session` (start/pause/resume/stop transitions, elapsed-time accounting, not-found/invalid-transition error paths) and `SessionController` (status codes) — there was none before. Also surfaced and fixed a real bug the new tests caught: `Session`'s GenServer used the default `restart: :permanent` child spec, so `DynamicSupervisor` silently resurrected a stopped session with fresh state under the same id the instant it exited normally.
- ✅ **Phase 2 — Crash recovery.** Resolved on Postgres write-behind (see Open questions above), broken down:
  - ✅ **2.1 — `elixtempo.sessions` table + write-behind on every transition.** Own `elixtempo` schema on the shared `microverse-postgis` instance. Persists raw state (`status`, `accumulated_seconds`, `running_since`), not a computed snapshot, so a session can be reconstructed exactly as it was rather than merely detected as having existed. Schema creation is synchronous and ordered ahead of the Endpoint in the supervision tree so no request can race the `CREATE TABLE`.
  - ✅ **2.2 — Rehydrate on boot.** `ElixTempo.Sessions.Supervisor` wraps the DynamicSupervisor: once it's up, `Sessions.rehydrate_all/0` reads every non-`stopped` row and spawns a `Session` GenServer per row, seeded directly from the persisted `status`/`accumulated_seconds`/`running_since` — a crash is transparent to the analyst's clock (a running session keeps accruing from its real `running_since`, it doesn't reset or freeze for the downtime). This wrapper is ordered ahead of the Endpoint in the supervision tree, same synchronous-ordering trick as 2.1's schema creation, so rehydration finishes before the first request could possibly arrive. No Kafka event is published on rehydrate — nothing new happened from a business standpoint.
  - ✅ **2.3 — Live-verified end to end** against the running docker-compose stack, not just unit tests: started a real session over HTTP, confirmed `elapsed_seconds: 23` mid-run, `docker restart`ed the container (a genuine SIGTERM/fresh-boot cycle, not a signal-only kill), and confirmed the same session came back `running` with `elapsed_seconds: 53` — continuing to accrue seamlessly through the actual downtime rather than resetting or freezing. Stopped it afterward and confirmed the full chain still closes correctly post-rehydrate: clean GenServer termination (no `Registry`/`DynamicSupervisor` zombie), 404 on a subsequent `GET`, and — the real payoff — **RustLedger's live Kafka consumer billed it for real** (`rustledger.line_items`: 78s → $1.08, correct rate math), the same live-verification bar Branch 9 held itself to. Also surfaced and fixed a real, unrelated bug found in the process: the Dockerfile's `COPY rel rel` step referenced a `rel/` directory that was never actually checked into this scaffold — the image had apparently never been buildable through this Dockerfile before. Fixed by dropping that step and starting the release directly (`bin/elixtempo start`), which works unmodified since `docker-compose.yml` already sets `PHX_SERVER=true` — no need to fabricate the `rel/overlays/bin/server` wrapper that step implied.

All five phases of this plan are now done. ElixTempo is session-lifecycle-complete, crash-recoverable, queryable, quest-validated, and has a working frontend widget.

## PyReel

**Status key:** ✅ Done · 🟢 Now · 🟡 Next · ⚪ Later (see [docs/roadmap/1.0/core.md](../1.0/core.md))

### Business framing

Microverse's founding idea is one AI-analysis thesis applied across media types — different models for different kinds of content, not six unrelated polyglot demo services. GoFeeler proved it for text (customer-submitted chat/email content → LLM sentiment analysis → analyst review). PyReel is the same thesis for video: a customer submits video content, PyReel turns it into text (transcription + metadata), and — backed by a PyReel→GoFeeler pipeline (PyReel transcribes, GoFeeler's *existing* sentiment engine analyzes the transcript, no duplicate analysis logic) — Microverse's analysts deliver a sentiment/quality report.

**Expanded from the original single-scenario framing:** the pipeline is the product, and it now explicitly covers two customer intents rather than one:

- **Customer-service call recordings** — compliance/quality angle. Originally the only scenario in scope; naturally a single video per task.
- **Creator/UGC review batches** — voice-of-customer angle. A brand running a review or influencer campaign gets back a batch of videos and wants a digest of what customers are actually saying, without watching every clip. Naturally many videos per task.

These aren't two products — they're two shapes of the same underlying job (video → text → optional sentiment), which is why this is resolved as a task-content-shape decision (below) rather than a fork in the service or its lifecycle.

Workflow-wise this stays a new first-class `service:pyreel` task type in the shared pool, not an attachment bolted onto an unrelated task type — [docs/architecture/1.0/core.md](../1.0/core.md)'s tier test ("does exactly one specialist trick, with a real opinion about what it's analyzing") is exactly why this is a domain service, same tier as GoFeeler, not a platform service. Same lifecycle as every other service (`unassigned → analyst → reviewer → done → paid`), billed through rustledger the same way gofeeler tasks are — the lifecycle itself isn't forking for the batch case, only the task's content shape and the analyst's role within it (see below).

### Current state

`domain-services/pyreel/` is a demo scaffold, not real analysis yet: a FastAPI app (`main.py`), a fake `analyze_video()` (`video_analyzer.py`) that returns `random.uniform()` for duration and a hardcoded `["car", "person", "cat"]` object list, and a RabbitMQ consumer stub (`rabbitmq_consumer.py`) that's never actually reachable — RabbitMQ isn't deployed anywhere in `docker-compose.yml`. Wired into `docker-compose.yml` behind its own `pyreel` profile (`microverse-pyreel`), but nothing calls it for real, and nothing consumes real video today.

### Open questions

- **Upload path — assumed, not yet confirmed.** Working assumption is PyReel reuses asset-service's existing MinIO upload flow rather than inventing a second one, which needs `video/*` added to the content-type allowlist enforced in [infrastructure/nginx/conf.d/assets.conf](../../../infrastructure/nginx/conf.d/assets.conf) (currently `text/`, `image/`, `application/json`, `application/pdf` only). Small, but a genuine cross-service dependency — revisit if a different upload shape turns out to be needed.
- **Transcription model/API — deferred to Phase 3, not picked yet.** Same weight as GoFeeler's own `Provider` interface decision was; shouldn't be decided casually as a side effect of Phase 1.
- ✅ **Task "context" shape for a video task — resolved.** A PyReel task's content is a *list* of one or more MinIO object keys, not a single hardcoded video reference. One customer-service call is a list of length one; a creator-review batch is a list of length N. This is a data-shape decision only — it doesn't change the task lifecycle, and it's what lets both scenarios in the Business framing section share one task type instead of forking into two.
- **Analyst role shift — new, needs a decision before Phase 2/3 land.** GoFeeler's analyst produces the analysis from a blank task. For PyReel, transcription/metadata is always machine-generated first, so the analyst's job is closer to reviewing/correcting an auto-generated output than authoring one from scratch — true for a single call recording and doubly true for a batch, where watching N videos manually would defeat the point of the batch case entirely. Worth writing up explicitly as a named pattern (analyst-as-QA) since it's a real departure from how GoFeeler's analyst role works today, not just a PyReel implementation detail.
- **Public/external video links — new, explicitly deferred, not a v1 gap to solve quietly.** Direct upload covers v1. Customers pasting a public video URL (YouTube, TikTok, etc.) is a plausible ask, especially for the creator-review scenario, but it's a real scope jump: per-platform fetch/auth handling, API quotas, and ToS questions about accessing creator content this way. Not being pulled into v1 — logged here so it doesn't get quietly reinvented later as a "small" addition.

### Phase plan

- 🟢 **Phase 1 — Basic engine, real video handling.** Real metadata via ffprobe (duration, resolution, codec, has_audio) replacing the fake `random.uniform()` stub — no transcription, no external model dependency yet. Async via Kafka, reusing the existing broker task-service already runs (dropping the current pika/RabbitMQ stub, which was never deployed) rather than standing up a second message broker — same "don't add infra for one gap" reasoning [business-services/workflow](../../../business-services/workflow/README.md) used to justify staying inside task-service's existing cron pattern instead of standing up a first-ever Java service. Proves real video handling and event wiring end to end before any transcription-model decision is needed.
- ⚪ **Phase 2 — `service:pyreel` wired into the shared task pool.** Own task type, same lifecycle as every other service, billed through rustledger the same way gofeeler tasks are. Task content is the resolved list-of-object-keys shape (above), so a single-video and a batch task are the same code path, not a special case. Also where the analyst-as-QA role shift (above) gets built into the task detail view, rather than reusing GoFeeler's blank-slate analyst UI unmodified.
- ⚪ **Phase 3 — Advanced engine: transcription → GoFeeler pipeline.** Real speech-to-text (model/API TBD) piped into GoFeeler's existing `/analyze` endpoint — the actual video→text→sentiment pipeline this service exists for, reusing GoFeeler's analysis engine rather than building a second one. Runs per video in a task's object-key list, with a roll-up summary at the task level for the batch case.
- ⚪ **Phase 4 — Frontend wiring, live-verified in browser.** Same bar ElixTempo's Phase 5 held itself to — nothing counts as done here until it's been clicked through in a real browser session against the running stack.

## Payouts (PMs and analysts)

Moved from 1.0's Branch 9, which scoped itself to customer billing/collection only and deferred this entirely — see that phase's note in [docs/roadmap/1.0/domain-services.md](../1.0/domain-services.md) and [docs/business/1.0/overview.md](../../business/1.0/overview.md)'s Payouts section for the commercial framing.

Collecting money (customer → Microverse) and paying it out (Microverse → analyst/PM) are different flows with different tooling — this is not a small extension of Branch 9's Stripe Checkout work.

- ⚪ Payout mechanism — Stripe Connect is the assumed candidate, unconfirmed, nothing built
- ⚪ Payout basis — hourly off elixtempo's tracked time (rustledger's existing `line_items` already prices a flat-rate v1 of this for analysts) vs. a per-task flat rate vs. something else
- ⚪ Timing dependency — is a payout gated on the customer's bill actually clearing, or decoupled on Microverse's own schedule? Materially affects cash-flow risk, not a default to pick casually
- ⚪ Needs its own design pass before this work starts, not just an extra bullet
- ⚪ Scope split, decided: elixtempo stays hours-only (the input signal); a `payout_rate`/`payee` table belongs on rustledger (which already owns Stripe and the billing domain), not on elixtempo — turning elixtempo into an ad-hoc contracts/HR system to hold rate and banking data was the alternative considered and rejected. See [docs/architecture/1.0/domain-services.md](../../architecture/1.0/domain-services.md)'s rustledger row.
