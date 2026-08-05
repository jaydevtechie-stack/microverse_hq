// Status/color data for the service grid on the dashboard landing page.
// Hardcoded for now — no status API to call yet. Colors/icons match the
// mockups in branding/mv-1.0/design-system/microverse_dashboard_full_page*.html
// exactly (one accent per language), not derived from a formula, since the
// light-mode tints aren't simple alpha blends of the dark-mode colors.
import {
  IconMessage2,
  IconMap2,
  IconMovie,
  IconTrophy,
  IconClock,
  IconReceipt2,
  IconAward,
} from '@tabler/icons-react';

export const SERVICES = [
  {
    key: 'gofeeler',
    name: 'Gofeeler',
    tech: 'Go',
    status: 'online',
    icon: IconMessage2,
    dark: { fg: '#4DD8FF', bg: '#4DD8FF22' },
    light: { fg: '#0EA5D9', bg: '#E0F7FC' },
  },
  {
    key: 'springpix',
    name: 'SpringPix',
    tech: 'Java',
    status: 'basic',
    icon: IconMap2,
    dark: { fg: '#FF9F43', bg: '#FF9F4322' },
    light: { fg: '#854F0B', bg: '#FAEEDA' },
  },
  {
    key: 'pyreel',
    name: 'PyReel',
    tech: 'Python',
    status: 'basic',
    icon: IconMovie,
    dark: { fg: '#FFD866', bg: '#FFD86622' },
    light: { fg: '#BA7517', bg: '#FAEEDA' },
  },
  {
    key: 'djaboard',
    name: 'Djaboard',
    tech: 'Python',
    status: 'building',
    icon: IconTrophy,
    dark: { fg: '#FFD866', bg: '#FFD86622' },
    light: { fg: '#BA7517', bg: '#FAEEDA' },
  },
  {
    key: 'elixtempo',
    name: 'elixtempo',
    tech: 'Elixir',
    status: 'designing',
    icon: IconClock,
    dark: { fg: '#A66DE0', bg: '#A66DE022' },
    light: { fg: '#534AB7', bg: '#EEEDFE' },
  },
  {
    key: 'rustledger',
    name: 'rustledger',
    tech: 'Rust',
    status: 'designing',
    icon: IconReceipt2,
    dark: { fg: '#E8734A', bg: '#E8734A22' },
    light: { fg: '#993C1D', bg: '#FAECE7' },
  },
  {
    key: 'rubykudos',
    name: 'RubyKudos',
    tech: 'Ruby',
    status: 'planned',
    icon: IconAward,
    dark: { fg: '#FF6B6B', bg: '#FF6B6B22' },
    light: { fg: '#A32D2D', bg: '#FCEBEB' },
  },
];
