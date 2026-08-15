// platform-services/notification-service/middleware/auth.js
//
// Unverified claim extraction — same interim trust posture as every
// other service (task-service's auth.js, asset-service's auth.rs,
// search-service's claims_from_header): no JWKS signature check yet.
function decodeJwtPayload(token) {
  if (!token) return null;
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function claimsFromHeader(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) return null;
  return decodeJwtPayload(authHeader.slice('Bearer '.length));
}

// Same decode, applied to socket.io's handshake auth token instead of an
// Authorization header — a connecting client has no header to attach,
// just `io(url, { auth: { token } })`.
function claimsFromSocketToken(token) {
  return decodeJwtPayload(token);
}

// Stashes decoded claims on req.claims, same shape as task-service's
// syncUser — routes read req.claims.email directly rather than
// re-decoding the header themselves.
function syncClaims(req, res, next) {
  req.claims = claimsFromHeader(req.headers.authorization);
  next();
}

module.exports = { claimsFromHeader, claimsFromSocketToken, syncClaims };
