const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { requireRealmRole, requireAnyRealmRole, claimsFromHeader } = require('./auth');

function bearerFor(payload) {
  const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `header.${b64}.signature`;
}

function fakeRes() {
  const res = { statusCode: null, body: null };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };
  return res;
}

describe('claimsFromHeader', () => {
  test('valid Bearer token decodes the payload', () => {
    const claims = claimsFromHeader(`Bearer ${bearerFor({ sub: 'user-1', email: 'a@example.com' })}`);
    assert.deepEqual(claims, { sub: 'user-1', email: 'a@example.com' });
  });

  test('missing header returns null', () => {
    assert.equal(claimsFromHeader(undefined), null);
  });

  test('non-Bearer scheme returns null', () => {
    assert.equal(claimsFromHeader('Basic dXNlcjpwYXNz'), null);
  });

  test('token missing the payload segment returns null', () => {
    assert.equal(claimsFromHeader('Bearer onlyheader'), null);
  });

  test('payload that is not valid JSON returns null', () => {
    const b64 = Buffer.from('not json').toString('base64url');
    assert.equal(claimsFromHeader(`Bearer header.${b64}.signature`), null);
  });
});

describe('requireRealmRole', () => {
  test('calls next when the caller holds the role', () => {
    const req = { claims: { realm_access: { roles: ['platform:admin'] } } };
    const res = fakeRes();
    let nextCalled = false;
    requireRealmRole('platform:admin')(req, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
    assert.equal(res.statusCode, null);
  });

  test('responds 403 when the caller lacks the role', () => {
    const req = { claims: { realm_access: { roles: ['platform:customer'] } } };
    const res = fakeRes();
    let nextCalled = false;
    requireRealmRole('platform:admin')(req, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.message, 'Requires platform:admin');
  });

  test('responds 403 when req.claims is missing entirely', () => {
    const req = {};
    const res = fakeRes();
    let nextCalled = false;
    requireRealmRole('platform:admin')(req, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
  });
});

describe('requireAnyRealmRole', () => {
  test('calls next when the caller holds at least one of the roles', () => {
    const req = { claims: { realm_access: { roles: ['platform:reviewer'] } } };
    const res = fakeRes();
    let nextCalled = false;
    requireAnyRealmRole('platform:project-manager', 'platform:reviewer')(req, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
  });

  test('responds 403 listing every accepted role when none match', () => {
    const req = { claims: { realm_access: { roles: ['platform:customer'] } } };
    const res = fakeRes();
    let nextCalled = false;
    requireAnyRealmRole('platform:project-manager', 'platform:reviewer')(req, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.message, 'Requires one of: platform:project-manager, platform:reviewer');
  });
});
