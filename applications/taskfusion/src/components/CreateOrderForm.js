import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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

const fieldErrorStyle = {
  color: 'var(--mv-color-danger)',
  fontSize: 11,
  margin: '-10px 0 14px',
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
  const { t } = useTranslation('orders');
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [context, setContext] = useState('');
  // No default tags — every field here is mandatory and has to be a
  // real choice, not a prefilled one nobody actually picked.
  const [tags, setTags] = useState([]);
  const [dueDate, setDueDate] = useState('');
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  // Minted client-side, once per form instance — has to exist before
  // the file upload (its MinIO key includes the order_id) and gets
  // reused as this task's own id on create, so the two stay linked.
  const orderId = useRef(crypto.randomUUID());

  const validate = () => {
    const errors = {};
    if (!title.trim()) errors.title = t('validation.titleRequired');
    if (!context.trim()) errors.context = t('validation.contextRequired');
    if (!file) errors.file = t('validation.fileRequired');
    if (tags.length === 0) errors.tags = t('validation.tagsRequired');
    if (!dueDate) errors.dueDate = t('validation.deadlineRequired');
    return errors;
  };

  const handleSubmit = async () => {
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    setError(null);

    try {
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

      const createRes = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          id: orderId.current,
          service: SERVICE,
          title: title.trim(),
          context: context.trim() || null,
          tags,
          dueDate: dueDate || null,
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

  const clearFieldError = (field) => {
    if (fieldErrors[field]) setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  return (
    <>
      <label style={fieldLabelStyle}>{t('fields.title')}</label>
      <input
        type="text"
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          clearFieldError('title');
        }}
        placeholder={t('createForm.titlePlaceholder')}
        style={fieldInputStyle}
      />
      {fieldErrors.title && <p style={fieldErrorStyle}>{fieldErrors.title}</p>}

      <label style={fieldLabelStyle}>{t('fields.context')}</label>
      <textarea
        value={context}
        onChange={(e) => {
          setContext(e.target.value);
          clearFieldError('context');
        }}
        placeholder={t('createForm.contextPlaceholder')}
        rows={3}
        style={{ ...fieldInputStyle, resize: 'none' }}
      />
      {fieldErrors.context && <p style={fieldErrorStyle}>{fieldErrors.context}</p>}

      <label style={fieldLabelStyle}>{t('fields.sentimentFocus')}</label>
      <div style={{ marginBottom: fieldErrors.tags ? 0 : 18 }}>
        <TagInput
          selected={tags}
          onChange={(next) => {
            setTags(next);
            clearFieldError('tags');
          }}
        />
      </div>
      {fieldErrors.tags && <p style={{ ...fieldErrorStyle, margin: '4px 0 14px' }}>{fieldErrors.tags}</p>}

      <label style={fieldLabelStyle}>{t('fields.deadline')}</label>
      <input
        type="date"
        value={dueDate}
        min={new Date().toISOString().slice(0, 10)}
        onChange={(e) => {
          setDueDate(e.target.value);
          clearFieldError('dueDate');
        }}
        style={fieldInputStyle}
      />
      {fieldErrors.dueDate && <p style={fieldErrorStyle}>{fieldErrors.dueDate}</p>}

      <label style={fieldLabelStyle}>{t('fields.uploadContent')}</label>
      <label
        style={{
          display: 'block',
          border: `1px dashed ${fieldErrors.file ? 'var(--mv-color-danger)' : 'var(--mv-border)'}`,
          borderRadius: 10,
          padding: 22,
          textAlign: 'center',
          marginBottom: fieldErrors.file ? 4 : 18,
          cursor: 'pointer',
        }}
      >
        <input
          type="file"
          onChange={(e) => {
            setFile(e.target.files?.[0] || null);
            clearFieldError('file');
          }}
          style={{ display: 'none' }}
        />
        <IconUpload size={22} color="var(--mv-color-primary)" aria-hidden="true" />
        <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: '8px 0 0' }}>
          {file?.name || t('createForm.dropzoneHint')}
        </p>
        <p style={{ color: 'var(--mv-badge-bg)', fontSize: 11, margin: '2px 0 0' }}>
          {t('createForm.storageNote')}
        </p>
      </label>
      {fieldErrors.file && <p style={{ ...fieldErrorStyle, margin: '0 0 18px' }}>{fieldErrors.file}</p>}

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
        {submitting ? t('createForm.submitting') : t('createForm.submit')}
      </button>
    </>
  );
};

export default CreateOrderForm;
