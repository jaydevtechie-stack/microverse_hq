import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { authHeaders } from '../services/keycloak';

const STATUS_OPTIONS = ['planned', 'designing', 'building', 'basic', 'online'];

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

// Add/edit form for the `services` table — same controlled-input +
// validate() + fetch()/authHeaders() shape as EditOrderForm.js. `key`
// is only collected (and only editable) on create; a service's key is
// its stable identity everywhere else (ServiceCard, SERVICE_THEME
// merge, subdomain routing) so it isn't editable afterward.
const ServiceForm = ({ service, onSaved, onCancel }) => {
  const { t } = useTranslation(['admin', 'common']);
  const isEdit = Boolean(service);
  const [key, setKey] = useState(service?.key || '');
  const [name, setName] = useState(service?.name || '');
  const [tech, setTech] = useState(service?.tech || '');
  const [title, setTitle] = useState(service?.title || '');
  const [description, setDescription] = useState(service?.description || '');
  const [status, setStatus] = useState(service?.status || 'planned');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const validate = () => {
    const errors = {};
    if (!isEdit && !key.trim()) errors.key = t('admin:serviceForm.validation.keyRequired');
    if (!name.trim()) errors.name = t('admin:serviceForm.validation.nameRequired');
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

    const body = { name: name.trim(), tech: tech.trim() || null, title: title.trim() || null, description: description.trim() || null, status };
    if (!isEdit) body.key = key.trim();

    try {
      const res = await fetch(isEdit ? `/api/services/${service.id}` : '/api/services', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(body),
      });
      const saved = await res.json();
      if (!res.ok) throw new Error(saved.message || `task-service returned ${res.status}`);
      onSaved(saved);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <div style={{ width: '100%' }}>
      {!isEdit && (
        <>
          <label style={fieldLabelStyle}>{t('admin:serviceForm.fields.key')}</label>
          <input
            type="text"
            value={key}
            onChange={(e) => {
              setKey(e.target.value);
              clearFieldError('key');
            }}
            style={fieldInputStyle}
          />
          {fieldErrors.key && <p style={fieldErrorStyle}>{fieldErrors.key}</p>}
        </>
      )}

      <label style={fieldLabelStyle}>{t('admin:serviceForm.fields.name')}</label>
      <input
        type="text"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          clearFieldError('name');
        }}
        style={fieldInputStyle}
      />
      {fieldErrors.name && <p style={fieldErrorStyle}>{fieldErrors.name}</p>}

      <label style={fieldLabelStyle}>{t('admin:serviceForm.fields.tech')}</label>
      <input type="text" value={tech} onChange={(e) => setTech(e.target.value)} style={fieldInputStyle} />

      <label style={fieldLabelStyle}>{t('admin:serviceForm.fields.title')}</label>
      <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} style={fieldInputStyle} />

      <label style={fieldLabelStyle}>{t('admin:serviceForm.fields.description')}</label>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
        style={{ ...fieldInputStyle, resize: 'none' }}
      />

      <label style={fieldLabelStyle}>{t('admin:serviceForm.fields.status')}</label>
      <select value={status} onChange={(e) => setStatus(e.target.value)} style={fieldInputStyle}>
        {STATUS_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {t(`admin:status.${option}`)}
          </option>
        ))}
      </select>

      {error && <p style={{ color: 'var(--mv-color-danger)', fontSize: 12, margin: '0 0 14px' }}>{error}</p>}

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
          {submitting ? t('admin:serviceForm.saving') : t('admin:serviceForm.save')}
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
          {t('common:cancel')}
        </button>
      </div>
    </div>
  );
};

export default ServiceForm;
