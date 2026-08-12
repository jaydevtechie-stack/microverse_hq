import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import SentimentBar from './SentimentBar';
import AnalystPicker from './AnalystPicker';
import { authHeaders } from '../services/keycloak';

const selectStyle = {
  width: '100%',
  background: 'var(--mv-bg)',
  border: '0.5px solid var(--mv-border)',
  borderRadius: 8,
  padding: '9px 12px',
  color: 'var(--mv-text)',
  fontSize: 13,
  marginBottom: 14,
  boxSizing: 'border-box',
};

// (4.5) Real reassign/approve/reject, replacing the old hardcoded-option
// stub. Reject opens AnalystPicker (same component PmAssignPanel uses) —
// ARCHITECTURE.md's open question ("same analyst or back into the
// pool?") is resolved as the pool, so rejecting is a full re-pick, not
// an automatic bounce back to whoever did the original work.
//
// SentimentBar stays fed by a hardcoded percent — reading gofeeler's
// real sentiment_results by taskId needs a new Mongo-backed read
// endpoint on the Go service that doesn't exist yet (a separate piece
// of work), so this is left an acknowledged gap rather than faked
// differently than before.
const ReviewerPanel = ({ task, onTaskUpdated }) => {
  const { t } = useTranslation('gofeeler');
  const [candidates, setCandidates] = useState(null);
  const [candidatesError, setCandidatesError] = useState(null);
  const [picked, setPicked] = useState('');
  const [reassigning, setReassigning] = useState(false);
  const [reassignError, setReassignError] = useState(null);
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState(null);
  const [showRejectPicker, setShowRejectPicker] = useState(false);

  useEffect(() => {
    fetch(`/api/tasks/${task.id}/reviewer-candidates`, { headers: authHeaders() })
      .then((res) => {
        if (!res.ok) throw new Error(`task-service returned ${res.status}`);
        return res.json();
      })
      .then(setCandidates)
      .catch((err) => setCandidatesError(err.message));
  }, [task.id]);

  const busy = reassigning || approving;

  const handleReassign = async () => {
    setReassigning(true);
    setReassignError(null);
    try {
      const res = await fetch(`/api/tasks/${task.id}/reviewer`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ reviewerId: picked }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || `task-service returned ${res.status}`);
      onTaskUpdated?.(body);
    } catch (err) {
      setReassignError(err.message);
    } finally {
      setReassigning(false);
    }
  };

  const handleApprove = async () => {
    setApproving(true);
    setApproveError(null);
    try {
      const res = await fetch(`/api/tasks/${task.id}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || `task-service returned ${res.status}`);
      onTaskUpdated?.(body);
    } catch (err) {
      setApproveError(err.message);
    } finally {
      setApproving(false);
    }
  };

  const handleReject = (assigneeId) =>
    fetch(`/api/tasks/${task.id}/reject`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ assigneeId }),
    }).then(async (res) => {
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || `task-service returned ${res.status}`);
      onTaskUpdated?.(body);
    });

  if (showRejectPicker) {
    return (
      <div>
        <span
          onClick={() => setShowRejectPicker(false)}
          style={{ color: 'var(--mv-color-primary)', fontSize: 12, cursor: 'pointer' }}
        >
          {t('panels.reviewer.backToDecision')}
        </span>
        <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: '14px 0 6px' }}>
          {t('panels.reviewer.rejectPickerDescription')}
        </p>
        <AnalystPicker
          taskId={task.id}
          service={task.service}
          onConfirm={handleReject}
          confirmText={t('panels.reviewer.reject')}
          confirmToText={(name) => t('panels.reviewer.confirmReject', { name })}
          confirmingText={t('panels.reviewer.rejecting')}
        />
      </div>
    );
  }

  return (
    <div>
      <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: '0 0 6px' }}>
        {t('panels.reviewer.analystResults')}
      </p>
      <div style={{ marginBottom: 18 }}>
        <SentimentBar label={t('panels.sentimentNegative')} percent={71} />
      </div>

      <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: '0 0 6px' }}>
        {t('panels.reviewer.reassignReviewer')}
      </p>
      {candidatesError && (
        <p style={{ color: 'var(--mv-color-danger)', fontSize: 12, margin: '0 0 8px' }}>
          {t('panels.reviewer.candidatesLoadError', { error: candidatesError })}
        </p>
      )}
      {!candidatesError && !candidates && (
        <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: '0 0 8px' }}>
          {t('panels.reviewer.loadingCandidates')}
        </p>
      )}
      {candidates && (
        <>
          <select value={picked} onChange={(e) => setPicked(e.target.value)} style={selectStyle}>
            <option value="">{t('panels.reviewer.chooseReviewer')}</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.isDefault ? t('panels.reviewer.defaultReviewerSuffix') : ''}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleReassign}
            disabled={!picked || reassigning}
            style={{
              width: '100%',
              padding: '9px 0',
              marginBottom: 18,
              background: picked && !reassigning ? 'var(--mv-color-primary)' : 'var(--mv-badge-bg)',
              color: picked && !reassigning ? 'var(--mv-color-primary-contrast)' : 'var(--mv-badge-text)',
              fontWeight: 500,
              fontSize: 13,
              border: 'none',
              borderRadius: 8,
              cursor: picked && !reassigning ? 'pointer' : 'not-allowed',
            }}
          >
            {reassigning ? t('panels.reviewer.reassigning') : t('panels.reviewer.reassign')}
          </button>
          {reassignError && (
            <p style={{ color: 'var(--mv-color-danger)', fontSize: 12, margin: '-10px 0 18px' }}>
              {t('panels.reviewer.reassignError', { error: reassignError })}
            </p>
          )}
        </>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          type="button"
          onClick={handleApprove}
          disabled={busy}
          style={{
            flex: 1,
            padding: '10px 0',
            background: 'var(--mv-color-success)',
            color: '#0b1a00',
            fontWeight: 500,
            fontSize: 13,
            border: 'none',
            borderRadius: 8,
            cursor: busy ? 'default' : 'pointer',
            opacity: busy ? 0.6 : 1,
          }}
        >
          {approving ? t('panels.reviewer.approving') : t('panels.reviewer.approve')}
        </button>
        <button
          type="button"
          onClick={() => setShowRejectPicker(true)}
          disabled={busy}
          style={{
            flex: 1,
            padding: '10px 0',
            background: 'transparent',
            border: '0.5px solid var(--mv-color-danger)',
            color: 'var(--mv-color-danger)',
            fontWeight: 500,
            fontSize: 13,
            borderRadius: 8,
            cursor: busy ? 'default' : 'pointer',
            opacity: busy ? 0.6 : 1,
          }}
        >
          {t('panels.reviewer.reject')}
        </button>
      </div>

      {approveError && (
        <p style={{ color: 'var(--mv-color-danger)', fontSize: 12, margin: '10px 0 0' }}>
          {t('panels.reviewer.approveError', { error: approveError })}
        </p>
      )}
    </div>
  );
};

export default ReviewerPanel;
