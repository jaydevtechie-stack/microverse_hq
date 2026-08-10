// src/pages/CreateOrderPage.js
import React from 'react';
import { useTranslation } from 'react-i18next';
import CreateOrderForm from '../components/CreateOrderForm';
import CloseButton from '../components/CloseButton';

// Standalone full-page version, used off the gofeeler microsite (e.g.
// CustomerPage's "+ New order" link on the platform host). On the
// gofeeler microsite itself, GofeelerSplitView renders CreateOrderForm
// inline as a panel instead of navigating to a whole new page.
const CreateOrderPage = () => {
  const { t } = useTranslation('orders');
  return (
    <div
      style={{
        position: 'relative',
        background: 'var(--mv-bg-elevated)',
        border: '0.5px solid var(--mv-border)',
        borderRadius: 'var(--mv-radius-lg)',
        margin: 'var(--mv-space-3)',
        padding: '16px 18px',
        maxWidth: 520,
      }}
    >
      <CloseButton />

      <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: '0 0 4px' }}>
        {t('createPage.eyebrow')}
      </p>
      <p style={{ color: 'var(--mv-text)', fontSize: 16, fontWeight: 500, margin: '0 0 18px' }}>
        {t('createPage.heading')}
      </p>

      <CreateOrderForm />
    </div>
  );
};

export default CreateOrderPage;
