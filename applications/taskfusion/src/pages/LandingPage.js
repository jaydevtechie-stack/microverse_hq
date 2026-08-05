// src/pages/LandingPage.js
import React from 'react';
import { login } from '../services/keycloak';

const LandingPage = () => {
  return (
    <div>
      <header>
        <h1>Welcome to Taskfusion</h1>
        <p>Manage your tasks, users, and more with Keycloak authentication.</p>
        <button className="custom-button" onClick={() => login()}>
          Login with Keycloak
        </button>
      </header>
    </div>
  );
};

export default LandingPage;
