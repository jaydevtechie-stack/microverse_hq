const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const auditRoutes = require('./audit-routes');

describe('parseWindow', () => {
  test('parses explicit from/to query params', () => {
    const req = { query: { from: '2026-01-01T00:00:00.000Z', to: '2026-02-01T00:00:00.000Z' } };
    const { from, to } = auditRoutes.parseWindow(req);
    assert.equal(from.toISOString(), '2026-01-01T00:00:00.000Z');
    assert.equal(to.toISOString(), '2026-02-01T00:00:00.000Z');
  });

  test('defaults from to the epoch when omitted', () => {
    const { from } = auditRoutes.parseWindow({ query: {} });
    assert.equal(from.getTime(), 0);
  });

  test('defaults to to roughly now when omitted', () => {
    const before = Date.now();
    const { to } = auditRoutes.parseWindow({ query: {} });
    const after = Date.now();
    assert.ok(to.getTime() >= before && to.getTime() <= after);
  });
});
