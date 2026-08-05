import React from 'react';

const URGENCY_COLOR = {
  ok: 'var(--mv-color-success)',
  warn: 'var(--mv-color-warning)',
  overdue: 'var(--mv-color-danger)',
};

const TaskList = ({ tasks }) => (
  <div style={{ display: 'flex', flexDirection: 'column' }}>
    {tasks.map((task) => (
      <div
        key={task.id}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 4px',
          borderBottom: '0.5px solid var(--mv-border)',
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: URGENCY_COLOR[task.urgency] || 'var(--mv-badge-bg)',
            flexShrink: 0,
          }}
        />
        <span style={{ color: 'var(--mv-text)', fontSize: 13, flex: 1 }}>
          {task.id} · {task.service}
        </span>
        <span style={{ color: 'var(--mv-text-muted)', fontSize: 12 }}>{task.due}</span>
      </div>
    ))}
  </div>
);

export default TaskList;
