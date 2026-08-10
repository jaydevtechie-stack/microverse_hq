import React, { useEffect, useState } from 'react';
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react';
import { authHeaders } from '../services/keycloak';
import SplitView from './SplitView';
import { STATUS_STYLE } from './TaskStatusBadge';

const PROJECT_STATUS_STYLE = {
  active: { bg: 'var(--mv-color-success, #2f9e64)', label: 'Active' },
  dormant: { bg: 'var(--mv-text-muted)', label: 'Pending approval' },
};

const ProjectStatusBadge = ({ status }) => {
  const style = PROJECT_STATUS_STYLE[status] || PROJECT_STATUS_STYLE.dormant;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 11,
        color: 'var(--mv-text-muted)',
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: style.bg }} />
      {style.label}
    </span>
  );
};

// Left panel — one accordion row per Account, expanding to that
// Account's Projects. `canCreateProject` shows a "+ New project" link
// under each Account's project list (customer view only — projects are
// customer-initiated, see project-routes.js's POST /projects).
const AccountAccordion = ({ accounts, expanded, onToggle, selection, onSelectProject, onNewProject, canCreateProject }) => (
  <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
    <div style={{ padding: '14px 16px', borderBottom: '0.5px solid var(--mv-border)' }}>
      <span style={{ color: 'var(--mv-text)', fontSize: 13, fontWeight: 500 }}>Accounts</span>
    </div>
    <div style={{ overflowY: 'auto', flex: 1 }}>
      {accounts.map((account) => {
        const isOpen = expanded.has(account.id);
        return (
          <div key={account.id} style={{ borderBottom: '0.5px solid var(--mv-border)' }}>
            <div
              onClick={() => onToggle(account.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '12px 16px',
                cursor: 'pointer',
              }}
            >
              {isOpen ? (
                <IconChevronDown size={14} color="var(--mv-text-muted)" />
              ) : (
                <IconChevronRight size={14} color="var(--mv-text-muted)" />
              )}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ color: 'var(--mv-text)', fontSize: 13 }}>{account.name}</div>
                <div style={{ color: 'var(--mv-badge-bg)', fontSize: 11, textTransform: 'capitalize' }}>
                  {account.type}
                </div>
              </div>
            </div>

            {isOpen && (
              <div style={{ paddingBottom: 8 }}>
                {account.projects.length === 0 && (
                  <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, padding: '0 16px 8px 38px' }}>
                    No projects yet.
                  </p>
                )}
                {account.projects.map((project) => {
                  const isSelected = selection?.type === 'project' && selection.id === project.id;
                  return (
                    <div
                      key={project.id}
                      onClick={() => onSelectProject(project.id)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                        padding: '8px 16px 8px 38px',
                        cursor: 'pointer',
                        background: isSelected ? 'var(--mv-bg)' : 'transparent',
                      }}
                    >
                      <span style={{ color: isSelected ? 'var(--mv-text)' : 'var(--mv-text-muted)', fontSize: 12 }}>
                        {project.name}
                      </span>
                      <ProjectStatusBadge status={project.status} />
                    </div>
                  );
                })}
                {canCreateProject && (
                  <div
                    onClick={() => onNewProject(account.id)}
                    style={{
                      padding: '8px 16px 4px 38px',
                      fontSize: 12,
                      color: 'var(--mv-color-primary)',
                      cursor: 'pointer',
                    }}
                  >
                    + New project
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  </div>
);

const infoBox = { background: 'var(--mv-bg)', border: '0.5px solid var(--mv-border)', borderRadius: 8, padding: '10px 12px' };

const ProjectDetail = ({ project, canApprove, onApprove, approving }) => (
  <>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 4px' }}>
      <p style={{ color: 'var(--mv-text)', fontSize: 15, fontWeight: 500, margin: 0 }}>{project.name}</p>
      <ProjectStatusBadge status={project.status} />
    </div>
    <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: '0 0 18px' }}>
      Account: <span style={{ color: 'var(--mv-color-primary)' }}>{project.account_name}</span>
    </p>

    {canApprove && project.status === 'dormant' && (
      <button
        type="button"
        onClick={onApprove}
        disabled={approving}
        style={{
          marginBottom: 18,
          padding: '8px 14px',
          background: 'var(--mv-color-primary)',
          color: 'var(--mv-color-primary-contrast)',
          fontWeight: 500,
          fontSize: 12,
          border: 'none',
          borderRadius: 8,
          cursor: approving ? 'default' : 'pointer',
          opacity: approving ? 0.6 : 1,
        }}
      >
        {approving ? 'Approving…' : 'Approve project'}
      </button>
    )}

    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
      <div style={infoBox}>
        <p style={{ color: 'var(--mv-badge-bg)', fontSize: 11, margin: '0 0 4px' }}>Project manager</p>
        <p style={{ color: 'var(--mv-text)', fontSize: 13, margin: 0 }}>
          {project.responsible_user_name || 'Unassigned'}
        </p>
      </div>
      <div style={infoBox}>
        <p style={{ color: 'var(--mv-badge-bg)', fontSize: 11, margin: '0 0 4px' }}>Payment terms</p>
        <p style={{ color: 'var(--mv-text)', fontSize: 13, margin: 0 }}>{project.payment_terms || '—'}</p>
      </div>
    </div>

    <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: '0 0 8px' }}>Tasks</p>
    {project.tasks.length === 0 && (
      <p style={{ color: 'var(--mv-badge-bg)', fontSize: 12 }}>No tasks under this project yet.</p>
    )}
    {project.tasks.map((task) => (
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
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: (STATUS_STYLE[task.status] || STATUS_STYLE.unassigned).bg,
            flexShrink: 0,
          }}
        />
        <span style={{ color: 'var(--mv-text)', fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {task.title}
        </span>
        <span style={{ color: 'var(--mv-text-muted)', fontSize: 11, whiteSpace: 'nowrap' }}>
          {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No due date'}
        </span>
      </div>
    ))}
  </>
);

