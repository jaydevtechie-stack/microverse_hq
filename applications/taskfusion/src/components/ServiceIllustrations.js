// Per-service line-art illustrations for the dashboard service cards —
// one SVG per service, ported from
// branding/mv-1.0/design-system/mock-ups/platform_dashboard_illustrated.html.
// Each fills its card's icon tile (viewBox 200x76, scaled up via
// preserveAspectRatio) and takes the service's theme color as `color`,
// mirroring how the Tabler icons it replaces took a `color` prop.
import React from 'react';

const wrap = (children) => (props) => (
  <svg
    viewBox="0 0 200 76"
    width="100%"
    height="100%"
    style={{ display: 'block' }}
    preserveAspectRatio="xMidYMid meet"
    aria-hidden="true"
  >
    {children(props.color)}
  </svg>
);

export const GofeelerIllustration = wrap((color) => (
  <>
    <g stroke={color} strokeWidth="1.5" fill="none">
      <circle cx="46" cy="38" r="20" />
      <path d="M35 46 Q46 54 57 46" />
      <circle cx="100" cy="38" r="20" />
      <path d="M90 47 H110" />
      <circle cx="154" cy="38" r="20" />
      <path d="M143 50 Q154 42 165 50" />
    </g>
    <g fill={color}>
      <circle cx="38" cy="33" r="1.8" />
      <circle cx="54" cy="33" r="1.8" />
      <circle cx="92" cy="33" r="1.8" />
      <circle cx="108" cy="33" r="1.8" />
      <circle cx="146" cy="33" r="1.8" />
      <circle cx="162" cy="33" r="1.8" />
    </g>
  </>
));

export const SpringPixIllustration = wrap((color) => (
  <g stroke={color} strokeWidth="1.5" fill="none">
    <path d="M8 54 Q50 34 92 54 T176 54" />
    <path d="M8 64 Q50 48 92 64 T176 64" />
    <path d="M100 12 C88 12 78 22 78 34 C78 50 100 64 100 64 C100 64 122 50 122 34 C122 22 112 12 100 12 Z" />
    <circle cx="100" cy="34" r="7" />
  </g>
));

export const PyReelIllustration = wrap((color) => (
  <g stroke={color} strokeWidth="1.5" fill="none">
    <circle cx="46" cy="38" r="26" />
    <circle cx="46" cy="38" r="7" />
    <circle cx="46" cy="18" r="5" />
    <circle cx="64" cy="30" r="5" />
    <circle cx="64" cy="46" r="5" />
    <circle cx="46" cy="58" r="5" />
    <circle cx="28" cy="46" r="5" />
    <circle cx="28" cy="30" r="5" />
    <path d="M72 38 H180" />
    <rect x="78" y="26" width="14" height="24" rx="2" />
    <rect x="100" y="26" width="14" height="24" rx="2" />
    <rect x="122" y="26" width="14" height="24" rx="2" />
    <rect x="144" y="26" width="14" height="24" rx="2" />
    <rect x="166" y="26" width="10" height="24" rx="2" />
  </g>
));

export const DjaboardIllustration = wrap((color) => (
  <g stroke={color} strokeWidth="1.5" fill="none">
    <rect x="30" y="40" width="24" height="26" rx="2" />
    <rect x="66" y="24" width="24" height="42" rx="2" />
    <rect x="102" y="34" width="24" height="32" rx="2" />
    <path d="M75 10 H105 V24 A15 15 0 0 1 75 24 Z" />
    <path d="M75 14 Q64 14 64 24 Q64 30 75 28" />
    <path d="M105 14 Q116 14 116 24 Q116 30 105 28" />
    <rect x="86" y="39" width="8" height="8" />
    <rect x="78" y="47" width="24" height="6" rx="2" />
  </g>
));

export const ElixtempoIllustration = wrap((color) => (
  <g stroke={color} strokeWidth="1.5" fill="none">
    <circle cx="100" cy="42" r="26" />
    <path d="M100 42 V24" />
    <path d="M100 42 L114 50" />
    <path d="M92 10 H108" />
    <path d="M100 10 V16" />
    <path d="M76 20 L82 26" />
    <path d="M124 20 L118 26" />
  </g>
));

export const RustledgerIllustration = wrap((color) => (
  <g stroke={color} strokeWidth="1.5" fill="none">
    <path d="M100 14 L60 20 V62 L100 56 Z" />
    <path d="M100 14 L140 20 V62 L100 56 Z" />
    <path d="M68 28 H92 M68 36 H92 M68 44 H92" />
    <path d="M108 28 H132 M108 36 H132 M108 44 H132" />
  </g>
));

const medal = (transform) => (
  <g key={transform} transform={transform}>
    <path
      d="M4 40 H12 V16 H4 Z M12 16 L12 8 Q12 2 17 2 Q21 2 21 7 V16 H26 Q30 16 30 20 V34 Q30 40 26 40 H12 Z"
      vectorEffect="non-scaling-stroke"
    />
  </g>
);

export const RubyKudosIllustration = wrap((color) => (
  <g stroke={color} strokeWidth="1.5" fill="none">
    {medal('translate(28,6) scale(0.65)')}
    {medal('translate(78,10) scale(1)')}
    {medal('translate(142,24) scale(0.6)')}
  </g>
));
