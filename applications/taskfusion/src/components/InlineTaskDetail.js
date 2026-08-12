import React from 'react';
import { useTranslation } from 'react-i18next';
import TaskDetailContent from './TaskDetailContent';

// Wraps the shared TaskDetailContent with a back link — used wherever a
// split view (AccountsProjectsView, ProjectHubPage) swaps its detail
// panel to show a Task in place of whatever was selected before (a
// Project, an Account), rather than navigating away to the standalone
// /task/:id page. `onBack` returns to that prior selection.
const InlineTaskDetail = ({ taskId, onBack }) => {
  const { t } = useTranslation('common');
  return (
    <>
      <span onClick={onBack} style={{ color: 'var(--mv-color-primary)', fontSize: 12, cursor: 'pointer' }}>
        {t('back')}
      </span>
      <div style={{ marginTop: 14 }}>
        <TaskDetailContent id={taskId} />
      </div>
    </>
  );
};

export default InlineTaskDetail;
