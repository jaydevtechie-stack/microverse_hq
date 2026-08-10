import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AdminUsersPage from './AdminUsersPage';
import PlaceholderPage from '../components/PlaceholderPage';
import Subnav from '../components/Subnav';
import SplitView from '../components/SplitView';
import { SERVICES } from '../data/services';
import usePageMeta from '../hooks/usePageMeta';

const TAB_IDS = ['users', 'services', 'settings', 'audit-log'];

const ServiceList = ({ selectedKey, onSelect }) => {
  const { t } = useTranslation('admin');
  return (
  <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
    <div style={{ padding: '14px 16px', borderBottom: '0.5px solid var(--mv-border)' }}>
      <span style={{ color: 'var(--mv-text)', fontSize: 13, fontWeight: 500 }}>{t('services.headerTitle')}</span>
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
                {t(`status.${service.status}`)} · {service.tech}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  </div>
  );
};

// Read-only for now — reads the same hardcoded SERVICES list the
// Dashboard uses (no services table exists yet, see SCHEMA.md).
// Activate/deactivate/edit-card-details from ARCHITECTURE.md's Dashboard
// UI notes are real future scope, not built here — buttons are visibly
// disabled rather than silently doing nothing.
const ServiceDetail = ({ service, onClose }) => {
  const { t } = useTranslation('admin');
  return (
  <>
    <span onClick={onClose} style={{ color: 'var(--mv-color-primary)', fontSize: 12, cursor: 'pointer' }}>
      {t('common:back')}
    </span>

    <p style={{ color: 'var(--mv-text)', fontSize: 15, fontWeight: 500, margin: '14px 0 4px' }}>{service.name}</p>
    <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: '0 0 18px' }}>
      {t(`status.${service.status}`)} · {service.tech}
    </p>

    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <button
        type="button"
        disabled
        title={t('services.comingSoonTooltip')}
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
        {service.status === 'online' ? t('services.deactivateService') : t('services.activateService')}
      </button>
      <button
        type="button"
        disabled
        title={t('services.comingSoonTooltip')}
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
        {t('services.editCardDetails')}
      </button>
    </div>
    <p style={{ color: 'var(--mv-badge-bg)', fontSize: 11, margin: '10px 0 0', lineHeight: 1.4 }}>
      {t('services.readOnlyNote')}
    </p>
  </>
  );
};

// platform:admin-gated shell — Users (4.0.1, real data) and Services
// (read-only stub) subnav tabs, plus 4.3's Settings/Audit log stubs.
// Mockup: platform_projects_hub_and_admin.html — Admin is a plain
// top-nav link (Navbar.js), this in-page Subnav is the actual
// sub-level nav, not a navbar dropdown. Tab is URL-driven (route is
// /admin/:tab) rather than local state, so each tab is a real,
// bookmarkable route.
const AdminPage = () => {
  const { t } = useTranslation('admin');
  usePageMeta({ title: 'Microverse - Admin' });
  const { tab } = useParams();
  const navigate = useNavigate();
  const [selectedServiceKey, setSelectedServiceKey] = useState(null);

  const selectedService = SERVICES.find((s) => s.key === selectedServiceKey);

  const tabs = TAB_IDS.map((id) => ({ id, label: t(`tabs.${id === 'audit-log' ? 'auditLog' : id}`) }));

  return (
    <div style={{ margin: 'var(--mv-space-3)' }}>
      <Subnav
        tabs={tabs}
        active={tab}
        onChange={(next) => {
          setSelectedServiceKey(null);
          navigate(`/admin/${next}`);
        }}
      />
      {tab === 'users' && <AdminUsersPage />}
      {tab === 'services' && (
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
      {tab === 'settings' && (
        <PlaceholderPage title={t('settingsPlaceholder.title')} note={t('settingsPlaceholder.note')} />
      )}
      {tab === 'audit-log' && (
        <PlaceholderPage title={t('auditLogPlaceholder.title')} note={t('auditLogPlaceholder.note')} />
      )}
    </div>
  );
};

export default AdminPage;
