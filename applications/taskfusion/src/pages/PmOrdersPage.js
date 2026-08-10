// src/pages/PmOrdersPage.js
import React from 'react';
import PlaceholderPage from '../components/PlaceholderPage';

// 4.3 — moved here from platform:admin, PM-scoped (pm_accounts +
// service scope). Placeholder only: real order list + 4.1.2's
// shared-pool claim query (FOR UPDATE SKIP LOCKED, see
// ARCHITECTURE.md's business-services "The task pool") are later-phase
// work. This nav item exists now so that UI has a home reserved under
// PM instead of Admin.
const PmOrdersPage = () => (
  <div style={{ margin: 'var(--mv-space-3)' }}>
    <PlaceholderPage
      title="Orders"
      note="Coming soon — PM-scoped order list, plus the shared-pool claim mechanism from Branch 4's 4.1.2, land here once designed."
    />
  </div>
);

export default PmOrdersPage;
