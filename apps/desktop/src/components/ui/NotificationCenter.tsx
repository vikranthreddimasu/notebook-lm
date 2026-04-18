import { useEffect, useState } from 'react';
import { useAppStore, type AppNotification } from '../../store/app-store';
import './notification-center.css';

function relativeTime(ts: number): string {
  const diffSec = Math.floor((Date.now() - ts) / 1000);
  if (diffSec < 45) return 'just now';
  if (diffSec < 90) return '1 min ago';
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.floor(hr / 24);
  return `${day} day${day === 1 ? '' : 's'} ago`;
}

function formatAbsoluteTime(ts: number): string {
  return new Date(ts).toLocaleString();
}

export function NotificationCenter() {
  const notifications = useAppStore((s) => s.notifications);
  const markAllRead = useAppStore((s) => s.markAllNotificationsRead);
  const clearAll = useAppStore((s) => s.clearNotifications);
  const dismiss = useAppStore((s) => s.dismissNotification);
  const [open, setOpen] = useState(false);

  const unreadCount = notifications.filter((n) => n.unread).length;

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  const handleOpen = () => {
    setOpen((v) => {
      const next = !v;
      if (next && unreadCount > 0) {
        // Open → mark everything read so the badge clears.
        setTimeout(markAllRead, 0);
      }
      return next;
    });
  };

  return (
    <>
      <button
        type="button"
        className={`notif-trigger ${unreadCount > 0 ? 'has-unread' : ''}`}
        onClick={handleOpen}
        aria-label={`${unreadCount} unread notifications`}
        title="Activity"
      >
        <span aria-hidden="true" className="notif-bell">
          {/* Minimal bell glyph — no emoji, no icon font. */}
          &#9788;
        </span>
        {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
      </button>

      {open && (
        <>
          <div className="notif-backdrop" onClick={() => setOpen(false)} />
          <div className="notif-panel" role="dialog" aria-label="Notifications">
            <div className="notif-panel-header">
              <h3>Activity</h3>
              {notifications.length > 0 && (
                <button type="button" className="notif-clear" onClick={clearAll}>
                  Clear all
                </button>
              )}
            </div>
            {notifications.length === 0 ? (
              <div className="notif-empty">
                <p className="notif-empty-headline">Nothing to report.</p>
                <p className="notif-empty-hint">Errors, uploads, and warnings will collect here.</p>
              </div>
            ) : (
              <ul className="notif-list">
                {notifications.map((n) => (
                  <NotificationRow key={n.id} notification={n} onDismiss={() => dismiss(n.id)} />
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </>
  );
}

function NotificationRow({
  notification,
  onDismiss,
}: {
  notification: AppNotification;
  onDismiss: () => void;
}) {
  return (
    <li
      className={`notif-row notif-row-${notification.level} ${notification.unread ? 'unread' : ''}`}
    >
      <div className="notif-row-main">
        <p className="notif-row-title">{notification.title}</p>
        {notification.body && <p className="notif-row-body">{notification.body}</p>}
        <p className="notif-row-time" title={formatAbsoluteTime(notification.timestamp)}>
          {relativeTime(notification.timestamp)}
        </p>
      </div>
      <button
        type="button"
        className="notif-row-dismiss"
        onClick={onDismiss}
        aria-label="Dismiss notification"
      >
        ×
      </button>
    </li>
  );
}
