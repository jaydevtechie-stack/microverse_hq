// src/components/Navbar.js
import React from 'react';
import { Link } from 'react-router-dom';
import { IconBell, IconSun, IconMoon } from '@tabler/icons-react';
import { logout } from '../services/keycloak';
import { useTheme } from '../context/ThemeContext';

function initialsFor(keycloak) {
  const claims = keycloak.tokenParsed || {};
  if (claims.given_name && claims.family_name) {
    return `${claims.given_name[0]}${claims.family_name[0]}`.toUpperCase();
  }
  const username = claims.preferred_username || '';
  return username.slice(0, 2).toUpperCase() || '?';
}

const Navbar = ({ keycloak }) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <nav
      style={{
        background: 'var(--mv-bg-elevated)',
        border: '0.5px solid var(--mv-border)',
        borderRadius: 'var(--mv-radius-lg)',
        padding: '14px 18px',
        margin: 'var(--mv-space-3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <Link
          to="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            color: 'var(--mv-text)',
            textDecoration: 'none',
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--mv-color-primary)',
              display: 'inline-block',
            }}
          />
          <span style={{ fontWeight: 500, fontSize: 14 }}>Microverse</span>
        </Link>

        {keycloak.authenticated && (
          <>
            <Link
              to="/dashboard"
              style={{
                color: 'var(--mv-color-primary)',
                fontSize: 13,
                borderBottom: '2px solid var(--mv-color-primary)',
                paddingBottom: 2,
                textDecoration: 'none',
              }}
            >
              Dashboard
            </Link>
            {/* Orders / Djaboard: business-services/order-service and
                domain-services/djaboard don't have their own pages yet —
                placeholders until those exist, not real links */}
            <span style={{ color: 'var(--mv-text-muted)', fontSize: 13 }}>Orders</span>
            <span style={{ color: 'var(--mv-text-muted)', fontSize: 13 }}>Djaboard</span>
          </>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            display: 'flex',
            cursor: 'pointer',
            color: 'var(--mv-text-muted)',
          }}
        >
          {theme === 'dark' ? <IconSun size={16} /> : <IconMoon size={16} />}
        </button>

        {keycloak.authenticated ? (
          <>
            <IconBell size={16} color="var(--mv-text-muted)" aria-hidden="true" />
            <div
              title={keycloak.tokenParsed.preferred_username}
              style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: 'var(--mv-avatar-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--mv-avatar-text)',
                fontSize: 11,
                fontWeight: 500,
              }}
            >
              {initialsFor(keycloak)}
            </div>
            <button
              type="button"
              onClick={logout}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--mv-text-muted)',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Logout
            </button>
          </>
        ) : (
          <Link to="/login" style={{ color: 'var(--mv-color-primary)', fontSize: 13 }}>
            Login
          </Link>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
