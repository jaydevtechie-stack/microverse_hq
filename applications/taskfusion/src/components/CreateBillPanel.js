import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { authHeaders } from '../services/keycloak';

// Branch 9 — real rustledger integration. No price/rate field exists
// anywhere on tasks/projects (docs/schema.md), so the PM enters the
// amount by hand; rustledger re-verifies task ownership/status
// server-side rather than trusting anything from this form beyond the
// amount itself.
const CreateBillPanel = ({ task, onBilled }) => {
  const { t } = useTranslation('gofeeler');
  const [amount, setAmount] = useState('');
  const [billing, setBilling] = useState(false);
  const [billError, setBillError] = useState(null);
  const [billed, setBilled] = useState(false);

  // A task stays 'done' (and this panel stays mounted) until the
  // customer pays — revisiting the page shouldn't offer "Create bill"
  // again and risk rustledger's one-bill-per-task unique index rejecting
  // a second attempt. 404 just means no bill yet, the ordinary case.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/billing/bills/by-task/${task.id}`, { headers: authHeaders() })
      .then((res) => (res.ok ? res.json() : null))
      .then((bill) => {
        if (!cancelled && bill) setBilled(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [task.id]);

  const amountCents = Math.round(Number(amount) * 100);
  const validAmount = amount !== '' && Number.isFinite(amountCents) && amountCents > 0;

  const createBill = async () => {
    setBilling(true);
    setBillError(null);
    try {
      const res = await fetch('/api/billing/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ taskId: task.id, amountCents, currency: 'USD' }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || `rustledger returned ${res.status}`);
      setBilled(true);
      onBilled?.(task);
    } catch (err) {
      setBillError(err.message);
    } finally {
      setBilling(false);
    }
  };

  return (
    <div>
      <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: '0 0 6px' }}>
        {t('panels.createBill.analysisApproved')}
      </p>
      <p style={{ color: 'var(--mv-text)', fontSize: 13, margin: '0 0 12px' }}>
        {t('panels.createBill.readyToBill')}
      </p>

      {!billed && (
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
      )}

      <button
        type="button"
        onClick={createBill}
        disabled={billed || billing || !validAmount}
        style={{
          width: '100%',
          padding: '10px 0',
          background: billed ? 'var(--mv-badge-bg)' : 'var(--mv-color-primary)',
          color: billed ? 'var(--mv-badge-text)' : 'var(--mv-color-primary-contrast)',
          fontWeight: 500,
          fontSize: 13,
          border: 'none',
          borderRadius: 8,
          cursor: billed || billing || !validAmount ? 'default' : 'pointer',
          opacity: !billed && !billing && !validAmount ? 0.6 : 1,
          marginBottom: billed ? 12 : 0,
        }}
      >
        {billed ? t('panels.createBill.billCreated') : billing ? t('panels.createBill.billing') : t('panels.createBill.createBill')}
      </button>

      {billError && (
        <p style={{ color: 'var(--mv-color-danger)', fontSize: 12, margin: '8px 0 0' }}>
          {t('panels.createBill.billError', { error: billError })}
        </p>
      )}

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
          {t('panels.createBill.billCreatedNote')}
        </div>
      )}
    </div>
  );
};

export default CreateBillPanel;
