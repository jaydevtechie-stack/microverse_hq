import React, { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { IconBuilding } from '@tabler/icons-react';
import SplitView from '../components/SplitView';
import { authHeaders } from '../services/keycloak';
import { STATUS_STYLE } from '../components/TaskStatusBadge';
import usePageMeta from '../hooks/usePageMeta';

const TAB_IDS = ['projects', 'accounts'];

const Subnav = ({ active, onChange }) => {
  const { t } = useTranslation('projectHub');
  return (
  <div style={{ display: 'flex', gap: 18, padding: '0 4px', marginBottom: 10 }}>
    {TAB_IDS.map((tabId) => (
      <span
        key={tabId}
        onClick={() => onChange(tabId)}
        style={{
          fontSize: 13,
          cursor: 'pointer',
          paddingBottom: 4,
          color: active === tabId ? 'var(--mv-color-primary)' : 'var(--mv-text-muted)',
          borderBottom: active === tabId ? '2px solid var(--mv-color-primary)' : '2px solid transparent',
        }}
      >
        {t(`tabs.${tabId}`)}
      </span>
    ))}
  </div>
  );
};

const ItemList = ({ tab, items, error, selectedId, onSelect }) => {
  const { t } = useTranslation(['projectHub', 'accounts']);
  return (
  <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
    <div style={{ padding: '14px 16px', borderBottom: '0.5px solid var(--mv-border)' }}>
      <span style={{ color: 'var(--mv-text)', fontSize: 13, fontWeight: 500 }}>
        {tab === 'projects' ? t('headerProjects') : t('headerAccounts')}
      </span>
    </div>
    <div style={{ overflowY: 'auto', flex: 1 }}>
      {error && (
        <p style={{ color: 'var(--mv-color-danger)', fontSize: 13, padding: '12px 16px' }}>
          {t('loadError', { tab, error })}
        </p>
      )}
      {!error && !items && (
        <p style={{ color: 'var(--mv-text-muted)', fontSize: 13, padding: '12px 16px' }}>{t('loading')}</p>
      )}
      {items?.length === 0 && (
        <p style={{ color: 'var(--mv-text-muted)', fontSize: 13, padding: '12px 16px' }}>
          {t('empty', { tab })}
        </p>
      )}
      {items?.map((item) => {
        const isSelected = item.id === selectedId;
        const sub =
          tab === 'projects'
            ? item.account_name
            : item.type === 'company'
              ? t('accounts:newAccountForm.typeCompany')
              : t('accounts:newAccountForm.typeIndividual');
        return (
          <div
            key={item.id}
            onClick={() => onSelect(item.id)}
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
                background: 'var(--mv-color-primary)',
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
                {item.name}
              </div>
              <div style={{ color: 'var(--mv-badge-bg)', fontSize: 11, whiteSpace: 'nowrap' }}>{sub}</div>
            </div>
          </div>
        );
      })}
    </div>
  </div>
  );
};

const infoBox = { background: 'var(--mv-bg)', border: '0.5px solid var(--mv-border)', borderRadius: 8, padding: '10px 12px' };

const ProjectDetail = ({ project, onClose }) => {
  const { t } = useTranslation(['projectHub', 'accounts', 'common']);
  return (
  <>
    <span onClick={onClose} style={{ color: 'var(--mv-color-primary)', fontSize: 12, cursor: 'pointer' }}>
      {t('common:back')}
    </span>

    <p style={{ color: 'var(--mv-text)', fontSize: 15, fontWeight: 500, margin: '14px 0 4px' }}>{project.name}</p>
    <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: '0 0 18px' }}>
      <Trans
        i18nKey="accounts:projectDetail.accountLabel"
        values={{ accountName: project.account_name }}
        components={{ 1: <span style={{ color: 'var(--mv-color-primary)' }} /> }}
      />
    </p>

    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
      <div style={infoBox}>
        <p style={{ color: 'var(--mv-badge-bg)', fontSize: 11, margin: '0 0 4px' }}>{t('accounts:projectDetail.projectManagerLabel')}</p>
        <p style={{ color: 'var(--mv-text)', fontSize: 13, margin: 0 }}>
          {project.responsible_user_name || t('unassignedNotLoggedIn')}
        </p>
      </div>
      <div style={infoBox}>
        <p style={{ color: 'var(--mv-badge-bg)', fontSize: 11, margin: '0 0 4px' }}>{t('accounts:projectDetail.paymentTermsLabel')}</p>
        <p style={{ color: 'var(--mv-text)', fontSize: 13, margin: 0 }}>{project.payment_terms || '—'}</p>
      </div>
    </div>

    <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: '0 0 8px' }}>{t('ordersTasksLabel')}</p>
    {project.tasks.length === 0 && (
      <p style={{ color: 'var(--mv-badge-bg)', fontSize: 12 }}>
        {t('noTasksVisible')}
      </p>
    )}
    {project.tasks.map((task) => (
      <div
        key={task.id}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 4px',
          borderBottom: '0.5px solid var(--mv-border)',
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: (STATUS_STYLE[task.status] || STATUS_STYLE.unassigned).bg,
            flexShrink: 0,
          }}
        />
        <span style={{ color: 'var(--mv-text)', fontSize: 12 }}>
          #{task.id.slice(0, 8)} · {task.title}
        </span>
      </div>
    ))}
  </>
  );
};

