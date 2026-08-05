# task-service

**Status:** partial. Node/Express + Mongoose, real but minimal.

Intended purpose: the PM (human or agentic) assigns Quests/Tasks to
analysts.

What's actually running (`server.js`) is much narrower: `GET /api/tasks`
(fetch tasks for a user+organisation) and a cron job that polls every 5
minutes and logs counts of new/in-progress/near-deadline tasks — no
actual notification or assignment logic yet, that's a `// TODO`-shaped
comment in the source. Connects to Mongo at `MONGO_URL`
(defaults to `microverse-mongodb`).

`controller/`, `services/create-task-service.js`, and the separate
`index.js` (a RabbitMQ consumer for a `user.created` event, hardcoded to
`amqp://localhost`) are dead code — not imported by `server.js`, so none
of it runs. `controller/task-controller.js` also reaches into
`../../notification-service/services/...` by relative path, which can't
work once these are separate containers. Left as found rather than
silently deleted or finished; wiring real
assignment/notification/`node-cron` logic is future work, not this
branch.
