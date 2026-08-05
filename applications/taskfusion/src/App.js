// src/App.js
import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';  // Use Routes instead of Switch
import { initKeycloak } from './services/keycloak'; // Assuming Keycloak initialization is correct
import { ThemeProvider } from './context/ThemeContext';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';  // Example protected page
import CustomerPage from './pages/CustomerPage';
import AnalystPage from './pages/AnalystPage';

// microverse.local is the public/anonymous surface (landing page);
// dashboard.microverse.local is the authenticated surface — same app,
// same build, just a different root route depending on which hostname
// served the request.
const isDashboardHost = window.location.hostname.startsWith('dashboard.');

const App = () => {
  const [keycloak, setKeycloak] = useState(null);

  useEffect(() => {
    initKeycloak()
      .then((keycloakInstance) => {
        setKeycloak(keycloakInstance);
      })
      .catch((error) => {
        console.error('Keycloak initialization failed:', error);
      });
  }, []);

  // PrivateRoute component to protect routes. `roles`, when given, is a
  // list of realm roles (see ARCHITECTURE.md's `{service}:{function}`
  // convention) — the route renders if the user holds at least one.
  const PrivateRoute = ({ element, keycloak, roles }) => {
    if (!keycloak) {
      // Optionally, you can show a loader or a spinner while keycloak is loading
      return <div>Loading...</div>;
    }

    if (!keycloak.authenticated) {
      // Redirect to login page if not authenticated
      return <Navigate to="/login" />;
    }

    if (roles && !roles.some((role) => keycloak.hasRealmRole(role))) {
      return (
        <div style={{ padding: 'var(--mv-space-4)', color: 'var(--mv-text-muted)' }}>
          You don't have access to this page.
        </div>
      );
    }

    return element;
  };

  return (
    <ThemeProvider>
      <Router>
        <div>
          {/* Chrome follows the session, not the host — a logged-in
              user always gets the navbar; the public landing page only
              stays full-bleed for anonymous visitors */}
          {keycloak && keycloak.authenticated && <Navbar keycloak={keycloak} />}

          {/* Define Routes */}
          <Routes>
            <Route
              path="/"
              element={
                isDashboardHost ? (
                  <PrivateRoute element={<Dashboard />} keycloak={keycloak} />
                ) : (
                  <LandingPage />
                )
              }
            />
            <Route path="/login" element={<LoginPage />} /> {/* Login page */}

            {/* Protected Route */}
            <Route
              path="/dashboard"
              element={<PrivateRoute element={<Dashboard />} keycloak={keycloak} />}
            />

            <Route
              path="/customer"
              element={
                <PrivateRoute
                  element={<CustomerPage />}
                  keycloak={keycloak}
                  roles={['platform:customer', 'platform:project-manager']}
                />
              }
            />

            <Route
              path="/analyst"
              element={
                <PrivateRoute
                  element={<AnalystPage />}
                  keycloak={keycloak}
                  roles={['platform:analyst', 'platform:project-manager']}
                />
              }
            />
          </Routes>
        </div>
      </Router>
    </ThemeProvider>
  );
};

export default App;
