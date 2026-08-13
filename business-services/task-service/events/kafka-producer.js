// business-services/task-service/events/kafka-producer.js
//
// Thin wrapper around kafkajs for publishing task lifecycle events to the
// task-service.tasks topic — search-service's indexing consumer is the
// only subscriber today (docs/roadmap/1.0/domain-services.md's 6.2),
// mirroring elixtempo's KafkaProducer wrapper around :brod for the same
// producer-owns-its-topic shape.

const { Kafka } = require('kafkajs');

const TOPIC = 'task-service.tasks';

const kafka = new Kafka({
  clientId: 'task-service',
  brokers: (process.env.KAFKA_BROKERS || 'microverse-kafka:9092').split(','),
});
const producer = kafka.producer();

let connected = false;

async function connect() {
  if (connected) return;
  await producer.connect();
  connected = true;
}

// Full current task state, not a delta — the consumer just upserts
// whatever it receives (see search-service's ensure_tasks_template/_id =
// task_id design, 6.1.3), so every lifecycle transition can reuse the
// same publish() shape rather than each event type carrying its own
// partial-update payload.
function taskToEvent(event, task) {
  return {
    event,
    task_id: task.id,
    service: task.service,
    title: task.title,
    context: task.context,
    status: task.status,
    tags: task.tags || [],
    owner: task.owner,
    // assignee is a single email column (schema.md's "Keycloak usernames
    // stand in" pragmatic MVP shape) — assignee_ids is an array in the ES
    // mapping for a future multi-assignee/"my tasks" use, so a single
    // current assignee becomes a one-element array, empty when there's
    // none (e.g. approveTask clears assignee on reviewer -> done).
    assignee_ids: task.assignee ? [task.assignee] : [],
    customer_id: task.customer_id,
    account_id: task.account_id,
    project_id: task.project_id,
    created_at: task.created_at,
    assigned_at: task.assigned_at,
    // 6.3 — rides along on every transition, not just the no-index
    // toggle itself, so a later event (e.g. a reassignment) can't
    // silently resurrect an excluded doc by re-upserting it without
    // the flag. search-service's consumer deletes rather than upserts
    // whenever this is true.
    no_index: !!task.no_index,
  };
}

// Best-effort, fire-and-forget — same posture as gofeeler's Mongo result
// persistence (5.3): a search-index write failing shouldn't fail the API
// response that already committed the real Postgres transition. Errors
// are logged, never thrown back to the caller.
async function publishTaskEvent(eventName, task) {
  try {
    await connect();
    const value = JSON.stringify(taskToEvent(eventName, task));
    await producer.send({
      topic: TOPIC,
      messages: [{ key: task.id, value }],
    });
  } catch (err) {
    console.error(`Error publishing ${eventName} for task ${task.id}:`, err.message);
  }
}

module.exports = { publishTaskEvent, TOPIC };
