import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw, AlertCircle } from 'lucide-react';

interface FullScreenLoadingOverlayProps {
  message?: string;
  error?: string;
  onRetry?: () => void;
  onCancel?: () => void;
}

export const FullScreenLoadingOverlay: React.FC<FullScreenLoadingOverlayProps> = ({ 
  message = "Loading...", 
  error,
  onRetry,
  onCancel
}) => {

  useEffect(() => {
    // Scroll lock
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const overlayContent = (
    <div 
      className="fixed inset-0 z-[99999] flex flex-col items-center justify-center pointer-events-auto"
      style={{
        background: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }}
      role="dialog"
      aria-modal="true"
      aria-label={error ? "Error Overlay" : "Loading Overlay"}
    >
      <div className="bg-white dark:bg-navy-900 p-8 rounded-3xl flex flex-col items-center space-y-4 shadow-2xl border border-gray-200 dark:border-gray-800 w-[min(92vw,390px)] animate-modal-content pointer-events-auto">
        {error ? (
          <>
            <AlertCircle className="w-8 h-8 text-rose-500" />
            <p className="font-bold text-gray-700 dark:text-gray-300 text-center">{error}</p>
            <div className="flex space-x-3 mt-4 w-full">
              {onCancel && (
                <button 
                  onClick={onCancel}
                  className="flex-1 py-2 rounded-xl text-xs font-bold bg-gray-100 dark:bg-navy-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-navy-700 transition-colors"
                >
                  Cancel
                </button>
              )}
              {onRetry && (
                <button 
                  onClick={onRetry}
                  className="flex-1 py-2 rounded-xl text-xs font-bold bg-brand-500 hover:bg-brand-600 text-white shadow-md transition-colors"
                >
                  Retry
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <RefreshCw className="w-8 h-8 animate-spin text-brand-500" />
            <p className="font-bold text-gray-700 dark:text-gray-300 text-center">{message}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              Please wait while the latest verified data is prepared.
            </p>
          </>
        )}
      </div>
    </div>
  );

  // Safely mount to body avoiding hydration mismatch issues if SSR
  if (typeof document === 'undefined') return null;

  return createPortal(overlayContent, document.body);
};
