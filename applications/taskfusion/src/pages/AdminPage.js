import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AdminUsersPage from './AdminUsersPage';
import PlaceholderPage from '../components/PlaceholderPage';
import Subnav from '../components/Subnav';
import SplitView from '../components/SplitView';
import ServiceForm from '../components/ServiceForm';
import useServices from '../hooks/useServices';
import usePageMeta from '../hooks/usePageMeta';
import { authHeaders } from '../services/keycloak';

const TAB_IDS = ['users', 'services', 'settings', 'audit-log'];

const ServiceList = ({ services, selectedKey, onSelect, onAdd }) => {
  const { t } = useTranslation('admin');
  return (
  <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
    <div
      style={{
        padding: '14px 16px',
        borderBottom: '0.5px solid var(--mv-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <span style={{ color: 'var(--mv-text)', fontSize: 13, fontWeight: 500 }}>{t('services.headerTitle')}</span>
      <span onClick={onAdd} style={{ color: 'var(--mv-color-primary)', fontSize: 12, cursor: 'pointer' }}>
        {t('services.addService')}
      </span>
    </div>
    <div style={{ overflowY: 'auto', flex: 1 }}>
      {services.map((service) => {
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

// Real add/edit + activate/deactivate against the `services` table
// (see business-services/task-service/routes/service-routes.js) —
// replaces the previously-disabled stub buttons.
const ServiceDetail = ({ service, onClose, onEdit, onToggleActive, toggling }) => {
  const { t } = useTranslation('admin');
  return (
  <>
    <span onClick={onClose} style={{ color: 'var(--mv-color-primary)', fontSize: 12, cursor: 'pointer' }}>
      {t('common:back')}
    </span>

    <p style={{ color: 'var(--mv-text)', fontSize: 15, fontWeight: 500, margin: '14px 0 4px' }}>{service.name}</p>
    <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: '0 0 6px' }}>
      {t(`status.${service.status}`)} · {service.tech}
    </p>
    {service.description && (
      <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: '0 0 18px', lineHeight: 1.5 }}>
        {service.description}
      </p>
    )}

    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <button
        type="button"
        onClick={onToggleActive}
        disabled={toggling}
        style={{
          padding: '9px 0',
          background: 'var(--mv-bg)',
          border: '0.5px solid var(--mv-border)',
          color: 'var(--mv-text)',
          fontSize: 12,
          borderRadius: 8,
          cursor: toggling ? 'default' : 'pointer',
          opacity: toggling ? 0.6 : 1,
        }}
      >
        {service.status === 'online' ? t('services.deactivateService') : t('services.activateService')}
      </button>
      <button
        type="button"
        onClick={onEdit}
        style={{
          padding: '9px 0',
          background: 'var(--mv-bg)',
          border: '0.5px solid var(--mv-border)',
          color: 'var(--mv-text)',
          fontSize: 12,
          borderRadius: 8,
          cursor: 'pointer',
        }}
      >
        {t('services.editCardDetails')}
      </button>
    </div>
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
  // null | 'add' | 'edit' — which form (if any) the detail panel shows,
  // layered over "just viewing the selected service."
  const [formMode, setFormMode] = useState(null);
  const [toggling, setToggling] = useState(false);
  const { services, refetch } = useServices();

  const selectedService = services.find((s) => s.key === selectedServiceKey);

  const closeDetail = () => {
    setSelectedServiceKey(null);
    setFormMode(null);
  };

  const handleSaved = (saved) => {
    setFormMode(null);
    setSelectedServiceKey(saved.key);
    refetch();
  };

  // No stored "previous status" to restore, so deactivate lands on
  // 'building' (mid-development, temporarily pulled) rather than
  // guessing which pre-online status it should return to.
  const handleToggleActive = async () => {
    setToggling(true);
    try {
      const res = await fetch(`/api/services/${selectedService.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ status: selectedService.status === 'online' ? 'building' : 'online' }),
      });
      if (res.ok) refetch();
    } finally {
      setToggling(false);
    }
  };

  const tabs = TAB_IDS.map((id) => ({ id, label: t(`tabs.${id === 'audit-log' ? 'auditLog' : id}`) }));

  return (
    <div style={{ margin: 'var(--mv-space-3)' }}>
      <Subnav
        tabs={tabs}
        active={tab}
        onChange={(next) => {
          closeDetail();
          navigate(`/admin/${next}`);
        }}
      />
      {tab === 'users' && <AdminUsersPage />}
      {tab === 'services' && (
        <SplitView
          open={Boolean(selectedService) || formMode === 'add'}
          listPanel={
            <ServiceList
              services={services}
              selectedKey={selectedServiceKey}
              onSelect={(key) => {
                setSelectedServiceKey(key);
                setFormMode(null);
              }}
              onAdd={() => {
                setSelectedServiceKey(null);
                setFormMode('add');
              }}
            />
          }
          detailPanel={
            formMode === 'add' ? (
              <ServiceForm onSaved={handleSaved} onCancel={closeDetail} />
            ) : formMode === 'edit' && selectedService ? (
              <ServiceForm service={selectedService} onSaved={handleSaved} onCancel={() => setFormMode(null)} />
            ) : (
              selectedService && (
                <ServiceDetail
                  service={selectedService}
                  onClose={closeDetail}
                  onEdit={() => setFormMode('edit')}
                  onToggleActive={handleToggleActive}
                  toggling={toggling}
                />
              )
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
