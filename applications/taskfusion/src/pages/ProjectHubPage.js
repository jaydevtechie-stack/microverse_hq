import React, { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import SplitView from '../components/SplitView';
import InlineTaskDetail from '../components/InlineTaskDetail';
import { authHeaders } from '../services/keycloak';
import TaskStatusBadge from '../components/TaskStatusBadge';
import TaskStatusFilter from '../components/TaskStatusFilter';
import usePageMeta from '../hooks/usePageMeta';

const ItemList = ({ items, error, selectedId, onSelect }) => {
  const { t } = useTranslation('projectHub');
  return (
  <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
    <div style={{ padding: '14px 16px', borderBottom: '0.5px solid var(--mv-border)' }}>
      <span style={{ color: 'var(--mv-text)', fontSize: 13, fontWeight: 500 }}>
        {t('headerProjects')}
      </span>
    </div>
    <div style={{ overflowY: 'auto', flex: 1 }}>
      {error && (
        <p style={{ color: 'var(--mv-color-danger)', fontSize: 13, padding: '12px 16px' }}>
          {t('loadError', { error })}
        </p>
      )}
      {!error && !items && (
        <p style={{ color: 'var(--mv-text-muted)', fontSize: 13, padding: '12px 16px' }}>{t('loading')}</p>
      )}
      {items?.length === 0 && (
        <p style={{ color: 'var(--mv-text-muted)', fontSize: 13, padding: '12px 16px' }}>
          {t('empty')}
        </p>
      )}
      {items?.map((item) => {
        const isSelected = item.id === selectedId;
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
              <div style={{ color: 'var(--mv-badge-bg)', fontSize: 11, whiteSpace: 'nowrap' }}>{item.account_name}</div>
            </div>
          </div>
        );
      })}
    </div>
  </div>
  );
};

const infoBox = { background: 'var(--mv-bg)', border: '0.5px solid var(--mv-border)', borderRadius: 8, padding: '10px 12px' };

const ProjectDetail = ({ project, onClose, onSelectTask }) => {
  const { t } = useTranslation(['projectHub', 'accounts', 'common']);
  const [statusFilter, setStatusFilter] = useState('all');

  // ProjectDetail doesn't remount between different Projects (no `key`
  // upstream) — reset the filter when the viewed Project changes, so a
  // stale filter from a previous Project can't hide its tasks.
  useEffect(() => {
    setStatusFilter('all');
  }, [project.id]);

  const filteredTasks =
    statusFilter === 'all' ? project.tasks : project.tasks.filter((task) => task.status === statusFilter);

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
    {project.tasks.length > 0 && (
      <div style={{ margin: '0 0 12px' }}>
        <TaskStatusFilter active={statusFilter} onChange={setStatusFilter} />
      </div>
    )}
    {project.tasks.length > 0 && filteredTasks.length === 0 && (
      <p style={{ color: 'var(--mv-badge-bg)', fontSize: 12 }}>{t('noTasksFiltered')}</p>
    )}
    {filteredTasks.map((task) => (
      <div
        key={task.id}
        onClick={() => onSelectTask(task.id)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 4px',
          borderBottom: '0.5px solid var(--mv-border)',
          cursor: 'pointer',
        }}
      >
        <span style={{ flexShrink: 0 }}>
          <TaskStatusBadge status={task.status} />
        </span>
        <span style={{ color: 'var(--mv-text)', fontSize: 12 }}>{task.title}</span>
      </div>
    ))}
  </>
  );
};

// PM-facing project list, scoped server-side to the caller's own
// pm_accounts ownership (page-level gate is broader: platform:project-
// manager + any service scope — see ARCHITECTURE.md's Roles and
// permissions). Used to also have an Accounts tab (same data GET
// /accounts already returns, ownership-scoped the same way), dropped
// as redundant — every Project row already carries its own
// account_name, and a PM's Accounts view had nothing an AM-style
// contacts/engagement page would add for this role. Mockup:
// platform_projects_hub_and_admin.html.
const ProjectHubPage = () => {
  usePageMeta({ title: 'Microverse - Projects' });
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  // Set when a Project's task row is clicked — swaps the detail panel
  // to InlineTaskDetail in place of ProjectDetail, rather than
  // navigating to the standalone /task/:id page. Reset alongside
  // selectedId/detail whenever the selection changes.
  const [taskId, setTaskId] = useState(null);

  useEffect(() => {
    fetch('/api/projects', { headers: authHeaders() })
      .then((res) => {
        if (!res.ok) throw new Error(`task-service returned ${res.status}`);
        return res.json();
      })
      .then(setItems)
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setDetail(null);
    setTaskId(null);
    fetch(`/api/projects/${selectedId}`, { headers: authHeaders() })
      .then((res) => {
        if (!res.ok) throw new Error(`task-service returned ${res.status}`);
        return res.json();
      })
      .then(setDetail)
      .catch((err) => setError(err.message));
  }, [selectedId]);

  return (
    <div style={{ margin: 'var(--mv-space-3)' }}>
      <SplitView
        open={Boolean(selectedId)}
        listPanel={<ItemList items={items} error={error} selectedId={selectedId} onSelect={setSelectedId} />}
        detailPanel={
          detail &&
          (taskId ? (
            <InlineTaskDetail taskId={taskId} onBack={() => setTaskId(null)} />
          ) : (
            <ProjectDetail project={detail} onClose={() => setSelectedId(null)} onSelectTask={setTaskId} />
          ))
        }
      />
    </div>
  );
};

export default ProjectHubPage;
