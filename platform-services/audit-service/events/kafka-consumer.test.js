const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { rowForTaskEvent, rowForSentimentEvent } = require('./kafka-consumer');

describe('rowForTaskEvent', () => {
  test('maps a task-service.tasks event to an audit_log row', () => {
    const event = {
      task_id: 'task-1',
      service: 'gofeeler',
      event: 'task.assigned',
      status: 'analyst',
      owner: 'pm@example.com',
      assignee_ids: ['analyst@example.com'],
    };
    const message = { timestamp: '1700000000000' };

    const row = rowForTaskEvent(event, message);

    assert.deepEqual(row, {
      taskId: 'task-1',
      service: 'gofeeler',
      event: 'task.assigned',
      status: 'analyst',
      owner: 'pm@example.com',
      assignee: 'analyst@example.com',
      durationMs: null,
      occurredAt: new Date(1700000000000),
    });
  });

  test('an empty assignee_ids array maps to a null assignee', () => {
    const event = { task_id: 'task-1', service: 'gofeeler', event: 'task.approved', assignee_ids: [] };
    const row = rowForTaskEvent(event, { timestamp: '1700000000000' });
    assert.equal(row.assignee, null);
  });

  test('missing status/owner default to null, not undefined', () => {
    const event = { task_id: 'task-1', service: 'gofeeler', event: 'task.created' };
    const row = rowForTaskEvent(event, { timestamp: '1700000000000' });
    assert.equal(row.status, null);
    assert.equal(row.owner, null);
    assert.equal(row.durationMs, null);
  });
});

describe('rowForSentimentEvent', () => {
  test('maps a gofeeler.sentiment event to an audit_log row', () => {
    const event = {
      task_id: 'task-1',
      service: 'gofeeler',
      event: 'sentiment.analyzed',
      duration_ms: 842,
      analyzed_at: '2026-01-02T03:04:05.000Z',
    };

    const row = rowForSentimentEvent(event);

    assert.deepEqual(row, {
      taskId: 'task-1',
      service: 'gofeeler',
      event: 'sentiment.analyzed',
      status: null,
      owner: null,
      assignee: null,
      durationMs: 842,
      occurredAt: new Date('2026-01-02T03:04:05.000Z'),
    });
  });

  test('missing analyzed_at falls back to the current time, not a thrown error', () => {
    const before = Date.now();
    const row = rowForSentimentEvent({ task_id: 'task-1', service: 'gofeeler', event: 'sentiment.analyzed' });
    const after = Date.now();

    assert.equal(row.durationMs, null);
    assert.ok(row.occurredAt.getTime() >= before && row.occurredAt.getTime() <= after);
  });
});
