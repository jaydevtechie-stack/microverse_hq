import Keycloak from 'keycloak-js';

let keycloak;

// microverse.local (anonymous) and dashboard.microverse.local
// (authenticated) are the same app/build — these just swap the leading
// "dashboard." label so login always lands on the dashboard host and
// logout always lands back on the public one, regardless of which
// hostname the user started from.
function withHostnamePrefix(wantsDashboard) {
  const { protocol, hostname, port } = window.location;
  const isDashboard = hostname.startsWith('dashboard.');
  let targetHost = hostname;
  if (wantsDashboard && !isDashboard) targetHost = `dashboard.${hostname}`;
  if (!wantsDashboard && isDashboard) targetHost = hostname.replace(/^dashboard\./, '');
  return `${protocol}//${targetHost}${port ? `:${port}` : ''}`;
}

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
  keycloak.login({ redirectUri: redirectUri || `${withHostnamePrefix(true)}/dashboard` });
};

// The public landing page only exists on the non-"dashboard." host, so
// linking to it from the dashboard host needs a real cross-origin URL,
// not a client-side route.
export const landingUrl = () => `${withHostnamePrefix(false)}/`;

export const getKeycloak = () => keycloak;
export const getToken = () => keycloak.token;

// Logout function
export const logout = () => {
  if (keycloak) {
    keycloak.logout({
      redirectUri: withHostnamePrefix(false), // back to the public landing page, not the dashboard host
    }).then(() => {
      // Optionally, clear local storage, session storage, or any other state you want to reset
      console.log('Logged out successfully');
    }).catch((error) => {
      console.error('Logout failed:', error);
    });
  }
};
