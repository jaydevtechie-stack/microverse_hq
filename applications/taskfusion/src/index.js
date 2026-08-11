import React from 'react';
import ReactDOM from 'react-dom/client';  // Ensure this is from 'react-dom/client' for React 18
import './assets/brand/design-system/tokens.css'; // Microverse design tokens, must load before Bootstrap
import './assets/scss/main.scss'; // Bootstrap themed with the design tokens' palette
import './index.css';
import './i18n';
import App from './App';
import reportWebVitals from './metrics/reportWebVitals';  // Import reportWebVitals

// Brand theme override — only the theme named by REACT_APP_BRAND_THEME is
// bundled. `import` can't take a template literal (ES module syntax
// requires a static string), so this uses require(); CRA's DefinePlugin
// inlines process.env.REACT_APP_BRAND_THEME to a literal string before
// webpack resolves the path, so this is one concrete file per build, not
// a wildcard bundle of all three themes. Must match the fallback
// ThemeContext.js uses when setting [data-brand-theme].
const BRAND_THEME = process.env.REACT_APP_BRAND_THEME || 'default';
require(`./assets/brand/design-system/themes/${BRAND_THEME}/css/light.css`);
require(`./assets/brand/design-system/themes/${BRAND_THEME}/css/dark.css`);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Call reportWebVitals to measure performance metrics
reportWebVitals();  // This will log the web vitals data to the console
