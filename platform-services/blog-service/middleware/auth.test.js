const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');

const { claimsFromHeader, syncClaims, requireAnyRealmRole, setJwksUriForTests } = require('./auth');

// Real RSA keypair + a tiny local HTTP server standing in for Keycloak's
// JWKS endpoint, so signature verification is exercised against real
// crypto rather than mocked away entirely.
let server;
let privateKey;
const KID = 'test-key-1';

before(async () => {
  const { publicKey, privateKey: priv } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  privateKey = priv;
  const jwk = publicKey.export({ format: 'jwk' });

  server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ keys: [{ ...jwk, kid: KID, use: 'sig', alg: 'RS256' }] }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  setJwksUriForTests(`http://127.0.0.1:${port}/certs`);
});

after(() => {
  server.close();
});

function signToken(payload, overrides = {}) {
  return jwt.sign(payload, privateKey, {
    algorithm: 'RS256',
    keyid: KID,
    expiresIn: '5m',
    ...overrides,
  });
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
  test('a validly signed token verifies and returns its claims', async () => {
    const token = signToken({ sub: 'user-1', realm_access: { roles: ['platform:marketing'] } });
    const claims = await claimsFromHeader(`Bearer ${token}`);
    assert.deepEqual(claims.realm_access.roles, ['platform:marketing']);
  });

  test('missing header returns null', async () => {
    assert.equal(await claimsFromHeader(undefined), null);
  });

  test('non-Bearer scheme throws', async () => {
    await assert.rejects(() => claimsFromHeader('Basic dXNlcjpwYXNz'));
  });

  test('a token forged with an unknown key is rejected — this is the actual vulnerability closed here', async () => {
    // Before real verification, a forged token claiming
    // platform:marketing would sail past requireAnyRealmRole below,
    // since only the role claim was ever checked, never its signature.
    const { privateKey: otherKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const forged = jwt.sign({ realm_access: { roles: ['platform:marketing'] } }, otherKey, {
      algorithm: 'RS256',
      keyid: KID,
      expiresIn: '5m',
    });
    await assert.rejects(() => claimsFromHeader(`Bearer ${forged}`));
  });

  test('an expired token is rejected', async () => {
    const token = signToken({ sub: 'user-1' }, { expiresIn: '-10s' });
    await assert.rejects(() => claimsFromHeader(`Bearer ${token}`));
  });
});

describe('syncClaims', () => {
  test('no Authorization header: claims stay null, request proceeds anonymously', async () => {
    const req = { headers: {} };
    const res = fakeRes();
    let nextCalled = false;
    await syncClaims(req, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
    assert.equal(req.claims, null);
  });

  test('a present but invalid token is rejected with 401', async () => {
    const req = { headers: { authorization: 'Bearer garbage' } };
    const res = fakeRes();
    let nextCalled = false;
    await syncClaims(req, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
  });
});

describe('requireAnyRealmRole', () => {
  test('calls next when the caller holds at least one of the roles', () => {
    const req = { claims: { realm_access: { roles: ['platform:marketing'] } } };
    const res = fakeRes();
    let nextCalled = false;
    requireAnyRealmRole('platform:admin', 'platform:marketing')(req, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
  });

  test('responds 403 listing every accepted role when none match', () => {
    const req = { claims: { realm_access: { roles: ['platform:customer'] } } };
    const res = fakeRes();
    let nextCalled = false;
    requireAnyRealmRole('platform:admin', 'platform:marketing')(req, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.message, 'Requires one of: platform:admin, platform:marketing');
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
