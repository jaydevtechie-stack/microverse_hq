// business-services/task-service/middleware/auth.js
const { upsertFromClaims } = require('../models/user');

// Unverified claim extraction — no signature check against Keycloak's
// JWKS, same interim trust posture as asset-service's auth.rs (nginx +
// frontend are the only gatekeepers so far; task-service still has no
// real auth enforcement of its own — this only keeps `users` in sync).
function claimsFromHeader(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const payload = authHeader.slice('Bearer '.length).split('.')[1];
  if (!payload) return null;
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

// Fire-and-forget — never blocks or fails the request. A user with an
// incomplete token (missing standard OIDC claims) just doesn't get
// synced yet; that's fine, the next request with a full token will.
function syncUser(req, res, next) {
  const claims = claimsFromHeader(req.headers.authorization);
  if (claims?.sub && claims?.email && claims?.name) {
    upsertFromClaims(claims).catch((err) => {
      console.error('User sync failed:', err.message);
    });
  }
  next();
}

module.exports = { syncUser };
