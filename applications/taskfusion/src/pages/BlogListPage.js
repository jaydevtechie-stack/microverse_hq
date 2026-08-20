// src/pages/BlogListPage.js
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { IconArticle, IconCalendarEvent } from '@tabler/icons-react';
import usePageMeta from '../hooks/usePageMeta';
import { BlogHeader, TagChip, TagBadge, shortDate } from '../components/BlogChrome';
import Footer from '../components/Footer';
import { colorForTag } from '../utils/tagColor';

// Static — no events feature exists anywhere in this app yet.
// Visual-only, matching the mock-up exactly: nothing to wire up here.
const EventsWidget = () => {
  const { t } = useTranslation('blog');
  return (
    <div
      style={{
        background: 'var(--mv-bg)',
        border: '1px dashed var(--mv-border)',
        borderRadius: 8,
        padding: 20,
        marginTop: 16,
        textAlign: 'center',
      }}
    >
      <IconCalendarEvent size={22} color="var(--mv-text-muted)" aria-hidden="true" />
      <p style={{ color: 'var(--mv-text)', fontSize: 13, fontWeight: 500, margin: '10px 0 4px' }}>{t('list.sidebar.eventsTitle')}</p>
      <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: 0 }}>{t('list.sidebar.eventsBody')}</p>
    </div>
  );
};

// Backed by blog-service's POST /subscribe, which itself forwards to a
// self-hosted Listmonk (docker-compose.yml's microverse-listmonk) — see
// that route's comment for why the browser never calls Listmonk
// directly. Same visual shape as the mock-up, now a real controlled
// form instead of styled placeholder elements.
const NewsletterWidget = () => {
  const { t } = useTranslation('blog');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | success | error

  const handleSubmit = (e) => {
    e.preventDefault();
    setStatus('loading');
    fetch('/api/blog/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        setStatus('success');
      })
      .catch(() => setStatus('error'));
  };

  if (status === 'success') {
    return (
      <div style={{ background: 'var(--mv-color-primary)', borderRadius: 8, padding: 16, marginTop: 16 }}>
        <p style={{ color: 'var(--mv-color-primary-contrast)', fontSize: 13, fontWeight: 500, margin: 0 }}>
          {t('list.sidebar.newsletterSuccess')}
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ background: 'var(--mv-color-primary)', borderRadius: 8, padding: 16, marginTop: 16 }}
    >
      <p style={{ color: 'var(--mv-color-primary-contrast)', fontSize: 14, fontWeight: 500, margin: '0 0 4px' }}>
        {t('list.sidebar.newsletterTitle')}
      </p>
      <p style={{ color: 'var(--mv-color-primary-contrast)', fontSize: 12, margin: '0 0 12px', opacity: 0.85 }}>
        {t('list.sidebar.newsletterBody')}
      </p>
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={t('list.sidebar.newsletterPlaceholder')}
        style={{
          display: 'block',
          width: '100%',
          boxSizing: 'border-box',
          background: 'var(--mv-bg)',
          border: 'none',
          borderRadius: 6,
          padding: '9px 12px',
          color: 'var(--mv-text)',
          fontSize: 13,
          marginBottom: 8,
        }}
      />
      <button
        type="submit"
        disabled={status === 'loading'}
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'center',
          background: 'var(--mv-text)',
          color: 'var(--mv-bg)',
          fontSize: 13,
          fontWeight: 500,
          padding: '9px 0',
          borderRadius: 6,
          border: 'none',
          cursor: status === 'loading' ? 'default' : 'pointer',
        }}
      >
        {status === 'loading' ? t('list.sidebar.newsletterSubscribing') : t('list.sidebar.newsletterSubscribe')}
      </button>
      {status === 'error' && (
        <p style={{ color: 'var(--mv-color-primary-contrast)', fontSize: 11, margin: '8px 0 0' }}>
          {t('list.sidebar.newsletterError')}
        </p>
      )}
    </form>
  );
};

