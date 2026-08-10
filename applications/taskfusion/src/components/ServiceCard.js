import React from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { hostUrlForSubdomain } from '../services/keycloak';

const ServiceCard = ({ service }) => {
  const { t } = useTranslation('dashboard');
  const { theme } = useTheme();
  const { name, tech, status, illustration: Illustration, subdomain } = service;
  const { fg, bg } = service[theme];
  const isOnline = status === 'online';

  // Every service subdomain now has something real to show regardless
  // of role — either the built app (gofeeler, if the visitor has
  // service:gofeeler) or the public ServiceLandingPage info portal
  // (everyone else). So the card links whenever a subdomain exists;
  // access is no longer a gate on the link itself, just on what the
  // destination page shows once you're there (see ServiceLandingPage's
  // own hasAccess/contact-account-manager logic).
  const href = subdomain ? hostUrlForSubdomain(subdomain) : undefined;

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
        className="mv-service-card-icon"
        style={{
          background: bg,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Illustration color={fg} />
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
          {t(`status.${status}`)}
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
