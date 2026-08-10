// src/pages/Dashboard.js
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getKeycloak } from '../services/keycloak';
import useServices from '../hooks/useServices';
import ServiceCard from '../components/ServiceCard';
import StatusFilterBar from '../components/StatusFilterBar';
import BuildTracker from '../components/BuildTracker';
import usePageMeta from '../hooks/usePageMeta';

const Dashboard = () => {
  const { t } = useTranslation('dashboard');
  usePageMeta({ title: 'Microverse - Dashboard' });
  const keycloak = getKeycloak();
  // Same fallback as Navbar's avatar-menu display name — full name when
  // Keycloak has one, login handle otherwise.
  const username = keycloak?.tokenParsed?.name || keycloak?.tokenParsed?.preferred_username;
  const [filter, setFilter] = useState('all');
  const { services, loading, error } = useServices();

  const visibleServices = useMemo(() => {
    if (filter === 'all') return services;
    if (filter === 'online') return services.filter((s) => s.status === 'online');
    // "progress" — anything not online and not planned
    return services.filter((s) => s.status !== 'online' && s.status !== 'planned');
  }, [filter, services]);

  const onlineCount = services.filter((s) => s.status === 'online').length;

  return (
    <div
      style={{
        background: 'var(--mv-bg-elevated)',
        border: '0.5px solid var(--mv-border)',
        borderRadius: 'var(--mv-radius-lg)',
        margin: 'var(--mv-space-3)',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '16px 18px 0' }}>
        {username && (
          <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: '0 0 8px' }}>
            {t('welcomeBack', { username })}
          </p>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 14,
          }}
        >
          <span style={{ color: 'var(--mv-text)', fontSize: 13, fontWeight: 500 }}>
            {t('allServices')}
          </span>
          <StatusFilterBar active={filter} onChange={setFilter} />
        </div>

        {loading && <p style={{ color: 'var(--mv-text-muted)', fontSize: 12 }}>{t('loading')}</p>}
        {error && <p style={{ color: 'var(--mv-color-danger)', fontSize: 12 }}>{t('loadError', { error })}</p>}

        {!loading && !error && (
          <div className="mv-service-grid">
            {visibleServices.map((service) => (
              <ServiceCard key={service.key} service={service} />
            ))}
          </div>
        )}
      </div>

      <div style={{ padding: '14px 18px', borderTop: '0.5px solid var(--mv-border)' }}>
        <BuildTracker onlineCount={onlineCount} totalCount={services.length} />
      </div>
    </div>
  );
};

export default Dashboard;
