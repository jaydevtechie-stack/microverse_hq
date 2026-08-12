import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { authHeaders } from '../services/keycloak';

const textareaStyle = {
  width: '100%',
  background: 'var(--mv-bg)',
  border: '0.5px solid var(--mv-border)',
  borderRadius: 8,
  padding: '8px 10px',
  color: 'var(--mv-text)',
  fontSize: 12,
  fontFamily: 'inherit',
  resize: 'none',
  boxSizing: 'border-box',
};

const submitButtonStyle = (disabled) => ({
  alignSelf: 'flex-end',
  padding: '6px 12px',
  background: 'var(--mv-color-primary)',
  color: 'var(--mv-color-primary-contrast)',
  fontWeight: 500,
  fontSize: 11,
  border: 'none',
  borderRadius: 6,
  cursor: disabled ? 'default' : 'pointer',
  opacity: disabled ? 0.6 : 1,
});

// Deliberately independent of whether the viewer can edit the order
// (title/context/tags/files' unassigned-only window) — posting a
// comment/note stays available at any task status, its own separate
// submit action from any of that. visibility scopes to 'internal'
// (staff discussion) or 'customer' (notes the customer can see) —
// always pass it explicitly, since omitting it fetches both and this
// component has no auth check of its own to stop a customer-facing
// view from leaking internal rows; new top-level posts use it as-is,
// task-service resolves a reply's visibility from its parent instead
// (a reply can't flip visibility partway down a thread).
const TaskComments = ({ taskId, visibility }) => {
  const { t } = useTranslation('gofeeler');
  const [comments, setComments] = useState(null);
  const [error, setError] = useState(null);

  const refetch = () => {
    setError(null);
    return fetch(`/api/tasks/${taskId}/comments?visibility=${visibility}`, { headers: authHeaders() })
      .then((res) => {
        if (!res.ok) throw new Error(`task-service returned ${res.status}`);
        return res.json();
      })
      .then(setComments)
      .catch((err) => setError(err.message));
  };

  useEffect(() => {
    if (!taskId) return;
    setComments(null);
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, visibility]);

  const postComment = async ({ content, parentCommentId }) => {
    const res = await fetch(`/api/tasks/${taskId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ content, visibility, parentCommentId: parentCommentId || null }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.message || `task-service returned ${res.status}`);
    await refetch();
  };

  if (error) {
    return (
      <p style={{ color: 'var(--mv-color-danger)', fontSize: 12, margin: 0 }}>
        {t('comments.loadError', { error })}
      </p>
    );
  }

  if (!comments) {
    return (
      <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: 0 }}>{t('comments.loading')}</p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {comments.length === 0 && (
        <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: 0 }}>{t('comments.empty')}</p>
      )}

      {comments.map((comment) => (
        <div key={comment.comment_id}>
          <CommentRow author={comment.author_name || comment.author} createdAt={comment.created_at} content={comment.content} />
          {comment.replies.map((reply) => (
            <div
              key={reply.comment_id}
              style={{
                marginLeft: 16,
                marginTop: 8,
                paddingLeft: 10,
                borderLeft: '0.5px solid var(--mv-border)',
              }}
            >
              <CommentRow author={reply.author_name || reply.author} createdAt={reply.created_at} content={reply.content} />
            </div>
          ))}
          {/* One level of replies only (SCHEMA.md) — a comment that's
              already a reply gets no Reply affordance of its own. */}
          <ReplyBox commentId={comment.comment_id} onSubmit={postComment} />
        </div>
      ))}

      <ComposeBox onSubmit={postComment} />
    </div>
  );
};

const CommentRow = ({ author, createdAt, content }) => (
  <>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ color: 'var(--mv-text)', fontSize: 12, fontWeight: 500 }}>{author}</span>
      <span style={{ color: 'var(--mv-text-muted)', fontSize: 10, whiteSpace: 'nowrap' }}>
        {new Date(createdAt).toLocaleString()}
      </span>
    </div>
    <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: '2px 0 0' }}>{content}</p>
  </>
);

// The always-visible "new top-level comment" compose box, own submit
// button separate from anything else on the page (including the
// order's own Save changes button, if one happens to be showing).
const ComposeBox = ({ onSubmit }) => {
  const { t } = useTranslation('gofeeler');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ content: content.trim() });
      setContent('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={t('comments.composePlaceholder')}
        rows={2}
        style={textareaStyle}
      />
      {error && <p style={{ color: 'var(--mv-color-danger)', fontSize: 11, margin: 0 }}>{error}</p>}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting || !content.trim()}
        style={submitButtonStyle(submitting || !content.trim())}
      >
        {submitting ? t('comments.posting') : t('comments.post')}
      </button>
    </div>
  );
};

// Collapsed behind a "Reply" toggle rather than an always-open box per
// comment — keeps a long thread scannable. Its own submit button, same
// as ComposeBox — posting a reply doesn't touch the top-level box.
const ReplyBox = ({ commentId, onSubmit }) => {
  const { t } = useTranslation(['gofeeler', 'common']);
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--mv-color-primary)',
          fontSize: 11,
          padding: 0,
          marginTop: 6,
          cursor: 'pointer',
        }}
      >
        {t('gofeeler:comments.reply')}
      </button>
    );
  }

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ content: content.trim(), parentCommentId: commentId });
      setContent('');
      setOpen(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, marginLeft: 16 }}>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={t('gofeeler:comments.replyPlaceholder')}
        rows={2}
        style={textareaStyle}
        autoFocus
      />
      {error && <p style={{ color: 'var(--mv-color-danger)', fontSize: 11, margin: 0 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={submitting}
          style={{
            padding: '6px 12px',
            background: 'transparent',
            color: 'var(--mv-text-muted)',
            fontSize: 11,
            border: '0.5px solid var(--mv-border)',
            borderRadius: 6,
            cursor: submitting ? 'default' : 'pointer',
          }}
        >
          {t('common:cancel')}
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || !content.trim()}
          style={submitButtonStyle(submitting || !content.trim())}
        >
          {submitting ? t('gofeeler:comments.posting') : t('gofeeler:comments.reply')}
        </button>
      </div>
    </div>
  );
};

export default TaskComments;
