// platform-services/notification-service/services/mailhog.js
//
// "My Emails" (Profile page) — MailHog itself has no authentication or
// per-recipient access control (anyone who can reach
// mailhog.microverse.local can browse everyone's mail), so the real
// access boundary has to live here: this only ever searches by the
// *caller's own* email (req.claims.email, never client-suppliable —
// see index.js), the same posture as every other "who is asking"
// scoped read in this stack.
const MAILHOG_API_URL = process.env.MAILHOG_API_URL || 'http://microverse-mailhog:8025';

// Strips <head> (and its <title>, a duplicate of the subject line —
// email-service's templates always wrap the body in a full HTML doc,
// see src/templates/default/emailTemplate.html) before the generic
// tag-strip, so the snippet doesn't start by repeating the subject.
function stripHtml(html) {
  return (html || '')
    .replace(/<head[\s\S]*?<\/head>/i, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toEmailSummary(item) {
  const headers = item.Content?.Headers || {};
  return {
    id: item.ID,
    subject: headers.Subject?.[0] || '(no subject)',
    snippet: stripHtml(item.Content?.Body).slice(0, 160),
    createdAt: item.Created,
  };
}

// MailHog's search API (kind=to) does the actual recipient filtering —
// verified against a real MailHog instance that it only returns
// messages addressed to the queried recipient, not a client-side
// filter over the full inbox.
async function emailsForRecipient(email, limit = 20) {
  const url = `${MAILHOG_API_URL}/api/v2/search?kind=to&query=${encodeURIComponent(email)}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`MailHog search returned ${res.status}`);
  const data = await res.json();
  return (data.items || [])
    .map(toEmailSummary)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

module.exports = { emailsForRecipient };
