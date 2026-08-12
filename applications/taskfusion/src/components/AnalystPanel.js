import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import SentimentBar from './SentimentBar';
import { authHeaders } from '../services/keycloak';

// Sentiment → bar color; anything the engine returns outside these three
// (shouldn't happen — basic/advanced both only emit positive/negative/
// neutral) falls back to the neutral color rather than throwing.
const SENTIMENT_COLOR = {
  positive: 'var(--mv-color-success)',
  negative: 'var(--mv-color-danger)',
  neutral: 'var(--mv-color-warning)',
};

// 5.2.1 — real POST /analyze wiring, basic engine only (engine field
// omitted, same as every pre-Branch-5 caller). No engine/template
// picker yet — that's 5.2.2, once there's an advanced engine +
// PATCH /templates/:id to actually pick from. task.context is the only
// analyzable text available today; uploaded-file content isn't fed in
// yet (would need a MinIO fetch, out of this scope). taskId is passed
// through so 5.3's fire-and-forget Mongo persistence gets exercised
// for real from the UI, not just via curl. "Move to review" stays a
// stub — no PATCH /api/tasks/:id status transition exists yet (Branch
// 4's task workflow state machine). Comments and customer-facing notes
// live in TaskDetailContent now, not here — visible to any staff role
// regardless of the active action panel.
const AnalystPanel = ({ task }) => {
  const { t } = useTranslation('gofeeler');
  const [note, setNote] = useState('');
  const [movedToReview, setMovedToReview] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const hasContent = Boolean(task?.context?.trim());

  const handleAnalyse = async () => {
    setAnalyzing(true);
    setError(null);
    try {
      const res = await fetch('/api/gofeeler/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ text: task.context, taskId: task.id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `gofeeler returned ${res.status}`);
      }
      setResult(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={handleAnalyse}
        disabled={analyzing || !hasContent}
        style={{
          padding: '8px 18px',
          background: 'var(--mv-color-primary)',
          color: 'var(--mv-color-primary-contrast)',
          fontWeight: 500,
          fontSize: 12,
          border: 'none',
          borderRadius: 8,
          marginBottom: 18,
          cursor: analyzing || !hasContent ? 'default' : 'pointer',
          opacity: analyzing || !hasContent ? 0.6 : 1,
        }}
      >
        {analyzing ? t('panels.analyst.analysing') : t('panels.analyst.analyse')}
      </button>

      {!hasContent && (
        <p style={{ color: 'var(--mv-text-muted)', fontSize: 11, margin: '-10px 0 18px' }}>
          {t('panels.analyst.noContent')}
        </p>
      )}
      {error && (
        <p style={{ color: 'var(--mv-color-danger)', fontSize: 11, margin: '-10px 0 18px' }}>
          {t('panels.analyst.analyseError', { error })}
        </p>
      )}

      {result && (
        <>
          <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: '0 0 8px' }}>{t('panels.analyst.results')}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
            <SentimentBar
              label={t(`panels.sentiment.${result.sentiment}`)}
              percent={Math.round(result.confidence * 100)}
              color={SENTIMENT_COLOR[result.sentiment] || SENTIMENT_COLOR.neutral}
            />
          </div>
        </>
      )}

      <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: '0 0 8px' }}>{t('panels.analyst.addNote')}</p>
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={t('panels.analyst.notePlaceholder')}
        style={{
          width: '100%',
          background: 'var(--mv-bg)',
          border: '0.5px solid var(--mv-border)',
          borderRadius: 8,
          padding: '8px 12px',
          color: 'var(--mv-text)',
          fontSize: 12,
          marginBottom: 18,
          boxSizing: 'border-box',
        }}
      />

      <button
        type="button"
        onClick={() => setMovedToReview(true)}
        style={{
          width: '100%',
          padding: '10px 0',
          background: 'var(--mv-bg)',
          border: '0.5px solid var(--mv-border)',
          color: 'var(--mv-text)',
          fontWeight: 500,
          fontSize: 13,
          borderRadius: 8,
          cursor: 'pointer',
        }}
      >
        {t('panels.analyst.moveToReview')}
      </button>

      {movedToReview && (
        <p style={{ color: 'var(--mv-color-primary)', fontSize: 12, margin: '10px 0 0' }}>
          {t('panels.analyst.sentToReview')}
        </p>
      )}
    </div>
  );
};

export default AnalystPanel;
