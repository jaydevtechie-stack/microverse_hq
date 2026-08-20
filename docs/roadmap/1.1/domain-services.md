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
- Gaps found reading the code, not yet fixed: zero test coverage beyond the Phoenix-generated `error_json_test.exs`; any caller can start/pause/stop a session for *any* `analyst_id` (no identity check at all); a BEAM restart silently drops every in-flight session despite the `Session` moduledoc's claim that "durability comes from Kafka" — nothing today actually rehydrates state from the event log on boot; no query surface beyond a single session's live state, so there's no way to answer "how many hours did analyst X log last week," which is exactly what Payouts needs; no frontend — API only, nothing renders a timer anywhere.

### Open questions

- **Query surface fork:** does the Payouts hourly rollup live on ElixTempo itself (a new `GET /hours`-style endpoint, meaning ElixTempo needs its own persisted history table), or does RustLedger's payout side just consume the `elixtempo.sessions` Kafka stream directly the same way its billing side already does, leaving ElixTempo a pure event source with no query API ever? Not decided — Phase 3 below is blocked on picking one.
- **Crash recovery approach:** rehydrate active sessions from Kafka on boot (replay `elixtempo.sessions` to last-known-state per `session_id`), or accept the gap for v1 and document it as a known limitation instead of the moduledoc's current (inaccurate) durability claim? Phase 2 is blocked on this.
- **Caller identity:** matching this stack's existing "unverified JWT, Bearer → decode → trust the claims" posture (task-service's `auth.js`, asset-service's `auth.rs`) is in scope for Phase 1 below. Real JWKS *signature* verification is explicitly not — that's a cross-service decision already tracked separately, not something to solve piecemeal on one service (see [docs/security.md](../../security.md) and [docs/roadmap/1.0/core.md](../1.0/core.md)'s JWT section).

### Phase plan

- 🟡 **Phase 1 — Harden the session API to match the rest of the stack's trust posture.** Unverified-JWT caller-identity check: the `analyst_id` in a request must match the caller's own token `sub`, so one analyst can't start/stop another's session — same decode pattern every other service already uses, not new signature verification. Paired with ExUnit coverage for `ElixTempo.Sessions`/`Session` (start/pause/resume/stop transitions, elapsed-time accounting, not-found/invalid-transition error paths) and `SessionController` (status codes) — there is none today.
- ⚪ **Phase 2 — Crash recovery.** Resolve the open question above and build it: either Kafka-replay rehydration on boot, or an explicit documented "a paused/running session mid-deploy loses its clock" limitation in place of the current inaccurate durability claim.
- ⚪ **Phase 3 — Historical/aggregate query surface.** Resolve the query-surface fork above. If it lands on ElixTempo: a persisted `session_events`/session-history table (Postgres) — nothing today outlives a stopped GenServer except the raw Kafka messages. This is what actually unblocks the Payouts section's "payout basis" question below, not a nice-to-have.
- ⚪ **Phase 4 — `quest_id` validation.** Sessions accept any `quest_id` at face value with no existence/ownership check against task-service — same trust gap task-service's own routes had before Branch 4's PM-assign hardening ([docs/roadmap/1.0/domain-services.md](../1.0/domain-services.md)). Decide whether ElixTempo calls task-service synchronously to validate (new runtime dependency) or keeps trusting the caller (this stack's default posture elsewhere).
- ⚪ **Phase 5 — Frontend.** A start/pause/stop timer widget in TaskFusion (new panel plugging into the shared React frontend — same pattern GoFeeler used, not a standalone ElixTempo-rendered UI). Depends on Phase 1: the widget needs to trust `analyst_id` off the logged-in user, not a value it could spoof client-side.
- ⚪ **Housekeeping:** once Phase 1 lands, correct [docs/architecture/1.1/domain-services.md](../../architecture/1.1/domain-services.md)'s ElixTempo row off "Designing" — the session-lifecycle API is genuinely built, just not hardened/queryable/wired to a UI yet.

## Payouts (PMs and analysts)

Moved from 1.0's Branch 9, which scoped itself to customer billing/collection only and deferred this entirely — see that phase's note in [docs/roadmap/1.0/domain-services.md](../1.0/domain-services.md) and [docs/business/1.0/overview.md](../../business/1.0/overview.md)'s Payouts section for the commercial framing.

Collecting money (customer → Microverse) and paying it out (Microverse → analyst/PM) are different flows with different tooling — this is not a small extension of Branch 9's Stripe Checkout work.

- ⚪ Payout mechanism — Stripe Connect is the assumed candidate, unconfirmed, nothing built
- ⚪ Payout basis — hourly off elixtempo's tracked time (rustledger's existing `line_items` already prices a flat-rate v1 of this for analysts) vs. a per-task flat rate vs. something else
- ⚪ Timing dependency — is a payout gated on the customer's bill actually clearing, or decoupled on Microverse's own schedule? Materially affects cash-flow risk, not a default to pick casually
- ⚪ Needs its own design pass before this work starts, not just an extra bullet
- ⚪ Scope split, decided: elixtempo stays hours-only (the input signal); a `payout_rate`/`payee` table belongs on rustledger (which already owns Stripe and the billing domain), not on elixtempo — turning elixtempo into an ad-hoc contracts/HR system to hold rate and banking data was the alternative considered and rejected. See [docs/architecture/1.0/domain-services.md](../../architecture/1.0/domain-services.md)'s rustledger row.
