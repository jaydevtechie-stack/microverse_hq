use axum::http::HeaderMap;
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use serde::Deserialize;

// Claim extraction only — no signature verification against Keycloak's
// JWKS yet, same interim trust posture as asset-service's auth.rs and
// task-service's middleware/auth.js. Added here to close the OWASP A01
// finding (docs/security.md) that rustledger, unlike every other
// service, did no auth check at all — this is the minimum needed to
// gate endpoints on a role, not a claim to be more verified than its
// siblings.
#[derive(Debug, Deserialize)]
struct RealmAccess {
    #[serde(default)]
    roles: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct Claims {
    #[serde(default, rename = "realm_access")]
    realm_access: Option<RealmAccess>,
    // email/sub — needed for the bill routes (Branch 9): matching the
    // approving PM's own identity against a task's `owner`, and a
    // customer's own identity against a bill's `customer_id`. Same claim
    // names task-service's own middleware/auth.js already reads
    // (`req.claims?.email`, `req.claims?.sub`) from the same tokens.
    #[serde(default)]
    email: Option<String>,
    #[serde(default)]
    sub: Option<String>,
}

impl Claims {
    pub fn has_role(&self, role: &str) -> bool {
        self.realm_access
            .as_ref()
            .map(|ra| ra.roles.iter().any(|r| r == role))
            .unwrap_or(false)
    }

    pub fn email(&self) -> Option<&str> {
        self.email.as_deref()
    }

    pub fn sub(&self) -> Option<&str> {
        self.sub.as_deref()
    }
}

pub fn claims_from_headers(headers: &HeaderMap) -> Option<Claims> {
    let auth = headers.get(axum::http::header::AUTHORIZATION)?.to_str().ok()?;
    let token = auth.strip_prefix("Bearer ")?;
    let payload_b64 = token.split('.').nth(1)?;
    let payload_bytes = URL_SAFE_NO_PAD.decode(payload_b64).ok()?;
    serde_json::from_slice(&payload_bytes).ok()
}
