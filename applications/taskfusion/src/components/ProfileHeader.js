import React from 'react';

// Shared by CustomerPage and AnalystPage — same avatar+name+subtitle
// layout, just a different avatar shape (customer: rounded square,
// analyst: circle) and subtitle content.
const ProfileHeader = ({ initials, name, subtitle, avatarShape = 'circle' }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
    <div
      style={{
        width: 44,
        height: 44,
        borderRadius: avatarShape === 'circle' ? '50%' : 12,
        background: 'var(--mv-avatar-bg)',
        color: 'var(--mv-avatar-text)',
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

export default ProfileHeader;
