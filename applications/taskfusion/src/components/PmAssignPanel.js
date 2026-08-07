import React, { useEffect, useState } from 'react';
import { authHeaders } from '../services/keycloak';

// Candidates rendered at equal size for now — Scout (4.1.1, the
// recommendation agent) is what will eventually size/weight these by
// predicted fit; until it exists there's no real signal to size by,
// so a fake weighting would just be decoration. Word cloud and the
// plain dropdown below share the same `picked` state — "kept in sync"
// per ROADMAP.md 4.1.
const PmAssignPanel = ({ task, onAssigned }) => {
  const [candidates, setCandidates] = useState(null);
  const [fetchError, setFetchError] = useState(null);
  const [picked, setPicked] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState(null);

  useEffect(() => {
    fetch(`/api/users?platformRole=platform:analyst&service=${task.service}`, { headers: authHeaders() })
      .then((res) => {
        if (!res.ok) throw new Error(`task-service returned ${res.status}`);
        return res.json();
      })
      .then(setCandidates)
      .catch((err) => setFetchError(err.message));
  }, [task.service]);

  const pickedCandidate = candidates?.find((c) => c.id === picked);

  const assign = () => {
    setAssigning(true);
    setAssignError(null);
    fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ assigneeId: picked }),
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

  return (
    <div>
      <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: '0 0 10px' }}>
        Candidate analysts
      </p>

      {fetchError && (
        <p style={{ color: 'var(--mv-color-danger)', fontSize: 12, marginBottom: 14 }}>
          Couldn't load candidates: {fetchError}
        </p>
      )}

      {!fetchError && !candidates && (
        <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, marginBottom: 14 }}>Loading candidates…</p>
      )}

      {candidates?.length === 0 && (
        <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, marginBottom: 14 }}>
          No active analyst holds platform:analyst + service:{task.service} yet.
        </p>
      )}

      {candidates?.length > 0 && (
        <>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 10,
              padding: 14,
              background: 'var(--mv-bg)',
              border: '0.5px solid var(--mv-border)',
              borderRadius: 10,
              marginBottom: 14,
            }}
          >
            {candidates.map((c) => (
              <span
                key={c.id}
                onClick={() => setPicked(c.id)}
                style={{
                  color: picked === c.id ? 'var(--mv-color-primary)' : 'var(--mv-text-muted)',
                  fontSize: 14,
                  fontWeight: picked === c.id ? 500 : 400,
                  cursor: 'pointer',
                }}
              >
                {c.name}
              </span>
            ))}
          </div>

          <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: '0 0 6px' }}>Or assign directly</p>
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
            <option value="">Choose an analyst...</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            disabled={!picked || assigning}
            onClick={assign}
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
            {assigning ? 'Assigning…' : pickedCandidate ? `Assign to ${pickedCandidate.name}` : 'Assign'}
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
