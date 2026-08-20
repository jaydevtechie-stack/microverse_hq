// platform-services/audit-service/index.js
const express = require('express');
const { ensureSchema } = require('./db');
const { syncClaims, requireAnyRealmRole } = require('./middleware/auth');
const { startConsumer } = require('./events/kafka-consumer');
const auditRoutes = require('./routes/audit-routes');

const app = express();

app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Backend-only proof of concept (Branch 8) — no frontend page yet, gated
// to platform:admin or platform:project-manager (see roadmap's 4.3
// resolution earmarking the audit log as Admin's eventual cross-account
// visibility tool; PM access added so PMs can pull their own accounts'
// efficiency numbers too).
app.use('/audit', syncClaims, requireAnyRealmRole('platform:admin', 'platform:project-manager'), auditRoutes);

ensureSchema()
  .then(() => {
    console.log('Connected to Postgres, audit_log table ready');
    startConsumer();
  })
  .catch((error) => {
    console.error('Postgres connection error:', error);
  });

const PORT = process.env.PORT || 4002;
app.listen(PORT, () => {
  console.log(`Audit service listening on port ${PORT}`);
});
