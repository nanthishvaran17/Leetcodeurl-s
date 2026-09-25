import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  ShieldAlert, AlertTriangle, CheckCircle2, Clock, Search, RefreshCw,
  ChevronDown, ChevronUp, X, Send, Activity, User, Check, Building2, GraduationCap,
  Calendar, Zap, FileText, ArrowUpRight, Bell, RotateCcw, Eye, Sparkles, Award
} from 'lucide-react';
import {
  getFacultyActionKPIs, getFacultyActionsList, updateFacultyAction,
  escalateAction, getActionTimeline, triggerSignalDetection,
  FacultyActionKPIs, FacultyActionItem, ActionTimelineEvent, UpdateActionPayload
} from '../services/intelligenceService';
import { IDCardGenerator } from '../components/IDCardGenerator';
import { StudentCodingProfileView } from '../components/StudentCodingProfileView';
import { GlobalFilter } from '../components/GlobalFilter';
import { useKeyboardContext } from '../context/KeyboardContext';

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

// Custom Dropdown Select 
const CustomSelect: React.FC<{
  value: string;
  onChange: (v: string) => void;
  options: { label: string; value: string; icon?: React.ReactNode; badge?: string; badgeColor?: string }[];
  placeholder: string;
  icon?: React.ReactNode;
}> = ({ value, onChange, options, placeholder, icon }) => {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClick);
    }
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center justify-between gap-3 min-w-[200px] px-4 py-2.5 rounded-xl border transition-all cursor-pointer font-bold text-sm shadow-xs ${
          open 
            ? 'border-indigo-500 bg-white dark:bg-navy-950 ring-4 ring-indigo-500/10' 
            : value 
              ? 'border-indigo-300 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200' 
              : 'border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-950 text-slate-800 dark:text-slate-200 hover:border-slate-400'
        }`}
      >
        <div className="flex items-center gap-2">
          <span className={value ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}>{icon || selected?.icon}</span>
          <div className="flex items-center gap-2">
            {selected?.badge && (
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${selected.badgeColor || 'bg-slate-100 text-slate-600'}`}>
                {selected.badge}
              </span>
            )}
            <span>{selected ? selected.label : placeholder}</span>
          </div>
        </div>
        <ChevronDown size={14} className={`transition-transform duration-300 ${open ? 'rotate-180 text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
      </button>

      {open && (
        <div className="absolute z-50 top-[110%] left-0 w-full min-w-[280px] p-1.5 rounded-2xl bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 shadow-xl animate-fade-in-up">
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
}> = ({ label, value, colorTheme, icon, active, onClick, subtitle }) => {
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
      activeRing: 'ring-2 ring-red-500 border-red-500 shadow-md shadow-red-500/15 bg-red-100/70 dark:bg-red-950/50',
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
      activeRing: 'ring-2 ring-orange-500 border-orange-500 shadow-md shadow-orange-500/15 bg-orange-100/70 dark:bg-orange-950/50',
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
      activeRing: 'ring-2 ring-amber-500 border-amber-500 shadow-md shadow-amber-500/15 bg-amber-100/70 dark:bg-amber-950/50',
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
      activeRing: 'ring-2 ring-blue-500 border-blue-500 shadow-md shadow-blue-500/15 bg-blue-100/70 dark:bg-blue-950/50',
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
      activeRing: 'ring-2 ring-cyan-500 border-cyan-500 shadow-md shadow-cyan-500/15 bg-cyan-100/70 dark:bg-cyan-950/50',
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
      activeRing: 'ring-2 ring-emerald-500 border-emerald-500 shadow-md shadow-emerald-500/15 bg-emerald-100/70 dark:bg-emerald-950/50',
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
      activeRing: 'ring-2 ring-rose-500 border-rose-500 shadow-md shadow-rose-500/15 bg-rose-100/70 dark:bg-rose-950/50',
      iconBg: 'bg-rose-100 dark:bg-rose-900/60',
      iconText: 'text-rose-600 dark:text-rose-400',
      numText: 'text-rose-700 dark:text-rose-300',
      labelText: 'text-rose-900 dark:text-rose-200',
      subText: 'text-rose-600/80 dark:text-rose-400/80',
      hoverBorder: 'hover:border-rose-400 dark:hover:border-rose-500/60'
    },
    violet: {
      cardBg: 'bg-purple-50/70 dark:bg-purple-950/30',
      cardBorder: 'border-purple-200 dark:border-purple-900/50',
      activeRing: 'ring-2 ring-purple-500 border-purple-500 shadow-md shadow-purple-500/15 bg-purple-100/70 dark:bg-purple-950/50',
      iconBg: 'bg-purple-100 dark:bg-purple-900/60',
      iconText: 'text-purple-600 dark:text-purple-400',
      numText: 'text-purple-700 dark:text-purple-300',
      labelText: 'text-purple-900 dark:text-purple-200',
      subText: 'text-purple-600/80 dark:text-purple-400/80',
      hoverBorder: 'hover:border-purple-400 dark:hover:border-purple-500/60'
    }
  };
  const theme = themes[colorTheme] || themes['blue'];

  return (
    <button
      onClick={onClick}
      className={`flex-1 min-w-[130px] sm:min-w-[145px] text-left rounded-2xl p-4 border transition-all duration-300 transform hover:-translate-y-0.5 cursor-pointer relative overflow-hidden group shadow-xs ${
        theme.cardBg
      } ${
        active
          ? theme.activeRing
          : `${theme.cardBorder} ${theme.hoverBorder}`
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          <span className={`p-1.5 rounded-xl ${theme.iconBg} ${theme.iconText} transition-colors shrink-0 shadow-xs`}>
            {icon}
          </span>
          <span className={`text-[11px] font-black uppercase tracking-wider ${theme.labelText} transition-colors truncate`}>
            {label}
          </span>
        </div>
        {active && <span className="w-2.5 h-2.5 rounded-full bg-current animate-ping opacity-75 shrink-0" />}
      </div>
      <div className={`text-3xl font-black tracking-tight leading-none ${theme.numText}`}>
        {value}
      </div>
      {subtitle ? (
        <div className={`text-[10.5px] font-extrabold mt-2.5 truncate ${theme.subText}`}>
          {subtitle}
        </div>
      ) : (
        <div className="h-4 mt-2.5" />
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
      .then(e => { setEvents(e); setTimelineLoading(false); })
      .catch(() => setTimelineLoading(false));
  }, [item.id]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 overflow-y-auto animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl bg-slate-900 border border-slate-700 shadow-lg overflow-hidden my-auto text-white">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between flex-wrap gap-3 bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-500 to-indigo-600 flex items-center justify-center font-black text-xl text-white shadow-lg shadow-brand-500/25">
              {item.student_name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-xl font-black text-white">{item.student_name}</h3>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-brand-500/20 text-brand-400 border border-brand-500/30">
                  {item.year_level} Year
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                {item.reg_no} · {item.department_name} ({item.department_code}) · <span className="text-brand-400">@{item.leetcode_username}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenUpdate && (
              <button
                onClick={() => { onClose(); onOpenUpdate(); }}
                className="px-3.5 py-1.5 rounded-xl bg-brand-500/20 border border-brand-500/40 text-brand-300 text-xs font-bold hover:bg-brand-500/30 transition flex items-center gap-1.5 cursor-pointer"
              >
                <FileText size={12} /> Edit Action
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
              title="Close modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 px-5 py-2.5 bg-slate-950/40 border-b border-slate-800/80 shrink-0">
          <button
            onClick={() => setActiveViewTab('pass')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeViewTab === 'pass'
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Award size={13} />
            <span>Digital Performance Pass</span>
          </button>

          <button
            onClick={() => setActiveViewTab('profile')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeViewTab === 'profile'
                ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/25'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Sparkles size={13} />
            <span>AI Coding Profile</span>
          </button>

          <button
            onClick={() => setActiveViewTab('timeline')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeViewTab === 'timeline'
                ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Clock size={13} />
            <span>Intervention Timeline ({events.length})</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 custom-scrollbar">
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
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Current Action Signal</div>
                <div className="text-sm font-black text-white">{item.signal_type}</div>
                <div className="text-xs text-brand-400 mt-1 italic">{item.recommended_action}</div>
              </div>

              {timelineLoading ? (
                <div className="py-12 text-center text-slate-400">
                  <RefreshCw size={20} className="animate-spin mx-auto mb-2 opacity-50" />
                  <span className="text-xs">Loading intervention timeline...</span>
                </div>
              ) : events.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">No intervention audit logs recorded yet.</div>
              ) : (
                <div className="relative pl-4 space-y-4">
                  <div className="absolute left-7 top-3 bottom-3 w-px bg-slate-800" />
                  {events.map((ev, i) => {
                    const colorCls = EVENT_COLOR[ev.event_type] || 'text-slate-400';
                    return (
                      <div key={ev.id} className="flex gap-4 items-start relative z-10">
                        <div className={`w-7 h-7 rounded-full border border-current flex items-center justify-center text-[11px] font-black bg-slate-900 ${colorCls} shrink-0`}>
                          {i + 1}
                        </div>
                        <div className="flex-1 p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <span className={`text-xs font-black ${colorCls}`}>{ev.event_type.replace(/_/g, ' ')}</span>
                            <span className="text-[10px] text-slate-500 font-mono">{ev.timestamp}</span>
                          </div>
                          <div className="text-[11px] text-slate-400">by <b className="text-slate-200">{ev.user_name}</b></div>
                          {(ev.previous_value || ev.new_value) && (
                            <div className="text-xs pt-1 border-t border-slate-800/80">
                              {ev.previous_value && <span className="line-through text-slate-500 mr-1.5">{ev.previous_value}</span>}
                              {ev.new_value && <span className="text-emerald-400 font-bold">{ev.new_value}</span>}
                            </div>
                          )}
                          {ev.reason && <div className="text-[11px] text-slate-400 italic pt-1">{ev.reason}</div>}
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
    </div>
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
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100000] flex items-center justify-center p-4 sm:p-6 pt-20 sm:pt-24 pb-6 bg-slate-950/80 backdrop-blur-md animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-2xl max-h-[78vh] flex flex-col rounded-3xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700/80 shadow-2xl shadow-indigo-950/30 overflow-hidden my-auto">

        {/* Premium Executive Header */}
        <div className="relative overflow-hidden p-6 bg-gradient-to-r from-slate-950 via-navy-950 to-indigo-950 text-white border-b border-slate-800/80 shrink-0">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-500 via-indigo-600 to-purple-600 flex items-center justify-center font-black text-xl text-white shadow-lg shadow-brand-500/30 border border-white/20 shrink-0">
                {item.student_name.charAt(0)}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <PriorityBadge priority={item.priority} score={item.priority_score} reason={item.priority_score_reason} />
                  {item.is_escalated && (
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 font-black tracking-wide animate-pulse">
                      ESCALATED
                    </span>
                  )}
                </div>

                <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-snug">
                  {item.student_name}
                </h3>

                <p className="text-xs text-slate-300 font-mono flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold">{item.reg_no}</span>
                  <span>·</span>
                  <span>{item.department_code}</span>
                  <span>·</span>
                  <span className="px-2 py-0.5 rounded-md bg-white/10 text-white font-sans text-[11px] font-black">{item.year_level} Year</span>
                  <span>·</span>
                  <span className="text-brand-300 font-bold">@{item.leetcode_username}</span>
                </p>

                {/* Quick Metrics Bar */}
                <div className="flex items-center gap-3 pt-1 text-[11px] text-slate-300 font-bold flex-wrap">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-slate-800/80 border border-slate-700">
                    <CheckCircle2 size={12} className="text-emerald-400" />
                    {item.total_solved} Solved
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-slate-800/80 border border-slate-700">
                    <Award size={12} className="text-amber-400" />
                    {item.current_rating} Rating
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-slate-800/80 border border-slate-700">
                    <Activity size={12} className="text-cyan-400" />
                    {item.contests_attended} Contests
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-400">
                    <Clock size={12} />
                    {item.last_active_days_ago}d ago
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-2xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition cursor-pointer shrink-0 border border-white/10"
              title="Close modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Signal & Recommendation Banner */}
        <div className="px-6 py-3.5 bg-gradient-to-r from-indigo-500/10 via-brand-500/5 to-purple-500/10 dark:from-indigo-950/50 dark:via-navy-900/60 dark:to-purple-950/50 border-b border-indigo-100 dark:border-navy-700/80 flex items-start gap-3 shrink-0">
          <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0">
            <Sparkles size={16} />
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

        {/* Form Body */}
        <div className="overflow-y-auto flex-1 p-6 space-y-5 custom-scrollbar">
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

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-navy-800 bg-slate-50/90 dark:bg-navy-950/90 backdrop-blur-md shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-2xl bg-slate-200/80 dark:bg-navy-800 hover:bg-slate-300 dark:hover:bg-navy-700 text-slate-700 dark:text-slate-300 text-xs font-black transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-gradient-to-r from-brand-600 via-indigo-600 to-purple-600 hover:from-brand-500 hover:to-purple-500 text-white text-xs font-black shadow-lg shadow-brand-600/30 hover:scale-105 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
          >
            <Send size={14} />
            <span>{saving ? 'Saving Action Details...' : 'Save Changes'}</span>
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

  // Filters
  const [isMobile, setIsMobile] = useState<boolean>(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const [filterPriority, setFilterPriority] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [search, setSearch] = useState('');
  const [filterOverdue, setFilterOverdue] = useState(false);
  const [filterEscalated, setFilterEscalated] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768 ? 10 : 50);

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
      if (filterYear) params.year_level = filterYear;
      if (search.trim()) params.search = search.trim();
      if (filterOverdue) params.is_overdue = true;
      if (filterEscalated) params.is_escalated = true;

      const kpiParams: any = {};
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
  }, [page, pageSize, sortBy, sortDir, filterPriority, filterStatus, filterYear, search, filterOverdue, filterEscalated]);

  useEffect(() => { loadData(); }, [loadData]);

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
  const hasFilters = !!(filterPriority || filterStatus || filterYear || search);

  const thCls = "text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-left py-3.5 px-3.5 first:pl-5";
  const tdCls = "py-3.5 px-3.5 text-sm first:pl-5";
  const filterSelectCls = "rounded-xl bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-brand-500 transition cursor-pointer";

  return (
    <div className="space-y-6 md:space-y-7 pb-12 animate-fade-in font-sans">
      {/* Executive Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white p-6 sm:p-8 shadow-lg border border-brand-500/30 mb-6">

        <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-brand-500/20 border border-brand-400/30 text-brand-300 text-xs font-black">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>STUDENT INTERVENTION & MENTORING</span>
            </div>

            <h1 className="text-2xl sm:text-3xl xl:text-4xl font-black tracking-tight flex items-center gap-3">
              <ShieldAlert className="w-7 h-7 sm:w-8 sm:h-8 text-rose-400 stroke-[2.5]" />
              Faculty <span className="bg-clip-text text-transparent bg-gradient-to-r from-rose-400 via-amber-300 to-brand-300">Action Center</span>
            </h1>

            <p className="text-xs md:text-sm text-slate-300 font-medium leading-relaxed">
              {kpis?.subtitle || 'Real-time student intervention & mentoring management · Detect, Prioritize, Assign, Resolve'}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {syncMsg && (
              <span className={`text-xs font-bold px-3 py-1.5 rounded-xl bg-navy-900/90 border border-slate-700/80 ${syncMsg.includes('failed') ? 'text-rose-400' : 'text-emerald-400'}`}>
                {syncMsg}
              </span>
            )}
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-brand-600 via-indigo-600 to-purple-600 hover:from-brand-500 hover:to-purple-500 text-white text-xs font-black shadow-lg shadow-brand-600/30 hover:scale-105 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={14} className={syncing ? 'animate-spin text-amber-300' : 'text-amber-300'} />
              <span>{syncing ? 'Resyncing All Data...' : 'Force Sync'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      {kpis && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 sm:gap-4 mb-6">
          <KPICard label="Critical" value={kpis.critical_count} colorTheme="red"
            icon={<ShieldAlert size={14} strokeWidth={2.5} />} active={kpiFilter === 'Critical'} onClick={() => applyKPIFilter('Critical', 'priority')} subtitle="Immediate action" />
          <KPICard label="High" value={kpis.high_count} colorTheme="orange"
            icon={<AlertTriangle size={14} strokeWidth={2.5} />} active={kpiFilter === 'High'} onClick={() => applyKPIFilter('High', 'priority')} subtitle="Urgent review" />
          <KPICard label="Monitoring" value={kpis.monitoring_count} colorTheme="amber"
            icon={<Activity size={14} strokeWidth={2.5} />} active={kpiFilter === 'Monitoring'} onClick={() => applyKPIFilter('Monitoring', 'status')} subtitle="Track progress" />
          <KPICard label="In Progress" value={kpis.in_progress_count} colorTheme="blue"
            icon={<Zap size={14} strokeWidth={2.5} />} active={kpiFilter === 'In Progress'} onClick={() => applyKPIFilter('In Progress', 'status')} subtitle="Active intervention" />
          <KPICard label="Completed" value={kpis.completed_count} colorTheme="cyan"
            icon={<CheckCircle2 size={14} strokeWidth={2.5} />} active={kpiFilter === 'Completed'} onClick={() => applyKPIFilter('Completed', 'status')} subtitle="Task finished" />
          <KPICard label="Resolved" value={kpis.resolved_count} colorTheme="emerald"
            icon={<CheckCircle2 size={14} strokeWidth={2.5} />} active={kpiFilter === 'Resolved'} onClick={() => applyKPIFilter('Resolved', 'status')} subtitle="Issue resolved" />
          <KPICard label="Overdue" value={kpis.overdue_count} colorTheme="pink"
            icon={<Bell size={14} strokeWidth={2.5} />} active={kpiFilter === 'Overdue'} onClick={() => applyKPIFilter('Overdue', 'overdue')} subtitle="Follow-up missed" />
          <KPICard label="Escalated" value={kpis.escalated_count} colorTheme="violet"
            icon={<ArrowUpRight size={14} strokeWidth={2.5} />} active={kpiFilter === 'Escalated'} onClick={() => applyKPIFilter('Escalated', 'escalated')} subtitle="Escalated to HOD" />
        </div>
      )}

      {/* Filters */}
      <div className="relative z-20 flex flex-wrap gap-3 items-center p-4 rounded-3xl bg-white/80 dark:bg-navy-850/80 border border-slate-200 dark:border-navy-700 backdrop-blur-md shadow-sm mb-6">
        <div className="relative group flex-1 min-w-[250px]">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-brand-500 rounded-full blur opacity-15 group-focus-within:opacity-60 transition duration-500"></div>
          <div className="relative flex items-center gap-3 bg-white dark:bg-navy-950 rounded-full px-5 py-2.5 border border-slate-300 dark:border-navy-700 focus-within:border-indigo-500 shadow-xs">
            <Search size={18} className="text-slate-400 group-focus-within:text-indigo-600 transition-colors flex-shrink-0" />
            <input
              value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by name, reg no, username..."
              className="flex-1 bg-transparent border-none focus:ring-0 focus:border-transparent focus:outline-none !outline-none !ring-0 !border-none text-sm font-bold text-slate-800 dark:text-slate-200 placeholder:text-slate-400 placeholder:font-medium p-0 m-0"
            />
            {search && (
              <button onClick={() => { setSearch(''); setPage(1); }} className="text-slate-400 hover:text-rose-500 transition-colors p-1 rounded-full hover:bg-slate-100 dark:hover:bg-navy-800">
                <X size={14} />
              </button>
            )}
          </div>
        </div>
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
          icon={<Building2 size={16} />}
          options={[
            { label: 'Critical', value: 'Critical', icon: <ShieldAlert size={14} />, badge: 'P1', badgeColor: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' },
            { label: 'High', value: 'High', icon: <AlertTriangle size={14} />, badge: 'P2', badgeColor: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300' },
            { label: 'Medium', value: 'Medium', icon: <Clock size={14} />, badge: 'P3', badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300' },
            { label: 'Low', value: 'Low', icon: <Activity size={14} />, badge: 'P4', badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' }
          ]}
        />
        
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
          icon={<Activity size={16} />}
          options={[
            { label: 'Pending', value: 'Pending', icon: <Clock size={14} />, badge: 'PEN', badgeColor: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
            { label: 'In Progress', value: 'In Progress', icon: <Zap size={14} />, badge: 'INP', badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' },
            { label: 'Monitoring', value: 'Monitoring', icon: <Activity size={14} />, badge: 'MON', badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300' },
            { label: 'Completed', value: 'Completed', icon: <CheckCircle2 size={14} />, badge: 'COM', badgeColor: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300' },
            { label: 'Resolved', value: 'Resolved', icon: <CheckCircle2 size={14} />, badge: 'RES', badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' }
          ]}
        />

        <CustomSelect
          value={filterYear}
          onChange={v => { setFilterYear(v); setPage(1); }}
          placeholder="All Years"
          icon={<GraduationCap size={16} />}
          options={[
            { label: 'I Year', value: 'I Year', icon: <User size={14} />, badge: 'Y1', badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' },
            { label: 'II Year', value: 'II Year', icon: <User size={14} />, badge: 'Y2', badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' },
            { label: 'III Year', value: 'III Year', icon: <User size={14} />, badge: 'Y3', badgeColor: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300' },
            { label: 'IV Year', value: 'IV Year', icon: <User size={14} />, badge: 'Y4', badgeColor: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300' }
          ]}
        />
        <div className="w-full flex items-center justify-between xl:w-auto xl:ml-auto gap-4 mt-2 xl:mt-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600 dark:text-navy-300">
              {filteredCount === totalCount ? (
                `Showing ${totalCount} action items`
              ) : (
                `Showing ${filteredCount} of ${totalCount} action items`
              )}
            </span>
            {(hasFilters || kpiFilter) && (
               <button onClick={() => { setFilterPriority(''); setFilterStatus(''); setFilterYear(''); setSearch(''); setFilterOverdue(false); setFilterEscalated(false); setKpiFilter(''); setPage(1); }}
                 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 transition flex items-center gap-0.5 ml-2">
                 <X size={14} /> Clear
               </button>
            )}
          </div>
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-navy-800 p-1 rounded-xl border border-slate-200 dark:border-navy-700">
            <span className="text-[10px] font-bold text-slate-500 dark:text-navy-400 px-1 font-mono">Show:</span>
            {(isMobile ? [10, 25, 50] : [20, 50, 100, 200]).map((sz) => (
              <button
                key={sz}
                onClick={() => { setPageSize(sz); setPage(1); }}
                className={`px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  pageSize === sz
                    ? 'bg-indigo-600 text-white shadow-xs font-black'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
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
        <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 rounded-3xl p-6 space-y-4 shadow-sm animate-pulse">
          {/* Top Status & Shimmer Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-navy-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center border border-brand-500/20">
                <Sparkles className="w-4 h-4 animate-bounce-slow" />
              </div>
              <div>
                <div className="h-4 w-48 bg-slate-200 dark:bg-navy-700 rounded-lg"></div>
                <div className="h-3 w-32 bg-slate-100 dark:bg-navy-800 rounded mt-1.5"></div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-800/50">
                <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5 text-brand-500" />
                Aggregating Intervention Queue...
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
      ) : items.length === 0 ? (
        <div className="relative overflow-hidden rounded-3xl bg-slate-900/90 dark:bg-navy-950/90 border border-emerald-500/25 dark:border-emerald-500/30 p-8 sm:p-12 text-center shadow-2xl backdrop-blur-xl transition-all duration-300">
          {/* Decorative Ambient Radial Glow */}
          <div className="absolute -top-24 -left-24 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-md mx-auto flex flex-col items-center">
            {/* Animated Icon Ring */}
            <div className="relative mb-5">
              <div className="absolute -inset-2 rounded-3xl bg-gradient-to-r from-emerald-500 to-teal-500 opacity-25 blur-lg animate-pulse" />
              <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 p-0.5 shadow-xl flex items-center justify-center">
                <div className="w-full h-full rounded-[22px] bg-slate-950/90 flex items-center justify-center">
                  {hasFilters || kpiFilter ? (
                    <Search className="w-9 h-9 text-slate-400" />
                  ) : (
                    <CheckCircle2 className="w-9 h-9 text-emerald-400 animate-bounce-slow" />
                  )}
                </div>
              </div>
            </div>

            {/* Pill Status Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-black uppercase tracking-widest mb-3">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>{hasFilters || kpiFilter ? 'Filter Scope Active' : 'Institutional Status: Optimal'}</span>
            </div>

            {/* Title */}
            <h3 className="font-display text-2xl sm:text-3xl font-black text-white tracking-tight mb-2.5">
              {hasFilters || kpiFilter ? 'No Matching Students Found' : 'All Students Operating at Target Health'}
            </h3>

            {/* Description */}
            <p className="text-xs sm:text-sm text-slate-300 dark:text-slate-400 font-medium leading-relaxed mb-6 max-w-sm">
              {hasFilters || kpiFilter
                ? 'No student intervention records matched your currently selected department, academic year, priority, or KPI filters.'
                : 'Zero critical risk warnings or pending intervention requests detected across all tracked engineering profiles.'}
            </p>

            {/* Interactive Action Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              {(hasFilters || kpiFilter) ? (
                <button
                  onClick={() => {
                    setFilterPriority('');
                    setFilterStatus('');
                    setFilterYear('');
                    setSearch('');
                    setKpiFilter(null);
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-black text-xs shadow-lg shadow-brand-500/20 transition-all cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset All Filters
                </button>
              ) : (
                <button
                  onClick={() => loadData()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 font-extrabold text-xs transition-all cursor-pointer"
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
          {/* Mobile Intervention Cards (Compact, 100% width, no wasted space) */}
          <div className="block md:hidden space-y-3">
            {items.map((item) => {
              const statusCls = STATUS_CONFIG[item.status] || 'bg-slate-100 text-slate-600 border border-slate-200';
              const isExpanded = expandedRow === item.id;
              return (
                <div
                  key={item.id}
                  className="rounded-2xl bg-white dark:bg-navy-850 border border-slate-200 dark:border-navy-700 p-3.5 shadow-sm space-y-2.5 transition-all"
                >
                  {/* Top: Student Details + Priority & Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-sm text-slate-800 dark:text-white truncate">
                        {item.student_name}
                      </h4>
                      <div className="text-[11.5px] font-medium text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        <span className="font-mono text-slate-600 dark:text-slate-300">{item.reg_no}</span> · {item.department_code} · {formatYearLevel(item.year_level)}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <PriorityBadge priority={item.priority} score={item.priority_score} reason={item.priority_score_reason} />
                      <span className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full ${statusCls}`}>
                        {item.status}
                      </span>
                    </div>
                  </div>

                  {/* Stats & Signal Grid */}
                  <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-navy-900/60 p-2.5 rounded-xl text-xs border border-slate-100 dark:border-navy-800">
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Coding Stats</div>
                      <div className="font-mono font-bold text-slate-700 dark:text-slate-200 mt-0.5 text-[11.5px]">
                        Solved: {item.total_solved} <span className="text-slate-400 font-normal">| R: {item.current_rating || 0}</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Signal Trigger</div>
                      <div className="font-semibold text-slate-700 dark:text-slate-300 truncate mt-0.5 text-[11.5px]" title={item.signal_type}>
                        {formatSignalLabel(item.signal_type)}
                      </div>
                    </div>
                  </div>

                  {/* Mentor & Due Date Row */}
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-1.5 truncate max-w-[60%]">
                      <User size={12} className="text-slate-400 shrink-0" />
                      <span className="truncate font-medium text-slate-700 dark:text-slate-300 text-[11.5px]">
                        {item.assigned_faculty_name || 'Unassigned'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] font-mono shrink-0">
                      <Calendar size={12} className="text-slate-400" />
                      <span>{formatDate(item.due_date)}</span>
                    </div>
                  </div>

                  {/* Buttons Row */}
                  <div className="flex items-center gap-2 pt-0.5">
                    <button
                      onClick={() => setUpdateItem(item)}
                      className="flex-1 py-2 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white transition-all font-bold text-xs shadow-sm flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                    >
                      <Zap size={12} />
                      <span>Take Action</span>
                    </button>
                    <button
                      onClick={() => setViewItem(item)}
                      title="View Student Coding Profile"
                      className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-navy-700 hover:bg-slate-200 dark:hover:bg-navy-600 text-slate-600 dark:text-slate-300 transition text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Eye size={13} />
                      <span>Profile</span>
                    </button>
                    <button
                      onClick={() => setExpandedRow(isExpanded ? null : item.id)}
                      className="p-2 rounded-xl border border-slate-200 dark:border-navy-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-navy-800 transition text-xs cursor-pointer"
                      title="Toggle details"
                    >
                      {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                  </div>

                  {/* Expanded Detail on Mobile */}
                  {isExpanded && (
                    <div className="pt-2 border-t border-slate-100 dark:border-navy-800 space-y-1.5 text-xs">
                      <div>
                        <div className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Recommended Action</div>
                        <div className="text-brand-600 dark:text-brand-400 font-semibold mt-0.5">{item.recommended_action || '—'}</div>
                      </div>
                      {item.action_taken && (
                        <div>
                          <div className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Action Taken</div>
                          <div className="text-slate-700 dark:text-slate-300 mt-0.5">{item.action_taken}</div>
                        </div>
                      )}
                      {item.faculty_notes && (
                        <div>
                          <div className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Faculty Notes</div>
                          <div className="text-slate-700 dark:text-slate-300 mt-0.5">{item.faculty_notes}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block table-responsive-container rounded-2xl bg-white dark:bg-navy-850 border border-slate-200 dark:border-navy-700 backdrop-blur-sm shadow-sm overflow-hidden">
            <table className="w-full table-fixed min-w-[800px]">
              <colgroup>
                <col style={{ width: '22%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '20%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '7%' }} />
              </colgroup>
              <thead className="table-header-group border-b border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950">
                <tr>
                  {[['Student', 'student_name'], ['Priority', 'priority_score'], ['Stats', ''], ['Signal', ''], ['Status', 'status'], ['Faculty', ''], ['Due', 'due_date'], ['Actions', '']].map(([label, col]) => (
                    <th key={label} className={`${thCls} ${col ? 'cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 select-none' : ''}`} onClick={() => col && toggleSort(col)}>
                      <span className="inline-flex items-center gap-1">{label} {col && <SortIcon col={col} />}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-navy-700/60">
                {items.map((item) => {
                  const statusCls = STATUS_CONFIG[item.status] || 'bg-slate-100 text-slate-600 border border-slate-200';
                  const isExpanded = expandedRow === item.id;
                  return (
                    <React.Fragment key={item.id}>
                      <tr
                        onClick={() => setExpandedRow(isExpanded ? null : item.id)}
                        className={`cursor-pointer transition-colors ${isExpanded ? 'bg-indigo-50/30 dark:bg-navy-800/80' : 'hover:bg-slate-50/70 dark:hover:bg-navy-700/40'}`}
                      >
                        {/* Student */}
                        <td className={tdCls}>
                          <div className="font-bold text-sm text-slate-800 dark:text-white truncate">{item.student_name}</div>
                          <div className="text-[11.5px] font-medium text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            <span className="font-mono text-slate-600 dark:text-slate-300">{item.reg_no}</span> · {item.department_code} · {formatYearLevel(item.year_level)}
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
                              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Rating:</span>
                              <span className="font-bold text-slate-700 dark:text-slate-200 font-mono text-[11.5px]">{item.current_rating || 0}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Solved:</span>
                              <span className="font-bold text-slate-700 dark:text-slate-200 font-mono text-[11.5px]">{item.total_solved || 0}</span>
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
                          <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 font-medium truncate">
                            <User size={12} className="text-slate-400 shrink-0" />
                            <span className="truncate">{item.assigned_faculty_name || 'Unassigned'}</span>
                          </div>
                        </td>

                        {/* Due Date */}
                        <td className={tdCls}>
                          <div className={`text-xs font-mono ${item.due_date ? 'text-slate-600 dark:text-slate-300 font-medium' : 'text-slate-400'}`}>{formatDate(item.due_date)}</div>
                        </td>

                        {/* Actions */}
                        <td className={tdCls} onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => setUpdateItem(item)}
                              title="Take Action on Student"
                              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white transition-all cursor-pointer shadow-sm hover:shadow flex items-center gap-1.5 text-xs font-bold active:scale-95"
                            >
                              <Zap size={12} />
                              <span>Take Action</span>
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
                          <td colSpan={8} className="px-5 py-4">
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
    </div>
  );
};

export default FacultyActionCenter;

