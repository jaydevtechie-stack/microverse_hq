// src/components/BlogChrome.js
//
// Shared header/tag-badge chrome for the two public blog pages
// (BlogListPage.js, BlogPostPage.js) — pulled out so the two don't drift
// out of sync with each other. The site footer lives in Footer.js
// instead — it isn't blog-specific.
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { IconSun, IconMoon } from '@tabler/icons-react';
import { useTheme } from '../context/ThemeContext';
import { login, getKeycloak } from '../services/keycloak';
import { colorForTag } from '../utils/tagColor';

export const shortDate = (iso) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export const TagChip = ({ tag, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      padding: '6px 14px',
      fontSize: 13,
      border: `1px solid ${active ? 'var(--mv-color-primary)' : 'var(--mv-border)'}`,
      borderRadius: 20,
      background: active ? 'var(--mv-color-primary)' : 'transparent',
      color: active ? 'var(--mv-color-primary-contrast)' : 'var(--mv-text-muted)',
      cursor: 'pointer',
      whiteSpace: 'nowrap',
    }}
  >
    {tag}
  </button>
);

export const TagBadge = ({ tag }) => {
  const { bg, text } = colorForTag(tag);
  return (
    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 500, background: bg, color: text }}>
      {tag}
    </span>
  );
};

// Brand mark, dark-mode toggle (reuses the app's own useTheme/--mv-*
// tokens, not a separate scheme), and Login (or "go to dashboard" if
// already signed in — a staff member browsing the public blog shouldn't
// be told to log in again).
export const BlogHeader = () => {
  const { t } = useTranslation(['blog', 'common']);
  const { theme, toggleTheme } = useTheme();
  const keycloak = getKeycloak();
  return (
    <div style={{ borderBottom: '0.5px solid var(--mv-border)' }}>
      <div
        style={{
          maxWidth: 1140,
          margin: '0 auto',
          padding: '14px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* No separate "Blog" nav item — the blog IS "/" now, same
            destination as the brand mark, so a second link to itself
            would be redundant. */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--mv-color-primary)' }} />
          <span style={{ color: 'var(--mv-text)', fontWeight: 500, fontSize: 15 }}>Microverse</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? t('common:switchToLightTheme') : t('common:switchToDarkTheme')}
            style={{ background: 'none', border: 'none', padding: 0, display: 'flex', cursor: 'pointer', color: 'var(--mv-text-muted)' }}
          >
            {theme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
          </button>
          {keycloak?.authenticated ? (
            <Link to="/dashboard" style={{ color: 'var(--mv-color-primary)', fontSize: 13, textDecoration: 'none' }}>
              {t('blog:list.nav.goToDashboard')}
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => login()}
              style={{
                background: 'var(--mv-color-primary)',
                color: 'var(--mv-color-primary-contrast)',
                fontSize: 12,
                fontWeight: 500,
                padding: '7px 16px',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              {t('common:login')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

