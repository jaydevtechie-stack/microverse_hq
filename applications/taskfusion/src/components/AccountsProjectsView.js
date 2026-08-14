import React, { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { IconBuilding, IconChevronDown, IconChevronRight } from '@tabler/icons-react';
import { authHeaders } from '../services/keycloak';
import SplitView from './SplitView';
import InlineTaskDetail from './InlineTaskDetail';
import { ActionButtonRow, OutlineDangerButton } from './ActionButtons';
import TaskStatusBadge from './TaskStatusBadge';
import TaskStatusFilter from './TaskStatusFilter';

const PROJECT_STATUS_STYLE = {
  active: { bg: 'var(--mv-color-success, #2f9e64)', labelKey: 'projectStatus.active' },
  dormant: { bg: 'var(--mv-text-muted)', labelKey: 'projectStatus.pendingApproval' },
  inactive: { bg: 'var(--mv-color-danger)', labelKey: 'projectStatus.inactive' },
};

const ProjectStatusBadge = ({ status }) => {
  const { t } = useTranslation('accounts');
  const style = PROJECT_STATUS_STYLE[status] || PROJECT_STATUS_STYLE.dormant;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 11,
        color: 'var(--mv-text-muted)',
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: style.bg }} />
      {t(style.labelKey)}
    </span>
  );
};

