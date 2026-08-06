import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getKeycloak } from '../services/keycloak';
import { STATUS_STYLE } from './TaskStatusBadge';

// The master list — shared by the old full-page Gofeeler landing (now
// retired in favor of GofeelerSplitView) and the split view's list
// panel. A PM sees every task; an analyst/reviewer sees only the ones
// assigned to them (assignee is only populated while a task is
// actively theirs — see ARCHITECTURE.md's assignee/owner table).
const GofeelerListPanel = ({ selectedId }) => {
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
        <span style={{ color: 'var(--mv-text)', fontSize: 13, fontWeight: 500 }}>
          Orders &amp; tasks
        </span>
        {isCustomer && (
          <Link
            to="/create"
            style={{
              padding: '4px 10px',
              fontSize: 11,
              background: 'var(--mv-color-primary)',
              color: 'var(--mv-color-primary-contrast)',
              borderRadius: 6,
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            + New
          </Link>
        )}
      </div>

      <div style={{ overflowY: 'auto', flex: 1 }}>
        {error && (
          <p style={{ color: 'var(--mv-color-danger)', fontSize: 13, padding: '12px 16px' }}>
            Couldn't load tasks: {error}
          </p>
        )}

        {!error && !tasks && (
          <p style={{ color: 'var(--mv-text-muted)', fontSize: 13, padding: '12px 16px' }}>
            Loading tasks…
          </p>
        )}

        {visibleTasks && visibleTasks.length === 0 && (
          <p style={{ color: 'var(--mv-text-muted)', fontSize: 13, padding: '12px 16px' }}>
            {isPM ? 'No tasks yet.' : 'No tasks assigned to you right now.'}
          </p>
        )}

        {visibleTasks?.map((task) => {
          const isSelected = String(task.id) === String(selectedId);
          return (
            <Link
              key={task.id}
              to={`/task/${task.id}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 16px',
                borderBottom: '0.5px solid var(--mv-border)',
                textDecoration: 'none',
                whiteSpace: 'nowrap',
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
              <span
                style={{
                  color: isSelected ? 'var(--mv-text)' : 'var(--mv-text-muted)',
                  fontSize: 13,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                #{task.id.slice(0, 8)} · {task.title}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default GofeelerListPanel;
