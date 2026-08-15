# notification-service

**Status:** live (Branch 7 — Notifications & messaging).

Decides who needs to know what, and pushes it to them — the middle leg of
`messaging` (popup + newsfeed + email, `docs/architecture/1.0/platform-services.md`).
Node/Express + Socket.IO, backed by its own `notifications` table on the
shared `microverse-postgis` instance (same shared-DB-by-decision precedent
as rustledger/springpix).

## How it works

A second, independent Kafka consumer group (`notification-service-tasks`)
on task-service's existing `task-service.tasks` topic — standard fan-out,
no change to search-service's own indexing consumer. Two event types
trigger a notification:

- `task.created` — the new order's account's PM(s), resolved via a
  read-only `pm_accounts`/`users` join (mirrors task-service's own
  `projectManagersFor`).
- `task.assigned` — the new assignee, already present in the event's
  `assignee_ids`.

Every other lifecycle event on that topic is consumed and ignored —
notifying on every transition is Branch 8's audit-trail territory, not
this service's job.

For each resolved recipient (keyed by email, same "Keycloak usernames
stand in" posture as `assignee`): a `notifications` row is persisted,
pushed live over WebSocket to that email's room if they're connected, and
handed off to `email-service` (fire-and-forget, best-effort — a failed
email never fails the notification itself).

## API

- `GET /notifications` — the caller's own notifications (by JWT `email`
  claim), newest first, capped at 20, plus `unreadCount`.
- `PATCH /notifications/:id` — `{ read: true }`, scoped to the caller's
  own notifications.
- WebSocket: connect with `io(url, { auth: { token } })`; joins a room
  keyed by the token's `email` claim, receives `notification` events live.

Same unverified-JWT-decode trust posture as every other service in the
stack (no JWKS signature check yet).
