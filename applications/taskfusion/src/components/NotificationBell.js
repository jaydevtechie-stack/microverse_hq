// src/components/NotificationBell.js
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { io } from 'socket.io-client';
import { IconBell } from '@tabler/icons-react';
import { authHeaders } from '../services/keycloak';
import useClickOutside from '../hooks/useClickOutside';

// Branch 7 — real bell replacing the static placeholder icon that used
// to sit here. Fetch-on-mount pattern mirrors AnalystPicker.js; the
// dropdown itself mirrors Navbar's own avatar menu (own open state +
// useClickOutside + absolute card popover) rather than a shared
// primitive, since none exists in this app yet. GET /api/notifications
// is the source of truth (unread count included); the socket connection
// is additive — a live push while this tab is open, merged into the
// same list rather than replacing it.
const NotificationBell = ({ keycloak }) => {
  const { t } = useTranslation('navbar');
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const wrapRef = useRef(null);
  useClickOutside(wrapRef, () => setOpen(false));

  useEffect(() => {
    if (!keycloak?.authenticated) return;

    fetch('/api/notifications', { headers: authHeaders() })
      .then((res) => (res.ok ? res.json() : { notifications: [], unreadCount: 0 }))
      .then((data) => {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      })
      .catch(() => {});

    const socket = io({ auth: { token: keycloak.token } });
    socket.on('notification', (notification) => {
      setNotifications((prev) => [notification, ...prev]);
      setUnreadCount((count) => count + 1);
    });

    return () => socket.disconnect();
  }, [keycloak?.authenticated, keycloak?.token]);

  const openNotification = (notification) => {
    setOpen(false);
    if (!notification.read) {
      setUnreadCount((count) => Math.max(0, count - 1));
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
      );
      fetch(`/api/notifications/${notification.id}`, {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ read: true }),
      }).catch(() => {});
    }
    navigate(`/task/${notification.task_id}`);
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'flex' }}>
      <button
        type="button"
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        aria-label={
          unreadCount > 0 ? t('notifications.unreadAriaLabel', { count: unreadCount }) : t('notifications.ariaLabel')
        }
        style={{ background: 'none', border: 'none', padding: 0, display: 'flex', cursor: 'pointer', position: 'relative' }}
      >
        <IconBell size={16} color="var(--mv-text-muted)" aria-hidden="true" />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -6,
              right: -8,
              minWidth: 14,
              height: 14,
              padding: '0 3px',
              borderRadius: 7,
              background: 'var(--mv-color-danger)',
              color: '#fff',
              fontSize: 9,
              fontWeight: 700,
              lineHeight: '14px',
              textAlign: 'center',
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: 290,
            background: 'var(--mv-bg-elevated)',
            border: '0.5px solid var(--mv-border)',
            borderRadius: 10,
            boxShadow: 'var(--mv-shadow)',
            overflow: 'hidden',
            zIndex: 20,
          }}
        >
          {notifications.length === 0 ? (
            <div style={{ padding: 14, fontSize: 12, color: 'var(--mv-text-muted)', textAlign: 'center' }}>
              {t('notifications.empty')}
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                onClick={() => openNotification(notification)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  padding: '9px 12px',
                  cursor: 'pointer',
                  borderBottom: '0.5px solid var(--mv-border)',
                  minWidth: 0,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    marginTop: 5,
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    flexShrink: 0,
                    background: notification.read ? 'transparent' : 'var(--mv-color-primary)',
                  }}
                />
                <div
                  style={{
                    fontSize: 12.5,
                    fontWeight: notification.read ? 400 : 600,
                    color: 'var(--mv-text)',
                  }}
                >
                  {notification.message}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
