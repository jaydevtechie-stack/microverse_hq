// backend/task-service/server.js

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const taskRoutes = require('./routes/task-routes');
const { initPolling } = require('./cron/task-polling');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());  // for parsing application/json

// Routes
app.use('/api', taskRoutes);

// MongoDB Connection
const MONGO_URL = process.env.MONGO_URL || 'mongodb://microverse-mongodb:27017/taskDB';
mongoose.connect(MONGO_URL, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('Connected to MongoDB');
    initPolling(); // Start task polling logic
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error);
  });

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Task service listening on port ${PORT}`);
});
