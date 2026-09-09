import React from 'react';
import { DownloadState } from '../services/download/downloadTypes';

interface ExportStatusProps {
  state: DownloadState | null;
  onRetry?: () => void;
  onClose?: () => void;
}

export const ExportStatus: React.FC<ExportStatusProps> = ({ state, onRetry, onClose }) => {
  if (!state || state.status === 'IDLE') return null;

  const isFailed = state.status === 'FAILED';
  const isGenerating = ['GENERATING', 'PROCESSING', 'QUEUED'].includes(state.status);
  const isCompleted = state.status === 'COMPLETED' || state.status === 'DOWNLOADED';

  // We can show a small toast-like overlay or modal
  return (
    <div className="fixed bottom-4 right-4 z-50 p-4 bg-slate-900 rounded-lg shadow-xl text-white max-w-sm w-full border border-slate-700 font-sans">
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-semibold text-lg">
          {isFailed ? 'REPORT GENERATION FAILED' : isGenerating ? 'Generating Report...' : 'Download Completed'}
        </h3>
        {onClose && (
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors" aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </div>

      {isGenerating && (
        <div className="mt-4">
          <div className="flex space-x-2 items-center text-sm text-slate-300">
            <svg className="animate-spin h-4 w-4 text-emerald-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Please wait while we prepare your file...</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-1.5 mt-3 overflow-hidden">
            <div className="bg-emerald-500 h-1.5 rounded-full animate-pulse w-3/4"></div>
          </div>
        </div>
      )}

      {isFailed && (
        <div className="mt-3">
          <p className="text-sm text-slate-300">
            We couldn't generate the report right now. Please try again.
          </p>
          {state.downloadId && (
            <p className="text-xs font-mono text-slate-500 mt-2">
              Reference ID: {state.downloadId.toUpperCase()}
            </p>
          )}
          
          <div className="flex space-x-3 mt-4">
            {onRetry && (
              <button 
                onClick={onRetry}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Retry
              </button>
            )}
            {onClose && (
              <button 
                onClick={onClose}
                className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Close
              </button>
            )}
          </div>
        </div>
      )}
      
      {isCompleted && (
        <div className="mt-3">
          <p className="text-sm text-slate-300">Your report has been successfully downloaded.</p>
        </div>
      )}
    </div>
  );
};
