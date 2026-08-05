# tracking-service

**Status:** not yet implemented — folder scaffold only.

Middleware in front of [`elixtempo`](../../domain-services/elixtempo)
(the Elixir time-tracking service) — the layer other platform/domain
services actually talk to instead of calling ElixTempo's session API
directly. Exact responsibilities (auth, request shaping, fan-out to
multiple sessions) still need designing.
