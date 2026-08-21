import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert, AlertTriangle, CheckCircle2, Clock, Search, RefreshCw,
  ChevronDown, ChevronUp, X, Send, Activity, User,
  Calendar, Zap, FileText, ArrowUpRight, Bell, RotateCcw, Eye, Sparkles
} from 'lucide-react';
import {
  getFacultyActionKPIs, getFacultyActionsList, updateFacultyAction,
  escalateAction, getActionTimeline, triggerSignalDetection,
  FacultyActionKPIs, FacultyActionItem, ActionTimelineEvent, UpdateActionPayload
} from '../services/intelligenceService';

// ─── Priority Config ──────────────────────────────────────────────────────────
const PRIORITY_CONFIG: Record<string, { tw: string; dot: string; icon: React.ReactNode }> = {
  Critical: { tw: 'bg-red-500/15 text-red-400 border border-red-500/30',   dot: 'bg-red-400',    icon: <ShieldAlert size={11} /> },
  High:     { tw: 'bg-orange-500/15 text-orange-400 border border-orange-500/30', dot: 'bg-orange-400', icon: <AlertTriangle size={11} /> },
  Medium:   { tw: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30', dot: 'bg-yellow-400', icon: <Clock size={11} /> },
  Low:      { tw: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25', dot: 'bg-emerald-400', icon: <Activity size={11} /> },
};

const STATUS_CONFIG: Record<string, string> = {
  Pending:       'bg-violet-500/15 text-violet-400 border border-violet-500/25',
  'In Progress': 'bg-blue-500/15 text-blue-400 border border-blue-500/25',
  Monitoring:    'bg-amber-500/15 text-amber-400 border border-amber-500/25',
  Completed:     'bg-cyan-500/15 text-cyan-400 border border-cyan-500/25',
  Resolved:      'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25',
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
        <div className="absolute top-[110%] left-0 z-50 w-64 p-3 rounded-xl text-xs bg-slate-900 dark:bg-navy-900 border border-slate-700 dark:border-navy-700 shadow-2xl leading-relaxed pointer-events-none">
          <div className={`font-bold mb-1 ${cfg.tw.split(' ')[1]}`}>Score: {score}/100</div>
          <div className="text-slate-400">{reason}</div>
        </div>
      )}
    </div>
  );
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────
const KPICard: React.FC<{
  label: string; value: number; colorClass: string; icon: React.ReactNode;
  active: boolean; onClick: () => void; subtitle?: string;
}> = ({ label, value, colorClass, icon, active, onClick, subtitle }) => (
  <button
    onClick={onClick}
    className={`flex-1 min-w-[120px] text-left rounded-2xl p-4 border transition-all duration-200 cursor-pointer ${
      active
        ? `${colorClass} border-current shadow-lg`
        : 'bg-white/60 dark:bg-navy-800/60 border-slate-200 dark:border-navy-700 hover:bg-white dark:hover:bg-navy-800'
    }`}
  >
    <div className="flex items-center gap-2 mb-2">
      <span className={active ? '' : 'text-slate-400 dark:text-navy-400'}>{icon}</span>
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-navy-400">{label}</span>
    </div>
    <div className={`text-3xl font-black leading-none ${active ? '' : 'text-slate-800 dark:text-slate-100'}`}>{value}</div>
    {subtitle && <div className="text-[10px] text-slate-400 dark:text-navy-400 mt-1.5">{subtitle}</div>}
  </button>
);

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
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-navy-850 border border-slate-200 dark:border-navy-700 shadow-2xl overflow-hidden">

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
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inputCls}>
                {['Pending', 'In Progress', 'Monitoring', 'Completed', 'Resolved'].map(s => <option key={s}>{s}</option>)}
              </select>
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

