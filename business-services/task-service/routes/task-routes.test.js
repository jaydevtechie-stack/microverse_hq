const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const taskRoutes = require('./task-routes');

describe('isCustomerOnly', () => {
  test('true for a caller with only platform:customer', () => {
    const req = { claims: { realm_access: { roles: ['platform:customer'] } } };
    assert.equal(taskRoutes.isCustomerOnly(req), true);
  });

  test('false for a PM who also happens to hold platform:customer', () => {
    const req = {
      claims: { realm_access: { roles: ['platform:customer', 'platform:project-manager'] } },
    };
    assert.equal(taskRoutes.isCustomerOnly(req), false);
  });

  test('false for a caller without platform:customer at all', () => {
    const req = { claims: { realm_access: { roles: ['platform:analyst'] } } };
    assert.equal(taskRoutes.isCustomerOnly(req), false);
  });

  test('false when req.claims is missing (unauthenticated request)', () => {
    assert.equal(taskRoutes.isCustomerOnly({}), false);
  });
});
