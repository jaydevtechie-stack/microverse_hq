// src/pages/Dashboard.js
import React from 'react';
import { getKeycloak } from '../services/keycloak';

const Dashboard = () => {
  const keycloak = getKeycloak();
  const username = keycloak?.tokenParsed?.preferred_username;

  return (
    <div>
      <h2>Dashboard</h2>
      {username ? <p>Welcome back, {username}.</p> : <p>Welcome back.</p>}
    </div>
  );
};

export default Dashboard;
