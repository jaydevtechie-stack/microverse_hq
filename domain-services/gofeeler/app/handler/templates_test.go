package handler

import (
	"encoding/base64"
	"encoding/json"
	"testing"
)

func makeJWT(t *testing.T, claims map[string]any) string {
	t.Helper()
	payload, err := json.Marshal(claims)
	if err != nil {
		t.Fatalf("marshal claims: %v", err)
	}
	header := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"none"}`))
	body := base64.RawURLEncoding.EncodeToString(payload)
	return header + "." + body + ".signature"
}

func TestSubFromAuthHeader(t *testing.T) {
	tests := []struct {
		name       string
		authHeader string
		wantSub    *string
	}{
		{
			name:       "valid bearer token with sub",
			authHeader: "Bearer " + makeJWT(t, map[string]any{"sub": "user-123"}),
			wantSub:    strPtr("user-123"),
		},
		{
			name:       "missing bearer prefix",
			authHeader: makeJWT(t, map[string]any{"sub": "user-123"}),
			wantSub:    nil,
		},
		{
			name:       "empty header",
			authHeader: "",
			wantSub:    nil,
		},
		{
			name:       "malformed token, too few segments",
			authHeader: "Bearer abc.def",
			wantSub:    nil,
		},
		{
			name:       "no sub claim",
			authHeader: "Bearer " + makeJWT(t, map[string]any{"email": "a@b.com"}),
			wantSub:    nil,
		},
		{
			name:       "invalid base64 payload",
			authHeader: "Bearer abc.not-valid-base64!!!.sig",
			wantSub:    nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := subFromAuthHeader(tt.authHeader)
			if (got == nil) != (tt.wantSub == nil) {
				t.Fatalf("got %v, want %v", got, tt.wantSub)
			}
			if got != nil && *got != *tt.wantSub {
				t.Errorf("got %q, want %q", *got, *tt.wantSub)
			}
		})
	}
}

func strPtr(s string) *string { return &s }
