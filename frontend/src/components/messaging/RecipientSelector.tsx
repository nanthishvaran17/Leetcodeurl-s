import React, { useState, useEffect } from 'react';
import { Search, X, Loader2, ArrowLeft } from 'lucide-react';
import { createPortal } from 'react-dom';
import { getApiUrl, getAuthHeaders, getCachedData, setCachedData, getRequestKey } from '../../services/api';
import axios from 'axios';

export interface Recipient {
  id: string;
  name: string;
  role: string;
  department: string;
  type: 'STAFF' | 'STUDENT';
}

interface Props {
  onClose: () => void;
  onSelect: (recipient: Recipient) => void;
}

export const RecipientSelector: React.FC<Props> = ({ onClose, onSelect }) => {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    let isMounted = true;
    const fetchRecipients = async () => {
      try {
        const url = '/messaging/available-recipients';
        const key = getRequestKey(url);
        const cached = getCachedData(key, url);
        // Instant visual display from cache if present
        if (cached && Array.isArray(cached.recipients) && cached.recipients.length > 0) {
          if (isMounted) {
            setRecipients(cached.recipients);
            setIsLoading(false);
          }
        }

        // Always fetch authoritative fresh data
        const headers = await getAuthHeaders();
        const res = await axios.get(getApiUrl(url), { headers });

        if (res.data?.success && Array.isArray(res.data.recipients)) {
          if (isMounted) {
            setRecipients(res.data.recipients);
            setCachedData(key, res.data);
          }
        }
      } catch (err) {
        console.error("Failed to load recipients", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchRecipients();
    return () => { isMounted = false; };
  }, []);

  const filtered = recipients.filter(r =>
    (r.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.role || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.department || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return createPortal(
    <div
      className="fixed inset-0 z-[100050] flex items-center justify-center p-0 sm:p-6 bg-black/60 sm:backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full h-dvh sm:h-auto max-w-none sm:max-w-lg bg-white dark:bg-[#151b23] rounded-none sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-none sm:max-h-[85vh] border-0 sm:border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">

        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800/60 bg-white dark:bg-[#151b23] shrink-0 pt-[calc(env(safe-area-inset-top,0px)+12px)] sm:pt-4">
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="p-1.5 -ml-1 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer shrink-0"
              title="Close"
              aria-label="Back"
            >
              <ArrowLeft className="w-6 h-6 sm:hidden" />
              <X className="w-5 h-5 hidden sm:block" />
            </button>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">New Message</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors hidden sm:block"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-slate-200 dark:border-slate-800/60">
          <div className="relative flex items-center">
            <input
              type="text"
              autoFocus
              autoComplete="off"
              spellCheck={false}
              placeholder="Search by name, role, or department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-none rounded-lg text-sm text-slate-900 dark:text-slate-100 placeholder-gray-500 focus:ring-2 focus:ring-brand-500 text-left"
            />
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 z-10 text-slate-400 dark:text-slate-500">
              <Search className="w-4 h-4 stroke-[2.5]" />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-slate-500 dark:text-slate-400">
              <p className="text-sm">No authorized contacts found.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800/40">
              {filtered.map(r => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(r)}
                    className="w-full text-left p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex items-center gap-3 cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-100 to-indigo-100 dark:from-brand-900/40 dark:to-indigo-900/40 flex items-center justify-center shrink-0">
                      <span className="text-brand-700 dark:text-brand-400 font-semibold text-lg">
                        {r.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{r.name}</h3>
                        <span className="text-[10px] uppercase tracking-wider font-semibold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/30 px-1.5 py-0.5 rounded">
                          {r.role}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{r.department}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