// Left panel — one accordion row per Account, expanding to that
// Account's Projects. `canCreateProject` shows a "+ New project" link
// under each Account's project list (customer view only — projects are
// customer-initiated, see project-routes.js's POST /projects).
// `canViewAccountDetail` (account-manager only) additionally selects
// the Account itself when its header row is clicked, alongside the
// expand/collapse toggle — AccountDetail then renders in the split
// view's right pane, same as clicking a Project already does.
const AccountAccordion = ({
  accounts,
  expanded,
  onToggle,
  selection,
  onSelectProject,
  onNewProject,
  canCreateProject,
  canViewAccountDetail,
  onSelectAccount,
}) => {
  const { t } = useTranslation('accounts');
  return (
  <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
    <div style={{ padding: '14px 16px', borderBottom: '0.5px solid var(--mv-border)' }}>
      <span style={{ color: 'var(--mv-text)', fontSize: 13, fontWeight: 500 }}>{t('header')}</span>
    </div>
    <div style={{ overflowY: 'auto', flex: 1 }}>
      {accounts.map((account) => {
        const isOpen = expanded.has(account.id);
        const isAccountSelected = selection?.type === 'account' && selection.id === account.id;
        return (
          <div key={account.id} style={{ borderBottom: '0.5px solid var(--mv-border)' }}>
            <div
              onClick={() => {
                onToggle(account.id);
                if (canViewAccountDetail) onSelectAccount(account.id);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '12px 16px',
                cursor: 'pointer',
                background: isAccountSelected ? 'var(--mv-bg)' : 'transparent',
              }}
            >
              {isOpen ? (
                <IconChevronDown size={14} color="var(--mv-text-muted)" />
              ) : (
                <IconChevronRight size={14} color="var(--mv-text-muted)" />
              )}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ color: 'var(--mv-text)', fontSize: 13 }}>{account.name}</div>
                <div style={{ color: 'var(--mv-badge-bg)', fontSize: 11, textTransform: 'capitalize' }}>
                  {account.type}
                </div>
              </div>
            </div>

            {isOpen && (
              <div style={{ paddingBottom: 8 }}>
                {account.projects.length === 0 && (
                  <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, padding: '0 16px 8px 38px' }}>
                    {t('noProjectsYet')}
                  </p>
                )}
                {account.projects.map((project) => {
                  const isSelected = selection?.type === 'project' && selection.id === project.id;
                  return (
                    <div
                      key={project.id}
                      onClick={() => onSelectProject(project.id, account.id)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                        padding: '8px 16px 8px 38px',
                        cursor: 'pointer',
                        background: isSelected ? 'var(--mv-bg)' : 'transparent',
                      }}
                    >
                      <span style={{ color: isSelected ? 'var(--mv-text)' : 'var(--mv-text-muted)', fontSize: 12 }}>
                        {project.name}
                      </span>
                      <ProjectStatusBadge status={project.status} />
                    </div>
                  );
                })}
                {canCreateProject && (
                  <div
                    onClick={() => onNewProject(account.id)}
                    style={{
                      padding: '8px 16px 4px 38px',
                      fontSize: 12,
                      color: 'var(--mv-color-primary)',
                      cursor: 'pointer',
                    }}
                  >
                    {t('newProjectLink')}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  </div>
  );
};

const infoBox = { background: 'var(--mv-bg)', border: '0.5px solid var(--mv-border)', borderRadius: 8, padding: '10px 12px' };

// Compact toolbar buttons for ProjectDetail's task mass-toggle (6.3.1) —
// too small a footprint to warrant ActionButtonRow's full-width flex:1
// buttons, which are sized for the Assign/Deactivate row above.
const smallOutlineButtonStyle = {
  padding: '4px 10px',
  background: 'transparent',
  border: '0.5px solid var(--mv-border)',
  color: 'var(--mv-text-muted)',
  fontSize: 11,
  borderRadius: 6,
};

// Task rows select a Task in place of this Project within the same
// split view (`onSelectTask`, 4.6/follow-up) — same TaskDetailContent
// GofeelerSplitView renders inline as a panel, but staying inside this
// view's own detail pane rather than navigating to the standalone
// /task/:id page, so "back" returns to the Project, not to a whole
// different route. `canManageProject` (4.7, account-manager only) adds
// the PM-assign picker and Deactivate action. PM candidates are
// fetched per-project rather than reusing account.pms from the
// accordion — they're the same set (the Account's own pm_accounts),
// but this component only has the flat accounts list in scope, not a
// per-account PM lookup, so a small dedicated fetch is simpler than
// threading that through.
const ProjectDetail = ({ project, canApprove, onApprove, approving, canManageProject, onAssignPm, onDeactivate, onBulkNoIndex, onSelectTask, onBack }) => {
  const { t } = useTranslation(['accounts', 'common']);
  const [pmCandidates, setPmCandidates] = useState(null);
  const [pmCandidatesError, setPmCandidatesError] = useState(null);
  const [pmPicked, setPmPicked] = useState('');
  const [assigningPm, setAssigningPm] = useState(false);
  const [assignPmError, setAssignPmError] = useState(null);
  const [deactivating, setDeactivating] = useState(false);
  const [deactivateError, setDeactivateError] = useState(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState(new Set());
  const [bulkWorking, setBulkWorking] = useState(false);
  const [bulkNoIndexError, setBulkNoIndexError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');

  // ProjectDetail doesn't remount between different Projects (no `key`
  // upstream) — reset the selection when the viewed Project itself
  // changes, so a stale selection from a previous Project's tasks can't
  // carry over.
  useEffect(() => {
    setSelectedTaskIds(new Set());
    setBulkNoIndexError(null);
    setStatusFilter('all');
  }, [project.id]);

  const filteredTasks =
    statusFilter === 'all' ? project.tasks : project.tasks.filter((task) => task.status === statusFilter);

  useEffect(() => {
    if (!canManageProject) return;
    setPmCandidates(null);
    setPmCandidatesError(null);
    fetch(`/api/projects/${project.id}/pm-candidates`, { headers: authHeaders() })
      .then((res) => {
        if (!res.ok) throw new Error(`task-service returned ${res.status}`);
        return res.json();
      })
      .then(setPmCandidates)
      .catch((err) => setPmCandidatesError(err.message));
  }, [canManageProject, project.id]);

  const handleAssignPm = async () => {
    setAssigningPm(true);
    setAssignPmError(null);
    try {
      await onAssignPm(pmPicked);
      setPmPicked('');
    } catch (err) {
      setAssignPmError(err.message);
    } finally {
      setAssigningPm(false);
    }
  };

  const handleDeactivate = async () => {
    setDeactivating(true);
    setDeactivateError(null);
    try {
      await onDeactivate();
    } catch (err) {
      setDeactivateError(err.message);
    } finally {
      setDeactivating(false);
    }
  };

  const toggleTaskSelected = (taskId) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedTaskIds((prev) =>
      prev.size === filteredTasks.length ? new Set() : new Set(filteredTasks.map((t) => t.id))
    );
  };

  const handleBulkNoIndex = async (noIndex) => {
    setBulkWorking(true);
    setBulkNoIndexError(null);
    try {
      await onBulkNoIndex(Array.from(selectedTaskIds), noIndex);
      setSelectedTaskIds(new Set());
    } catch (err) {
      setBulkNoIndexError(err.message);
    } finally {
      setBulkWorking(false);
    }
  };

  return (
  <>
    {onBack && (
      <span onClick={onBack} style={{ color: 'var(--mv-color-primary)', fontSize: 12, cursor: 'pointer', display: 'block', marginBottom: 14 }}>
        {t('common:back')}
      </span>
    )}
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 4px' }}>
      <p style={{ color: 'var(--mv-text)', fontSize: 15, fontWeight: 500, margin: 0 }}>{project.name}</p>
      <ProjectStatusBadge status={project.status} />
    </div>
    <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: '0 0 18px' }}>
      <Trans
        i18nKey="accounts:projectDetail.accountLabel"
        values={{ accountName: project.account_name }}
        components={{ 1: <span style={{ color: 'var(--mv-color-primary)' }} /> }}
      />
    </p>

    {canApprove && project.status === 'dormant' && (
      <button
        type="button"
        onClick={onApprove}
        disabled={approving}
        style={{
          marginBottom: 18,
          padding: '8px 14px',
          background: 'var(--mv-color-primary)',
          color: 'var(--mv-color-primary-contrast)',
          fontWeight: 500,
          fontSize: 12,
          border: 'none',
          borderRadius: 8,
          cursor: approving ? 'default' : 'pointer',
          opacity: approving ? 0.6 : 1,
        }}
      >
        {approving ? t('projectDetail.approving') : t('projectDetail.approveProject')}
      </button>
    )}

    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
      <div style={infoBox}>
        <p style={{ color: 'var(--mv-badge-bg)', fontSize: 11, margin: '0 0 4px' }}>{t('projectDetail.projectManagerLabel')}</p>
        <p style={{ color: 'var(--mv-text)', fontSize: 13, margin: 0 }}>
          {project.responsible_user_name || t('projectDetail.unassigned')}
        </p>
      </div>
      <div style={infoBox}>
        <p style={{ color: 'var(--mv-badge-bg)', fontSize: 11, margin: '0 0 4px' }}>{t('projectDetail.paymentTermsLabel')}</p>
        <p style={{ color: 'var(--mv-text)', fontSize: 13, margin: 0 }}>{project.payment_terms || '—'}</p>
      </div>
    </div>

    {canManageProject && (
      <>
        <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: '0 0 6px' }}>{t('projectDetail.assignPmLabel')}</p>
        {pmCandidatesError && (
          <p style={{ color: 'var(--mv-color-danger)', fontSize: 12, margin: '0 0 8px' }}>
            {t('projectDetail.pmCandidatesLoadError', { error: pmCandidatesError })}
          </p>
        )}
        {!pmCandidatesError && !pmCandidates && (
          <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: '0 0 8px' }}>{t('projectDetail.loadingPmCandidates')}</p>
        )}
        {pmCandidates && (
          <select value={pmPicked} onChange={(e) => setPmPicked(e.target.value)} style={fieldInputStyle}>
            <option value="">{t('projectDetail.choosePm')}</option>
            {pmCandidates.map((pm) => (
              <option key={pm.id} value={pm.id}>
                {pm.name}
              </option>
            ))}
          </select>
        )}

        {/* Side by side, 50/50, same row shape as ReviewerPanel's Approve/Reject */}
        <ActionButtonRow>
          {pmCandidates && (
            <button
              type="button"
              onClick={handleAssignPm}
              disabled={!pmPicked || assigningPm}
              style={{
                flex: 1,
                padding: '10px 0',
                background: pmPicked && !assigningPm ? 'var(--mv-color-primary)' : 'var(--mv-badge-bg)',
                color: pmPicked && !assigningPm ? 'var(--mv-color-primary-contrast)' : 'var(--mv-badge-text)',
                fontWeight: 500,
                fontSize: 13,
                border: 'none',
                borderRadius: 8,
                cursor: pmPicked && !assigningPm ? 'pointer' : 'not-allowed',
              }}
            >
              {assigningPm ? t('projectDetail.assigningPm') : t('projectDetail.assignPm')}
            </button>
          )}

          {project.status !== 'inactive' && (
            <OutlineDangerButton onClick={handleDeactivate} disabled={deactivating}>
              {deactivating ? t('projectDetail.deactivating') : t('projectDetail.deactivateProject')}
            </OutlineDangerButton>
          )}
        </ActionButtonRow>

        {assignPmError && (
          <p style={{ color: 'var(--mv-color-danger)', fontSize: 12, margin: '-14px 0 18px' }}>
            {t('projectDetail.assignPmError', { error: assignPmError })}
          </p>
        )}
        {deactivateError && (
          <p style={{ color: 'var(--mv-color-danger)', fontSize: 12, margin: '-14px 0 18px' }}>
            {t('projectDetail.deactivateError', { error: deactivateError })}
          </p>
        )}
      </>
    )}

    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 8px' }}>
      <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: 0 }}>{t('projectDetail.tasksLabel')}</p>
      {canManageProject && filteredTasks.length > 0 && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--mv-text-muted)', fontSize: 11, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={selectedTaskIds.size === filteredTasks.length}
            onChange={toggleSelectAll}
          />
          {t('projectDetail.selectAll')}
        </label>
      )}
    </div>
    {project.tasks.length === 0 && (
      <p style={{ color: 'var(--mv-badge-bg)', fontSize: 12 }}>{t('projectDetail.noTasksYet')}</p>
    )}
    {project.tasks.length > 0 && (
      <div style={{ margin: '0 0 12px' }}>
        <TaskStatusFilter active={statusFilter} onChange={setStatusFilter} />
      </div>
    )}
    {project.tasks.length > 0 && filteredTasks.length === 0 && (
      <p style={{ color: 'var(--mv-badge-bg)', fontSize: 12 }}>{t('projectDetail.noTasksFiltered')}</p>
    )}

    {/* Reconciling an existing task set with a changed Project-level
        no_index (6.3.1) — bulk apply/remove rather than editing tasks
        one by one. Both actions always shown together since a mixed-
        state selection may need either direction. */}
    {canManageProject && selectedTaskIds.size > 0 && (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 0 10px' }}>
        <span style={{ color: 'var(--mv-text-muted)', fontSize: 11 }}>
          {t('projectDetail.nSelected', { count: selectedTaskIds.size })}
        </span>
        <button
          type="button"
          onClick={() => handleBulkNoIndex(true)}
          disabled={bulkWorking}
          style={{ ...smallOutlineButtonStyle, cursor: bulkWorking ? 'default' : 'pointer' }}
        >
          {t('projectDetail.excludeFromSearch')}
        </button>
        <button
          type="button"
          onClick={() => handleBulkNoIndex(false)}
          disabled={bulkWorking}
          style={{ ...smallOutlineButtonStyle, cursor: bulkWorking ? 'default' : 'pointer' }}
        >
          {t('projectDetail.includeInSearch')}
        </button>
      </div>
    )}
    {bulkNoIndexError && (
      <p style={{ color: 'var(--mv-color-danger)', fontSize: 12, margin: '-4px 0 10px' }}>
        {t('projectDetail.bulkNoIndexError', { error: bulkNoIndexError })}
      </p>
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
        {canManageProject && (
          <input
            type="checkbox"
            checked={selectedTaskIds.has(task.id)}
            onClick={(e) => e.stopPropagation()}
            onChange={() => toggleTaskSelected(task.id)}
            style={{ flexShrink: 0 }}
          />
        )}
        <span style={{ flexShrink: 0 }}>
          <TaskStatusBadge status={task.status} />
        </span>
        <span style={{ color: 'var(--mv-text)', fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {task.title}
        </span>
        {task.no_index && (
          <span style={{ color: 'var(--mv-color-danger)', fontSize: 10, whiteSpace: 'nowrap' }}>
            {t('projectDetail.excludedBadge')}
          </span>
        )}
        <span style={{ color: 'var(--mv-text-muted)', fontSize: 11, whiteSpace: 'nowrap' }}>
          {task.due_date ? new Date(task.due_date).toLocaleDateString() : t('projectDetail.noDueDate')}
        </span>
      </div>
    ))}
  </>
  );
};

