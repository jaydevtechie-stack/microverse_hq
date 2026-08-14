// Platform-function -> avatar color, so you can tell what kind of user
// you're looking at at a glance. Priority order matters when someone
// holds more than one platform role (ARCHITECTURE.md doesn't forbid
// it) — most-privileged wins.
const ROLE_PRIORITY = [
  'platform:admin',
  'platform:project-manager',
  'platform:reviewer',
  'platform:analyst',
  'platform:customer',
  'platform:ai-agent',
];

const ROLE_COLORS = {
  'platform:admin': { bg: 'var(--mv-color-danger)', fg: '#ffffff' },
  'platform:project-manager': {
    bg: 'var(--mv-color-primary)',
    fg: 'var(--mv-color-primary-contrast)',
  },
  'platform:reviewer': { bg: 'var(--mv-color-warning)', fg: '#ffffff' },
  'platform:analyst': { bg: 'var(--mv-color-info)', fg: '#ffffff' },
  'platform:customer': { bg: 'var(--mv-color-success)', fg: 'var(--mv-color-success-contrast, #ffffff)' },
  'platform:ai-agent': { bg: 'var(--mv-color-secondary)', fg: '#ffffff' },
};

const DEFAULT_COLORS = { bg: 'var(--mv-avatar-bg)', fg: 'var(--mv-avatar-text)' };

// For an avatar representing the actual logged-in user — reads their
// real roles off the keycloak instance.
export function avatarColorsForKeycloak(keycloak) {
  if (!keycloak) return DEFAULT_COLORS;
  const role = ROLE_PRIORITY.find((r) => keycloak.hasRealmRole(r));
  return role ? ROLE_COLORS[role] : DEFAULT_COLORS;
}

// For an avatar representing someone else's profile (e.g. CustomerPage
// always shows a customer) — pass the role type directly rather than
// deriving it from a keycloak instance that belongs to the viewer, not
// the profile being shown.
export function avatarColorsForRoleType(roleType) {
  return ROLE_COLORS[`platform:${roleType}`] || DEFAULT_COLORS;
}
