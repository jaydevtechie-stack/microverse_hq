// platform-services/billing-service/events/kafka-producer.js
//
// Mirrors task-service's kafka-producer.js — producer-owns-its-topic
// shape. billing-service.bills has exactly one intended subscriber today:
// task-service's own new consumer (events/kafka-consumer.js there), which
// republishes task.paid onto task-service.tasks so every existing
// consumer (audit-service, search-service, notification-service) picks it
// up without any changes on their end.
const { Kafka } = require('kafkajs');

const TOPIC = 'billing-service.bills';

const kafka = new Kafka({
  clientId: 'billing-service',
  brokers: (process.env.KAFKA_BROKERS || 'microverse-kafka:9092').split(','),
});
const producer = kafka.producer();

let connected = false;

async function connect() {
  if (connected) return;
  await producer.connect();
  connected = true;
}

async function publishBillPaid(bill) {
  try {
    await connect();
    const value = JSON.stringify({
      event: 'bill.paid',
      task_id: bill.task_id,
      bill_id: bill.id,
      amount_cents: bill.amount_cents,
      currency: bill.currency,
      paid_at: bill.paid_at,
    });
    await producer.send({
      topic: TOPIC,
      messages: [{ key: bill.task_id, value }],
    });
  } catch (err) {
    console.error(`Error publishing bill.paid for task ${bill.task_id}:`, err.message);
  }
}

module.exports = { publishBillPaid, TOPIC };
