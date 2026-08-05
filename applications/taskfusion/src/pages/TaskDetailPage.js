// src/pages/TaskDetailPage.js
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import TaskStatusBadge from '../components/TaskStatusBadge';
import CloseButton from '../components/CloseButton';

const detailRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '8px 4px',
  borderBottom: '0.5px solid var(--mv-border)',
  fontSize: 13,
};

// Info display only — no role/status action buttons yet (Assign,
// Analyse, Review, Done/Bill, Accept/Close). That's ROADMAP.md's
// Branch 2, once dummy Order data and per-role actions are built.
const TaskDetailPage = () => {
  const { id } = useParams();
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
          <div style={{ ...detailRowStyle, borderBottom: 'none' }}>
            <span style={{ color: 'var(--mv-text-muted)' }}>Created</span>
            <span style={{ color: 'var(--mv-text)' }}>
              {new Date(task.created_at).toLocaleDateString()}
            </span>
          </div>
        </>
      )}
    </div>
  );
};

export default TaskDetailPage;
