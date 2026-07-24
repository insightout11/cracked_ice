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
      className='fixed top-[0] left-[0] right-[0] h-[3px] z-[9999] bg-surface-0'
    >
      <div
        style={{
          width: `${progress}%`,
          transition: progress === 100 ? 'width 200ms ease-out' : 'width 100ms ease-in-out'
        }}
        className='h-[100%] bg-accent [box-shadow:0_0_10px_var(--accent)]' />
    </div>
  );
}
