import React, { useState } from 'react';

// Sized by predicted fit — stands in for the recommendation agent
// (ROADMAP.md Branch 4.1.1, not built yet). Hardcoded candidates for
// now, same as the mockup.
const CANDIDATES = [
  { name: 'Jane Doe', fontSize: 19, color: 'var(--mv-color-primary)', weight: 500 },
  { name: 'Agent-03', fontSize: 14, color: 'var(--mv-text-muted)', weight: 400 },
  { name: 'Mark', fontSize: 13, color: 'var(--mv-text-muted)', weight: 400 },
  { name: 'John', fontSize: 11, color: 'var(--mv-badge-bg)', weight: 400 },
];

// Assign is a stub — no PATCH /api/tasks/:id yet (ROADMAP.md Branch 4).
// Picking a name just stages it; the Assign button shows the
// confirmation banner locally rather than actually submitting.
const PmAssignPanel = () => {
  const [picked, setPicked] = useState('');
  const [assigned, setAssigned] = useState(false);

  const pick = (name) => {
    setPicked(name);
    setAssigned(false);
  };

  return (
    <div>
      <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: '0 0 10px' }}>
        Recommended analysts
      </p>
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
        {CANDIDATES.map((c) => (
          <span
            key={c.name}
            onClick={() => pick(c.name)}
            style={{
              color: c.color,
              fontSize: c.fontSize,
              fontWeight: c.weight,
              cursor: 'pointer',
            }}
          >
            {c.name}
          </span>
        ))}
      </div>
      <p style={{ color: 'var(--mv-badge-bg)', fontSize: 11, margin: '0 0 18px' }}>
        Sized by predicted fit — from the recommendation agent
      </p>

      <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: '0 0 6px' }}>
        Or assign directly
      </p>
      <select
        value={picked}
        onChange={(e) => pick(e.target.value)}
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
        {CANDIDATES.map((c) => (
          <option key={c.name}>{c.name}</option>
        ))}
      </select>

      <button
        type="button"
        disabled={!picked}
        onClick={() => setAssigned(true)}
        style={{
          width: '100%',
          padding: '10px 0',
          background: picked ? 'var(--mv-color-primary)' : 'var(--mv-badge-bg)',
          color: picked ? 'var(--mv-color-primary-contrast)' : 'var(--mv-badge-text)',
          fontWeight: 500,
          fontSize: 13,
          border: 'none',
          borderRadius: 8,
          cursor: picked ? 'pointer' : 'not-allowed',
          marginBottom: assigned ? 12 : 0,
        }}
      >
        {picked ? `Assign to ${picked}` : 'Assign'}
      </button>

      {assigned && (
        <div
          style={{
            background: 'color-mix(in srgb, var(--mv-color-primary) 13%, transparent)',
            border: '0.5px solid var(--mv-color-primary)',
            borderRadius: 8,
            padding: '10px 12px',
            color: 'var(--mv-color-primary)',
            fontSize: 12,
          }}
        >
          Assigned to {picked} — order will move to "analyst" status
        </div>
      )}
    </div>
  );
};

export default PmAssignPanel;
