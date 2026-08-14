import React from 'react';
import { useTranslation } from 'react-i18next';
import { STATUS_STYLE } from './TaskStatusBadge';

const STATUS_KEYS = Object.keys(STATUS_STYLE);

// Client-side status filter chips, shared by every plain task list
// (GofeelerListPanel, AccountsProjectsView/ProjectHubPage's
// ProjectDetail) — those all fetch their full task set in one shot
// already, so filtering narrows the already-loaded array rather than
// re-querying. Not StatusFilterBar (that one's hardcoded to the
// Dashboard's service online/progress keys, not task status).
const TaskStatusFilter = ({ active, onChange }) => {
  const { t } = useTranslation('common');
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {['all', ...STATUS_KEYS].map((key) => {
        const isActive = active === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            style={{
              padding: '4px 10px',
              fontSize: 11,
              borderRadius: 'var(--mv-radius)',
              border: isActive ? '1.5px solid var(--mv-color-primary)' : '0.5px solid var(--mv-border)',
              background: isActive ? 'var(--mv-bg-elevated)' : 'transparent',
              color: isActive ? 'var(--mv-text)' : 'var(--mv-text-muted)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {t(`taskStatusFilter.${key}`)}
          </button>
        );
      })}
    </div>
  );
};

export default TaskStatusFilter;
