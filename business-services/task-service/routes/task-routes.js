// business-services/task-service/routes/task-routes.js

const express = require('express');
const router = express.Router();
const { findByService } = require('../models/task');

// Fetch tasks tagged with a given domain service, e.g. ?service=gofeeler.
// The caller (taskfusion) is responsible for only requesting a service
// the logged-in user actually holds the matching role for.
router.get('/tasks', async (req, res) => {
  const { service } = req.query;

  if (!service) {
    return res.status(400).json({ message: 'Missing required "service" query param' });
  }

  try {
    const tasks = await findByService(service);
    res.status(200).json(tasks);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching tasks', error: err.message });
  }
});

module.exports = router;
