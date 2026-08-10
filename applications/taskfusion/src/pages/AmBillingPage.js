// src/pages/AmBillingPage.js
import React from 'react';
import PlaceholderPage from '../components/PlaceholderPage';

// 4.3 — moved here from platform:admin, account-manager scoped
// (which Accounts they own). Contract terms (payment_terms),
// invoicing status — lives under the role that owns the customer
// relationship rather than Admin.
const AmBillingPage = () => (
  <div style={{ margin: 'var(--mv-space-3)' }}>
    <PlaceholderPage
      title="Billing"
      note="Coming soon — account-manager-scoped billing: contract terms, invoicing status for the Accounts this AM owns."
    />
  </div>
);

export default AmBillingPage;
