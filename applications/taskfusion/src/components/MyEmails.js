// src/components/MyEmails.js
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { authHeaders } from '../services/keycloak';
import timeAgo from '../utils/timeAgo';

// MyProfilePage's right panel — reads back what was actually sent to
// this user via notification-service's GET /api/emails, which scopes
// the MailHog search to the caller's own JWT email server-side (see
// notification-service/services/mailhog.js) rather than trusting
// MailHog's own unauthenticated API directly from the browser.
const MyEmails = () => {
  const { t } = useTranslation('profile');
  const [emails, setEmails] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/emails', { headers: authHeaders() })
      .then((res) => {
        if (!res.ok) throw new Error(`notification-service returned ${res.status}`);
        return res.json();
      })
      .then((data) => setEmails(data.emails || []))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div style={{ width: '100%', maxWidth: 480 }}>
      <p style={{ color: 'var(--mv-text)', fontSize: 14, fontWeight: 600, margin: '0 0 12px' }}>
        {t('myEmails.title')}
      </p>

      {error && (
        <p style={{ color: 'var(--mv-color-danger)', fontSize: 12 }}>{t('myEmails.loadError', { error })}</p>
      )}

      {!error && emails === null && (
        <p style={{ color: 'var(--mv-badge-bg)', fontSize: 12 }}>{t('myEmails.loading')}</p>
      )}

      {emails?.length === 0 && (
        <p style={{ color: 'var(--mv-badge-bg)', fontSize: 12 }}>{t('myEmails.empty')}</p>
      )}

      {emails?.length > 0 && (
        <div style={{ border: '0.5px solid var(--mv-border)', borderRadius: 8, overflow: 'hidden' }}>
          {emails.map((email) => (
            <div key={email.id} style={{ padding: '10px 12px', borderBottom: '0.5px solid var(--mv-border)' }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--mv-text)', margin: '0 0 3px' }}>
                {email.subject}
              </p>
              <p style={{ fontSize: 12, color: 'var(--mv-text-muted)', margin: '0 0 4px', lineHeight: 1.4 }}>
                {email.snippet}
              </p>
              <p style={{ fontSize: 11, color: 'var(--mv-badge-bg)', margin: 0 }}>{timeAgo(email.createdAt)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyEmails;
