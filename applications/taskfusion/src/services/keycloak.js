import Keycloak from 'keycloak-js';

let keycloak;

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
  keycloak.login({ redirectUri: redirectUri || `${window.location.origin}/dashboard` });
};

export const getKeycloak = () => keycloak;
export const getToken = () => keycloak.token;

// Logout function
export const logout = () => {
  if (keycloak) {
    keycloak.logout({
      redirectUri: window.location.origin, // Redirect after logout (set to your landing page or login page)
    }).then(() => {
      // Optionally, clear local storage, session storage, or any other state you want to reset
      console.log('Logged out successfully');
    }).catch((error) => {
      console.error('Logout failed:', error);
    });
  }
};
