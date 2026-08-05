// src/pages/CustomerPage.js
import React from 'react';
import { Link } from 'react-router-dom';
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
      roleType="customer"
      initials={CUSTOMER.initials}
      name={CUSTOMER.name}
      subtitle={CUSTOMER.sub}
    />

    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
      }}
    >
      <p style={{ color: 'var(--mv-text)', fontSize: 13, fontWeight: 500, margin: 0 }}>Orders</p>
      {/* Gofeeler's the only service with a Create Order flow so far —
          this becomes a per-service picker once others catch up */}
      <Link
        to="/create"
        style={{ color: 'var(--mv-color-primary)', fontSize: 12, textDecoration: 'none' }}
      >
        + New order
      </Link>
    </div>
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
