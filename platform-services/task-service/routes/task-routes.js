// backend/task-service/routes/taskRoutes.js

const express = require('express');
const router = express.Router();
const Task = require('../models/task');

// Route to fetch tasks for a specific user and organisation
router.get('/tasks', async (req, res) => {
  const { userId, organisationId } = req.query;

  try {
    const tasks = await Task.find({ user: userId, organisation: organisationId }).exec();
    res.status(200).json(tasks);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching tasks', error: err });
  }
});

module.exports = router;
