// platform-services/audit-service/routes/audit-routes.js
const express = require('express');
const { recentEvents, timelineForTask, processingTimeMetrics, reactionTimeMetrics } = require('../models/audit');

const router = express.Router();

// Defaults a metrics window to "everything so far" rather than requiring
// from/to on every call — this is a proof-of-concept reporting endpoint,
// not a paginated API.
function parseWindow(req) {
  const from = req.query.from ? new Date(req.query.from) : new Date(0);
  const to = req.query.to ? new Date(req.query.to) : new Date();
  return { from, to };
}

router.get('/events', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const rows = await recentEvents(limit);
  res.json(rows);
});

router.get('/tasks/:taskId', async (req, res) => {
  const rows = await timelineForTask(req.params.taskId);
  res.json(rows);
});

router.get('/metrics/processing-time', async (req, res) => {
  const metrics = await processingTimeMetrics(parseWindow(req));
  res.json(metrics);
});

router.get('/metrics/reaction-time', async (req, res) => {
  const metrics = await reactionTimeMetrics(parseWindow(req));
  res.json(metrics);
});

// Exposed on the router (rather than a separate named export) so
// server.js's plain `require('./routes/audit-routes')` keeps working
// unchanged — tests reach it as `auditRoutes.parseWindow`, same pattern
// as task-service's routes/task-routes.js.
router.parseWindow = parseWindow;

module.exports = router;
