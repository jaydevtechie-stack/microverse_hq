import React, { useState } from 'react';
import SentimentBar from './SentimentBar';

// Dummy result — GoFeeler's real /analyze endpoint exists but isn't
// wired to tasks yet (no stored content to feed it; that's Branch 3.1
// MinIO + Branch 5 LLM integration). "Analyse" and "Move to review"
// are stubs — no PATCH /api/tasks/:id yet either (Branch 4). Comments
// and customer-facing notes live in TaskDetailContent now, not here —
// visible to any staff role regardless of the active action panel.
const AnalystPanel = () => {
  const [note, setNote] = useState('');
  const [movedToReview, setMovedToReview] = useState(false);

  return (
    <div>
      <button
        type="button"
        style={{
          padding: '8px 18px',
          background: 'var(--mv-color-primary)',
          color: 'var(--mv-color-primary-contrast)',
          fontWeight: 500,
          fontSize: 12,
          border: 'none',
          borderRadius: 8,
          marginBottom: 18,
          cursor: 'pointer',
        }}
      >
        Analyse
      </button>

      <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: '0 0 8px' }}>Results</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
        <SentimentBar label="Negative" percent={71} />
      </div>

      <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: '0 0 8px' }}>Add a note</p>
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Add a note..."
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
        Move to review
      </button>

      {movedToReview && (
        <p style={{ color: 'var(--mv-color-primary)', fontSize: 12, margin: '10px 0 0' }}>
          Sent to review — order will move to "reviewer" status
        </p>
      )}
    </div>
  );
};

export default AnalystPanel;
