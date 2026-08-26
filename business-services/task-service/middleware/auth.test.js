const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');

const {
  claimsFromHeader,
  syncUser,
  requireRealmRole,
  requireAnyRealmRole,
  setJwksUriForTests,
} = require('./auth');

// Real RSA keypair + a tiny local HTTP server standing in for Keycloak's
// JWKS endpoint, so signature verification is exercised against real
// crypto rather than mocked away entirely — the whole point of this
// middleware is that a syntactically valid but forged token gets
// rejected, and that's only provable by actually verifying a signature.
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
    const token = signToken({ sub: 'user-1', email: 'a@example.com', realm_access: { roles: ['platform:admin'] } });
    const claims = await claimsFromHeader(`Bearer ${token}`);
    assert.equal(claims.sub, 'user-1');
    assert.equal(claims.email, 'a@example.com');
    assert.deepEqual(claims.realm_access.roles, ['platform:admin']);
  });

  test('missing header returns null (anonymous access to a public route)', async () => {
    assert.equal(await claimsFromHeader(undefined), null);
  });

  test('non-Bearer scheme throws rather than returning null', async () => {
    await assert.rejects(() => claimsFromHeader('Basic dXNlcjpwYXNz'));
  });

  test('a token signed by a completely different key is rejected', async () => {
    const { privateKey: otherKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const forged = jwt.sign({ sub: 'attacker', realm_access: { roles: ['platform:admin'] } }, otherKey, {
      algorithm: 'RS256',
      keyid: KID,
      expiresIn: '5m',
    });
    await assert.rejects(() => claimsFromHeader(`Bearer ${forged}`));
  });

  test('a token claiming an unrecognized kid is rejected, not blindly trusted', async () => {
    const token = signToken({ sub: 'user-1' }, { keyid: 'not-a-real-kid' });
    await assert.rejects(() => claimsFromHeader(`Bearer ${token}`));
  });

  test('an expired token is rejected', async () => {
    const token = signToken({ sub: 'user-1' }, { expiresIn: '-10s' });
    await assert.rejects(() => claimsFromHeader(`Bearer ${token}`));
  });

  test('a tampered payload (valid signature over different content) is rejected', async () => {
    const token = signToken({ sub: 'user-1', realm_access: { roles: [] } });
    const [header, , signature] = token.split('.');
    const tamperedPayload = Buffer.from(
      JSON.stringify({ sub: 'user-1', realm_access: { roles: ['platform:admin'] } })
    ).toString('base64url');
    await assert.rejects(() => claimsFromHeader(`Bearer ${header}.${tamperedPayload}.${signature}`));
  });

  test('an unsigned "alg: none" token is rejected, not silently trusted', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({ sub: 'attacker', realm_access: { roles: ['platform:admin'] } })
    ).toString('base64url');
    await assert.rejects(() => claimsFromHeader(`Bearer ${header}.${payload}.`));
  });
});

describe('syncUser', () => {
  test('no Authorization header: claims stay null, request proceeds anonymously', async () => {
    const req = { headers: {}, path: '/tasks' };
    const res = fakeRes();
    let nextCalled = false;
    await syncUser(req, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
    assert.equal(req.claims, null);
    assert.equal(res.statusCode, null);
  });

  test('a present but invalid token is rejected with 401, not downgraded to anonymous', async () => {
    const req = { headers: { authorization: 'Bearer not-a-real-jwt' }, path: '/tasks' };
    const res = fakeRes();
    let nextCalled = false;
    await syncUser(req, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
  });

  test('a valid token missing full profile claims proceeds without touching the user sync path', async () => {
    // sub present but no email/name — same "incomplete token" case the
    // original unverified version handled, now reached only after a
    // real signature check passes.
    const token = signToken({ sub: 'user-1' });
    const req = { headers: { authorization: `Bearer ${token}` }, path: '/tasks' };
    const res = fakeRes();
    let nextCalled = false;
    await syncUser(req, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
    assert.equal(req.claims.sub, 'user-1');
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
