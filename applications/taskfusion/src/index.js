import React from 'react';
import ReactDOM from 'react-dom/client';  // Ensure this is from 'react-dom/client' for React 18
import './assets/brand/design-system/tokens.css'; // Microverse design tokens, must load before Bootstrap
// Active brand theme's color overrides — which theme this is was already
// decided at build time (Dockerfile / scripts/sync-brand-assets.js), so
// this app only ever sees these two fixed, theme-agnostic files. It has
// no idea Vienna or Uhuru exist.
import './assets/brand/design-system/theme/light.css';
import './assets/brand/design-system/theme/dark.css';
import './assets/scss/main.scss'; // Bootstrap themed with the design tokens' palette
import './index.css';
import './i18n';
import App from './App';
import reportWebVitals from './metrics/reportWebVitals';  // Import reportWebVitals

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Call reportWebVitals to measure performance metrics
reportWebVitals();  // This will log the web vitals data to the console
