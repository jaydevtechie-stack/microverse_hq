// business-services/task-service/cron/task-polling.js

const cron = require('node-cron');
const { pollingCounts } = require('../models/task');

// Poll every 5 minutes and log counts of new/pending/near-deadline tasks
// across all services. No notification/assignment logic yet — same as
// before the Postgres migration, just a different query engine underneath.
function initPolling() {
  cron.schedule('*/5 * * * *', async () => {
    console.log('Polling for new tasks...');

    try {
      const { new_count, pending_count, near_deadline_count } = await pollingCounts();
      console.log(
        `Found ${new_count} new tasks, ${pending_count} tasks with pending actions, and ${near_deadline_count} tasks about to reach their deadline.`
      );
    } catch (err) {
      console.error('Error fetching tasks:', err);
    }
  });
}

module.exports = { initPolling };
