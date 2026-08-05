# task-service

**Status:** partial. Node/Express + `pg`, real but minimal.

Intended purpose: the PM (human or agentic) assigns Quests/Tasks to
analysts.

What's actually running (`server.js`) is much narrower: `GET /api/tasks?service=`
(fetch tasks tagged with a given domain service, e.g. `gofeeler`) and a
cron job that polls every 5 minutes and logs counts of
new/pending/near-deadline tasks — no actual notification or assignment
logic yet, that's a `// TODO`-shaped comment in the source. Connects to
Postgres at `DATABASE_URL` (defaults to `microverse-postgis`), creating
the `tasks` table on first boot if it doesn't exist (see `db.js`).
Originally scaffolded against MongoDB; moved to Postgres to match
ARCHITECTURE.md's reasoning — the real task pool needs
`SELECT ... FOR UPDATE SKIP LOCKED` for safe concurrent claiming, which
Mongo doesn't have an equivalent for.

`controller/`, `services/create-task-service.js`, and the separate
`index.js` (a RabbitMQ consumer for a `user.created` event, hardcoded to
`amqp://localhost`) are dead code — not imported by `server.js`, so none
of it runs. `controller/task-controller.js` also reaches into
`../../notification-service/services/...` by relative path, which can't
work once these are separate containers. Left as found rather than
silently deleted or finished; wiring real
assignment/notification/`node-cron` logic is future work, not this
branch.
