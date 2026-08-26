const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { renderTemplate } = require('./renderTemplate');

describe('renderTemplate', () => {
  test('replaces every placeholder with the matching data value', () => {
    const html = renderTemplate('default', {
      subject: 'Task assigned',
      userName: 'Jamie',
      message: 'You have a new task.',
      brandName: 'Microverse',
    });

    assert.ok(html.includes('<title>Task assigned</title>'));
    assert.ok(html.includes('Hi Jamie,'));
    assert.ok(html.includes('You have a new task.'));
    assert.ok(html.includes('Microverse'));
    assert.ok(!html.includes('{{'));
  });

  test('a placeholder with no matching data key is left as-is, not blanked', () => {
    const html = renderTemplate('default', {
      subject: 'Task assigned',
      message: 'You have a new task.',
      brandName: 'Microverse',
      // userName deliberately omitted
    });

    assert.ok(html.includes('Hi {{userName}},'));
  });

  test('an unknown template name throws rather than silently rendering nothing', () => {
    assert.throws(() => renderTemplate('does-not-exist', {}));
  });
});
