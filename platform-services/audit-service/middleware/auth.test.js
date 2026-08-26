const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { claimsFromHeader, syncClaims, requireAnyRealmRole } = require('./auth');

function bearerFor(payload) {
  const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `Bearer header.${b64}.signature`;
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
    const claims = claimsFromHeader(bearerFor({ sub: 'user-1', realm_access: { roles: ['platform:admin'] } }));
    assert.deepEqual(claims, { sub: 'user-1', realm_access: { roles: ['platform:admin'] } });
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

describe('syncClaims', () => {
  test('sets req.claims from a valid header and calls next', () => {
    const req = { headers: { authorization: bearerFor({ sub: 'user-1' }) } };
    let nextCalled = false;
    syncClaims(req, fakeRes(), () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
    assert.deepEqual(req.claims, { sub: 'user-1' });
  });

  test('sets req.claims to null when there is no header, but still calls next', () => {
    const req = { headers: {} };
    let nextCalled = false;
    syncClaims(req, fakeRes(), () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
    assert.equal(req.claims, null);
  });
});

describe('requireAnyRealmRole', () => {
  test('calls next when the caller holds at least one of the roles', () => {
    const req = { claims: { realm_access: { roles: ['platform:project-manager'] } } };
    const res = fakeRes();
    let nextCalled = false;
    requireAnyRealmRole('platform:admin', 'platform:project-manager')(req, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
    assert.equal(res.statusCode, null);
  });

  test('responds 403 listing every accepted role when none match', () => {
    const req = { claims: { realm_access: { roles: ['platform:customer'] } } };
    const res = fakeRes();
    let nextCalled = false;
    requireAnyRealmRole('platform:admin', 'platform:project-manager')(req, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.message, 'Requires one of: platform:admin, platform:project-manager');
  });

  test('responds 403 when req.claims is missing entirely', () => {
    const req = {};
    const res = fakeRes();
    let nextCalled = false;
    requireAnyRealmRole('platform:admin')(req, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
  });
});
