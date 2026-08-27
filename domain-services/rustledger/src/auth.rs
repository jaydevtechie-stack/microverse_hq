use axum::http::HeaderMap;
use jsonwebtoken::{decode, decode_header, Algorithm, DecodingKey, Validation};
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::{Arc, LazyLock};
use std::time::{Duration, Instant};
use tokio::sync::RwLock;

// Real signature verification against Keycloak's JWKS, closing the gap
// docs/security.md flagged as the top-priority item ("claim extraction
// is currently unverified"). A syntactically correct but forged/unsigned
// token used to be trusted outright; now every claim is checked against
// Keycloak's actual signing key before anything in it is trusted — this
// matters more here than most services, since the bill routes match
// claims.email/claims.sub against real money (a PM approving their own
// task, a customer's own bill).
#[derive(Debug, Deserialize)]
struct RealmAccess {
    #[serde(default)]
    roles: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct Claims {
    #[serde(default, rename = "realm_access")]
    realm_access: Option<RealmAccess>,
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

#[derive(Debug, Deserialize)]
struct Jwk {
    kid: String,
    n: String,
    e: String,
}

#[derive(Debug, Deserialize)]
struct JwksDocument {
    keys: Vec<Jwk>,
}

struct JwksCache {
    keys: HashMap<String, Arc<DecodingKey>>,
    fetched_at: Instant,
}

// Same hand-rolled JWKS cache as asset-service's auth.rs (no jwks-rsa
// equivalent crate in the Rust ecosystem) — in-memory, keyed by kid, TTL
// so a retired key eventually falls out even if never looked up again,
// cache-miss-triggers-one-refetch so real key rotation doesn't need a
// deploy.
static JWKS_CACHE: LazyLock<RwLock<Option<JwksCache>>> = LazyLock::new(|| RwLock::new(None));
const CACHE_TTL: Duration = Duration::from_secs(10 * 60);

fn keycloak_internal_url() -> String {
    std::env::var("KEYCLOAK_INTERNAL_URL").unwrap_or_else(|_| "http://microverse-keycloak:8080".to_string())
}

fn keycloak_realm() -> String {
    std::env::var("KEYCLOAK_REALM").unwrap_or_else(|_| "microverse".to_string())
}

async fn fetch_jwks() -> Result<HashMap<String, Arc<DecodingKey>>, String> {
    let url = format!(
        "{}/realms/{}/protocol/openid-connect/certs",
        keycloak_internal_url(),
        keycloak_realm()
    );
    let doc: JwksDocument = reqwest::get(&url)
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    let mut keys = HashMap::new();
    for jwk in doc.keys {
        if let Ok(key) = DecodingKey::from_rsa_components(&jwk.n, &jwk.e) {
            keys.insert(jwk.kid, Arc::new(key));
        }
    }
    Ok(keys)
}

async fn signing_key_for(kid: &str) -> Result<Arc<DecodingKey>, String> {
    {
        let cache = JWKS_CACHE.read().await;
        if let Some(c) = cache.as_ref() {
            if c.fetched_at.elapsed() < CACHE_TTL {
                if let Some(key) = c.keys.get(kid) {
                    return Ok(Arc::clone(key));
                }
            }
        }
    }
    let keys = fetch_jwks().await?;
    let key = keys
        .get(kid)
        .cloned()
        .ok_or_else(|| format!("unknown kid: {kid}"))?;
    *JWKS_CACHE.write().await = Some(JwksCache {
        keys,
        fetched_at: Instant::now(),
    });
    Ok(key)
}

// Returns None for a missing/malformed header (unchanged, callers treat
// that as anonymous) or for a token that fails verification — bad
// signature, expired, unknown kid after the refetch above, wrong
// algorithm all fold into jsonwebtoken's single Result::Err here, which
// every call site already treats as "not authenticated". No fallback to
// unverified decoding.
pub async fn claims_from_headers(headers: &HeaderMap) -> Option<Claims> {
    let auth = headers.get(axum::http::header::AUTHORIZATION)?.to_str().ok()?;
    let token = auth.strip_prefix("Bearer ")?;
    let header = decode_header(token).ok()?;
    let kid = header.kid?;
    let key = signing_key_for(&kid).await.ok()?;
    // jsonwebtoken's Validation defaults to requiring an `aud` claim
    // match even with no expected audience configured, which rejects
    // every real Keycloak token outright (they carry aud: "account").
    // This service only cares that the signature and expiry check out,
    // matching the Node services' jwt.verify calls, which never
    // validate audience either.
    let mut validation = Validation::new(Algorithm::RS256);
    validation.validate_aud = false;
    decode::<Claims>(token, &key, &validation).ok().map(|data| data.claims)
}

// Test-only constructor — Claims's fields are deliberately private outside
// this module (nothing but claims_from_headers should build one from
// anything other than a real, verified token), but api.rs's own tests
// need Claims values to exercise is_staff/forbidden_for_customer without
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
    use jsonwebtoken::{encode, EncodingKey, Header};
    use serde::Serialize;
    use std::net::SocketAddr;
    use tokio::net::TcpListener;

    #[derive(Serialize)]
    struct TestClaims {
        exp: usize,
        // Real Keycloak access tokens always carry aud: "account" -
        // included here so the test suite matches a real token's shape.
        // This is exactly the field that caught a real bug during live
        // verification: jsonwebtoken's Validation defaults to requiring
        // an aud match even with no expected audience configured, which
        // silently rejected every real token despite every test here
        // passing, since no test token had ever carried an aud claim.
        aud: Option<String>,
        email: Option<String>,
        sub: Option<String>,
        realm_access: Option<TestRealmAccess>,
    }

    #[derive(Serialize)]
    struct TestRealmAccess {
        roles: Vec<String>,
    }

    fn rsa_keypair() -> (rsa::RsaPrivateKey, String, String) {
        use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
        use rsa::traits::PublicKeyParts;
        use rsa::RsaPrivateKey;

        let mut rng = rand::thread_rng();
        let private_key = RsaPrivateKey::new(&mut rng, 2048).expect("generate RSA key");
        let public_key = private_key.to_public_key();
        let n = URL_SAFE_NO_PAD.encode(public_key.n().to_bytes_be());
        let e = URL_SAFE_NO_PAD.encode(public_key.e().to_bytes_be());
        (private_key, n, e)
    }

    async fn start_mock_jwks(kid: &str, n: &str, e: &str) -> SocketAddr {
        let body = serde_json::json!({
            "keys": [{ "kty": "RSA", "kid": kid, "use": "sig", "alg": "RS256", "n": n, "e": e }]
        })
        .to_string();

        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();

        tokio::spawn(async move {
            loop {
                let (stream, _) = match listener.accept().await {
                    Ok(v) => v,
                    Err(_) => return,
                };
                let body = body.clone();
                tokio::spawn(async move {
                    use tokio::io::{AsyncReadExt, AsyncWriteExt};
                    let mut stream = stream;
                    let mut buf = [0u8; 1024];
                    let _ = stream.read(&mut buf).await;
                    let response = format!(
                        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                        body.len(),
                        body
                    );
                    let _ = stream.write_all(response.as_bytes()).await;
                });
            }
        });

        addr
    }

    fn sign_token(private_key: &rsa::RsaPrivateKey, kid: &str, exp_offset_secs: i64) -> String {
        use rsa::pkcs1::EncodeRsaPrivateKey;
        let pem = private_key.to_pkcs1_pem(Default::default()).unwrap();
        let encoding_key = EncodingKey::from_rsa_pem(pem.as_bytes()).unwrap();

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;
        let claims = TestClaims {
            exp: (now + exp_offset_secs) as usize,
            aud: Some("account".to_string()),
            email: Some("pm@example.com".to_string()),
            sub: Some("11111111-1111-1111-1111-111111111111".to_string()),
            realm_access: Some(TestRealmAccess {
                roles: vec!["platform:admin".to_string()],
            }),
        };
        let mut header = Header::new(Algorithm::RS256);
        header.kid = Some(kid.to_string());
        encode(&header, &claims, &encoding_key).unwrap()
    }

    fn header_map_with_bearer(token: &str) -> HeaderMap {
        let mut headers = HeaderMap::new();
        headers.insert(
            axum::http::header::AUTHORIZATION,
            format!("Bearer {token}").parse().unwrap(),
        );
        headers
    }

    #[tokio::test]
    async fn valid_token_from_the_real_jwks_extracts_roles_email_and_sub() {
        let (private_key, n, e) = rsa_keypair();
        let kid = "test-key-1";
        let addr = start_mock_jwks(kid, &n, &e).await;
        std::env::set_var("KEYCLOAK_INTERNAL_URL", format!("http://{addr}"));
        std::env::set_var("KEYCLOAK_REALM", "test-verify-1");
        *JWKS_CACHE.write().await = None;

        let token = sign_token(&private_key, kid, 300);
        let claims = claims_from_headers(&header_map_with_bearer(&token)).await.unwrap();

        assert!(claims.has_role("platform:admin"));
        assert_eq!(claims.email(), Some("pm@example.com"));
        assert_eq!(claims.sub(), Some("11111111-1111-1111-1111-111111111111"));
    }

    #[tokio::test]
    async fn token_signed_by_an_unknown_key_is_rejected() {
        let (_signing_key, n, e) = rsa_keypair();
        let (other_key, _n2, _e2) = rsa_keypair();
        let kid = "test-key-2";
        let addr = start_mock_jwks(kid, &n, &e).await;
        std::env::set_var("KEYCLOAK_INTERNAL_URL", format!("http://{addr}"));
        std::env::set_var("KEYCLOAK_REALM", "test-verify-2");
        *JWKS_CACHE.write().await = None;

        let forged = sign_token(&other_key, kid, 300);
        assert!(claims_from_headers(&header_map_with_bearer(&forged)).await.is_none());
    }

    #[tokio::test]
    async fn expired_token_is_rejected() {
        let (private_key, n, e) = rsa_keypair();
        let kid = "test-key-3";
        let addr = start_mock_jwks(kid, &n, &e).await;
        std::env::set_var("KEYCLOAK_INTERNAL_URL", format!("http://{addr}"));
        std::env::set_var("KEYCLOAK_REALM", "test-verify-3");
        *JWKS_CACHE.write().await = None;

        // Well outside jsonwebtoken's default 60s leeway (clock-skew
        // tolerance) - a -60s offset landed right on that boundary and
        // was flaky depending on exact wall-clock timing during the test.
        let expired = sign_token(&private_key, kid, -3600);
        assert!(claims_from_headers(&header_map_with_bearer(&expired)).await.is_none());
    }

    #[tokio::test]
    async fn missing_authorization_header_returns_none() {
        assert!(claims_from_headers(&HeaderMap::new()).await.is_none());
    }

    #[tokio::test]
    async fn non_bearer_scheme_returns_none() {
        let mut headers = HeaderMap::new();
        headers.insert(
            axum::http::header::AUTHORIZATION,
            "Basic dXNlcjpwYXNz".parse().unwrap(),
        );
        assert!(claims_from_headers(&headers).await.is_none());
    }

    #[tokio::test]
    async fn token_with_an_unrecognized_kid_is_rejected() {
        let (private_key, n, e) = rsa_keypair();
        let addr = start_mock_jwks("the-real-kid", &n, &e).await;
        std::env::set_var("KEYCLOAK_INTERNAL_URL", format!("http://{addr}"));
        std::env::set_var("KEYCLOAK_REALM", "test-verify-4");
        *JWKS_CACHE.write().await = None;

        let token = sign_token(&private_key, "not-the-real-kid", 300);
        assert!(claims_from_headers(&header_map_with_bearer(&token)).await.is_none());
    }
}
