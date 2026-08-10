import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import SplitView from '../components/SplitView';
import { authHeaders } from '../services/keycloak';

const initials = (name) =>
  name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase();

const ROLE_COLOR = 'var(--mv-color-primary)';

const UserList = ({ users, error, selectedId, onSelect }) => {
  const { t } = useTranslation('admin');
  return (
  <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
    <div
      style={{
        padding: '14px 16px',
        borderBottom: '0.5px solid var(--mv-border)',
      }}
    >
      <span style={{ color: 'var(--mv-text)', fontSize: 13, fontWeight: 500 }}>{t('users.headerTitle')}</span>
    </div>
    <div style={{ overflowY: 'auto', flex: 1 }}>
      {error && (
        <p style={{ color: 'var(--mv-color-danger)', fontSize: 13, padding: '12px 16px' }}>
          {t('users.loadError', { error })}
        </p>
      )}
      {!error && !users && (
        <p style={{ color: 'var(--mv-text-muted)', fontSize: 13, padding: '12px 16px' }}>{t('users.loading')}</p>
      )}
      {users?.length === 0 && (
        <p style={{ color: 'var(--mv-text-muted)', fontSize: 13, padding: '12px 16px' }}>
          {t('users.empty')}
        </p>
      )}
      {users?.map((user) => {
        const isSelected = user.id === selectedId;
        return (
          <div
            key={user.id}
            onClick={() => onSelect(user.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 16px',
              borderBottom: '0.5px solid var(--mv-border)',
              cursor: 'pointer',
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: user.active ? 'var(--mv-color-success)' : 'var(--mv-badge-bg)',
                flexShrink: 0,
              }}
            />
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  color: isSelected ? 'var(--mv-text)' : 'var(--mv-text-muted)',
                  fontSize: 13,
                  whiteSpace: 'nowrap',
                }}
              >
                {user.name}
              </div>
              <div style={{ color: 'var(--mv-badge-bg)', fontSize: 11, whiteSpace: 'nowrap' }}>{user.email}</div>
            </div>
          </div>
        );
      })}
    </div>
  </div>
  );
};

const UserDetail = ({ user, onClose, onToggleActive }) => {
  const { t } = useTranslation('admin');
  return (
  <>
    <span onClick={onClose} style={{ color: 'var(--mv-color-primary)', fontSize: 12, cursor: 'pointer' }}>
      {t('common:back')}
    </span>

    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '14px 0 16px' }}>
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: user.active ? 'var(--mv-color-primary)' : 'var(--mv-badge-bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--mv-color-primary-contrast)',
          fontSize: 14,
          fontWeight: 500,
          flexShrink: 0,
        }}
      >
        {initials(user.name)}
      </div>
      <div>
        <p style={{ color: 'var(--mv-text)', fontSize: 15, fontWeight: 500, margin: 0 }}>{user.name}</p>
        <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: '2px 0 0' }}>{user.email}</p>
      </div>
      <span
        style={{
          marginLeft: 'auto',
          fontSize: 11,
          padding: '2px 10px',
          borderRadius: 10,
          whiteSpace: 'nowrap',
          background: user.active
            ? 'color-mix(in srgb, var(--mv-color-success) 15%, transparent)'
            : 'var(--mv-badge-bg)',
          color: user.active ? 'var(--mv-color-success)' : 'var(--mv-badge-text)',
        }}
      >
        {user.active ? t('users.active') : t('users.deactivated')}
      </span>
    </div>

    <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: '0 0 8px' }}>{t('users.rolesLabel')}</p>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
      {user.roles.length === 0 && (
        <span style={{ color: 'var(--mv-badge-bg)', fontSize: 12 }}>
          {t('users.noRoles')}
        </span>
      )}
      {user.roles.map((role) => (
        <span
          key={role}
          style={{
            padding: '4px 10px',
            fontSize: 11,
            borderRadius: 12,
            background: 'color-mix(in srgb, ' + ROLE_COLOR + ' 15%, transparent)',
            color: ROLE_COLOR,
          }}
        >
          {role}
        </span>
      ))}
    </div>

    <div
      style={{
        background: 'var(--mv-bg)',
        border: '0.5px solid var(--mv-border)',
        borderRadius: 8,
        padding: 12,
        marginBottom: 20,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: 'var(--mv-text-muted)', fontSize: 12 }}>{t('users.permissionsLabel')}</span>
        <span
          style={{
            color: 'var(--mv-badge-bg)',
            fontSize: 10,
            background: 'var(--mv-badge-bg)',
            padding: '2px 8px',
            borderRadius: 8,
            opacity: 0.6,
          }}
        >
          {t('users.comingSoonBadge')}
        </span>
      </div>
      <p style={{ color: 'var(--mv-badge-bg)', fontSize: 11, margin: '6px 0 0', lineHeight: 1.4 }}>
        {t('users.permissionsNote')}
      </p>
    </div>

    <button
      type="button"
      onClick={() => onToggleActive(user)}
      style={{
        width: '100%',
        padding: '10px 0',
        background: 'transparent',
        border: `0.5px solid ${user.active ? 'var(--mv-color-danger)' : 'var(--mv-color-success)'}`,
        color: user.active ? 'var(--mv-color-danger)' : 'var(--mv-color-success)',
        fontWeight: 500,
        fontSize: 13,
        borderRadius: 8,
        cursor: 'pointer',
      }}
    >
      {user.active ? t('users.deactivateUser') : t('users.reactivateUser')}
    </button>
  </>
  );
};

// Master-detail split view for Admin's Users tab (4.0.1) — mockup:
// admin_users_page_split_view.html. Deactivate/reactivate is a real
// PATCH against task-service; roles are display-only (synced from the
// JWT, never consulted for access control — see SCHEMA.md's users).
const AdminUsersPage = () => {
  const [users, setUsers] = useState(null);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    fetch('/api/users', { headers: authHeaders() })
      .then((res) => {
        if (!res.ok) throw new Error(`task-service returned ${res.status}`);
        return res.json();
      })
      .then(setUsers)
      .catch((err) => setError(err.message));
  }, []);

  const selectedUser = users?.find((u) => u.id === selectedId);

  const toggleActive = (user) => {
    const nextActive = !user.active;
    fetch(`/api/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ active: nextActive }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`task-service returned ${res.status}`);
        return res.json();
      })
      .then((updated) => {
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      })
      .catch((err) => setError(err.message));
  };

  return (
    <SplitView
      open={Boolean(selectedUser)}
      listPanel={<UserList users={users} error={error} selectedId={selectedId} onSelect={setSelectedId} />}
      detailPanel={
        selectedUser && (
          <UserDetail user={selectedUser} onClose={() => setSelectedId(null)} onToggleActive={toggleActive} />
        )
      }
    />
  );
};

export default AdminUsersPage;
