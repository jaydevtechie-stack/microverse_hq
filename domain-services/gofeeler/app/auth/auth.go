// Package auth verifies JWT signatures against Keycloak's JWKS before
// trusting any claim in a request's Authorization header, closing the
// gap docs/security.md flagged as the top-priority item ("claim
// extraction is currently unverified"). Same hand-rolled JWKS cache
// shape as asset-service's/rustledger's auth.rs (no jwks-rsa equivalent
// in Go's ecosystem either): in-memory, keyed by kid, TTL-based
// refresh, and a cache-miss-triggers-one-refetch path for real key
// rotation.
package auth

import (
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func keycloakInternalURL() string {
	if v := os.Getenv("KEYCLOAK_INTERNAL_URL"); v != "" {
		return v
	}
	return "http://microverse-keycloak:8080"
}

func keycloakRealm() string {
	if v := os.Getenv("KEYCLOAK_REALM"); v != "" {
		return v
	}
	return "microverse"
}

// jwksURLOverride lets tests point this module at a local mock JWKS
// server instead of real Keycloak. Never set outside tests.
var jwksURLOverride string

func jwksURL() string {
	if jwksURLOverride != "" {
		return jwksURLOverride
	}
	return fmt.Sprintf("%s/realms/%s/protocol/openid-connect/certs", keycloakInternalURL(), keycloakRealm())
}

type jwk struct {
	Kid string `json:"kid"`
	N   string `json:"n"`
	E   string `json:"e"`
}

type jwksDocument struct {
	Keys []jwk `json:"keys"`
}

var (
	cacheMu        sync.RWMutex
	cachedKeys     map[string]*rsa.PublicKey
	cacheFetchedAt time.Time
)

const cacheTTL = 10 * time.Minute

func fetchJWKS() (map[string]*rsa.PublicKey, error) {
	resp, err := http.Get(jwksURL())
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var doc jwksDocument
	if err := json.NewDecoder(resp.Body).Decode(&doc); err != nil {
		return nil, err
	}

	keys := make(map[string]*rsa.PublicKey, len(doc.Keys))
	for _, k := range doc.Keys {
		nBytes, err := base64.RawURLEncoding.DecodeString(k.N)
		if err != nil {
			continue
		}
		eBytes, err := base64.RawURLEncoding.DecodeString(k.E)
		if err != nil {
			continue
		}
		e := new(big.Int).SetBytes(eBytes)
		keys[k.Kid] = &rsa.PublicKey{N: new(big.Int).SetBytes(nBytes), E: int(e.Int64())}
	}
	return keys, nil
}

// signingKeyFor checks the cache first; a miss (unrecognized kid, or a
// stale cache past cacheTTL) triggers exactly one refetch before giving
// up — handles Keycloak rotating its signing key without a deploy,
// while still failing closed on a genuinely bad kid.
func signingKeyFor(kid string) (*rsa.PublicKey, error) {
	cacheMu.RLock()
	if cachedKeys != nil && time.Since(cacheFetchedAt) < cacheTTL {
		if key, ok := cachedKeys[kid]; ok {
			cacheMu.RUnlock()
			return key, nil
		}
	}
	cacheMu.RUnlock()

	keys, err := fetchJWKS()
	if err != nil {
		return nil, err
	}
	key, ok := keys[kid]
	if !ok {
		return nil, fmt.Errorf("unknown kid: %s", kid)
	}

	cacheMu.Lock()
	cachedKeys = keys
	cacheFetchedAt = time.Now()
	cacheMu.Unlock()

	return key, nil
}

type realmAccess struct {
	Roles []string `json:"roles"`
}

// Claims mirrors every other service's shape (realm_access.roles, sub) —
// this codebase's shared-nothing per-service copy pattern, not a shared
// package.
type Claims struct {
	jwt.RegisteredClaims
	RealmAccess *realmAccess `json:"realm_access"`
}

func (c *Claims) HasRole(role string) bool {
	if c == nil || c.RealmAccess == nil {
		return false
	}
	for _, r := range c.RealmAccess.Roles {
		if r == role {
			return true
		}
	}
	return false
}

// ClaimsFromHeader verifies the token's signature against Keycloak's
// JWKS before returning anything from it. Returns nil for a missing or
// malformed header (anonymous access, unchanged from before) or for a
// token that IS present but fails verification — bad signature,
// expired, unrecognized kid after the refetch above, wrong algorithm.
// Every call site already treats a nil Claims as "no identified
// caller" (best-effort author attribution here, not an access-control
// gate elsewhere in this service) — no fallback to unverified decoding.
func ClaimsFromHeader(authHeader string) *Claims {
	const prefix = "Bearer "
	if !strings.HasPrefix(authHeader, prefix) {
		return nil
	}
	tokenString := strings.TrimPrefix(authHeader, prefix)

	claims := &Claims{}
	_, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		kid, ok := token.Header["kid"].(string)
		if !ok {
			return nil, fmt.Errorf("token has no kid")
		}
		return signingKeyFor(kid)
	}, jwt.WithValidMethods([]string{"RS256"}))
	if err != nil {
		return nil
	}
	return claims
}
