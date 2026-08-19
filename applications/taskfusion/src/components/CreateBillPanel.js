import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { authHeaders } from '../services/keycloak';

// Branch 9 — real rustledger integration. No price/rate field exists
// anywhere on tasks/projects (docs/schema.md), so the PM enters the
// amount by hand; rustledger re-verifies task ownership/status
// server-side rather than trusting anything from this form beyond the
// amount itself.
//
// PM creates the bill (this panel); publishing it — the step that
// actually notifies the customer and unlocks payment — moved to the
// account manager after this branch's first pass (see
// docs/roadmap/1.0/domain-services.md's Branch 9). That action now lives
// on the shared /bills page (BillsPage.js), not here — a PM's part ends
// once the draft exists.
const CreateBillPanel = ({ task, onBilled }) => {
  const { t } = useTranslation('gofeeler');
  const [amount, setAmount] = useState('');
  const [bill, setBill] = useState(null);
  const [loadingBill, setLoadingBill] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState(null);

  // A task stays 'done' (and this panel stays mounted) until the
  // customer pays — revisiting the page shouldn't offer "Create bill"
  // again on a task that already has a bill.
  useEffect(() => {
    let cancelled = false;
    setLoadingBill(true);
    fetch(`/api/billing/bills/by-task/${task.id}`, { headers: authHeaders() })
      .then((res) => (res.ok ? res.json() : null))
      .then((existingBill) => {
        if (!cancelled) setBill(existingBill);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingBill(false);
      });
    return () => {
      cancelled = true;
    };
  }, [task.id]);

  const amountCents = Math.round(Number(amount) * 100);
  const validAmount = amount !== '' && Number.isFinite(amountCents) && amountCents > 0;

  const createBill = async () => {
    setWorking(true);
    setError(null);
    try {
      const res = await fetch('/api/billing/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ taskId: task.id, amountCents, currency: 'USD' }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || `rustledger returned ${res.status}`);
      setBill(body);
      onBilled?.(task);
    } catch (err) {
      setError(t('panels.createBill.billError', { error: err.message }));
    } finally {
      setWorking(false);
    }
  };

  if (loadingBill) {
    return <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: 0 }}>{t('panels.createBill.loading')}</p>;
  }

  return (
    <div>
      <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: '0 0 6px' }}>
        {t('panels.createBill.analysisApproved')}
      </p>
      <p style={{ color: 'var(--mv-text)', fontSize: 13, margin: '0 0 12px' }}>
        {t('panels.createBill.readyToBill')}
      </p>

      {!bill && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <span style={{ color: 'var(--mv-text-muted)', fontSize: 13 }}>$</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={t('panels.createBill.amountPlaceholder')}
              style={{
                flex: 1,
                background: 'var(--mv-bg)',
                border: '0.5px solid var(--mv-border)',
                borderRadius: 8,
                padding: '9px 12px',
                color: 'var(--mv-text)',
                fontSize: 13,
                boxSizing: 'border-box',
              }}
            />
            <span style={{ color: 'var(--mv-text-muted)', fontSize: 13 }}>USD</span>
          </div>

          <button
            type="button"
            onClick={createBill}
            disabled={working || !validAmount}
            style={{
              width: '100%',
              padding: '10px 0',
              background: 'var(--mv-color-primary)',
              color: 'var(--mv-color-primary-contrast)',
              fontWeight: 500,
              fontSize: 13,
              border: 'none',
              borderRadius: 8,
              cursor: working || !validAmount ? 'default' : 'pointer',
              opacity: !working && !validAmount ? 0.6 : 1,
            }}
          >
            {working ? t('panels.createBill.billing') : t('panels.createBill.createBill')}
          </button>
        </>
      )}

      {error && (
        <p style={{ color: 'var(--mv-color-danger)', fontSize: 12, margin: '8px 0 0' }}>{error}</p>
      )}

      {bill && (
        <div
          style={{
            background: bill.published_at
              ? 'color-mix(in srgb, var(--mv-color-primary) 13%, transparent)'
              : 'var(--mv-bg)',
            border: `0.5px solid ${bill.published_at ? 'var(--mv-color-primary)' : 'var(--mv-border)'}`,
            borderRadius: 8,
            padding: '10px 12px',
            color: bill.published_at ? 'var(--mv-color-primary)' : 'var(--mv-text)',
            fontSize: 12,
          }}
        >
          {bill.published_at
            ? t('panels.createBill.billPublishedNote')
            : t('panels.createBill.draftNote', {
                amount: (bill.amount_cents / 100).toFixed(2),
                currency: bill.currency,
              })}
        </div>
      )}
    </div>
  );
};

export default CreateBillPanel;
