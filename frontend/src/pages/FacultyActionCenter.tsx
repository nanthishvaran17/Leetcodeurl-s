import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckSquare, Square, Users, Sparkles,
  ShieldAlert, AlertTriangle, CheckCircle2, Clock, Search, RefreshCw,
  ChevronDown, ChevronUp, X, Send, Activity, User, Check, Building2, GraduationCap,
  Calendar, Target, FileText, ArrowUpRight, Bell, RotateCcw, Eye, Award,
  LayoutGrid, SlidersHorizontal, MessageCircle
} from 'lucide-react';
import {
  getFacultyActionKPIs, getFacultyActionsList, updateFacultyAction,
  escalateAction, getActionTimeline, triggerSignalDetection,
  FacultyActionKPIs, FacultyActionItem, ActionTimelineEvent, UpdateActionPayload
} from '../services/intelligenceService';
import { BulkWhatsAppModal } from '../components/BulkWhatsAppModal';
import { StudentWhatsAppModal } from '../components/StudentWhatsAppModal';
import { IDCardGenerator } from '../components/IDCardGenerator';
import { StudentCodingProfileView } from '../components/StudentCodingProfileView';
import { GlobalFilter } from '../components/GlobalFilter';
import { useKeyboardContext } from '../context/KeyboardContext';
import { useDepartments } from '../contexts/DepartmentContext';
import { useAuth } from '../context/AuthContext';

// Priority Config (Red=Critical, Orange=High, Amber=Medium, Green=Low)
const PRIORITY_CONFIG: Record<string, { tw: string; dot: string; icon: React.ReactNode }> = {
  Critical: { tw: 'bg-red-50/90 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/80 shadow-xs font-bold',   dot: 'bg-red-500 dark:bg-red-400',    icon: <ShieldAlert size={12} strokeWidth={3} /> },
  High:     { tw: 'bg-orange-50/90 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800/80 shadow-xs font-bold', dot: 'bg-orange-500 dark:bg-orange-400', icon: <AlertTriangle size={12} strokeWidth={2.5} /> },
  Medium:   { tw: 'bg-amber-50/90 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80 shadow-xs font-bold', dot: 'bg-amber-500 dark:bg-amber-400', icon: <Clock size={12} strokeWidth={2.5} /> },
  Low:      { tw: 'bg-emerald-50/90 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80 shadow-xs font-bold', dot: 'bg-emerald-500 dark:bg-emerald-400', icon: <Activity size={12} strokeWidth={2.5} /> },
};

const STATUS_CONFIG: Record<string, string> = {
  Pending:       'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 font-bold',
  'In Progress': 'bg-blue-50/90 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 font-bold',
  Monitoring:    'bg-amber-50/90 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 font-bold',
  Completed:     'bg-cyan-50/90 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/60 font-bold',
  Resolved:      'bg-emerald-50/90 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 font-bold',
  Overdue:       'bg-rose-50/90 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 font-bold',
  Escalated:     'bg-purple-50/90 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 font-bold',
};

const EVENT_COLOR: Record<string, string> = {
  ACTION_CREATED: 'text-brand-400',
  STATUS_CHANGED: 'text-blue-400',
  FACULTY_ASSIGNED: 'text-emerald-400',
  NOTE_ADDED: 'text-amber-400',
  FOLLOW_UP_SCHEDULED: 'text-pink-400',
  ESCALATED: 'text-purple-400',
  RESOLVED: 'text-emerald-400',
  PRIORITY_CHANGED: 'text-orange-400',
};

