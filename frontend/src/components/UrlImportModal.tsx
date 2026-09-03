import React, { useState } from 'react';
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

  if (!isOpen) return null;

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-6 shadow-2xl relative text-white">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg">
            <Upload className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Bulk Import Contest URLs</h2>
            <p className="text-sm text-slate-400">Map student People IDs / Register Nos to LeetCode URLs (300+ batch support)</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Paste Data (CSV / TSV / Lines: <code className="text-indigo-300">PEOPLE_ID, LEETCODE_URL</code>)
            </label>
            <textarea
              rows={8}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={`P00125, https://leetcode.com/u/ajay_dev/\nP00126, https://leetcode.com/u/ajay_alt/\nP00127, https://leetcode.com/u/rahul_code/`}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm font-mono text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-300 text-sm space-y-2">
              <div className="flex items-center gap-2 font-bold text-emerald-400">
                <CheckCircle className="w-5 h-5" />
                <span>Import Complete</span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
                <div className="bg-slate-900/60 p-2 rounded">Total Processed: {result.total}</div>
                <div className="bg-slate-900/60 p-2 rounded text-emerald-400">Successfully Mapped: {result.success}</div>
                <div className="bg-slate-900/60 p-2 rounded text-slate-400">Skipped (Existing): {result.skipped}</div>
              </div>
              {result.errors && result.errors.length > 0 && (
                <div className="mt-2 pt-2 border-t border-emerald-500/20 text-xs text-red-300 max-h-24 overflow-y-auto">
                  <p className="font-semibold text-red-400 mb-1">Errors ({result.errors.length}):</p>
                  {result.errors.map((e: any, idx: number) => (
                    <div key={idx}>• {e.error}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleParseAndUpload}
              disabled={loading}
              className="px-5 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? 'Processing...' : 'Import & Link Accounts'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
