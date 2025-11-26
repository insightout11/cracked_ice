import { useEffect, useState } from 'react';
import { onLoadingChange } from '../lib/coachApi';

export function GlobalLoadingBar() {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const unsubscribe = onLoadingChange((loading) => {
      setIsLoading(loading);
      if (loading) {
        setProgress(0);
        // Simulate progress animation
        const interval = setInterval(() => {
          setProgress((prev) => {
            if (prev >= 90) {
              clearInterval(interval);
              return 90;
            }
            return prev + 10;
          });
        }, 100);
        return () => clearInterval(interval);
      } else {
        // Complete the progress bar
        setProgress(100);
        setTimeout(() => {
          setProgress(0);
        }, 300);
      }
    });

    return unsubscribe;
  }, []);

  if (!isLoading && progress === 0) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '3px',
        zIndex: 9999,
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${progress}%`,
          backgroundColor: '#3b82f6',
          transition: progress === 100 ? 'width 200ms ease-out' : 'width 100ms ease-in-out',
          boxShadow: '0 0 10px rgba(59, 130, 246, 0.7)',
        }}
      />
    </div>
  );
}
