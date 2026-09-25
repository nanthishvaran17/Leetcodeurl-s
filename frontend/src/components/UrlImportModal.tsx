import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, CheckCircle, AlertTriangle, FileText } from 'lucide-react';

interface UrlImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const UrlImportModal: React.FC<UrlImportModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [rawText, setRawText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  const handleParseAndUpload = async () => {
    setError(null);
    setResult(null);

    if (!rawText.trim()) {
      setError('Please paste CSV / text data or enter student URLs');
      return;
    }

    // Parse lines: expected format "P00125, https://leetcode.com/u/user1/" or tab-separated / space-separated
    const lines = rawText.split('\n');
    const parsedData: { people_id: string; leetcode_url: string }[] = [];

    for (let line of lines) {
      line = line.trim();
      if (!line) continue;

      let parts = line.split(/[\t,;]+/);
      if (parts.length >= 2) {
        parsedData.push({
          people_id: parts[0].trim(),
          leetcode_url: parts[1].trim(),
        });
      } else {
        // Try space split if URL is present
        const spaceParts = line.split(/\s+/);
        if (spaceParts.length >= 2) {
          parsedData.push({
            people_id: spaceParts[0].trim(),
            leetcode_url: spaceParts[1].trim(),
          });
        }
      }
    }

    if (parsedData.length === 0) {
      setError('Could not parse any valid People ID & URL pairs from input. Format: PEOPLE_ID, LEETCODE_URL');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/admin/url-import/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: parsedData }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Failed to import URLs');
      }

      const resData = await response.json();
      setResult(resData);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message || 'An error occurred during upload');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div 
      className="fixed inset-0 z-[100000] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 sm:p-6 pt-20 sm:pt-24 pb-6 animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white border border-slate-200 max-w-2xl w-full max-h-[78vh] flex flex-col rounded-3xl shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 p-5 shrink-0 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-100 text-purple-700 border border-purple-200 rounded-xl shrink-0">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">Bulk Import Contest URLs</h2>
              <p className="text-xs text-slate-500 font-medium">Map student People IDs / Register Nos to LeetCode URLs (300+ batch support)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4 custom-scrollbar min-h-0">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Paste Data (CSV / TSV / Lines: <code className="text-purple-700 font-mono bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">PEOPLE_ID, LEETCODE_URL</code>)
            </label>
            <textarea
              rows={8}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={`P00125, https://leetcode.com/u/ajay_dev/\nP00126, https://leetcode.com/u/ajay_alt/\nP00127, https://leetcode.com/u/rahul_code/`}
              className="w-full bg-slate-50/70 border border-slate-200 rounded-2xl p-4 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition leading-relaxed"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-2xl text-emerald-900 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-emerald-800">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                <span>Import Complete</span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
                <div className="bg-white/80 border border-emerald-200 p-2 rounded-xl text-slate-700 font-medium">Total Processed: <strong className="text-slate-900 font-bold">{result.total}</strong></div>
                <div className="bg-white/80 border border-emerald-200 p-2 rounded-xl text-emerald-800 font-medium">Successfully Mapped: <strong className="text-emerald-700 font-bold">{result.success}</strong></div>
                <div className="bg-white/80 border border-emerald-200 p-2 rounded-xl text-slate-600 font-medium">Skipped (Existing): <strong className="text-slate-700 font-bold">{result.skipped}</strong></div>
              </div>
              {result.errors && result.errors.length > 0 && (
                <div className="mt-2 pt-2 border-t border-emerald-200 text-xs text-rose-800 max-h-24 overflow-y-auto font-mono">
                  <p className="font-bold text-rose-700 mb-1">Errors ({result.errors.length}):</p>
                  {result.errors.map((e: any, idx: number) => (
                    <div key={idx}>• {e.error}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pinned Footer */}
        <div className="flex justify-end gap-2.5 p-4 border-t border-slate-200 bg-slate-50/80 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleParseAndUpload}
            disabled={loading}
            className="px-5 py-2 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-xs transition disabled:opacity-50 flex items-center gap-2 cursor-pointer"
          >
            {loading ? 'Processing...' : 'Import & Link Accounts'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
