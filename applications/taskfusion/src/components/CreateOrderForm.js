import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconUpload } from '@tabler/icons-react';
import TagInput from './TagInput';
import { authHeaders } from '../services/keycloak';

const fieldLabelStyle = {
  color: 'var(--mv-text-muted)',
  fontSize: 12,
  display: 'block',
  marginBottom: 6,
};

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

// Hardcoded — this form only exists for Gofeeler right now (see the
// "Gofeeler · New order" header wherever it's rendered). Becomes a
// prop once other domain services get their own Create Order forms.
const SERVICE = 'gofeeler';

// The actual form fields — shared by the standalone CreateOrderPage and
// GofeelerSplitView's embedded create panel. onCreated is optional —
// GofeelerSplitView passes one to refetch its sibling list panel;
// CreateOrderPage has no sibling list, so it's left undefined there.
const CreateOrderForm = ({ onCreated } = {}) => {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [context, setContext] = useState('');
  const [tags, setTags] = useState(['Negative', 'Urgency']);
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Minted client-side, once per form instance — has to exist before
  // the file upload (its MinIO key includes the order_id) and gets
  // reused as this task's own id on create, so the two stay linked.
  const orderId = useRef(crypto.randomUUID());

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      if (file) {
        const uploadRes = await fetch('/api/assets/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({
            service: SERVICE,
            order_id: orderId.current,
            filename: file.name,
            // Falls back to text/plain, not octet-stream — the upload
            // host's content-type allowlist only accepts
            // text/image/json/pdf, and most real GoFeeler uploads
            // (chat/email exports) are text anyway.
            content_type: file.type || 'text/plain',
          }),
        });
        const uploadBody = await uploadRes.json();
        if (!uploadRes.ok) {
          throw new Error(uploadBody.message || `asset-service returned ${uploadRes.status}`);
        }

        const putRes = await fetch(uploadBody.upload_url, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'text/plain' },
          body: file,
        });
        if (!putRes.ok) throw new Error('File upload failed');
      }

      const createRes = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          id: orderId.current,
          service: SERVICE,
          title: title.trim(),
          context: context.trim() || null,
          tags,
        }),
      });
      const task = await createRes.json();
      if (!createRes.ok) {
        throw new Error(task.message || `task-service returned ${createRes.status}`);
      }

      onCreated?.(task);
      // Back to wherever this form was opened from — the gofeeler list
      // (embedded in GofeelerSplitView) or CustomerPage (standalone
      // CreateOrderPage) — rather than a hardcoded destination that's
      // only right for one of those two contexts.
      navigate(-1);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <>
      <label style={fieldLabelStyle}>Title</label>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="e.g. Q3 customer support chat review"
        style={fieldInputStyle}
      />

      <label style={fieldLabelStyle}>Context (optional)</label>
      <textarea
        value={context}
        onChange={(e) => setContext(e.target.value)}
        placeholder="Anything the analyst should know before starting..."
        rows={3}
        style={{ ...fieldInputStyle, resize: 'none' }}
      />

      <label style={fieldLabelStyle}>Sentiment focus</label>
      <div style={{ marginBottom: 18 }}>
        <TagInput selected={tags} onChange={setTags} />
      </div>

      <label style={fieldLabelStyle}>Upload content</label>
      <label
        style={{
          display: 'block',
          border: '1px dashed var(--mv-border)',
          borderRadius: 10,
          padding: 22,
          textAlign: 'center',
          marginBottom: 18,
          cursor: 'pointer',
        }}
      >
        <input
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          style={{ display: 'none' }}
        />
        <IconUpload size={22} color="var(--mv-color-primary)" aria-hidden="true" />
        <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: '8px 0 0' }}>
          {file?.name || 'Drag a file here, or click to browse'}
        </p>
        <p style={{ color: 'var(--mv-badge-bg)', fontSize: 11, margin: '2px 0 0' }}>
          Stored via asset-service → MinIO
        </p>
      </label>

      {error && (
        <p style={{ color: 'var(--mv-color-danger)', fontSize: 12, margin: '0 0 14px' }}>
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleSubmit}
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
        }}
      >
        {submitting ? 'Creating…' : 'Create order'}
      </button>
    </>
  );
};

export default CreateOrderForm;
