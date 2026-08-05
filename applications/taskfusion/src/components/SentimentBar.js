import React from 'react';

const SentimentBar = ({ label, percent, color = 'var(--mv-color-danger)' }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <span style={{ color: 'var(--mv-text)', fontSize: 11, width: 60 }}>{label}</span>
    <div
      style={{
        flex: 1,
        height: 5,
        background: 'var(--mv-border)',
        borderRadius: 3,
        overflow: 'hidden',
      }}
    >
      <div style={{ width: `${percent}%`, height: '100%', background: color }} />
    </div>
    <span style={{ color: 'var(--mv-text-muted)', fontSize: 11 }}>{percent}%</span>
  </div>
);

export default SentimentBar;
