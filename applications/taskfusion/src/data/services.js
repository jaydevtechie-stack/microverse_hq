// Status/color data for the service grid on the dashboard landing page.
// Hardcoded for now — no status API to call yet. Colors and the
// per-service line-art illustrations match the mockups in
// branding/mv-1.0/design-system/mock-ups/platform_dashboard_illustrated.html
// (and the *_full_page* ones for color) exactly (one accent per
// language), not derived from a formula, since the light-mode tints
// aren't simple alpha blends of the dark-mode colors.
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

export const SERVICES = [
  {
    key: 'gofeeler',
    name: 'Gofeeler',
    tech: 'Go',
    status: 'online',
    icon: IconMessage2,
    illustration: GofeelerIllustration,
    dark: { fg: '#4DD8FF', bg: '#4DD8FF22' },
    light: { fg: '#0EA5D9', bg: '#E0F7FC' },
    subdomain: 'gofeeler',
    requiredRole: 'service:gofeeler',
  },
  {
    key: 'springpix',
    name: 'SpringPix',
    tech: 'Java',
    status: 'basic',
    icon: IconMap2,
    illustration: SpringPixIllustration,
    dark: { fg: '#FF9F43', bg: '#FF9F4322' },
    light: { fg: '#854F0B', bg: '#FAEEDA' },
  },
  {
    key: 'pyreel',
    name: 'PyReel',
    tech: 'Python',
    status: 'basic',
    icon: IconMovie,
    illustration: PyReelIllustration,
    dark: { fg: '#FFD866', bg: '#FFD86622' },
    light: { fg: '#BA7517', bg: '#FAEEDA' },
  },
  {
    key: 'djaboard',
    name: 'Djaboard',
    tech: 'Python',
    status: 'building',
    icon: IconTrophy,
    illustration: DjaboardIllustration,
    dark: { fg: '#FFD866', bg: '#FFD86622' },
    light: { fg: '#BA7517', bg: '#FAEEDA' },
  },
  {
    key: 'elixtempo',
    name: 'elixtempo',
    tech: 'Elixir',
    status: 'designing',
    icon: IconClock,
    illustration: ElixtempoIllustration,
    dark: { fg: '#A66DE0', bg: '#A66DE022' },
    light: { fg: '#534AB7', bg: '#EEEDFE' },
  },
  {
    key: 'rustledger',
    name: 'rustledger',
    tech: 'Rust',
    status: 'designing',
    icon: IconReceipt2,
    illustration: RustledgerIllustration,
    dark: { fg: '#E8734A', bg: '#E8734A22' },
    light: { fg: '#993C1D', bg: '#FAECE7' },
  },
  {
    key: 'rubykudos',
    name: 'RubyKudos',
    tech: 'Ruby',
    status: 'planned',
    icon: IconAward,
    illustration: RubyKudosIllustration,
    dark: { fg: '#FF6B6B', bg: '#FF6B6B22' },
    light: { fg: '#A32D2D', bg: '#FCEBEB' },
  },
];
