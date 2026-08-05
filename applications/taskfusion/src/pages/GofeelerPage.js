// src/pages/GofeelerPage.js
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getKeycloak } from '../services/keycloak';
import TaskStatusBadge from '../components/TaskStatusBadge';

// A PM sees every Gofeeler task; an analyst/reviewer sees only the
// ones assigned to them (assignee is only populated while a task is
// actively theirs — see ARCHITECTURE.md's assignee/owner table).
const GofeelerPage = () => {
  const keycloak = getKeycloak();
  const isPM = keycloak?.hasRealmRole('platform:project-manager');
  const isCustomer = keycloak?.hasRealmRole('platform:customer');
  const username = keycloak?.tokenParsed?.preferred_username;

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

  const visibleTasks = isPM ? tasks : tasks?.filter((task) => task.assignee === username);

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
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 4,
        }}
      >
        <p style={{ color: 'var(--mv-text)', fontSize: 15, fontWeight: 500, margin: 0 }}>
          {isPM ? 'Gofeeler tasks' : 'Your Gofeeler tasks'}
        </p>
        {isCustomer && (
          <Link
            to="/create"
            style={{ color: 'var(--mv-color-primary)', fontSize: 12, textDecoration: 'none' }}
          >
            + New order
          </Link>
        )}
      </div>
      <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: '0 0 18px' }}>
        {isPM
          ? 'Every task tagged for the Gofeeler service, across all statuses.'
          : 'Tasks currently assigned to you as analyst or reviewer.'}
      </p>

      {error && (
        <p style={{ color: 'var(--mv-color-danger)', fontSize: 13 }}>
          Couldn't load tasks: {error}
        </p>
      )}

      {!error && !tasks && (
        <p style={{ color: 'var(--mv-text-muted)', fontSize: 13 }}>Loading tasks…</p>
      )}

      {visibleTasks && visibleTasks.length === 0 && (
        <p style={{ color: 'var(--mv-text-muted)', fontSize: 13 }}>
          {isPM ? 'No tasks yet.' : 'No tasks assigned to you right now.'}
        </p>
      )}

      {visibleTasks && visibleTasks.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {visibleTasks.map((task) => (
            <Link
              key={task.id}
              to={`/task/${task.id}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 4px',
                borderBottom: '0.5px solid var(--mv-border)',
                textDecoration: 'none',
              }}
            >
              <span style={{ color: 'var(--mv-text)', fontSize: 13, flex: 1 }}>{task.title}</span>
              <span style={{ color: 'var(--mv-text-muted)', fontSize: 12 }}>
                {task.assignee || 'unassigned'}
              </span>
              <TaskStatusBadge status={task.status} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default GofeelerPage;
