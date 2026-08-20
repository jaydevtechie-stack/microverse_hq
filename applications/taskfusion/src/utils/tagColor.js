// src/utils/tagColor.js
//
// Tags are free-form (ES-backed vocabulary, see TagInput.js) — there's
// no fixed set to hand-map colors to like the mockup's 4-category
// design assumed. A stable hash into the design system's small set of
// semantic color tokens gives consistent-per-tag, still-varied color
// without a lookup table that would drift as new tags get created.
const PALETTE = ['primary', 'secondary', 'success', 'warning', 'info'];

export function colorForTag(tag) {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = (hash * 31 + tag.charCodeAt(i)) | 0;
  }
  const name = PALETTE[Math.abs(hash) % PALETTE.length];
  return {
    bg: `color-mix(in srgb, var(--mv-color-${name}) 15%, transparent)`,
    text: `var(--mv-color-${name})`,
  };
}
