import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

interface MobileBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  height?: 'half' | 'full';
  // New snap point support
  snapPoints?: string[]; // e.g., ['50%', '90%']
  initialSnap?: number; // Index of initial snap point
}

/**
 * Mobile Bottom Sheet Component
 *
 * A modal that slides up from the bottom of the screen.
 * Features:
 * - Swipe down to close (visual feedback)
 * - Backdrop dimming
 * - Spring animation
 * - Snap points support
 * - Half-height or full-height variants (legacy)
 */
export function MobileBottomSheet({
  isOpen,
  onClose,
  children,
  title,
  height = 'half',
  snapPoints,
  initialSnap = 0,
}: MobileBottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const startY = useRef<number>(0);
  const currentY = useRef<number>(0);
  const isDragging = useRef<boolean>(false);
  const [currentSnapIndex, setCurrentSnapIndex] = useState(initialSnap);

  // Reset snap index when sheet opens
  useEffect(() => {
    if (isOpen) {
      setCurrentSnapIndex(initialSnap);
    }
  }, [isOpen, initialSnap]);

  // Lock body scroll when sheet is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Touch handlers for swipe-to-dismiss
  const handleTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    currentY.current = startY.current;
    isDragging.current = true;

    // Remove transition during drag for immediate feedback
    if (sheetRef.current) {
      sheetRef.current.style.transition = 'none';
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return;

    currentY.current = e.touches[0].clientY;
    const deltaY = currentY.current - startY.current;

    // Only allow downward swipes
    if (deltaY > 0 && sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${deltaY}px)`;
    }
  };

  const handleTouchEnd = () => {
    isDragging.current = false;
    const deltaY = currentY.current - startY.current;

    if (sheetRef.current) {
      // Restore transition
      sheetRef.current.style.transition = 'transform 0.3s ease-out';

      // If swiped down more than 100px, close the sheet
      if (deltaY > 100) {
        onClose();
      } else {
        // Otherwise, snap back to current position
        sheetRef.current.style.transform = 'translateY(0)';
      }
    }
  };

  if (!isOpen) return null;

  // Calculate height based on snap points or legacy height prop
  let sheetHeight: string;
  if (snapPoints && snapPoints.length > 0) {
    sheetHeight = snapPoints[currentSnapIndex] || snapPoints[0];
  } else {
    sheetHeight = height === 'full' ? '95vh' : '70vh';
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-[100] transition-opacity"
        onClick={onClose}
        style={{ animation: 'fadeIn 0.3s ease-out' }}
      />

      {/* Bottom Sheet */}
      <div
        ref={sheetRef}
        className="fixed bottom-0 left-0 right-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-t-3xl shadow-2xl z-[101] flex flex-col"
        style={{
          height: sheetHeight,
          maxHeight: '95vh',
          transform: 'translateY(0)',
          transition: 'transform 0.3s ease-out, height 0.3s ease-out',
        }}
      >
        {/* Drag Handle - capture swipe only on handle area */}
        <div
          className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-12 h-1.5 bg-slate-600 rounded-full" />
        </div>

        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-6 py-3 border-b border-slate-700 flex-shrink-0">
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </>
  );
}
