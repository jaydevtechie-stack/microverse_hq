// src/pages/TaskDetailPage.js
import React from 'react';
import { useParams } from 'react-router-dom';
import TaskDetailContent from '../components/TaskDetailContent';
import CloseButton from '../components/CloseButton';
import usePageMeta from '../hooks/usePageMeta';

// Standalone full-page version, used off the gofeeler microsite. On the
// gofeeler microsite itself, GofeelerSplitView renders TaskDetailContent
// inline as a panel instead of navigating to a whole new page.
const TaskDetailPage = () => {
  const { id } = useParams();
  usePageMeta({ title: 'Microverse - Task' });

  return (
    <div
      style={{
        position: 'relative',
        background: 'var(--mv-bg-elevated)',
        border: '0.5px solid var(--mv-border)',
        borderRadius: 'var(--mv-radius-lg)',
        margin: 'var(--mv-space-3)',
        padding: '16px 18px',
        maxWidth: 520,
      }}
    >
      <CloseButton />
      <TaskDetailContent id={id} />
    </div>
  );
};

export default TaskDetailPage;
