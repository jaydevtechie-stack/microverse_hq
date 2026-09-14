// business-services/task-service/server.js

const express = require('express');
const cors = require('cors');
const taskRoutes = require('./routes/task-routes');
const userRoutes = require('./routes/user-routes');
const accountRoutes = require('./routes/account-routes');
const projectRoutes = require('./routes/project-routes');
const serviceRoutes = require('./routes/service-routes');
const { initPolling, initAutoClose } = require('./cron/task-polling');
const { ensureSchema } = require('./db');
const { syncUser } = require('./middleware/auth');
const { startConsumer } = require('./events/kafka-consumer');

const app = express();

// task-service isn't published on its own host (see
// infrastructure/nginx/conf.d/services/task-service.conf) — the browser
// always reaches it same-origin through nginx, so this allowlist is
// defense-in-depth against anything that bypasses that proxy, not a fix
// for a live cross-origin path. Mirrors applications.conf's own
// server_name list exactly.
const ALLOWED_ORIGINS = [
  'https://microverse.local',
  'https://gofeeler.microverse.local',
  'https://springpix.microverse.local',
  'https://pyreel.microverse.local',
  'https://djaboard.microverse.local',
  'https://elixtempo.microverse.local',
  'https://rustledger.microverse.local',
  'https://rubykudos.microverse.local',
];

// Middleware
app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.json());  // for parsing application/json

// Routes
// syncUser mounted once, ahead of all four routers — not once per
// router (that would re-run the upsert, now a blocking DB round-trip
// since 4.0.4's active check, once per router Express falls through
// before finding a match).
app.use('/api', syncUser);
app.use('/api', taskRoutes);
app.use('/api', userRoutes);
app.use('/api', accountRoutes);
app.use('/api', projectRoutes);
app.use('/api', serviceRoutes);

// Postgres connection — creates the tasks table on first boot if it's
// not there yet (no separate migration tool for a table this small).
ensureSchema()
  .then(() => {
    console.log('Connected to Postgres, tasks table ready');
    initPolling(); // Start task polling logic
    initAutoClose(); // Workflow slice 1 — paid -> closed auto-close sweep
    startConsumer(); // Branch 9 — bill.paid off rustledger.bills
  })
  .catch((error) => {
    console.error('Postgres connection error:', error);
  });

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Task service listening on port ${PORT}`);
});
