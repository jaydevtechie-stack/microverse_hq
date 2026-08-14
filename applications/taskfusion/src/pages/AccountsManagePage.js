// src/pages/AccountsManagePage.js
import React from 'react';
import AccountsProjectsView from '../components/AccountsProjectsView';
import usePageMeta from '../hooks/usePageMeta';

// Every Account (task-service branches GET /api/accounts to
// listAllAccounts server-side for platform:account-manager), same
// accordion + split-view shell AccountsViewPage uses — but
// account-managers create Accounts (not Projects, that's
// customer-initiated), approve the dormant Projects customers propose,
// and (4.7) assign a Project's responsible PM / deactivate a Project.
// Renamed from AmCustomersPage (route /am/customers -> /accounts/manage
// -> /projects/manage) — "Am" prefix read as an unrelated abbreviation
// out of context, and the manage/view split now lives in the URL
// itself rather than the component name. Later moved under /projects
// since assigning a Project's PM is the defining action here.
const AccountsManagePage = () => {
  usePageMeta({ title: 'Microverse - Accounts' });
  return <AccountsProjectsView canCreateAccount canApproveProject canManageProject />;
};

export default AccountsManagePage;
