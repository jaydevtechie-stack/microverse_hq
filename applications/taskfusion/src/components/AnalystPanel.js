import React, { useEffect, useState } from 'react';
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

// 5.2.1 wired the real POST /analyze call (basic engine only). 5.2.2
// adds the engine choice and, for "advanced", a template picker sourced
// from GET /templates — same fetch-on-mount + controlled-<select>
// pattern as PmAssignPanel's analyst picker. Templates load
// unconditionally on mount (not lazily on switching to "advanced") so
// the dropdown is ready the moment it's shown; a fetch failure only
// disables template choice, not the basic-engine path. Leaving
// templateId empty lets the backend resolve its own system default
// (store.Templates.Resolve) rather than the frontend hardcoding which
// template that is. task.context is still the only analyzable text
// available (see 5.2.1's note on uploaded-file content being out of
// scope). "Move to review" stays a stub — no PATCH /api/tasks/:id
// status transition exists yet (Branch 4's task workflow state
// machine). Comments and customer-facing notes live in
// TaskDetailContent now, not here — visible to any staff role
// regardless of the active action panel.
const AnalystPanel = ({ task }) => {
  const { t } = useTranslation('gofeeler');
  const [note, setNote] = useState('');
  const [movedToReview, setMovedToReview] = useState(false);
  const [engine, setEngine] = useState('basic');
  const [templates, setTemplates] = useState(null);
  const [templatesError, setTemplatesError] = useState(null);
  const [templateId, setTemplateId] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/gofeeler/templates', { headers: authHeaders() })
      .then((res) => {
        if (!res.ok) throw new Error(`gofeeler returned ${res.status}`);
        return res.json();
      })
      .then(setTemplates)
      .catch((err) => setTemplatesError(err.message));
  }, []);

  const hasContent = Boolean(task?.context?.trim());
  const resultTemplate = result?.template_id
    ? templates?.find((tpl) => tpl.id === result.template_id)
    : null;

  const handleAnalyse = async () => {
    setAnalyzing(true);
    setError(null);
    try {
      const res = await fetch('/api/gofeeler/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          text: task.context,
          taskId: task.id,
          engine,
          templateId: engine === 'advanced' && templateId ? templateId : undefined,
        }),
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

  return (
    <div>
      <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: '0 0 6px' }}>{t('panels.analyst.engineLabel')}</p>
      <select value={engine} onChange={(e) => setEngine(e.target.value)} style={selectStyle}>
        <option value="basic">{t('panels.analyst.engineBasic')}</option>
        <option value="advanced">{t('panels.analyst.engineAdvanced')}</option>
      </select>

      {engine === 'advanced' && (
        <>
          <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: '0 0 6px' }}>{t('panels.analyst.templateLabel')}</p>
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            disabled={!templates}
            style={selectStyle}
          >
            <option value="">{t('panels.analyst.templateDefault')}</option>
            {templates?.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {tpl.name}
              </option>
            ))}
          </select>
          {templatesError && (
            <p style={{ color: 'var(--mv-color-danger)', fontSize: 11, margin: '-10px 0 14px' }}>
              {t('panels.analyst.templatesLoadError', { error: templatesError })}
            </p>
          )}
        </>
      )}

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
          <p style={{ color: 'var(--mv-text-muted)', fontSize: 11, margin: '-14px 0 20px' }}>
            {result.llm_provider
              ? t('panels.analyst.resultViaProvider', {
                  engine: result.engine_used,
                  provider: result.llm_provider,
                  model: result.model_version,
                })
              : t('panels.analyst.resultViaEngine', { engine: result.engine_used })}
            {resultTemplate && t('panels.analyst.resultTemplate', { name: resultTemplate.name })}
          </p>
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
