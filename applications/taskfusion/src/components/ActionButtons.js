import React from 'react';

// Two-up action button row — same flex/gap/spacing shape used by
// ReviewerPanel's Approve/Reject and AccountsProjectsView's
// Assign/Deactivate. Just the layout; callers supply whichever
// buttons they need (OutlineDangerButton below, or their own).
export const ActionButtonRow = ({ children }) => (
  <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>{children}</div>
);

// The "reject"/"deactivate" half of that row — transparent, danger-
// outlined, dims via opacity while busy. Byte-identical between its
// two current callers, so it's the one worth sharing; the "positive"
// half (Approve/Assign) differs enough between callers (success vs
// primary color, different disabled-state treatment) that each keeps
// its own bespoke button rather than forcing a shared component to
// cover both.
export const OutlineDangerButton = ({ onClick, disabled, children }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    style={{
      flex: 1,
      padding: '10px 0',
      background: 'transparent',
      border: '0.5px solid var(--mv-color-danger)',
      color: 'var(--mv-color-danger)',
      fontWeight: 500,
      fontSize: 13,
      borderRadius: 8,
      cursor: disabled ? 'default' : 'pointer',
      opacity: disabled ? 0.6 : 1,
    }}
  >
    {children}
  </button>
);
