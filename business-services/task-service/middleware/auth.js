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
// Also stashes the decoded claims on req.claims — routes that need to
// know "who's asking" (e.g. the Project Hub's PM-scoped queries) read
// that directly rather than re-decoding the header themselves. Still
// unverified, same trust posture as everywhere else in task-service.
function syncUser(req, res, next) {
  const claims = claimsFromHeader(req.headers.authorization);
  req.claims = claims;
  if (claims?.sub && claims?.email && claims?.name) {
    upsertFromClaims({ ...claims, roles: claims.realm_access?.roles }).catch((err) => {
      console.error('User sync failed:', err.message);
    });
  }
  next();
}

module.exports = { syncUser };
