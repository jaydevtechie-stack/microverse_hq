// src/pages/Dashboard.js
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getKeycloak } from '../services/keycloak';
import { SERVICES } from '../data/services';
import ServiceCard from '../components/ServiceCard';
import StatusFilterBar from '../components/StatusFilterBar';
import BuildTracker from '../components/BuildTracker';

const Dashboard = () => {
  const { t } = useTranslation('dashboard');
  const keycloak = getKeycloak();
  const username = keycloak?.tokenParsed?.preferred_username;
  const [filter, setFilter] = useState('all');

  const visibleServices = useMemo(() => {
    if (filter === 'all') return SERVICES;
    if (filter === 'online') return SERVICES.filter((s) => s.status === 'online');
    // "progress" — anything not online and not planned
    return SERVICES.filter((s) => s.status !== 'online' && s.status !== 'planned');
  }, [filter]);

  const onlineCount = SERVICES.filter((s) => s.status === 'online').length;

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

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
            gap: 12,
            paddingBottom: 18,
          }}
        >
          {visibleServices.map((service) => (
            <ServiceCard key={service.key} service={service} keycloak={keycloak} />
          ))}
        </div>
      </div>

      <div style={{ padding: '14px 18px', borderTop: '0.5px solid var(--mv-border)' }}>
        <BuildTracker onlineCount={onlineCount} totalCount={SERVICES.length} />
      </div>
    </div>
  );
};

export default Dashboard;
