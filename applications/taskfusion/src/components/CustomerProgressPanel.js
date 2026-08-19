import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconCheck, IconLock } from '@tabler/icons-react';
import { authHeaders } from '../services/keycloak';

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
  const [working, setWorking] = useState(false);
  const [error, setError] = useState(null);

  // "View invoice" — creates (or reuses) a Stripe Checkout Session for
  // this task's bill and redirects the browser there. A 404 here means
  // the PM hasn't created the bill yet (PmBillPanel.js) — surfaced as a
  // distinct message rather than a generic error.
  const payInvoice = async () => {
    setWorking(true);
    setError(null);
    try {
      const res = await fetch(`/api/billing/bills/by-task/${task.id}/checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
      });
      const body = await res.json();
      if (res.status === 404) throw new Error(t('panels.customerProgress.notYetInvoiced'));
      if (!res.ok) throw new Error(body.message || `rustledger returned ${res.status}`);
      window.location.href = body.url;
    } catch (err) {
      setError(err.message);
      setWorking(false);
    }
  };

  // "Download results" — lists the task's files (asset-service, same
  // endpoint TaskFilesList.js reads) then resolves + opens each one's
  // presigned download-url. asset-service itself re-checks status ===
  // paid/closed server-side (api.rs's download_url) — this call would
  // 403 if it somehow ran before that were true.
  const downloadResults = async () => {
    setWorking(true);
    setError(null);
    try {
      const listRes = await fetch(`/api/assets/${task.id}?service=${task.service}`, { headers: authHeaders() });
      const files = await listRes.json();
      if (!listRes.ok) throw new Error(files.message || `asset-service returned ${listRes.status}`);
      if (files.length === 0) throw new Error(t('panels.customerProgress.noFiles'));

      for (const file of files) {
        const urlRes = await fetch(
          `/api/assets/${task.id}/download-url?filename=${encodeURIComponent(file.filename)}&service=${task.service}`,
          { headers: authHeaders() }
        );
        const urlBody = await urlRes.json();
        if (!urlRes.ok) throw new Error(urlBody.message || `asset-service returned ${urlRes.status}`);
        window.open(urlBody.download_url, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setWorking(false);
    }
  };

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
        onClick={unlocked ? downloadResults : payInvoice}
        disabled={working}
        style={{
          width: '100%',
          padding: '10px 0',
          background: 'var(--mv-color-primary)',
          color: 'var(--mv-color-primary-contrast)',
          fontWeight: 500,
          fontSize: 13,
          border: 'none',
          borderRadius: 8,
          cursor: working ? 'default' : 'pointer',
          opacity: working ? 0.6 : 1,
        }}
      >
        {working
          ? t('panels.customerProgress.working')
          : unlocked
            ? t('panels.customerProgress.downloadResults')
            : t('panels.customerProgress.viewInvoice')}
      </button>

      {error && (
        <p style={{ color: 'var(--mv-color-danger)', fontSize: 12, margin: '8px 0 0' }}>{error}</p>
      )}
    </div>
  );
};

export default CustomerProgressPanel;
