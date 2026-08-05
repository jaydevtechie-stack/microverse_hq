// src/pages/LandingPage.js
import React from 'react';
import { login } from '../services/keycloak';

// Public/anonymous surface, served on microverse.local. Authenticated
// users never see this — App.js routes them straight to the dashboard
// host instead. Registration (customer / analyst) is deliberately left
// out for now, pending a real role-vetting flow design.
const LandingPage = () => {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundImage: 'var(--mv-bg-image-url)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        padding: 'var(--mv-space-4)',
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 'var(--mv-radius-lg)',
          boxShadow: 'var(--mv-shadow)',
          padding: 'var(--mv-space-5)',
          maxWidth: 420,
          width: '100%',
          textAlign: 'center',
        }}
      >
        <h1 style={{ color: '#0b0f2e', fontSize: 28, margin: '0 0 12px' }}>
          Welcome to Microverse
        </h1>
        <p style={{ color: '#4a5a8a', fontSize: 14, lineHeight: 1.6, margin: '0 0 28px' }}>
          Microverse started as a playground for exploring how a dozen
          different languages and frameworks could work together as one
          real platform, instead of one big app pretending to be many.
          Every service here — from sentiment analysis to time tracking
          to billing — keeps its own tech and its own personality, all
          orchestrated behind a single front door.
        </p>
        <button
          onClick={() => login()}
          style={{
            background: 'var(--mv-color-primary)',
            color: 'var(--mv-color-primary-contrast)',
            border: 'none',
            borderRadius: 'var(--mv-radius)',
            padding: '12px 32px',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Login
        </button>
      </div>
    </div>
  );
};

export default LandingPage;
