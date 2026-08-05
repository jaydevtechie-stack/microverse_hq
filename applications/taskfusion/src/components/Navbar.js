// src/components/Navbar.js
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { IconBell, IconSun, IconMoon } from '@tabler/icons-react';
import { logout, landingUrl } from '../services/keycloak';
import { useTheme } from '../context/ThemeContext';

function initialsFor(keycloak) {
  const claims = keycloak.tokenParsed || {};
  if (claims.given_name && claims.family_name) {
    return `${claims.given_name[0]}${claims.family_name[0]}`.toUpperCase();
  }
  const username = claims.preferred_username || '';
  return username.slice(0, 2).toUpperCase() || '?';
}

const navLinkStyle = (isActive) => ({
  color: isActive ? 'var(--mv-color-primary)' : 'var(--mv-text-muted)',
  fontSize: 13,
  borderBottom: isActive ? '2px solid var(--mv-color-primary)' : '2px solid transparent',
  paddingBottom: 2,
  textDecoration: 'none',
});

const Navbar = ({ keycloak }) => {
  const { theme, toggleTheme } = useTheme();
  const { pathname } = useLocation();
  // "/" only means Dashboard on the dashboard host — on the public host
  // it's the landing page, which this navbar can now also appear on.
  const isDashboardHost = window.location.hostname.startsWith('dashboard.');
  const isDashboard = pathname === '/dashboard' || (isDashboardHost && pathname === '/');

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
        {/* Real anchor, not a router Link — the landing page only lives
            on the non-dashboard host, so this is a cross-origin hop */}
        <a
          href={landingUrl()}
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
        </a>

        {keycloak.authenticated && (
          <>
            <Link to="/dashboard" style={navLinkStyle(isDashboard)}>
              Dashboard
            </Link>

            {/* Customer/Analyst links are role-gated the same way their
                routes are in App.js — platform:project-manager sees both */}
            {(keycloak.hasRealmRole('platform:customer') ||
              keycloak.hasRealmRole('platform:project-manager')) && (
              <Link to="/customer" style={navLinkStyle(pathname === '/customer')}>
                Customers
              </Link>
            )}

            {(keycloak.hasRealmRole('platform:analyst') ||
              keycloak.hasRealmRole('platform:project-manager')) && (
              <Link to="/analyst" style={navLinkStyle(pathname === '/analyst')}>
                Analysts
              </Link>
            )}

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
