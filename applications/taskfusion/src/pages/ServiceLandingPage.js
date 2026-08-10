import React from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { getKeycloak, hostUrlForSubdomain } from '../services/keycloak';
import { STATUS_ORDER } from '../data/services';
import useServices from '../hooks/useServices';
import usePageMeta from '../hooks/usePageMeta';

// Public info portal for a service's own subdomain root (e.g.
// springpix.microverse.local) — folds in
// branding/mv-1.0/design-system/mock-ups/service_in_progress_landing.html.
// Reachable by anyone regardless of role, so customers can read what a
// service does before they have access to it — not just a "coming
// soon" stub for unbuilt services. App.js routes here for every
// SERVICE_THEME entry except gofeeler-with-access, which goes straight
// to the real app instead (GofeelerSplitView). No PrivateRoute wrapper:
// gating this behind a service:<key> role would make it unreachable
// for the exact audience it's for (people who don't have that role
// yet). Reuses the dashboard card's own line-art illustration rather
// than the mockup's separate blueprint/drone SVG, and drops the
// mockup's "Preview as" chip switcher — a design-review convenience,
// not something production needs (this page only ever renders the one
// service matching the current subdomain). The phase bar is derived
// from `status`'s position in STATUS_ORDER rather than a stored
// `phase` column, and only shown pre-launch — a progress bar toward
// launch doesn't mean anything once a service is already online.
const ServiceLandingPage = ({ serviceKey }) => {
  const { t } = useTranslation(['dashboard', 'common']);
  const { theme } = useTheme();
  const { services, loading } = useServices();
  const service = services.find((s) => s.key === serviceKey);
  const keycloak = getKeycloak();

  usePageMeta({
    title: `Microverse - ${service?.name || serviceKey}`,
    description: service?.description,
    indexable: true,
  });

  if (loading || !service) return null;

  const { name, tech, status, title, description, requiredRole, illustration: Illustration } = service;
  const { fg, bg } = service[theme];
  const isOnline = status === 'online';
  const isAuthenticated = Boolean(keycloak?.authenticated);
  const hasAccess = Boolean(isAuthenticated && requiredRole && keycloak.hasRealmRole(requiredRole));
  const phase = STATUS_ORDER.indexOf(status);
  const totalPhases = STATUS_ORDER.length - 1;

  return (
    <div
      style={{
        background: 'var(--mv-bg-elevated)',
        border: '0.5px solid var(--mv-border)',
        borderRadius: 'var(--mv-radius-lg)',
        margin: 'var(--mv-space-3)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '40px 24px',
        textAlign: 'center',
      }}
    >
      {Illustration && (
        <div
          style={{
            width: '100%',
            maxWidth: 360,
            aspectRatio: '200 / 76',
            background: bg,
            borderRadius: 'var(--mv-radius-lg)',
            marginBottom: 20,
            overflow: 'hidden',
          }}
        >
          <Illustration color={fg} />
        </div>
      )}

      <span
        style={{
          background: isOnline ? 'var(--mv-color-primary)' : 'var(--mv-badge-bg)',
          color: isOnline ? 'var(--mv-color-primary-contrast)' : 'var(--mv-badge-text)',
          fontSize: 11,
          padding: '3px 10px',
          borderRadius: 10,
          marginBottom: 12,
        }}
      >
        {t(`dashboard:status.${status}`)}
      </span>

      <p style={{ color: 'var(--mv-text)', fontSize: 20, fontWeight: 500, margin: '0 0 2px' }}>{name}</p>
      <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: '0 0 12px' }}>{tech}</p>
      {title && <p style={{ color: fg, fontSize: 13, fontWeight: 500, margin: '0 0 8px' }}>{title}</p>}
      {description && (
        <p style={{ color: 'var(--mv-text-muted)', fontSize: 13, maxWidth: 340, lineHeight: 1.6, margin: '0 0 24px' }}>
          {description}
        </p>
      )}

      {!isOnline && (
        <>
          <div style={{ width: 220, marginBottom: 6 }}>
            <div style={{ display: 'flex', gap: 2, height: 5, borderRadius: 3, overflow: 'hidden' }}>
              {STATUS_ORDER.map((s, i) => (
                <div key={s} style={{ flex: 1, background: i <= phase ? fg : 'var(--mv-border)' }} />
              ))}
            </div>
          </div>
          <span style={{ color: 'var(--mv-text-muted)', fontSize: 11, marginBottom: 24 }}>
            {t('dashboard:serviceLanding.phaseLabel', { phase, total: totalPhases })}
          </span>
        </>
      )}

      {/* Logged-in-without-the-role and anonymous are different
          audiences — an anonymous visitor has no account manager to
          contact (may not even have an account yet), so they get a
          log-in prompt instead of a referral to a relationship that,
          as far as this page knows, doesn't exist for them. */}
      {isOnline && !hasAccess && isAuthenticated && (
        <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, marginBottom: 24 }}>
          {t('dashboard:serviceLanding.contactAccountManager')}
        </p>
      )}
      {isOnline && !hasAccess && !isAuthenticated && (
        <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, marginBottom: 24 }}>
          {t('dashboard:serviceLanding.logInToCheckAccess')}
        </p>
      )}

      {/* isOnline && hasAccess isn't reachable today — App.js sends a
          gofeeler-with-access visitor straight to GofeelerSplitView
          instead of here, and gofeeler is the only online service so
          far. Kept so this doesn't silently break once a second
          service goes live before it has its own routed app. */}
      {isOnline && hasAccess && (
        <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, marginBottom: 24 }}>
          {t('dashboard:serviceLanding.youHaveAccess')}
        </p>
      )}

      <a
        href={isAuthenticated ? `${hostUrlForSubdomain(null)}/dashboard` : hostUrlForSubdomain(null)}
        style={{
          background: 'var(--mv-color-primary)',
          color: 'var(--mv-color-primary-contrast)',
          fontSize: 13,
          fontWeight: 500,
          padding: '9px 18px',
          borderRadius: 8,
          textDecoration: 'none',
        }}
      >
        {t(isAuthenticated ? 'dashboard:serviceLanding.backToDashboard' : 'dashboard:serviceLanding.backToLanding')}
      </a>
    </div>
  );
};

export default ServiceLandingPage;
