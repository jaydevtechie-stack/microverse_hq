// Static presentation config for services — icon/illustration/color
// theme and subdomain/requiredRole. These are code assets and
// deployment/Keycloak-provisioning concerns, not admin-editable
// content, so they stay here rather than in the `services` table
// (see business-services/task-service/models/service.js) — that table
// owns name/tech/title/description/status instead, fetched at render
// time via hooks/useServices.js and merged with this file's entries by
// `key`. Colors/illustrations match the mockups in
// branding/mv-1.0/design-system/mock-ups/platform_dashboard_illustrated.html
// (and the *_full_page* ones for color) exactly (one accent per
// language), not derived from a formula, since the light-mode tints
// aren't simple alpha blends of the dark-mode colors.
//
// `id` is a stable local identifier, separate from `key` even though
// they share the same value today — App.js's host-detection logic
// (isGofeeler, etc.) compares against `id` rather than re-deriving
// meaning from the human-readable `key`/`name` strings.
//
// `icon` is the Tabler icon that used to sit in the middle of each card
// before the line-art `illustration` replaced it — kept around as the
// source for that service's favicon on its microsite (see
// utils/favicon.js), not rendered on the card itself anymore.
import {
  IconMessage2,
  IconMap2,
  IconMovie,
  IconTrophy,
  IconClock,
  IconReceipt2,
  IconAward,
} from '@tabler/icons-react';
import {
  GofeelerIllustration,
  SpringPixIllustration,
  PyReelIllustration,
  DjaboardIllustration,
  ElixtempoIllustration,
  RustledgerIllustration,
  RubyKudosIllustration,
} from '../components/ServiceIllustrations';

export const SERVICE_THEME = [
  {
    id: 'gofeeler',
    key: 'gofeeler',
    icon: IconMessage2,
    illustration: GofeelerIllustration,
    dark: { fg: '#4DD8FF', bg: '#4DD8FF22' },
    light: { fg: '#0EA5D9', bg: '#E0F7FC' },
    subdomain: 'gofeeler',
    requiredRole: 'service:gofeeler',
  },
  {
    id: 'springpix',
    key: 'springpix',
    icon: IconMap2,
    illustration: SpringPixIllustration,
    dark: { fg: '#FF9F43', bg: '#FF9F4322' },
    light: { fg: '#854F0B', bg: '#FAEEDA' },
    subdomain: 'springpix',
    requiredRole: 'service:springpix',
  },
  {
    id: 'pyreel',
    key: 'pyreel',
    icon: IconMovie,
    illustration: PyReelIllustration,
    dark: { fg: '#FFD866', bg: '#FFD86622' },
    light: { fg: '#BA7517', bg: '#FAEEDA' },
    subdomain: 'pyreel',
    requiredRole: 'service:pyreel',
  },
  {
    id: 'djaboard',
    key: 'djaboard',
    icon: IconTrophy,
    illustration: DjaboardIllustration,
    dark: { fg: '#FFD866', bg: '#FFD86622' },
    light: { fg: '#BA7517', bg: '#FAEEDA' },
    subdomain: 'djaboard',
    requiredRole: 'service:djaboard',
  },
  {
    id: 'elixtempo',
    key: 'elixtempo',
    icon: IconClock,
    illustration: ElixtempoIllustration,
    dark: { fg: '#A66DE0', bg: '#A66DE022' },
    light: { fg: '#534AB7', bg: '#EEEDFE' },
    subdomain: 'elixtempo',
    requiredRole: 'service:elixtempo',
  },
  {
    id: 'rustledger',
    key: 'rustledger',
    icon: IconReceipt2,
    illustration: RustledgerIllustration,
    dark: { fg: '#E8734A', bg: '#E8734A22' },
    light: { fg: '#993C1D', bg: '#FAECE7' },
    subdomain: 'rustledger',
    requiredRole: 'service:rustledger',
  },
  {
    id: 'rubykudos',
    key: 'rubykudos',
    icon: IconAward,
    illustration: RubyKudosIllustration,
    dark: { fg: '#FF6B6B', bg: '#FF6B6B22' },
    light: { fg: '#A32D2D', bg: '#FCEBEB' },
    subdomain: 'rubykudos',
    requiredRole: 'service:rubykudos',
  },
];

// Status ordinal used to derive the service landing page's phase bar
// (see pages/ServiceLandingPage.js) — no separate `phase` column,
// status is the single source of truth.
export const STATUS_ORDER = ['planned', 'designing', 'building', 'basic', 'online'];
