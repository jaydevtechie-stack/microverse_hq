// src/components/BlogPostForm.js
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { authHeaders } from '../services/keycloak';
import { uploadBlogImage } from '../services/blogAssets';
import { ActionButtonRow, OutlineDangerButton } from './ActionButtons';
import BlogEditor from './BlogEditor';
import TagInput from './TagInput';

const fieldLabelStyle = { color: 'var(--mv-text-muted)', fontSize: 12, display: 'block', marginBottom: 6 };
const fieldInputStyle = {
  width: '100%',
  background: 'var(--mv-bg)',
  border: '0.5px solid var(--mv-border)',
  borderRadius: 8,
  padding: '9px 12px',
  color: 'var(--mv-text)',
  fontSize: 13,
  marginBottom: 14,
  boxSizing: 'border-box',
  fontFamily: 'inherit',
};
const fieldErrorStyle = { color: 'var(--mv-color-danger)', fontSize: 11, margin: '-10px 0 14px' };
const fieldNoteStyle = { color: 'var(--mv-text-muted)', fontSize: 11, margin: '6px 0 0' };
const smallOutlineButtonStyle = (busy) => ({
  padding: '7px 12px',
  fontSize: 12,
  border: '0.5px solid var(--mv-border)',
  borderRadius: 6,
  background: 'var(--mv-bg)',
  color: 'var(--mv-text-muted)',
  cursor: busy ? 'default' : 'pointer',
  opacity: busy ? 0.6 : 1,
});

