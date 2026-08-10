import React from 'react';
import { useTranslation } from 'react-i18next';

const BuildTracker = ({ onlineCount, totalCount }) => {
  const { t } = useTranslation('dashboard');
  const label = t('buildTracker.servicesOnline', { onlineCount, totalCount });
  const onlineFraction = onlineCount / totalCount;

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <span style={{ color: 'var(--mv-text-muted)', fontSize: 12 }}>{label}</span>
        <span style={{ color: 'var(--mv-text-muted)', fontSize: 11, opacity: 0.7 }}>
          {t('buildTracker.label')}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 2, height: 5, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ flex: onlineFraction, background: 'var(--mv-color-primary)' }} />
        <div style={{ flex: 1 - onlineFraction, background: 'var(--mv-border)' }} />
      </div>
    </div>
  );
};

export default BuildTracker;
