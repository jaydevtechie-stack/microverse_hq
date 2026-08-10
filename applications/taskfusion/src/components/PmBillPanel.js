import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

// Dummy — no billing-service/rustledger integration yet (ROADMAP.md's
// "PM approval → bill creation handoff to rustledger" is still
// unbranched work). Clicking just shows a local confirmation; nothing
// is actually created or sent anywhere.
const PmBillPanel = () => {
  const { t } = useTranslation('gofeeler');
  const [billed, setBilled] = useState(false);

  return (
    <div>
      <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: '0 0 6px' }}>
        {t('panels.pmBill.analysisApproved')}
      </p>
      <p style={{ color: 'var(--mv-text)', fontSize: 13, margin: '0 0 18px' }}>
        {t('panels.pmBill.readyToBill')}
      </p>

      <button
        type="button"
        onClick={() => setBilled(true)}
        disabled={billed}
        style={{
          width: '100%',
          padding: '10px 0',
          background: billed ? 'var(--mv-badge-bg)' : 'var(--mv-color-primary)',
          color: billed ? 'var(--mv-badge-text)' : 'var(--mv-color-primary-contrast)',
          fontWeight: 500,
          fontSize: 13,
          border: 'none',
          borderRadius: 8,
          cursor: billed ? 'default' : 'pointer',
          marginBottom: billed ? 12 : 0,
        }}
      >
        {billed ? t('panels.pmBill.billCreated') : t('panels.pmBill.createBill')}
      </button>

      {billed && (
        <div
          style={{
            background: 'color-mix(in srgb, var(--mv-color-primary) 13%, transparent)',
            border: '0.5px solid var(--mv-color-primary)',
            borderRadius: 8,
            padding: '10px 12px',
            color: 'var(--mv-color-primary)',
            fontSize: 12,
          }}
        >
          {t('panels.pmBill.billCreatedNote')}
        </div>
      )}
    </div>
  );
};

export default PmBillPanel;