const AccountDetail = ({ account, onClose }) => {
  const { t } = useTranslation(['projectHub', 'accounts', 'common']);
  return (
  <>
    <span onClick={onClose} style={{ color: 'var(--mv-color-primary)', fontSize: 12, cursor: 'pointer' }}>
      {t('common:back')}
    </span>

    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '14px 0 18px' }}>
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: 'var(--mv-color-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <IconBuilding size={18} color="var(--mv-color-primary-contrast)" />
      </div>
      <div>
        <p style={{ color: 'var(--mv-text)', fontSize: 15, fontWeight: 500, margin: 0 }}>{account.name}</p>
        <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: '2px 0 0' }}>
          {account.type === 'company' ? t('accounts:newAccountForm.typeCompany') : t('accounts:newAccountForm.typeIndividual')}
        </p>
      </div>
    </div>

    <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: '0 0 8px' }}>{t('assignedPmsLabel')}</p>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
      {account.pms.map((pm) => (
        <span
          key={pm.id}
          style={{
            padding: '4px 10px',
            fontSize: 11,
            borderRadius: 12,
            background: 'color-mix(in srgb, var(--mv-color-primary) 15%, transparent)',
            color: 'var(--mv-color-primary)',
          }}
        >
          {pm.name}
        </span>
      ))}
    </div>

    <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: '0 0 8px' }}>{t('tabs.projects')}</p>
    {account.projects.map((project) => (
      <div
        key={project.id}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 4px',
          borderBottom: '0.5px solid var(--mv-border)',
        }}
      >
        <span style={{ color: 'var(--mv-text)', fontSize: 12, flex: 1 }}>{project.name}</span>
        <span style={{ color: 'var(--mv-text-muted)', fontSize: 11 }}>{project.payment_terms || '—'}</span>
      </div>
    ))}
  </>
  );
};

// PM-facing hub — Projects/Accounts tabs, both scoped server-side to
// the caller's own pm_accounts ownership (page-level gate is broader:
// platform:project-manager + any service scope — see ARCHITECTURE.md's
// Roles and permissions). Mockup: platform_projects_hub_and_admin.html.
const ProjectHubPage = () => {
  usePageMeta({ title: 'Microverse - Projects' });
  const [tab, setTab] = useState('projects');
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    setItems(null);
    setError(null);
    setSelectedId(null);
    setDetail(null);
    fetch(`/api/${tab}`, { headers: authHeaders() })
      .then((res) => {
        if (!res.ok) throw new Error(`task-service returned ${res.status}`);
        return res.json();
      })
      .then(setItems)
      .catch((err) => setError(err.message));
  }, [tab]);

  useEffect(() => {
    if (!selectedId) return;
    setDetail(null);
    fetch(`/api/${tab}/${selectedId}`, { headers: authHeaders() })
      .then((res) => {
        if (!res.ok) throw new Error(`task-service returned ${res.status}`);
        return res.json();
      })
      .then(setDetail)
      .catch((err) => setError(err.message));
  }, [tab, selectedId]);

  const changeTab = (nextTab) => {
    setTab(nextTab);
  };

  return (
    <div style={{ margin: 'var(--mv-space-3)' }}>
      <Subnav active={tab} onChange={changeTab} />
      <SplitView
        open={Boolean(selectedId)}
        listPanel={<ItemList tab={tab} items={items} error={error} selectedId={selectedId} onSelect={setSelectedId} />}
        detailPanel={
          detail &&
          (tab === 'projects' ? (
            <ProjectDetail project={detail} onClose={() => setSelectedId(null)} />
          ) : (
            <AccountDetail account={detail} onClose={() => setSelectedId(null)} />
          ))
        }
      />
    </div>
  );
};

export default ProjectHubPage;
