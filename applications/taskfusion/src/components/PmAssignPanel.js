import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { authHeaders } from '../services/keycloak';
import AnalystPicker from './AnalystPicker';

// PM assigns a specific analyst to this unassigned task (4.1). The
// candidate-picking UI itself (Scout word cloud, dropdown, profile
// toggle) lives in AnalystPicker (4.5) — extracted here so ReviewerPanel's
// reject flow can reuse the exact same "who's available" UI over the
// same recommended-analysts data. This component now only owns the
// assign action and its own copy.
const PmAssignPanel = ({ task, onAssigned }) => {
  const { t } = useTranslation('gofeeler');

  const assign = (assigneeId) =>
    fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ assigneeId }),
    }).then(async (res) => {
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || `task-service returned ${res.status}`);
      onAssigned?.(body);
    });

  return (
    <AnalystPicker
      taskId={task.id}
      service={task.service}
      onConfirm={assign}
      confirmText={t('panels.pmAssign.assign')}
      confirmToText={(name) => t('panels.pmAssign.assignTo', { name })}
      confirmingText={t('panels.pmAssign.assigning')}
    />
  );
};

export default PmAssignPanel;
