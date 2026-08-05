// src/App.js
import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';  // Use Routes instead of Switch
import { initKeycloak, landingUrl } from './services/keycloak';
import { ThemeProvider } from './context/ThemeContext';
import LandingPage from './pages/LandingPage';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';  // Example protected page
import CustomerPage from './pages/CustomerPage';
import AnalystPage from './pages/AnalystPage';
import GofeelerPage from './pages/GofeelerPage';

// microverse.local carries everything platform-side (landing page,
// /dashboard, /customer, /analyst — path-based). Domain services get
// their own microsite subdomain instead — gofeeler.microverse.local is
// the first one, same app/build, just a different root route.
const isGofeelerHost = window.location.hostname.startsWith('gofeeler.');

// No dedicated /login or /logout pages — keycloak-js already redirects
// to Keycloak's own hosted login/logout flow. Any failure case (no
// session, wrong role) just bounces to the public landing page for
// now; a real 403/error page is future work.
const RedirectToLanding = () => {
  useEffect(() => {
    window.location.href = landingUrl();
  }, []);
  return null;
};

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
      return <RedirectToLanding />;
    }

    if (roles && !roles.some((role) => keycloak.hasRealmRole(role))) {
      return <RedirectToLanding />;
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
                isGofeelerHost ? (
                  <PrivateRoute
                    element={<GofeelerPage />}
                    keycloak={keycloak}
                    roles={['service:gofeeler']}
                  />
                ) : (
                  <LandingPage />
                )
              }
            />
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
