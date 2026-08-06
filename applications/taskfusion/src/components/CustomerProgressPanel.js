import React from 'react';
import { IconCheck, IconLock } from '@tabler/icons-react';

const STEPS = ['Submitted', 'Analysed', 'Reviewed', 'Paid'];

// done = first 3 steps complete, invoice not paid yet; paid/closed = all
// 4 complete. Matches ARCHITECTURE.md: reaching paid unlocks download.
function completedCount(status) {
  if (status === 'paid' || status === 'closed') return 4;
  if (status === 'done') return 3;
  return 0;
}

const CustomerProgressPanel = ({ task }) => {
  const done = completedCount(task.status);
  const unlocked = task.status === 'paid' || task.status === 'closed';

  return (
    <div>
      <div style={{ display: 'flex', marginBottom: 18 }}>
        {STEPS.map((step, i) => (
          <div key={step} style={{ flex: 1, textAlign: 'center' }}>
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
              {step}
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
            {unlocked ? 'Results ready to download' : 'Results ready — invoice pending'}
          </p>
          <p style={{ color: 'var(--mv-badge-bg)', fontSize: 11, margin: '2px 0 0' }}>
            {unlocked
              ? 'Your invoice has been paid'
              : 'Download unlocks once your invoice is paid'}
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
        {unlocked ? 'Download results' : 'View invoice'}
      </button>
    </div>
  );
};

export default CustomerProgressPanel;
