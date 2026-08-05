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
import CreateOrderPage from './pages/CreateOrderPage';
import TaskDetailPage from './pages/TaskDetailPage';

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

  // PrivateRoute component to protect routes.
  // `roles` — the route renders if the user holds at least one (OR).
  //   Used for platform-function-only checks, e.g. /customer just needs
  //   platform:customer OR platform:project-manager.
  // `requireAllRoles` — the route renders only if the user holds every
  //   one (AND). Used for the two-dimensional model (see
  //   ARCHITECTURE.md's Roles and permissions) where a service-scoped
  //   action needs both a platform function AND a service scope, e.g.
  //   GoFeeler's Create Order page needs platform:customer AND
  //   service:gofeeler — either alone isn't enough.
  const PrivateRoute = ({ element, keycloak, roles, requireAllRoles }) => {
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

    if (requireAllRoles && !requireAllRoles.every((role) => keycloak.hasRealmRole(role))) {
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
                  // Any staff-side platform role + service:gofeeler can view
                  // this page — PM sees every task, analyst/reviewer see only
                  // their own (GofeelerPage does that filtering internally)
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

            <Route
              path="/create"
              element={
                <PrivateRoute
                  element={<CreateOrderPage />}
                  keycloak={keycloak}
                  requireAllRoles={['platform:customer', 'service:gofeeler']}
                />
              }
            />

            {/* Only gofeeler tasks exist right now, so this is gated the
                same as the gofeeler task list itself — will need to key
                off the fetched task's own `service` field once other
                domain services have tasks too */}
            <Route
              path="/task/:id"
              element={
                <PrivateRoute
                  element={<TaskDetailPage />}
                  keycloak={keycloak}
                  roles={['service:gofeeler']}
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
