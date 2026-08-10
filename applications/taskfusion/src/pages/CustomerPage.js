// src/pages/CustomerPage.js
import React from 'react';
import AccountsProjectsView from '../components/AccountsProjectsView';

// Own Accounts (task-service branches GET /api/accounts to
// listAccountsForUser server-side for platform:customer), accordion
// expanding into each Account's Projects, with the ability to propose
// a new Project under any of them — starts dormant, pending
// account-manager approval (see AccountsProjectsView).
const CustomerPage = () => <AccountsProjectsView canCreateProject />;

export default CustomerPage;
