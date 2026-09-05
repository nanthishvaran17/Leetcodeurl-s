import React, { useState, useEffect } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { getCachedData, setCachedData, getRequestKey } from '../../services/api';
import axios from 'axios';

interface Recipient {
  id: string;
  name: string;
  role: string;
  department: string;
  type: 'STAFF' | 'STUDENT';
}

interface Props {
  onClose: () => void;
  onSelect: (recipientId: string) => void;
}

export const RecipientSelector: React.FC<Props> = ({ onClose, onSelect }) => {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRecipients = async () => {
      try {
        const url = '/messaging/available-recipients';
        const key = getRequestKey(url);
        const cached = getCachedData(key, url);
        if (cached) {
          setRecipients(cached.recipients);
          setIsLoading(false);
          return;
        }

        const token = localStorage.getItem('token');
        const envUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;
        const cleanUrl = envUrl ? envUrl.replace(/\/+$/, '') : '';
        const API_BASE = cleanUrl.endsWith('/api') ? cleanUrl : `${cleanUrl}/api`;
        
        const res = await axios.get(`${API_BASE}${url}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (res.data?.success) {
          setRecipients(res.data.recipients);
          setCachedData(key, res.data);
        }
      } catch (err) {
        console.error("Failed to load recipients", err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchRecipients();
  }, []);

  const filtered = recipients.filter(r => 
    (r.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.role || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.department || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white dark:bg-[#151b23] rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[80vh]">
        
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800/60">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">New Message</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-slate-200 dark:border-slate-800/60">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              autoFocus
              placeholder="Search by name, role, or department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-none rounded-lg text-sm text-slate-900 dark:text-slate-100 placeholder-gray-500 focus:ring-2 focus:ring-brand-500"
            />
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
                    onClick={() => onSelect(r.id)}
                    className="w-full text-left p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex items-center gap-3"
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
    </div>
  );
};
