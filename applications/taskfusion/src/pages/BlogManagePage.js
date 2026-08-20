// src/pages/BlogManagePage.js
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import SplitView from '../components/SplitView';
import BlogPostForm from '../components/BlogPostForm';
import { TagBadge } from '../components/BlogChrome';
import { authHeaders } from '../services/keycloak';

const StatusBadge = ({ published }) => {
  const { t } = useTranslation('blog');
  return (
    <span
      style={{
        fontSize: 10,
        padding: '2px 8px',
        borderRadius: 8,
        whiteSpace: 'nowrap',
        background: published
          ? 'color-mix(in srgb, var(--mv-color-success) 15%, transparent)'
          : 'var(--mv-badge-bg)',
        color: published ? 'var(--mv-color-success)' : 'var(--mv-badge-text)',
      }}
    >
      {published ? t('manage.publishedBadge') : t('manage.draftBadge')}
    </span>
  );
};

const PostList = ({ posts, error, selectedId, onSelect, onNew }) => {
  const { t } = useTranslation('blog');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px',
          borderBottom: '0.5px solid var(--mv-border)',
        }}
      >
        <span style={{ color: 'var(--mv-text)', fontSize: 13, fontWeight: 500 }}>{t('manage.headerTitle')}</span>
        <button
          type="button"
          onClick={onNew}
          style={{
            padding: '6px 12px',
            background: 'var(--mv-color-primary)',
            color: 'var(--mv-color-primary-contrast)',
            fontWeight: 500,
            fontSize: 12,
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          {t('manage.newPost')}
        </button>
      </div>
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {error && (
          <p style={{ color: 'var(--mv-color-danger)', fontSize: 13, padding: '12px 16px' }}>
            {t('manage.loadError', { error })}
          </p>
        )}
        {!error && !posts && (
          <p style={{ color: 'var(--mv-text-muted)', fontSize: 13, padding: '12px 16px' }}>{t('manage.loading')}</p>
        )}
        {posts?.length === 0 && (
          <p style={{ color: 'var(--mv-text-muted)', fontSize: 13, padding: '12px 16px' }}>{t('manage.empty')}</p>
        )}
        {posts?.map((p) => {
          const isSelected = p.id === selectedId;
          return (
            <div
              key={p.id}
              onClick={() => onSelect(p.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                padding: '12px 16px',
                borderBottom: '0.5px solid var(--mv-border)',
                cursor: 'pointer',
                background: isSelected ? 'var(--mv-bg)' : 'transparent',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    color: isSelected ? 'var(--mv-text)' : 'var(--mv-text-muted)',
                    fontSize: 13,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {p.title || t('manage.untitled')}
                </div>
                {p.tags?.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                    {p.tags.map((tag) => (
                      <TagBadge key={tag} tag={tag} />
                    ))}
                  </div>
                )}
              </div>
              <StatusBadge published={Boolean(p.published_at)} />
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Master-detail for platform:marketing/platform:admin, same SplitView
// shell as AdminUsersPage.js. GET /api/blog/posts with a staff token
// returns every post (drafts included) automatically — no separate
// admin-only endpoint needed, see blog-service's routes/blog-routes.js.
const BlogManagePage = () => {
  const [posts, setPosts] = useState(null);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [creatingNew, setCreatingNew] = useState(false);
  // The list endpoint's row shape deliberately excludes body_html (see
  // blog-service's models/posts.js LIST_COLUMNS comment) — editing needs
  // the full row, fetched separately by slug once something's selected,
  // so BlogPostForm never opens with a silently-empty body.
  const [selectedPost, setSelectedPost] = useState(null);

  const refetch = () =>
    fetch('/api/blog/posts?limit=100', { headers: authHeaders() })
      .then((res) => {
        if (!res.ok) throw new Error(`blog-service returned ${res.status}`);
        return res.json();
      })
      .then(setPosts)
      .catch((err) => setError(err.message));

  useEffect(() => {
    refetch();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setSelectedPost(null);
      return;
    }
    const summary = posts?.find((p) => p.id === selectedId);
    if (!summary) return;
    fetch(`/api/blog/posts/${summary.slug}`, { headers: authHeaders() })
      .then((res) => {
        if (!res.ok) throw new Error(`blog-service returned ${res.status}`);
        return res.json();
      })
      .then(setSelectedPost)
      .catch((err) => setError(err.message));
  }, [selectedId, posts]);

  const handleSelect = (id) => {
    setCreatingNew(false);
    setSelectedId(id);
  };

  const handleNew = () => {
    setSelectedId(null);
    setCreatingNew(true);
  };

  const handleClose = () => {
    setSelectedId(null);
    setCreatingNew(false);
  };

  const handleSaved = (saved) => {
    setCreatingNew(false);
    setSelectedId(saved.id);
    setSelectedPost(saved);
    refetch();
  };

  const handleDeleted = () => {
    handleClose();
    refetch();
  };

  return (
    <SplitView
      open={Boolean(selectedId) || creatingNew}
      listPanel={<PostList posts={posts} error={error} selectedId={selectedId} onSelect={handleSelect} onNew={handleNew} />}
      detailPanel={
        creatingNew ? (
          <BlogPostForm post={null} onSaved={handleSaved} onDeleted={handleDeleted} onCancel={handleClose} />
        ) : (
          selectedPost && (
            <BlogPostForm
              key={selectedPost.id}
              post={selectedPost}
              onSaved={handleSaved}
              onDeleted={handleDeleted}
              onCancel={handleClose}
            />
          )
        )
      }
    />
  );
};

export default BlogManagePage;
