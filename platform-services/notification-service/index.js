// platform-services/notification-service/index.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { ensureSchema } = require('./db');
const { syncClaims, claimsFromSocketToken } = require('./middleware/auth');
const { listForRecipient, unreadCountForRecipient, markRead, markAllRead } = require('./models/notification');
const { startConsumer } = require('./events/kafka-consumer');
const { emailsForRecipient } = require('./services/mailhog');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true } });

app.use(express.json());
app.use(syncClaims);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Newest first, capped at 20 — a popup list, not a full history view (no
// "load more"/pagination exists anywhere in this branch's scope). The
// bell's own unread badge reads unreadCount rather than counting the
// capped list client-side, since an old unread notification could fall
// outside the 20 returned.
app.get('/notifications', async (req, res) => {
  const email = req.claims?.email;
  if (!email) return res.status(401).json({ message: 'Missing or unparseable Authorization token' });

  try {
    const [notifications, unreadCount] = await Promise.all([
      listForRecipient(email),
      unreadCountForRecipient(email),
    ]);
    res.json({ notifications, unreadCount });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching notifications', error: err.message });
  }
});

// Registered ahead of the /:id route below — Express would otherwise
// match "read-all" as an :id param first.
app.patch('/notifications/read-all', async (req, res) => {
  const email = req.claims?.email;
  if (!email) return res.status(401).json({ message: 'Missing or unparseable Authorization token' });

  try {
    const updated = await markAllRead(email);
    res.json({ updated });
  } catch (err) {
    res.status(500).json({ message: 'Error updating notifications', error: err.message });
  }
});

// Scoped to the caller's own email inside markRead itself — a
// notification id belonging to someone else 404s rather than silently
// succeeding.
app.patch('/notifications/:id', async (req, res) => {
  const email = req.claims?.email;
  if (!email) return res.status(401).json({ message: 'Missing or unparseable Authorization token' });

  try {
    const notification = await markRead(req.params.id, email);
    if (!notification) return res.status(404).json({ message: 'Notification not found' });
    res.json(notification);
  } catch (err) {
    res.status(500).json({ message: 'Error updating notification', error: err.message });
  }
});

// "My Emails" (Profile page) — reads back what email-service actually
// sent this user via MailHog. See services/mailhog.js for why the
// access boundary lives here rather than trusting MailHog itself.
app.get('/emails', async (req, res) => {
  const email = req.claims?.email;
  if (!email) return res.status(401).json({ message: 'Missing or unparseable Authorization token' });

  try {
    const emails = await emailsForRecipient(email);
    res.json({ emails });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching emails', error: err.message });
  }
});

// A connecting client has no Authorization header to attach — it passes
// the token via `io(url, { auth: { token } })` instead (see
// NotificationBell.js). No token at all leaves the socket connected but
// joined to no room, same "incomplete claims just don't get the extra
// behavior" posture as task-service's auth.js — but a token that IS
// presented and fails verification gets the connection itself rejected
// (io.use middleware, not the 'connection' handler below), not silently
// downgraded to anonymous: this room join is keyed by claims.email, so
// a forged token claiming someone else's email used to be able to join
// their room and read their real-time notifications.
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next();
  try {
    socket.claims = await claimsFromSocketToken(token);
    next();
  } catch {
    next(new Error('Invalid or expired token'));
  }
});

io.on('connection', (socket) => {
  if (socket.claims?.email) {
    socket.join(socket.claims.email);
  }
});

ensureSchema()
  .then(() => {
    console.log('Connected to Postgres, notifications table ready');
    startConsumer(io);
  })
  .catch((error) => {
    console.error('Postgres connection error:', error);
  });

const PORT = process.env.PORT || 4001;
server.listen(PORT, () => {
  console.log(`Notification service listening on port ${PORT}`);
});