// Account-manager-only (`canViewAccountDetail`) — shows when an
// Account's own header row is clicked, alongside the accordion
// expanding to its Projects (AccountAccordion does both from the same
// click). Fetches GET /accounts/:id fresh rather than reusing the
// flat `accounts` list's row, since that route additionally returns
// `pms`/`customers`/`engagement` the list response doesn't carry.
const AccountDetail = ({ account, onClose }) => {
  const { t } = useTranslation(['accounts', 'common']);
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
          {account.type === 'company' ? t('newAccountForm.typeCompany') : t('newAccountForm.typeIndividual')}
        </p>
      </div>
    </div>

    <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: '0 0 8px' }}>{t('accountDetail.assignedPmsLabel')}</p>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
      {account.pms.length === 0 && (
        <span style={{ color: 'var(--mv-badge-bg)', fontSize: 12 }}>{t('accountDetail.noPmsYet')}</span>
      )}
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

    <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: '0 0 8px' }}>{t('accountDetail.projectsLabel')}</p>
    {account.projects.length === 0 && (
      <p style={{ color: 'var(--mv-badge-bg)', fontSize: 12 }}>{t('noProjectsYet')}</p>
    )}
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

const fieldLabelStyle = { color: 'var(--mv-text-muted)', fontSize: 12, display: 'block', marginBottom: 6 };
const fieldInputStyle = {
  width: '100%',
  background: 'var(--mv-bg)',
  border: '0.5px solid var(--mv-border)',
  borderRadius: 8,
  padding: '9px 12px',
  color: 'var(--mv-text)',
  fontSize: 13,
  marginBottom: 14,
  boxSizing: 'border-box',
  fontFamily: 'inherit',
};

