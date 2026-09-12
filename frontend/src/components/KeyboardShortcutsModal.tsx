import React, { useState, useEffect } from 'react';
import { GlobalModalBackdrop } from './GlobalModalBackdrop';
import { X, Keyboard, Navigation, Command, Search, CornerDownLeft, Sparkles, Zap } from 'lucide-react';
import { useKeyboardContext } from '../context/KeyboardContext';
import { useAuth } from '../context/AuthContext';
import { GLOBAL_SHORTCUT_REGISTRY, isShortcutAllowedForRole, ShortcutCategory } from '../services/shortcutRegistry';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isTabAllowed?: (tab: string) => boolean;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
  isTabAllowed,
}) => {
  const [search, setSearch] = useState('');
  const { pushContext, popContext, registerEscHandler } = useKeyboardContext();
  const { user } = useAuth();

  useEffect(() => {
    if (isOpen) {
      pushContext('MODAL');
      const unregister = registerEscHandler(() => {
        onClose();
      });
      setSearch('');
      return () => {
        unregister();
        popContext('MODAL');
      };
    }
  }, [isOpen, pushContext, popContext, registerEscHandler, onClose]);

  if (!isOpen) return null;

  const roleClean = user?.role || 'student';

  // Filter shortcuts by user role & optional search filter
  const allowedShortcuts = GLOBAL_SHORTCUT_REGISTRY.filter(sc =>
    isShortcutAllowedForRole(sc, roleClean, isTabAllowed)
  );

  const filteredShortcuts = allowedShortcuts.filter(sc => {
    if (!search.trim()) return true;
    const sLower = search.trim().toLowerCase();
    const descMatch = sc.description.toLowerCase().includes(sLower);
    const keyMatch = sc.keys.join(' ').toLowerCase().includes(sLower);
    const catMatch = sc.category.toLowerCase().includes(sLower);
    return descMatch || keyMatch || catMatch;
  });

  const categories: ShortcutCategory[] = [
    'GLOBAL CONTROLS',
    'QUICK NAVIGATION',
    'QUICK ACTIONS',
    'AI ASSISTANT'
  ];

  const categoryIcons: Record<ShortcutCategory, any> = {
    'GLOBAL CONTROLS': Command,
    'QUICK NAVIGATION': Navigation,
    'QUICK ACTIONS': Zap,
    'AI ASSISTANT': Sparkles
  };

  return (
    <GlobalModalBackdrop isOpen={isOpen} onClose={onClose}>
      <div className="relative w-full max-w-2xl bg-slate-900/95 dark:bg-navy-900/95 border border-purple-500/30 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl m-4 animate-in fade-in zoom-in duration-200 text-slate-100 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 dark:border-navy-800 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <Keyboard className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-wide">Keyboard Shortcuts Guide</h2>
              <p className="text-xs text-slate-400">Role-aware keyboard navigation & operation system</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-xl transition-all cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Search Bar */}
        <div className="px-5 pt-3 pb-2 border-b border-slate-800/60 bg-slate-950/20">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-3" />
            <input
              type="text"
              placeholder="Search shortcuts (e.g., Ctrl+K, Nav, AI)..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-800/60 border border-slate-700/60 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-purple-500/50"
            />
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
          {categories.map(cat => {
            const catShortcuts = filteredShortcuts.filter(sc => sc.category === cat);
            if (catShortcuts.length === 0) return null;
            const Icon = categoryIcons[cat];

            return (
              <div key={cat} className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-400">
                  <Icon className="w-3.5 h-3.5" />
                  <span>{cat}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {catShortcuts.map(sc => (
                    <div
                      key={sc.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-800/40 border border-slate-800/80 hover:border-purple-500/30 transition-all group"
                    >
                      <span className="text-xs text-slate-300 font-medium group-hover:text-white transition-colors mr-2">
                        {sc.description}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {sc.keys.map((k, kIdx) => (
                          <kbd
                            key={kIdx}
                            className="px-2 py-1 text-[11px] font-mono font-bold text-purple-300 bg-slate-800 border border-purple-500/30 rounded-md shadow-inner"
                          >
                            {k}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {filteredShortcuts.length === 0 && (
            <div className="p-8 text-center text-slate-400 text-xs font-medium">
              No shortcuts found matching "{search}"
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 bg-slate-950/60 border-t border-slate-800/80 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <kbd className="px-2 py-0.5 text-[10px] font-mono text-purple-300 bg-slate-800 border border-purple-500/30 rounded">Esc</kbd>
            <span>Closes this guide or any active overlay</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <CornerDownLeft className="w-3.5 h-3.5" />
            Close
          </button>
        </div>
      </div>
    </GlobalModalBackdrop>
  );
};
