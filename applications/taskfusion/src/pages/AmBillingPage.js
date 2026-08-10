// src/pages/AmBillingPage.js
import React from 'react';
import { useTranslation } from 'react-i18next';
import PlaceholderPage from '../components/PlaceholderPage';
import usePageMeta from '../hooks/usePageMeta';

// 4.3 — moved here from platform:admin, account-manager scoped
// (which Accounts they own). Contract terms (payment_terms),
// invoicing status — lives under the role that owns the customer
// relationship rather than Admin.
const AmBillingPage = () => {
  const { t } = useTranslation('accounts');
  usePageMeta({ title: 'Microverse - Billing' });
  return (
    <div style={{ margin: 'var(--mv-space-3)' }}>
      <PlaceholderPage title={t('billingPlaceholder.title')} note={t('billingPlaceholder.note')} />
    </div>
  );
};

export default AmBillingPage;
