// business-services/task-service/server.js

const express = require('express');
const cors = require('cors');
const taskRoutes = require('./routes/task-routes');
const userRoutes = require('./routes/user-routes');
const accountRoutes = require('./routes/account-routes');
const projectRoutes = require('./routes/project-routes');
const serviceRoutes = require('./routes/service-routes');
const { initPolling } = require('./cron/task-polling');
const { ensureSchema } = require('./db');
const { syncUser } = require('./middleware/auth');

const app = express();

// Middleware
app.use(cors());
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
  })
  .catch((error) => {
    console.error('Postgres connection error:', error);
  });

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Task service listening on port ${PORT}`);
});
