package auth

import (
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// Real RSA keypair + a real local HTTP server standing in for Keycloak's
// JWKS endpoint, so signature verification is exercised against real
// crypto rather than mocked away entirely.
func generateKeyPair(t *testing.T) *rsa.PrivateKey {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("generate RSA key: %v", err)
	}
	return key
}

func startMockJWKS(t *testing.T, kid string, key *rsa.PrivateKey) string {
	t.Helper()
	n := base64.RawURLEncoding.EncodeToString(key.PublicKey.N.Bytes())
	e := base64.RawURLEncoding.EncodeToString(big64(key.PublicKey.E))

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"keys": []map[string]string{
				{"kty": "RSA", "kid": kid, "use": "sig", "alg": "RS256", "n": n, "e": e},
			},
		})
	}))
	t.Cleanup(server.Close)
	return server.URL
}

func big64(e int) []byte {
	// Standard RSA public exponent (65537) fits in 3 bytes — matches
	// how Keycloak's own JWKS encodes "e" ("AQAB").
	b := []byte{byte(e >> 16), byte(e >> 8), byte(e)}
	for len(b) > 1 && b[0] == 0 {
		b = b[1:]
	}
	return b
}

func signToken(t *testing.T, key *rsa.PrivateKey, kid string, expOffset time.Duration, claims *Claims) string {
	t.Helper()
	if claims.ExpiresAt == nil {
		claims.ExpiresAt = jwt.NewNumericDate(time.Now().Add(expOffset))
	}
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	token.Header["kid"] = kid
	signed, err := token.SignedString(key)
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}
	return signed
}

// Real Keycloak access tokens always carry aud: "account" — included by
// default here so tests exercise the same shape a real token has. A
// sibling Rust implementation of this exact fix (asset-service/
// rustledger) shipped a real bug where the JWT library's default
// validation silently rejected every real token over this exact field,
// caught only because a live test happened to include it — baking it
// into every test claims value here so that class of bug can't hide.
func baseClaims(roles []string) *Claims {
	return &Claims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:  "user-1",
			Audience: jwt.ClaimStrings{"account"},
		},
		RealmAccess: &realmAccess{Roles: roles},
	}
}

func TestClaimsFromHeader_ValidTokenVerifies(t *testing.T) {
	key := generateKeyPair(t)
	kid := "test-key-1"
	jwksURLOverride = startMockJWKS(t, kid, key)
	t.Cleanup(func() { jwksURLOverride = ""; resetCache() })

	token := signToken(t, key, kid, 5*time.Minute, baseClaims([]string{"platform:project-manager"}))
	claims := ClaimsFromHeader("Bearer " + token)

	if claims == nil {
		t.Fatal("expected claims, got nil")
	}
	if !claims.HasRole("platform:project-manager") {
		t.Error("expected platform:project-manager role")
	}
	if claims.Subject != "user-1" {
		t.Errorf("expected sub=user-1, got %q", claims.Subject)
	}
}

func TestClaimsFromHeader_MissingHeaderReturnsNil(t *testing.T) {
	if claims := ClaimsFromHeader(""); claims != nil {
		t.Errorf("expected nil, got %+v", claims)
	}
}

func TestClaimsFromHeader_NonBearerSchemeReturnsNil(t *testing.T) {
	if claims := ClaimsFromHeader("Basic dXNlcjpwYXNz"); claims != nil {
		t.Errorf("expected nil, got %+v", claims)
	}
}

func TestClaimsFromHeader_ForgedTokenIsRejected(t *testing.T) {
	key := generateKeyPair(t)
	otherKey := generateKeyPair(t)
	kid := "test-key-2"
	jwksURLOverride = startMockJWKS(t, kid, key)
	t.Cleanup(func() { jwksURLOverride = ""; resetCache() })

	// Signed with a different key than the one the mock JWKS serves
	// under this kid — the actual forged-token scenario this fix closes.
	forged := signToken(t, otherKey, kid, 5*time.Minute, baseClaims([]string{"platform:admin"}))
	if claims := ClaimsFromHeader("Bearer " + forged); claims != nil {
		t.Errorf("expected forged token to be rejected, got %+v", claims)
	}
}

func TestClaimsFromHeader_ExpiredTokenIsRejected(t *testing.T) {
	key := generateKeyPair(t)
	kid := "test-key-3"
	jwksURLOverride = startMockJWKS(t, kid, key)
	t.Cleanup(func() { jwksURLOverride = ""; resetCache() })

	// Well outside any reasonable clock-skew leeway.
	expired := signToken(t, key, kid, -1*time.Hour, baseClaims([]string{"platform:admin"}))
	if claims := ClaimsFromHeader("Bearer " + expired); claims != nil {
		t.Errorf("expected expired token to be rejected, got %+v", claims)
	}
}

func TestClaimsFromHeader_UnrecognizedKidIsRejected(t *testing.T) {
	key := generateKeyPair(t)
	jwksURLOverride = startMockJWKS(t, "the-real-kid", key)
	t.Cleanup(func() { jwksURLOverride = ""; resetCache() })

	token := signToken(t, key, "not-the-real-kid", 5*time.Minute, baseClaims([]string{"platform:admin"}))
	if claims := ClaimsFromHeader("Bearer " + token); claims != nil {
		t.Errorf("expected unrecognized-kid token to be rejected, got %+v", claims)
	}
}

func TestClaimsFromHeader_NoRealmAccessHasNoRoles(t *testing.T) {
	key := generateKeyPair(t)
	kid := "test-key-4"
	jwksURLOverride = startMockJWKS(t, kid, key)
	t.Cleanup(func() { jwksURLOverride = ""; resetCache() })

	claims := &Claims{RegisteredClaims: jwt.RegisteredClaims{Subject: "user-1", Audience: jwt.ClaimStrings{"account"}}}
	token := signToken(t, key, kid, 5*time.Minute, claims)
	got := ClaimsFromHeader("Bearer " + token)

	if got == nil {
		t.Fatal("expected claims, got nil")
	}
	if got.HasRole("platform:admin") {
		t.Error("expected no roles")
	}
}

// resetCache clears the package-level JWKS cache between tests so one
// test's mock server URL/keys can't leak into another's assertions.
func resetCache() {
	cacheMu.Lock()
	cachedKeys = nil
	cacheMu.Unlock()
}
