const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');

const { claimsFromHeader, claimsFromSocketToken, syncClaims, setJwksUriForTests } = require('./auth');

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
    const token = signToken({ sub: 'user-1', email: 'matthew@microverse.local' });
    const claims = await claimsFromHeader(`Bearer ${token}`);
    assert.equal(claims.email, 'matthew@microverse.local');
  });

  test('missing header returns null', async () => {
    assert.equal(await claimsFromHeader(undefined), null);
  });

  test('non-Bearer scheme throws', async () => {
    await assert.rejects(() => claimsFromHeader('not-a-bearer-token'));
  });

  test('a token signed by an unknown key is rejected', async () => {
    const { privateKey: otherKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const forged = jwt.sign({ email: 'victim@microverse.local' }, otherKey, {
      algorithm: 'RS256',
      keyid: KID,
      expiresIn: '5m',
    });
    await assert.rejects(() => claimsFromHeader(`Bearer ${forged}`));
  });

  test('an expired token is rejected', async () => {
    const token = signToken({ email: 'matthew@microverse.local' }, { expiresIn: '-10s' });
    await assert.rejects(() => claimsFromHeader(`Bearer ${token}`));
  });
});

describe('claimsFromSocketToken', () => {
  test('a validly signed token verifies and returns its claims', async () => {
    const token = signToken({ email: 'mark@microverse.local' });
    const claims = await claimsFromSocketToken(token);
    assert.equal(claims.email, 'mark@microverse.local');
  });

  test('no token returns null (anonymous socket connection allowed)', async () => {
    assert.equal(await claimsFromSocketToken(undefined), null);
  });

  test('a forged token claiming someone else\'s email is rejected, not trusted', async () => {
    const { privateKey: otherKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const forged = jwt.sign({ email: 'victim@microverse.local' }, otherKey, {
      algorithm: 'RS256',
      keyid: KID,
      expiresIn: '5m',
    });
    await assert.rejects(() => claimsFromSocketToken(forged));
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
    assert.equal(res.statusCode, null);
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

  test('a validly signed token sets req.claims and proceeds', async () => {
    const token = signToken({ email: 'matthew@microverse.local' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = fakeRes();
    let nextCalled = false;
    await syncClaims(req, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
    assert.equal(req.claims.email, 'matthew@microverse.local');
  });
});
