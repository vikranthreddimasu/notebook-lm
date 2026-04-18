import { useEffect, useState } from 'react';
import { useAppStore, type NotificationLevel } from '../../store/app-store';
import './toast.css';

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  detail?: string;
}

type ToastType = 'info' | 'success' | 'error' | 'warning';

const MAX_VISIBLE = 3;

let toastListeners: ((toast: ToastItem) => void)[] = [];

interface ShowToastOptions {
  /** Longer-form explanation that lands in the notification center only. */
  detail?: string;
  /** Skip writing this to the persistent log. Default: log everything that
   *  isn't 'info'. */
  ephemeral?: boolean;
}

export function showToast(
  message: string,
  type: ToastType = 'info',
  options: ShowToastOptions = {},
) {
  const toast: ToastItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    message,
    type,
    detail: options.detail,
  };
  toastListeners.forEach((fn) => fn(toast));

  // Mirror into the persistent notification log unless opted out. 'info'
  // toasts ("Processing foo.pdf…") aren't worth keeping around; everything
  // else lands in the bell so the user can recover a missed message.
  const shouldLog = !options.ephemeral && type !== 'info';
  if (shouldLog) {
    useAppStore.getState().addNotification({
      level: type as NotificationLevel,
      title: message,
      body: options.detail,
    });
  }
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  useEffect(() => {
    const handler = (toast: ToastItem) => {
      setToasts((prev) => {
        const next = [...prev, toast];
        return next.slice(-MAX_VISIBLE);
      });
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, 4000);
    };
    toastListeners.push(handler);
    return () => {
      toastListeners = toastListeners.filter((fn) => fn !== handler);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast toast-${toast.type}`}
          onClick={() => dismiss(toast.id)}
          role={toast.type === 'error' ? 'alert' : 'status'}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
