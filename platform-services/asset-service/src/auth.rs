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
// Keycloak's actual signing key before anything in it is trusted.
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

// No jwks-rsa equivalent crate in the Rust ecosystem with the same
// turnkey caching this stack's Node services get for free — this hand-
// rolls the same shape: an in-memory cache keyed by kid, a TTL so a key
// Keycloak later retires eventually falls out even if it's never
// looked up again, and a cache-miss-triggers-one-refetch path so a
// genuinely new kid (real key rotation) doesn't need a deploy to work.
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
    // Cache miss, or stale — refetch once before giving up. This is the
    // key-rotation path: Keycloak started signing with a kid we haven't
    // seen, so go get the current set rather than trusting a stale one.
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

// Returns None for a missing/malformed header — same as before, callers
// treat that as anonymous. A Bearer token that IS present but fails
// verification also returns None here (jsonwebtoken's decode() folds
// every failure mode — bad signature, expired, unknown kid after the
// refetch above, wrong algorithm — into a single Result::Err), which
// every call site already treats as "not authenticated" via `?`/
// `ok_or`. No fallback to unverified decoding.
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
    use jsonwebtoken::{encode, EncodingKey, Header};
    use serde::Serialize;
    use std::net::SocketAddr;
    use tokio::net::TcpListener;

    #[derive(Serialize)]
    struct TestClaims {
        exp: usize,
        // Real Keycloak access tokens always carry aud: "account" (the
        // built-in client every token is issued against by default) -
        // included here by default in sign_token so the test suite
        // exercises the same shape a real token has. This is exactly
        // the field that caught a real bug during live verification:
        // jsonwebtoken's Validation defaults to requiring an aud match
        // even with no expected audience configured, which silently
        // rejected every real token despite every test here passing,
        // since no test token had ever carried an aud claim before.
        aud: Option<String>,
        preferred_username: Option<String>,
        realm_access: Option<TestRealmAccess>,
    }

    #[derive(Serialize)]
    struct TestRealmAccess {
        roles: Vec<String>,
    }

    fn rsa_keypair() -> (rsa::RsaPrivateKey, String, String) {
        use rsa::traits::PublicKeyParts;
        use rsa::RsaPrivateKey;
        use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};

        let mut rng = rand::thread_rng();
        let private_key = RsaPrivateKey::new(&mut rng, 2048).expect("generate RSA key");
        let public_key = private_key.to_public_key();
        let n = URL_SAFE_NO_PAD.encode(public_key.n().to_bytes_be());
        let e = URL_SAFE_NO_PAD.encode(public_key.e().to_bytes_be());
        (private_key, n, e)
    }

    // Starts a tiny local HTTP server serving a real JWKS document (a
    // genuine RSA keypair, not a mock signature) and points the module's
    // env-derived JWKS URL at it, so signature verification is exercised
    // against real crypto rather than mocked away.
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

        let exp = (chrono_exp(exp_offset_secs)) as usize;
        let claims = TestClaims {
            exp,
            aud: Some("account".to_string()),
            preferred_username: Some("acme-forestry".to_string()),
            realm_access: Some(TestRealmAccess {
                roles: vec!["platform:customer".to_string()],
            }),
        };
        let mut header = Header::new(Algorithm::RS256);
        header.kid = Some(kid.to_string());
        encode(&header, &claims, &encoding_key).unwrap()
    }

    fn chrono_exp(offset_secs: i64) -> i64 {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;
        now + offset_secs
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
    async fn valid_token_from_the_real_jwks_verifies() {
        let (private_key, n, e) = rsa_keypair();
        let kid = "test-key-1";
        let addr = start_mock_jwks(kid, &n, &e).await;
        std::env::set_var("KEYCLOAK_INTERNAL_URL", format!("http://{addr}"));
        std::env::set_var("KEYCLOAK_REALM", "test-verify-1");
        // Force a fresh fetch — tests share the process-wide static cache.
        *JWKS_CACHE.write().await = None;

        let token = sign_token(&private_key, kid, 300);
        let claims = claims_from_headers(&header_map_with_bearer(&token)).await.unwrap();

        assert!(claims.has_role("platform:customer"));
        assert_eq!(claims.username(), Some("acme-forestry"));
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

        // Signed with a different key than the one the mock JWKS serves
        // under this kid — same forged-token scenario a real attacker
        // would attempt.
        let forged = sign_token(&other_key, kid, 300);
        let result = claims_from_headers(&header_map_with_bearer(&forged)).await;
        assert!(result.is_none());
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
        let result = claims_from_headers(&header_map_with_bearer(&expired)).await;
        assert!(result.is_none());
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
        let result = claims_from_headers(&header_map_with_bearer(&token)).await;
        assert!(result.is_none());
    }
}
