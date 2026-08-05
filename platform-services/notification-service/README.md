# notification-service

**Status:** partial. Node/Express + Socket.IO, real but minimal.

Intended purpose: decide who needs to know what, and push it to them —
"you have a new notification" over WebSocket for now, real-time UI
updates.

What's actually running (`index.js`) is a demo: it broadcasts a canned
"you have a new notification!" message to all connected sockets every 5
seconds, nothing event-driven yet. `controllers/` and `services/` contain
an earlier, more complete-looking attempt (create a notification record,
send an email via `email-service`) but aren't wired into `index.js` at
all, and reference files that don't exist (`models/notification`,
`services/emailService`) — dead code, left as found rather than silently
deleted or finished. Wiring real events in (e.g. from task-service, or
elixtempo/rustledger via tracking-service/billing-service) is future
work, not this branch.
