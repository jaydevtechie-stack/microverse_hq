import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { authHeaders } from '../services/keycloak';

// Analyst self-claims an unassigned order from the shared pool
// (task-service's POST /api/tasks/:id/claim — the analyst-pull
// counterpart to PmAssignPanel's PM-push assign). Shown by
// TaskDetailContent's actionPanelFor only to a pure analyst viewing an
// 'unassigned' task; a PM viewing the same task gets PmAssignPanel
// instead. On success onClaimed fires with the updated task, status
// flips to 'analyst', and this panel unmounts — same pattern
// PmAssignPanel's onAssigned relies on.
const ClaimPanel = ({ task, onClaimed }) => {
  const { t } = useTranslation('gofeeler');
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState(null);

  const claim = async () => {
    setClaiming(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${task.id}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || `task-service returned ${res.status}`);
      onClaimed?.(body);
    } catch (err) {
      setError(err.message);
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div>
      <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: '0 0 12px' }}>
        {t('panels.claim.prompt')}
      </p>
      <button
        type="button"
        onClick={claim}
        disabled={claiming}
        style={{
          padding: '8px 18px',
          background: 'var(--mv-color-primary)',
          color: 'var(--mv-color-primary-contrast)',
          fontWeight: 500,
          fontSize: 12,
          border: 'none',
          borderRadius: 8,
          cursor: claiming ? 'default' : 'pointer',
          opacity: claiming ? 0.6 : 1,
        }}
      >
        {claiming ? t('panels.claim.claiming') : t('panels.claim.claim')}
      </button>
      {error && (
        <p style={{ color: 'var(--mv-color-danger)', fontSize: 12, margin: '12px 0 0' }}>
          {t('panels.claim.claimError', { error })}
        </p>
      )}
    </div>
  );
};

export default ClaimPanel;
