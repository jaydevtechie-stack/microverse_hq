// src/pages/LandingPage.js
import React from 'react';
import { useTranslation } from 'react-i18next';
import { login, getKeycloak } from '../services/keycloak';

// Public front door, served on microverse.local. Logged-in users can
// land here too (e.g. via the navbar logo) — the Login button just
// hides itself when there's already a session. Registration
// (customer / analyst) is deliberately left out for now, pending a
// real role-vetting flow design.
const LandingPage = () => {
  const keycloak = getKeycloak();
  const { t } = useTranslation(['landing', 'common']);

  return (
    <div
      style={{
        // Fixed + full viewport, not minHeight — so it fills exactly
        // the screen regardless of the Navbar's own height when a
        // logged-in user views this page (Navbar renders above it in
        // document flow, which used to push total height past 100vh
        // and cause a scrollbar). Taking this out of flow entirely
        // also lets the Navbar visually sit above the background
        // image instead of pushing it down.
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundImage: 'var(--mv-bg-image-url)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        padding: 'var(--mv-space-4)',
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 'var(--mv-radius-lg)',
          boxShadow: 'var(--mv-shadow)',
          padding: 'var(--mv-space-5)',
          maxWidth: 420,
          width: '100%',
          textAlign: 'center',
        }}
      >
        <h1 style={{ color: '#0b0f2e', fontSize: 28, margin: '0 0 12px' }}>
          {t('landing:title')}
        </h1>
        <p style={{ color: '#4a5a8a', fontSize: 14, lineHeight: 1.6, margin: '0 0 28px' }}>
          {t('landing:description')}
        </p>
        {!keycloak?.authenticated && (
          <button
            onClick={() => login()}
            style={{
              background: 'var(--mv-color-primary)',
              color: 'var(--mv-color-primary-contrast)',
              border: 'none',
              borderRadius: 'var(--mv-radius)',
              padding: '12px 32px',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {t('common:login')}
          </button>
        )}
      </div>
    </div>
  );
};

export default LandingPage;
