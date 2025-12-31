import { useEffect, useState } from 'react';
import { onError, CoachApiError } from '../lib/coachApi';

interface Toast {
  id: number;
  message: string;
  statusCode?: number;
}

export function GlobalErrorToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const unsubscribe = onError((error: CoachApiError) => {
      const id = Date.now();
      const toast: Toast = {
        id,
        message: error.message,
        statusCode: error.statusCode,
      };

      setToasts((prev) => [...prev, toast]);

      // Auto-dismiss after 5 seconds
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 5000);
    });

    return unsubscribe;
  }, []);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        maxWidth: '400px',
      }}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          style={{
            backgroundColor: '#ef4444',
            color: 'white',
            padding: '16px',
            borderRadius: '8px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'start',
            animation: 'slideIn 0.3s ease-out',
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, marginBottom: '4px' }}>
              {toast.statusCode ? `Error ${toast.statusCode}` : 'Error'}
            </div>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>
              {toast.message}
            </div>
          </div>
          <button
            onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              fontSize: '20px',
              padding: '0 0 0 8px',
              lineHeight: 1,
            }}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      ))}
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
