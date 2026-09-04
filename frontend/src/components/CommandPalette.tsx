import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, LayoutDashboard, Users, Trophy, BarChart2, Shield, Download, RefreshCcw, X, Command } from 'lucide-react';
import { useKeyboardContext } from '../context/KeyboardContext';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, onNavigate }) => {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { pushContext, popContext, registerEscHandler } = useKeyboardContext();

  const commands = [
    { type: 'navigation', label: 'Dashboard', icon: LayoutDashboard, action: () => onNavigate('dashboard') },
    { type: 'navigation', label: 'Student Directory', icon: Users, action: () => onNavigate('students') },
    { type: 'navigation', label: 'Leaderboard', icon: Trophy, action: () => onNavigate('leaderboard') },
    { type: 'navigation', label: 'Analytics', icon: BarChart2, action: () => onNavigate('analytics') },
    { type: 'navigation', label: 'Staff Management', icon: Shield, action: () => onNavigate('admin') },
    { type: 'action', label: 'Search Student', icon: Search, action: () => { onNavigate('students'); } },
    { type: 'action', label: 'Import Students', icon: Download, action: () => { onNavigate('students'); } },
    { type: 'action', label: 'Refresh LeetCode Stats', icon: RefreshCcw, action: () => { onNavigate('students'); } },
  ];

  const filteredCommands = commands.filter(c => c.label.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    if (isOpen) {
      pushContext('COMMAND_PALETTE');
      const unregister = registerEscHandler(() => {
        onClose();
      });
      setTimeout(() => inputRef.current?.focus(), 100);
      setSearch('');
      setSelectedIndex(0);
      
      return () => {
        unregister();
        popContext('COMMAND_PALETTE');
      };
    }
  }, [isOpen, pushContext, popContext, registerEscHandler, onClose]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev < filteredCommands.length - 1 ? prev + 1 : prev));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, onClose]);

  useEffect(() => {
    // Scroll active item into view
    if (listRef.current && isOpen) {
      const activeItem = listRef.current.children[selectedIndex] as HTMLElement;
      if (activeItem) {
        activeItem.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh]">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm" 
      />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -20 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-xl bg-white dark:bg-navy-950 rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-navy-700"
      >
        <div className="flex items-center px-4 py-4 border-b border-slate-100 dark:border-navy-800">
          <Search className="w-5 h-5 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            className="flex-1 ml-3 bg-transparent border-none outline-none text-slate-900 dark:text-white placeholder-gray-400 text-lg"
            placeholder="Search commands, students, pages..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 dark:bg-navy-800 rounded text-xs font-semibold text-slate-500">
            <Command className="w-3 h-3" />
            <span>K</span>
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2 custom-scrollbar" ref={listRef}>
          {filteredCommands.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              No results found for "{search}"
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => (
              <div
                key={idx}
                className={`flex items-center px-4 py-3 rounded-xl cursor-pointer transition-colors ${
                  idx === selectedIndex 
                    ? 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400' 
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800/50'
                }`}
                onClick={() => {
                  cmd.action();
                  onClose();
                }}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <cmd.icon className={`w-5 h-5 mr-3 ${idx === selectedIndex ? 'text-brand-500' : 'text-slate-400'}`} />
                <div className="flex flex-col">
                  <span className="font-semibold text-sm">{cmd.label}</span>
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{cmd.type}</span>
                </div>
                {idx === selectedIndex && (
                  <span className="ml-auto text-xs text-brand-500 font-semibold">Enter ↵</span>
                )}
              </div>
            ))
          )}
        </div>
      </motion.div>
    </div>,
    document.body
  );
};
