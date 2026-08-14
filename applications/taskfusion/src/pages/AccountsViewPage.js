// src/pages/AccountsViewPage.js
import React from 'react';
import AccountsProjectsView from '../components/AccountsProjectsView';
import usePageMeta from '../hooks/usePageMeta';

// Own Accounts (task-service branches GET /api/accounts to
// listAccountsForUser server-side for platform:customer), accordion
// expanding into each Account's Projects, with the ability to propose
// a new Project under any of them — starts dormant, pending
// account-manager approval (see AccountsProjectsView). Renamed from
// CustomerPage (route /customer -> /accounts/view, 4.6) — pairs with
// AccountsManagePage (now at /projects/manage) as the two role-scoped
// views over the same shared component.
const AccountsViewPage = () => {
  usePageMeta({ title: 'Microverse - Accounts' });
  return <AccountsProjectsView canCreateProject />;
};

export default AccountsViewPage;
