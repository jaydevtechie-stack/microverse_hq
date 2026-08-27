// business-services/task-service/middleware/auth.js
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const { upsertFromClaims } = require('../models/user');

// Real signature verification against Keycloak's JWKS, closing the gap
// docs/security.md flagged as the top-priority item ("claim extraction
// is currently unverified"). A syntactically valid but forged/unsigned
// token used to be trusted outright; now jwt.verify checks it against
// Keycloak's actual signing key before anything in it is trusted.
//
// jwks-rsa's own cache (keyed by kid) handles key rotation for free: a
// kid it hasn't seen is a cache miss, which triggers exactly one fetch
// from Keycloak before failing — not a blind trust, and not a refetch
// storm on a genuinely bad kid either (rateLimit caps that).
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
// access to a public route, unchanged from before). A token that IS
// presented but fails verification — bad signature, expired, malformed,
// wrong algorithm, unrecognized kid — throws, which syncUser below
// turns into a hard 401. No fallback to unverified decoding.
async function claimsFromHeader(authHeader) {
  if (!authHeader) return null;
  if (!authHeader.startsWith('Bearer ')) {
    throw new Error('Authorization header is not a Bearer token');
  }
  return verifyToken(authHeader.slice('Bearer '.length));
}

// req.path is relative to this middleware's mount point ('/api', see
// server.js) — '/users/me' here means the real route is '/api/users/me'.
// Deliberately small: My Profile's own read endpoint only. See
// ARCHITECTURE.md's Roles and permissions / SCHEMA.md's users for why
// this lives here rather than as a separate mechanism.
const ACTIVE_CHECK_ALLOWLIST = ['/users/me'];

// Stashes the verified claims on req.claims — routes that need to know
// "who's asking" (e.g. the Project Hub's PM-scoped queries) read that
// directly rather than re-decoding the header themselves.
//
// A user with an incomplete token (missing standard OIDC claims) just
// doesn't get synced and isn't blocked either — there's no `active`
// value to check without an identity. Once synced, `active = false`
// gets a 403 for anything off the allowlist above — the real boundary
// behind the frontend's scrim (see ARCHITECTURE.md). This is no longer
// fire-and-forget: the upsert has to be awaited so `active` is known
// before deciding whether to let the request through.
async function syncUser(req, res, next) {
  let claims;
  try {
    claims = await claimsFromHeader(req.headers.authorization);
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
  req.claims = claims;

  if (!(claims?.sub && claims?.email && claims?.name)) {
    return next();
  }

  try {
    const user = await upsertFromClaims({ ...claims, roles: claims.realm_access?.roles });
    if (!user.active && !ACTIVE_CHECK_ALLOWLIST.includes(req.path)) {
      return res.status(403).json({ message: 'Account is deactivated' });
    }
  } catch (err) {
    console.error('User sync failed:', err.message);
  }

  next();
}

// Small shared version of the inline `req.claims.realm_access.roles
// .includes(...)` check project-routes.js already duplicates for
// platform:account-manager/platform:customer — worth the one-function
// extraction now that service-routes.js needs the same check a third
// time. Reads the now-verified req.claims syncUser sets.
function requireRealmRole(role) {
  return (req, res, next) => {
    const roles = req.claims?.realm_access?.roles || [];
    if (!roles.includes(role)) {
      return res.status(403).json({ message: `Requires ${role}` });
    }
    next();
  };
}

// Same idea as requireRealmRole, but for routes a caller can satisfy with
// any one of several roles — the reviewer-workflow routes (reassign/
// approve/reject) are usable by either platform:project-manager (the
// default reviewer) or platform:reviewer (a dedicated one), and neither
// alone is "the" required role the way requireRealmRole assumes.
function requireAnyRealmRole(...roles) {
  return (req, res, next) => {
    const userRoles = req.claims?.realm_access?.roles || [];
    if (!roles.some((role) => userRoles.includes(role))) {
      return res.status(403).json({ message: `Requires one of: ${roles.join(', ')}` });
    }
    next();
  };
}

module.exports = {
  syncUser,
  requireRealmRole,
  requireAnyRealmRole,
  claimsFromHeader,
  setJwksUriForTests,
};
