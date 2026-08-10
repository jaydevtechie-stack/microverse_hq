import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconBinoculars, IconInfoCircle } from '@tabler/icons-react';
import { authHeaders } from '../services/keycloak';
import { STATUS_STYLE } from './TaskStatusBadge';

const WORD_SIZES = [20, 16, 14, 13, 12];

const initials = (name) =>
  (name || '?')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase();

function relativeTime(date) {
  if (!date) return null;
  const hours = (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60);
  if (hours < 1) return 'less than an hour';
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}

const statBox = {
  background: 'var(--mv-bg)',
  border: '0.5px solid var(--mv-border)',
  borderRadius: 8,
  padding: '8px 10px',
};

// Single-column toggle, not a side-by-side split — the mockup
// (assign_task_form_scout_and_detail.html) shows the profile as a
// resizable split panel, but this already sits inside GofeelerSplitView's
// own detail panel; nesting a second split there is too cramped to be
// usable. Same interaction (info icon → profile, back link → form,
// Assign button present in both places), adapted layout.
const CandidateProfile = ({ candidate, onBack, onAssign, assigning }) => {
  const { t } = useTranslation('gofeeler');
  return (
  <div>
    <span onClick={onBack} style={{ color: 'var(--mv-color-primary)', fontSize: 12, cursor: 'pointer' }}>
      {t('panels.pmAssign.backToAssignment')}
    </span>

    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '14px 0 16px' }}>
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: 'var(--mv-color-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--mv-color-primary-contrast)',
          fontSize: 14,
          fontWeight: 500,
          flexShrink: 0,
        }}
      >
        {initials(candidate.name)}
      </div>
      <div>
        <p style={{ color: 'var(--mv-text)', fontSize: 15, fontWeight: 500, margin: 0 }}>{candidate.name}</p>
        <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: '2px 0 0' }}>{candidate.email}</p>
      </div>
    </div>

    <p style={{ color: 'var(--mv-badge-bg)', fontSize: 11, margin: '0 0 14px' }}>
      {t('panels.pmAssign.scoutsReason', { reason: candidate.reason })}
    </p>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 18 }}>
      <div style={statBox}>
        <p style={{ color: 'var(--mv-badge-bg)', fontSize: 10, margin: '0 0 3px' }}>{t('panels.pmAssign.tasksDone')}</p>
        <p style={{ color: 'var(--mv-text)', fontSize: 15, fontWeight: 500, margin: 0 }}>{candidate.tasks_done}</p>
      </div>
      <div style={statBox}>
        <p style={{ color: 'var(--mv-badge-bg)', fontSize: 10, margin: '0 0 3px' }}>{t('panels.pmAssign.activeTasks')}</p>
        <p style={{ color: 'var(--mv-text)', fontSize: 15, fontWeight: 500, margin: 0 }}>
          {candidate.active_tasks.length}
        </p>
      </div>
      <div style={statBox}>
        <p style={{ color: 'var(--mv-badge-bg)', fontSize: 10, margin: '0 0 3px' }}>{t('panels.pmAssign.idleFor')}</p>
        <p style={{ color: 'var(--mv-text)', fontSize: 15, fontWeight: 500, margin: 0 }}>
          {relativeTime(candidate.oldest_active_assigned_at) || '—'}
        </p>
      </div>
    </div>

    <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: '0 0 8px' }}>{t('panels.pmAssign.currentTasks')}</p>
    {candidate.active_tasks.length === 0 && (
      <p style={{ color: 'var(--mv-badge-bg)', fontSize: 12 }}>{t('panels.pmAssign.noActiveTasks')}</p>
    )}
    {candidate.active_tasks.map((t) => (
      <div
        key={t.id}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '7px 0',
          borderBottom: '0.5px solid var(--mv-border)',
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: (STATUS_STYLE[t.status] || STATUS_STYLE.unassigned).bg,
            flexShrink: 0,
          }}
        />
        <span style={{ color: 'var(--mv-text)', fontSize: 12, flex: 1 }}>{t.title}</span>
        <span style={{ color: 'var(--mv-text-muted)', fontSize: 11 }}>
          {t.due_date ? new Date(t.due_date).toLocaleDateString() : '—'}
        </span>
      </div>
    ))}

    <button
      type="button"
      disabled={assigning}
      onClick={onAssign}
      style={{
        width: '100%',
        marginTop: 16,
        padding: '9px 0',
        background: 'var(--mv-color-primary)',
        color: 'var(--mv-color-primary-contrast)',
        fontWeight: 500,
        fontSize: 12,
        border: 'none',
        borderRadius: 8,
        cursor: assigning ? 'not-allowed' : 'pointer',
      }}
    >
      {assigning ? t('panels.pmAssign.assigning') : t('panels.pmAssign.assignName', { name: candidate.name })}
    </button>
  </div>
  );
};

