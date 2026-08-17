// business-services/task-service/events/kafka-consumer.js
//
// task-service's first ever Kafka consumer (it has only ever been a
// producer, kafka-producer.js's task-service.tasks topic). Subscribes to
// billing-service.bills — a Stripe payment confirming pays a task's bill
// (rustledger, Branch 9), and this is how that fact makes it back into
// task-service's own status column: done -> paid via models/task.js's
// markPaid, then republished as the existing task.paid event on
// task-service.tasks so audit-service/search-service/notification-service's
// consumers pick it up with zero changes on their end — event-bus
// decoupling instead of billing-service calling this service's REST API
// directly (same posture as every other cross-service flow in this
// stack). Retry-on-crash shape mirrors audit-service's consumer.
const { Kafka } = require('kafkajs');
const { markPaid } = require('../models/task');
const { publishTaskEvent } = require('./kafka-producer');

const TOPIC = 'billing-service.bills';
const GROUP_ID = 'task-service-billing';

const kafka = new Kafka({
  clientId: 'task-service',
  brokers: (process.env.KAFKA_BROKERS || 'microverse-kafka:9092').split(','),
});

async function handleMessage(event) {
  if (event.event !== 'bill.paid') return;

  const updated = await markPaid(event.task_id);
  if (!updated) {
    console.log(`task ${event.task_id} already paid or not in 'done', skipping`);
    return;
  }
  await publishTaskEvent('task.paid', updated);
}

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
      await consumer.subscribe({ topics: [TOPIC], fromBeginning: true });
      await consumer.run({
        eachMessage: async ({ message }) => {
          let event;
          try {
            event = JSON.parse(message.value.toString());
          } catch (err) {
            console.error('failed to parse billing event, skipping:', err.message);
            return;
          }
          try {
            await handleMessage(event);
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
