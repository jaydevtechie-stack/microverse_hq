import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { IconLock } from '@tabler/icons-react';
import { authHeaders, keycloakAccountUrl, isOnMicrosite, hostUrlForSubdomain } from '../services/keycloak';

// UI affordance only — the real boundary is server-side (task-service's
// syncUser 403s a deactivated user's requests except GET /api/users/me,
// see ARCHITECTURE.md/SCHEMA.md). This just tells them why things
// stopped working and where they can still go. Never shown over
// /profile itself — that's the one page still fully usable.
// Mockup: services_landing_with_scrim.html.
const InactiveUserScrim = ({ keycloak }) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (!keycloak?.authenticated) return;
    fetch('/api/users/me', { headers: authHeaders() })
      .then((res) => (res.ok ? res.json() : null))
      .then((user) => setActive(user ? user.active : true))
      .catch(() => setActive(true));
  }, [keycloak, pathname]);

  if (active || pathname === '/profile') return null;

  // On a microsite, /profile isn't the right on-screen page to land on
  // (see Navbar's PlatformNavLink) — a real cross-origin hop to the
  // platform host, same as everywhere else this distinction matters.
  const goToProfile = () => {
    if (isOnMicrosite()) {
      window.location.href = `${hostUrlForSubdomain(null)}/profile`;
    } else {
      navigate('/profile');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'color-mix(in srgb, var(--mv-bg) 80%, transparent)',
        backdropFilter: 'blur(1px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        zIndex: 100,
      }}
    >
      <div
        style={{
          background: 'var(--mv-bg-elevated)',
          border: '0.5px solid var(--mv-border)',
          borderRadius: 12,
          padding: 24,
          maxWidth: 340,
          textAlign: 'center',
        }}
      >
        <IconLock size={22} color="var(--mv-text-muted)" />
        <p style={{ color: 'var(--mv-text)', fontSize: 14, fontWeight: 500, margin: '12px 0 4px' }}>
          Your account is deactivated
        </p>
        <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: '0 0 18px', lineHeight: 1.5 }}>
          You can view content but can't take any action. Contact your project manager if this seems wrong.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            type="button"
            onClick={goToProfile}
            style={{
              padding: '9px 0',
              background: 'var(--mv-color-primary)',
              color: 'var(--mv-color-primary-contrast)',
              fontWeight: 500,
              fontSize: 12,
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            My Profile
          </button>
          <a
            href={keycloakAccountUrl()}
            style={{
              padding: '9px 0',
              background: 'transparent',
              border: '0.5px solid var(--mv-border)',
              color: 'var(--mv-text)',
              fontSize: 12,
              borderRadius: 8,
              textDecoration: 'none',
            }}
          >
            Manage account (Keycloak)
          </a>
        </div>
      </div>
    </div>
  );
};

export default InactiveUserScrim;