const NewProjectForm = ({ accountName, onCreate, onCancel }) => {
  const { t } = useTranslation(['accounts', 'common']);
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError(t('newProjectForm.nameRequired'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onCreate(name.trim());
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <>
      <p style={{ color: 'var(--mv-text)', fontSize: 15, fontWeight: 500, margin: '0 0 4px' }}>{t('newProjectForm.heading')}</p>
      <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: '0 0 18px' }}>
        <Trans
          i18nKey="accounts:newProjectForm.underAccount"
          values={{ accountName }}
          components={{ 1: <span style={{ color: 'var(--mv-color-primary)' }} /> }}
        />
      </p>

      <label style={fieldLabelStyle}>{t('newProjectForm.nameLabel')}</label>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t('newProjectForm.namePlaceholder')}
        style={fieldInputStyle}
      />
      {error && <p style={{ color: 'var(--mv-color-danger)', fontSize: 12, margin: '-8px 0 14px' }}>{error}</p>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          style={{
            padding: '9px 16px',
            background: 'var(--mv-color-primary)',
            color: 'var(--mv-color-primary-contrast)',
            fontWeight: 500,
            fontSize: 13,
            border: 'none',
            borderRadius: 8,
            cursor: submitting ? 'default' : 'pointer',
            opacity: submitting ? 0.6 : 1,
          }}
        >
          {submitting ? t('newProjectForm.submitting') : t('newProjectForm.submit')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          style={{
            padding: '9px 16px',
            background: 'transparent',
            color: 'var(--mv-text-muted)',
            fontWeight: 500,
            fontSize: 13,
            border: '0.5px solid var(--mv-border)',
            borderRadius: 8,
            cursor: submitting ? 'default' : 'pointer',
          }}
        >
          {t('common:cancel')}
        </button>
      </div>
    </>
  );
};

