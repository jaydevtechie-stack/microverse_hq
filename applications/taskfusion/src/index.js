import React from 'react';
import ReactDOM from 'react-dom/client';  // Ensure this is from 'react-dom/client' for React 18
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
