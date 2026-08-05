// src/pages/AnalystPage.js
import React from 'react';
import { IconStar } from '@tabler/icons-react';
import { ANALYST, METRICS, TASKS } from '../data/analysts';
import ProfileHeader from '../components/ProfileHeader';
import MetricCard from '../components/MetricCard';
import TaskList from '../components/TaskList';

const AnalystPage = () => (
  <div
    style={{
      background: 'var(--mv-bg-elevated)',
      border: '0.5px solid var(--mv-border)',
      borderRadius: 'var(--mv-radius-lg)',
      margin: 'var(--mv-space-3)',
      padding: '16px 18px',
    }}
  >
    <ProfileHeader
      avatarShape="circle"
      roleType="analyst"
      initials={ANALYST.initials}
      name={ANALYST.name}
      subtitle={
        <>
          {ANALYST.role} · <IconStar size={11} style={{ verticalAlign: -1 }} aria-hidden="true" />{' '}
          {ANALYST.rating} rating
        </>
      }
    />

    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 10,
        marginBottom: 18,
      }}
    >
      {METRICS.map((metric) => (
        <MetricCard key={metric.label} label={metric.label} value={metric.value} />
      ))}
    </div>

    <p style={{ color: 'var(--mv-text)', fontSize: 13, fontWeight: 500, margin: '0 0 8px' }}>
      Current tasks
    </p>
    <TaskList tasks={TASKS} />
  </div>
);

export default AnalystPage;
