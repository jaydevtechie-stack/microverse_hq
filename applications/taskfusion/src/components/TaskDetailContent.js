import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconLink, IconMail, IconPencil, IconShare2 } from '@tabler/icons-react';
import { getKeycloak, authHeaders } from '../services/keycloak';
import TaskStatusBadge from './TaskStatusBadge';
import PmAssignPanel from './PmAssignPanel';
import PmBillPanel from './PmBillPanel';
import AnalysisPanel from './AnalysisPanel';
import ReviewerPanel from './ReviewerPanel';
import CustomerProgressPanel from './CustomerProgressPanel';
import TaskComments from './TaskComments';
import TaskFilesList from './TaskFilesList';
import EditOrderForm from './EditOrderForm';

const detailRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '8px 4px',
  borderBottom: '0.5px solid var(--mv-border)',
  fontSize: 13,
};

// Statuses during which a customer can still edit their own order —
// title/context/tags and files alike — must match task-service's own
// EDITABLE_STATUSES and asset-service's own EDIT_WINDOW_STATUSES.
// 5.7.2 briefly narrowed the file window to 'analyst' only, on the
// theory that a fresh 'unassigned' order already has whatever files
// the customer meant to attach via the separate pre-submit path — in
// practice that broke the common case of a customer fixing/adding a
// file to their own still-unassigned order, same as they can already
// fix title/context, so both windows are back to matching.
const EDITABLE_STATUSES = ['unassigned', 'analyst'];

// Which action panel (if any) to show is (viewer's platform role, task's
// current state) — see ARCHITECTURE.md's "UI pattern" note. A PM gets
// the assign picker while unassigned, and the bill button once done
// (both only for the PM who's the task's current owner); an
// analyst/reviewer only get their action while the task is actively
// assigned to them; a customer only gets the progress/invoice view
// once there's something to show.
function actionPanelFor({ task, isPM, isAnalyst, isReviewer, isCustomer, username, userId, onTaskUpdated }) {
  if (isPM && task.status === 'unassigned') {
    return <PmAssignPanel task={task} onAssigned={onTaskUpdated} />;
  }
  if (isPM && task.status === 'done' && task.owner === username) {
    return <PmBillPanel task={task} onBilled={onTaskUpdated} />;
  }
  if (isAnalyst && task.status === 'analyst' && task.assignee === username) {
    return <AnalysisPanel task={task} onTaskUpdated={onTaskUpdated} />;
  }
  // isPM included (4.5) — PM is the default reviewer for every task
  // (task-routes.js's PATCH /tasks/:id/move-to-review resolves the
  // account's PM as the initial assignee) unless handed off to a
  // dedicated platform:reviewer holder, so the PM needs to see this
  // panel too even without holding platform:reviewer themselves.
  if ((isReviewer || isPM) && task.status === 'reviewer' && task.assignee === username) {
    return <ReviewerPanel task={task} onTaskUpdated={onTaskUpdated} />;
  }
  // customer_id, not owner — owner only reliably equals the customer
  // during 'unassigned' (set at creation, models/task.js's create())
  // and 'paid' (docs/architecture/1.0/core.md's Task workflow table);
  // it's the PM during 'done' and blank during 'closed', which used to
  // hide this panel from the customer in exactly the states where they
  // most need to see it (results ready, waiting on payment).
  if (isCustomer && task.customer_id === userId && ['done', 'paid', 'closed'].includes(task.status)) {
    return <CustomerProgressPanel task={task} />;
  }
  return null;
}

// Copy link / email / native share, next to the status badge — from
// gofeeler_landing_page_split_view_resizable.html's mockup. Native
// Web Share (mobile/some desktop browsers) falls back to copy-link
// where it isn't available, rather than a dead button.
const ShareIconGroup = ({ task }) => {
  const { t } = useTranslation('gofeeler');
  const [copied, setCopied] = useState(false);
  const shareUrl = window.location.href;

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const shareViaEmail = () => {
    const subject = encodeURIComponent(`Gofeeler task — ${task.title}`);
    const body = encodeURIComponent(shareUrl);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const share = () => {
    if (navigator.share) {
      navigator.share({ title: task.title, url: shareUrl }).catch(() => {});
    } else {
      copyLink();
    }
  };

  const iconStyle = { color: 'var(--mv-text-muted)', cursor: 'pointer' };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {copied && <span style={{ color: 'var(--mv-color-primary)', fontSize: 11 }}>{t('taskDetail.share.copied')}</span>}
      <IconLink size={15} style={iconStyle} onClick={copyLink} title={t('taskDetail.share.copyLink')} />
      <IconMail size={15} style={iconStyle} onClick={shareViaEmail} title={t('taskDetail.share.shareViaEmail')} />
      <IconShare2 size={15} style={iconStyle} onClick={share} title={t('taskDetail.share.shareTitle')} />
    </div>
  );
};

