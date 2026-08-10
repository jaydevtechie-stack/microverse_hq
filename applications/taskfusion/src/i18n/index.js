// src/i18n/index.js
//
// One namespace per page/feature (mirrors src/pages), plus a shared
// "common" namespace for strings reused across pages (buttons, nav
// labels, etc). Only "en" exists today — this is scaffolding for
// future locales, not a live language switcher yet.
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enCommon from './locales/en/common.json';
import enLanding from './locales/en/landing.json';
import enNavbar from './locales/en/navbar.json';
import enDashboard from './locales/en/dashboard.json';

i18n.use(initReactI18next).init({
  resources: {
    en: {
      common: enCommon,
      landing: enLanding,
      navbar: enNavbar,
      dashboard: enDashboard,
    },
  },
  lng: 'en',
  fallbackLng: 'en',
  defaultNS: 'common',
  ns: ['common', 'landing', 'navbar', 'dashboard'],
  interpolation: {
    escapeValue: false, // React already escapes output
  },
});

export default i18n;
