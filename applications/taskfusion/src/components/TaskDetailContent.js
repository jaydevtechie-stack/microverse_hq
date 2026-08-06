import React, { useEffect, useState } from 'react';
import { IconLink, IconMail, IconShare2 } from '@tabler/icons-react';
import { getKeycloak } from '../services/keycloak';
import TaskStatusBadge from './TaskStatusBadge';
import PmAssignPanel from './PmAssignPanel';
import PmBillPanel from './PmBillPanel';
import AnalystPanel from './AnalystPanel';
import ReviewerPanel from './ReviewerPanel';
import CustomerProgressPanel from './CustomerProgressPanel';

const detailRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '8px 4px',
  borderBottom: '0.5px solid var(--mv-border)',
  fontSize: 13,
};

// Which action panel (if any) to show is (viewer's platform role, task's
// current state) — see ARCHITECTURE.md's "UI pattern" note. A PM gets
// the assign picker while unassigned, and the bill button once done
// (both only for the PM who's the task's current owner); an
// analyst/reviewer only get their action while the task is actively
// assigned to them; a customer only gets the progress/invoice view
// once there's something to show.
function actionPanelFor({ task, isPM, isAnalyst, isReviewer, isCustomer, username }) {
  if (isPM && task.status === 'unassigned') {
    return <PmAssignPanel />;
  }
  if (isPM && task.status === 'done' && task.owner === username) {
    return <PmBillPanel />;
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

// Copy link / email / native share, next to the status badge — from
// gofeeler_landing_page_split_view_resizable.html's mockup. Native
// Web Share (mobile/some desktop browsers) falls back to copy-link
// where it isn't available, rather than a dead button.
const ShareIconGroup = ({ task }) => {
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
      {copied && <span style={{ color: 'var(--mv-color-primary)', fontSize: 11 }}>Copied!</span>}
      <IconLink size={15} style={iconStyle} onClick={copyLink} title="Copy link" />
      <IconMail size={15} style={iconStyle} onClick={shareViaEmail} title="Share via email" />
      <IconShare2 size={15} style={iconStyle} onClick={share} title="Share" />
    </div>
  );
};

// The task info + role-specific action panel — shared by the standalone
// TaskDetailPage and GofeelerSplitView's embedded detail panel.
const TaskDetailContent = ({ id }) => {
  const keycloak = getKeycloak();
  const username = keycloak?.tokenParsed?.preferred_username;
  const isPM = keycloak?.hasRealmRole('platform:project-manager');
  const isAnalyst = keycloak?.hasRealmRole('platform:analyst');
  const isReviewer = keycloak?.hasRealmRole('platform:reviewer');
  const isCustomer = keycloak?.hasRealmRole('platform:customer');

  const [task, setTask] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setTask(null);
    setError(null);
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

  if (error) {
    return (
      <p style={{ color: 'var(--mv-color-danger)', fontSize: 13 }}>Couldn't load task: {error}</p>
    );
  }

  if (!task) {
    return <p style={{ color: 'var(--mv-text-muted)', fontSize: 13 }}>Loading task…</p>;
  }

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
          margin: '14px 0 18px',
        }}
      >
        <p style={{ color: 'var(--mv-text)', fontSize: 16, fontWeight: 500, margin: 0 }}>
          {task.title}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <TaskStatusBadge status={task.status} />
          <ShareIconGroup task={task} />
        </div>
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
      <div
        style={{
          ...detailRowStyle,
          borderBottom: actionPanel ? '0.5px solid var(--mv-border)' : 'none',
        }}
      >
        <span style={{ color: 'var(--mv-text-muted)' }}>Created</span>
        <span style={{ color: 'var(--mv-text)' }}>
          {new Date(task.created_at).toLocaleDateString()}
        </span>
      </div>

      {actionPanel && <div style={{ marginTop: 18 }}>{actionPanel}</div>}
    </>
  );
};

export default TaskDetailContent;
