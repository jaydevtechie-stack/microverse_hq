import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { IconSearch } from '@tabler/icons-react';
import { getKeycloak, authHeaders } from '../services/keycloak';
import TaskStatusBadge from './TaskStatusBadge';
import TaskStatusFilter from './TaskStatusFilter';

// Client-side, same as TaskStatusFilter's status narrowing below — the
// full task set is already fetched in one shot (see the effect below),
// so paging/searching narrow the already-loaded array rather than a
// server round trip. Distinct from SearchResultsPage's Prev/Next (that
// one pages a real search-service query, page/size/total from the
// server) — this list has no equivalent paged endpoint, task-service's
// GET /api/tasks?service= always returns every row.
//
// Configurable via REACT_APP_TASK_LIST_PAGE_SIZE (TASKFUSION_TASK_LIST_PAGE_SIZE
// in .env, see docker-compose.yml's build args) — a CRA build-time env
// var, baked in at image build, not runtime-tunable without a rebuild,
// same as REACT_APP_KEYCLOAK_URL and friends. Falls back to 20 if unset
// or not a positive integer.
const configuredPageSize = Number(process.env.REACT_APP_TASK_LIST_PAGE_SIZE);
const PAGE_SIZE = Number.isInteger(configuredPageSize) && configuredPageSize > 0 ? configuredPageSize : 20;

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
  const isAnalyst = keycloak?.hasRealmRole('platform:analyst');
  const username = keycloak?.tokenParsed?.preferred_username;
  const userId = keycloak?.tokenParsed?.sub;

  // A pure analyst (not also a PM or customer) gets the "My tasks / Open
  // pool" toggle — the pool view is every 'unassigned' order they could
  // claim (task-service's GET /api/tasks?service= already returns those
  // rows to a non-customer caller, so this filters the loaded set rather
  // than hitting the dedicated GET /api/tasks/pool endpoint).
  const isPoolAnalyst = isAnalyst && !isPM && !isCustomer;

  const [tasks, setTasks] = useState(null);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [poolView, setPoolView] = useState(false);

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
    : tasks?.filter((task) => {
        if (isCustomer) return task.customer_id === userId;
        if (isPoolAnalyst && poolView) return task.status === 'unassigned';
        return task.assignee === username;
      });

  const trimmedQuery = searchQuery.trim().toLowerCase();
  const searchedTasks = trimmedQuery
    ? visibleTasks?.filter((task) => task.title?.toLowerCase().includes(trimmedQuery))
    : visibleTasks;

  const filteredTasks =
    statusFilter === 'all' ? searchedTasks : searchedTasks?.filter((task) => task.status === statusFilter);

  // Whenever the filtered set's basis changes — a new search term, a
  // different status chip, or a fresh fetch — page 2 of the *previous*
  // filter would otherwise silently persist and could land past the
  // end of the new, usually-shorter result set.
  useEffect(() => {
    setPage(1);
  }, [statusFilter, searchQuery, refreshKey, poolView]);

  const totalPages = filteredTasks ? Math.max(1, Math.ceil(filteredTasks.length / PAGE_SIZE)) : 1;
  const pagedTasks = filteredTasks?.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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
          {isCustomer ? t('listPanel.headerOrders') : t('listPanel.headerTasks')}
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

      {isPoolAnalyst && tasks && (
        <div
          style={{
            display: 'flex',
            gap: 6,
            padding: '10px 16px',
            borderBottom: '0.5px solid var(--mv-border)',
          }}
        >
          {[
            ['myTasksTab', false],
            ['openPoolTab', true],
          ].map(([key, value]) => {
            const active = poolView === value;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setPoolView(value)}
                style={{
                  padding: '4px 10px',
                  fontSize: 11,
                  borderRadius: 'var(--mv-radius)',
                  border: active ? '1.5px solid var(--mv-color-primary)' : '0.5px solid var(--mv-border)',
                  background: active ? 'var(--mv-bg-elevated)' : 'transparent',
                  color: active ? 'var(--mv-text)' : 'var(--mv-text-muted)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {t(`listPanel.${key}`)}
              </button>
            );
          })}
        </div>
      )}

      {visibleTasks && visibleTasks.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            padding: '10px 16px',
            borderBottom: '0.5px solid var(--mv-border)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--mv-bg)',
              border: '0.5px solid var(--mv-border)',
              borderRadius: 999,
              padding: '6px 12px',
            }}
          >
            <IconSearch size={14} color="var(--mv-text-muted)" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('listPanel.searchPlaceholder')}
              style={{
                flex: 1,
                border: 'none',
                background: 'none',
                outline: 'none',
                fontSize: 12,
                color: 'var(--mv-text)',
                minWidth: 0,
              }}
            />
          </div>
          <TaskStatusFilter active={statusFilter} onChange={setStatusFilter} />
        </div>
      )}

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
                : isPoolAnalyst && poolView
                  ? t('listPanel.emptyPool')
                  : t('listPanel.emptyOther')}
          </p>
        )}

        {visibleTasks && visibleTasks.length > 0 && filteredTasks.length === 0 && (
          <p style={{ color: 'var(--mv-text-muted)', fontSize: 13, padding: '12px 16px' }}>
            {t('listPanel.emptyFiltered')}
          </p>
        )}

        {pagedTasks?.map((task) => {
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

      {filteredTasks && filteredTasks.length > PAGE_SIZE && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 14,
            padding: '10px 16px',
            borderTop: '0.5px solid var(--mv-border)',
          }}
        >
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            style={{
              padding: '5px 12px',
              fontSize: 11,
              borderRadius: 'var(--mv-radius)',
              border: '0.5px solid var(--mv-border)',
              background: 'transparent',
              color: page <= 1 ? 'var(--mv-text-muted)' : 'var(--mv-text)',
              cursor: page <= 1 ? 'default' : 'pointer',
              opacity: page <= 1 ? 0.5 : 1,
            }}
          >
            {t('listPanel.prevPage')}
          </button>
          <span style={{ fontSize: 11, color: 'var(--mv-text-muted)' }}>
            {t('listPanel.pageOf', { page, totalPages })}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            style={{
              padding: '5px 12px',
              fontSize: 11,
              borderRadius: 'var(--mv-radius)',
              border: '0.5px solid var(--mv-border)',
              background: 'transparent',
              color: page >= totalPages ? 'var(--mv-text-muted)' : 'var(--mv-text)',
              cursor: page >= totalPages ? 'default' : 'pointer',
              opacity: page >= totalPages ? 0.5 : 1,
            }}
          >
            {t('listPanel.nextPage')}
          </button>
        </div>
      )}
    </div>
  );
};

export default GofeelerListPanel;
