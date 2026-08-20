// platform-services/blog-service/middleware/auth.js
//
// Unverified claim extraction — same interim trust posture as every other
// service (task-service's auth.js, notification-service's auth.js,
// audit-service's auth.js, asset-service's auth.rs): no JWKS signature
// check yet. Ported verbatim — this stack's shared-nothing per-service
// copy pattern, not a shared package.
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

function syncClaims(req, res, next) {
  req.claims = claimsFromHeader(req.headers.authorization);
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

module.exports = { claimsFromHeader, syncClaims, requireAnyRealmRole };
