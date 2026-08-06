import Keycloak from 'keycloak-js';

let keycloak;

// microverse.local carries everything platform-side (landing page,
// /dashboard, /customer, /analyst — path-based, not subdomain-based).
// Domain services get their own "microsite" subdomain instead (e.g.
// gofeeler.microverse.local). This list is just the microsites, so
// cross-service links can strip whichever one is currently active to
// get back to the bare host, or jump to another microsite.
const KNOWN_MICROSITES = ['gofeeler'];

function baseHostname() {
  const { hostname } = window.location;
  const prefix = KNOWN_MICROSITES.find((sub) => hostname.startsWith(`${sub}.`));
  return prefix ? hostname.slice(prefix.length + 1) : hostname;
}

function hostUrl(subdomain) {
  const { protocol, port } = window.location;
  const host = subdomain ? `${subdomain}.${baseHostname()}` : baseHostname();
  return `${protocol}//${host}${port ? `:${port}` : ''}`;
}

// Exposed generically so components (e.g. the dashboard's ServiceCard,
// or Navbar's cross-microsite nav links) can link to whichever host
// without keycloak.js needing a named export per service.
export const hostUrlForSubdomain = hostUrl;

// True when the current page is a domain-service microsite rather than
// the platform host — Navbar uses this to decide whether its
// Dashboard/Customer/Analyst links need to be cross-origin.
export const isOnMicrosite = () =>
  KNOWN_MICROSITES.some((sub) => window.location.hostname.startsWith(`${sub}.`));

export const initKeycloak = () => {
  return new Promise((resolve, reject) => {
    keycloak = new Keycloak({
      url: process.env.REACT_APP_KEYCLOAK_URL,
      realm: process.env.REACT_APP_KEYCLOAK_REALM,
      clientId: process.env.REACT_APP_KEYCLOAK_CLIENT_ID,
    });

    // check-sso: silently detect an existing session without forcing a
    // redirect, so public routes (landing, login) can render unauthenticated
    keycloak
      .init({ onLoad: 'check-sso', pkceMethod: 'S256' })
      .then(() => resolve(keycloak))
      .catch(reject);
  });
};

// Delegates to keycloak-js so it builds the auth URL itself (PKCE
// code_challenge, state, nonce) instead of a hand-built query string.
export const login = (redirectUri) => {
  if (!keycloak) return;
  keycloak.login({ redirectUri: redirectUri || `${hostUrl(null)}/dashboard` });
};

// The landing page only exists on the bare (non-microsite) host, so
// linking to it from a microsite needs a real cross-origin URL, not a
// client-side route.
export const landingUrl = () => `${hostUrl(null)}/`;

export const getKeycloak = () => keycloak;
export const getToken = () => keycloak.token;

// For fetch() calls that need the caller's identity on the backend
// (e.g. task-service's JIT user-sync middleware) — spread into a
// fetch's headers object. Omits Authorization entirely when there's no
// token yet, rather than sending a literal "Bearer undefined".
export const authHeaders = () => (keycloak?.token ? { Authorization: `Bearer ${keycloak.token}` } : {});

// Logout function
export const logout = () => {
  if (keycloak) {
    keycloak.logout({
      redirectUri: hostUrl(null), // back to the public landing page, not a microsite
    }).then(() => {
      // Optionally, clear local storage, session storage, or any other state you want to reset
      console.log('Logged out successfully');
    }).catch((error) => {
      console.error('Logout failed:', error);
    });
  }
};
