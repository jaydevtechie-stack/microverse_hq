import React, { useState } from 'react';
import AdminUsersPage from './AdminUsersPage';
import SplitView from '../components/SplitView';
import { SERVICES } from '../data/services';

const TABS = [
  { id: 'users', label: 'Users' },
  { id: 'services', label: 'Services' },
];

const STATUS_LABEL = {
  online: 'online',
  basic: 'basic',
  building: 'building',
  designing: 'designing',
  planned: 'planned',
};

const Subnav = ({ active, onChange }) => (
  <div style={{ display: 'flex', gap: 18, padding: '0 4px', marginBottom: 10 }}>
    {TABS.map((tab) => (
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

const ServiceList = ({ selectedKey, onSelect }) => (
  <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
    <div style={{ padding: '14px 16px', borderBottom: '0.5px solid var(--mv-border)' }}>
      <span style={{ color: 'var(--mv-text)', fontSize: 13, fontWeight: 500 }}>Services · admin</span>
    </div>
    <div style={{ overflowY: 'auto', flex: 1 }}>
      {SERVICES.map((service) => {
        const isSelected = service.key === selectedKey;
        return (
          <div
            key={service.key}
            onClick={() => onSelect(service.key)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 16px',
              borderBottom: '0.5px solid var(--mv-border)',
              cursor: 'pointer',
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: service.status === 'online' ? 'var(--mv-color-success)' : 'var(--mv-badge-bg)',
                flexShrink: 0,
              }}
            />
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  color: isSelected ? 'var(--mv-text)' : 'var(--mv-text-muted)',
                  fontSize: 13,
                  whiteSpace: 'nowrap',
                }}
              >
                {service.name}
              </div>
              <div style={{ color: 'var(--mv-badge-bg)', fontSize: 11, whiteSpace: 'nowrap' }}>
                {STATUS_LABEL[service.status]} · {service.tech}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

// Read-only for now — reads the same hardcoded SERVICES list the
// Dashboard uses (no services table exists yet, see SCHEMA.md).
// Activate/deactivate/edit-card-details from ARCHITECTURE.md's Dashboard
// UI notes are real future scope, not built here — buttons are visibly
// disabled rather than silently doing nothing.
const ServiceDetail = ({ service, onClose }) => (
  <>
    <span onClick={onClose} style={{ color: 'var(--mv-color-primary)', fontSize: 12, cursor: 'pointer' }}>
      ← Back
    </span>

    <p style={{ color: 'var(--mv-text)', fontSize: 15, fontWeight: 500, margin: '14px 0 4px' }}>{service.name}</p>
    <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: '0 0 18px' }}>
      {STATUS_LABEL[service.status]} · {service.tech}
    </p>

    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <button
        type="button"
        disabled
        title="Coming soon — no services table yet, see SCHEMA.md"
        style={{
          padding: '9px 0',
          background: 'var(--mv-bg)',
          border: '0.5px solid var(--mv-border)',
          color: 'var(--mv-badge-bg)',
          fontSize: 12,
          borderRadius: 8,
          cursor: 'not-allowed',
        }}
      >
        {service.status === 'online' ? 'Deactivate service' : 'Activate service'}
      </button>
      <button
        type="button"
        disabled
        title="Coming soon — no services table yet, see SCHEMA.md"
        style={{
          padding: '9px 0',
          background: 'var(--mv-bg)',
          border: '0.5px solid var(--mv-border)',
          color: 'var(--mv-badge-bg)',
          fontSize: 12,
          borderRadius: 8,
          cursor: 'not-allowed',
        }}
      >
        Edit card details
      </button>
    </div>
    <p style={{ color: 'var(--mv-badge-bg)', fontSize: 11, margin: '10px 0 0', lineHeight: 1.4 }}>
      Read-only for now — activate/deactivate and edit need a real services table (see ROADMAP.md 4.0.2/4.0.3
      notes and SCHEMA.md).
    </p>
  </>
);

// platform:admin-gated shell — Users (4.0.1, real data) and Services
// (read-only stub) subnav tabs. Mockup: platform_projects_hub_and_admin.html.
const AdminPage = () => {
  const [tab, setTab] = useState('users');
  const [selectedServiceKey, setSelectedServiceKey] = useState(null);

  const selectedService = SERVICES.find((s) => s.key === selectedServiceKey);

  return (
    <div style={{ margin: 'var(--mv-space-3)' }}>
      <Subnav
        active={tab}
        onChange={(next) => {
          setTab(next);
          setSelectedServiceKey(null);
        }}
      />
      {tab === 'users' ? (
        <AdminUsersPage />
      ) : (
        <SplitView
          open={Boolean(selectedService)}
          listPanel={<ServiceList selectedKey={selectedServiceKey} onSelect={setSelectedServiceKey} />}
          detailPanel={
            selectedService && (
              <ServiceDetail service={selectedService} onClose={() => setSelectedServiceKey(null)} />
            )
          }
        />
      )}
    </div>
  );
};

export default AdminPage;