const NewAccountForm = ({ onCreate, onCancel }) => {
  const { t } = useTranslation(['accounts', 'common']);
  const [name, setName] = useState('');
  const [type, setType] = useState('company');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError(t('newAccountForm.nameRequired'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onCreate({ name: name.trim(), type });
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <>
      <p style={{ color: 'var(--mv-text)', fontSize: 15, fontWeight: 500, margin: '0 0 18px' }}>{t('newAccountForm.heading')}</p>

      <label style={fieldLabelStyle}>{t('newAccountForm.nameLabel')}</label>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t('newAccountForm.namePlaceholder')}
        style={fieldInputStyle}
      />

      <label style={fieldLabelStyle}>{t('newAccountForm.typeLabel')}</label>
      <select value={type} onChange={(e) => setType(e.target.value)} style={fieldInputStyle}>
        <option value="company">{t('newAccountForm.typeCompany')}</option>
        <option value="individual">{t('newAccountForm.typeIndividual')}</option>
      </select>
      {error && <p style={{ color: 'var(--mv-color-danger)', fontSize: 12, margin: '-8px 0 14px' }}>{error}</p>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          style={{
            padding: '9px 16px',
            background: 'var(--mv-color-primary)',
            color: 'var(--mv-color-primary-contrast)',
            fontWeight: 500,
            fontSize: 13,
            border: 'none',
            borderRadius: 8,
            cursor: submitting ? 'default' : 'pointer',
            opacity: submitting ? 0.6 : 1,
          }}
        >
          {submitting ? t('newAccountForm.submitting') : t('newAccountForm.submit')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          style={{
            padding: '9px 16px',
            background: 'transparent',
            color: 'var(--mv-text-muted)',
            fontWeight: 500,
            fontSize: 13,
            border: '0.5px solid var(--mv-border)',
            borderRadius: 8,
            cursor: submitting ? 'default' : 'pointer',
          }}
        >
          {t('common:cancel')}
        </button>
      </div>
    </>
  );
};

// Shared by AccountsViewPage (own Accounts, can propose new Projects) and
// AccountsManagePage (every Account, can create new Accounts, can approve
// dormant Projects) — same accordion + split-view shell, just which
// creation/approval affordances show differs by role. GET /api/accounts
// is already branched server-side per role (account-routes.js), so this
// component doesn't need to know which role it's rendering for beyond
// the capability flags passed in.
const AccountsProjectsView = ({
  canCreateProject = false,
  canCreateAccount = false,
  canApproveProject = false,
  canManageProject = false,
  canViewAccountDetail = false,
}) => {
  const { t } = useTranslation('accounts');
  const [accounts, setAccounts] = useState(null);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(new Set());
  const [selection, setSelection] = useState(null); // { type: 'project', id } | { type: 'task', id, projectId } | { type: 'newProject', accountId } | { type: 'newAccount' }
  const [detail, setDetail] = useState(null);
  const [approving, setApproving] = useState(false);

  const refetchAccounts = () =>
    fetch('/api/accounts', { headers: authHeaders() })
      .then((res) => {
        if (!res.ok) throw new Error(`task-service returned ${res.status}`);
        return res.json();
      })
      .then(setAccounts)
      .catch((err) => setError(err.message));

  useEffect(() => {
    refetchAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selection?.type !== 'project' && selection?.type !== 'account') return;
    // Guard against a stale response landing after a newer one — e.g.
    // clicking an Account (which now also fetches, canViewAccountDetail)
    // and then quickly clicking one of its Projects before that first
    // fetch resolves. Without this, the late account-shaped response
    // could overwrite the already-loaded project `detail`, and
    // ProjectDetail would crash on `project.tasks` being undefined.
    let cancelled = false;
    setDetail(null);
    const url = selection.type === 'project' ? `/api/projects/${selection.id}` : `/api/accounts/${selection.id}`;
    fetch(url, { headers: authHeaders() })
      .then((res) => {
        if (!res.ok) throw new Error(`task-service returned ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [selection]);

  const toggleAccount = (accountId) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(accountId)) next.delete(accountId);
      else next.add(accountId);
      return next;
    });
  };

  const handleCreateProject = async (accountId, name) => {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ accountId, name }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.message || `task-service returned ${res.status}`);
    await refetchAccounts();
    setSelection({ type: 'project', id: body.id });
  };

  const handleCreateAccount = async ({ name, type }) => {
    const res = await fetch('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ name, type }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.message || `task-service returned ${res.status}`);
    await refetchAccounts();
    setExpanded((prev) => new Set(prev).add(body.id));
    setSelection(null);
  };

  const handleApprove = async () => {
    if (selection?.type !== 'project') return;
    setApproving(true);
    try {
      const res = await fetch(`/api/projects/${selection.id}/approve`, {
        method: 'PATCH',
        headers: authHeaders(),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || `task-service returned ${res.status}`);
      setDetail(body);
      await refetchAccounts();
    } catch (err) {
      setError(err.message);
    } finally {
      setApproving(false);
    }
  };

  // Both throw on failure rather than setting `error` themselves — the
  // caller is ProjectDetail's own handleAssignPm/handleDeactivate,
  // which display the error inline next to the action that failed
  // (same "throw, let the local handler catch and show it" contract
  // AnalystPicker's onConfirm prop uses), not this view's page-level
  // error state.
  const handleAssignPm = async (pmId) => {
    if (selection?.type !== 'project') return;
    const res = await fetch(`/api/projects/${selection.id}/pm`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ pmId }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.message || `task-service returned ${res.status}`);
    setDetail(body);
    await refetchAccounts();
  };

  const handleDeactivate = async () => {
    if (selection?.type !== 'project') return;
    const res = await fetch(`/api/projects/${selection.id}/deactivate`, {
      method: 'PATCH',
      headers: authHeaders(),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.message || `task-service returned ${res.status}`);
    setDetail(body);
    await refetchAccounts();
  };

  // Bringing an existing task set in line with a changed project
  // no_index flag (6.3.1) — no bulk endpoint, just N individual
  // PATCH /tasks/:id/no-index calls (task-service's existing 6.3
  // route) run in parallel, dev-scale task-list sizes don't warrant a
  // dedicated bulk route. Merges each call's own returned task row into
  // detail.tasks locally rather than a full refetch — same "throw, let
  // the local handler catch and show it" contract as
  // handleAssignPm/handleDeactivate above.
  const handleBulkNoIndex = async (taskIds, noIndex) => {
    if (selection?.type !== 'project') return;
    const updated = await Promise.all(
      taskIds.map((id) =>
        fetch(`/api/tasks/${id}/no-index`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ noIndex }),
        }).then(async (res) => {
          const body = await res.json();
          if (!res.ok) throw new Error(body.message || `task-service returned ${res.status}`);
          return body;
        })
      )
    );
    setDetail((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => updated.find((u) => u.id === t.id) || t),
    }));
  };

  if (error) {
    return <p style={{ color: 'var(--mv-color-danger)', fontSize: 13, margin: 'var(--mv-space-3)' }}>{t('loadError', { error })}</p>;
  }
  if (!accounts) {
    return <p style={{ color: 'var(--mv-text-muted)', fontSize: 13, margin: 'var(--mv-space-3)' }}>{t('loading')}</p>;
  }

  return (
    <div style={{ margin: 'var(--mv-space-3)' }}>
      {canCreateAccount && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
          <button
            type="button"
            onClick={() => setSelection({ type: 'newAccount' })}
            style={{
              padding: '8px 14px',
              background: 'var(--mv-color-primary)',
              color: 'var(--mv-color-primary-contrast)',
              fontWeight: 500,
              fontSize: 12,
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            {t('newAccountLink')}
          </button>
        </div>
      )}

      <SplitView
        open={Boolean(selection)}
        listPanel={
          <AccountAccordion
            accounts={accounts}
            expanded={expanded}
            onToggle={toggleAccount}
            selection={selection}
            onSelectProject={(id, accountId) => setSelection({ type: 'project', id, accountId })}
            onNewProject={(accountId) => setSelection({ type: 'newProject', accountId })}
            canCreateProject={canCreateProject}
            canViewAccountDetail={canViewAccountDetail}
            onSelectAccount={(id) => setSelection({ type: 'account', id })}
          />
        }
        detailPanel={(() => {
          if (!selection) return null;
          if (selection.type === 'newAccount') {
            return <NewAccountForm onCreate={handleCreateAccount} onCancel={() => setSelection(null)} />;
          }
          if (selection.type === 'newProject') {
            const account = accounts.find((a) => a.id === selection.accountId);
            return (
              <NewProjectForm
                accountName={account?.name}
                onCreate={(name) => handleCreateProject(selection.accountId, name)}
                onCancel={() => setSelection(null)}
              />
            );
          }
          if (selection.type === 'project') {
            return (
              detail && (
                <ProjectDetail
                  project={detail}
                  canApprove={canApproveProject}
                  onApprove={handleApprove}
                  approving={approving}
                  canManageProject={canManageProject}
                  onAssignPm={handleAssignPm}
                  onDeactivate={handleDeactivate}
                  onBulkNoIndex={handleBulkNoIndex}
                  onSelectTask={(taskId) =>
                    setSelection({ type: 'task', id: taskId, projectId: selection.id, accountId: selection.accountId })
                  }
                  onBack={
                    canViewAccountDetail && selection.accountId
                      ? () => setSelection({ type: 'account', id: selection.accountId })
                      : undefined
                  }
                />
              )
            );
          }
          if (selection.type === 'task') {
            return (
              <InlineTaskDetail
                taskId={selection.id}
                onBack={() => setSelection({ type: 'project', id: selection.projectId, accountId: selection.accountId })}
              />
            );
          }
          if (selection.type === 'account') {
            return detail && <AccountDetail account={detail} onClose={() => setSelection(null)} />;
          }
          return null;
        })()}
      />
    </div>
  );
};

export default AccountsProjectsView;
