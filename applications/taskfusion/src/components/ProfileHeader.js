import React from 'react';
import { avatarColorsForRoleType } from '../utils/avatarColors';

// Shared by CustomerPage and AnalystPage — same avatar+name+subtitle
// layout, just a different avatar shape (customer: rounded square,
// analyst: circle) and subtitle content. `roleType` colors the avatar
// (e.g. "customer", "analyst") — these pages show someone else's
// profile, not the viewer's own, so the color comes from a prop rather
// than the viewer's keycloak roles.
const ProfileHeader = ({ initials, name, subtitle, avatarShape = 'circle', roleType }) => {
  const { bg, fg } = avatarColorsForRoleType(roleType);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: avatarShape === 'circle' ? '50%' : 12,
          background: bg,
          color: fg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 500,
          fontSize: 15,
          flexShrink: 0,
        }}
      >
        {initials}
      </div>
      <div>
        <p style={{ color: 'var(--mv-text)', fontSize: 15, fontWeight: 500, margin: 0 }}>{name}</p>
        <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: 0 }}>{subtitle}</p>
      </div>
    </div>
  );
};

export default ProfileHeader;