// Scout (4.1.1) ranks candidates by availability — see
// business-services/task-service/models/scout.js for the honest
// explanation of what that proxies (not real response-time
// measurement yet). Word cloud + plain dropdown share the same
// `picked` state — "kept in sync" per ROADMAP.md 4.1. Clicking a
// candidate's info icon opens their profile (4.1.1.1, real stats only
// — no fabricated rating/turnaround/efficiency).
const PmAssignPanel = ({ task, onAssigned }) => {
  const { t } = useTranslation('gofeeler');
  const [candidates, setCandidates] = useState(null);
  const [fetchError, setFetchError] = useState(null);
  const [picked, setPicked] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState(null);
  const [viewingId, setViewingId] = useState(null);

  useEffect(() => {
    fetch(`/api/tasks/${task.id}/recommended-analysts`, { headers: authHeaders() })
      .then((res) => {
        if (!res.ok) throw new Error(`task-service returned ${res.status}`);
        return res.json();
      })
      .then(setCandidates)
      .catch((err) => setFetchError(err.message));
  }, [task.id]);

  const pickedCandidate = candidates?.find((c) => c.id === picked);
  const viewingCandidate = candidates?.find((c) => c.id === viewingId);

  const assign = (assigneeId) => {
    setAssigning(true);
    setAssignError(null);
    fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ assigneeId }),
    })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.message || `task-service returned ${res.status}`);
        return body;
      })
      .then((updated) => onAssigned?.(updated))
      .catch((err) => setAssignError(err.message))
      .finally(() => setAssigning(false));
  };

  if (viewingCandidate) {
    return (
      <CandidateProfile
        candidate={viewingCandidate}
        onBack={() => setViewingId(null)}
        onAssign={() => assign(viewingCandidate.id)}
        assigning={assigning}
      />
    );
  }

  return (
    <div>
      <div
        style={{
          background: 'var(--mv-bg)',
          border: '0.5px solid var(--mv-border)',
          borderRadius: 12,
          padding: 20,
          textAlign: 'center',
          marginBottom: 16,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: 'var(--mv-color-warning)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 10px',
          }}
        >
          <IconBinoculars size={22} color="#412402" />
        </div>
        <p style={{ color: 'var(--mv-text)', fontSize: 14, fontWeight: 500, margin: '0 0 2px' }}>{t('panels.pmAssign.scoutTitle')}</p>
        <p style={{ color: 'var(--mv-color-warning)', fontSize: 11, margin: '0 0 8px' }}>{t('panels.pmAssign.recommendationAgent')}</p>
        <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: 0, lineHeight: 1.5 }}>
          {t('panels.pmAssign.scoutDescription')}
        </p>
      </div>

      {fetchError && (
        <p style={{ color: 'var(--mv-color-danger)', fontSize: 12, marginBottom: 14 }}>
          {t('panels.pmAssign.loadError', { error: fetchError })}
        </p>
      )}

      {!fetchError && !candidates && (
        <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, marginBottom: 14 }}>{t('panels.pmAssign.loading')}</p>
      )}

      {candidates?.length === 0 && (
        <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, marginBottom: 14 }}>
          {t('panels.pmAssign.noneAvailable', { service: task.service })}
        </p>
      )}

      {candidates?.length > 0 && (
        <>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 14,
              padding: 14,
              background: 'var(--mv-bg)',
              border: '0.5px solid var(--mv-border)',
              borderRadius: 10,
              marginBottom: 14,
            }}
          >
            {candidates.map((c, i) => {
              const isTop = i === 0;
              const isPicked = picked === c.id;
              return (
                <span key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    onClick={() => setPicked(c.id)}
                    style={{
                      color: isPicked || isTop ? 'var(--mv-color-primary)' : 'var(--mv-text-muted)',
                      fontSize: WORD_SIZES[Math.min(i, WORD_SIZES.length - 1)],
                      fontWeight: isPicked || isTop ? 500 : 400,
                      cursor: 'pointer',
                    }}
                  >
                    {c.name}
                  </span>
                  <IconInfoCircle
                    size={14}
                    color="var(--mv-badge-bg)"
                    style={{ cursor: 'pointer' }}
                    onClick={() => setViewingId(c.id)}
                  />
                </span>
              );
            })}
          </div>
          <p style={{ color: 'var(--mv-badge-bg)', fontSize: 11, margin: '0 0 18px' }}>
            {t('panels.pmAssign.sizedByRanking')}
          </p>

          <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: '0 0 6px' }}>{t('panels.pmAssign.orAssignDirectly')}</p>
          <select
            value={picked}
            onChange={(e) => setPicked(e.target.value)}
            style={{
              width: '100%',
              background: 'var(--mv-bg)',
              border: '0.5px solid var(--mv-border)',
              borderRadius: 8,
              padding: '9px 12px',
              color: 'var(--mv-text)',
              fontSize: 13,
              marginBottom: 14,
              boxSizing: 'border-box',
            }}
          >
            <option value="">{t('panels.pmAssign.chooseAnalyst')}</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            disabled={!picked || assigning}
            onClick={() => assign(picked)}
            style={{
              width: '100%',
              padding: '10px 0',
              background: picked && !assigning ? 'var(--mv-color-primary)' : 'var(--mv-badge-bg)',
              color: picked && !assigning ? 'var(--mv-color-primary-contrast)' : 'var(--mv-badge-text)',
              fontWeight: 500,
              fontSize: 13,
              border: 'none',
              borderRadius: 8,
              cursor: picked && !assigning ? 'pointer' : 'not-allowed',
            }}
          >
            {assigning
              ? t('panels.pmAssign.assigning')
              : pickedCandidate
                ? t('panels.pmAssign.assignTo', { name: pickedCandidate.name })
                : t('panels.pmAssign.assign')}
          </button>

          {assignError && (
            <p style={{ color: 'var(--mv-color-danger)', fontSize: 12, margin: '10px 0 0' }}>{assignError}</p>
          )}
        </>
      )}
    </div>
  );
};

export default PmAssignPanel;
