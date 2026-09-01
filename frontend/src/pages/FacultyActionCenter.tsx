import React, { useState, useEffect, useCallback } from 'react';
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

// ─── Priority Config ──────────────────────────────────────────────────────────
const PRIORITY_CONFIG: Record<string, { tw: string; dot: string; icon: React.ReactNode }> = {
  Critical: { tw: 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/30 shadow-sm',   dot: 'bg-red-500 dark:bg-red-400',    icon: <ShieldAlert size={12} strokeWidth={3} /> },
  High:     { tw: 'bg-orange-50 dark:bg-orange-500/15 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-500/30 shadow-sm', dot: 'bg-orange-500 dark:bg-orange-400', icon: <AlertTriangle size={12} strokeWidth={2.5} /> },
  Medium:   { tw: 'bg-yellow-50 dark:bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-500/30 shadow-sm', dot: 'bg-yellow-500 dark:bg-yellow-400', icon: <Clock size={12} strokeWidth={2.5} /> },
  Low:      { tw: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/25 shadow-sm', dot: 'bg-emerald-500 dark:bg-emerald-400', icon: <Activity size={12} strokeWidth={2.5} /> },
};

const STATUS_CONFIG: Record<string, string> = {
  Pending:       'bg-violet-50 dark:bg-violet-500/15 text-violet-700 dark:text-violet-400 border border-violet-200 dark:border-violet-500/25 shadow-sm',
  'In Progress': 'bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/25 shadow-sm',
  Monitoring:    'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/25 shadow-sm',
  Completed:     'bg-cyan-50 dark:bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/25 shadow-sm',
  Resolved:      'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/25 shadow-sm',
};

const EVENT_COLOR: Record<string, string> = {
  ACTION_CREATED: 'text-blue-400',
  STATUS_CHANGED: 'text-violet-400',
  FACULTY_ASSIGNED: 'text-emerald-400',
  NOTE_ADDED: 'text-amber-400',
  FOLLOW_UP_SCHEDULED: 'text-pink-400',
  ESCALATED: 'text-red-400',
  RESOLVED: 'text-emerald-400',
  PRIORITY_CHANGED: 'text-orange-400',
};

// ─── Score Tooltip Badge ──────────────────────────────────────────────────────
const PriorityBadge: React.FC<{ priority: string; score: number; reason: string }> = ({ priority, score, reason }) => {
  const [show, setShow] = useState(false);
  const cfg = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.Low;
  return (
    <div className="relative inline-block">
      <span
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold cursor-default select-none ${cfg.tw}`}
      >
        {cfg.icon} {priority}
        <span className="opacity-60 text-[10px]">({score})</span>
      </span>
      {show && (
        <div className="absolute top-[110%] left-0 z-50 w-64 p-3 rounded-xl text-xs bg-slate-900 dark:bg-navy-900 border border-slate-700 dark:border-navy-700 shadow-lg leading-relaxed pointer-events-none">
          <div className={`font-bold mb-1 ${cfg.tw.split(' ')[1]}`}>Score: {score}/100</div>
          <div className="text-slate-400">{reason}</div>
        </div>
      )}
    </div>
  );
};

// ─── Custom Dropdown Select ──────────────────────────────────────────────────
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
        className={`flex items-center justify-between gap-3 min-w-[200px] px-4 py-2.5 rounded-xl border transition-all cursor-pointer font-bold text-sm ${
          open 
            ? 'border-brand-500 bg-white dark:bg-navy-900 ring-4 ring-brand-500/10 shadow-sm' 
            : value 
              ? 'border-brand-500/30 bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-300' 
              : 'border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-slate-700 dark:text-slate-200 hover:border-slate-300'
        }`}
      >
        <div className="flex items-center gap-2">
          <span className={value ? 'text-brand-500' : 'text-slate-400'}>{icon || selected?.icon}</span>
          <div className="flex items-center gap-2">
            {selected?.badge && (
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${selected.badgeColor || 'bg-slate-100 text-slate-500'}`}>
                {selected.badge}
              </span>
            )}
            <span>{selected ? selected.label : placeholder}</span>
          </div>
        </div>
        <ChevronDown size={14} className={`transition-transform duration-300 ${open ? 'rotate-180 text-brand-500' : 'text-slate-400'}`} />
      </button>

      {open && (
        <div className="absolute z-50 top-[110%] left-0 w-full min-w-[280px] p-1.5 rounded-2xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 shadow-xl animate-fade-in-up">
          <button
            onClick={() => { onChange(''); setOpen(false); }}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${
              !value 
                ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20' 
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
                      ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20' 
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={isSelected ? 'text-white opacity-90' : 'text-slate-400'}>{opt.icon}</span>
                    {opt.badge && (
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${
                        isSelected ? 'bg-white/20 text-white' : opt.badgeColor || 'bg-slate-100 text-slate-500'
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

// ─── Animated KPI Card ─────────────────────────────────────────────────────────
const KPICard: React.FC<{
  label: string; value: number; colorTheme: string; icon: React.ReactNode;
  active: boolean; onClick: () => void; subtitle?: string;
}> = ({ label, value, colorTheme, icon, active, onClick, subtitle }) => {
  // Use unified color theme for light/dark
  const tColors: Record<string, { bg: string, text: string, border: string, shadow: string, hover: string }> = {
    red: { bg: 'bg-red-50 dark:bg-red-500/10', text: 'text-red-600 dark:text-red-400', border: 'border-red-200 dark:border-red-500/30', shadow: 'shadow-red-500/15', hover: 'hover:border-red-300 dark:hover:border-red-400/50' },
    orange: { bg: 'bg-orange-50 dark:bg-orange-500/10', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-200 dark:border-orange-500/30', shadow: 'shadow-orange-500/15', hover: 'hover:border-orange-300 dark:hover:border-orange-400/50' },
    amber: { bg: 'bg-amber-50 dark:bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-500/30', shadow: 'shadow-amber-500/15', hover: 'hover:border-amber-300 dark:hover:border-amber-400/50' },
    blue: { bg: 'bg-blue-50 dark:bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-500/30', shadow: 'shadow-blue-500/15', hover: 'hover:border-blue-300 dark:hover:border-blue-400/50' },
    cyan: { bg: 'bg-cyan-50 dark:bg-cyan-500/10', text: 'text-cyan-600 dark:text-cyan-400', border: 'border-cyan-200 dark:border-cyan-500/30', shadow: 'shadow-cyan-500/15', hover: 'hover:border-cyan-300 dark:hover:border-cyan-400/50' },
    emerald: { bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-500/30', shadow: 'shadow-emerald-500/15', hover: 'hover:border-emerald-300 dark:hover:border-emerald-400/50' },
    pink: { bg: 'bg-pink-50 dark:bg-pink-500/10', text: 'text-pink-600 dark:text-pink-400', border: 'border-pink-200 dark:border-pink-500/30', shadow: 'shadow-pink-500/15', hover: 'hover:border-pink-300 dark:hover:border-pink-400/50' },
    violet: { bg: 'bg-violet-50 dark:bg-violet-500/10', text: 'text-violet-600 dark:text-violet-400', border: 'border-violet-200 dark:border-violet-500/30', shadow: 'shadow-violet-500/15', hover: 'hover:border-violet-300 dark:hover:border-violet-400/50' },
  };
  const theme = tColors[colorTheme] || tColors['blue'];
  
  return (
    <button
      onClick={onClick}
      className={`flex-1 min-w-[130px] text-left rounded-2xl p-4 border transition-all duration-300 transform hover:-translate-y-1 cursor-pointer relative overflow-hidden group ${
        active
          ? `${theme.bg} ${theme.border} ring-2 ring-current/40 shadow-xl ${theme.shadow}`
          : `bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-700 hover:shadow-lg ${theme.hover}`
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          <span className={`p-1.5 rounded-lg ${active ? `bg-current/15 ${theme.text}` : `${theme.bg} ${theme.text}`} transition-colors`}>{icon}</span>
          <span className="text-[10.5px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors">{label}</span>
        </div>
        {active && <span className={`w-2.5 h-2.5 rounded-full ${theme.bg.split(' ')[0].replace('10', '500')} ${theme.bg.split(' ')[1].replace('10', '400')} animate-ping opacity-75`} />}
      </div>
      <div className={`text-3xl font-black tracking-tight leading-none ${active ? theme.text : 'text-slate-700 dark:text-slate-100 group-hover:' + theme.text.split(' ')[0]}`}>
        {value}
      </div>
      {subtitle && <div className="text-[10px] text-slate-400 dark:text-navy-400 mt-2.5 font-bold truncate">{subtitle}</div>}
    </button>
  );
};

// ─── Unified Student View & Pass Modal ─────────────────────────────────────────
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
                          {ev.reason && <div className="text-[11px] text-slate-400 italic pt-1">💡 {ev.reason}</div>}
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

// ─── Update Modal ─────────────────────────────────────────────────────────────
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
      setMsg('✅ Saved');
      setTimeout(() => { onSaved(); onClose(); }, 700);
    } catch { setMsg('❌ Failed'); }
    finally { setSaving(false); }
  };

  const handleEscalate = async () => {
    setEscalating(true);
    try {
      await escalateAction(item.id, escalateTo, escalateReason, form.updated_by_name);
      setMsg(`✅ Escalated to ${escalateTo}`);
      setTimeout(() => { onSaved(); onClose(); }, 700);
    } catch { setMsg('❌ Escalation failed'); }
    finally { setEscalating(false); }
  };

  const inputCls = "w-full rounded-xl bg-slate-100 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 outline-none focus:border-brand-500 transition";
  const labelCls = "block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-navy-400 mb-1.5";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-navy-850 border border-slate-200 dark:border-navy-700 shadow-lg overflow-hidden">

        {/* Header */}
        <div className={`p-5 border-b border-slate-200 dark:border-navy-700 flex items-start justify-between ${cfg.tw.split(' ').slice(0,1).join(' ')}/5`}>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <PriorityBadge priority={item.priority} score={item.priority_score} reason={item.priority_score_reason} />
              {item.is_escalated && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/25 font-bold">🔺 ESCALATED</span>
              )}
            </div>
            <div className="text-lg font-bold mt-2 text-slate-800 dark:text-slate-100">{item.student_name}</div>
            <div className="text-xs text-slate-500 dark:text-navy-400">
              {item.reg_no} · {item.department_code} · {item.year_level} ·{' '}
              <span className="text-brand-500">@{item.leetcode_username}</span>
            </div>
            <div className="flex gap-4 mt-1.5 text-xs text-slate-400 dark:text-navy-400">
              <span>🧩 {item.total_solved} solved</span>
              <span>⭐ {item.current_rating} rating</span>
              <span>🏆 {item.contests_attended} contests</span>
              <span>🕐 {item.last_active_days_ago}d ago</span>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition p-1">
            <X size={18} />
          </button>
        </div>

        {/* Signal pill */}
        <div className="px-5 py-3 bg-slate-50 dark:bg-navy-900/50 border-b border-slate-200 dark:border-navy-700">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Signal</div>
          <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">{item.signal_type}</div>
          <div className="text-xs text-brand-500 mt-1 italic">💡 {item.recommended_action}</div>
        </div>

        {/* Form */}
        <div className="overflow-y-auto flex-1 p-5 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Status</label>
              <GlobalFilter
                value={form.status}
                onChange={val => setForm(f => ({ ...f, status: val }))}
                dropdownWidth="w-full"
                options={['Pending', 'In Progress', 'Monitoring', 'Completed', 'Resolved'].map(s => ({ value: s, label: s }))}
                icon={<Activity className="w-4 h-4" />}
              />
            </div>
            <div>
              <label className={labelCls}>Assigned Faculty</label>
              <input value={form.assigned_faculty_name} onChange={e => setForm(f => ({ ...f, assigned_faculty_name: e.target.value }))} className={inputCls} placeholder="Dr. / Prof. Name" />
            </div>
          </div>

          <div>
            <label className={labelCls}>Action Taken</label>
            <textarea value={form.action_taken} onChange={e => setForm(f => ({ ...f, action_taken: e.target.value }))} className={`${inputCls} h-16 resize-y`} placeholder="Describe the action taken..." />
          </div>

          <div>
            <label className={labelCls}>Faculty Notes (Private)</label>
            <textarea value={form.faculty_notes} onChange={e => setForm(f => ({ ...f, faculty_notes: e.target.value }))} className={`${inputCls} h-16 resize-y`} placeholder="Private notes for reference..." />
          </div>

          <div>
            <label className={labelCls}>Evidence Remarks</label>
            <input value={form.evidence_remarks} onChange={e => setForm(f => ({ ...f, evidence_remarks: e.target.value }))} className={inputCls} placeholder="e.g. Missed WC#516, no submission since Aug 10" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Updated By</label>
              <input value={form.updated_by_name} onChange={e => setForm(f => ({ ...f, updated_by_name: e.target.value }))} className={inputCls} placeholder="Your name" />
            </div>
            <div>
              <label className={labelCls}>Follow-up Date</label>
              <input type="date" value={form.follow_up_date || ''} onChange={e => setForm(f => ({ ...f, follow_up_date: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Next Review Date</label>
              <input type="date" value={form.next_review_date || ''} onChange={e => setForm(f => ({ ...f, next_review_date: e.target.value }))} className={inputCls} />
            </div>
          </div>

          {/* Escalation */}
          <div className="border-t border-slate-200 dark:border-navy-700 pt-3">
            <button onClick={() => setShowEscalate(!showEscalate)} className="text-orange-400 text-xs font-semibold flex items-center gap-1.5 hover:text-orange-300 transition">
              <ArrowUpRight size={13} /> {showEscalate ? 'Hide' : 'Escalate to HOD'}
            </button>
            {showEscalate && (
              <div className="mt-3 flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Escalate To</label>
                    <input value={escalateTo} onChange={e => setEscalateTo(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Reason</label>
                    <input value={escalateReason} onChange={e => setEscalateReason(e.target.value)} className={inputCls} placeholder="No improvement after 2 interventions..." />
                  </div>
                </div>
                <button onClick={handleEscalate} disabled={escalating} className="self-start px-4 py-2 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-sm font-semibold hover:bg-red-500/25 transition">
                  {escalating ? '⏳ Escalating...' : '🔺 Confirm Escalation'}
                </button>
              </div>
            )}
          </div>

          {msg && <div className={`text-sm font-semibold ${msg.startsWith('✅') ? 'text-emerald-400' : 'text-red-400'}`}>{msg}</div>}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-5 py-4 border-t border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900/30">
          <button onClick={onClose} className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 text-sm font-semibold hover:bg-slate-200 dark:hover:bg-navy-700 transition">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-5 py-2 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition flex items-center gap-2 shadow-md">
            {saving ? '⏳ Saving...' : <><Send size={13} /> Save Changes</>}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export const FacultyActionCenter: React.FC = () => {
  const [kpis, setKpis] = useState<FacultyActionKPIs | null>(null);
  const [items, setItems] = useState<FacultyActionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  // Filters
  const [filterPriority, setFilterPriority] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [search, setSearch] = useState('');
  const [filterOverdue, setFilterOverdue] = useState(false);
  const [filterEscalated, setFilterEscalated] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Sort
  const [sortBy, setSortBy] = useState('priority_score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Active KPI filter key
  const [kpiFilter, setKpiFilter] = useState('');

  // Modals
  const [updateItem, setUpdateItem] = useState<FacultyActionItem | null>(null);
  const [viewItem, setViewItem] = useState<FacultyActionItem | null>(null);

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
      setTotal(listRes.total);
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
      setSyncMsg(`✅ ${res.new_signals_created} new, ${res.existing_signals_updated} updated`);
      await loadData();
    } catch { setSyncMsg('❌ Sync failed'); }
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

  const totalPages = Math.ceil(total / pageSize);
  const hasFilters = !!(filterPriority || filterStatus || filterYear || search);

  const thCls = "text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-navy-400 text-left py-3 px-3 first:pl-4";
  const tdCls = "py-3 px-3 text-sm first:pl-4";
  const filterSelectCls = "rounded-xl bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-brand-500 transition cursor-pointer";

  return (
    <div className="space-y-5 pb-12 animate-fade-in font-sans">
      {/* ── Executive Header Banner ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white p-6 sm:p-8 shadow-lg border border-brand-500/30">

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

            <p className="text-xs md:text-sm text-gray-300 font-medium leading-relaxed">
              {kpis?.subtitle || 'Real-time student intervention & mentoring management · Detect, Prioritize, Assign, Resolve'}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {syncMsg && (
              <span className={`text-xs font-bold px-3 py-1.5 rounded-xl bg-navy-900/90 border border-gray-700/80 ${syncMsg.startsWith('✅') ? 'text-emerald-400' : 'text-rose-400'}`}>
                {syncMsg}
              </span>
            )}
            <button
              onClick={handleSync}
              disabled={syncing}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-black shadow-md shadow-brand-600/30 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
              <span>{syncing ? 'Syncing...' : 'Force Sync'}</span>
            </button>
            <button
              onClick={loadData}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-navy-900/90 hover:bg-navy-800 text-white text-xs font-bold border border-gray-700/80 backdrop-blur-md shadow-inner transition-all cursor-pointer"
              title="Reload Data"
            >
              <RotateCcw size={13} className="text-gray-300" />
            </button>
          </div>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      {kpis && (
        <div className="flex flex-wrap gap-3">
          <KPICard label="Critical" value={kpis.critical_count} colorTheme="red"
            icon={<ShieldAlert size={14} strokeWidth={2.5} />} active={kpiFilter === 'Critical'} onClick={() => applyKPIFilter('Critical', 'priority')} subtitle="Immediate action" />
          <KPICard label="High" value={kpis.high_count} colorTheme="orange"
            icon={<AlertTriangle size={14} strokeWidth={2.5} />} active={kpiFilter === 'High'} onClick={() => applyKPIFilter('High', 'priority')} subtitle="Urgent review" />
          <KPICard label="Monitoring" value={kpis.monitoring_count} colorTheme="amber"
            icon={<Activity size={14} strokeWidth={2.5} />} active={kpiFilter === 'Monitoring'} onClick={() => applyKPIFilter('Monitoring', 'status')} />
          <KPICard label="In Progress" value={kpis.in_progress_count} colorTheme="blue"
            icon={<Zap size={14} strokeWidth={2.5} />} active={kpiFilter === 'In Progress'} onClick={() => applyKPIFilter('In Progress', 'status')} />
          <KPICard label="Completed" value={kpis.completed_count} colorTheme="cyan"
            icon={<CheckCircle2 size={14} strokeWidth={2.5} />} active={kpiFilter === 'Completed'} onClick={() => applyKPIFilter('Completed', 'status')} />
          <KPICard label="Resolved" value={kpis.resolved_count} colorTheme="emerald"
            icon={<CheckCircle2 size={14} strokeWidth={2.5} />} active={kpiFilter === 'Resolved'} onClick={() => applyKPIFilter('Resolved', 'status')} />
          <KPICard label="Overdue" value={kpis.overdue_count} colorTheme="pink"
            icon={<Bell size={14} strokeWidth={2.5} />} active={kpiFilter === 'Overdue'} onClick={() => applyKPIFilter('Overdue', 'overdue')} subtitle="Follow-up missed" />
          <KPICard label="Escalated" value={kpis.escalated_count} colorTheme="violet"
            icon={<ArrowUpRight size={14} strokeWidth={2.5} />} active={kpiFilter === 'Escalated'} onClick={() => applyKPIFilter('Escalated', 'escalated')} />
        </div>
      )}

      {/* ── Filters ── */}
      <div className="relative z-20 flex flex-wrap gap-3 items-center p-4 rounded-3xl bg-white/70 dark:bg-navy-800/70 border border-slate-200 dark:border-navy-700 backdrop-blur-md shadow-sm">
        <div className="relative group flex-1 min-w-[250px]">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-brand-500 via-purple-500 to-indigo-500 rounded-full blur opacity-20 group-focus-within:opacity-75 transition duration-500 group-hover:opacity-40"></div>
          <div className="relative flex items-center gap-3 bg-white dark:bg-navy-900 rounded-full px-5 py-3 border border-slate-200 dark:border-navy-700 focus-within:border-transparent shadow-sm">
            <Search size={18} className="text-slate-400 group-focus-within:text-brand-500 transition-colors flex-shrink-0" />
            <input
              value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by name, reg no, username..."
              className="flex-1 bg-transparent border-none focus:ring-0 focus:border-transparent focus:outline-none !outline-none !ring-0 !border-none text-sm font-bold text-slate-700 dark:text-slate-200 placeholder:text-slate-400 placeholder:font-medium p-0 m-0"
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
          onChange={v => { setFilterPriority(v); setKpiFilter(v); setPage(1); }}
          placeholder="All Priorities"
          icon={<Building2 size={16} />}
          options={[
            { label: 'Critical', value: 'Critical', icon: <ShieldAlert size={14} />, badge: 'P1', badgeColor: 'bg-red-100 text-red-600' },
            { label: 'High', value: 'High', icon: <AlertTriangle size={14} />, badge: 'P2', badgeColor: 'bg-orange-100 text-orange-600' },
            { label: 'Medium', value: 'Medium', icon: <Clock size={14} />, badge: 'P3', badgeColor: 'bg-yellow-100 text-yellow-600' },
            { label: 'Low', value: 'Low', icon: <Activity size={14} />, badge: 'P4', badgeColor: 'bg-emerald-100 text-emerald-600' }
          ]}
        />
        
        <CustomSelect
          value={filterStatus}
          onChange={v => { setFilterStatus(v); setPage(1); }}
          placeholder="All Statuses"
          icon={<Activity size={16} />}
          options={[
            { label: 'Pending', value: 'Pending', icon: <Clock size={14} />, badge: 'PEN', badgeColor: 'bg-violet-100 text-violet-600' },
            { label: 'In Progress', value: 'In Progress', icon: <Zap size={14} />, badge: 'INP', badgeColor: 'bg-blue-100 text-blue-600' },
            { label: 'Monitoring', value: 'Monitoring', icon: <Activity size={14} />, badge: 'MON', badgeColor: 'bg-amber-100 text-amber-600' },
            { label: 'Completed', value: 'Completed', icon: <CheckCircle2 size={14} />, badge: 'COM', badgeColor: 'bg-cyan-100 text-cyan-600' },
            { label: 'Resolved', value: 'Resolved', icon: <CheckCircle2 size={14} />, badge: 'RES', badgeColor: 'bg-emerald-100 text-emerald-600' }
          ]}
        />

        <CustomSelect
          value={filterYear}
          onChange={v => { setFilterYear(v); setPage(1); }}
          placeholder="All Years"
          icon={<GraduationCap size={16} />}
          options={[
            { label: 'II Year (Sophomore)', value: 'II Year', icon: <User size={14} />, badge: 'Y2', badgeColor: 'bg-brand-100 text-brand-600' },
            { label: 'III Year (Junior)', value: 'III Year', icon: <User size={14} />, badge: 'Y3', badgeColor: 'bg-indigo-100 text-indigo-600' },
            { label: 'IV Year (Senior)', value: 'IV Year', icon: <User size={14} />, badge: 'Y4', badgeColor: 'bg-violet-100 text-violet-600' }
          ]}
        />
        {hasFilters && (
          <button onClick={() => { setFilterPriority(''); setFilterStatus(''); setFilterYear(''); setSearch(''); setFilterOverdue(false); setFilterEscalated(false); setKpiFilter(''); setPage(1); }}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-xs font-semibold hover:bg-red-500/20 transition">
            <X size={11} /> Clear
          </button>
        )}
        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-navy-800 p-1 rounded-xl border border-slate-200 dark:border-navy-700">
            <span className="text-[10px] font-bold text-slate-400 dark:text-navy-400 px-1.5 font-mono">Show:</span>
            {[20, 50, 100, 200].map((sz) => (
              <button
                key={sz}
                onClick={() => { setPageSize(sz); setPage(1); }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  pageSize === sz
                    ? 'bg-violet-600 text-white shadow-sm font-black'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {sz}
              </button>
            ))}
          </div>
          <span className="text-xs text-slate-500 dark:text-navy-300 font-extrabold font-mono">{total} records</span>
        </div>
      </div>

      {/* ── Table ── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-navy-400">
          <RefreshCw size={24} className="animate-spin opacity-40 mb-3" />
          <span className="text-sm">Loading action queue...</span>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 text-emerald-500">
          <CheckCircle2 size={48} className="opacity-40 mb-4" />
          <div className="text-xl font-bold">{hasFilters || kpiFilter ? 'No Students Found' : '🎉 All Clear'}</div>
          <div className="text-sm text-slate-500 dark:text-navy-400 mt-2">
            {hasFilters || kpiFilter ? 'Try adjusting or clearing your filters to see more results.' : 'No students currently require faculty intervention.'}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-white/80 dark:bg-navy-800/80 border border-slate-200 dark:border-navy-700 backdrop-blur-sm overflow-hidden">
          <table className="w-full table-fixed">
            <colgroup>
              <col style={{ width: '22%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '20%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '7%' }} />
            </colgroup>
            <thead className="border-b border-slate-200 dark:border-navy-700 bg-slate-50/80 dark:bg-navy-900/50">
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
                const statusCls = STATUS_CONFIG[item.status] || 'bg-slate-100 text-slate-500 border border-slate-200';
                const isExpanded = expandedRow === item.id;
                return (
                  <React.Fragment key={item.id}>
                    <tr
                      onClick={() => setExpandedRow(isExpanded ? null : item.id)}
                      className={`cursor-pointer transition-colors ${isExpanded ? 'bg-brand-500/5' : 'hover:bg-slate-50 dark:hover:bg-navy-700/40'}`}
                    >
                      {/* Student */}
                      <td className={tdCls}>
                        <div className="font-semibold text-slate-800 dark:text-slate-100 truncate">{item.student_name}</div>
                        <div className="text-[10px] text-slate-400 dark:text-navy-400 truncate">{item.reg_no} · {item.department_code} · {item.year_level}</div>
                      </td>

                      {/* Priority */}
                      <td className={tdCls} onClick={e => e.stopPropagation()}>
                        <PriorityBadge priority={item.priority} score={item.priority_score} reason={item.priority_score_reason} />
                      </td>

                      {/* Stats */}
                      <td className={tdCls}>
                        <div className="text-[11px] text-slate-500 dark:text-navy-400 space-y-0.5">
                          <div>⭐ {item.current_rating}</div>
                          <div>🧩 {item.total_solved}</div>
                        </div>
                      </td>

                      {/* Signal */}
                      <td className={tdCls}>
                        <div className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug line-clamp-2">{item.signal_type}</div>
                        <div className="flex gap-1 flex-wrap mt-0.5">
                          {item.is_escalated && <span className="text-[9px] text-red-400 font-bold">🔺 ESC</span>}
                          {item.is_overdue_followup && <span className="text-[9px] text-pink-400 font-bold">⏰ {item.days_overdue}d overdue</span>}
                        </div>
                      </td>

                      {/* Status */}
                      <td className={tdCls}>
                        <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${statusCls}`}>{item.status}</span>
                      </td>

                      {/* Faculty */}
                      <td className={tdCls}>
                        <div className={`text-xs truncate ${item.assigned_faculty_name ? 'text-brand-500' : 'text-slate-400 dark:text-navy-500'}`}>
                          {item.assigned_faculty_name || '— Unassigned'}
                        </div>
                      </td>

                      {/* Due Date */}
                      <td className={tdCls}>
                        <div className="text-[11px] text-slate-400 dark:text-navy-400">{item.due_date || '—'}</div>
                      </td>

                      {/* Actions */}
                      <td className={tdCls} onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setUpdateItem(item)}
                            title="Take Action on Student"
                            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white transition cursor-pointer shadow-md shadow-violet-500/20 flex items-center gap-1.5 text-xs font-black"
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
                      <tr className="bg-brand-500/5 dark:bg-navy-900/60">
                        <td colSpan={8} className="px-5 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
                            <div>
                              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Recommended Action</div>
                              <div className="text-xs text-brand-600 dark:text-brand-400 font-bold">{item.recommended_action || '—'}</div>
                            </div>
                            <div>
                              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Action Taken</div>
                              <div className="text-xs text-slate-700 dark:text-slate-300">{item.action_taken || 'No action recorded yet'}</div>
                            </div>
                            <div>
                              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Faculty Notes</div>
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
      )}

      {/* ── Pagination ── */}
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

      {/* ── Modals ── */}
      {updateItem && <UpdateModal item={updateItem} onClose={() => setUpdateItem(null)} onSaved={loadData} />}
      {viewItem && <StudentViewModal item={viewItem} onClose={() => setViewItem(null)} onOpenUpdate={() => setUpdateItem(viewItem)} />}
    </div>
  );
};

export default FacultyActionCenter;

