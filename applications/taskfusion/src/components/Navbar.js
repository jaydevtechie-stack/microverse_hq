// src/components/Navbar.js
import React, { useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { IconBell, IconSun, IconMoon, IconMenu2, IconX, IconUser, IconLogout } from '@tabler/icons-react';
import { logout, landingUrl, hostUrlForSubdomain, isOnMicrosite } from '../services/keycloak';
import { useTheme } from '../context/ThemeContext';
import { avatarColorsForKeycloak } from '../utils/avatarColors';
import useIsMobile from '../hooks/useIsMobile';
import useClickOutside from '../hooks/useClickOutside';

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

// Dashboard/Customer/Analyst all live on the platform host. From a
// microsite (e.g. gofeeler.microverse.local) these need a real
// cross-origin hop, not a client-side route — from the platform host
// itself, a router Link keeps navigation fast.
const PlatformNavLink = ({ to, active, children }) => {
  if (isOnMicrosite()) {
    return (
      <a href={`${hostUrlForSubdomain(null)}${to}`} style={navLinkStyle(false)}>
        {children}
      </a>
    );
  }
  return (
    <Link to={to} style={navLinkStyle(active)}>
      {children}
    </Link>
  );
};

const Navbar = ({ keycloak }) => {
  const { theme, toggleTheme } = useTheme();
  const { pathname } = useLocation();
  const isDashboard = pathname === '/dashboard';
  const avatarColors = avatarColorsForKeycloak(keycloak);
  const isMobile = useIsMobile();
  const [menuOpen, setMenuOpen] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const avatarMenuRef = useRef(null);
  useClickOutside(avatarMenuRef, () => setAvatarMenuOpen(false));

  // 4.3 supersedes 4.0.2's nav for platform:project-manager entirely —
  // PM's own section below (Projects/Orders/Delivery team) replaces
  // these, so PM no longer also picks up platform:customer's/
  // platform:analyst's links the way it did pre-4.3 (that produced a
  // real collision: two differently-scoped "Analysts" links with the
  // same label, one being Delivery team's roster).
  const isCustomer = keycloak.hasRealmRole('platform:customer');
  const isAnalyst = keycloak.hasRealmRole('platform:analyst');
  // Project Hub's page-level gate (see ARCHITECTURE.md's Roles and
  // permissions) — platform:project-manager plus *any* service scope,
  // not a specific one, since the page itself spans whatever services
  // this PM manages.
  const hasAnyServiceScope = (keycloak.tokenParsed?.realm_access?.roles || []).some((role) =>
    role.startsWith('service:')
  );
  const isPMWithServiceScope = keycloak.hasRealmRole('platform:project-manager') && hasAnyServiceScope;
  const isAdmin = keycloak.hasRealmRole('platform:admin');
  // 4.3 — new role, not yet provisioned in Keycloak. Nav item is
  // future-ready: it'll just start rendering once someone holds it.
  const isAccountManager = keycloak.hasRealmRole('platform:account-manager');

  const navLinks = (
    <>
      <PlatformNavLink to="/dashboard" active={isDashboard}>
        Dashboard
      </PlatformNavLink>

      {isCustomer && (
        <PlatformNavLink to="/customer" active={pathname === '/customer'}>
          Customers
        </PlatformNavLink>
      )}

      {isAnalyst && (
        <PlatformNavLink to="/analyst" active={pathname === '/analyst'}>
          Analysts
        </PlatformNavLink>
      )}

      {/* 4.3 — supersedes the single "Projects" link: Projects/Orders
          (PM-scoped, moved from Admin)/Delivery team. Delivery team's
          Analysts/Reviewers live as an in-page Subnav on
          DeliveryTeamPage.js (see platform_projects_hub_and_admin.html's
          #subnav pattern), not a navbar dropdown. See
          docs/architecture/1.0/nav-config.json. */}
      {isPMWithServiceScope && (
        <>
          <PlatformNavLink to="/pm/projects" active={pathname === '/pm/projects'}>
            Projects
          </PlatformNavLink>
          <PlatformNavLink to="/pm/orders" active={pathname === '/pm/orders'}>
            Orders
          </PlatformNavLink>
          <PlatformNavLink to="/pm/delivery-team/analysts" active={pathname.startsWith('/pm/delivery-team')}>
            Delivery team
          </PlatformNavLink>
        </>
      )}

      {/* 4.3 — new platform:account-manager role: Customers/Billing,
          moved from Admin, account-manager-scoped. */}
      {isAccountManager && (
        <>
          <PlatformNavLink to="/am/customers" active={pathname === '/am/customers'}>
            Customers
          </PlatformNavLink>
          <PlatformNavLink to="/am/billing" active={pathname === '/am/billing'}>
            Billing
          </PlatformNavLink>
        </>
      )}

      {/* 4.3 — Admin stays one top-level item, no longer holding global
          Orders or Billing; Users/Services/Settings/Audit-log live as
          an in-page Subnav on AdminPage.js, not a navbar dropdown (see
          platform_projects_hub_and_admin.html's #subnav pattern). */}
      {isAdmin && (
        <PlatformNavLink to="/admin/users" active={pathname.startsWith('/admin')}>
          Admin
        </PlatformNavLink>
      )}
    </>
  );

  const themeToggleButton = (
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
  );

  const avatarChip = (
    <div
      title={keycloak.tokenParsed.preferred_username}
      style={{
        width: 26,
        height: 26,
        borderRadius: '50%',
        background: avatarColors.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: avatarColors.fg,
        fontSize: 11,
        fontWeight: 500,
        flexShrink: 0,
      }}
    >
      {initialsFor(keycloak)}
    </div>
  );

  const logoutButton = (
    <button
      type="button"
      onClick={logout}
      style={{
        background: 'none',
        border: 'none',
        color: 'var(--mv-text-muted)',
        fontSize: 13,
        cursor: 'pointer',
        padding: 0,
      }}
    >
      Logout
    </button>
  );

  const profileHref = isOnMicrosite() ? `${hostUrlForSubdomain(null)}/profile` : '/profile';
  const displayName = keycloak.tokenParsed?.name || keycloak.tokenParsed?.preferred_username;

  // The standard, expected spot for both My Profile and Log out — see
  // ARCHITECTURE.md's Dashboard/UI notes. Not a separate nav item.
  const avatarMenu = (
    <div ref={avatarMenuRef} style={{ position: 'relative' }}>
      <div
        onClick={() => setAvatarMenuOpen((open) => !open)}
        style={{ cursor: 'pointer' }}
        role="button"
        tabIndex={0}
        aria-label="Account menu"
      >
        {avatarChip}
      </div>

      {avatarMenuOpen && (
        <div
          style={{
            position: 'absolute',
            top: 36,
            right: 0,
            background: 'var(--mv-bg)',
            border: '0.5px solid var(--mv-border)',
            borderRadius: 10,
            padding: 6,
            minWidth: 170,
            zIndex: 10,
          }}
        >
          <div
            style={{
              padding: '10px 12px',
              borderBottom: '0.5px solid var(--mv-border)',
              marginBottom: 4,
            }}
          >
            <p style={{ color: 'var(--mv-text)', fontSize: 12, margin: 0 }}>{displayName}</p>
            <p style={{ color: 'var(--mv-badge-bg)', fontSize: 11, margin: '1px 0 0' }}>
              {keycloak.tokenParsed?.email}
            </p>
          </div>

          {isOnMicrosite() ? (
            <a
              href={profileHref}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 10px',
                borderRadius: 6,
                textDecoration: 'none',
              }}
            >
              <IconUser size={14} color="var(--mv-color-primary)" />
              <span style={{ color: 'var(--mv-color-primary)', fontSize: 13 }}>My Profile</span>
            </a>
          ) : (
            <Link
              to="/profile"
              onClick={() => setAvatarMenuOpen(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 10px',
                borderRadius: 6,
                textDecoration: 'none',
              }}
            >
              <IconUser size={14} color="var(--mv-color-primary)" />
              <span style={{ color: 'var(--mv-color-primary)', fontSize: 13 }}>My Profile</span>
            </Link>
          )}

          <div
            onClick={logout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 10px',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            <IconLogout size={14} color="var(--mv-color-danger)" />
            <span style={{ color: 'var(--mv-color-danger)', fontSize: 13 }}>Log out</span>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <nav
      style={{
        // Explicit stacking context so this renders above LandingPage's
        // position:fixed background image rather than behind it — plain
        // static-position siblings otherwise lose to a fixed element.
        position: 'relative',
        zIndex: 1,
        background: 'var(--mv-bg-elevated)',
        border: '0.5px solid var(--mv-border)',
        borderRadius: 'var(--mv-radius-lg)',
        padding: '14px 18px',
        margin: 'var(--mv-space-3)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Real anchor, not a router Link — on a microsite this is a
            cross-origin hop back to the platform host */}
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

        {isMobile ? (
          keycloak.authenticated && (
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              style={{
                background: 'none',
                border: 'none',
                display: 'flex',
                cursor: 'pointer',
                color: 'var(--mv-text-muted)',
              }}
            >
              {menuOpen ? <IconX size={20} /> : <IconMenu2 size={20} />}
            </button>
          )
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginLeft: 20, flex: 1 }}>
            {keycloak.authenticated && navLinks}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginLeft: 'auto' }}>
              {themeToggleButton}
              <IconBell size={16} color="var(--mv-text-muted)" aria-hidden="true" />
              {avatarMenu}
            </div>
          </div>
        )}
      </div>

      {isMobile && menuOpen && keycloak.authenticated && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            marginTop: 16,
            paddingTop: 14,
            borderTop: '0.5px solid var(--mv-border)',
          }}
        >
          {navLinks}
          {isOnMicrosite() ? (
            <a href={profileHref} style={navLinkStyle(false)}>
              My Profile
            </a>
          ) : (
            <Link to="/profile" style={navLinkStyle(pathname === '/profile')}>
              My Profile
            </Link>
          )}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              marginTop: 4,
              paddingTop: 14,
              borderTop: '0.5px solid var(--mv-border)',
            }}
          >
            {themeToggleButton}
            <IconBell size={16} color="var(--mv-text-muted)" aria-hidden="true" />
            {avatarChip}
            <span style={{ color: 'var(--mv-text-muted)', fontSize: 13 }}>
              {keycloak.tokenParsed.preferred_username}
            </span>
            <div style={{ marginLeft: 'auto' }}>{logoutButton}</div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
