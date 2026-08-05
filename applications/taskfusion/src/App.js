// src/App.js
import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';  // Use Routes instead of Switch
import { initKeycloak } from './services/keycloak'; // Assuming Keycloak initialization is correct
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';  // Example protected page

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
    <Router>
      <div>
        {/* Show Navbar if Keycloak is initialized */}
        {keycloak && <Navbar keycloak={keycloak} />}

        {/* Define Routes */}
        <Routes>
          <Route path="/" element={<LandingPage />} /> {/* Landing page */}
          <Route path="/login" element={<LoginPage />} /> {/* Login page */}

          {/* Protected Route */}
          <Route
            path="/dashboard"
            element={<PrivateRoute element={<Dashboard />} keycloak={keycloak} />}
          />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