// ─── Timeline Drawer ──────────────────────────────────────────────────────────
const TimelineDrawer: React.FC<{ actionId: number; studentName: string; onClose: () => void }> = ({ actionId, studentName, onClose }) => {
  const [events, setEvents] = useState<ActionTimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getActionTimeline(actionId).then(e => { setEvents(e); setLoading(false); }).catch(() => setLoading(false));
  }, [actionId]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-96 h-full overflow-y-auto bg-white dark:bg-navy-850 border-l border-slate-200 dark:border-navy-700 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-base font-bold text-slate-800 dark:text-slate-100">Intervention Timeline</div>
            <div className="text-xs text-slate-400 dark:text-navy-400">{studentName}</div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"><X size={18} /></button>
        </div>

        {loading ? (
          <div className="text-center text-slate-400 mt-10">Loading...</div>
        ) : events.length === 0 ? (
          <div className="text-center text-slate-400 mt-10">No events recorded yet.</div>
        ) : (
          <div className="relative">
            <div className="absolute left-4 top-2 bottom-2 w-px bg-slate-200 dark:bg-navy-700" />
            {events.map((ev, i) => {
              const colorCls = EVENT_COLOR[ev.event_type] || 'text-slate-400';
              return (
                <div key={ev.id} className="flex gap-4 mb-5">
                  <div className={`w-8 h-8 rounded-full border-2 border-current flex items-center justify-center text-xs font-bold flex-shrink-0 z-10 bg-white dark:bg-navy-850 ${colorCls}`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 bg-slate-50 dark:bg-navy-900/50 border border-slate-200 dark:border-navy-700 rounded-xl p-3">
                    <div className={`text-[11px] font-bold mb-0.5 ${colorCls}`}>{ev.event_type.replace(/_/g, ' ')}</div>
                    <div className="text-[10px] text-slate-400 dark:text-navy-400">by {ev.user_name} · {ev.timestamp}</div>
                    {(ev.previous_value || ev.new_value) && (
                      <div className="text-xs mt-1.5">
                        {ev.previous_value && <span className="line-through text-slate-400">{ev.previous_value}</span>}
                        {ev.previous_value && ev.new_value && ' → '}
                        {ev.new_value && <span className="text-brand-500">{ev.new_value}</span>}
                      </div>
                    )}
                    {ev.reason && <div className="text-[10px] text-slate-400 mt-1 italic">{ev.reason}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  // Sort
  const [sortBy, setSortBy] = useState('priority_score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Active KPI filter key
  const [kpiFilter, setKpiFilter] = useState('');

  // Modals
  const [updateItem, setUpdateItem] = useState<FacultyActionItem | null>(null);
  const [timelineItem, setTimelineItem] = useState<{ id: number; name: string } | null>(null);

  // Row expand
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, page_size: PAGE_SIZE, sort_by: sortBy, sort_dir: sortDir };
      if (filterPriority) params.priority = filterPriority;
      if (filterStatus) params.status = filterStatus;
      if (filterYear) params.year_level = filterYear;
      if (search.trim()) params.search = search.trim();

      const [kpiRes, listRes] = await Promise.all([getFacultyActionKPIs(), getFacultyActionsList(params)]);
      setKpis(kpiRes);
      setItems(listRes.items);
      setTotal(listRes.total);
    } catch (err) {
      console.error('Faculty Action Center load failed:', err);
    } finally {
      setLoading(false);
    }
  }, [page, sortBy, sortDir, filterPriority, filterStatus, filterYear, search]);

  useEffect(() => { loadData(); }, [loadData]);

  const applyKPIFilter = (key: string, type: 'priority' | 'status') => {
    const next = kpiFilter === key ? '' : key;
    setKpiFilter(next);
    if (type === 'priority') { setFilterPriority(next); setFilterStatus(''); }
    else { setFilterStatus(next); setFilterPriority(''); }
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

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasFilters = !!(filterPriority || filterStatus || filterYear || search);

  const thCls = "text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-navy-400 text-left py-3 px-3 first:pl-4";
  const tdCls = "py-3 px-3 text-sm first:pl-4";
  const filterSelectCls = "rounded-xl bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-brand-500 transition cursor-pointer";

  return (
    <div className="space-y-5 pb-12 animate-fade-in font-sans">
      {/* ── Executive Header Banner ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white p-6 sm:p-8 shadow-2xl border border-brand-500/30">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-80 h-80 bg-brand-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-brand-500/20 border border-brand-400/30 text-brand-300 text-xs font-black">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>REAL-TIME INTERVENTION & MENTORING HUB</span>
            </div>

            <h1 className="text-2xl sm:text-3xl xl:text-4xl font-black tracking-tight flex items-center gap-3">
              <ShieldAlert className="w-7 h-7 sm:w-8 sm:h-8 text-rose-400 stroke-[2.5]" />
              Faculty Action Center & <span className="bg-clip-text text-transparent bg-gradient-to-r from-rose-400 via-amber-300 to-brand-300">Mentoring Hub</span>
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
          <KPICard label="Critical" value={kpis.critical_count} colorClass="bg-red-500/10 text-red-500 border-red-500/30"
            icon={<ShieldAlert size={14} />} active={kpiFilter === 'Critical'} onClick={() => applyKPIFilter('Critical', 'priority')} subtitle="Immediate action" />
          <KPICard label="High" value={kpis.high_count} colorClass="bg-orange-500/10 text-orange-500 border-orange-500/30"
            icon={<AlertTriangle size={14} />} active={kpiFilter === 'High'} onClick={() => applyKPIFilter('High', 'priority')} subtitle="Urgent review" />
          <KPICard label="Monitoring" value={kpis.monitoring_count} colorClass="bg-amber-500/10 text-amber-500 border-amber-500/30"
            icon={<Activity size={14} />} active={kpiFilter === 'Monitoring'} onClick={() => applyKPIFilter('Monitoring', 'status')} />
          <KPICard label="In Progress" value={kpis.in_progress_count} colorClass="bg-blue-500/10 text-blue-500 border-blue-500/30"
            icon={<Zap size={14} />} active={kpiFilter === 'In Progress'} onClick={() => applyKPIFilter('In Progress', 'status')} />
          <KPICard label="Completed" value={kpis.completed_count} colorClass="bg-cyan-500/10 text-cyan-500 border-cyan-500/30"
            icon={<CheckCircle2 size={14} />} active={kpiFilter === 'Completed'} onClick={() => applyKPIFilter('Completed', 'status')} />
          <KPICard label="Resolved" value={kpis.resolved_count} colorClass="bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
            icon={<CheckCircle2 size={14} />} active={kpiFilter === 'Resolved'} onClick={() => applyKPIFilter('Resolved', 'status')} />
          <KPICard label="Overdue" value={kpis.overdue_count} colorClass="bg-pink-500/10 text-pink-500 border-pink-500/30"
            icon={<Bell size={14} />} active={false} onClick={() => {}} subtitle="Follow-up missed" />
          <KPICard label="Escalated" value={kpis.escalated_count} colorClass="bg-violet-500/10 text-violet-500 border-violet-500/30"
            icon={<ArrowUpRight size={14} />} active={false} onClick={() => {}} />
        </div>
      )}

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-2 items-center p-3 rounded-2xl bg-white/70 dark:bg-navy-800/70 border border-slate-200 dark:border-navy-700 backdrop-blur-sm">
        <div className="flex items-center gap-2 flex-1 min-w-[200px] bg-slate-100 dark:bg-navy-900 rounded-xl px-3 py-2 border border-transparent focus-within:border-brand-500 transition">
          <Search size={13} className="text-slate-400 flex-shrink-0" />
          <input
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name, reg no, username..."
            className="flex-1 bg-transparent text-sm text-slate-700 dark:text-slate-200 outline-none placeholder:text-slate-400"
          />
        </div>
        <select value={filterPriority} onChange={e => { setFilterPriority(e.target.value); setKpiFilter(e.target.value); setPage(1); }} className={filterSelectCls}>
          <option value="">All Priority</option>
          {['Critical', 'High', 'Medium', 'Low'].map(p => <option key={p}>{p}</option>)}
        </select>
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }} className={filterSelectCls}>
          <option value="">All Status</option>
          {['Pending', 'In Progress', 'Monitoring', 'Completed', 'Resolved'].map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={filterYear} onChange={e => { setFilterYear(e.target.value); setPage(1); }} className={filterSelectCls}>
          <option value="">All Years</option>
          {['II Year', 'III Year', 'IV Year'].map(y => <option key={y}>{y}</option>)}
        </select>
        {hasFilters && (
          <button onClick={() => { setFilterPriority(''); setFilterStatus(''); setFilterYear(''); setSearch(''); setKpiFilter(''); setPage(1); }}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-xs font-semibold hover:bg-red-500/20 transition">
            <X size={11} /> Clear
          </button>
        )}
        <span className="ml-auto text-xs text-slate-400 dark:text-navy-400 font-medium">{total} records</span>
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
          <div className="text-xl font-bold">🎉 All Clear</div>
          <div className="text-sm text-slate-500 dark:text-navy-400 mt-2">No students currently require faculty intervention.</div>
        </div>
      ) : (
        <div className="rounded-2xl bg-white/80 dark:bg-navy-800/80 border border-slate-200 dark:border-navy-700 backdrop-blur-sm overflow-hidden">
          <table className="w-full table-fixed">
            <colgroup>
              <col style={{ width: '18%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '20%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '8%' }} />
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
                        <div className="flex gap-1.5">
                          <button onClick={() => setUpdateItem(item)} title="Update"
                            className="p-1.5 rounded-lg bg-violet-500/10 border border-violet-500/25 text-violet-400 hover:bg-violet-500/20 transition">
                            <FileText size={12} />
                          </button>
                          <button onClick={() => setTimelineItem({ id: item.id, name: item.student_name })} title="Timeline"
                            className="p-1.5 rounded-lg bg-blue-500/10 border border-blue-500/25 text-blue-400 hover:bg-blue-500/20 transition">
                            <Eye size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded detail row */}
                    {isExpanded && (
                      <tr className="bg-brand-500/3 dark:bg-navy-900/40">
                        <td colSpan={8} className="px-5 py-3">
                          <div className="grid grid-cols-3 gap-5">
                            <div>
                              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-navy-400 mb-1">Recommended Action</div>
                              <div className="text-xs text-brand-500 italic">{item.recommended_action || '—'}</div>
                            </div>
                            <div>
                              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-navy-400 mb-1">Action Taken</div>
                              <div className="text-xs text-slate-600 dark:text-slate-300">{item.action_taken || '—'}</div>
                            </div>
                            <div>
                              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-navy-400 mb-1">Faculty Notes</div>
                              <div className="text-xs text-slate-600 dark:text-slate-300">{item.faculty_notes || '—'}</div>
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
      {timelineItem && <TimelineDrawer actionId={timelineItem.id} studentName={timelineItem.name} onClose={() => setTimelineItem(null)} />}
    </div>
  );
};

export default FacultyActionCenter;
