import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getKeycloak, authHeaders } from '../services/keycloak';
import TaskStatusBadge from './TaskStatusBadge';

// The master list — shared by the old full-page Gofeeler landing (now
// retired in favor of GofeelerSplitView) and the split view's list
// panel. A PM sees every task; an analyst/reviewer sees only the ones
// assigned to them (assignee is only populated while a task is
// actively theirs — see ARCHITECTURE.md's assignee/owner table); a
// customer sees the orders they submitted. refreshKey is bumped by
// GofeelerSplitView after a successful Create Order, since this panel
// stays mounted across the /create panel switch and wouldn't otherwise
// refetch.
const GofeelerListPanel = ({ selectedId, refreshKey }) => {
  const { t } = useTranslation('gofeeler');
  const keycloak = getKeycloak();
  const isPM = keycloak?.hasRealmRole('platform:project-manager');
  const isCustomer = keycloak?.hasRealmRole('platform:customer');
  const username = keycloak?.tokenParsed?.preferred_username;
  const userId = keycloak?.tokenParsed?.sub;

  const [tasks, setTasks] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/tasks?service=gofeeler', { headers: authHeaders() })
      .then((res) => {
        if (!res.ok) throw new Error(`task-service returned ${res.status}`);
        return res.json();
      })
      .then(setTasks)
      .catch((err) => setError(err.message));
  }, [refreshKey]);

  // PM sees everything; analyst/reviewer see only what's assigned to
  // them (still plain-text usernames); a customer sees orders where
  // they're customer_id — a real users.id UUID, not a username, unlike
  // assignee/owner.
  const visibleTasks = isPM
    ? tasks
    : tasks?.filter((task) =>
        isCustomer ? task.customer_id === userId : task.assignee === username
      );

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
          {t('listPanel.header')}
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
            {t('listPanel.newLink')}
          </Link>
        )}
      </div>

      <div style={{ overflowY: 'auto', flex: 1 }}>
        {error && (
          <p style={{ color: 'var(--mv-color-danger)', fontSize: 13, padding: '12px 16px' }}>
            {t('listPanel.loadError', { error })}
          </p>
        )}

        {!error && !tasks && (
          <p style={{ color: 'var(--mv-text-muted)', fontSize: 13, padding: '12px 16px' }}>
            {t('listPanel.loading')}
          </p>
        )}

        {visibleTasks && visibleTasks.length === 0 && (
          <p style={{ color: 'var(--mv-text-muted)', fontSize: 13, padding: '12px 16px' }}>
            {isPM
              ? t('listPanel.emptyPm')
              : isCustomer
                ? t('listPanel.emptyCustomer')
                : t('listPanel.emptyOther')}
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
              <span style={{ flexShrink: 0 }}>
                <TaskStatusBadge status={task.status} />
              </span>
              <span
                style={{
                  color: isSelected ? 'var(--mv-text)' : 'var(--mv-text-muted)',
                  fontSize: 13,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {task.title}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default GofeelerListPanel;
