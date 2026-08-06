// business-services/task-service/server.js

const express = require('express');
const cors = require('cors');
const taskRoutes = require('./routes/task-routes');
const { initPolling } = require('./cron/task-polling');
const { ensureSchema } = require('./db');
const { syncUser } = require('./middleware/auth');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());  // for parsing application/json

// Routes
app.use('/api', syncUser, taskRoutes);

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
