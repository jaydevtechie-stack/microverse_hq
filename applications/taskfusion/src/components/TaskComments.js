import React, { useEffect, useState } from 'react';

// Read-only for now — seeded data only (Branch 3.3), no POST/submission
// UI yet (Branch 4). Renders each top-level comment with its one
// allowed reply indented beneath — see SCHEMA.md's task_comments for
// why there's never more than one level to render here.
//
// visibility scopes to 'internal' (staff discussion) or 'customer'
// (notes the customer can see) — always pass it explicitly, since
// omitting it returns both and this component has no auth check of
// its own to stop a customer-facing view from leaking internal rows.
const TaskComments = ({ taskId, visibility }) => {
  const [comments, setComments] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!taskId) return;
    setComments(null);
    setError(null);
    fetch(`/api/tasks/${taskId}/comments?visibility=${visibility}`)
      .then((res) => {
        if (!res.ok) throw new Error(`task-service returned ${res.status}`);
        return res.json();
      })
      .then(setComments)
      .catch((err) => setError(err.message));
  }, [taskId, visibility]);

  if (error) {
    return (
      <p style={{ color: 'var(--mv-color-danger)', fontSize: 12, margin: 0 }}>
        Couldn't load comments: {error}
      </p>
    );
  }

  if (!comments) {
    return (
      <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: 0 }}>Loading comments…</p>
    );
  }

  if (comments.length === 0) {
    return <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: 0 }}>No comments yet.</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {comments.map((comment) => (
        <div key={comment.comment_id}>
          <CommentRow author={comment.author} createdAt={comment.created_at} content={comment.content} />
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
              <CommentRow author={reply.author} createdAt={reply.created_at} content={reply.content} />
            </div>
          ))}
        </div>
      ))}
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

export default TaskComments;
