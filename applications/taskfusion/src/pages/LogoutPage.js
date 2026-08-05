// src/pages/LogoutPage.js
import React, { useEffect } from 'react';
import { logout } from '../services/keycloak';

const LogoutPage = () => {
  useEffect(() => {
    logout();
  }, []);

  return (
    <div>
      <p>Logging out...</p>
    </div>
  );
};

export default LogoutPage;