const fieldLabelStyle = { color: 'var(--mv-text-muted)', fontSize: 12, display: 'block', marginBottom: 6 };
const fieldInputStyle = {
  width: '100%',
  background: 'var(--mv-bg)',
  border: '0.5px solid var(--mv-border)',
  borderRadius: 8,
  padding: '9px 12px',
  color: 'var(--mv-text)',
  fontSize: 13,
  marginBottom: 14,
  boxSizing: 'border-box',
  fontFamily: 'inherit',
};

const NewProjectForm = ({ accountName, onCreate, onCancel }) => {
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Project name is required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onCreate(name.trim());
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <>
      <p style={{ color: 'var(--mv-text)', fontSize: 15, fontWeight: 500, margin: '0 0 4px' }}>New project</p>
      <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: '0 0 18px' }}>
        Under <span style={{ color: 'var(--mv-color-primary)' }}>{accountName}</span> — starts pending
        account-manager approval.
      </p>

      <label style={fieldLabelStyle}>Project name</label>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Holiday campaign sentiment tracking"
        style={fieldInputStyle}
      />
      {error && <p style={{ color: 'var(--mv-color-danger)', fontSize: 12, margin: '-8px 0 14px' }}>{error}</p>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          style={{
            padding: '9px 16px',
            background: 'var(--mv-color-primary)',
            color: 'var(--mv-color-primary-contrast)',
            fontWeight: 500,
            fontSize: 13,
            border: 'none',
            borderRadius: 8,
            cursor: submitting ? 'default' : 'pointer',
            opacity: submitting ? 0.6 : 1,
          }}
        >
          {submitting ? 'Creating…' : 'Create project'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          style={{
            padding: '9px 16px',
            background: 'transparent',
            color: 'var(--mv-text-muted)',
            fontWeight: 500,
            fontSize: 13,
            border: '0.5px solid var(--mv-border)',
            borderRadius: 8,
            cursor: submitting ? 'default' : 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </>
  );
};

const NewAccountForm = ({ onCreate, onCancel }) => {
  const [name, setName] = useState('');
  const [type, setType] = useState('company');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Account name is required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onCreate({ name: name.trim(), type });
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <>
      <p style={{ color: 'var(--mv-text)', fontSize: 15, fontWeight: 500, margin: '0 0 18px' }}>New account</p>

      <label style={fieldLabelStyle}>Account name</label>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Cedarline Logistics"
        style={fieldInputStyle}
      />

      <label style={fieldLabelStyle}>Type</label>
      <select value={type} onChange={(e) => setType(e.target.value)} style={fieldInputStyle}>
        <option value="company">Company</option>
        <option value="individual">Individual</option>
      </select>
      {error && <p style={{ color: 'var(--mv-color-danger)', fontSize: 12, margin: '-8px 0 14px' }}>{error}</p>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          style={{
            padding: '9px 16px',
            background: 'var(--mv-color-primary)',
            color: 'var(--mv-color-primary-contrast)',
            fontWeight: 500,
            fontSize: 13,
            border: 'none',
            borderRadius: 8,
            cursor: submitting ? 'default' : 'pointer',
            opacity: submitting ? 0.6 : 1,
          }}
        >
          {submitting ? 'Creating…' : 'Create account'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          style={{
            padding: '9px 16px',
            background: 'transparent',
            color: 'var(--mv-text-muted)',
            fontWeight: 500,
            fontSize: 13,
            border: '0.5px solid var(--mv-border)',
            borderRadius: 8,
            cursor: submitting ? 'default' : 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </>
  );
};

// Shared by CustomerPage (own Accounts, can propose new Projects) and
// AmCustomersPage (every Account, can create new Accounts, can approve
// dormant Projects) — same accordion + split-view shell, just which
// creation/approval affordances show differs by role. GET /api/accounts
// is already branched server-side per role (account-routes.js), so this
// component doesn't need to know which role it's rendering for beyond
// the capability flags passed in.
const AccountsProjectsView = ({ canCreateProject = false, canCreateAccount = false, canApproveProject = false }) => {
  const [accounts, setAccounts] = useState(null);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(new Set());
  const [selection, setSelection] = useState(null); // { type: 'project', id } | { type: 'newProject', accountId } | { type: 'newAccount' }
  const [detail, setDetail] = useState(null);
  const [approving, setApproving] = useState(false);

  const refetchAccounts = () =>
    fetch('/api/accounts', { headers: authHeaders() })
      .then((res) => {
        if (!res.ok) throw new Error(`task-service returned ${res.status}`);
        return res.json();
      })
      .then(setAccounts)
      .catch((err) => setError(err.message));

  useEffect(() => {
    refetchAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selection?.type !== 'project') return;
    setDetail(null);
    fetch(`/api/projects/${selection.id}`, { headers: authHeaders() })
      .then((res) => {
        if (!res.ok) throw new Error(`task-service returned ${res.status}`);
        return res.json();
      })
      .then(setDetail)
      .catch((err) => setError(err.message));
  }, [selection]);

  const toggleAccount = (accountId) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(accountId)) next.delete(accountId);
      else next.add(accountId);
      return next;
    });
  };

  const handleCreateProject = async (accountId, name) => {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ accountId, name }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.message || `task-service returned ${res.status}`);
    await refetchAccounts();
    setSelection({ type: 'project', id: body.id });
  };

  const handleCreateAccount = async ({ name, type }) => {
    const res = await fetch('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ name, type }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.message || `task-service returned ${res.status}`);
    await refetchAccounts();
    setExpanded((prev) => new Set(prev).add(body.id));
    setSelection(null);
  };

  const handleApprove = async () => {
    if (selection?.type !== 'project') return;
    setApproving(true);
    try {
      const res = await fetch(`/api/projects/${selection.id}/approve`, {
        method: 'PATCH',
        headers: authHeaders(),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || `task-service returned ${res.status}`);
      setDetail(body);
      await refetchAccounts();
    } catch (err) {
      setError(err.message);
    } finally {
      setApproving(false);
    }
  };

  if (error) {
    return <p style={{ color: 'var(--mv-color-danger)', fontSize: 13, margin: 'var(--mv-space-3)' }}>Couldn't load accounts: {error}</p>;
  }
  if (!accounts) {
    return <p style={{ color: 'var(--mv-text-muted)', fontSize: 13, margin: 'var(--mv-space-3)' }}>Loading accounts…</p>;
  }

  return (
    <div style={{ margin: 'var(--mv-space-3)' }}>
      {canCreateAccount && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
          <button
            type="button"
            onClick={() => setSelection({ type: 'newAccount' })}
            style={{
              padding: '8px 14px',
              background: 'var(--mv-color-primary)',
              color: 'var(--mv-color-primary-contrast)',
              fontWeight: 500,
              fontSize: 12,
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            + New account
          </button>
        </div>
      )}

      <SplitView
        open={Boolean(selection)}
        listPanel={
          <AccountAccordion
            accounts={accounts}
            expanded={expanded}
            onToggle={toggleAccount}
            selection={selection}
            onSelectProject={(id) => setSelection({ type: 'project', id })}
            onNewProject={(accountId) => setSelection({ type: 'newProject', accountId })}
            canCreateProject={canCreateProject}
          />
        }
        detailPanel={(() => {
          if (!selection) return null;
          if (selection.type === 'newAccount') {
            return <NewAccountForm onCreate={handleCreateAccount} onCancel={() => setSelection(null)} />;
          }
          if (selection.type === 'newProject') {
            const account = accounts.find((a) => a.id === selection.accountId);
            return (
              <NewProjectForm
                accountName={account?.name}
                onCreate={(name) => handleCreateProject(selection.accountId, name)}
                onCancel={() => setSelection(null)}
              />
            );
          }
          if (selection.type === 'project') {
            return (
              detail && (
                <ProjectDetail project={detail} canApprove={canApproveProject} onApprove={handleApprove} approving={approving} />
              )
            );
          }
          return null;
        })()}
      />
    </div>
  );
};

export default AccountsProjectsView;
