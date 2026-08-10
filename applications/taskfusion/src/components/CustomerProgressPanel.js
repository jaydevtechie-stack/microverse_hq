import React from 'react';
import { useTranslation } from 'react-i18next';
import { IconCheck, IconLock } from '@tabler/icons-react';

const STEP_KEYS = ['submitted', 'analysed', 'reviewed', 'paid'];

// done = first 3 steps complete, invoice not paid yet; paid/closed = all
// 4 complete. Matches ARCHITECTURE.md: reaching paid unlocks download.
function completedCount(status) {
  if (status === 'paid' || status === 'closed') return 4;
  if (status === 'done') return 3;
  return 0;
}

const CustomerProgressPanel = ({ task }) => {
  const { t } = useTranslation('gofeeler');
  const done = completedCount(task.status);
  const unlocked = task.status === 'paid' || task.status === 'closed';

  return (
    <div>
      <div style={{ display: 'flex', marginBottom: 18 }}>
        {STEP_KEYS.map((stepKey, i) => (
          <div key={stepKey} style={{ flex: 1, textAlign: 'center' }}>
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: i < done ? 'var(--mv-color-success)' : 'var(--mv-border)',
                margin: '0 auto 4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {i < done && <IconCheck size={14} color="#0b1a00" />}
            </div>
            <span
              style={{
                color: i < done ? 'var(--mv-text-muted)' : 'var(--mv-badge-bg)',
                fontSize: 10,
              }}
            >
              {t(`panels.customerProgress.steps.${stepKey}`)}
            </span>
          </div>
        ))}
      </div>

      <div
        style={{
          background: 'var(--mv-bg)',
          border: '0.5px solid var(--mv-border)',
          borderRadius: 8,
          padding: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 12,
        }}
      >
        {!unlocked && <IconLock size={18} color="var(--mv-badge-bg)" />}
        <div>
          <p style={{ color: 'var(--mv-text)', fontSize: 13, margin: 0 }}>
            {unlocked ? t('panels.customerProgress.readyToDownload') : t('panels.customerProgress.readyInvoicePending')}
          </p>
          <p style={{ color: 'var(--mv-badge-bg)', fontSize: 11, margin: '2px 0 0' }}>
            {unlocked
              ? t('panels.customerProgress.invoicePaid')
              : t('panels.customerProgress.downloadUnlocks')}
          </p>
        </div>
      </div>

      <button
        type="button"
        style={{
          width: '100%',
          padding: '10px 0',
          background: 'var(--mv-color-primary)',
          color: 'var(--mv-color-primary-contrast)',
          fontWeight: 500,
          fontSize: 13,
          border: 'none',
          borderRadius: 8,
          cursor: 'pointer',
        }}
      >
        {unlocked ? t('panels.customerProgress.downloadResults') : t('panels.customerProgress.viewInvoice')}
      </button>
    </div>
  );
};

export default CustomerProgressPanel;
