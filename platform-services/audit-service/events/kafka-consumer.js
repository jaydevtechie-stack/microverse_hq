// platform-services/audit-service/events/kafka-consumer.js
//
// One consumer group across two topics — task-service's existing
// task-service.tasks (a third independent consumer group there, alongside
// search-service's indexer and notification-service's notifier) and
// gofeeler's new gofeeler.sentiment (see domain-services/gofeeler/app/
// events/kafka.go for why that's a separate topic rather than riding on
// task-service.tasks: search-service's consumer does a blind full-state
// upsert on every message it sees there, and a sentiment.analyzed message
// shares none of those fields). Every row is written verbatim off
// whichever event arrives — no diffing against prior state, no lookup —
// the event name already carries the transition semantics.
const { Kafka } = require('kafkajs');
const { insertEvent } = require('../models/audit');

const TASK_TOPIC = 'task-service.tasks';
const SENTIMENT_TOPIC = 'gofeeler.sentiment';
const GROUP_ID = 'audit-service-events';

const kafka = new Kafka({
  clientId: 'audit-service',
  brokers: (process.env.KAFKA_BROKERS || 'microverse-kafka:9092').split(','),
});

function rowForTaskEvent(event, message) {
  return {
    taskId: event.task_id,
    service: event.service,
    event: event.event,
    status: event.status ?? null,
    owner: event.owner ?? null,
    assignee: (event.assignee_ids && event.assignee_ids[0]) || null,
    durationMs: null,
    occurredAt: new Date(Number(message.timestamp)),
  };
}

function rowForSentimentEvent(event) {
  return {
    taskId: event.task_id,
    service: event.service,
    event: event.event,
    status: null,
    owner: null,
    assignee: null,
    durationMs: event.duration_ms ?? null,
    occurredAt: event.analyzed_at ? new Date(event.analyzed_at) : new Date(),
  };
}

async function handleMessage(topic, event, message) {
  const row = topic === SENTIMENT_TOPIC ? rowForSentimentEvent(event) : rowForTaskEvent(event, message);
  await insertEvent(row);
}

// Same posture as notification-service's kafka-consumer.js: Kafka may not
// be reachable yet at boot, or the consumer can crash mid-stream — both
// cases retry after 5s rather than bringing the service down.
function startConsumer() {
  const consumer = kafka.consumer({ groupId: GROUP_ID });

  const retry = (reason, err) => {
    console.error(`${reason}, retrying in 5s:`, err.message);
    consumer
      .disconnect()
      .catch(() => {})
      .finally(() => setTimeout(() => startConsumer(), 5000));
  };

  consumer.on(consumer.events.CRASH, ({ payload }) => retry('kafka consumer crashed', payload.error));

  (async () => {
    try {
      await consumer.connect();
      await consumer.subscribe({ topics: [TASK_TOPIC, SENTIMENT_TOPIC], fromBeginning: true });
      await consumer.run({
        eachMessage: async ({ topic, message }) => {
          let event;
          try {
            event = JSON.parse(message.value.toString());
          } catch (err) {
            console.error('failed to parse audit event, skipping:', err.message);
            return;
          }
          try {
            await handleMessage(topic, event, message);
          } catch (err) {
            console.error(`error handling ${event.event} for task ${event.task_id}:`, err.message);
          }
        },
      });
    } catch (err) {
      retry('kafka consumer failed to start', err);
    }
  })();
}

module.exports = { startConsumer };
