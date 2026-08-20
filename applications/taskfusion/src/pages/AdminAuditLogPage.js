import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import SplitView from '../components/SplitView';
import { authHeaders } from '../services/keycloak';
import timeAgo from '../utils/timeAgo';

// audit-service's two metrics endpoints return either a plain ms number
// (processing-time) or a Postgres interval object (reaction-time,
// timeline's time_in_status) — this formats either into one short string.
function formatDuration(value) {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'number' || typeof value === 'string') {
    const ms = Number(value);
    if (Number.isNaN(ms)) return '—';
    return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(2)} s`;
  }
  const parts = [];
  if (value.days) parts.push(`${value.days}d`);
  if (value.hours) parts.push(`${value.hours}h`);
  if (value.minutes) parts.push(`${value.minutes}m`);
  const seconds = (value.seconds || 0) + (value.milliseconds || 0) / 1000;
  if (seconds || parts.length === 0) parts.push(`${seconds < 10 ? seconds.toFixed(1) : Math.round(seconds)}s`);
  return parts.join(' ');
}

const MetricCard = ({ title, metric, sampleLabel }) => {
  const { t } = useTranslation('admin');
  return (
    <div
      style={{
        flex: 1,
        background: 'var(--mv-bg-elevated)',
        border: '0.5px solid var(--mv-border)',
        borderRadius: 'var(--mv-radius-lg)',
        padding: 16,
      }}
    >
      <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: '0 0 10px' }}>{title}</p>
      {!metric ? (
        <p style={{ color: 'var(--mv-text-muted)', fontSize: 13, margin: 0 }}>{t('auditLog.loading')}</p>
      ) : metric.sampleSize === 0 ? (
        <p style={{ color: 'var(--mv-text-muted)', fontSize: 13, margin: 0 }}>{t('auditLog.noData')}</p>
      ) : (
        <div style={{ display: 'flex', gap: 20 }}>
          <div>
            <p style={{ color: 'var(--mv-text)', fontSize: 18, fontWeight: 500, margin: 0 }}>
              {formatDuration(metric.avg)}
            </p>
            <p style={{ color: 'var(--mv-badge-bg)', fontSize: 11, margin: '2px 0 0' }}>{t('auditLog.avgLabel')}</p>
          </div>
          <div>
            <p style={{ color: 'var(--mv-text)', fontSize: 18, fontWeight: 500, margin: 0 }}>
              {formatDuration(metric.p50)}
            </p>
            <p style={{ color: 'var(--mv-badge-bg)', fontSize: 11, margin: '2px 0 0' }}>{t('auditLog.p50Label')}</p>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <p style={{ color: 'var(--mv-badge-bg)', fontSize: 11, margin: 0 }}>
              {t(sampleLabel, { count: metric.sampleSize })}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

const EventList = ({ events, error, selectedTaskId, onSelect }) => {
  const { t } = useTranslation('admin');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '14px 16px', borderBottom: '0.5px solid var(--mv-border)' }}>
        <span style={{ color: 'var(--mv-text)', fontSize: 13, fontWeight: 500 }}>{t('auditLog.headerTitle')}</span>
      </div>
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {error && (
          <p style={{ color: 'var(--mv-color-danger)', fontSize: 13, padding: '12px 16px' }}>
            {t('auditLog.loadError', { error })}
          </p>
        )}
        {!error && !events && (
          <p style={{ color: 'var(--mv-text-muted)', fontSize: 13, padding: '12px 16px' }}>{t('auditLog.loading')}</p>
        )}
        {events?.length === 0 && (
          <p style={{ color: 'var(--mv-text-muted)', fontSize: 13, padding: '12px 16px' }}>{t('auditLog.empty')}</p>
        )}
        {events?.map((row, i) => {
          const isSelected = row.task_id === selectedTaskId;
          return (
            <div
              key={`${row.task_id}-${row.occurred_at}-${i}`}
              onClick={() => onSelect(row.task_id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                padding: '12px 16px',
                borderBottom: '0.5px solid var(--mv-border)',
                cursor: 'pointer',
                background: isSelected ? 'var(--mv-bg)' : 'transparent',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span
                  style={{
                    color: isSelected ? 'var(--mv-text)' : 'var(--mv-text-muted)',
                    fontSize: 13,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {row.event}
                </span>
                <span style={{ color: 'var(--mv-badge-bg)', fontSize: 11, whiteSpace: 'nowrap' }}>
                  {timeAgo(row.occurred_at)}
                </span>
              </div>
              <span style={{ color: 'var(--mv-badge-bg)', fontSize: 11, whiteSpace: 'nowrap' }}>
                {row.owner || row.assignee || t('auditLog.noOwner')}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const TaskTimeline = ({ taskId, timeline, error, onClose }) => {
  const { t } = useTranslation('admin');
  return (
    <>
      <span onClick={onClose} style={{ color: 'var(--mv-color-primary)', fontSize: 12, cursor: 'pointer' }}>
        {t('common:back')}
      </span>

      <p style={{ color: 'var(--mv-text)', fontSize: 14, fontWeight: 500, margin: '14px 0 4px', wordBreak: 'break-all' }}>
        {taskId}
      </p>

      {error && (
        <p style={{ color: 'var(--mv-color-danger)', fontSize: 13 }}>{t('auditLog.loadError', { error })}</p>
      )}
      {!error && !timeline && (
        <p style={{ color: 'var(--mv-text-muted)', fontSize: 13 }}>{t('auditLog.loading')}</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginTop: 12 }}>
        {timeline?.map((step, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              gap: 10,
              padding: '10px 0',
              borderBottom: i < timeline.length - 1 ? '0.5px solid var(--mv-border)' : 'none',
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: 'var(--mv-color-primary)',
                flexShrink: 0,
                marginTop: 6,
              }}
            />
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ color: 'var(--mv-text)', fontSize: 13, margin: 0 }}>{step.event}</p>
              {(step.status || step.owner || step.assignee) && (
                <p style={{ color: 'var(--mv-text-muted)', fontSize: 11, margin: '2px 0 0' }}>
                  {[step.status, step.owner || step.assignee].filter(Boolean).join(' · ')}
                </p>
              )}
              <p style={{ color: 'var(--mv-badge-bg)', fontSize: 11, margin: '2px 0 0' }}>
                {new Date(step.occurred_at).toLocaleString()}
                {step.duration_ms !== null && step.duration_ms !== undefined
                  ? ` · ${t('auditLog.tookLabel', { duration: formatDuration(step.duration_ms) })}`
                  : step.time_in_status
                    ? ` · ${t('auditLog.timeInStatusLabel', { duration: formatDuration(step.time_in_status) })}`
                    : ''}
              </p>
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

// Fills in Admin's `/admin/audit-log` Subnav tab (previously a
// PlaceholderPage — see nav-config.json's audit-log entry) with real data
// from audit-service (Branch 8). Metrics cards read the two aggregate
// endpoints; the split view's list is a recent-activity feed
// (GET /audit/events) that drills into a task's full timeline
// (GET /audit/tasks/:taskId) on click — the same list+detail shape every
// other Admin tab already uses (SplitView).
const AdminAuditLogPage = () => {
  const { t } = useTranslation('admin');
  const [events, setEvents] = useState(null);
  const [eventsError, setEventsError] = useState(null);
  const [processingTime, setProcessingTime] = useState(null);
  const [reactionTime, setReactionTime] = useState(null);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [timeline, setTimeline] = useState(null);
  const [timelineError, setTimelineError] = useState(null);

  useEffect(() => {
    fetch('/api/audit/events?limit=50', { headers: authHeaders() })
      .then((res) => {
        if (!res.ok) throw new Error(`audit-service returned ${res.status}`);
        return res.json();
      })
      .then(setEvents)
      .catch((err) => setEventsError(err.message));

    fetch('/api/audit/metrics/processing-time', { headers: authHeaders() })
      .then((res) => res.json())
      .then((m) => setProcessingTime({ avg: m.avg_ms, p50: m.p50_ms, sampleSize: m.sample_size }))
      .catch(() => {});

    fetch('/api/audit/metrics/reaction-time', { headers: authHeaders() })
      .then((res) => res.json())
      .then((m) => setReactionTime({ avg: m.avg_reaction, p50: m.p50_reaction, sampleSize: m.sample_size }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedTaskId) {
      setTimeline(null);
      setTimelineError(null);
      return;
    }
    setTimeline(null);
    setTimelineError(null);
    fetch(`/api/audit/tasks/${selectedTaskId}`, { headers: authHeaders() })
      .then((res) => {
        if (!res.ok) throw new Error(`audit-service returned ${res.status}`);
        return res.json();
      })
      .then(setTimeline)
      .catch((err) => setTimelineError(err.message));
  }, [selectedTaskId]);

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <MetricCard
          title={t('auditLog.processingTimeTitle')}
          metric={processingTime}
          sampleLabel="auditLog.sampleCountAnalyses"
        />
        <MetricCard
          title={t('auditLog.reactionTimeTitle')}
          metric={reactionTime}
          sampleLabel="auditLog.sampleCountAssignments"
        />
      </div>
      <SplitView
        open={Boolean(selectedTaskId)}
        listPanel={
          <EventList events={events} error={eventsError} selectedTaskId={selectedTaskId} onSelect={setSelectedTaskId} />
        }
        detailPanel={
          selectedTaskId && (
            <TaskTimeline
              taskId={selectedTaskId}
              timeline={timeline}
              error={timelineError}
              onClose={() => setSelectedTaskId(null)}
            />
          )
        }
      />
    </div>
  );
};

export default AdminAuditLogPage;
