// src/pages/AmCustomersPage.js
import React from 'react';
import AccountsProjectsView from '../components/AccountsProjectsView';
import usePageMeta from '../hooks/usePageMeta';

// Every Account (task-service branches GET /api/accounts to
// listAllAccounts server-side for platform:account-manager), same
// accordion + split-view shell CustomerPage uses — but account-managers
// create Accounts (not Projects, that's customer-initiated) and approve
// the dormant Projects customers propose.
const AmCustomersPage = () => {
  usePageMeta({ title: 'Microverse - Accounts' });
  return <AccountsProjectsView canCreateAccount canApproveProject />;
};

export default AmCustomersPage;
