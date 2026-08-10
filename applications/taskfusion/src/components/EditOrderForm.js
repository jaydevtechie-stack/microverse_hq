import React, { useState } from 'react';
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

// Same fields as CreateOrderForm (title/context/tags/deadline). Files
// are TaskFilesList's own add/remove UI — not duplicated here, but
// `filesSlot` lets the caller render it between the fields and the
// Save/Cancel row so Save stays the last thing on the page rather than
// sitting above the files list. Only ever rendered while the order is
// still `unassigned` (TaskDetailContent's call site gates on that +
// customer ownership); task-service's PUT /api/tasks/:id enforces the
// same window server-side regardless.
const EditOrderForm = ({ task, onSaved, onCancel, filesSlot }) => {
  const [title, setTitle] = useState(task.title);
  const [context, setContext] = useState(task.context || '');
  const [tags, setTags] = useState(task.tags || []);
  const [dueDate, setDueDate] = useState(task.due_date ? task.due_date.slice(0, 10) : '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  // Same mandatory fields as CreateOrderForm, minus file — files here
  // are already-attached/managed separately via filesSlot's own
  // add/remove, not a single upload input, so "at least one file"
  // isn't something this form's own state can validate.
  const validate = () => {
    const errors = {};
    if (!title.trim()) errors.title = 'Title is required';
    if (!context.trim()) errors.context = 'Context is required';
    if (tags.length === 0) errors.tags = 'At least one sentiment tag is required';
    if (!dueDate) errors.dueDate = 'Deadline is required';
    return errors;
  };

  const clearFieldError = (field) => {
    if (fieldErrors[field]) setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSave = async () => {
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          title: title.trim(),
          context: context.trim() || null,
          tags,
          dueDate: dueDate || null,
        }),
      });
      const updated = await res.json();
      if (!res.ok) {
        throw new Error(updated.message || `task-service returned ${res.status}`);
      }
      onSaved(updated);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <div style={{ width: '100%' }}>
      <label style={fieldLabelStyle}>Title</label>
      <input
        type="text"
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          clearFieldError('title');
        }}
        style={fieldInputStyle}
      />
      {fieldErrors.title && <p style={fieldErrorStyle}>{fieldErrors.title}</p>}

      <label style={fieldLabelStyle}>Context</label>
      <textarea
        value={context}
        onChange={(e) => {
          setContext(e.target.value);
          clearFieldError('context');
        }}
        rows={3}
        style={{ ...fieldInputStyle, resize: 'none' }}
      />
      {fieldErrors.context && <p style={fieldErrorStyle}>{fieldErrors.context}</p>}

      <label style={fieldLabelStyle}>Sentiment focus</label>
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

      <label style={fieldLabelStyle}>Deadline</label>
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

      {filesSlot && (
        <>
          <label style={fieldLabelStyle}>Files</label>
          <div style={{ marginBottom: 18 }}>{filesSlot}</div>
        </>
      )}

      {error && (
        <p style={{ color: 'var(--mv-color-danger)', fontSize: 12, margin: '0 0 14px' }}>{error}</p>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={handleSave}
          disabled={submitting}
          style={{
            padding: '9px 16px',
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
          {submitting ? 'Saving…' : 'Save changes'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          style={{
            padding: '9px 16px',
            background: 'transparent',
            color: 'var(--mv-text-muted)',
            fontWeight: 500,
            fontSize: 13,
            border: '0.5px solid var(--mv-border)',
            borderRadius: 8,
            cursor: submitting ? 'default' : 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default EditOrderForm;