// Add/edit form for blog_posts, same controlled-input + validate() +
// fetch()/authHeaders() shape as ServiceForm.js. `post` is the last
// server-confirmed row (starts as the prop, replaces itself with each
// save/publish/unpublish response) — separate from the in-progress form
// fields, since BlogEditor's image upload and the cover-image upload
// both need a real post id (see uploadBlogImage's comment on why a new,
// never-saved post can't mint one yet).
const BlogPostForm = ({ post, onSaved, onDeleted, onCancel }) => {
  const { t } = useTranslation(['blog', 'common']);
  const [savedPost, setSavedPost] = useState(post || null);
  const [title, setTitle] = useState(post?.title || '');
  const [slug, setSlug] = useState(post?.slug || '');
  const [excerpt, setExcerpt] = useState(post?.excerpt || '');
  const [tags, setTags] = useState(post?.tags || []);
  const [bodyHtml, setBodyHtml] = useState(post?.body_html || '');
  const [coverImageUrl, setCoverImageUrl] = useState(post?.cover_image_url || '');
  const [submitting, setSubmitting] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const coverInputRef = useRef(null);

  const isPublished = Boolean(savedPost?.published_at);

  const validate = () => {
    const errors = {};
    if (!title.trim()) errors.title = t('blog:form.validation.titleRequired');
    return errors;
  };

  const handleSave = async () => {
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    setError(null);

    const body = {
      title: title.trim(),
      slug: slug.trim(),
      excerpt: excerpt.trim(),
      tags,
      bodyHtml,
      coverImageUrl: coverImageUrl || null,
    };

    try {
      const res = await fetch(savedPost ? `/api/blog/posts/${savedPost.id}` : '/api/blog/posts', {
        method: savedPost ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(body),
      });
      const saved = await res.json();
      if (!res.ok) throw new Error(saved.message || `blog-service returned ${res.status}`);
      setSavedPost(saved);
      setSlug(saved.slug);
      setTags(saved.tags || []);
      setBodyHtml(saved.body_html);
      onSaved(saved);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublishToggle = async () => {
    if (!savedPost) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/blog/posts/${savedPost.id}/${isPublished ? 'unpublish' : 'publish'}`, {
        method: 'POST',
        headers: authHeaders(),
      });
      const saved = await res.json();
      if (!res.ok) throw new Error(saved.message || `blog-service returned ${res.status}`);
      setSavedPost(saved);
      onSaved(saved);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!savedPost || !window.confirm(t('blog:form.deleteConfirm'))) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/blog/posts/${savedPost.id}`, { method: 'DELETE', headers: authHeaders() });
      if (!res.ok && res.status !== 204) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `blog-service returned ${res.status}`);
      }
      onDeleted(savedPost.id);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  const handleCoverFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !savedPost) return;
    setUploadingCover(true);
    setError(null);
    try {
      const url = await uploadBlogImage(savedPost.id, file);
      setCoverImageUrl(url);
    } catch (err) {
      setError(t('blog:form.uploadImageError', { error: err.message }));
    } finally {
      setUploadingCover(false);
    }
  };

  return (
    <div style={{ width: '100%' }}>
      <span
        onClick={onCancel}
        style={{ color: 'var(--mv-color-primary)', fontSize: 12, cursor: 'pointer', display: 'block', marginBottom: 14 }}
      >
        {t('common:back')}
      </span>

      <label style={fieldLabelStyle}>{t('blog:form.fields.title')}</label>
      <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} style={fieldInputStyle} />
      {fieldErrors.title && <p style={fieldErrorStyle}>{fieldErrors.title}</p>}

      <label style={fieldLabelStyle}>{t('blog:form.fields.slug')}</label>
      <input
        type="text"
        value={slug}
        onChange={(e) => setSlug(e.target.value)}
        disabled={isPublished}
        style={{ ...fieldInputStyle, opacity: isPublished ? 0.6 : 1 }}
      />
      {isPublished && <p style={fieldErrorStyle}>{t('blog:form.slugLockedNote')}</p>}

      <label style={fieldLabelStyle}>{t('blog:form.fields.excerpt')}</label>
      <textarea
        value={excerpt}
        onChange={(e) => setExcerpt(e.target.value)}
        rows={2}
        style={{ ...fieldInputStyle, resize: 'none' }}
      />

      <label style={fieldLabelStyle}>{t('blog:form.fields.tags')}</label>
      {/* Same ES-backed vocabulary/autocomplete as GoFeeler's Create
          Order form — no separate tagging system for blog posts. */}
      <div style={{ marginBottom: 14 }}>
        <TagInput selected={tags} onChange={setTags} />
      </div>

      <label style={fieldLabelStyle}>{t('blog:form.fields.coverImage')}</label>
      <div style={{ marginBottom: 14 }}>
        {coverImageUrl && (
          <img
            src={coverImageUrl}
            alt=""
            style={{ display: 'block', maxWidth: '100%', borderRadius: 8, marginBottom: 8 }}
          />
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            disabled={!savedPost || uploadingCover}
            title={savedPost ? undefined : t('blog:form.saveFirstForImages')}
            onClick={() => coverInputRef.current?.click()}
            style={smallOutlineButtonStyle(!savedPost || uploadingCover)}
          >
            {uploadingCover
              ? t('blog:form.uploadingImage')
              : coverImageUrl
                ? t('blog:form.replaceCoverImage')
                : t('blog:form.fields.coverImage')}
          </button>
          {coverImageUrl && (
            <button
              type="button"
              onClick={() => setCoverImageUrl('')}
              style={{ ...smallOutlineButtonStyle(false), color: 'var(--mv-color-danger)' }}
            >
              {t('blog:form.removeCoverImage')}
            </button>
          )}
        </div>
        {!savedPost && <p style={fieldNoteStyle}>{t('blog:form.saveFirstForImages')}</p>}
        <input ref={coverInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleCoverFile} />
      </div>

      <label style={fieldLabelStyle}>{t('blog:form.fields.body')}</label>
      <div style={{ marginBottom: 14 }}>
        <BlogEditor content={bodyHtml} onChange={setBodyHtml} postId={savedPost?.id} />
      </div>

      {error && <p style={{ color: 'var(--mv-color-danger)', fontSize: 12, margin: '0 0 14px' }}>{error}</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={submitting}
        style={{
          width: '100%',
          padding: '10px 0',
          background: 'var(--mv-color-primary)',
          color: 'var(--mv-color-primary-contrast)',
          fontWeight: 500,
          fontSize: 13,
          border: 'none',
          borderRadius: 8,
          cursor: submitting ? 'default' : 'pointer',
          opacity: submitting ? 0.6 : 1,
          marginBottom: savedPost ? 10 : 0,
        }}
      >
        {submitting ? t('blog:form.saving') : t('blog:form.save')}
      </button>

      {savedPost && (
        <ActionButtonRow>
          <button
            type="button"
            onClick={handlePublishToggle}
            disabled={submitting}
            style={{
              flex: 1,
              padding: '10px 0',
              background: 'transparent',
              border: '0.5px solid var(--mv-color-primary)',
              color: 'var(--mv-color-primary)',
              fontWeight: 500,
              fontSize: 13,
              borderRadius: 8,
              cursor: submitting ? 'default' : 'pointer',
              opacity: submitting ? 0.6 : 1,
            }}
          >
            {isPublished ? t('blog:form.unpublish') : t('blog:form.publish')}
          </button>
          {!isPublished && (
            <OutlineDangerButton onClick={handleDelete} disabled={submitting}>
              {t('blog:form.delete')}
            </OutlineDangerButton>
          )}
        </ActionButtonRow>
      )}
    </div>
  );
};

export default BlogPostForm;
