// platform-services/billing-service/services/task-client.js
//
// Internal, unauthenticated call to task-service — same shape and same
// docker-network-isolation trust posture as asset-service's
// src/task_client.rs (fetch_status). Used to verify the real task state
// (status, owner, customer_id) server-side before creating a bill, rather
// than trusting whatever the PM's client sends.
const TASK_SERVICE_URL = process.env.TASK_SERVICE_URL || 'http://microverse-task-service:3000';

async function fetchTask(taskId) {
  const res = await fetch(`${TASK_SERVICE_URL}/api/tasks/${taskId}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`task-service returned ${res.status}`);
  }
  return res.json();
}

module.exports = { fetchTask };
