import React from 'react';

const InvoiceList = ({ invoices }) => (
  <div style={{ display: 'flex', flexDirection: 'column' }}>
    {invoices.map((invoice) => (
      <div
        key={invoice.id}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 4px',
          borderBottom: '0.5px solid var(--mv-border)',
        }}
      >
        <span style={{ color: 'var(--mv-text)', fontSize: 13, flex: 1 }}>{invoice.id}</span>
        <span style={{ color: 'var(--mv-text-muted)', fontSize: 12 }}>{invoice.amount}</span>
        <span
          style={{
            color: invoice.status === 'paid' ? 'var(--mv-color-primary)' : 'var(--mv-text-muted)',
            fontSize: 11,
          }}
        >
          {invoice.status}
        </span>
      </div>
    ))}
  </div>
);

export default InvoiceList;
