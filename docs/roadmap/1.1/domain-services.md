# Roadmap — domain services (1.1)

Everything moved out of [docs/roadmap/1.0/domain-services.md](../1.0/domain-services.md) once 1.0 was scoped down to "GoFeeler + TaskFusion, live." None of this has a phase plan yet — that's the point of this file existing separately, so 1.0 isn't carrying an open-ended tail of unstarted work. See [docs/architecture/1.1/domain-services.md](../../architecture/1.1/domain-services.md) for the tech/status table these build toward, and [docs/roadmap/1.0/core.md](../1.0/core.md) for the status key.

## Up next (not yet planned in detail)

Ordered roughly by business priority, least-first.

- elixtempo — time tracking. Also the near-term dependency for the Payouts item below, so likely the first of this group to actually get a phase plan.
- Djaboard — leaderboard
- PyReel — video processing
- NetCruncher — calculation engine
- RubyKudos — kudos capture
- SpringPix — raster/GIS hotspot analysis, PostGIS integration. **Lowest business priority of the six** — build last.

## Payouts (PMs and analysts)

Moved from 1.0's Branch 9, which scoped itself to customer billing/collection only and deferred this entirely — see that phase's note in [docs/roadmap/1.0/domain-services.md](../1.0/domain-services.md) and [docs/business/1.0/overview.md](../../business/1.0/overview.md)'s Payouts section for the commercial framing.

Collecting money (customer → Microverse) and paying it out (Microverse → analyst/PM) are different flows with different tooling — this is not a small extension of Branch 9's Stripe Checkout work.

- ⚪ Payout mechanism — Stripe Connect is the assumed candidate, unconfirmed, nothing built
- ⚪ Payout basis — hourly off elixtempo's tracked time (rustledger's existing `line_items` already prices a flat-rate v1 of this for analysts) vs. a per-task flat rate vs. something else
- ⚪ Timing dependency — is a payout gated on the customer's bill actually clearing, or decoupled on Microverse's own schedule? Materially affects cash-flow risk, not a default to pick casually
- ⚪ Needs its own design pass before this work starts, not just an extra bullet
- ⚪ Scope split, decided: elixtempo stays hours-only (the input signal); a `payout_rate`/`payee` table belongs on rustledger (which already owns Stripe and the billing domain), not on elixtempo — turning elixtempo into an ad-hoc contracts/HR system to hold rate and banking data was the alternative considered and rejected. See [docs/architecture/1.0/domain-services.md](../../architecture/1.0/domain-services.md)'s rustledger row.
