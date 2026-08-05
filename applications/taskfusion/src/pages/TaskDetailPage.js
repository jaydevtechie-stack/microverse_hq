// src/pages/TaskDetailPage.js
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getKeycloak } from '../services/keycloak';
import TaskStatusBadge from '../components/TaskStatusBadge';
import CloseButton from '../components/CloseButton';
import PmAssignPanel from '../components/PmAssignPanel';
import AnalystPanel from '../components/AnalystPanel';
import ReviewerPanel from '../components/ReviewerPanel';
import CustomerProgressPanel from '../components/CustomerProgressPanel';

const detailRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '8px 4px',
  borderBottom: '0.5px solid var(--mv-border)',
  fontSize: 13,
};

// Which action panel (if any) to show is (viewer's platform role, task's
// current state) — see ARCHITECTURE.md's "UI pattern" note. A PM only
// gets the assign picker while unassigned; an analyst/reviewer only get
// their action while the task is actively assigned to them; a customer
// only gets the progress/invoice view once there's something to show.
function actionPanelFor({ task, isPM, isAnalyst, isReviewer, isCustomer, username }) {
  if (isPM && task.status === 'unassigned') {
    return <PmAssignPanel />;
  }
  if (isAnalyst && task.status === 'analyst' && task.assignee === username) {
    return <AnalystPanel />;
  }
  if (isReviewer && task.status === 'reviewer' && task.assignee === username) {
    return <ReviewerPanel task={task} />;
  }
  if (isCustomer && task.owner === username && ['done', 'paid', 'closed'].includes(task.status)) {
    return <CustomerProgressPanel task={task} />;
  }
  return null;
}

const TaskDetailPage = () => {
  const { id } = useParams();
  const keycloak = getKeycloak();
  const username = keycloak?.tokenParsed?.preferred_username;
  const isPM = keycloak?.hasRealmRole('platform:project-manager');
  const isAnalyst = keycloak?.hasRealmRole('platform:analyst');
  const isReviewer = keycloak?.hasRealmRole('platform:reviewer');
  const isCustomer = keycloak?.hasRealmRole('platform:customer');

  const [task, setTask] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`/api/tasks/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error(`task-service returned ${res.status}`);
        return res.json();
      })
      .then(setTask)
      .catch((err) => setError(err.message));
  }, [id]);

  const actionPanel = task
    ? actionPanelFor({ task, isPM, isAnalyst, isReviewer, isCustomer, username })
    : null;

  return (
    <div
      style={{
        position: 'relative',
        background: 'var(--mv-bg-elevated)',
        border: '0.5px solid var(--mv-border)',
        borderRadius: 'var(--mv-radius-lg)',
        margin: 'var(--mv-space-3)',
        padding: '16px 18px',
        maxWidth: 520,
      }}
    >
      <CloseButton />

      {error && (
        <p style={{ color: 'var(--mv-color-danger)', fontSize: 13 }}>
          Couldn't load task: {error}
        </p>
      )}

      {!error && !task && (
        <p style={{ color: 'var(--mv-text-muted)', fontSize: 13 }}>Loading task…</p>
      )}

      {task && (
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              margin: '14px 0 18px',
            }}
          >
            <p style={{ color: 'var(--mv-text)', fontSize: 16, fontWeight: 500, margin: 0 }}>
              {task.title}
            </p>
            <TaskStatusBadge status={task.status} />
          </div>

          <div style={detailRowStyle}>
            <span style={{ color: 'var(--mv-text-muted)' }}>Service</span>
            <span style={{ color: 'var(--mv-text)' }}>{task.service}</span>
          </div>
          <div style={detailRowStyle}>
            <span style={{ color: 'var(--mv-text-muted)' }}>Assignee</span>
            <span style={{ color: 'var(--mv-text)' }}>{task.assignee || 'unassigned'}</span>
          </div>
          <div style={detailRowStyle}>
            <span style={{ color: 'var(--mv-text-muted)' }}>Owner</span>
            <span style={{ color: 'var(--mv-text)' }}>{task.owner || '—'}</span>
          </div>
          <div style={detailRowStyle}>
            <span style={{ color: 'var(--mv-text-muted)' }}>Due</span>
            <span style={{ color: 'var(--mv-text)' }}>
              {task.due_date ? new Date(task.due_date).toLocaleDateString() : '—'}
            </span>
          </div>
          <div style={{ ...detailRowStyle, borderBottom: actionPanel ? '0.5px solid var(--mv-border)' : 'none' }}>
            <span style={{ color: 'var(--mv-text-muted)' }}>Created</span>
            <span style={{ color: 'var(--mv-text)' }}>
              {new Date(task.created_at).toLocaleDateString()}
            </span>
          </div>

          {actionPanel && <div style={{ marginTop: 18 }}>{actionPanel}</div>}
        </>
      )}
    </div>
  );
};

export default TaskDetailPage;
