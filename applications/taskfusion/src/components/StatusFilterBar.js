import React from 'react';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'online', label: 'Online' },
  { key: 'progress', label: 'In progress' },
];

const StatusFilterBar = ({ active, onChange }) => {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {FILTERS.map(({ key, label }) => {
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
              border: '0.5px solid var(--mv-border)',
              background: isActive ? 'var(--mv-bg-elevated)' : 'transparent',
              color: isActive ? 'var(--mv-text)' : 'var(--mv-text-muted)',
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
};

export default StatusFilterBar;