// The task info + role-specific action panel — rendered inside
// GofeelerSplitView's embedded detail panel (the only place /task/:id
// renders now, on every host — see App.js).
const TaskDetailContent = ({ id }) => {
  const { t } = useTranslation('gofeeler');
  const keycloak = getKeycloak();
  const username = keycloak?.tokenParsed?.preferred_username;
  const userId = keycloak?.tokenParsed?.sub;
  const isPM = keycloak?.hasRealmRole('platform:project-manager');
  const isAnalyst = keycloak?.hasRealmRole('platform:analyst');
  const isReviewer = keycloak?.hasRealmRole('platform:reviewer');
  const isCustomer = keycloak?.hasRealmRole('platform:customer');
  const isAccountManager = keycloak?.hasRealmRole('platform:account-manager');

  const [task, setTask] = useState(null);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [togglingNoIndex, setTogglingNoIndex] = useState(false);

  useEffect(() => {
    setTask(null);
    setError(null);
    setEditing(false);
    fetch(`/api/tasks/${id}`, { headers: authHeaders() })
      .then((res) => {
        if (!res.ok) throw new Error(`task-service returned ${res.status}`);
        return res.json();
      })
      .then(setTask)
      .catch((err) => setError(err.message));
  }, [id]);

  const actionPanel = task
    ? actionPanelFor({ task, isPM, isAnalyst, isReviewer, isCustomer, username, userId, onTaskUpdated: setTask })
    : null;

  // canEdit gates the whole edit-mode affordance — pencil icon, title/
  // context/tags form, and (same window again) TaskFilesList's
  // add/remove — still unassigned or (5.7.1) reopened while an analyst
  // is working it. Enforced server-side too (task-service's
  // PUT /api/tasks/:id, asset-service's own status check) — this just
  // decides whether the affordance shows up.
  const isOwnOrder = Boolean(task) && isCustomer && task.customer_id === userId;
  const canEdit = isOwnOrder && EDITABLE_STATUSES.includes(task.status);
  // Who can flag this task out of search (6.3) — the owning
  // account-manager or the owning customer only, not PM/analyst/
  // reviewer/admin. A visibility/privacy control, not a content edit,
  // so it's not gated on EDITABLE_STATUSES the way canEdit is.
  const canToggleNoIndex = Boolean(task) && (isAccountManager || isOwnOrder);

  const toggleNoIndex = () => {
    setTogglingNoIndex(true);
    fetch(`/api/tasks/${task.id}/no-index`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ noIndex: !task.no_index }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`task-service returned ${res.status}`);
        return res.json();
      })
      .then((updated) => setTask((prev) => ({ ...prev, ...updated })))
      .catch((err) => setError(err.message))
      .finally(() => setTogglingNoIndex(false));
  };

  if (error) {
    return (
      <p style={{ color: 'var(--mv-color-danger)', fontSize: 13 }}>{t('taskDetail.loadError', { error })}</p>
    );
  }

  if (!task) {
    return <p style={{ color: 'var(--mv-text-muted)', fontSize: 13 }}>{t('taskDetail.loading')}</p>;
  }

  const projectManagerNames = task.project_managers?.length
    ? task.project_managers.map((pm) => pm.name).join(', ')
    : null;

  // Grouped card-grid, not a single compact line — matches the
  // design-system's updated task metadata area (Context/People/Timeline
  // groups of info-card label+value pairs, see design-system-orchid.html's
  // .md-meta/.md-meta-group/.info-card).
  const metaGroups = [
    {
      label: t('taskDetail.meta.groupContext'),
      fields: [
        // project_name (4.6) — findById now joins this in; can be null
        // (a task never attached to a Project), so only shown when set.
        ...(task.project_name ? [[t('taskDetail.meta.project'), task.project_name]] : []),
        [t('taskDetail.meta.service'), task.service],
      ],
    },
    {
      label: t('taskDetail.meta.groupPeople'),
      fields: [
        // assignee_name/owner_name (follow-up) — assignee/owner are
        // emails on the raw task row; findById now joins the matching
        // user's name by email, falling back to the raw email itself if
        // that lookup comes back empty (an email that isn't a synced
        // user), same as the pre-existing 'unassigned'/'—' fallbacks for
        // a null value.
        [t('taskDetail.meta.assignee'), task.assignee_name || task.assignee || t('taskDetail.meta.unassigned')],
        ...(projectManagerNames ? [[t('taskDetail.meta.projectManager'), projectManagerNames]] : []),
        // customer_name (4.6) — can be null (a dummy/seeded task with no
        // real customer_id), same '—' fallback as owner below.
        [t('taskDetail.meta.customer'), task.customer_name || '—'],
        [t('taskDetail.meta.owner'), task.owner_name || task.owner || '—'],
      ],
    },
    {
      label: t('taskDetail.meta.groupTimeline'),
      fields: [
        [t('taskDetail.meta.created'), new Date(task.created_at).toLocaleDateString()],
        [t('taskDetail.meta.due'), task.due_date ? new Date(task.due_date).toLocaleDateString() : '—'],
        ...(task.closed_at ? [[t('taskDetail.meta.closed'), new Date(task.closed_at).toLocaleDateString()]] : []),
      ],
    },
  ];

  const metaGroupLabelStyle = {
    fontSize: 10.5,
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    color: 'var(--mv-badge-bg)',
    margin: '0 0 8px',
  };

  return (
    <>
      <div style={{ margin: '14px 0 20px' }}>
        {metaGroups.map((group) => (
          <div key={group.label} style={{ marginBottom: 14 }}>
            <p style={metaGroupLabelStyle}>{group.label}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {group.fields.map(([label, value]) => (
                <div
                  key={label}
                  style={{
                    background: 'var(--mv-bg)',
                    border: '0.5px solid var(--mv-border)',
                    borderRadius: 8,
                    padding: '10px 12px',
                  }}
                >
                  <p
                    style={{
                      fontSize: 10.5,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: 'var(--mv-badge-bg)',
                      margin: '0 0 4px',
                    }}
                  >
                    {label}
                  </p>
                  <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--mv-text)', margin: 0 }}>{value}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {canToggleNoIndex && (
        <button
          type="button"
          onClick={toggleNoIndex}
          disabled={togglingNoIndex}
          style={{
            fontSize: 11,
            color: task.no_index ? 'var(--mv-color-danger)' : 'var(--mv-text-muted)',
            background: 'none',
            border: 'none',
            padding: 0,
            margin: '-6px 0 12px',
            cursor: togglingNoIndex ? 'default' : 'pointer',
            textDecoration: 'underline',
          }}
        >
          {togglingNoIndex
            ? t('taskDetail.noIndex.working')
            : task.no_index
              ? t('taskDetail.noIndex.excluded')
              : t('taskDetail.noIndex.exclude')}
        </button>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
          margin: '0 0 18px',
        }}
      >
        {editing ? (
          <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: 0 }}>{t('taskDetail.editingOrder')}</p>
        ) : (
          <p style={{ color: 'var(--mv-text)', fontSize: 16, fontWeight: 500, margin: 0 }}>
            {task.title}
          </p>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <TaskStatusBadge status={task.status} />
          {canEdit && !editing && (
            <IconPencil
              size={15}
              color="var(--mv-text-muted)"
              style={{ cursor: 'pointer' }}
              aria-label={t('taskDetail.editOrderAriaLabel')}
              onClick={() => setEditing(true)}
            />
          )}
          <ShareIconGroup task={task} />
        </div>
      </div>

      {editing ? (
        <div style={{ marginBottom: 18 }}>
          <EditOrderForm
            task={task}
            filesSlot={<TaskFilesList taskId={task.id} service={task.service} editable={canEdit} />}
            onSaved={(updated) => {
              setTask(updated);
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
          />
        </div>
      ) : (
        <>
          {task.tags?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '0 0 14px' }}>
              {task.tags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    background: 'var(--mv-badge-bg)',
                    color: 'var(--mv-badge-text)',
                    fontSize: 11,
                    padding: '2px 8px',
                    borderRadius: 999,
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          {task.context && (
            <p style={{ color: 'var(--mv-text)', fontSize: 13, margin: '0 0 14px' }}>{task.context}</p>
          )}

          <div
            style={{
              ...detailRowStyle,
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: 6,
              borderBottom: actionPanel ? '0.5px solid var(--mv-border)' : 'none',
            }}
          >
            <span style={{ color: 'var(--mv-text-muted)' }}>{t('taskDetail.filesLabel')}</span>
            {/* Read-only here — add/remove only shows up in edit mode
                (EditOrderForm's filesSlot above), not the plain view,
                even though the server-side window is the same. */}
            <TaskFilesList taskId={task.id} service={task.service} editable={false} />
          </div>
        </>
      )}

      {(isPM || isAnalyst || isReviewer) && (
        <div style={{ marginTop: 18 }}>
          <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: '0 0 8px' }}>{t('taskDetail.commentsLabel')}</p>
          <div
            style={{
              background: 'var(--mv-bg)',
              border: '0.5px solid var(--mv-border)',
              borderRadius: 8,
              padding: 10,
              marginBottom: 18,
            }}
          >
            <TaskComments taskId={task.id} visibility="internal" />
          </div>

          <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: '0 0 8px' }}>
            {t('taskDetail.notesVisibleToCustomer')}
          </p>
          <div
            style={{
              background: 'var(--mv-bg)',
              border: '0.5px solid var(--mv-border)',
              borderRadius: 8,
              padding: 10,
            }}
          >
            <TaskComments taskId={task.id} visibility="customer" />
          </div>
        </div>
      )}

      {isCustomer && task.customer_id === userId && (
        <div style={{ marginTop: 18 }}>
          <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: '0 0 8px' }}>{t('taskDetail.notesLabel')}</p>
          <div
            style={{
              background: 'var(--mv-bg)',
              border: '0.5px solid var(--mv-border)',
              borderRadius: 8,
              padding: 10,
            }}
          >
            <TaskComments taskId={task.id} visibility="customer" />
          </div>
        </div>
      )}

      {actionPanel && <div style={{ marginTop: 18 }}>{actionPanel}</div>}
    </>
  );
};

export default TaskDetailContent;
