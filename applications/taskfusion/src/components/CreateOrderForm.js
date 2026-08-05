import React, { useState } from 'react';
import { IconUpload } from '@tabler/icons-react';
import TagInput from './TagInput';

const SENTIMENT_VOCAB = [
  'Positive',
  'Negative',
  'Neutral',
  'Mixed',
  'Sarcasm',
  'Urgency',
  'Frustration',
  'Confusion',
  'Gratitude',
  'Escalation',
];

const fieldLabelStyle = {
  color: 'var(--mv-text-muted)',
  fontSize: 12,
  display: 'block',
  marginBottom: 6,
};

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

// The actual form fields — shared by the standalone CreateOrderPage and
// GofeelerSplitView's embedded create panel. Structure/layout only, no
// submission or upload wiring yet. Branch 3 (ROADMAP.md) wires this up:
// 3.1 asset-service/MinIO for the upload field, 3.2 search-service for
// real tag suggestions, 3.3 the comments table (unrelated to this form,
// but same branch).
const CreateOrderForm = () => {
  const [title, setTitle] = useState('');
  const [context, setContext] = useState('');
  const [tags, setTags] = useState(['Negative', 'Urgency']);
  const [fileName, setFileName] = useState(null);

  return (
    <>
      <label style={fieldLabelStyle}>Title</label>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="e.g. Q3 customer support chat review"
        style={fieldInputStyle}
      />

      <label style={fieldLabelStyle}>Context (optional)</label>
      <textarea
        value={context}
        onChange={(e) => setContext(e.target.value)}
        placeholder="Anything the analyst should know before starting..."
        rows={3}
        style={{ ...fieldInputStyle, resize: 'none' }}
      />

      <label style={fieldLabelStyle}>Sentiment focus</label>
      <div style={{ marginBottom: 18 }}>
        <TagInput vocab={SENTIMENT_VOCAB} selected={tags} onChange={setTags} />
      </div>

      <label style={fieldLabelStyle}>Upload content</label>
      <label
        style={{
          display: 'block',
          border: '1px dashed var(--mv-border)',
          borderRadius: 10,
          padding: 22,
          textAlign: 'center',
          marginBottom: 18,
          cursor: 'pointer',
        }}
      >
        <input
          type="file"
          onChange={(e) => setFileName(e.target.files?.[0]?.name || null)}
          style={{ display: 'none' }}
        />
        <IconUpload size={22} color="var(--mv-color-primary)" aria-hidden="true" />
        <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: '8px 0 0' }}>
          {fileName || 'Drag a file here, or click to browse'}
        </p>
        <p style={{ color: 'var(--mv-badge-bg)', fontSize: 11, margin: '2px 0 0' }}>
          Stored via asset-service → MinIO
        </p>
      </label>

      <button
        type="button"
        onClick={() => {
          // Branch 3 wires the real submission call — no order-service
          // endpoint to POST to yet.
        }}
        style={{
          width: '100%',
          padding: '10px 0',
          background: 'var(--mv-color-primary)',
          color: 'var(--mv-color-primary-contrast)',
          fontWeight: 500,
          fontSize: 13,
          border: 'none',
          borderRadius: 8,
          cursor: 'pointer',
        }}
      >
        Create order
      </button>
    </>
  );
};

export default CreateOrderForm;
