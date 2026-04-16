import { useEffect, useState } from 'react';
import './toast.css';

interface ToastItem {
  id: string;
  message: string;
  type: 'info' | 'success' | 'error';
}

const MAX_VISIBLE = 3;

let toastListeners: ((toast: ToastItem) => void)[] = [];

export function showToast(message: string, type: ToastItem['type'] = 'info') {
  const toast: ToastItem = { id: Date.now().toString(), message, type };
  toastListeners.forEach((fn) => fn(toast));
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
        // Stack limit: keep only the newest MAX_VISIBLE
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
          role="status"
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
