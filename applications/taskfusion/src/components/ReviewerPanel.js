import React, { useState } from 'react';
import SentimentBar from './SentimentBar';

// Approve/Reject and reassign are stubs — no PATCH /api/tasks/:id yet
// (ROADMAP.md Branch 4). Note attribution is a placeholder too, since
// versioned notes need their own table (Branch 3.3).
const ReviewerPanel = ({ task }) => {
  const [decision, setDecision] = useState(null);

  return (
    <div>
      <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: '0 0 6px' }}>
        Analyst's results
      </p>
      <div style={{ marginBottom: 6 }}>
        <SentimentBar label="Negative" percent={71} />
      </div>
      <div
        style={{
          background: 'var(--mv-bg)',
          border: '0.5px solid var(--mv-border)',
          borderRadius: 8,
          padding: 10,
          color: 'var(--mv-text-muted)',
          fontSize: 12,
          marginBottom: 18,
        }}
      >
        "Customer seems to be a repeat contact — worth flagging to support lead."{' '}
        <span style={{ color: 'var(--mv-badge-bg)' }}>— {task.assignee}, v1</span>
      </div>

      <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: '0 0 6px' }}>
        Reassign reviewer
      </p>
      <select
        style={{
          width: '100%',
          background: 'var(--mv-bg)',
          border: '0.5px solid var(--mv-border)',
          borderRadius: 8,
          padding: '9px 12px',
          color: 'var(--mv-text)',
          fontSize: 13,
          marginBottom: 18,
          boxSizing: 'border-box',
        }}
      >
        <option>You (default — project manager)</option>
        <option>John (dedicated reviewer)</option>
      </select>

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          type="button"
          onClick={() => setDecision('approved')}
          style={{
            flex: 1,
            padding: '10px 0',
            background: 'var(--mv-color-success)',
            color: '#0b1a00',
            fontWeight: 500,
            fontSize: 13,
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          Approve
        </button>
        <button
          type="button"
          onClick={() => setDecision('rejected')}
          style={{
            flex: 1,
            padding: '10px 0',
            background: 'transparent',
            border: '0.5px solid var(--mv-color-danger)',
            color: 'var(--mv-color-danger)',
            fontWeight: 500,
            fontSize: 13,
            borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          Reject
        </button>
      </div>

      {decision === 'approved' && (
        <p style={{ color: 'var(--mv-color-success)', fontSize: 12, margin: '10px 0 0' }}>
          Approved — order will move to "done" status
        </p>
      )}
      {decision === 'rejected' && (
        <p style={{ color: 'var(--mv-color-danger)', fontSize: 12, margin: '10px 0 0' }}>
          Rejected — order will move back to "analyst" status
        </p>
      )}
    </div>
  );
};

export default ReviewerPanel;
