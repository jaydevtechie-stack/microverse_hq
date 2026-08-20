// src/components/NotificationBell.js
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { io } from 'socket.io-client';
import { IconBell, IconX } from '@tabler/icons-react';
import { authHeaders } from '../services/keycloak';
import timeAgo from '../utils/timeAgo';

// Branch 7 — real bell replacing the static placeholder icon that used
// to sit here. Fetch-on-mount pattern mirrors AnalystPicker.js.
//
// The panel itself follows the design system's "Notification fly-in"
// mock-up (design-system-default-v2.html) rather than a small dropdown:
// a full-height panel sliding in from the right with its own backdrop,
// header/list/footer, portaled to document.body — the mock-up's own
// markup renders .notif-backdrop/.notif-panel as siblings of the page
// root rather than nested in the navbar, and position:fixed on a panel
// this size needs to escape any ancestor stacking context (e.g. a
// transformed parent) to actually cover the viewport reliably. That
// mock-up's token vocabulary (--surface, --sp-*, --blue, …) belongs to
// the not-yet-live default_v2 theme candidate, not what's actually
// wired into this app (branding/mv-1.0/design-system/tokens.css's
// --mv-* tokens) — the fly-in's structure/behavior is what's being
// applied here, translated onto the real live tokens, not a literal
// CSS copy-paste.
//
// GET /api/notifications is the source of truth (unread count
// included); the socket connection is additive — a live push while
// this tab is open, merged into the same list rather than replacing it.
const NotificationBell = ({ keycloak }) => {
  const { t } = useTranslation('navbar');
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const bellRef = useRef(null);
  const closeRef = useRef(null);

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

  // Focus the close button on open, return focus to the bell on close —
  // same behavior as the mock-up's openPanel/closePanel.
  useEffect(() => {
    if (open) {
      closeRef.current?.focus();
      const onKeyDown = (e) => {
        if (e.key === 'Escape') setOpen(false);
      };
      document.addEventListener('keydown', onKeyDown);
      return () => document.removeEventListener('keydown', onKeyDown);
    }
    bellRef.current?.focus({ preventScroll: true });
  }, [open]);

  const closePanel = () => setOpen(false);

  const openNotification = (notification) => {
    closePanel();
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

  const markAllRead = () => {
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    fetch('/api/notifications/read-all', { method: 'PATCH', headers: authHeaders() }).catch(() => {});
  };

  return (
    <>
      <button
        ref={bellRef}
        type="button"
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        aria-label={
          unreadCount > 0 ? t('notifications.unreadAriaLabel', { count: unreadCount }) : t('notifications.ariaLabel')
        }
        aria-expanded={open}
        aria-controls="notif-panel"
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

      {createPortal(
        <>
          <div
            onClick={closePanel}
            aria-hidden="true"
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(5, 6, 26, 0.45)',
              zIndex: 29,
              opacity: open ? 1 : 0,
              pointerEvents: open ? 'auto' : 'none',
              transition: 'opacity .2s ease',
            }}
          />
          <aside
            id="notif-panel"
            role="dialog"
            aria-label={t('notifications.title')}
            aria-hidden={!open}
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              height: '100%',
              width: 380,
              maxWidth: '88vw',
              background: 'var(--mv-bg-elevated)',
              borderLeft: '0.5px solid var(--mv-border)',
              boxShadow: 'var(--mv-shadow)',
              zIndex: 30,
              display: 'flex',
              flexDirection: 'column',
              transform: open ? 'translateX(0)' : 'translateX(100%)',
              transition: 'transform .28s ease',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 16,
                borderBottom: '0.5px solid var(--mv-border)',
                flex: 'none',
              }}
            >
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--mv-text)' }}>
                {t('notifications.title')}
              </span>
              <button
                ref={closeRef}
                type="button"
                onClick={closePanel}
                aria-label={t('notifications.close')}
                style={{ background: 'none', border: 'none', padding: 4, display: 'flex', cursor: 'pointer', color: 'var(--mv-text-muted)' }}
              >
                <IconX size={18} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
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
                      gap: 10,
                      padding: '14px 16px',
                      cursor: 'pointer',
                      borderBottom: '0.5px solid var(--mv-border)',
                      minWidth: 0,
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        marginTop: 5,
                        width: 7,
                        height: 7,
                        borderRadius: 4,
                        flexShrink: 0,
                        background: notification.read ? 'transparent' : 'var(--mv-color-primary)',
                      }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: notification.read ? 400 : 600, color: 'var(--mv-text)', margin: '0 0 3px', lineHeight: 1.4 }}>
                        {notification.message}
                      </p>
                      <p style={{ fontSize: 11, color: 'var(--mv-text-muted)', margin: 0 }}>{timeAgo(notification.created_at)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div style={{ padding: '10px 16px', borderTop: '0.5px solid var(--mv-border)', flex: 'none' }}>
              <button
                type="button"
                onClick={markAllRead}
                disabled={unreadCount === 0}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: unreadCount === 0 ? 'var(--mv-text-muted)' : 'var(--mv-color-primary)',
                  cursor: unreadCount === 0 ? 'default' : 'pointer',
                }}
              >
                {t('notifications.markAllRead')}
              </button>
            </div>
          </aside>
        </>,
        document.body
      )}
    </>
  );
};

export default NotificationBell;
