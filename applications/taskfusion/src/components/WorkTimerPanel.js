import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getKeycloak, authHeaders } from '../services/keycloak';

// Where a session's id is remembered between page loads — ElixTempo has
// no "find the open session for this analyst+quest" endpoint (Phase 3's
// query surface is aggregate hours, not a live lookup), so a refresh
// mid-session would otherwise have no way to rediscover it. Single-
// browser only, deliberately not solved server-side here — a documented
// v1 gap, not a hidden one.
const storageKey = (taskId) => `elixtempo-session-${taskId}`;

function formatElapsed(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

// Analyst-only start/pause/resume/stop widget for the work session
// backing this task — ElixTempo's own session lifecycle (see
// docs/roadmap/1.1/domain-services.md's Phase 5). Rendered as a sibling
// of actionPanelFor's dispatch, not folded into it: a timer can keep
// running across whatever the task's own status is, it isn't itself a
// task-workflow transition.
const WorkTimerPanel = ({ task }) => {
  const { t } = useTranslation('gofeeler');
  const analystId = getKeycloak()?.tokenParsed?.sub;

  const [session, setSession] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const tickRef = useRef(null);

  // On mount, try to resume whatever session localStorage remembers for
  // this task — a stopped/vanished one just clears the stale pointer.
  useEffect(() => {
    const storedId = localStorage.getItem(storageKey(task.id));
    if (!storedId) return;

    fetch(`/api/sessions/${storedId}`, { headers: authHeaders() })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.status !== 'stopped') {
          setSession(data);
          setElapsed(data.elapsed_seconds);
        } else {
          localStorage.removeItem(storageKey(task.id));
        }
      })
      .catch(() => {});
  }, [task.id]);

  // Client-side ticking is display-only — the server is still the
  // source of truth for elapsed_seconds; every action re-syncs from its
  // response rather than trusting the running local count.
  useEffect(() => {
    if (session?.status === 'running') {
      tickRef.current = setInterval(() => setElapsed((prev) => prev + 1), 1000);
    } else if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [session?.status]);

  const call = async (path, method) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(path, {
        method,
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: method === 'POST' && path === '/api/sessions'
          ? JSON.stringify({ analyst_id: analystId, quest_id: task.id })
          : undefined,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `elixtempo returned ${res.status}`);
      return body;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setBusy(false);
    }
  };

  const start = async () => {
    const data = await call('/api/sessions', 'POST');
    if (!data) return;
    setSession(data);
    setElapsed(data.elapsed_seconds);
    localStorage.setItem(storageKey(task.id), data.id);
  };

  const pause = async () => {
    const data = await call(`/api/sessions/${session.id}/pause`, 'POST');
    if (data) setSession(data);
  };

  const resume = async () => {
    const data = await call(`/api/sessions/${session.id}/resume`, 'POST');
    if (!data) return;
    setSession(data);
    setElapsed(data.elapsed_seconds);
  };

  const stop = async () => {
    const data = await call(`/api/sessions/${session.id}/stop`, 'POST');
    if (!data) return;
    setSession(data);
    localStorage.removeItem(storageKey(task.id));
  };

  const buttonStyle = (primary) => ({
    padding: '8px 18px',
    background: primary ? 'var(--mv-color-primary)' : 'var(--mv-bg)',
    color: primary ? 'var(--mv-color-primary-contrast)' : 'var(--mv-text)',
    border: primary ? 'none' : '0.5px solid var(--mv-border)',
    fontWeight: 500,
    fontSize: 12,
    borderRadius: 8,
    cursor: busy ? 'default' : 'pointer',
    opacity: busy ? 0.6 : 1,
  });

  return (
    <div
      style={{
        background: 'var(--mv-bg)',
        border: '0.5px solid var(--mv-border)',
        borderRadius: 8,
        padding: 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: 0 }}>{t('panels.workTimer.title')}</p>
        <span style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 600, color: 'var(--mv-text)' }}>
          {formatElapsed(elapsed)}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        {(!session || session.status === 'stopped') && (
          <button type="button" onClick={start} disabled={busy} style={buttonStyle(true)}>
            {busy ? t('panels.workTimer.starting') : t('panels.workTimer.start')}
          </button>
        )}
        {session?.status === 'running' && (
          <>
            <button type="button" onClick={pause} disabled={busy} style={buttonStyle(false)}>
              {t('panels.workTimer.pause')}
            </button>
            <button type="button" onClick={stop} disabled={busy} style={buttonStyle(false)}>
              {t('panels.workTimer.stop')}
            </button>
          </>
        )}
        {session?.status === 'paused' && (
          <>
            <button type="button" onClick={resume} disabled={busy} style={buttonStyle(true)}>
              {t('panels.workTimer.resume')}
            </button>
            <button type="button" onClick={stop} disabled={busy} style={buttonStyle(false)}>
              {t('panels.workTimer.stop')}
            </button>
          </>
        )}
      </div>

      {error && (
        <p style={{ color: 'var(--mv-color-danger)', fontSize: 11, margin: '10px 0 0' }}>
          {t('panels.workTimer.actionError', { error })}
        </p>
      )}
    </div>
  );
};

export default WorkTimerPanel;
