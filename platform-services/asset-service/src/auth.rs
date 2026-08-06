use axum::http::HeaderMap;
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use serde::Deserialize;

// Claim extraction only — no signature verification against Keycloak's
// JWKS yet. Same trust posture task-service currently has (nginx +
// frontend are the only gatekeepers so far); flagged here rather than
// silently pretended otherwise. Worth revisiting once any service in
// the stack actually verifies signatures — this shouldn't be the one
// that quietly does more than its neighbors while claiming to be a
// stopgap.
#[derive(Debug, Deserialize)]
struct RealmAccess {
    #[serde(default)]
    roles: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct Claims {
    pub preferred_username: Option<String>,
    #[serde(default, rename = "realm_access")]
    realm_access: Option<RealmAccess>,
}

impl Claims {
    pub fn has_role(&self, role: &str) -> bool {
        self.realm_access
            .as_ref()
            .map(|ra| ra.roles.iter().any(|r| r == role))
            .unwrap_or(false)
    }

    pub fn username(&self) -> Option<&str> {
        self.preferred_username.as_deref()
    }
}

pub fn claims_from_headers(headers: &HeaderMap) -> Option<Claims> {
    let auth = headers.get(axum::http::header::AUTHORIZATION)?.to_str().ok()?;
    let token = auth.strip_prefix("Bearer ")?;
    let payload_b64 = token.split('.').nth(1)?;
    let payload_bytes = URL_SAFE_NO_PAD.decode(payload_b64).ok()?;
    serde_json::from_slice(&payload_bytes).ok()
}
