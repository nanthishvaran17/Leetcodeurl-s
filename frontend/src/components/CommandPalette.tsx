import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  LayoutDashboard,
  Users,
  Trophy,
  BarChart2,
  Shield,
  Download,
  RefreshCcw,
  X,
  Command,
  User,
  Bot,
  FileText,
  Activity,
  Moon,
  Sun,
  Sidebar,
  HelpCircle,
  ChevronRight,
  Loader2,
  GraduationCap,
  Briefcase
} from 'lucide-react';
import { useKeyboardContext } from '../context/KeyboardContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useNotification } from '../context/NotificationContext';
import api from '../services/api';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: string) => void;
  onSelectStudent?: (student: any) => void;
  onOpenAiWithQuery?: (query: string) => void;
  onOpenShortcutsModal?: () => void;
}

interface CommandItem {
  id: string;
  type: 'navigation' | 'action' | 'student' | 'ai';
  label: string;
  sublabel?: string;
  icon: any;
  category: 'Commands' | 'Students' | 'Actions' | 'AI';
  action: () => void;
  badge?: string;
  exactMatch?: boolean;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onSelectStudent,
  onOpenAiWithQuery,
  onOpenShortcutsModal,
}) => {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [studentResults, setStudentResults] = useState<any[]>([]);
  const [isSearchingStudents, setIsSearchingStudents] = useState(false);
  const [activeCategory, setActiveCategory] = useState<'All' | 'AI' | 'Commands' | 'Students' | 'Actions'>('All');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchDebounceRef = useRef<any>(null);

  const { pushContext, popContext, registerEscHandler } = useKeyboardContext();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { notify } = useNotification();

  const roleClean = (user?.role || '').trim().toLowerCase();
  const isAdmin = ['admin', 'administrator', 'super_admin', 'super admin'].includes(roleClean);
  const isHod = ['hod', 'department hod', 'department_hod', 'placement coordinator'].includes(roleClean) || isAdmin;
  const isFacultyOrStaff = ['faculty', 'staff', 'professor', 'faculty mentor', 'staff mentor'].includes(roleClean) || isHod;

  // Debounced Student API Search
  const fetchStudentSearch = useCallback(async (query: string) => {
    const qClean = query.trim();
    if (!qClean || qClean.length < 2) {
      setStudentResults([]);
      setIsSearchingStudents(false);
      return;
    }

    setIsSearchingStudents(true);
    try {
      const res = await api.get('/students', {
        params: { search: qClean, page: 1, page_size: 8 }
      });
      const data = res.data;
      const items = Array.isArray(data) ? data : (data?.items || []);
      setStudentResults(items);
    } catch (err) {
      console.warn('Command Palette Student Search error:', err);
      setStudentResults([]);
    } finally {
      setIsSearchingStudents(false);
    }
  }, []);

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (search.trim().length >= 2) {
      searchDebounceRef.current = setTimeout(() => {
        fetchStudentSearch(search);
      }, 250);
    } else {
      setStudentResults([]);
      setIsSearchingStudents(false);
    }
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [search, fetchStudentSearch]);

  const prevIsOpenRef = useRef(false);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Reset state and focus input ONLY on the rising edge of isOpen (when palette initially opens)
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      setSearch('');
      setSelectedIndex(0);
      setStudentResults([]);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen]);

  // Context & ESC handling (independent from search state to prevent auto-clearing input while typing)
  useEffect(() => {
    if (!isOpen) return;

    pushContext('COMMAND_PALETTE');
    const unregister = registerEscHandler(() => {
      onCloseRef.current();
    });
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = prevOverflow || '';
      unregister();
      popContext('COMMAND_PALETTE');
    };
  }, [isOpen, pushContext, popContext, registerEscHandler]);

  // Build Command Items List
  const buildAllCommands = (): CommandItem[] => {
    const items: CommandItem[] = [];

    // --- 1. Natural Language AI Query Prompt & Copilot Actions ---
    const trimmed = search.trim();
    const qLower = trimmed.toLowerCase();
    if (trimmed.length > 0) {
      items.push({
        id: 'ai_query_action',
        type: 'ai',
        label: `Ask Institutional AI Copilot: "${trimmed}"`,
        sublabel: 'Query verified student database, contest stats, run audits or draft emails',
        icon: Bot,
        category: 'AI',
        badge: 'AI Copilot',
        action: () => {
          if (onOpenAiWithQuery) {
            onOpenAiWithQuery(trimmed);
          } else {
            window.dispatchEvent(new CustomEvent('open_ai_assistant', { detail: { query: trimmed } }));
          }
        }
      });
    } else {
      items.push({
        id: 'ai_open_copilot',
        type: 'ai',
        label: 'Open Institutional AI Copilot',
        sublabel: 'Ask questions about students, contests, analytics or run audits (Alt + H)',
        icon: Bot,
        category: 'AI',
        badge: 'AI Copilot',
        action: () => {
          if (onOpenAiWithQuery) {
            onOpenAiWithQuery('');
          } else {
            window.dispatchEvent(new CustomEvent('open_ai_widget'));
          }
        }
      });
    }

    // --- 2. Real Backend Student Search Results (Prioritized for exact Reg No / Username match) ---
    studentResults.forEach((st) => {
      const regNo = st.reg_no || st.registerNumber || '';
      const stName = st.name || st.student_name || 'Student';
      const deptCode = st.department?.code || st.department || 'CSE';
      const username = st.username || st.leetcodeUsername || '';

      const isExactRegNo = qLower.replace(/[^a-z0-9]/g, '') === regNo.toLowerCase().replace(/[^a-z0-9]/g, '');

      items.push({
        id: `st_${st.id}`,
        type: 'student',
        label: `${stName} (${regNo})`,
        sublabel: `Department: ${deptCode} • LeetCode: @${username || 'N/A'}`,
        icon: GraduationCap,
        category: 'Students',
        badge: isExactRegNo ? 'Exact Profile Match' : 'Student Record',
        exactMatch: isExactRegNo,
        action: () => {
          if (onSelectStudent) {
            onSelectStudent(st);
          } else {
            onNavigate('students');
          }
        }
      });
    });

    // --- 3. Navigation Commands (Role-Aware) ---
    const navCommands: CommandItem[] = [
      {
        id: 'nav_dash',
        type: 'navigation',
        label: 'Dashboard',
        sublabel: 'Main Performance & Executive Overview',
        icon: LayoutDashboard,
        category: 'Commands',
        action: () => onNavigate('dashboard')
      },

      {
        id: 'nav_reports',
        type: 'navigation',
        label: 'Universal Reports & Analytics',
        sublabel: 'Export Excel (.xlsx), PDF, Word (.docx), and CSV reports',
        icon: BarChart2,
        category: 'Commands',
        action: () => onNavigate('reports')
      },
      {
        id: 'nav_faculty',
        type: 'navigation',
        label: 'Faculty Portal',
        sublabel: 'Manage assigned student rosters & tracking',
        icon: Shield,
        category: 'Commands',
        action: () => onNavigate('faculty-action-center')
      },
      {
        id: 'nav_hod',
        type: 'navigation',
        label: 'HOD Dashboard',
        sublabel: 'Department executive overview & staff allocation',
        icon: Shield,
        category: 'Commands',
        action: () => onNavigate('hod-command-center')
      },
      {
        id: 'nav_contests',
        type: 'navigation',
        label: 'Weekly Contest Intelligence',
        sublabel: 'Official contest rankings & problem breakdowns',
        icon: Trophy,
        category: 'Commands',
        action: () => onNavigate('weekly-contest')
      },
      {
        id: 'nav_placement_intelligence',
        type: 'navigation',
        label: 'Placement Portal',
        sublabel: 'Filter candidates by academic criteria, coding solves, and placement readiness',
        icon: Briefcase,
        category: 'Commands',
        badge: 'HIRE',
        action: () => onNavigate('hr-candidate-finder')
      },
      {
        id: 'nav_system',
        type: 'navigation',
        label: 'System Health & Data Quality',
        sublabel: 'Inspect database health, sync logs & issues',
        icon: Activity,
        category: 'Commands',
        action: () => onNavigate('system-health')
      }
    ];

    // Filter nav commands by role permissions
    if (isHod || isFacultyOrStaff || isAdmin) {
      navCommands.forEach(cmd => {
        if (cmd.id === 'nav_hod' && !isHod) return;
        if (cmd.id === 'nav_system' && !isAdmin) return;
        items.push(cmd);
      });
    } else {
      // Student role
      items.push(navCommands[0]); // Dashboard only
    }

    // --- 4. Action & System Commands ---
    items.push({
      id: 'act_gen_report',
      type: 'action',
      label: 'Generate Executive Report',
      sublabel: 'Create custom PDF/Excel summary report',
      icon: FileText,
      category: 'Actions',
      action: () => {
        onNavigate('reports');
        notify.info('Opened Reports & Exporters');
      }
    });

    items.push({
      id: 'act_toggle_theme',
      type: 'action',
      label: theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode',
      sublabel: 'Toggle application theme appearance (Alt + D)',
      icon: theme === 'dark' ? Sun : Moon,
      category: 'Actions',
      action: () => {
        toggleTheme();
        notify.info(`${theme === 'dark' ? 'Light' : 'Dark'} mode enabled`);
      }
    });

    items.push({
      id: 'act_toggle_sidebar',
      type: 'action',
      label: 'Toggle Navigation Sidebar',
      sublabel: 'Collapse or expand navigation sidebar (Ctrl + B)',
      icon: Sidebar,
      category: 'Actions',
      action: () => {
        window.dispatchEvent(new CustomEvent('toggle_sidebar'));
        notify.info('Sidebar toggled');
      }
    });

    items.push({
      id: 'act_shortcuts_guide',
      type: 'action',
      label: 'Keyboard Shortcuts Guide',
      sublabel: 'View all keyboard control shortcuts (?)',
      icon: HelpCircle,
      category: 'Actions',
      action: () => {
        if (onOpenShortcutsModal) onOpenShortcutsModal();
      }
    });

    return items;
  };

  const allItems = buildAllCommands();

  // Filter items by search query & category
  const filteredItems = allItems.filter(item => {
    const matchesCategory = activeCategory === 'All' || item.category === activeCategory;
    if (!matchesCategory) return false;

    if (!search.trim()) return true;

    // Direct dynamic AI query always matches the user's search
    if (item.id === 'ai_query_action') return true;

    const sClean = search.trim().toLowerCase();
    const labelMatch = item.label.toLowerCase().includes(sClean);
    const subMatch = (item.sublabel || '').toLowerCase().includes(sClean);

    return labelMatch || subMatch || item.exactMatch;
  });

  // Sort exact student matches to top
  filteredItems.sort((a, b) => {
    if (a.exactMatch && !b.exactMatch) return -1;
    if (!a.exactMatch && b.exactMatch) return 1;
    return 0;
  });

  useEffect(() => {
    setSelectedIndex(0);
  }, [search, activeCategory]);

  // Keyboard navigation inside list
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev < filteredItems.length - 1 ? prev + 1 : prev));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          filteredItems[selectedIndex].action();
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex, onClose]);

  useEffect(() => {
    if (listRef.current && isOpen) {
      const activeItem = listRef.current.children[selectedIndex] as HTMLElement;
      if (activeItem) {
        activeItem.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-end sm:items-start justify-center p-0 sm:pt-[12vh] sm:px-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/75 backdrop-blur-md"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 25 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 25 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="relative w-full max-w-2xl bg-white dark:bg-navy-950 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-navy-700 flex flex-col max-h-[88vh] sm:max-h-[80vh]"
      >
        {/* Mobile Swipe / Dismiss Pill & Top Bar */}
        <div className="sm:hidden pt-2.5 pb-1 px-4 flex flex-col items-center border-b border-slate-100 dark:border-navy-800/80 bg-slate-50 dark:bg-navy-900">
          <div className="w-10 h-1 bg-slate-300 dark:bg-navy-700 rounded-full mb-2" />
          <div className="w-full flex items-center justify-between">
            <span className="text-[11px] font-black tracking-wider uppercase text-slate-500 dark:text-slate-400">
              Quick Search & Commands
            </span>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-xl bg-slate-200/60 dark:bg-navy-800 transition-colors"
              aria-label="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Search Header */}
        <div className="p-3.5 sm:p-6 pb-3 sm:pb-5 border-b border-slate-100 dark:border-navy-800 bg-slate-50/80 dark:bg-navy-900/70 backdrop-blur-md">
          <div className="relative group w-full">
            <div className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 pointer-events-none flex items-center gap-1.5 sm:gap-3">
              <Search className="w-4 h-4 sm:w-5 sm:h-5 text-brand-500 dark:text-brand-400 group-focus-within:scale-110 transition-transform shrink-0" />
              <div className="w-[1.5px] h-4 sm:h-5 bg-slate-200 dark:border-white/10 dark:bg-navy-700 shrink-0" />
            </div>
            <input
              ref={inputRef}
              type="text"
              name="command-palette-search-input"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className="w-full h-11 sm:h-14 pl-10 sm:pl-[68px] pr-10 sm:pr-28 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-slate-900 dark:text-white placeholder-slate-400 text-xs sm:text-base font-semibold shadow-inner outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 transition-all"
              placeholder={isMobile ? "Search commands, students..." : "Search commands, students (e.g. 732224CC031)..."}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <div className="absolute right-2.5 sm:right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg transition-colors cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 bg-slate-100 dark:bg-navy-800 rounded-lg text-xs font-mono font-bold text-slate-400 dark:text-slate-400 border border-slate-200 dark:border-navy-700 shadow-sm">
                <Command className="w-3 h-3 text-slate-400" />
                <span>K</span>
              </div>
            </div>
          </div>

          {/* Category Filter Chips */}
          <div className="flex items-center gap-1.5 sm:gap-2 mt-3 sm:mt-4 pt-2.5 sm:pt-3.5 border-t border-slate-200/60 dark:border-navy-800/80 overflow-x-auto no-scrollbar">
            {(['All', 'AI', 'Commands', 'Students', 'Actions'] as const).map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`px-3 sm:px-4 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeCategory === cat
                    ? 'bg-brand-600 text-white shadow-md shadow-brand-500/20'
                    : 'bg-white dark:bg-navy-950 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 border border-slate-200/80 dark:border-navy-700'
                }`}
              >
                {cat}
              </button>
            ))}
            {isSearchingStudents && (
              <div className="ml-auto flex items-center gap-1 text-[11px] sm:text-xs font-semibold text-brand-600 dark:text-brand-400 animate-pulse whitespace-nowrap">
                <Loader2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 animate-spin" />
                <span>Searching...</span>
              </div>
            )}
          </div>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-2 sm:p-3.5 space-y-1 sm:space-y-1.5 custom-scrollbar" ref={listRef}>
          {filteredItems.length === 0 ? (
            <div className="p-8 sm:p-10 text-center text-slate-400 dark:text-slate-500">
              <p className="text-xs sm:text-sm font-medium">No commands or records found for "{search}"</p>
              <p className="text-[11px] sm:text-xs mt-1 text-slate-400">Try searching by Register Number, Name, or Action.</p>
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  className={`flex items-center px-3 py-2.5 sm:px-3.5 sm:py-3 rounded-xl cursor-pointer transition-all duration-150 group ${
                    isSelected
                      ? item.exactMatch
                        ? 'bg-emerald-50 border border-emerald-300 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-500/40 dark:text-emerald-200'
                        : 'bg-brand-50 border border-brand-200 text-brand-900 dark:bg-brand-500/10 dark:border-brand-500/30 dark:text-brand-300'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-900/60 border border-transparent'
                  }`}
                  onClick={() => {
                    item.action();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <div
                    className={`p-2 sm:p-2.5 rounded-xl shrink-0 mr-2.5 sm:mr-3 transition-colors ${
                      isSelected
                        ? item.exactMatch
                          ? 'bg-emerald-600 text-white'
                          : 'bg-brand-600 text-white'
                        : 'bg-slate-100 text-slate-500 dark:bg-navy-800 dark:text-slate-400 group-hover:bg-slate-200 dark:group-hover:bg-navy-700'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <span className="font-semibold text-xs sm:text-sm truncate">{item.label}</span>
                      {item.badge && (
                        <span
                          className={`px-1.5 py-0.5 sm:px-2 rounded-md text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider shrink-0 ${
                            item.exactMatch
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'
                              : 'bg-brand-100 text-brand-800 dark:bg-brand-900/50 dark:text-brand-300'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </div>
                    {item.sublabel && (
                      <span className="text-[11px] sm:text-xs text-slate-400 dark:text-slate-500 truncate block mt-0.5">
                        {item.sublabel}
                      </span>
                    )}
                  </div>

                  {isSelected && (
                    <div className="ml-2 sm:ml-3 shrink-0 flex items-center gap-1 text-xs font-semibold text-brand-600 dark:text-brand-400">
                      <span className="hidden sm:inline">Select</span>
                      <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer Bar */}
        <div className="flex items-center justify-between px-3.5 sm:px-4 py-2 sm:py-2.5 bg-slate-50 dark:bg-navy-900 border-t border-slate-100 dark:border-navy-800 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
          {/* Desktop Keyboard Shortcuts */}
          <div className="hidden sm:flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-navy-800 border border-slate-300 dark:border-navy-700 rounded text-[10px] font-mono">↑↓</kbd> Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-navy-800 border border-slate-300 dark:border-navy-700 rounded text-[10px] font-mono">↵</kbd> Select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-navy-800 border border-slate-300 dark:border-navy-700 rounded text-[10px] font-mono">Esc</kbd> Close
            </span>
          </div>

          {/* Mobile Touch Bar */}
          <div className="sm:hidden flex items-center justify-between w-full">
            <span className="text-[10.5px] text-slate-400 font-medium">
              Tap any item to open
            </span>
            <button
              type="button"
              onClick={onClose}
              className="text-[11px] font-bold text-brand-600 dark:text-brand-400 px-2.5 py-0.5 rounded-md bg-brand-50 dark:bg-brand-500/10 active:scale-95 transition-transform"
            >
              Close
            </button>
          </div>

          {search.trim().length >= 2 && (
            <div className="hidden sm:block text-[10px] font-semibold text-slate-400">
              Showing {filteredItems.length} results
            </div>
          )}
        </div>
      </motion.div>
    </div>,
    document.body
  );
};
