# Roadmap — domain services (1.1)

Everything moved out of [docs/roadmap/1.0/domain-services.md](../1.0/domain-services.md) once 1.0 was scoped down to "GoFeeler + TaskFusion, live." None of this has a phase plan yet — that's the point of this file existing separately, so 1.0 isn't carrying an open-ended tail of unstarted work. See [docs/architecture/1.1/domain-services.md](../../architecture/1.1/domain-services.md) for the tech/status table these build toward, and [docs/roadmap/1.0/core.md](../1.0/core.md) for the status key.

## Up next (not yet planned in detail)

Ordered roughly by business priority, least-first.

- ElixTempo — time tracking. Also the near-term dependency for the Payouts item below. See its own section below — it's the first of this group to actually get a phase plan.
- DjaBoard — leaderboard
- PyReel — video processing
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
- ✅ **Phase 3 — Historical/aggregate query surface.** `GET /api/analysts/:analyst_id/hours` (optional `from`/`to` ISO8601 bounds), same ownership check as the session endpoints — an analyst can read their own hours, nothing more; no role-based cross-analyst access built speculatively ahead of a real consumer needing it. Reads `elixtempo.sessions` directly (2.1's table), no new persistence. Sums only `stopped` sessions — a still-running/paused one isn't "worked" yet for payout purposes — grouped by `quest_id` with a running total, bounded on `updated_at` (when a session stopped, not when it started). This is what actually unblocks the Payouts section's "payout basis" question below.
- ⚪ **Phase 4 — `quest_id` validation.** Sessions accept any `quest_id` at face value with no existence/ownership check against task-service — same trust gap task-service's own routes had before Branch 4's PM-assign hardening ([docs/roadmap/1.0/domain-services.md](../1.0/domain-services.md)). Decide whether ElixTempo calls task-service synchronously to validate (new runtime dependency) or keeps trusting the caller (this stack's default posture elsewhere).
- ⚪ **Phase 5 — Frontend.** A start/pause/stop timer widget in TaskFusion (new panel plugging into the shared React frontend — same pattern GoFeeler used, not a standalone ElixTempo-rendered UI). Depends on Phase 1 (done): the widget needs to trust `analyst_id` off the logged-in user, not a value it could spoof client-side.

## Payouts (PMs and analysts)

Moved from 1.0's Branch 9, which scoped itself to customer billing/collection only and deferred this entirely — see that phase's note in [docs/roadmap/1.0/domain-services.md](../1.0/domain-services.md) and [docs/business/1.0/overview.md](../../business/1.0/overview.md)'s Payouts section for the commercial framing.

Collecting money (customer → Microverse) and paying it out (Microverse → analyst/PM) are different flows with different tooling — this is not a small extension of Branch 9's Stripe Checkout work.

- ⚪ Payout mechanism — Stripe Connect is the assumed candidate, unconfirmed, nothing built
- ⚪ Payout basis — hourly off elixtempo's tracked time (rustledger's existing `line_items` already prices a flat-rate v1 of this for analysts) vs. a per-task flat rate vs. something else
- ⚪ Timing dependency — is a payout gated on the customer's bill actually clearing, or decoupled on Microverse's own schedule? Materially affects cash-flow risk, not a default to pick casually
- ⚪ Needs its own design pass before this work starts, not just an extra bullet
- ⚪ Scope split, decided: elixtempo stays hours-only (the input signal); a `payout_rate`/`payee` table belongs on rustledger (which already owns Stripe and the billing domain), not on elixtempo — turning elixtempo into an ad-hoc contracts/HR system to hold rate and banking data was the alternative considered and rejected. See [docs/architecture/1.0/domain-services.md](../../architecture/1.0/domain-services.md)'s rustledger row.
