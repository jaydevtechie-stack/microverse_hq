import React from 'react';
import { login } from '../services/keycloak';

const LoginPage = () => {
  return (
    <div>
      <h2>Login Page</h2>
      <p>Login using Keycloak</p>

      <button onClick={() => login()}>Login with Keycloak</button>
    </div>
  );
};

export default LoginPage;
