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

// Test-only constructor — Claims's fields are deliberately private outside
// this module (nothing but claims_from_headers should build one from
// anything other than an actual token), but api.rs's own tests need
// Claims values to exercise is_staff/forbidden_for_customer without
// hand-rolling a JWT in every test case.
#[cfg(test)]
impl Claims {
    pub fn for_test(roles: &[&str], email: Option<&str>, sub: Option<&str>) -> Self {
        Self {
            realm_access: Some(RealmAccess {
                roles: roles.iter().map(|r| r.to_string()).collect(),
            }),
            email: email.map(String::from),
            sub: sub.map(String::from),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderValue;

    fn header_map_with_bearer(token: &str) -> HeaderMap {
        let mut headers = HeaderMap::new();
        headers.insert(
            axum::http::header::AUTHORIZATION,
            HeaderValue::from_str(&format!("Bearer {token}")).unwrap(),
        );
        headers
    }

    fn encode_payload(json: &str) -> String {
        URL_SAFE_NO_PAD.encode(json.as_bytes())
    }

    fn fake_jwt(payload_json: &str) -> String {
        // header.payload.signature — only the payload is ever read, but a
        // real Bearer token always has all three dot-separated segments.
        format!("header.{}.signature", encode_payload(payload_json))
    }

    #[test]
    fn valid_token_extracts_roles_email_and_sub() {
        let token = fake_jwt(
            r#"{"realm_access":{"roles":["platform:admin","platform:customer"]},"email":"pm@example.com","sub":"11111111-1111-1111-1111-111111111111"}"#,
        );
        let claims = claims_from_headers(&header_map_with_bearer(&token)).unwrap();

        assert!(claims.has_role("platform:admin"));
        assert!(claims.has_role("platform:customer"));
        assert!(!claims.has_role("platform:project-manager"));
        assert_eq!(claims.email(), Some("pm@example.com"));
        assert_eq!(claims.sub(), Some("11111111-1111-1111-1111-111111111111"));
    }

    #[test]
    fn missing_authorization_header_returns_none() {
        assert!(claims_from_headers(&HeaderMap::new()).is_none());
    }

    #[test]
    fn non_bearer_scheme_returns_none() {
        let mut headers = HeaderMap::new();
        headers.insert(
            axum::http::header::AUTHORIZATION,
            HeaderValue::from_static("Basic dXNlcjpwYXNz"),
        );
        assert!(claims_from_headers(&headers).is_none());
    }

    #[test]
    fn token_missing_payload_segment_returns_none() {
        assert!(claims_from_headers(&header_map_with_bearer("onlyheader")).is_none());
    }

    #[test]
    fn payload_not_valid_base64_returns_none() {
        let token = "header.not!valid!base64.signature";
        assert!(claims_from_headers(&header_map_with_bearer(token)).is_none());
    }

    #[test]
    fn payload_not_valid_json_returns_none() {
        let token = fake_jwt_from_raw_payload("not json");
        assert!(claims_from_headers(&header_map_with_bearer(&token)).is_none());
    }

    fn fake_jwt_from_raw_payload(raw: &str) -> String {
        format!("header.{}.signature", URL_SAFE_NO_PAD.encode(raw.as_bytes()))
    }

    #[test]
    fn token_with_no_realm_access_has_no_roles() {
        let token = fake_jwt(r#"{"email":"customer@example.com"}"#);
        let claims = claims_from_headers(&header_map_with_bearer(&token)).unwrap();

        assert!(!claims.has_role("platform:admin"));
        assert_eq!(claims.email(), Some("customer@example.com"));
        assert_eq!(claims.sub(), None);
    }

    #[test]
    fn empty_roles_list_has_no_roles() {
        let token = fake_jwt(r#"{"realm_access":{"roles":[]}}"#);
        let claims = claims_from_headers(&header_map_with_bearer(&token)).unwrap();
        assert!(!claims.has_role("platform:admin"));
    }
}
