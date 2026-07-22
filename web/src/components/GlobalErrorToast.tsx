import { useEffect, useState } from 'react';
import { onError, CoachApiError } from '../lib/coachApi';
import { Toast, ToastRegion } from './ui/toast';

interface ErrorToast {
  id: number;
  message: string;
  statusCode?: number;
}

export function GlobalErrorToast() {
  const [toasts, setToasts] = useState<ErrorToast[]>([]);

  useEffect(() => {
    const unsubscribe = onError((error: CoachApiError) => {
      const id = Date.now();
      setToasts((current) => [...current, { id, message: error.message, statusCode: error.statusCode }]);
      setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 5000);
    });
    return unsubscribe;
  }, []);

  if (toasts.length === 0) return null;

  return (
    <ToastRegion>
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          intent="error"
          title={toast.statusCode ? `Error ${toast.statusCode}` : 'Error'}
          onDismiss={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}
        >
          {toast.message}
        </Toast>
      ))}
    </ToastRegion>
  );
}
