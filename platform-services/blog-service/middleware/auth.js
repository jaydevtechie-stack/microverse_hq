// platform-services/blog-service/middleware/auth.js
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

// Real signature verification against Keycloak's JWKS, closing the gap
// docs/security.md flagged as the top-priority item ("claim extraction
// is currently unverified"). Matters more here than the general case:
// this stack's JWT auth being unverified means a forged-role write was
// more reachable than the role gate alone suggested (see lib/sanitize.js's
// own comment) — a forged platform:marketing token used to be
// indistinguishable from a real one. jwks-rsa's own cache (keyed by kid)
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

// Returns null only when no token was presented at all (anonymous
// access to a public route). A token that IS presented but fails
// verification throws; syncClaims below turns that into a hard 401 —
// no fallback to unverified decoding.
async function claimsFromHeader(authHeader) {
  if (!authHeader) return null;
  if (!authHeader.startsWith('Bearer ')) {
    throw new Error('Authorization header is not a Bearer token');
  }
  return verifyToken(authHeader.slice('Bearer '.length));
}

async function syncClaims(req, res, next) {
  try {
    req.claims = await claimsFromHeader(req.headers.authorization);
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
  next();
}

function requireAnyRealmRole(...roles) {
  return (req, res, next) => {
    const userRoles = req.claims?.realm_access?.roles || [];
    if (!roles.some((role) => userRoles.includes(role))) {
      return res.status(403).json({ message: `Requires one of: ${roles.join(', ')}` });
    }
    next();
  };
}

module.exports = { claimsFromHeader, syncClaims, requireAnyRealmRole, setJwksUriForTests };
