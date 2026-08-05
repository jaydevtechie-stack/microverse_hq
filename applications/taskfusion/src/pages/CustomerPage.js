// src/pages/CustomerPage.js
import React from 'react';
import { CUSTOMER, ORDERS, INVOICES } from '../data/customers';
import ProfileHeader from '../components/ProfileHeader';
import OrderList from '../components/OrderList';
import InvoiceList from '../components/InvoiceList';

const CustomerPage = () => (
  <div
    style={{
      background: 'var(--mv-bg-elevated)',
      border: '0.5px solid var(--mv-border)',
      borderRadius: 'var(--mv-radius-lg)',
      margin: 'var(--mv-space-3)',
      padding: '16px 18px',
    }}
  >
    <ProfileHeader
      avatarShape="square"
      initials={CUSTOMER.initials}
      name={CUSTOMER.name}
      subtitle={CUSTOMER.sub}
    />

    <p style={{ color: 'var(--mv-text)', fontSize: 13, fontWeight: 500, margin: '0 0 8px' }}>
      Orders
    </p>
    <div style={{ marginBottom: 18 }}>
      <OrderList orders={ORDERS} />
    </div>

    <p style={{ color: 'var(--mv-text)', fontSize: 13, fontWeight: 500, margin: '0 0 8px' }}>
      Invoices
    </p>
    <InvoiceList invoices={INVOICES} />
  </div>
);

export default CustomerPage;
