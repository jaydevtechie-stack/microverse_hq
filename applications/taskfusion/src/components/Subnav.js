// src/components/Subnav.js
import React from 'react';

// In-page tab row for a nav section that has its own sub-level items —
// e.g. Admin's Users/Services/Settings/Audit log, Delivery team's
// Analysts/Reviewers. This is the design system's actual pattern for
// sub-level nav (see branding/mv-1.0/design-system/mock-ups/
// platform_projects_hub_and_admin.html's #subnav): a persistent row
// under the main nav, not a click-to-open dropdown menu.
const Subnav = ({ tabs, active, onChange }) => (
  <div style={{ display: 'flex', gap: 18, padding: '0 4px', marginBottom: 10 }}>
    {tabs.map((tab) => (
      <span
        key={tab.id}
        onClick={() => onChange(tab.id)}
        style={{
          fontSize: 13,
          cursor: 'pointer',
          paddingBottom: 4,
          color: active === tab.id ? 'var(--mv-color-primary)' : 'var(--mv-text-muted)',
          borderBottom: active === tab.id ? '2px solid var(--mv-color-primary)' : '2px solid transparent',
        }}
      >
        {tab.label}
      </span>
    ))}
  </div>
);

export default Subnav;
