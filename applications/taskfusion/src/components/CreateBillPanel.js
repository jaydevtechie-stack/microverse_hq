import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { authHeaders } from '../services/keycloak';

// Branch 9 — real rustledger integration. No price/rate field exists
// anywhere on tasks/projects (docs/schema.md), so the PM enters the
// amount by hand; rustledger re-verifies task ownership/status
// server-side rather than trusting anything from this form beyond the
// amount itself.
//
// Two separate PM actions, not one: creating a bill leaves it a draft
// (invisible to the customer, no notification) so the PM can double-
// check the amount; publishing is the explicit "release it" step that
// actually notifies the customer (email + in-app, notification-service's
// bill.published handler) and unlocks payment for them.
const CreateBillPanel = ({ task, onBilled }) => {
  const { t } = useTranslation('gofeeler');
  const [amount, setAmount] = useState('');
  const [bill, setBill] = useState(null);
  const [loadingBill, setLoadingBill] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState(null);

  // A task stays 'done' (and this panel stays mounted) until the
  // customer pays — revisiting the page shouldn't offer "Create bill"
  // again on a task that already has a draft/published bill, and should
  // pick up mid-flow at whichever step (draft vs published) it's
  // actually in.
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

  const publishBill = async () => {
    setWorking(true);
    setError(null);
    try {
      const res = await fetch(`/api/billing/bills/by-task/${task.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || `rustledger returned ${res.status}`);
      setBill(body);
      onBilled?.(task);
    } catch (err) {
      setError(t('panels.createBill.publishError', { error: err.message }));
    } finally {
      setWorking(false);
    }
  };

  if (loadingBill) {
    return <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: 0 }}>{t('panels.createBill.loading')}</p>;
  }

  const published = Boolean(bill?.published_at);

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

      {bill && !published && (
        <>
          <div
            style={{
              background: 'var(--mv-bg)',
              border: '0.5px solid var(--mv-border)',
              borderRadius: 8,
              padding: '10px 12px',
              color: 'var(--mv-text)',
              fontSize: 12,
              marginBottom: 12,
            }}
          >
            {t('panels.createBill.draftNote', { amount: (bill.amount_cents / 100).toFixed(2), currency: bill.currency })}
          </div>
          <button
            type="button"
            onClick={publishBill}
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
            {working ? t('panels.createBill.publishing') : t('panels.createBill.publishBill')}
          </button>
        </>
      )}

      {error && (
        <p style={{ color: 'var(--mv-color-danger)', fontSize: 12, margin: '8px 0 0' }}>{error}</p>
      )}

      {published && (
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
          {t('panels.createBill.billPublishedNote')}
        </div>
      )}
    </div>
  );
};

export default CreateBillPanel;
