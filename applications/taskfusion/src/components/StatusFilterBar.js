import React from 'react';
import { useTranslation } from 'react-i18next';

const FILTER_KEYS = ['all', 'online', 'progress'];

const StatusFilterBar = ({ active, onChange }) => {
  const { t } = useTranslation('dashboard');
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {FILTER_KEYS.map((key) => {
        const isActive = active === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            style={{
              padding: '5px 12px',
              fontSize: 12,
              borderRadius: 'var(--mv-radius)',
              border: isActive ? '1.5px solid var(--mv-color-primary)' : '0.5px solid var(--mv-border)',
              background: isActive ? 'var(--mv-bg-elevated)' : 'transparent',
              color: isActive ? 'var(--mv-text)' : 'var(--mv-text-muted)',
              cursor: 'pointer',
            }}
          >
            {t(`filters.${key}`)}
          </button>
        );
      })}
    </div>
  );
};

export default StatusFilterBar;
