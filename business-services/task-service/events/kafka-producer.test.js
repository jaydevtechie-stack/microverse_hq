const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { taskToEvent } = require('./kafka-producer');

function baseTask(overrides = {}) {
  return {
    id: 'task-1',
    service: 'gofeeler',
    title: 'Check the raster',
    context: 'some context',
    status: 'analyst',
    owner: 'pm@example.com',
    customer_id: 'customer-1',
    account_id: 'account-1',
    project_id: 'project-1',
    created_at: '2026-01-01T00:00:00Z',
    assigned_at: '2026-01-02T00:00:00Z',
    ...overrides,
  };
}

describe('taskToEvent', () => {
  test('maps a full task to the expected event shape', () => {
    const task = baseTask({ assignee: 'analyst@example.com', tags: ['forest', 'urgent'], no_index: true });
    const event = taskToEvent('task.assigned', task);

    assert.deepEqual(event, {
      event: 'task.assigned',
      task_id: 'task-1',
      service: 'gofeeler',
      title: 'Check the raster',
      context: 'some context',
      status: 'analyst',
      tags: ['forest', 'urgent'],
      owner: 'pm@example.com',
      assignee_ids: ['analyst@example.com'],
      customer_id: 'customer-1',
      account_id: 'account-1',
      project_id: 'project-1',
      created_at: '2026-01-01T00:00:00Z',
      assigned_at: '2026-01-02T00:00:00Z',
      no_index: true,
    });
  });

  test('carries the event name through for task.claimed (analyst pool self-claim)', () => {
    const task = baseTask({ assignee: 'analyst@example.com', owner: 'analyst@example.com' });
    const event = taskToEvent('task.claimed', task);
    assert.equal(event.event, 'task.claimed');
    assert.deepEqual(event.assignee_ids, ['analyst@example.com']);
    assert.equal(event.status, 'analyst');
  });

  test('a null assignee becomes an empty assignee_ids array', () => {
    const task = baseTask({ assignee: null });
    const event = taskToEvent('task.approved', task);
    assert.deepEqual(event.assignee_ids, []);
  });

  test('missing tags defaults to an empty array', () => {
    const task = baseTask({ assignee: null, tags: undefined });
    const event = taskToEvent('task.created', task);
    assert.deepEqual(event.tags, []);
  });

  test('no_index is coerced to a real boolean', () => {
    const task = baseTask({ assignee: null, no_index: undefined });
    assert.equal(taskToEvent('task.created', task).no_index, false);
  });
});
