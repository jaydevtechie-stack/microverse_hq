// src/pages/PmOrdersPage.js
import React from 'react';
import { useTranslation } from 'react-i18next';
import PlaceholderPage from '../components/PlaceholderPage';

// 4.3 — moved here from platform:admin, PM-scoped (pm_accounts +
// service scope). Placeholder only: real order list + 4.1.2's
// shared-pool claim query (FOR UPDATE SKIP LOCKED, see
// ARCHITECTURE.md's business-services "The task pool") are later-phase
// work. This nav item exists now so that UI has a home reserved under
// PM instead of Admin.
const PmOrdersPage = () => {
  const { t } = useTranslation('orders');
  return (
    <div style={{ margin: 'var(--mv-space-3)' }}>
      <PlaceholderPage title={t('pmOrdersPlaceholder.title')} note={t('pmOrdersPlaceholder.note')} />
    </div>
  );
};

export default PmOrdersPage;
