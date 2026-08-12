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

// req.path is relative to this middleware's mount point ('/api', see
// server.js) — '/users/me' here means the real route is '/api/users/me'.
// Deliberately small: My Profile's own read endpoint only. See
// ARCHITECTURE.md's Roles and permissions / SCHEMA.md's users for why
// this lives here rather than as a separate mechanism.
const ACTIVE_CHECK_ALLOWLIST = ['/users/me'];

// Stashes the decoded claims on req.claims — routes that need to know
// "who's asking" (e.g. the Project Hub's PM-scoped queries) read that
// directly rather than re-decoding the header themselves. Still
// unverified, same trust posture as everywhere else in task-service.
//
// A user with an incomplete token (missing standard OIDC claims) just
// doesn't get synced and isn't blocked either — there's no `active`
// value to check without an identity. Once synced, `active = false`
// gets a 403 for anything off the allowlist above — the real boundary
// behind the frontend's scrim (see ARCHITECTURE.md). This is no longer
// fire-and-forget: the upsert has to be awaited so `active` is known
// before deciding whether to let the request through.
async function syncUser(req, res, next) {
  const claims = claimsFromHeader(req.headers.authorization);
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
// time. Still reads the same unverified req.claims syncUser sets.
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

module.exports = { syncUser, requireRealmRole, requireAnyRealmRole };