const BlogListPage = () => {
  const { t } = useTranslation(['blog', 'landing']);
  const [posts, setPosts] = useState(null);
  const [error, setError] = useState(null);
  const [popularTags, setPopularTags] = useState([]);
  const [popularPosts, setPopularPosts] = useState([]);
  const [activeTag, setActiveTag] = useState(null);

  usePageMeta({
    title: `${t('landing:title')} — ${t('blog:list.headerTitle')}`,
    description: t('landing:description'),
    indexable: true,
  });

  useEffect(() => {
    fetch('/api/blog/posts/tags/popular?limit=8')
      .then((res) => (res.ok ? res.json() : []))
      .then((rows) => setPopularTags(rows.map((r) => r.tag)))
      .catch(() => {});
    fetch('/api/blog/posts/popular?limit=4')
      .then((res) => (res.ok ? res.json() : []))
      .then(setPopularPosts)
      .catch(() => {});
  }, []);

  useEffect(() => {
    setPosts(null);
    setError(null);
    const query = activeTag ? `?tag=${encodeURIComponent(activeTag)}` : '';
    fetch(`/api/blog/posts${query}`)
      .then((res) => {
        if (!res.ok) throw new Error(`blog-service returned ${res.status}`);
        return res.json();
      })
      .then(setPosts)
      .catch((err) => setError(err.message));
  }, [activeTag]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--mv-bg)' }}>
      <style>{`
        @media (max-width: 720px) {
          .blog-main-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <BlogHeader />

      <div style={{ maxWidth: 1140, margin: '0 auto', padding: '32px 24px 0', width: '100%', boxSizing: 'border-box', flex: 1 }}>
        <p style={{ color: 'var(--mv-text)', fontSize: 26, fontWeight: 500, margin: '0 0 6px' }}>{t('list.hero.title')}</p>
        <p style={{ color: 'var(--mv-text-muted)', fontSize: 14, margin: '0 0 20px' }}>{t('list.hero.description')}</p>

        {popularTags.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 28 }}>
            <TagChip tag={t('list.filters.all')} active={!activeTag} onClick={() => setActiveTag(null)} />
            {popularTags.map((tag) => (
              <TagChip key={tag} tag={tag} active={activeTag === tag} onClick={() => setActiveTag(tag)} />
            ))}
          </div>
        )}

        <div className="blog-main-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, paddingBottom: 32 }}>
          <div>
            {error && <p style={{ color: 'var(--mv-color-danger)', fontSize: 14 }}>{t('list.loadError', { error })}</p>}
            {!error && !posts && <p style={{ color: 'var(--mv-text-muted)', fontSize: 14 }}>{t('list.loading')}</p>}
            {posts?.length === 0 && <p style={{ color: 'var(--mv-text-muted)', fontSize: 14 }}>{t('list.empty')}</p>}

            {posts?.map((post) => {
              const firstTagColor = post.tags?.[0] ? colorForTag(post.tags[0]) : null;
              return (
                <div
                  key={post.id}
                  style={{ display: 'flex', gap: 14, padding: 16, border: '1px solid var(--mv-border)', borderRadius: 8, marginBottom: 14, background: 'var(--mv-bg)' }}
                >
                  <div
                    style={{
                      width: 88,
                      height: 72,
                      minWidth: 88,
                      borderRadius: 6,
                      overflow: 'hidden',
                      background: firstTagColor?.bg || 'var(--mv-badge-bg)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {post.cover_image_url ? (
                      <img src={post.cover_image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <IconArticle size={24} color={firstTagColor?.text || 'var(--mv-text-muted)'} />
                    )}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    {post.tags?.length > 0 && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                        {post.tags.map((tag) => (
                          <TagBadge key={tag} tag={tag} />
                        ))}
                      </div>
                    )}
                    <p style={{ margin: '0 0 4px' }}>
                      <Link to={`/blog/${post.slug}`} style={{ color: 'var(--mv-text)', fontSize: 15, fontWeight: 500, textDecoration: 'none' }}>
                        {post.title}
                      </Link>
                    </p>
                    {post.excerpt && (
                      <p style={{ color: 'var(--mv-text-muted)', fontSize: 13, margin: '0 0 8px', lineHeight: 1.5 }}>{post.excerpt}</p>
                    )}
                    <span style={{ color: 'var(--mv-text-muted)', fontSize: 12 }}>{shortDate(post.published_at)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div>
            {popularPosts.length > 0 && (
              <div style={{ background: 'var(--mv-bg)', border: '1px solid var(--mv-border)', borderRadius: 8, padding: 16 }}>
                <p style={{ color: 'var(--mv-text)', fontSize: 14, fontWeight: 500, margin: '0 0 10px' }}>{t('list.sidebar.popularTitle')}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {popularPosts.map((post, i) => (
                    <div
                      key={post.id}
                      style={{
                        paddingBottom: i < popularPosts.length - 1 ? 10 : 0,
                        borderBottom: i < popularPosts.length - 1 ? '1px solid var(--mv-border)' : 'none',
                      }}
                    >
                      <Link to={`/blog/${post.slug}`} style={{ color: 'var(--mv-text)', fontSize: 13, textDecoration: 'none', display: 'block' }}>
                        {post.title}
                      </Link>
                      <span style={{ color: 'var(--mv-text-muted)', fontSize: 11 }}>{shortDate(post.published_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <EventsWidget />
            <NewsletterWidget />
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default BlogListPage;
