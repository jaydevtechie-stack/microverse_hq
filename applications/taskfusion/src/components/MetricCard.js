import React from 'react';

const MetricCard = ({ label, value }) => (
  <div
    style={{
      background: 'var(--mv-bg-elevated)',
      border: '0.5px solid var(--mv-border)',
      borderRadius: 8,
      padding: '10px 12px',
    }}
  >
    <p style={{ color: 'var(--mv-text-muted)', fontSize: 11, margin: '0 0 4px' }}>{label}</p>
    <p style={{ color: 'var(--mv-text)', fontSize: 18, fontWeight: 500, margin: 0 }}>{value}</p>
  </div>
);

export default MetricCard;
