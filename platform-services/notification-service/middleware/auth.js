// platform-services/notification-service/middleware/auth.js
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

// Real signature verification against Keycloak's JWKS, closing the gap
// docs/security.md flagged as the top-priority item ("claim extraction
// is currently unverified"). Matters more here than it looks: the
// socket handshake path (claimsFromSocketToken, below) joins a
// notification room keyed by claims.email — before this, a forged token
// claiming any email could join that person's room and read their
// real-time in-app notifications. jwks-rsa's own cache (keyed by kid)
// handles key rotation for free: an unseen kid is a cache miss, which
// triggers exactly one fetch from Keycloak before failing.
const KEYCLOAK_INTERNAL_URL = process.env.KEYCLOAK_INTERNAL_URL || 'http://microverse-keycloak:8080';
const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM || 'microverse';

function buildJwksClient(jwksUri) {
  return jwksClient({
    jwksUri,
    cache: true,
    cacheMaxAge: 10 * 60 * 1000,
    rateLimit: true,
    jwksRequestsPerMinute: 10,
  });
}

let jwks = buildJwksClient(`${KEYCLOAK_INTERNAL_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/certs`);

// Test-only seam: points the client at a local mock JWKS server instead
// of real Keycloak, so signature verification itself is exercised with
// a real keypair rather than mocked away. Never called outside tests.
function setJwksUriForTests(jwksUri) {
  jwks = buildJwksClient(jwksUri);
}

function getSigningKey(header, callback) {
  jwks.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    callback(null, key.getPublicKey());
  });
}

function verifyToken(token) {
  return new Promise((resolve, reject) => {
    jwt.verify(token, getSigningKey, { algorithms: ['RS256'] }, (err, decoded) => {
      if (err) return reject(err);
      resolve(decoded);
    });
  });
}

// Returns null only when no token was presented at all. A token that IS
// presented but fails verification — bad signature, expired, malformed,
// unrecognized kid — throws; callers below turn that into a hard reject
// (401 for HTTP, a socket connect_error for the handshake path) rather
// than silently downgrading to anonymous.
async function claimsFromHeader(authHeader) {
  if (!authHeader) return null;
  if (!authHeader.startsWith('Bearer ')) {
    throw new Error('Authorization header is not a Bearer token');
  }
  return verifyToken(authHeader.slice('Bearer '.length));
}

// Same verification, applied to socket.io's handshake auth token instead
// of an Authorization header — a connecting client has no header to
// attach, just `io(url, { auth: { token } })`.
async function claimsFromSocketToken(token) {
  if (!token) return null;
  return verifyToken(token);
}

// Stashes verified claims on req.claims, same shape as task-service's
// syncUser — routes read req.claims.email directly rather than
// re-decoding the header themselves. A present-but-invalid token is a
// hard 401, not a silent downgrade to anonymous.
async function syncClaims(req, res, next) {
  try {
    req.claims = await claimsFromHeader(req.headers.authorization);
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
  next();
}

module.exports = { claimsFromHeader, claimsFromSocketToken, syncClaims, setJwksUriForTests };
