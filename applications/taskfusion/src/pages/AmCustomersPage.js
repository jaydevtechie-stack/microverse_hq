// src/pages/AmCustomersPage.js
import React from 'react';
import PlaceholderPage from '../components/PlaceholderPage';

// 4.3 — new platform:account-manager role, not yet provisioned in
// Keycloak. Account-level view: contacts, services engaged, cross-
// sell/upsell visibility (see docs/business/1.0/overview.md's Account
// management section). Master-detail split view: list of Accounts,
// detail shows that Account's engagement history.
const AmCustomersPage = () => (
  <div style={{ margin: 'var(--mv-space-3)' }}>
    <PlaceholderPage
      title="Customers"
      note="Coming soon — account-level master-detail view: contacts, services engaged, cross-sell/upsell visibility, engagement history."
    />
  </div>
);

export default AmCustomersPage;
