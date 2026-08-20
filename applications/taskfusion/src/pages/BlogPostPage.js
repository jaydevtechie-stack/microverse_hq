// src/pages/BlogPostPage.js
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import usePageMeta from '../hooks/usePageMeta';
import { BlogHeader, TagBadge, shortDate } from '../components/BlogChrome';
import Footer from '../components/Footer';
import { estimateReadingTime } from '../utils/readingTime';

// Fully public, same posture as BlogListPage.js. body_html is rendered
// raw — safe because blog-service sanitizes it server-side on every
// write (create AND update, see lib/sanitize.js), not because the
// client sanitizes on read. Don't "helpfully" add a client-side
// sanitizer thinking this needs one; the point of sanitizing on write is
// that every reader (this page, an RSS feed, a future API consumer)
// gets safe HTML for free without each one needing to remember to do it.
const BlogPostPage = () => {
  const { slug } = useParams();
  const { t } = useTranslation(['blog', 'landing']);
  const [post, setPost] = useState(null);
  const [error, setError] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setPost(null);
    setError(null);
    setNotFound(false);
    fetch(`/api/blog/posts/${slug}`)
      .then((res) => {
        if (res.status === 404) {
          setNotFound(true);
          return null;
        }
        if (!res.ok) throw new Error(`blog-service returned ${res.status}`);
        return res.json();
      })
      .then((data) => data && setPost(data))
      .catch((err) => setError(err.message));
  }, [slug]);

  usePageMeta({
    title: post ? `${post.title} — ${t('landing:title')}` : t('landing:title'),
    description: post?.excerpt || t('landing:description'),
    indexable: true,
  });

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--mv-bg)' }}>
      <BlogHeader />

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px 0', width: '100%', boxSizing: 'border-box', flex: 1 }}>
        <Link to="/" style={{ color: 'var(--mv-color-primary)', fontSize: 13, textDecoration: 'none' }}>
          ← {t('post.back')}
        </Link>

        {error && <p style={{ color: 'var(--mv-color-danger)', fontSize: 14, marginTop: 20 }}>{t('post.loadError', { error })}</p>}
        {notFound && <p style={{ color: 'var(--mv-text-muted)', fontSize: 14, marginTop: 20 }}>{t('post.notFound')}</p>}

        {post && (
          <article style={{ marginTop: 20, paddingBottom: 40 }}>
            {post.cover_image_url && (
              <img
                src={post.cover_image_url}
                alt=""
                style={{ display: 'block', width: '100%', maxHeight: 420, objectFit: 'cover', borderRadius: 12, marginBottom: 20 }}
              />
            )}
            {post.tags?.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                {post.tags.map((tag) => (
                  <TagBadge key={tag} tag={tag} />
                ))}
              </div>
            )}
            <h1 style={{ color: 'var(--mv-text)', fontSize: 32, margin: '0 0 8px' }}>{post.title}</h1>
            <p style={{ color: 'var(--mv-badge-bg)', fontSize: 12, margin: '0 0 24px' }}>
              {post.author_name && t('list.byLine', { name: post.author_name })}
              {post.author_name && ' · '}
              {shortDate(post.published_at)}
              {' · '}
              {t('list.readingTime', { count: estimateReadingTime(post.body_html) })}
            </p>
            <div
              style={{ color: 'var(--mv-text)', fontSize: 15, lineHeight: 1.75 }}
              dangerouslySetInnerHTML={{ __html: post.body_html }}
            />
          </article>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default BlogPostPage;
