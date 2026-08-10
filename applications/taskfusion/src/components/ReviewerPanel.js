import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import SentimentBar from './SentimentBar';

// Approve/Reject and reassign are stubs — no PATCH /api/tasks/:id yet
// (ROADMAP.md Branch 4). Comments and customer-facing notes live in
// TaskDetailContent now, not here.
const ReviewerPanel = () => {
  const { t } = useTranslation('gofeeler');
  const [decision, setDecision] = useState(null);

  return (
    <div>
      <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: '0 0 6px' }}>
        {t('panels.reviewer.analystResults')}
      </p>
      <div style={{ marginBottom: 18 }}>
        <SentimentBar label={t('panels.sentimentNegative')} percent={71} />
      </div>

      <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: '0 0 6px' }}>
        {t('panels.reviewer.reassignReviewer')}
      </p>
      <select
        style={{
          width: '100%',
          background: 'var(--mv-bg)',
          border: '0.5px solid var(--mv-border)',
          borderRadius: 8,
          padding: '9px 12px',
          color: 'var(--mv-text)',
          fontSize: 13,
          marginBottom: 18,
          boxSizing: 'border-box',
        }}
      >
        <option>{t('panels.reviewer.defaultOption')}</option>
        <option>{t('panels.reviewer.namedOption')}</option>
      </select>

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          type="button"
          onClick={() => setDecision('approved')}
          style={{
            flex: 1,
            padding: '10px 0',
            background: 'var(--mv-color-success)',
            color: '#0b1a00',
            fontWeight: 500,
            fontSize: 13,
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          {t('panels.reviewer.approve')}
        </button>
        <button
          type="button"
          onClick={() => setDecision('rejected')}
          style={{
            flex: 1,
            padding: '10px 0',
            background: 'transparent',
            border: '0.5px solid var(--mv-color-danger)',
            color: 'var(--mv-color-danger)',
            fontWeight: 500,
            fontSize: 13,
            borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          {t('panels.reviewer.reject')}
        </button>
      </div>

      {decision === 'approved' && (
        <p style={{ color: 'var(--mv-color-success)', fontSize: 12, margin: '10px 0 0' }}>
          {t('panels.reviewer.approved')}
        </p>
      )}
      {decision === 'rejected' && (
        <p style={{ color: 'var(--mv-color-danger)', fontSize: 12, margin: '10px 0 0' }}>
          {t('panels.reviewer.rejected')}
        </p>
      )}
    </div>
  );
};

export default ReviewerPanel;
