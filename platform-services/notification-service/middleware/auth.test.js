// platform-services/notification-service/middleware/auth.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { claimsFromHeader, claimsFromSocketToken } = require('./auth');

function fakeJwt(claims) {
  const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return `${header}.${payload}.`;
}

test('claimsFromHeader decodes a Bearer JWT payload', () => {
  const token = fakeJwt({ email: 'matthew@microverse.local' });
  assert.deepEqual(claimsFromHeader(`Bearer ${token}`), { email: 'matthew@microverse.local' });
});

test('claimsFromHeader returns null without a Bearer prefix', () => {
  assert.equal(claimsFromHeader('not-a-bearer-token'), null);
});

test('claimsFromHeader returns null for missing/malformed header', () => {
  assert.equal(claimsFromHeader(undefined), null);
  assert.equal(claimsFromHeader('Bearer '), null);
});

test('claimsFromSocketToken decodes the same shape as a raw token', () => {
  const token = fakeJwt({ email: 'mark@microverse.local' });
  assert.deepEqual(claimsFromSocketToken(token), { email: 'mark@microverse.local' });
});

test('claimsFromSocketToken returns null for an unparseable token', () => {
  assert.equal(claimsFromSocketToken('garbage'), null);
  assert.equal(claimsFromSocketToken(undefined), null);
});
