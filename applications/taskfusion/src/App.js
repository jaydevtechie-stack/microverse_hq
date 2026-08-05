// src/App.js
import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';  // Use Routes instead of Switch
import { initKeycloak } from './services/keycloak'; // Assuming Keycloak initialization is correct
import { ThemeProvider } from './context/ThemeContext';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';  // Example protected page

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

  // PrivateRoute component to protect routes
  const PrivateRoute = ({ element, keycloak }) => {
    if (!keycloak) {
      // Optionally, you can show a loader or a spinner while keycloak is loading
      return <div>Loading...</div>;
    }

    if (!keycloak.authenticated) {
      // Redirect to login page if not authenticated
      return <Navigate to="/login" />;
    }

    return element;
  };

  return (
    <ThemeProvider>
      <Router>
        <div>
          {/* Only the dashboard host gets the app chrome — the public
              landing page is a full-bleed, standalone front door */}
          {isDashboardHost && keycloak && <Navbar keycloak={keycloak} />}

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
          </Routes>
        </div>
      </Router>
    </ThemeProvider>
  );
};

export default App;
