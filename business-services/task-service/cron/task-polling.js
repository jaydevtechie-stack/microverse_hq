// services/task-service/cron/task-polling.js

const cron = require('node-cron');
const Task = require('../models/task');

// Poll every 5 minutes. server.js calls this after the Mongo connection is
// established — it was never actually exported, so the call was throwing.
function initPolling() {
  cron.schedule('*/5 * * * *', async () => {
    console.log('Polling for new tasks...');

    // Example logic to fetch tasks per user and organization
    try {
      // Fetch new tasks, pending tasks, and tasks approaching deadlines
      const now = new Date();
      const newTasks = await Task.find({ status: 'pending', dueDate: { $gte: now } }).exec();
      const tasksWithPendingActions = await Task.find({ status: 'in-progress' }).exec();
      const tasksAboutToDeadline = await Task.find({
        dueDate: { $lt: new Date(now.getTime() + 24 * 60 * 60 * 1000) }, // within the next 24 hours
        status: { $ne: 'completed' },
      }).exec();

      console.log(`Found ${newTasks.length} new tasks, ${tasksWithPendingActions.length} tasks with pending actions, and ${tasksAboutToDeadline.length} tasks about to reach their deadline.`);

      // You can add additional processing here, like sending notifications to users
    } catch (err) {
      console.error('Error fetching tasks:', err);
    }
  });
}

module.exports = { initPolling };
