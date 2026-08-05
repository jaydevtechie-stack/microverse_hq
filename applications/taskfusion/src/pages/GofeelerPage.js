// src/pages/GofeelerPage.js
import React, { useEffect, useState } from 'react';
import TaskStatusBadge from '../components/TaskStatusBadge';

const GofeelerPage = () => {
  const [tasks, setTasks] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/tasks?service=gofeeler')
      .then((res) => {
        if (!res.ok) throw new Error(`task-service returned ${res.status}`);
        return res.json();
      })
      .then(setTasks)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div
      style={{
        background: 'var(--mv-bg-elevated)',
        border: '0.5px solid var(--mv-border)',
        borderRadius: 'var(--mv-radius-lg)',
        margin: 'var(--mv-space-3)',
        padding: '16px 18px',
      }}
    >
      <p style={{ color: 'var(--mv-text)', fontSize: 15, fontWeight: 500, margin: '0 0 4px' }}>
        Gofeeler tasks
      </p>
      <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: '0 0 18px' }}>
        Every task tagged for the Gofeeler service, across all statuses.
      </p>

      {error && (
        <p style={{ color: 'var(--mv-color-danger)', fontSize: 13 }}>
          Couldn't load tasks: {error}
        </p>
      )}

      {!error && !tasks && (
        <p style={{ color: 'var(--mv-text-muted)', fontSize: 13 }}>Loading tasks…</p>
      )}

      {tasks && tasks.length === 0 && (
        <p style={{ color: 'var(--mv-text-muted)', fontSize: 13 }}>No tasks yet.</p>
      )}

      {tasks && tasks.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {tasks.map((task) => (
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
              <span style={{ color: 'var(--mv-text)', fontSize: 13, flex: 1 }}>{task.title}</span>
              <span style={{ color: 'var(--mv-text-muted)', fontSize: 12 }}>
                {task.assignee || 'unassigned'}
              </span>
              <TaskStatusBadge status={task.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default GofeelerPage;