// Score Tooltip Badge 
const PriorityBadge: React.FC<{ priority: string; score: number; reason: string }> = ({ priority, score, reason }) => {
  const [show, setShow] = useState(false);
  const cfg = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.Low;
  return (
    <div className="relative inline-block">
      <span
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold cursor-default select-none ${cfg.tw}`}
      >
        {cfg.icon} {priority}
        <span className="opacity-75 text-[10px]">({score})</span>
      </span>
      {show && (
        <div className="absolute top-[110%] left-0 z-50 w-64 p-3 rounded-xl text-xs bg-slate-900 dark:bg-navy-950 text-white border border-slate-700 dark:border-navy-700 shadow-xl leading-relaxed pointer-events-none">
          <div className="font-extrabold mb-1 text-amber-400">Score: {score}/100</div>
          <div className="text-slate-300">{reason}</div>
        </div>
      )}
    </div>
  );
};

const CustomSelect: React.FC<{
  value: string;
  onChange: (v: string) => void;
  options: { label: string; value: string; shortLabel?: string; icon?: React.ReactNode; badge?: string; badgeColor?: string }[];
  placeholder: string;
  icon?: React.ReactNode;
  alignRight?: boolean;
}> = ({ value, onChange, options, placeholder, icon, alignRight = false }) => {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [dropdownSide, setDropdownSide] = useState<'left' | 'right'>(alignRight ? 'right' : 'left');

  const updateAlignment = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const expectedMenuWidth = 280;

      // Smart boundary check:
      // 1. If opening right-aligned would overflow the left edge of viewport (e.g. mobile left column), align left.
      // 2. If opening left-aligned would overflow the right edge of viewport (e.g. mobile right column), align right.
      // 3. Otherwise, use alignRight preference.
      if (rect.right - expectedMenuWidth < 8) {
        setDropdownSide('left');
      } else if (rect.left + expectedMenuWidth > viewportWidth - 8) {
        setDropdownSide('right');
      } else {
        setDropdownSide(alignRight ? 'right' : 'left');
      }
    }
  }, [alignRight]);

  const toggleDropdown = () => {
    if (!open) {
      updateAlignment();
    }
    setOpen(prev => !prev);
  };

  // Close on outside click and update alignment on resize
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClick);
      window.addEventListener('resize', updateAlignment);
    }
    return () => {
      document.removeEventListener('mousedown', handleClick);
      window.removeEventListener('resize', updateAlignment);
    };
  }, [open, updateAlignment]);

  return (
    <div className="relative flex-1 w-full md:w-auto md:flex-initial min-w-0 md:min-w-[102px]" ref={containerRef}>
      <button
        onClick={toggleDropdown}
        className={`flex items-center justify-between gap-1.5 sm:gap-2 w-full sm:w-auto md:min-w-[115px] lg:min-w-[125px] xl:min-w-[135px] px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-xl border transition-all cursor-pointer font-bold text-xs sm:text-sm shadow-xs ${
          open 
            ? 'border-indigo-500 bg-white dark:bg-navy-950 ring-4 ring-indigo-500/10' 
            : value 
              ? 'border-indigo-300 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200' 
              : 'border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-950 text-slate-800 dark:text-slate-200 hover:border-slate-400'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className={value ? 'text-indigo-600 dark:text-indigo-400 shrink-0' : 'text-slate-400 shrink-0'}>{icon || selected?.icon}</span>
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {selected?.badge && (
              <span className={`px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-black uppercase shrink-0 ${selected.badgeColor || 'bg-slate-100 text-slate-600'}`}>
                {selected.badge}
              </span>
            )}
            <span className="truncate text-left text-[11px] sm:text-sm whitespace-nowrap">{selected ? (selected.shortLabel || selected.label) : placeholder}</span>
          </div>
        </div>
        <ChevronDown size={14} className={`transition-transform duration-300 shrink-0 ${open ? 'rotate-180 text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
      </button>

      {open && (
        <div className={`absolute z-50 top-[110%] ${dropdownSide === 'right' ? 'right-0' : 'left-0'} w-[280px] sm:min-w-[320px] max-w-[calc(100vw-24px)] p-1.5 rounded-2xl bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 shadow-xl animate-fade-in-up`}>
          <button
            onClick={() => { onChange(''); setOpen(false); }}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${
              !value 
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' 
                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-800'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="opacity-70">{icon}</span>
              <span>{placeholder}</span>
            </div>
            {!value && <Check size={16} strokeWidth={3} />}
          </button>
          
          <div className="h-px bg-slate-100 dark:bg-navy-800 my-1.5 mx-2" />

          <div className="max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
            {options.map((opt) => {
              const isSelected = value === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer mb-1 last:mb-0 ${
                    isSelected 
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' 
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={isSelected ? 'text-white opacity-90' : 'text-slate-400'}>{opt.icon}</span>
                    {opt.badge && (
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${
                        isSelected ? 'bg-white/20 text-white' : opt.badgeColor || 'bg-slate-100 text-slate-600'
                      }`}>
                        {opt.badge}
                      </span>
                    )}
                    <span>{opt.label}</span>
                  </div>
                  {isSelected && <Check size={16} strokeWidth={3} />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// Animated KPI Card with Soft Semantic Tints
const KPICard: React.FC<{
  label: string; value: number; colorTheme: string; icon: React.ReactNode;
  active: boolean; onClick: () => void; subtitle?: string;
  isGrid?: boolean;
}> = ({ label, value, colorTheme, icon, active, onClick, subtitle, isGrid = true }) => {
  const themes: Record<string, {
    cardBg: string;
    cardBorder: string;
    activeRing: string;
    iconBg: string;
    iconText: string;
    numText: string;
    labelText: string;
    subText: string;
    hoverBorder: string;
  }> = {
    red: {
      cardBg: 'bg-red-50/70 dark:bg-red-950/30',
      cardBorder: 'border-red-200 dark:border-red-900/50',
      activeRing: 'ring-2 ring-inset ring-red-500 border-red-500 shadow-md shadow-red-500/15 bg-red-100/70 dark:bg-red-950/50',
      iconBg: 'bg-red-100 dark:bg-red-900/60',
      iconText: 'text-red-600 dark:text-red-400',
      numText: 'text-red-700 dark:text-red-300',
      labelText: 'text-red-900 dark:text-red-200',
      subText: 'text-red-600/80 dark:text-red-400/80',
      hoverBorder: 'hover:border-red-400 dark:hover:border-red-500/60'
    },
    orange: {
      cardBg: 'bg-orange-50/70 dark:bg-orange-950/30',
      cardBorder: 'border-orange-200 dark:border-orange-900/50',
      activeRing: 'ring-2 ring-inset ring-orange-500 border-orange-500 shadow-md shadow-orange-500/15 bg-orange-100/70 dark:bg-orange-950/50',
      iconBg: 'bg-orange-100 dark:bg-orange-900/60',
      iconText: 'text-orange-600 dark:text-orange-400',
      numText: 'text-orange-700 dark:text-orange-300',
      labelText: 'text-orange-900 dark:text-orange-200',
      subText: 'text-orange-600/80 dark:text-orange-400/80',
      hoverBorder: 'hover:border-orange-400 dark:hover:border-orange-500/60'
    },
    amber: {
      cardBg: 'bg-amber-50/70 dark:bg-amber-950/30',
      cardBorder: 'border-amber-200 dark:border-amber-900/50',
      activeRing: 'ring-2 ring-inset ring-amber-500 border-amber-500 shadow-md shadow-amber-500/15 bg-amber-100/70 dark:bg-amber-950/50',
      iconBg: 'bg-amber-100 dark:bg-amber-900/60',
      iconText: 'text-amber-600 dark:text-amber-400',
      numText: 'text-amber-700 dark:text-amber-300',
      labelText: 'text-amber-900 dark:text-amber-200',
      subText: 'text-amber-600/80 dark:text-amber-400/80',
      hoverBorder: 'hover:border-amber-400 dark:hover:border-amber-500/60'
    },
    blue: {
      cardBg: 'bg-blue-50/70 dark:bg-blue-950/30',
      cardBorder: 'border-blue-200 dark:border-blue-900/50',
      activeRing: 'ring-2 ring-inset ring-blue-500 border-blue-500 shadow-md shadow-blue-500/15 bg-blue-100/70 dark:bg-blue-950/50',
      iconBg: 'bg-blue-100 dark:bg-blue-900/60',
      iconText: 'text-blue-600 dark:text-blue-400',
      numText: 'text-blue-700 dark:text-blue-300',
      labelText: 'text-blue-900 dark:text-blue-200',
      subText: 'text-blue-600/80 dark:text-blue-400/80',
      hoverBorder: 'hover:border-blue-400 dark:hover:border-blue-500/60'
    },
    cyan: {
      cardBg: 'bg-cyan-50/70 dark:bg-cyan-950/30',
      cardBorder: 'border-cyan-200 dark:border-cyan-900/50',
      activeRing: 'ring-2 ring-inset ring-cyan-500 border-cyan-500 shadow-md shadow-cyan-500/15 bg-cyan-100/70 dark:bg-cyan-950/50',
      iconBg: 'bg-cyan-100 dark:bg-cyan-900/60',
      iconText: 'text-cyan-600 dark:text-cyan-400',
      numText: 'text-cyan-700 dark:text-cyan-300',
      labelText: 'text-cyan-900 dark:text-cyan-200',
      subText: 'text-cyan-600/80 dark:text-cyan-400/80',
      hoverBorder: 'hover:border-cyan-400 dark:hover:border-cyan-500/60'
    },
    emerald: {
      cardBg: 'bg-emerald-50/70 dark:bg-emerald-950/30',
      cardBorder: 'border-emerald-200 dark:border-emerald-900/50',
      activeRing: 'ring-2 ring-inset ring-emerald-500 border-emerald-500 shadow-md shadow-emerald-500/15 bg-emerald-100/70 dark:bg-emerald-950/50',
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/60',
      iconText: 'text-emerald-600 dark:text-emerald-400',
      numText: 'text-emerald-700 dark:text-emerald-300',
      labelText: 'text-emerald-900 dark:text-emerald-200',
      subText: 'text-emerald-600/80 dark:text-emerald-400/80',
      hoverBorder: 'hover:border-emerald-400 dark:hover:border-emerald-500/60'
    },
    pink: {
      cardBg: 'bg-rose-50/70 dark:bg-rose-950/30',
      cardBorder: 'border-rose-200 dark:border-rose-900/50',
      activeRing: 'ring-2 ring-inset ring-rose-500 border-rose-500 shadow-glass-dark bg-rose-500/15',
      iconBg: 'bg-rose-500/15',
      iconText: 'text-rose-600 dark:text-rose-400',
      numText: 'text-rose-600 dark:text-rose-400',
      labelText: 'text-rose-700 dark:text-rose-300',
      subText: 'text-rose-600/80 dark:text-rose-400/80',
      hoverBorder: 'hover:border-rose-400 dark:hover:border-rose-500/60'
    },
    violet: {
      cardBg: 'bg-purple-50/70 dark:bg-purple-950/30',
      cardBorder: 'border-purple-200 dark:border-purple-900/50',
      activeRing: 'ring-2 ring-inset ring-purple-500 border-purple-500 shadow-glass-dark bg-purple-500/15',
      iconBg: 'bg-purple-500/15',
      iconText: 'text-purple-600 dark:text-purple-400',
      numText: 'text-purple-600 dark:text-purple-400',
      labelText: 'text-purple-700 dark:text-purple-300',
      subText: 'text-purple-600/80 dark:text-purple-400/80',
      hoverBorder: 'hover:border-purple-400 dark:hover:border-purple-500/60'
    }
  };
  const theme = themes[colorTheme] || themes['blue'];

  return (
    <button
      onClick={onClick}
      className={`text-left rounded-2xl p-2.5 sm:p-3.5 md:p-4 glass-panel border transition-all duration-300 transform hover:-translate-y-0.5 hover:shadow-glass cursor-pointer relative overflow-hidden group active:scale-95 ${
        isGrid
          ? 'w-full'
          : 'flex-none w-[calc(50%-5px)] min-w-[136px] md:flex-1 md:w-auto snap-start'
      } ${
        active
          ? `${theme.activeRing}`
          : `${theme.cardBorder} ${theme.hoverBorder}`
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5 sm:mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`p-1 rounded-lg sm:p-1.5 sm:rounded-xl ${theme.iconBg} ${theme.iconText} transition-transform group-hover:scale-110 shrink-0 shadow-xs`}>
            {React.cloneElement(icon as React.ReactElement, { size: 13 })}
          </span>
          <span className={`text-[10px] sm:text-[11px] font-black uppercase tracking-wider ${theme.labelText} transition-colors truncate`}>
            {label}
          </span>
        </div>
        {active && <span className="w-2 h-2 rounded-full bg-current animate-pulse opacity-90 shrink-0" />}
      </div>
      <div className={`text-2xl sm:text-3xl font-black font-mono tracking-tight leading-none ${theme.numText}`}>
        {value}
      </div>
      {subtitle ? (
        <div className={`text-[9.5px] sm:text-[10.5px] font-extrabold mt-1.5 sm:mt-2.5 truncate ${theme.subText}`}>
          {subtitle}
        </div>
      ) : (
        <div className="h-3 sm:h-4 mt-1.5 sm:mt-2.5" />
      )}
    </button>
  );
};

// Unified Student View & Pass Modal 
const StudentViewModal: React.FC<{
  item: FacultyActionItem;
  initialTab?: 'pass' | 'profile' | 'timeline';
  onClose: () => void;
  onOpenUpdate?: () => void;
}> = ({ item, initialTab = 'pass', onClose, onOpenUpdate }) => {
  const [activeViewTab, setActiveViewTab] = useState<'pass' | 'profile' | 'timeline'>(initialTab);
  const [events, setEvents] = useState<ActionTimelineEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(true);

  useEffect(() => {
    getActionTimeline(item.id)
      .then(e => {
        const safeEvents = Array.isArray(e) ? e : (Array.isArray((e as any)?.events) ? (e as any).events : (Array.isArray((e as any)?.data) ? (e as any).data : []));
        setEvents(safeEvents);
        setTimelineLoading(false);
      })
      .catch(() => {
        setEvents([]);
        setTimelineLoading(false);
      });
  }, [item.id]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[999999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xs overflow-y-auto animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-4xl max-h-[92dvh] sm:max-h-[92vh] flex flex-col rounded-t-[28px] sm:rounded-3xl bg-white dark:bg-navy-900 border-t sm:border border-slate-200 dark:border-navy-700 shadow-2xl overflow-hidden text-slate-900 dark:text-white">
        
        {/* Mobile Pull Indicator */}
        <div className="w-10 h-1 bg-slate-300 dark:bg-navy-700 rounded-full mx-auto my-2 sm:hidden shrink-0" />

        {/* Header */}
        <div className="p-3.5 sm:p-5 border-b border-slate-100 dark:border-navy-800 flex items-center justify-between gap-3 bg-slate-50/50 dark:bg-navy-950/60 shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="shrink-0 w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-brand-500 to-indigo-600 flex items-center justify-center font-black text-lg sm:text-xl text-white shadow-lg shadow-brand-500/25">
              {item.student_name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center flex-wrap gap-1.5 sm:gap-2">
                <h3 className="text-base sm:text-xl font-black text-slate-900 dark:text-white truncate tracking-tight">{item.student_name}</h3>
                <span className="shrink-0 px-2 py-0.5 rounded-md text-[10px] font-black bg-brand-50 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-500/30">
                  {item.year_level?.replace(/\s*year\b/gi, '').trim() || item.year_level} Year
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5 sm:mt-1">
                <span className="font-bold text-slate-700 dark:text-slate-300">{item.reg_no}</span>
                <span className="text-slate-300 dark:text-slate-600">•</span>
                <span className="truncate">{item.department_code}</span>
                <span className="text-slate-300 dark:text-slate-600">•</span>
                <span className="text-brand-600 dark:text-brand-400 font-bold truncate">@{item.leetcode_username}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {onOpenUpdate && (
              <button
                onClick={() => { onClose(); onOpenUpdate(); }}
                className="px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-brand-50 hover:bg-brand-100 dark:bg-brand-500/20 dark:hover:bg-brand-500/30 border border-brand-200 dark:border-brand-500/40 text-brand-600 dark:text-brand-300 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <FileText size={12} />
                <span className="hidden xs:inline sm:inline">Edit Action</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 sm:p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-navy-800 dark:hover:bg-navy-700 text-slate-500 dark:text-slate-300 transition cursor-pointer"
              title="Close modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs (Mobile-friendly horizontal scroll) */}
        <div className="flex items-center gap-2 px-3 sm:px-5 py-2.5 bg-slate-50/80 dark:bg-navy-950/40 border-b border-slate-100 dark:border-navy-800/80 shrink-0 overflow-x-auto no-scrollbar scroll-smooth">
          <button
            onClick={() => setActiveViewTab('pass')}
            className={`flex items-center justify-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shrink-0 ${
              activeViewTab === 'pass'
                ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/25'
                : 'text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-navy-800/60 font-bold'
            }`}
          >
            <Award size={13} className="shrink-0" />
            <span className="whitespace-nowrap">Digital Performance Pass</span>
          </button>

          <button
            onClick={() => setActiveViewTab('profile')}
            className={`flex items-center justify-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shrink-0 ${
              activeViewTab === 'profile'
                ? 'bg-brand-500 text-white shadow-md shadow-brand-500/25'
                : 'text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-navy-800/60 font-bold'
            }`}
          >
            <Activity size={13} className="shrink-0" />
            <span className="whitespace-nowrap">AI Coding Profile</span>
          </button>

          <button
            onClick={() => setActiveViewTab('timeline')}
            className={`flex items-center justify-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shrink-0 ${
              activeViewTab === 'timeline'
                ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/25'
                : 'text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-navy-800/60 font-bold'
            }`}
          >
            <Clock size={13} className="shrink-0" />
            <span className="whitespace-nowrap">Intervention Timeline ({(Array.isArray(events) ? events.length : 0)})</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-6 custom-scrollbar bg-white dark:bg-transparent">
          {activeViewTab === 'pass' && (
            <div className="space-y-4">
              <IDCardGenerator
                studentName={item.student_name}
                regNo={item.reg_no}
                deptName={item.department_name}
                yearLevel={item.year_level}
                totalSolved={item.total_solved}
                collegeRank={1}
                streakCount={item.last_active_days_ago <= 1 ? 5 : 0}
                leetcodeUsername={item.leetcode_username}
              />
            </div>
          )}

          {activeViewTab === 'profile' && (
            <div className="space-y-4">
              <StudentCodingProfileView studentId={item.student_id} />
            </div>
          )}

          {activeViewTab === 'timeline' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-100 dark:bg-navy-950/60 border border-slate-200 dark:border-navy-800">
                <div className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 mb-1">Current Action Signal</div>
                <div className="text-sm font-black text-slate-900 dark:text-white">{item.signal_type}</div>
                <div className="text-xs text-brand-600 dark:text-brand-400 mt-1 italic font-semibold">{item.recommended_action}</div>
              </div>

              {timelineLoading ? (
                <div className="py-12 text-center text-slate-600 dark:text-slate-300 font-bold">
                  <RefreshCw size={20} className="animate-spin mx-auto mb-2 opacity-50" />
                  <span className="text-xs">Loading intervention timeline...</span>
                </div>
              ) : (!Array.isArray(events) || events.length === 0) ? (
                <div className="py-12 text-center text-slate-600 dark:text-slate-300 text-xs font-bold">No intervention audit logs recorded yet.</div>
              ) : (
                <div className="relative pl-4 space-y-4">
                  <div className="absolute left-7 top-3 bottom-3 w-px bg-slate-200 dark:bg-navy-800" />
                  {(Array.isArray(events) ? events : []).map((ev, i) => {
                    const colorCls = EVENT_COLOR[ev.event_type] || 'text-slate-700 dark:text-slate-200';
                    return (
                      <div key={ev.id} className="flex gap-4 items-start relative z-10">
                        <div className={`w-7 h-7 rounded-full border border-current flex items-center justify-center text-[11px] font-black bg-white dark:bg-navy-900 ${colorCls} shrink-0 shadow-sm`}>
                          {i + 1}
                        </div>
                        <div className="flex-1 p-3.5 rounded-2xl bg-slate-50 dark:bg-navy-950/70 border border-slate-200 dark:border-navy-800 space-y-1 shadow-sm">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <span className={`text-xs font-black ${colorCls}`}>{ev.event_type.replace(/_/g, ' ')}</span>
                            <span className="text-[10px] text-slate-700 dark:text-slate-300 font-mono font-bold">{ev.timestamp}</span>
                          </div>
                          <div className="text-[11px] text-slate-800 dark:text-slate-200 font-medium">by <b className="text-slate-900 dark:text-white font-black">{ev.user_name}</b></div>
                          {(ev.previous_value || ev.new_value) && (
                            <div className="text-xs pt-1 border-t border-slate-200 dark:border-navy-800/80">
                              {ev.previous_value && <span className="line-through text-slate-500 dark:text-slate-400 mr-1.5">{ev.previous_value}</span>}
                              {ev.new_value && <span className="text-emerald-600 dark:text-emerald-400 font-bold">{ev.new_value}</span>}
                            </div>
                          )}
                          {ev.reason && <div className="text-[11px] text-slate-700 dark:text-slate-300 italic pt-1 font-medium">{ev.reason}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

// Update Modal 
const UpdateModal: React.FC<{
  item: FacultyActionItem;
  onClose: () => void;
  onSaved: () => void;
}> = ({ item, onClose, onSaved }) => {
  const [form, setForm] = useState<UpdateActionPayload>({
    status: item.status,
    assigned_faculty_name: item.assigned_faculty_name || '',
    action_taken: item.action_taken || '',
    faculty_notes: item.faculty_notes || '',
    evidence_remarks: item.evidence_remarks || '',
    follow_up_date: item.follow_up_date || '',
    next_review_date: item.next_review_date || '',
    updated_by_name: 'Faculty',
    reason: '',
  });
  const [saving, setSaving] = useState(false);
  const [showEscalate, setShowEscalate] = useState(false);
  const [escalateTo, setEscalateTo] = useState('HOD');
  const [escalateReason, setEscalateReason] = useState('');
  const [escalating, setEscalating] = useState(false);
  const [msg, setMsg] = useState('');

  const cfg = PRIORITY_CONFIG[item.priority] || PRIORITY_CONFIG.Low;

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateFacultyAction(item.id, form);
      setMsg('Saved');
      setTimeout(() => { onSaved(); onClose(); }, 700);
    } catch { setMsg('Failed'); }
    finally { setSaving(false); }
  };

  const handleEscalate = async () => {
    setEscalating(true);
    try {
      await escalateAction(item.id, escalateTo, escalateReason, form.updated_by_name);
      setMsg(`Escalated to ${escalateTo}`);
      setTimeout(() => { onSaved(); onClose(); }, 700);
    } catch { setMsg('Escalation failed'); }
    finally { setEscalating(false); }
  };

  const inputCls = "w-full rounded-2xl bg-slate-50 dark:bg-navy-950/80 border border-slate-200 dark:border-navy-700/80 px-4 py-2.5 text-sm font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition shadow-xs placeholder:text-slate-400 placeholder:font-normal";
  const labelCls = "block text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-navy-300 mb-1.5 flex items-center gap-1.5";

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[999999] flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in overflow-y-auto"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-2xl max-h-[92vh] sm:max-h-[88vh] flex flex-col rounded-3xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700/80 shadow-2xl shadow-indigo-950/30 overflow-hidden my-auto min-h-0">

        {/* Mobile bottom-sheet drag handle */}
        <div className="pt-2.5 pb-1 bg-slate-950 sm:hidden flex justify-center shrink-0">
          <div className="w-12 h-1 rounded-full bg-white/25" />
        </div>

        {/* Unified Scroll Container (Header + Signal Banner + Form Body) */}
        <div className="overflow-y-auto flex-1 min-h-0 custom-scrollbar overscroll-contain touch-pan-y">

          {/* Premium Executive Header */}
          <div className="relative overflow-hidden p-5 sm:p-6 bg-gradient-to-r from-slate-950 via-navy-950 to-indigo-950 text-white border-b border-slate-800/80">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="relative z-10 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3.5 min-w-0 flex-1">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-500 via-indigo-600 to-purple-600 flex items-center justify-center font-black text-xl text-white shadow-lg shadow-brand-500/30 border border-white/20 shrink-0">
                  {item.student_name.charAt(0)}
                </div>
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <PriorityBadge priority={item.priority} score={item.priority_score} reason={item.priority_score_reason} />
                    {item.is_escalated && (
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 font-black tracking-wide animate-pulse">
                        ESCALATED
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg sm:text-2xl font-black text-white tracking-tight leading-snug truncate" title={item.student_name}>
                    {item.student_name}
                  </h3>

                  <p className="text-[11px] sm:text-xs text-slate-300 font-mono flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold">{item.reg_no}</span>
                    <span className="text-slate-500">•</span>
                    <span>{item.department_code}</span>
                    <span className="text-slate-500">•</span>
                    <span className="px-1.5 py-0.5 rounded-md bg-white/10 text-white font-sans text-[10px] font-black">{item.year_level} Year</span>
                    <span className="text-slate-500">•</span>
                    <span className="text-brand-300 font-bold truncate max-w-full" title={`@${item.leetcode_username}`}>@{item.leetcode_username}</span>
                  </p>

                  {/* Quick Metrics Bar */}
                  <div className="flex items-center gap-2 pt-1.5 text-[10px] sm:text-[11px] text-slate-300 font-bold flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2 py-1 sm:px-2.5 sm:py-0.5 rounded-lg bg-slate-800/80 border border-slate-700">
                      <CheckCircle2 size={12} className="text-emerald-400" />
                      {item.total_solved} Solved
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-1 sm:px-2.5 sm:py-0.5 rounded-lg bg-slate-800/80 border border-slate-700">
                      <Award size={12} className="text-amber-400" />
                      {item.current_rating} Rating
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-1 sm:px-2.5 sm:py-0.5 rounded-lg bg-slate-800/80 border border-slate-700">
                      <Activity size={12} className="text-cyan-400" />
                      {item.contests_attended} Contests
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-1 sm:px-2.5 sm:py-0.5 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-400">
                      <Clock size={12} />
                      {item.last_active_days_ago}d ago
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={onClose}
                className="p-2 rounded-2xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition cursor-pointer shrink-0 border border-white/10 ml-auto"
                title="Close modal"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Signal & Recommendation Banner */}
          <div className="px-6 py-3.5 bg-gradient-to-r from-indigo-500/10 via-brand-500/5 to-purple-500/10 dark:from-indigo-950/50 dark:via-navy-900/60 dark:to-purple-950/50 border-b border-indigo-100 dark:border-navy-700/80 flex items-start gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0">
              <Target size={16} />
            </div>
            <div className="space-y-0.5 flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  Triggered Intelligence Signal
                </span>
                <span className="px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-[10px] font-black font-mono">
                  {item.signal_type}
                </span>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 font-semibold italic leading-relaxed">
                "{item.recommended_action}"
              </p>
            </div>
          </div>

          {/* Form Body Content */}
          <div className="p-5 sm:p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>
                <Activity size={13} className="text-indigo-500" />
                Intervention Status
              </label>
              <GlobalFilter
                value={form.status}
                onChange={val => setForm(f => ({ ...f, status: val }))}
                dropdownWidth="w-full"
                options={['Pending', 'In Progress', 'Monitoring', 'Completed', 'Resolved'].map(s => ({ value: s, label: s }))}
                icon={<Activity className="w-4 h-4 text-indigo-500" />}
              />
            </div>
            <div>
              <label className={labelCls}>
                <User size={13} className="text-indigo-500" />
                Assigned Faculty / Mentor
              </label>
              <input
                value={form.assigned_faculty_name}
                onChange={e => setForm(f => ({ ...f, assigned_faculty_name: e.target.value }))}
                className={inputCls}
                placeholder="Dr. / Prof. Name"
              />
            </div>
          </div>

          {/* Quick Mentoring Action (1-Click Fill) */}
          <div>
            <label className={labelCls}>
              <Target size={13} className="text-brand-500" />
              Quick Mentoring Action (1-Click Fill)
            </label>
            <div className="flex flex-wrap gap-2 mt-1">
              {[
                { label: 'Contacted & Reminded', action: 'Spoke directly with student. Encouraged to resume LeetCode practice and attend Sunday contest.', status: 'In Progress' },
                { label: 'Assigned 2 Easy Problems', action: 'Assigned 2 beginner problems on Arrays/Strings to build confidence.', status: 'In Progress' },
                { label: '1-on-1 Mentoring Conducted', action: 'Conducted 1-on-1 session to resolve coding doubts and debug setup issues.', status: 'In Progress' },
                { label: 'Doubts Cleared & On-Track', action: 'Student confirmed setup is working and completed initial assigned tasks.', status: 'Resolved' },
              ].map((tmpl, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setForm(f => ({
                    ...f,
                    action_taken: tmpl.action,
                    status: tmpl.status
                  }))}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-navy-800 dark:hover:bg-navy-700 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-navy-700 text-[11px] font-bold transition active:scale-95 cursor-pointer"
                >
                  {tmpl.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelCls}>
              <FileText size={13} className="text-emerald-500" />
              Action Taken (Intervention Details)
            </label>
            <textarea
              value={form.action_taken}
              onChange={e => setForm(f => ({ ...f, action_taken: e.target.value }))}
              className={`${inputCls} h-20 resize-y leading-relaxed`}
              placeholder="Describe the mentoring session or task assigned to the student..."
            />
          </div>

          <div>
            <label className={labelCls}>
              <ShieldAlert size={13} className="text-amber-500" />
              Faculty Notes (Confidential)
            </label>
            <textarea
              value={form.faculty_notes}
              onChange={e => setForm(f => ({ ...f, faculty_notes: e.target.value }))}
              className={`${inputCls} h-20 resize-y leading-relaxed`}
              placeholder="Private faculty reference notes, observations, or student feedback..."
            />
          </div>

          <div>
            <label className={labelCls}>
              <Award size={13} className="text-purple-500" />
              Evidence / Audit Remarks
            </label>
            <input
              value={form.evidence_remarks}
              onChange={e => setForm(f => ({ ...f, evidence_remarks: e.target.value }))}
              className={inputCls}
              placeholder="e.g. Missed WC#516, no LeetCode submission since Aug 10"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Updated By</label>
              <input
                value={form.updated_by_name}
                onChange={e => setForm(f => ({ ...f, updated_by_name: e.target.value }))}
                className={inputCls}
                placeholder="Your name"
              />
            </div>
            <div>
              <label className={labelCls}>Follow-up Date</label>
              <input
                type="date"
                value={form.follow_up_date || ''}
                onChange={e => setForm(f => ({ ...f, follow_up_date: e.target.value }))}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Next Review Date</label>
              <input
                type="date"
                value={form.next_review_date || ''}
                onChange={e => setForm(f => ({ ...f, next_review_date: e.target.value }))}
                className={inputCls}
              />
            </div>
          </div>

          {/* Escalation Control Section */}
          <div className="rounded-2xl border border-rose-200 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4 text-rose-500" />
                <span className="text-xs font-black uppercase text-rose-700 dark:text-rose-300">
                  Escalation Management
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowEscalate(!showEscalate)}
                className="px-3 py-1 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold transition cursor-pointer"
              >
                {showEscalate ? 'Hide Escalation' : 'Escalate to HOD'}
              </button>
            </div>

            {showEscalate && (
              <div className="pt-2 flex flex-col gap-3 border-t border-rose-200/60 dark:border-rose-900/40">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Escalate Target</label>
                    <input
                      value={escalateTo}
                      onChange={e => setEscalateTo(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Reason for Escalation</label>
                    <input
                      value={escalateReason}
                      onChange={e => setEscalateReason(e.target.value)}
                      className={inputCls}
                      placeholder="No progress after multiple reminders..."
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleEscalate}
                  disabled={escalating}
                  className="self-end px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs font-black shadow-md shadow-rose-600/30 transition cursor-pointer disabled:opacity-50"
                >
                  {escalating ? 'Escalating...' : 'Confirm Escalation to HOD'}
                </button>
              </div>
            )}
          </div>

          {msg && (
            <div className={`p-3 rounded-2xl text-xs font-black flex items-center gap-2 ${msg.includes('failed') ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'}`}>
              <CheckCircle2 size={14} />
              {msg}
            </div>
          )}
        </div>
        </div>

        {/* Modal Footer */}
        <div className="grid grid-cols-2 sm:flex sm:justify-end items-center gap-2.5 p-3 sm:px-6 sm:py-4 border-t border-slate-200 dark:border-navy-800 bg-slate-50/90 dark:bg-navy-950/90 backdrop-blur-md shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 min-h-[44px] rounded-2xl bg-slate-200/80 dark:bg-navy-800 hover:bg-slate-300 dark:hover:bg-navy-700 text-slate-700 dark:text-slate-300 text-xs font-black transition cursor-pointer touch-manipulation active:scale-95 flex items-center justify-center"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={async () => {
              setSaving(true);
              try {
                await updateFacultyAction(item.id, {
                  ...form,
                  status: 'Resolved',
                  action_taken: form.action_taken || 'Student intervention completed and resolved.'
                });
                setMsg('Marked as Resolved!');
                setTimeout(() => { onSaved(); onClose(); }, 700);
              } catch { setMsg('Failed'); }
              finally { setSaving(false); }
            }}
            disabled={saving}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-5 py-2.5 min-h-[44px] rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-md shadow-emerald-600/30 active:scale-95 transition-all cursor-pointer disabled:opacity-50 touch-manipulation"
          >
            <CheckCircle2 size={14} />
            <span>Mark Resolved</span>
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 min-h-[44px] rounded-2xl bg-gradient-to-r from-brand-600 via-indigo-600 to-purple-600 hover:from-brand-500 hover:to-purple-500 text-white text-xs font-black shadow-lg shadow-brand-600/30 active:scale-95 transition-all cursor-pointer disabled:opacity-50 touch-manipulation"
          >
            <Send size={14} />
            <span>{saving ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// Main Page 
export const FacultyActionCenter: React.FC = () => {
  const [kpis, setKpis] = useState<FacultyActionKPIs | null>(null);
  const [items, setItems] = useState<FacultyActionItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [filteredCount, setFilteredCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  const { departments, allDepartments, isGlobalAccess } = useDepartments();
  const { user } = useAuth();
  const isAdmin = ['admin', 'super_admin', 'super admin', 'principal'].includes(user?.role?.toLowerCase() || '');
  const isHOD = ['hod', 'department hod', 'department_hod'].includes(user?.role?.toLowerCase() || '');
  const canFilterDepts = isGlobalAccess || isAdmin || isHOD;

  // Bulk Selection & Outreach
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<number>>(new Set());
  const [whatsAppStudent, setWhatsAppStudent] = useState<FacultyActionItem | null>(null);
  const [showBulkWhatsAppModal, setShowBulkWhatsAppModal] = useState(false);
  const [filterStaff, setFilterStaff] = useState('');

  // Filters
  const [isMobile, setIsMobile] = useState<boolean>(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const [filterPriority, setFilterPriority] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [search, setSearch] = useState('');
  const [filterOverdue, setFilterOverdue] = useState(false);
  const [filterEscalated, setFilterEscalated] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768 ? 10 : 50);
  const [kpiViewMode, setKpiViewMode] = useState<'grid' | 'carousel'>('grid');

  const deptOptions = React.useMemo(() => {
    const rawList = (allDepartments && allDepartments.length > 0) ? allDepartments : departments;
    return rawList
      .filter(d => Boolean(d.id && !d.name.toLowerCase().includes('test') && !d.code.toLowerCase().includes('test')))
      .map(d => {
        const code = (d.code || '').toUpperCase().trim();
        const name = (d.name || '').trim();
        const isCS = code === 'CSE(CS)' || code === 'CSE-CS' || name.toLowerCase().includes('cyber');
        const isIoT = code === 'CSE(IOT)' || code === 'CSE-IOT' || name.toLowerCase().includes('iot');
        const isIT = code === 'IT' || name.toLowerCase().includes('information technology');

        let displayLabel = name;
        let shortLabel = code;
        let badgeColor = 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300';

        if (isCS) {
          shortLabel = 'Cyber Security';
          displayLabel = 'Cyber Security — CSE(CS)';
          badgeColor = 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300 border border-rose-300/40';
        } else if (isIoT) {
          shortLabel = 'IoT';
          displayLabel = 'IoT — CSE(IOT)';
          badgeColor = 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300 border border-cyan-300/40';
        } else if (isIT) {
          shortLabel = 'IT';
          displayLabel = 'Information Technology — IT';
          badgeColor = 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 border border-amber-300/40';
        }

        return {
          label: displayLabel,
          value: String(d.id),
          shortLabel,
          icon: <Building2 size={14} />,
          badge: d.code,
          badgeColor
        };
      });
  }, [departments, allDepartments]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const formatYearLevel = (yr: string | undefined | null) => {
    if (!yr) return '';
    const clean = yr.replace(/year/gi, '').trim();
    return clean ? `${clean} Year` : '';
  };

  const formatSignalLabel = (sig: string | undefined | null) => {
    if (!sig) return '—';
    return sig
      .split('_')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  };

  const staffOptions = React.useMemo(() => {
    const set = new Set<string>();
    items.forEach(it => {
      if (it.assigned_faculty_name && it.assigned_faculty_name.trim()) {
        set.add(it.assigned_faculty_name.trim());
      }
    });
    return Array.from(set).sort().map(name => ({
      label: name,
      value: name,
      icon: <User size={14} />
    }));
  }, [items]);

  const visibleItems = React.useMemo(() => {
    if (!filterStaff) return items;
    return items.filter(it => (it.assigned_faculty_name || '').toLowerCase() === filterStaff.toLowerCase());
  }, [items, filterStaff]);

  const toggleSelectStudent = (id: number) => {
    setSelectedStudentIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectTop50 = () => {
    const top50 = visibleItems.slice(0, 50).map(it => it.id);
    setSelectedStudentIds(new Set(top50));
  };

  const handleSelectAll = () => {
    if (selectedStudentIds.size === visibleItems.length && visibleItems.length > 0) {
      setSelectedStudentIds(new Set());
    } else {
      setSelectedStudentIds(new Set(visibleItems.map(it => it.id)));
    }
  };

  const handleClearSelection = () => {
    setSelectedStudentIds(new Set());
  };

  const selectedStudentsList = React.useMemo(() => {
    return items.filter(it => selectedStudentIds.has(it.id));
  }, [items, selectedStudentIds]);

  const handleWhatsApp = (item: FacultyActionItem) => {
    setWhatsAppStudent(item);
  };

  // Sort
  const [sortBy, setSortBy] = useState('priority_score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Active KPI filter key
  const [kpiFilter, setKpiFilter] = useState('');

  // Modals
  const [updateItem, setUpdateItem] = useState<FacultyActionItem | null>(null);
  const [viewItem, setViewItem] = useState<FacultyActionItem | null>(null);

  const { pushContext, popContext, registerEscHandler } = useKeyboardContext();

  useEffect(() => {
    if (updateItem || viewItem) {
      pushContext('MODAL');
      const unregister = registerEscHandler(() => {
        if (updateItem) setUpdateItem(null);
        if (viewItem) setViewItem(null);
      });
      return () => {
        unregister();
        popContext('MODAL');
      };
    }
  }, [updateItem, viewItem, pushContext, popContext, registerEscHandler]);

  // Row expand
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, page_size: pageSize, sort_by: sortBy, sort_dir: sortDir };
      if (filterPriority) params.priority = filterPriority;
      if (filterStatus) params.status = filterStatus;
      if (filterDept) params.dept_id = Number(filterDept);
      if (filterYear) params.year_level = filterYear;
      if (search.trim()) params.search = search.trim();
      if (filterOverdue) params.is_overdue = true;
      if (filterEscalated) params.is_escalated = true;

      const kpiParams: any = {};
      if (filterDept) kpiParams.dept_id = Number(filterDept);
      if (filterYear) kpiParams.year_level = filterYear;
      if (search.trim()) kpiParams.search = search.trim();

      const [kpiRes, listRes] = await Promise.all([
        getFacultyActionKPIs(kpiParams),
        getFacultyActionsList(params)
      ]);
      setKpis(kpiRes);
      setItems(listRes.items);
      setTotalCount(listRes.total_count ?? listRes.total);
      setFilteredCount(listRes.filtered_count ?? listRes.total);
    } catch (err) {
      console.error('Faculty Action Center load failed:', err);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, sortBy, sortDir, filterPriority, filterStatus, filterDept, filterYear, search, filterOverdue, filterEscalated]);

  useEffect(() => { loadData(); }, [loadData]);

  // Pull-to-refresh listener: reload actions list and real-time KPIs
  useEffect(() => {
    const handlePull = () => { loadData(); };
    window.addEventListener('pull_to_refresh', handlePull);
    return () => window.removeEventListener('pull_to_refresh', handlePull);
  }, [loadData]);

  const applyKPIFilter = (key: string, type: 'priority' | 'status' | 'overdue' | 'escalated') => {
    const next = kpiFilter === key ? '' : key;
    setKpiFilter(next);
    
    // Reset all mutual exclusive toggles first
    setFilterPriority('');
    setFilterStatus('');
    setFilterOverdue(false);
    setFilterEscalated(false);

    if (next) {
      if (type === 'priority') setFilterPriority(next);
      else if (type === 'status') setFilterStatus(next);
      else if (type === 'overdue') setFilterOverdue(true);
      else if (type === 'escalated') setFilterEscalated(true);
    }
    setPage(1);
  };

  const handleSync = async () => {
    setSyncing(true); setSyncMsg('');
    try {
      const res = await triggerSignalDetection();
      setSyncMsg(`${res.new_signals_created} new, ${res.existing_signals_updated} updated`);
      await loadData();
    } catch { setSyncMsg('Sync failed'); }
    finally { setSyncing(false); }
  };

  const toggleSort = (col: string) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('desc'); }
  };

  const SortIcon = ({ col }: { col: string }) =>
    sortBy === col
      ? sortDir === 'desc' ? <ChevronDown size={11} className="opacity-60" /> : <ChevronUp size={11} className="opacity-60" />
      : null;

  const totalPages = Math.ceil(filteredCount / pageSize);
  const hasFilters = !!(filterPriority || filterStatus || filterDept || filterYear || search);

  const thCls = "text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 text-left py-3.5 px-3.5 first:pl-5";
  const tdCls = "py-3.5 px-3.5 text-sm first:pl-5";
  const filterSelectCls = "rounded-xl bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-brand-500 transition cursor-pointer";

  return (
    <div className="space-y-6 md:space-y-7 pb-32 sm:pb-16 animate-fade-in font-sans">
      {/* Executive Header Banner (Authoritative Dark OLED Gradient in all modes for crystal-clear readability) */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl p-3.5 sm:p-8 shadow-2xl border border-indigo-500/30 mb-4 sm:mb-6 bg-gradient-to-br from-[#070a14] via-[#0d1424] to-[#121128] text-white">
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-64 h-64 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center px-3.5 py-1 rounded-full bg-brand-500/20 border border-brand-400/30 text-brand-300 text-xs font-black shadow-xs">
              <span>STUDENT INTERVENTION & MENTORING</span>
            </div>

            <h1 className="text-2xl sm:text-3xl xl:text-4xl font-black tracking-tight flex items-center gap-3 text-white drop-shadow-sm">
              <span className="text-white">Faculty</span> <span className="bg-clip-text text-transparent bg-gradient-to-r from-rose-400 via-amber-300 to-brand-300">Action Center</span>
            </h1>

            <p className="text-xs md:text-sm text-slate-200 font-medium leading-relaxed">
              {kpis?.subtitle || 'Real-time student intervention & mentoring management · Detect, Prioritize, Assign, Resolve'}
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {syncMsg && (
              <span className={`text-xs font-bold px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 ${syncMsg.includes('failed') ? 'text-rose-400' : 'text-emerald-400'}`}>
                {syncMsg}
              </span>
            )}
            {isAdmin && (
              <button
                type="button"
                onClick={handleSync}
                disabled={syncing}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-black shadow-glass hover:shadow-indigo-500/25 transition-all duration-300 cursor-pointer disabled:opacity-50 border border-white/10 active:scale-95"
              >
                <RefreshCw size={14} className={syncing ? 'animate-spin text-amber-300' : 'text-amber-300'} />
                <span>{syncing ? 'Resyncing All Data...' : 'Force Sync'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Action Matrix — 4 Compact Stat Boxes (2 per line on mobile, 4 on desktop) */}
      {kpis && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">

          {/* 1. Critical Box */}
          <button
            onClick={() => applyKPIFilter(kpiFilter === 'Critical' ? '' : 'Critical', 'priority')}
            className={`relative flex flex-col justify-between p-3.5 sm:p-4 rounded-2xl border-2 transition-all duration-200 text-left cursor-pointer active:scale-[0.98] shadow-xs hover:shadow-md overflow-hidden ${
              kpiFilter === 'Critical'
                ? 'bg-rose-100/90 dark:bg-rose-950/70 border-rose-500 dark:border-rose-500 ring-2 ring-rose-500/25 shadow-rose-500/10'
                : 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/60 hover:border-rose-400 dark:hover:border-rose-700 hover:bg-rose-100/60'
            }`}
          >
            {kpiFilter === 'Critical' && (
              <div className="absolute left-0 top-2 bottom-2 w-1.5 bg-rose-600 dark:bg-rose-500 rounded-r-full" />
            )}
            <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-rose-700 dark:text-rose-400">
              <ShieldAlert size={14} strokeWidth={2.5} className="shrink-0 text-rose-600 dark:text-rose-400" />
              <span className="truncate">Critical</span>
            </div>
            <div className="text-2xl sm:text-3xl font-black font-mono tabular-nums leading-tight my-1.5 text-rose-600 dark:text-rose-400">
              {kpis.critical_count}
            </div>
            <div className="text-[11px] font-bold text-rose-700/80 dark:text-rose-300/80 truncate">
              Immediate action
            </div>
          </button>

          {/* 2. High Priority Box */}
          <button
            onClick={() => applyKPIFilter(kpiFilter === 'High' ? '' : 'High', 'priority')}
            className={`relative flex flex-col justify-between p-3.5 sm:p-4 rounded-2xl border-2 transition-all duration-200 text-left cursor-pointer active:scale-[0.98] shadow-xs hover:shadow-md overflow-hidden ${
              kpiFilter === 'High'
                ? 'bg-amber-100/90 dark:bg-amber-950/70 border-amber-500 dark:border-amber-500 ring-2 ring-amber-500/25 shadow-amber-500/10'
                : 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/60 hover:border-amber-400 dark:hover:border-amber-700 hover:bg-amber-100/60'
            }`}
          >
            {kpiFilter === 'High' && (
              <div className="absolute left-0 top-2 bottom-2 w-1.5 bg-amber-600 dark:bg-amber-500 rounded-r-full" />
            )}
            <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-400">
              <AlertTriangle size={14} strokeWidth={2.5} className="shrink-0 text-amber-600 dark:text-amber-400" />
              <span className="truncate">High Priority</span>
            </div>
            <div className="text-2xl sm:text-3xl font-black font-mono tabular-nums leading-tight my-1.5 text-amber-600 dark:text-amber-400">
              {kpis.high_count}
            </div>
            <div className="text-[11px] font-bold text-amber-800/80 dark:text-amber-300/80 truncate">
              Urgent review
            </div>
          </button>

          {/* 3. Active Mentoring Box */}
          <button
            onClick={() => applyKPIFilter(kpiFilter === 'In Progress' ? '' : 'In Progress', 'status')}
            className={`relative flex flex-col justify-between p-3.5 sm:p-4 rounded-2xl border-2 transition-all duration-200 text-left cursor-pointer active:scale-[0.98] shadow-xs hover:shadow-md overflow-hidden ${
              kpiFilter === 'In Progress'
                ? 'bg-blue-100/90 dark:bg-blue-950/70 border-blue-500 dark:border-blue-500 ring-2 ring-blue-500/25 shadow-blue-500/10'
                : 'bg-blue-50/80 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/60 hover:border-blue-400 dark:hover:border-blue-700 hover:bg-blue-100/60'
            }`}
          >
            {kpiFilter === 'In Progress' && (
              <div className="absolute left-0 top-2 bottom-2 w-1.5 bg-blue-600 dark:bg-blue-500 rounded-r-full" />
            )}
            <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-400">
              <Clock size={14} strokeWidth={2.5} className="shrink-0 text-blue-600 dark:text-blue-400" />
              <span className="truncate">Active Mentoring</span>
            </div>
            <div className="text-2xl sm:text-3xl font-black font-mono tabular-nums leading-tight my-1.5 text-blue-600 dark:text-blue-400">
              {kpis.in_progress_count + kpis.monitoring_count}
            </div>
            <div className="text-[11px] font-bold text-blue-700/80 dark:text-blue-300/80 truncate">
              {kpis.in_progress_count} Active &middot; {kpis.monitoring_count} Watch
            </div>
          </button>

          {/* 4. Target Achieved Box */}
          <button
            onClick={() => applyKPIFilter(kpiFilter === 'Resolved' ? '' : 'Resolved', 'status')}
            className={`relative flex flex-col justify-between p-3.5 sm:p-4 rounded-2xl border-2 transition-all duration-200 text-left cursor-pointer active:scale-[0.98] shadow-xs hover:shadow-md overflow-hidden ${
              kpiFilter === 'Resolved'
                ? 'bg-emerald-100/90 dark:bg-emerald-950/70 border-emerald-500 dark:border-emerald-500 ring-2 ring-emerald-500/25 shadow-emerald-500/10'
                : 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/60 hover:border-emerald-400 dark:hover:border-emerald-700 hover:bg-emerald-100/60'
            }`}
          >
            {kpiFilter === 'Resolved' && (
              <div className="absolute left-0 top-2 bottom-2 w-1.5 bg-emerald-600 dark:bg-emerald-500 rounded-r-full" />
            )}
            <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 size={14} strokeWidth={2.5} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span className="truncate">Target Achieved</span>
            </div>
            <div className="text-2xl sm:text-3xl font-black font-mono tabular-nums leading-tight my-1.5 text-emerald-600 dark:text-emerald-400">
              {kpis.resolved_count}
            </div>
            <div className="text-[11px] font-bold text-emerald-700/80 dark:text-emerald-300/80 truncate">
              Mentees on-track ✓
            </div>
          </button>

        </div>
      )}

            {/* Filters Container - Fully styled for clean dark theme */}
      <div className="relative z-20 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 sm:gap-4 p-3.5 sm:p-4 rounded-3xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 shadow-md backdrop-blur-xl mb-6">
        {/* Search Bar Input */}
        <div className="relative group flex-1 min-w-[200px] w-full md:w-auto">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-brand-500 rounded-2xl md:rounded-full blur opacity-15 group-focus-within:opacity-60 transition duration-500"></div>
          <div className="relative flex items-center gap-2.5 bg-slate-50 dark:bg-navy-950 rounded-2xl md:rounded-full px-4 py-2 sm:py-2.5 border border-slate-300 dark:border-navy-700/80 focus-within:border-indigo-500 shadow-xs">
            <Search size={16} className="text-slate-400 group-focus-within:text-indigo-600 transition-colors shrink-0" />
            <input
              value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by name, reg no, username..."
              className="flex-1 bg-transparent border-none focus:ring-0 focus:border-transparent focus:outline-none !outline-none !ring-0 !border-none text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 placeholder:text-slate-400 placeholder:font-medium p-0 m-0"
            />
            {search && (
              <button aria-label="Clear search" title="Clear search" onClick={() => { setSearch(''); setPage(1); }} className="text-slate-400 hover:text-rose-500 transition-colors p-1 rounded-full hover:bg-slate-100 dark:hover:bg-navy-800">
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Dropdown Filters (Flex container with adequate spacing) */}
        <div className="grid grid-cols-2 md:flex md:flex-row items-stretch md:items-center gap-2.5 sm:gap-3 w-full md:w-auto shrink-0">
          <div className="col-span-1 min-w-0 w-full md:w-auto shrink-0">
          <CustomSelect
            value={filterPriority}
            onChange={v => { 
              setFilterPriority(v); 
              setFilterStatus('');
              setFilterOverdue(false);
              setFilterEscalated(false);
              setKpiFilter(v); 
              setPage(1); 
            }}
            placeholder="All Priorities"
            icon={<ShieldAlert size={15} />}
            options={[
              { label: 'Critical', value: 'Critical', icon: <ShieldAlert size={14} />, badge: 'P1', badgeColor: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' },
              { label: 'High', value: 'High', icon: <AlertTriangle size={14} />, badge: 'P2', badgeColor: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300' },
              { label: 'Medium', value: 'Medium', icon: <Clock size={14} />, badge: 'P3', badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300' },
              { label: 'Low', value: 'Low', icon: <Activity size={14} />, badge: 'P4', badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' }
            ]}
          />
          </div>
          
          <div className="col-span-1 min-w-0 w-full md:w-auto shrink-0">
          <CustomSelect
            value={filterStatus}
            onChange={v => { 
              setFilterStatus(v); 
              setFilterPriority('');
              setFilterOverdue(false);
              setFilterEscalated(false);
              setKpiFilter(v);
              setPage(1); 
            }}
            placeholder="All Statuses"
            icon={<Activity size={15} />}
            options={[
              { label: 'Pending', value: 'Pending', icon: <Clock size={14} />, badge: 'PEN', badgeColor: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
              { label: 'In Progress', value: 'In Progress', icon: <RotateCcw size={14} />, badge: 'INP', badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' },
              { label: 'Monitoring', value: 'Monitoring', icon: <Activity size={14} />, badge: 'MON', badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300' },
              { label: 'Completed', value: 'Completed', icon: <CheckCircle2 size={14} />, badge: 'COM', badgeColor: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300' },
              { label: 'Resolved', value: 'Resolved', icon: <CheckCircle2 size={14} />, badge: 'RES', badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' }
            ]}
          />
          </div>

          {canFilterDepts && (
            <div className="col-span-1 min-w-0 w-full md:w-auto shrink-0">
              <CustomSelect
                value={filterDept}
                onChange={v => { setFilterDept(v); setPage(1); }}
                placeholder="All Departments"
                icon={<Building2 size={15} />}
                options={deptOptions}
              />
            </div>
          )}

          <div className="col-span-1 min-w-0 w-full md:w-auto shrink-0">
          <CustomSelect
            value={filterYear}
            onChange={v => { setFilterYear(v); setPage(1); }}
            placeholder="All Years"
            icon={<GraduationCap size={15} />}
            alignRight={true}
            options={[
              { label: 'I Year', value: 'I Year', icon: <User size={14} />, badge: 'Y1', badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' },
              { label: 'II Year', value: 'II Year', icon: <User size={14} />, badge: 'Y2', badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' },
              { label: 'III Year', value: 'III Year', icon: <User size={14} />, badge: 'Y3', badgeColor: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300' },
              { label: 'IV Year', value: 'IV Year', icon: <User size={14} />, badge: 'Y4', badgeColor: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300' }
            ]}
          />
          </div>

          {staffOptions.length > 0 && (
            <div className="col-span-1 min-w-0 w-full md:w-auto shrink-0">
              <CustomSelect
                value={filterStaff}
                onChange={v => { setFilterStaff(v); setPage(1); }}
                placeholder="All Staff Mentors"
                icon={<User size={15} />}
                alignRight={true}
                options={staffOptions}
              />
            </div>
          )}
        </div>

        {/* Count & Page Size Toggle */}
        <div className="w-full flex items-center justify-between gap-3 pt-3 border-t border-slate-200/80 dark:border-navy-800">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300 truncate">
              {filteredCount === totalCount ? (
                `Showing ${totalCount} action items`
              ) : (
                `Showing ${filteredCount} of ${totalCount} action items`
              )}
            </span>
            {(hasFilters || kpiFilter) && (
               <button onClick={() => { setFilterPriority(''); setFilterStatus(''); setFilterDept(''); setFilterYear(''); setFilterStaff(''); setSearch(''); setFilterOverdue(false); setFilterEscalated(false); setKpiFilter(''); setPage(1); }}
                 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 transition flex items-center gap-0.5 ml-1 shrink-0 cursor-pointer">
                 <X size={14} /> Clear
               </button>
            )}
          </div>
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-navy-950 p-1 rounded-xl border border-slate-200 dark:border-navy-800 shrink-0">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 px-1 font-mono">Show:</span>
            {(isMobile ? [10, 25, 50] : [20, 50, 100, 200]).map((sz) => (
              <button
                key={sz}
                onClick={() => { setPageSize(sz); setPage(1); }}
                className={`px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  pageSize === sz
                    ? 'bg-indigo-600 text-white shadow-xs font-black'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {sz}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table Loading State */}
      {loading ? (
        <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 rounded-3xl p-4 sm:p-6 space-y-4 shadow-sm animate-pulse">
          {/* Top Status & Shimmer Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 pb-4 border-b border-slate-100 dark:border-navy-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center border border-brand-500/20 shrink-0">
                <Activity className="w-4 h-4 text-brand-500" />
              </div>
              <div>
                <div className="h-4 w-40 sm:w-48 bg-slate-200 dark:bg-navy-700 rounded-lg"></div>
                <div className="h-3 w-28 sm:w-32 bg-slate-100 dark:bg-navy-800 rounded mt-1.5"></div>
              </div>
            </div>
            <div className="flex items-center gap-2 max-w-full">
              <span className="inline-flex items-center px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-bold bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-800/50 max-w-full truncate">
                <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5 text-brand-500 shrink-0" />
                <span className="truncate">Aggregating Intervention Queue...</span>
              </span>
            </div>
          </div>

          {/* Skeleton Table Rows */}
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((idx) => (
              <div
                key={idx}
                className="p-4 rounded-2xl bg-slate-50/70 dark:bg-navy-950/50 border border-slate-100 dark:border-navy-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-navy-700 flex-shrink-0"></div>
                  <div className="space-y-2">
                    <div className="h-4 w-36 sm:w-48 bg-slate-200 dark:bg-navy-700 rounded"></div>
                    <div className="h-3 w-24 sm:w-32 bg-slate-200/60 dark:bg-navy-800 rounded"></div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-6 w-20 bg-slate-200 dark:bg-navy-700 rounded-lg"></div>
                  <div className="h-6 w-24 bg-slate-200 dark:bg-navy-700 rounded-lg hidden sm:block"></div>
                  <div className="h-8 w-28 bg-brand-500/20 dark:bg-brand-500/30 rounded-xl"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="relative overflow-hidden rounded-3xl bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 p-8 sm:p-12 text-center shadow-sm transition-all duration-300">

          <div className="relative z-10 max-w-md mx-auto flex flex-col items-center">
            {/* Static status icon */}
            <div className="relative mb-6">
              <div className="relative w-24 h-24 rounded-3xl bg-slate-100 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 flex items-center justify-center overflow-hidden">
                 {hasFilters || kpiFilter ? (
                    <Search className="w-10 h-10 text-slate-400 dark:text-slate-300 relative z-10" />
                  ) : (
                    <CheckCircle2 className="w-12 h-12 text-emerald-500 dark:text-emerald-400 relative z-10" />
                  )}
              </div>
            </div>

            {/* Pill Status Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-black uppercase tracking-widest mb-4 shadow-sm">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{hasFilters || kpiFilter ? 'Filter Scope Active' : 'Institutional Status: Optimal'}</span>
            </div>

            {/* Title */}
            <h3 className="font-display text-2xl sm:text-3xl font-black text-slate-800 dark:text-white tracking-tight mb-3">
              {hasFilters || kpiFilter ? 'No Matching Students Found' : 'All Students Operating at Target Health'}
            </h3>

            {/* Description */}
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed mb-8 max-w-sm">
              {hasFilters || kpiFilter
                ? 'No student intervention records matched your currently selected department, academic year, priority, or KPI filters.'
                : 'Zero critical risk warnings or pending intervention requests detected across all tracked engineering profiles.'}
            </p>

            {/* Interactive Action Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3 w-full">
              {(hasFilters || kpiFilter) ? (
                <button
                  onClick={() => {
                    setFilterPriority('');
                    setFilterStatus('');
                    setFilterDept('');
                    setFilterYear('');
                    setSearch('');
                    setKpiFilter(null);
                  }}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 w-full sm:w-auto rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-black text-xs shadow-lg shadow-brand-500/30 transition-all cursor-pointer active:scale-95"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset All Filters
                </button>
              ) : (
                <button
                  onClick={() => loadData()}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 w-full sm:w-auto rounded-xl bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-500/20 dark:hover:bg-emerald-500/30 border border-emerald-300 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-extrabold text-xs transition-all cursor-pointer shadow-sm hover:shadow-md active:scale-95"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh Intelligence Signals
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Bulk Action & Outreach Toolbar — Native Clean Mobile Bar */}
          <div className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 shadow-xs mb-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleSelectAll}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-navy-800 dark:hover:bg-navy-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer border border-slate-200/80 dark:border-navy-700 active:scale-95 touch-manipulation"
              >
                {selectedStudentIds.size === visibleItems.length && visibleItems.length > 0 ? (
                  <>
                    <CheckSquare size={15} className="text-emerald-600 dark:text-emerald-400" />
                    <span>Deselect All</span>
                  </>
                ) : (
                  <>
                    <Square size={15} className="text-slate-400" />
                    <span>Select All ({visibleItems.length})</span>
                  </>
                )}
              </button>

              {selectedStudentIds.size > 0 && (
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 text-xs font-bold transition-all cursor-pointer border border-rose-200 dark:border-rose-800/80 active:scale-95 touch-manipulation"
                >
                  <X size={14} />
                  <span>Clear</span>
                </button>
              )}

              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-1">
                <strong className="text-emerald-600 dark:text-emerald-400 font-mono font-black">{selectedStudentIds.size}</strong> of {visibleItems.length} selected
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (selectedStudentIds.size === 0) {
                    handleSelectAll();
                  }
                  setShowBulkWhatsAppModal(true);
                }}
                className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer shadow-sm active:scale-95 touch-manipulation ${
                  selectedStudentIds.size > 0
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white ring-2 ring-emerald-500/30 shadow-emerald-600/20'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                <MessageCircle size={16} className="stroke-[2.5]" />
                <span>
                  {selectedStudentIds.size > 0
                    ? `Send Bulk WhatsApp (${selectedStudentIds.size})`
                    : `Send Bulk WhatsApp (${visibleItems.length})`}
                </span>
              </button>
            </div>
          </div>

          {/* Mobile Intervention Cards (Native iOS/Android App Quality Cards) */}
          <div className="block md:hidden space-y-3 mt-2 pb-24">
            {visibleItems.map((item) => {
              const statusCls = STATUS_CONFIG[item.status] || 'bg-slate-100 text-slate-600 border border-slate-200';
              const isSelected = selectedStudentIds.has(item.id);
              const initials = (item.student_name || 'S')
                .split(' ')
                .map(w => w[0])
                .filter(Boolean)
                .slice(0, 2)
                .join('')
                .toUpperCase();

              return (
                <div
                  key={item.id}
                  className={`rounded-2xl transition-all duration-200 p-3.5 space-y-3 border touch-manipulation ${
                    isSelected
                      ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-500 ring-2 ring-emerald-500/20 shadow-sm'
                      : 'bg-white dark:bg-navy-900 border-slate-200/90 dark:border-navy-800 shadow-2xs hover:border-slate-300'
                  }`}
                >
                  {/* Card Header: Checkbox + Avatar + Name & RegNo + Priority & Status */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      {/* Checkbox Touch Target */}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); toggleSelectStudent(item.id); }}
                        className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-all cursor-pointer shrink-0 mt-0.5 touch-manipulation active:scale-90 ${
                          isSelected
                            ? 'bg-emerald-500 text-white border-emerald-600 shadow-xs'
                            : 'bg-slate-50 dark:bg-navy-800 text-slate-400 border-slate-300 dark:border-navy-700 hover:text-slate-600'
                        }`}
                        aria-label={isSelected ? "Deselect student" : "Select student for bulk outreach"}
                      >
                        {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                      </button>

                      {/* Student Avatar */}
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                        {initials}
                      </div>

                      {/* Name & Metadata */}
                      <div className="min-w-0 flex-1">
                        <h4 className="font-black text-sm text-slate-900 dark:text-white truncate tracking-tight">
                          {item.student_name}
                        </h4>
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          <span className="font-mono text-slate-700 dark:text-slate-300">{item.reg_no}</span>
                          <span>&bull;</span>
                          <span className="text-brand-600 dark:text-brand-400">{item.department_code}</span>
                          <span>&bull;</span>
                          <span>{formatYearLevel(item.year_level)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Status & Priority Pills */}
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <PriorityBadge priority={item.priority} score={item.priority_score} reason={item.priority_score_reason} />
                      <span className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full ${statusCls}`}>
                        {item.status}
                      </span>
                    </div>
                  </div>

                  {/* Signal Alert Banner (Why this student needs intervention) */}
                  <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/50 text-xs">
                    <div className="flex items-center gap-1.5 min-w-0 text-amber-800 dark:text-amber-300 font-bold text-[11.5px] truncate">
                      <AlertTriangle size={13} className="text-amber-600 shrink-0" />
                      <span className="truncate">{formatSignalLabel(item.signal_type)}</span>
                    </div>
                    {item.is_escalated && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 shrink-0">
                        Escalated
                      </span>
                    )}
                  </div>

                  {/* Coding Metrics Capsule Row */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-navy-950/60 border border-slate-100 dark:border-navy-800">
                      <div className="text-[9.5px] uppercase font-bold text-slate-400">Solved</div>
                      <div className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-xs mt-0.5">
                        {item.total_solved}
                      </div>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-navy-950/60 border border-slate-100 dark:border-navy-800">
                      <div className="text-[9.5px] uppercase font-bold text-slate-400">Rating</div>
                      <div className="font-mono font-black text-indigo-600 dark:text-indigo-400 text-xs mt-0.5">
                        {Math.round(Number(item.current_rating || 0))}
                      </div>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-navy-950/60 border border-slate-100 dark:border-navy-800">
                      <div className="text-[9.5px] uppercase font-bold text-slate-400">Breakdown</div>
                      <div className="font-mono font-bold text-[10px] mt-0.5 truncate">
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">{item.easy_solved || 0}</span>
                        <span className="text-slate-300 dark:text-slate-600">/</span>
                        <span className="text-amber-600 dark:text-amber-400 font-bold">{item.medium_solved || 0}</span>
                        <span className="text-slate-300 dark:text-slate-600">/</span>
                        <span className="text-rose-600 dark:text-rose-400 font-bold">{item.hard_solved || 0}</span>
                      </div>
                    </div>
                  </div>

                  {/* Mentor Row */}
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-0.5">
                    <div className="flex items-center gap-1.5 truncate">
                      <User size={12} className="text-slate-400 shrink-0" />
                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate">
                        Mentor: {item.assigned_faculty_name || 'Unassigned'}
                      </span>
                    </div>
                    {item.recommended_action && (
                      <span className="text-[10.5px] font-medium text-slate-400 truncate max-w-[45%]">
                        {item.recommended_action}
                      </span>
                    )}
                  </div>

                  {/* Action Buttons Row — 3 Touch-Friendly Actions */}
                  <div className="grid grid-cols-12 gap-2 pt-1 border-t border-slate-100 dark:border-navy-800">
                    <button
                      type="button"
                      onClick={() => handleWhatsApp(item)}
                      title="Send WhatsApp Nudge"
                      className="col-span-5 min-h-[42px] py-2 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs touch-manipulation transition-all"
                    >
                      <MessageCircle size={15} className="stroke-[2.5]" />
                      <span>WhatsApp</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setUpdateItem(item)}
                      className="col-span-5 min-h-[42px] py-2 px-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs touch-manipulation transition-all"
                    >
                      <ArrowUpRight size={14} className="stroke-[2.5]" />
                      <span>Action</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setViewItem(item)}
                      title="View Coding Profile"
                      className="col-span-2 min-h-[42px] py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-navy-800 dark:hover:bg-navy-700 active:scale-95 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-navy-700 flex items-center justify-center cursor-pointer touch-manipulation transition-all"
                    >
                      <Eye size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="hidden md:block table-responsive-container rounded-2xl glass-panel shadow-glass border-white/[0.08] overflow-x-auto mt-6">
            <table className="w-full table-fixed min-w-[1150px]">
              <colgroup>
                <col style={{ width: '4%' }} />
                <col style={{ width: '23%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '10%' }} />
              </colgroup>
              <thead className="table-header-group border-b border-white/[0.08] bg-white/[0.03]">
                <tr>
                  <th className={`${thCls} !w-10 !px-3 select-none text-center`}>
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="p-1 rounded-lg text-slate-400 hover:text-emerald-500 transition cursor-pointer"
                      title="Select all visible students"
                    >
                      {selectedStudentIds.size === visibleItems.length && visibleItems.length > 0 ? (
                        <CheckSquare size={16} className="text-emerald-500" />
                      ) : (
                        <Square size={16} />
                      )}
                    </button>
                  </th>
                  {[['Student', 'student_name'], ['Priority', 'priority_score'], ['Stats', ''], ['Signal', ''], ['Status', 'status'], ['Faculty', ''], ['Breakdown', ''], ['Actions', '']].map(([label, col]) => (
                    <th key={label} className={`${thCls} ${col ? 'cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 select-none' : ''}`} onClick={() => col && toggleSort(col)}>
                      <span className="inline-flex items-center gap-1">{label} {col && <SortIcon col={col} />}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-navy-700/60">
                {visibleItems.map((item) => {
                  const statusCls = STATUS_CONFIG[item.status] || 'bg-slate-100 text-slate-600 border border-slate-200';
                  const isExpanded = expandedRow === item.id;
                  return (
                    <React.Fragment key={item.id}>
                      <tr
                        onClick={() => setExpandedRow(isExpanded ? null : item.id)}
                        className={`cursor-pointer transition-colors ${isExpanded ? 'bg-indigo-50/30 dark:bg-navy-800/80' : 'hover:bg-slate-50/70 dark:hover:bg-navy-700/40'}`}
                      >
                        {/* Checkbox */}
                        <td className={`${tdCls} !w-10 !px-3 text-center`} onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => toggleSelectStudent(item.id)}
                            className={`p-1 rounded-lg border transition cursor-pointer ${
                              selectedStudentIds.has(item.id)
                                ? 'bg-emerald-500 text-white border-emerald-600'
                                : 'bg-slate-100 dark:bg-navy-800 text-slate-400 border-slate-200 dark:border-navy-700 hover:text-slate-600'
                            }`}
                          >
                            {selectedStudentIds.has(item.id) ? <CheckSquare size={15} /> : <Square size={15} />}
                          </button>
                        </td>

                        {/* Student */}
                        <td className={tdCls}>
                          <div className="font-bold text-sm text-slate-800 dark:text-white truncate">{item.student_name}</div>
                          <div className="text-[11.5px] font-bold text-slate-600 dark:text-slate-400 truncate mt-0.5">
                            <span className="font-mono text-slate-700 dark:text-slate-300">{item.reg_no}</span> · {item.department_code} · {formatYearLevel(item.year_level)}
                          </div>
                        </td>

                        {/* Priority */}
                        <td className={tdCls} onClick={e => e.stopPropagation()}>
                          <PriorityBadge priority={item.priority} score={item.priority_score} reason={item.priority_score_reason} />
                        </td>

                        {/* Stats */}
                        <td className={tdCls}>
                          <div className="text-xs space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] text-slate-700 dark:text-slate-300 font-bold">Rating:</span>
                              <span className="font-black text-slate-900 dark:text-white font-mono text-[11.5px]">{Math.round(Number(item.current_rating || 0))}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] text-slate-700 dark:text-slate-300 font-bold">Solved:</span>
                              <span className="font-black text-slate-900 dark:text-white font-mono text-[11.5px]">{item.total_solved || 0}</span>
                            </div>
                          </div>
                        </td>

                        {/* Signal */}
                        <td className={tdCls}>
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100/90 dark:bg-navy-900 border border-slate-200/80 dark:border-navy-700 text-xs font-semibold text-slate-700 dark:text-slate-300">
                            <Activity size={12} className="text-brand-500 shrink-0" />
                            <span className="truncate max-w-[160px]">{formatSignalLabel(item.signal_type)}</span>
                          </div>
                          <div className="flex gap-1.5 flex-wrap mt-1">
                            {item.is_escalated && <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-bold">ESC</span>}
                            {item.is_overdue_followup && <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-bold">{item.days_overdue}d overdue</span>}
                          </div>
                        </td>

                        {/* Status */}
                        <td className={tdCls}>
                          <span className={`text-[11px] font-bold px-3 py-1 rounded-full whitespace-nowrap ${statusCls}`}>{item.status}</span>
                        </td>

                        {/* Faculty */}
                        <td className={tdCls}>
                          <div className="flex items-center gap-1.5 text-xs text-slate-900 dark:text-white font-bold truncate">
                            <User size={12} className="text-slate-600 dark:text-slate-400 shrink-0" />
                            <span className="truncate">{item.assigned_faculty_name || 'Unassigned'}</span>
                          </div>
                        </td>

                        {/* Due Date */}
                        <td className={tdCls}>
                          <div className="flex items-center gap-1 font-mono text-[11px] font-bold">
                            <span className="text-emerald-500">E:{item.easy_solved || 0}</span>
                            <span className="text-slate-400">·</span>
                            <span className="text-amber-500">M:{item.medium_solved || 0}</span>
                            <span className="text-slate-400">·</span>
                            <span className="text-rose-500">H:{item.hard_solved || 0}</span>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className={tdCls} onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => setUpdateItem(item)}
                              title="Take Action on Student"
                              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white transition-all cursor-pointer shadow-sm hover:shadow flex items-center gap-1.5 text-xs font-bold active:scale-95"
                            >
                              <ArrowUpRight size={12} />
                              <span>Take Action</span>
                            </button>
                            <button
                              onClick={() => handleWhatsApp(item)}
                              title="Send WhatsApp Nudge"
                              className="p-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 transition cursor-pointer"
                            >
                              <MessageCircle size={14} />
                            </button>
                            <button
                              onClick={() => setViewItem(item)}
                              title="View Student Coding Profile"
                              className="p-1.5 rounded-xl bg-slate-100 dark:bg-navy-700 hover:bg-slate-200 dark:hover:bg-navy-600 text-slate-600 dark:text-slate-300 transition cursor-pointer"
                            >
                              <Eye size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded detail row */}
                      {isExpanded && (
                        <tr className="bg-brand-500/5 dark:bg-navy-950/60">
                          <td colSpan={9} className="px-5 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
                              <div>
                                <div className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">Recommended Action</div>
                                <div className="text-xs text-brand-600 dark:text-brand-400 font-bold">{item.recommended_action || '—'}</div>
                              </div>
                              <div>
                                <div className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">Action Taken</div>
                                <div className="text-xs text-slate-700 dark:text-slate-300">{item.action_taken || 'No action recorded yet'}</div>
                              </div>
                              <div>
                                <div className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">Faculty Notes</div>
                                <div className="text-xs text-slate-700 dark:text-slate-300">{item.faculty_notes || 'No private notes'}</div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => setUpdateItem(item)}
                                  className="px-3.5 py-2 rounded-xl bg-violet-500/15 border border-violet-500/30 text-violet-600 dark:text-violet-400 text-xs font-black hover:bg-violet-500/25 transition flex items-center gap-1.5 cursor-pointer"
                                >
                                  <FileText size={13} /> Update & Follow-up
                                </button>
                                <button
                                  onClick={() => setViewItem(item)}
                                  className="px-3 py-2 rounded-xl bg-brand-500/15 border border-brand-500/30 text-brand-600 dark:text-brand-400 text-xs font-black hover:bg-brand-500/25 transition flex items-center gap-1.5 cursor-pointer"
                                >
                                  <Eye size={13} /> Full Profile
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-4 py-2 rounded-xl bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-sm font-semibold text-slate-600 dark:text-slate-300 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-navy-700 transition">
            ← Prev
          </button>
          <span className="text-sm text-slate-500 dark:text-navy-400">Page {page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="px-4 py-2 rounded-xl bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-sm font-semibold text-slate-600 dark:text-slate-300 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-navy-700 transition">
            Next →
          </button>
        </div>
      )}

      {/* Modals */}
      {updateItem && <UpdateModal item={updateItem} onClose={() => setUpdateItem(null)} onSaved={loadData} />}
      {viewItem && <StudentViewModal item={viewItem} onClose={() => setViewItem(null)} onOpenUpdate={() => setUpdateItem(viewItem)} />}

      {/* Single Student WhatsApp Mentoring Modal (10 Message Templates & Custom Edit) */}
      {whatsAppStudent && (
        <StudentWhatsAppModal
          isOpen={!!whatsAppStudent}
          onClose={() => setWhatsAppStudent(null)}
          student={whatsAppStudent}
        />
      )}

      {/* Bulk WhatsApp Outreach Modal */}
      {showBulkWhatsAppModal && (
        <BulkWhatsAppModal
          isOpen={showBulkWhatsAppModal}
          onClose={() => setShowBulkWhatsAppModal(false)}
          selectedStudents={selectedStudentsList.length > 0 ? selectedStudentsList : visibleItems.slice(0, 50)}
        />
      )}
    </div>
  );
};

export default FacultyActionCenter;

