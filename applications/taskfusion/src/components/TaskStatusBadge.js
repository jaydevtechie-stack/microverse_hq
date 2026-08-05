import React from 'react';

// Mirrors ARCHITECTURE.md's task workflow:
// unassigned -> analyst -> reviewer -> done -> paid -> closed
const STATUS_STYLE = {
  unassigned: { bg: 'var(--mv-badge-bg)', fg: 'var(--mv-badge-text)' },
  analyst: { bg: 'var(--mv-color-info)', fg: '#ffffff' },
  reviewer: { bg: 'var(--mv-color-warning)', fg: '#ffffff' },
  done: { bg: 'var(--mv-color-success)', fg: '#ffffff' },
  paid: { bg: 'var(--mv-color-primary)', fg: 'var(--mv-color-primary-contrast)' },
  closed: { bg: 'var(--mv-badge-bg)', fg: 'var(--mv-badge-text)' },
};

const TaskStatusBadge = ({ status }) => {
  const { bg, fg } = STATUS_STYLE[status] || STATUS_STYLE.unassigned;
  return (
    <span
      style={{
        color: fg,
        background: bg,
        fontSize: 11,
        padding: '2px 8px',
        borderRadius: 10,
      }}
    >
      {status}
    </span>
  );
};

export default TaskStatusBadge;
