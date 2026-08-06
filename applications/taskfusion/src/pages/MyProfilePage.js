import React, { useEffect, useState } from 'react';
import { IconUserEdit, IconLock } from '@tabler/icons-react';
import { getKeycloak, authHeaders, keycloakAccountUrl } from '../services/keycloak';

const initials = (name) =>
  (name || '?')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase();

// Accessible to *any* logged-in user regardless of role or active
// status — the one universally accessible page, and the only thing an
// inactive user's scrim still lets through besides Keycloak's own
// account console (see ARCHITECTURE.md's Roles and permissions).
// Mockup: my_profile_page_with_avatar_dropdown.html.
const MyProfilePage = () => {
  const keycloak = getKeycloak();
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/users/me', { headers: authHeaders() })
      .then((res) => {
        if (!res.ok) throw new Error(`task-service returned ${res.status}`);
        return res.json();
      })
      .then(setUser)
      .catch((err) => setError(err.message));
  }, []);

  // Falls back to the JWT's own claims while /api/users/me loads (or
  // if it errors) — the token already has name/email, just not
  // `roles` in the flattened form task-service stores.
  const name = user?.name || keycloak?.tokenParsed?.name || keycloak?.tokenParsed?.preferred_username;
  const email = user?.email || keycloak?.tokenParsed?.email;
  const roles = user?.roles || keycloak?.tokenParsed?.realm_access?.roles || [];

  return (
    <div
      style={{
        display: 'flex',
        background: 'var(--mv-bg-elevated)',
        border: '0.5px solid var(--mv-border)',
        borderRadius: 'var(--mv-radius-lg)',
        margin: 'var(--mv-space-3)',
        minHeight: 360,
        overflow: 'hidden',
      }}
    >
      <div style={{ width: 220, flexShrink: 0, borderRight: '0.5px solid var(--mv-border)', padding: '24px 18px' }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'var(--mv-color-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--mv-color-primary-contrast)',
            fontSize: 18,
            fontWeight: 500,
            marginBottom: 12,
          }}
        >
          {initials(name)}
        </div>
        <p style={{ color: 'var(--mv-text)', fontSize: 15, fontWeight: 500, margin: '0 0 2px' }}>{name}</p>
        <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: '0 0 16px' }}>{email}</p>

        {error && (
          <p style={{ color: 'var(--mv-color-danger)', fontSize: 11, margin: '0 0 12px' }}>
            Couldn't load full profile: {error}
          </p>
        )}

        <p style={{ color: 'var(--mv-badge-bg)', fontSize: 11, margin: '0 0 6px' }}>Roles</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 24 }}>
          {roles.map((role) => (
            <span
              key={role}
              style={{
                padding: '3px 8px',
                fontSize: 10,
                borderRadius: 10,
                background: 'color-mix(in srgb, var(--mv-color-primary) 15%, transparent)',
                color: 'var(--mv-color-primary)',
              }}
            >
              {role}
            </span>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <a
            href={keycloakAccountUrl()}
            style={{
              padding: '9px 0',
              background: 'var(--mv-bg)',
              border: '0.5px solid var(--mv-border)',
              color: 'var(--mv-text)',
              fontSize: 12,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              textDecoration: 'none',
            }}
          >
            <IconUserEdit size={14} /> Edit profile
          </a>
          <a
            href={keycloakAccountUrl()}
            style={{
              padding: '9px 0',
              background: 'var(--mv-bg)',
              border: '0.5px solid var(--mv-border)',
              color: 'var(--mv-text)',
              fontSize: 12,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              textDecoration: 'none',
            }}
          >
            <IconLock size={14} /> Change password
          </a>
        </div>
        <p style={{ color: 'var(--mv-badge-bg)', fontSize: 10, margin: '10px 0 0', lineHeight: 1.4 }}>
          Both open Keycloak's account console — not handled in-app.
        </p>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--mv-badge-bg)', fontSize: 12 }}>Nothing else here yet</p>
      </div>
    </div>
  );
};

export default MyProfilePage;
