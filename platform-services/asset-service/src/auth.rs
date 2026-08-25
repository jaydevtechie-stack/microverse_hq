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

#[cfg(test)]
impl Claims {
    pub fn for_test(roles: &[&str], username: Option<&str>) -> Self {
        Self {
            realm_access: Some(RealmAccess {
                roles: roles.iter().map(|r| r.to_string()).collect(),
            }),
            preferred_username: username.map(String::from),
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

    fn fake_jwt_from_raw_payload(raw: &str) -> String {
        format!("header.{}.signature", URL_SAFE_NO_PAD.encode(raw.as_bytes()))
    }

    fn fake_jwt(payload_json: &str) -> String {
        fake_jwt_from_raw_payload(payload_json)
    }

    #[test]
    fn valid_token_extracts_roles_and_username() {
        let token = fake_jwt(
            r#"{"realm_access":{"roles":["platform:customer","service:gofeeler"]},"preferred_username":"acme-forestry"}"#,
        );
        let claims = claims_from_headers(&header_map_with_bearer(&token)).unwrap();

        assert!(claims.has_role("platform:customer"));
        assert!(claims.has_role("service:gofeeler"));
        assert!(!claims.has_role("platform:admin"));
        assert_eq!(claims.username(), Some("acme-forestry"));
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

    #[test]
    fn token_with_no_realm_access_has_no_roles() {
        let token = fake_jwt(r#"{"preferred_username":"acme-forestry"}"#);
        let claims = claims_from_headers(&header_map_with_bearer(&token)).unwrap();

        assert!(!claims.has_role("platform:customer"));
        assert_eq!(claims.username(), Some("acme-forestry"));
    }

    #[test]
    fn empty_roles_list_has_no_roles() {
        let token = fake_jwt(r#"{"realm_access":{"roles":[]}}"#);
        let claims = claims_from_headers(&header_map_with_bearer(&token)).unwrap();
        assert!(!claims.has_role("platform:customer"));
    }

    #[test]
    fn for_test_builder_round_trips_roles_and_username() {
        let claims = Claims::for_test(&["platform:admin"], Some("abby"));
        assert!(claims.has_role("platform:admin"));
        assert!(!claims.has_role("platform:customer"));
        assert_eq!(claims.username(), Some("abby"));
    }
}
