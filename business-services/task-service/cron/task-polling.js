// business-services/task-service/cron/task-polling.js

const cron = require('node-cron');
const { pollingCounts, listStalePaid, closeTask } = require('../models/task');
const { publishTaskEvent } = require('../events/kafka-producer');

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

// Workflow slice 1 (docs/roadmap/1.0/business-services.md) — the one leg
// of the Task state machine with no natural human/event trigger of its
// own: paid -> closed. Sibling job to initPolling above, not folded into
// it — different concern (this one mutates state, that one only logs)
// and a daily cadence is plenty for a multi-week grace period, unlike
// the 5-minute polling loop. Runs once a day at 03:00 rather than on
// boot, so a container restart doesn't immediately sweep.
function initAutoClose() {
  const days = Number(process.env.TASK_AUTO_CLOSE_DAYS) || 30;

  cron.schedule('0 3 * * *', async () => {
    let stale;
    try {
      stale = await listStalePaid(days);
    } catch (err) {
      console.error('Error listing stale paid tasks:', err);
      return;
    }

    for (const task of stale) {
      try {
        const updated = await closeTask(task.id);
        if (!updated) continue; // already closed/moved on since the list query — no-op, not an error
        await publishTaskEvent('task.closed', updated);
      } catch (err) {
        // One bad row shouldn't block the rest of the sweep.
        console.error(`Error auto-closing task ${task.id}:`, err.message);
      }
    }
  });
}

module.exports = { initPolling, initAutoClose };
