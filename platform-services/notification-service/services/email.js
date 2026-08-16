// platform-services/notification-service/services/email.js
//
// notification-service's first real caller of email-service (previously
// zero callers existed anywhere in the stack) — the "email" leg of
// platform-services.md's `messaging` definition (popup + newsfeed +
// email).
const EMAIL_SERVICE_URL = process.env.EMAIL_SERVICE_URL || 'http://microverse-email-service:3000';

// Fire-and-forget — same best-effort posture as every other cross-service
// call in this stack (kafka-producer.js's publishTaskEvent comment is the
// canonical statement of this): a failed email must never fail or block
// the notification itself, which has already been persisted and pushed
// over WebSocket by the time this runs.
async function sendNotificationEmail({ to, userName, subject, message }) {
  try {
    const res = await fetch(`${EMAIL_SERVICE_URL}/email/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, userName, message, brandName: 'GoFeeler' }),
    });
    if (!res.ok) {
      console.error(`email-service responded ${res.status} for ${to}`);
    }
  } catch (err) {
    console.error(`Error calling email-service for ${to}:`, err.message);
  }
}

module.exports = { sendNotificationEmail };
