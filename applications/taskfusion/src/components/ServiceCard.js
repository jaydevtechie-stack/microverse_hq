import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { hostUrlForSubdomain } from '../services/keycloak';

const ServiceCard = ({ service, keycloak }) => {
  const { theme } = useTheme();
  const { name, tech, status, icon: Icon, subdomain, requiredRole } = service;
  const { fg, bg } = service[theme];
  const isOnline = status === 'online';

  // The card always shows — description/status stays visible even
  // without the role. Only the link itself is gated: no subdomain, no
  // role check needed, no role, no link, no click.
  const hasAccess = !requiredRole || keycloak?.hasRealmRole(requiredRole);
  const href = subdomain && hasAccess ? hostUrlForSubdomain(subdomain) : undefined;

  return (
    <a
      href={href}
      style={{
        background: 'var(--mv-bg-elevated)',
        border: '0.5px solid var(--mv-border)',
        borderRadius: 'var(--mv-radius-lg)',
        overflow: 'hidden',
        display: 'block',
        textDecoration: 'none',
        cursor: href ? 'pointer' : 'default',
        pointerEvents: href ? 'auto' : 'none',
      }}
    >
      <div
        style={{
          height: 76,
          background: bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        <Icon size={26} color={fg} aria-hidden="true" />
        <span
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            background: isOnline ? 'var(--mv-color-primary)' : 'var(--mv-badge-bg)',
            color: isOnline ? 'var(--mv-color-primary-contrast)' : 'var(--mv-badge-text)',
            fontSize: 10,
            padding: '2px 8px',
            borderRadius: 10,
          }}
        >
          {status}
        </span>
      </div>
      <div style={{ padding: '10px 12px' }}>
        <p style={{ color: 'var(--mv-text)', fontSize: 13, fontWeight: 500, margin: '0 0 3px' }}>
          {name}
        </p>
        <span style={{ color: fg, fontSize: 11 }}>{tech}</span>
      </div>
    </a>
  );
};

export default ServiceCard;
