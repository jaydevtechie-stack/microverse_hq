// src/components/PlaceholderPage.js
import React from 'react';

// Shared "stub now, build later" content block for 4.3 nav items that
// have a real route/nav slot but no real page yet — same pattern as
// 4.0.3's Services tab (AdminPage.js's ServiceDetail disabled
// buttons). No margin of its own — callers embedding this as tab
// content inside an already-margined shell (AdminPage.js,
// DeliveryTeamPage.js) would otherwise get it doubled; standalone-page
// callers (PmOrdersPage.js etc.) supply their own margin wrapper.
const PlaceholderPage = ({ title, note }) => (
  <div
    style={{
      background: 'var(--mv-bg-elevated)',
      border: '0.5px solid var(--mv-border)',
      borderRadius: 'var(--mv-radius-lg)',
      padding: '16px 18px',
    }}
  >
    <p style={{ color: 'var(--mv-text)', fontSize: 15, fontWeight: 500, margin: '0 0 6px' }}>{title}</p>
    <p style={{ color: 'var(--mv-badge-bg)', fontSize: 12, margin: 0, lineHeight: 1.4 }}>{note}</p>
  </div>
);

export default PlaceholderPage;
