// src/pages/BillsPage.js
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getKeycloak, authHeaders } from '../services/keycloak';
import usePageMeta from '../hooks/usePageMeta';

// One shared route (/bills) for both platform:project-manager and
// platform:account-manager, deliberately not /pm/bills or /am/bills —
// the backend (rustledger's GET /api/billing/bills) already knows the
// caller's role from their JWT and scopes the response accordingly (a
// PM's own bills vs. every bill, AM's unscoped-by-design reach). This
// component only branches on role for display framing ("Your bills" vs
// "All bills") and whether the Publish action shows — never to pick a
// different endpoint or query.
const BillsPage = () => {
  const { t } = useTranslation('gofeeler');
  usePageMeta({ title: 'Microverse - Bills' });
  const keycloak = getKeycloak();
  const isAccountManager = keycloak?.hasRealmRole('platform:account-manager');

  const [bills, setBills] = useState(null);
  const [taskTitles, setTaskTitles] = useState({});
  const [error, setError] = useState(null);
  const [publishingId, setPublishingId] = useState(null);

  // rustledger only knows task_id, not the task's title — that's
  // task-service's data. Resolved here client-side, in parallel, rather
  // than rustledger reaching into task-service for every list request;
  // a failed/missing lookup (e.g. a deleted task) just falls back to
  // showing the raw id, not an error for the whole page.
  const resolveTaskTitles = (billList) => {
    const uniqueIds = [...new Set(billList.map((bill) => bill.task_id))];
    Promise.all(
      uniqueIds.map((taskId) =>
        fetch(`/api/tasks/${taskId}`, { headers: authHeaders() })
          .then((res) => (res.ok ? res.json() : null))
          .then((task) => [taskId, task?.title])
          .catch(() => [taskId, undefined])
      )
    ).then((entries) => {
      setTaskTitles(Object.fromEntries(entries.filter(([, title]) => title)));
    });
  };

  const refetch = () => {
    setError(null);
    return fetch('/api/billing/bills', { headers: authHeaders() })
      .then((res) => {
        if (!res.ok) throw new Error(`rustledger returned ${res.status}`);
        return res.json();
      })
      .then((billList) => {
        setBills(billList);
        resolveTaskTitles(billList);
      })
      .catch((err) => setError(err.message));
  };

  useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const publish = async (taskId) => {
    setPublishingId(taskId);
    setError(null);
    try {
      const res = await fetch(`/api/billing/bills/by-task/${taskId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || `rustledger returned ${res.status}`);
      setBills((prev) => prev.map((bill) => (bill.task_id === taskId ? body : bill)));
    } catch (err) {
      setError(err.message);
    } finally {
      setPublishingId(null);
    }
  };

  const cellStyle = { padding: '10px 12px', fontSize: 13, color: 'var(--mv-text)', borderBottom: '0.5px solid var(--mv-border)' };
  const headerCellStyle = { ...cellStyle, color: 'var(--mv-badge-bg)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 };

  return (
    <div style={{ margin: 'var(--mv-space-3)' }}>
      <p style={{ color: 'var(--mv-text)', fontSize: 18, fontWeight: 500, margin: '0 0 4px' }}>
        {t('billsPage.title')}
      </p>
      <p style={{ color: 'var(--mv-badge-bg)', fontSize: 12, margin: '0 0 18px' }}>
        {isAccountManager ? t('billsPage.subtitleAllServices') : t('billsPage.subtitleYourBills')}
      </p>

      {error && (
        <p style={{ color: 'var(--mv-color-danger)', fontSize: 12, margin: '0 0 12px' }}>{error}</p>
      )}

      {!bills && !error && (
        <p style={{ color: 'var(--mv-text-muted)', fontSize: 13 }}>{t('billsPage.loading')}</p>
      )}

      {bills && bills.length === 0 && (
        <p style={{ color: 'var(--mv-text-muted)', fontSize: 13 }}>{t('billsPage.empty')}</p>
      )}

      {bills && bills.length > 0 && (
        <div style={{ overflowX: 'auto', border: '0.5px solid var(--mv-border)', borderRadius: 'var(--mv-radius-lg)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={headerCellStyle}>{t('billsPage.columns.task')}</th>
                <th style={headerCellStyle}>{t('billsPage.columns.amount')}</th>
                <th style={headerCellStyle}>{t('billsPage.columns.status')}</th>
                <th style={headerCellStyle}>{t('billsPage.columns.published')}</th>
                <th style={headerCellStyle}>{t('billsPage.columns.created')}</th>
                {isAccountManager && <th style={headerCellStyle}></th>}
              </tr>
            </thead>
            <tbody>
              {bills.map((bill) => (
                <tr key={bill.id}>
                  <td style={cellStyle}>
                    <Link to={`/task/${bill.task_id}`} style={{ color: 'var(--mv-color-primary)' }}>
                      {taskTitles[bill.task_id] || bill.task_id}
                    </Link>
                  </td>
                  <td style={cellStyle}>
                    {(bill.amount_cents / 100).toFixed(2)} {bill.currency}
                  </td>
                  <td style={cellStyle}>{bill.status === 'paid' ? t('billsPage.statusPaid') : t('billsPage.statusUnpaid')}</td>
                  <td style={cellStyle}>
                    {bill.published_at ? t('billsPage.published') : t('billsPage.draft')}
                  </td>
                  <td style={cellStyle}>{new Date(bill.created_at).toLocaleDateString()}</td>
                  {isAccountManager && (
                    <td style={cellStyle}>
                      {!bill.published_at && (
                        <button
                          type="button"
                          onClick={() => publish(bill.task_id)}
                          disabled={publishingId === bill.task_id}
                          style={{
                            padding: '5px 10px',
                            background: 'var(--mv-color-primary)',
                            color: 'var(--mv-color-primary-contrast)',
                            fontWeight: 500,
                            fontSize: 12,
                            border: 'none',
                            borderRadius: 6,
                            cursor: publishingId === bill.task_id ? 'default' : 'pointer',
                            opacity: publishingId === bill.task_id ? 0.6 : 1,
                          }}
                        >
                          {publishingId === bill.task_id ? t('billsPage.publishing') : t('billsPage.publish')}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default BillsPage;
