// src/pages/DeliveryTeamPage.js
import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PlaceholderPage from '../components/PlaceholderPage';
import Subnav from '../components/Subnav';
import usePageMeta from '../hooks/usePageMeta';

const TABS = [
  { id: 'analysts', label: 'Analysts' },
  { id: 'reviewers', label: 'Reviewers' },
];

const NOTES = {
  analysts:
    'Coming soon — master-detail list of analysts in this PM\'s scope, detail shows tasks assigned. Workload/performance metrics deferred to Branch 8.',
  reviewers:
    'Coming soon — master-detail list of reviewers in this PM\'s scope, detail shows tasks assigned. Workload/performance metrics deferred to Branch 8.',
};

// platform:project-manager-gated shell — Analysts/Reviewers subnav
// tabs, both stubs for 4.3. Same shape as AdminPage.js: Delivery team
// is a plain top-nav link (Navbar.js), this in-page Subnav is the
// actual sub-level nav, not a navbar dropdown (see
// platform_projects_hub_and_admin.html's #subnav pattern). Tab is
// URL-driven (route is /pm/delivery-team/:tab) so each tab is a real,
// bookmarkable route.
const DeliveryTeamPage = () => {
  usePageMeta({ title: 'Microverse - Delivery Team' });
  const { tab } = useParams();
  const navigate = useNavigate();

  return (
    <div style={{ margin: 'var(--mv-space-3)' }}>
      <Subnav tabs={TABS} active={tab} onChange={(next) => navigate(`/pm/delivery-team/${next}`)} />
      <PlaceholderPage title={`Delivery team · ${TABS.find((t) => t.id === tab)?.label}`} note={NOTES[tab]} />
    </div>
  );
};

export default DeliveryTeamPage;
