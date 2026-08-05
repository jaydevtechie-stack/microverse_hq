// src/components/Navbar.js
import React from 'react';
import { Link } from 'react-router-dom';
import { logout } from '../services/keycloak';
import logo from '../assets/brand/microverse-logo.png';

const Navbar = ({ keycloak }) => {
  return (
    <nav>
      <ul>
        <li>
          <Link to="/">
            <img src={logo} alt="Microverse" height="32" />
          </Link>
        </li>
        <li>
          <Link to="/">Home</Link>
        </li>
        {keycloak.authenticated ? (
          <>
            <li>Welcome, {keycloak.tokenParsed.preferred_username}</li>
            <li>
              <button onClick={logout}>Logout</button>
            </li>
          </>
        ) : (
          <li>
            <Link to="/login">Login</Link>
          </li>
        )}
      </ul>
    </nav>
  );
};

export default Navbar;
