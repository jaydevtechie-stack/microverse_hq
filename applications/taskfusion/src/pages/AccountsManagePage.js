// src/pages/AccountsManagePage.js
import React from 'react';
import AccountsProjectsView from '../components/AccountsProjectsView';
import usePageMeta from '../hooks/usePageMeta';

// Every Account (task-service branches GET /api/accounts to
// listAllAccounts server-side for platform:account-manager), same
// accordion + split-view shell AccountsViewPage uses — but
// account-managers create Accounts (not Projects, that's
// customer-initiated) and approve the dormant Projects customers
// propose. Renamed from AmCustomersPage (route /am/customers ->
// /accounts/manage) — "Am" prefix read as an unrelated abbreviation
// out of context, and the manage/view split now lives in the URL
// itself rather than the component name.
const AccountsManagePage = () => {
  usePageMeta({ title: 'Microverse - Accounts' });
  return <AccountsProjectsView canCreateAccount canApproveProject />;
};

export default AccountsManagePage;
