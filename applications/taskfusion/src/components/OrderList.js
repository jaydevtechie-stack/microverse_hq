import React from 'react';

const OrderList = ({ orders }) => (
  <div style={{ display: 'flex', flexDirection: 'column' }}>
    {orders.map((order) => (
      <div
        key={order.id}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 4px',
          borderBottom: '0.5px solid var(--mv-border)',
        }}
      >
        <span style={{ color: 'var(--mv-text)', fontSize: 13, flex: 1 }}>
          {order.id} · {order.service}
        </span>
        <span
          style={{
            color: 'var(--mv-color-primary)',
            fontSize: 11,
            background: 'color-mix(in srgb, var(--mv-color-primary) 13%, transparent)',
            padding: '2px 8px',
            borderRadius: 10,
          }}
        >
          {order.status}
        </span>
      </div>
    ))}
  </div>
);

export default OrderList;
