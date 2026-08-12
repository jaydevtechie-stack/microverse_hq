import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconPaperclip, IconUpload, IconX } from '@tabler/icons-react';
import { authHeaders } from '../services/keycloak';

const formatSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Lists the files uploaded via CreateOrderForm's asset-service flow —
// asset-service has no metadata table (stateless-first), so this is a
// live ListObjectsV2 under the order's key prefix every time, same as
// the Rust side's own list_assets handler.
//
// `editable` gates add/remove — only true for the owning customer while
// the order is `analyst` (5.7.1 reopened this for analyst-requests-more-
// content; 5.7.2 then narrowed it to *just* `analyst`, not `unassigned`
// — a fresh order already has whatever files the customer meant to
// attach, so re-upload only makes sense once an analyst actually asks
// for something). asset-service enforces the same window server-side;
// this is just so the buttons don't appear when they'd 403 anyway.
// Read-only otherwise, same as before.
const TaskFilesList = ({ taskId, service, editable = false }) => {
  const { t } = useTranslation(['gofeeler', 'common']);
  const [files, setFiles] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef(null);

  const refetch = () => {
    setError(null);
    return fetch(`/api/assets/${taskId}?service=${service}`, { headers: authHeaders() })
      .then((res) => {
        if (!res.ok) throw new Error(`asset-service returned ${res.status}`);
        return res.json();
      })
      .then(setFiles)
      .catch((err) => setError(err.message));
  };

  useEffect(() => {
    if (!taskId || !service) return;
    setFiles(null);
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, service]);

  const handleAdd = async (file) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const uploadRes = await fetch('/api/assets/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          service,
          order_id: taskId,
          filename: file.name,
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
      if (!putRes.ok) throw new Error(t('common:fileUploadFailed'));

      await refetch();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemove = async (filename) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/assets/${taskId}?service=${service}&filename=${encodeURIComponent(filename)}`,
        { method: 'DELETE', headers: authHeaders() }
      );
      if (!res.ok && res.status !== 204) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `asset-service returned ${res.status}`);
      }
      await refetch();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!files) {
    return <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: 0 }}>{t('gofeeler:files.loading')}</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
      {error && (
        <p style={{ color: 'var(--mv-color-danger)', fontSize: 12, margin: 0 }}>{error}</p>
      )}

      {files.length === 0 && (
        <p style={{ color: 'var(--mv-text-muted)', fontSize: 12, margin: 0 }}>{t('gofeeler:files.empty')}</p>
      )}

      {files.map((file) => (
        <div key={file.filename} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <IconPaperclip size={14} color="var(--mv-text-muted)" aria-hidden="true" />
          <span
            style={{
              color: 'var(--mv-text)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              flex: '0 1 auto',
            }}
          >
            {file.filename}
          </span>
          <span style={{ color: 'var(--mv-text-muted)', fontSize: 11, whiteSpace: 'nowrap' }}>
            {formatSize(file.size)}
          </span>
          {editable && (
            <IconX
              size={13}
              color="var(--mv-color-danger)"
              aria-label={t('gofeeler:files.removeAriaLabel', { filename: file.filename })}
              style={{ cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.5 : 1 }}
              onClick={() => !busy && handleRemove(file.filename)}
            />
          )}
        </div>
      ))}

      {editable && (
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            color: 'var(--mv-color-primary)',
            cursor: busy ? 'default' : 'pointer',
            opacity: busy ? 0.5 : 1,
            marginTop: 2,
          }}
        >
          <IconUpload size={13} aria-hidden="true" />
          {busy ? t('gofeeler:files.working') : t('gofeeler:files.addFile')}
          <input
            ref={fileInputRef}
            type="file"
            disabled={busy}
            onChange={(e) => handleAdd(e.target.files?.[0])}
            style={{ display: 'none' }}
          />
        </label>
      )}
    </div>
  );
};

export default TaskFilesList;
