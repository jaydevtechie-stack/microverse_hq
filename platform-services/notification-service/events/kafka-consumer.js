// platform-services/notification-service/events/kafka-consumer.js
//
// Independent consumer group across two topics — task-service's existing
// task-service.tasks (kafka-producer.js, standard Kafka fan-out, no
// change needed to search-service's own indexing consumer, 6.2) and
// rustledger's rustledger.bills (Branch 9's bill.published/bill.paid),
// same multi-topic shape as audit-service's consumer.
const { Kafka } = require('kafkajs');
const { pmsForAccountAndService, nameForEmail, emailForUserId } = require('../models/recipients');
const { createNotification } = require('../models/notification');
const { sendNotificationEmail } = require('../services/email');

const TASK_TOPIC = 'task-service.tasks';
const BILLS_TOPIC = 'rustledger.bills';
const GROUP_ID = 'notification-service-tasks';

const kafka = new Kafka({
  clientId: 'notification-service',
  brokers: (process.env.KAFKA_BROKERS || 'microverse-kafka:9092').split(','),
});

// Recipient resolution per event type this branch cares about —
// task.created notifies the account's PM(s), task.assigned notifies the
// new assignee, bill.published notifies the task's customer (the first
// customer-facing trigger this service has ever had — every recipient
// elsewhere here is internal staff). bill.published fires when the PM
// explicitly releases a bill (rustledger's publish_bill), a separate
// action from creating it — a draft bill notifies nobody. Every other
// lifecycle event on task-service.tasks (moved-to-review, reviewer-
// reassigned, approved, rejected, no-index-changed) and bill.paid on
// rustledger.bills is consumed and ignored: generalizing to "notify on
// every transition" is Branch 8's audit-trail territory, not this
// branch's roadmap bullets.
async function recipientsFor(event) {
  if (event.event === 'task.created') {
    if (!event.account_id) return [];
    return pmsForAccountAndService(event.account_id, event.service);
  }
  if (event.event === 'task.assigned') {
    return event.assignee_ids || [];
  }
  if (event.event === 'bill.published') {
    if (!event.customer_id) return [];
    const email = await emailForUserId(event.customer_id);
    return email ? [email] : [];
  }
  return [];
}

function messageFor(event) {
  if (event.event === 'task.created') {
    return `New order "${event.title}" needs an analyst assigned.`;
  }
  if (event.event === 'bill.published') {
    const amount = (event.amount_cents / 100).toFixed(2);
    return `Your bill for ${amount} ${event.currency} is ready — view and pay it from your order.`;
  }
  return `You've been assigned "${event.title}".`;
}

async function notifyRecipient(io, event, recipientEmail) {
  const notification = await createNotification({
    recipientEmail,
    type: event.event,
    taskId: event.task_id,
    message: messageFor(event),
  });

  // Live push for a currently-open tab — REST GET /notifications stays
  // the source of truth for anyone not connected right now.
  io.to(recipientEmail).emit('notification', notification);

  const userName = await nameForEmail(recipientEmail);
  await sendNotificationEmail({
    to: recipientEmail,
    userName,
    subject: notification.message,
    message: notification.message,
  });
}

async function handleEvent(io, event) {
  const recipients = await recipientsFor(event);
  for (const recipientEmail of recipients) {
    await notifyRecipient(io, event, recipientEmail);
  }
}

// Kafka may not be reachable yet at boot (container startup ordering),
// or the consumer can crash mid-stream after exhausting kafkajs's own
// internal retry budget — both cases retry after 5s rather than
// bringing the service down, same posture as search-service's
// run_consumer_with_retry (kafka_consumer.py) and rustledger's
// connect-retry loop.
function startConsumer(io) {
  const consumer = kafka.consumer({ groupId: GROUP_ID });

  const retry = (reason, err) => {
    console.error(`${reason}, retrying in 5s:`, err.message);
    consumer
      .disconnect()
      .catch(() => {})
      .finally(() => setTimeout(() => startConsumer(io), 5000));
  };

  consumer.on(consumer.events.CRASH, ({ payload }) => retry('kafka consumer crashed', payload.error));

  (async () => {
    try {
      await consumer.connect();
      await consumer.subscribe({ topics: [TASK_TOPIC, BILLS_TOPIC], fromBeginning: true });
      await consumer.run({
        eachMessage: async ({ message }) => {
          let event;
          try {
            event = JSON.parse(message.value.toString());
          } catch (err) {
            console.error('failed to parse task event, skipping:', err.message);
            return;
          }
          try {
            await handleEvent(io, event);
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
