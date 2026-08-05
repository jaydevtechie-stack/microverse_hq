import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(undefined);

const STORAGE_KEY = 'mv-theme';

function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// Drives the same [data-theme] attribute the design tokens
// (branding/mv-1.0/design-system/tokens.css) already key off — this is
// the only place that decides light vs dark, everything else reacts to it.
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || getSystemTheme();
    } catch {
      return getSystemTheme();
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // localStorage unavailable (private browsing etc) — theme just
        // won't persist across reloads, not worth failing over
      }
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
