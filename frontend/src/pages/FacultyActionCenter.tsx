import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert, AlertTriangle, CheckCircle2, Clock, Search, RefreshCw,
  ChevronDown, ChevronUp, X, Send, AlertCircle, Activity, TrendingDown,
  User, Calendar, Zap, FileText, ArrowUpRight, Info, Bell, Filter,
  RotateCcw, Eye
} from 'lucide-react';
import {
  getFacultyActionKPIs, getFacultyActionsList, updateFacultyAction,
  updateActionStatus, escalateAction, getActionTimeline, triggerSignalDetection,
  FacultyActionKPIs, FacultyActionItem, ActionTimelineEvent, UpdateActionPayload
} from '../services/intelligenceService';

// ─── Priority Config ──────────────────────────────────────────────────────────
const PRIORITY_CONFIG: Record<string, { color: string; bg: string; border: string; icon: React.ReactNode; glow: string }> = {
  Critical: { color: '#ff4757', bg: 'rgba(255,71,87,0.12)', border: 'rgba(255,71,87,0.35)', icon: <ShieldAlert size={13} />, glow: '0 0 12px rgba(255,71,87,0.4)' },
  High:     { color: '#ff7f50', bg: 'rgba(255,127,80,0.12)', border: 'rgba(255,127,80,0.35)', icon: <AlertTriangle size={13} />, glow: '0 0 10px rgba(255,127,80,0.35)' },
  Medium:   { color: '#ffd32a', bg: 'rgba(255,211,42,0.12)', border: 'rgba(255,211,42,0.35)', icon: <Clock size={13} />, glow: '0 0 10px rgba(255,211,42,0.25)' },
  Low:      { color: '#7bed9f', bg: 'rgba(123,237,159,0.10)', border: 'rgba(123,237,159,0.3)', icon: <Activity size={13} />, glow: 'none' },
};

const STATUS_CONFIG: Record<string, { color: string; bg: string }> = {
  Pending:     { color: '#a29bfe', bg: 'rgba(162,155,254,0.15)' },
  'In Progress': { color: '#74b9ff', bg: 'rgba(116,185,255,0.15)' },
  Monitoring:  { color: '#ffd32a', bg: 'rgba(255,211,42,0.12)' },
  Completed:   { color: '#00d2d3', bg: 'rgba(0,210,211,0.12)' },
  Resolved:    { color: '#7bed9f', bg: 'rgba(123,237,159,0.12)' },
};

const EVENT_COLORS: Record<string, string> = {
  ACTION_CREATED: '#74b9ff',
  STATUS_CHANGED: '#a29bfe',
  FACULTY_ASSIGNED: '#55efc4',
  NOTE_ADDED: '#ffeaa7',
  FOLLOW_UP_SCHEDULED: '#fd79a8',
  ESCALATED: '#ff4757',
  RESOLVED: '#7bed9f',
  PRIORITY_CHANGED: '#ff7f50',
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────
const KPICard: React.FC<{
  label: string; value: number; color: string; icon: React.ReactNode;
  active: boolean; onClick: () => void; subtitle?: string;
}> = ({ label, value, color, icon, active, onClick, subtitle }) => (
  <button
    onClick={onClick}
    style={{
      background: active ? `rgba(${color},0.18)` : 'rgba(255,255,255,0.04)',
      border: `1.5px solid ${active ? `rgba(${color},0.6)` : 'rgba(255,255,255,0.08)'}`,
      borderRadius: 14, padding: '16px 20px', textAlign: 'left', cursor: 'pointer',
      transition: 'all 0.25s ease', boxShadow: active ? `0 0 20px rgba(${color},0.25)` : 'none',
      flex: 1, minWidth: 130,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <span style={{ color: `rgb(${color})`, opacity: 0.9 }}>{icon}</span>
      <span style={{ color: '#888', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</span>
    </div>
    <div style={{ fontSize: 30, fontWeight: 800, color: `rgb(${color})`, lineHeight: 1 }}>{value}</div>
    {subtitle && <div style={{ fontSize: 10, color: '#666', marginTop: 5 }}>{subtitle}</div>}
  </button>
);

// ─── Priority Badge ───────────────────────────────────────────────────────────
const PriorityBadge: React.FC<{ priority: string; score: number; reason: string }> = ({ priority, score, reason }) => {
  const [show, setShow] = useState(false);
  const cfg = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.Low;
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px',
          borderRadius: 20, background: cfg.bg, border: `1px solid ${cfg.border}`,
          color: cfg.color, fontSize: 11, fontWeight: 700, cursor: 'default',
          boxShadow: cfg.glow,
        }}
      >
        {cfg.icon} {priority} <span style={{ opacity: 0.75, fontSize: 10 }}>({score})</span>
      </span>
      {show && (
        <div style={{
          position: 'absolute', top: '110%', left: 0, zIndex: 999,
          background: '#1e1e2e', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 10, padding: '10px 14px', minWidth: 220, maxWidth: 300,
          fontSize: 11, color: '#ccc', lineHeight: 1.55, boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
        }}>
          <strong style={{ color: cfg.color }}>Score: {score}/100</strong>
          <div style={{ marginTop: 5 }}>{reason}</div>
        </div>
      )}
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
  const [escalating, setEscalating] = useState(false);
  const [escalateTo, setEscalateTo] = useState('HOD');
  const [escalateReason, setEscalateReason] = useState('');
  const [showEscalate, setShowEscalate] = useState(false);
  const [msg, setMsg] = useState('');

  const cfg = PRIORITY_CONFIG[item.priority] || PRIORITY_CONFIG.Low;

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateFacultyAction(item.id, form);
      setMsg('✅ Saved successfully');
      setTimeout(() => { onSaved(); onClose(); }, 800);
    } catch { setMsg('❌ Save failed'); }
    finally { setSaving(false); }
  };

  const handleEscalate = async () => {
    setEscalating(true);
    try {
      await escalateAction(item.id, escalateTo, escalateReason, form.updated_by_name);
      setMsg(`✅ Escalated to ${escalateTo}`);
      setTimeout(() => { onSaved(); onClose(); }, 800);
    } catch { setMsg('❌ Escalation failed'); }
    finally { setEscalating(false); }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: '#13131f', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 20, width: '100%', maxWidth: 660, maxHeight: '90vh',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: '0 30px 80px rgba(0,0,0,0.7)',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          background: `linear-gradient(135deg, ${cfg.bg} 0%, rgba(13,13,31,0) 100%)`,
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <PriorityBadge priority={item.priority} score={item.priority_score} reason={item.priority_score_reason} />
              {item.is_escalated && (
                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'rgba(255,71,87,0.2)', color: '#ff4757', fontWeight: 700 }}>
                  🔺 ESCALATED
                </span>
              )}
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', marginTop: 8 }}>{item.student_name}</div>
            <div style={{ fontSize: 12, color: '#888' }}>
              {item.reg_no} · {item.department_code} · {item.year_level} ·&nbsp;
              <span style={{ color: '#a29bfe' }}>@{item.leetcode_username}</span>
            </div>
            <div style={{ marginTop: 6, fontSize: 12, color: '#aaa', display: 'flex', gap: 16 }}>
              <span>🧩 {item.total_solved} solved</span>
              <span>⭐ {item.current_rating} rating</span>
              <span>🏆 {item.contests_attended} contests</span>
              <span>🕐 {item.last_active_days_ago}d ago</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        {/* Signal */}
        <div style={{ padding: '12px 24px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>Signal / Reason</div>
          <div style={{ fontSize: 13, color: '#e0e0e0', fontWeight: 600 }}>{item.signal_type}</div>
          <div style={{ fontSize: 12, color: '#74b9ff', marginTop: 4, fontStyle: 'italic' }}>
            💡 {item.recommended_action}
          </div>
        </div>

        {/* Form */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Status + Assigned */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={selectStyle}>
                {['Pending', 'In Progress', 'Monitoring', 'Completed', 'Resolved'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Assigned Faculty</label>
              <input value={form.assigned_faculty_name} onChange={e => setForm(f => ({ ...f, assigned_faculty_name: e.target.value }))} style={inputStyle} placeholder="Dr. / Prof. Name" />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Action Taken</label>
            <textarea value={form.action_taken} onChange={e => setForm(f => ({ ...f, action_taken: e.target.value }))} style={{ ...inputStyle, height: 70, resize: 'vertical' }} placeholder="Describe the action taken so far..." />
          </div>

          <div>
            <label style={labelStyle}>Faculty Notes</label>
            <textarea value={form.faculty_notes} onChange={e => setForm(f => ({ ...f, faculty_notes: e.target.value }))} style={{ ...inputStyle, height: 70, resize: 'vertical' }} placeholder="Private notes for faculty reference..." />
          </div>

          <div>
            <label style={labelStyle}>Evidence Remarks</label>
            <input value={form.evidence_remarks} onChange={e => setForm(f => ({ ...f, evidence_remarks: e.target.value }))} style={inputStyle} placeholder="e.g. Missed WC#515, no submission since Aug 10" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Updated By</label>
              <input value={form.updated_by_name} onChange={e => setForm(f => ({ ...f, updated_by_name: e.target.value }))} style={inputStyle} placeholder="Your name" />
            </div>
            <div>
              <label style={labelStyle}>Follow-up Date</label>
              <input type="date" value={form.follow_up_date || ''} onChange={e => setForm(f => ({ ...f, follow_up_date: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Next Review Date</label>
              <input type="date" value={form.next_review_date || ''} onChange={e => setForm(f => ({ ...f, next_review_date: e.target.value }))} style={inputStyle} />
            </div>
          </div>

          {/* Escalation */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14 }}>
            <button onClick={() => setShowEscalate(!showEscalate)} style={{ background: 'none', border: 'none', color: '#ff7f50', cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <ArrowUpRight size={14} /> {showEscalate ? 'Hide' : 'Escalate to HOD'}
            </button>
            {showEscalate && (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
                  <div>
                    <label style={labelStyle}>Escalate To</label>
                    <input value={escalateTo} onChange={e => setEscalateTo(e.target.value)} style={inputStyle} placeholder="HOD / Dean" />
                  </div>
                  <div>
                    <label style={labelStyle}>Escalation Reason</label>
                    <input value={escalateReason} onChange={e => setEscalateReason(e.target.value)} style={inputStyle} placeholder="No improvement despite 2 interventions..." />
                  </div>
                </div>
                <button onClick={handleEscalate} disabled={escalating} style={{ ...btnStyle, background: 'rgba(255,71,87,0.2)', border: '1px solid rgba(255,71,87,0.4)', color: '#ff4757', alignSelf: 'flex-start' }}>
                  {escalating ? '⏳ Escalating...' : '🔺 Confirm Escalation'}
                </button>
              </div>
            )}
          </div>

          {msg && <div style={{ fontSize: 13, color: msg.startsWith('✅') ? '#7bed9f' : '#ff4757', fontWeight: 600 }}>{msg}</div>}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ ...btnStyle, background: 'rgba(255,255,255,0.06)', color: '#aaa' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ ...btnStyle, background: 'linear-gradient(135deg,#6c63ff,#a29bfe)', color: '#fff', boxShadow: '0 4px 14px rgba(108,99,255,0.35)' }}>
            {saving ? '⏳ Saving...' : <><Send size={14} /> Save Changes</>}
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
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1001, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
      display: 'flex', justifyContent: 'flex-end',
    }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{
        width: 420, background: '#13131f', borderLeft: '1px solid rgba(255,255,255,0.1)',
        height: '100%', overflowY: 'auto', padding: '28px 24px',
        boxShadow: '-20px 0 60px rgba(0,0,0,0.5)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>Intervention Timeline</div>
            <div style={{ fontSize: 12, color: '#888' }}>{studentName}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}><X size={20} /></button>
        </div>

        {loading ? (
          <div style={{ color: '#888', textAlign: 'center', marginTop: 40 }}>Loading timeline...</div>
        ) : events.length === 0 ? (
          <div style={{ color: '#555', textAlign: 'center', marginTop: 40 }}>No events recorded yet.</div>
        ) : (
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: 16, top: 8, bottom: 8, width: 2, background: 'rgba(255,255,255,0.06)' }} />
            {events.map((ev, i) => {
              const color = EVENT_COLORS[ev.event_type] || '#888';
              return (
                <div key={ev.id} style={{ display: 'flex', gap: 16, marginBottom: 20, position: 'relative' }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', flexShrink: 0, zIndex: 1,
                    background: `rgba(${hexToRgb(color)},0.18)`, border: `2px solid ${color}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, color,
                  }}>
                    {i + 1}
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '10px 14px', flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color, marginBottom: 3 }}>
                      {ev.event_type.replace(/_/g, ' ')}
                    </div>
                    <div style={{ fontSize: 11, color: '#888' }}>by {ev.user_name} · {ev.timestamp}</div>
                    {(ev.previous_value || ev.new_value) && (
                      <div style={{ fontSize: 11, color: '#aaa', marginTop: 5 }}>
                        {ev.previous_value && <span style={{ textDecoration: 'line-through', opacity: 0.6 }}>{ev.previous_value}</span>}
                        {ev.previous_value && ev.new_value && ' → '}
                        {ev.new_value && <span style={{ color: '#74b9ff' }}>{ev.new_value}</span>}
                      </div>
                    )}
                    {ev.reason && <div style={{ fontSize: 11, color: '#666', marginTop: 4, fontStyle: 'italic' }}>{ev.reason}</div>}
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
const hexToRgb = (hex: string) => {
  const res = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return res ? `${parseInt(res[1], 16)},${parseInt(res[2], 16)},${parseInt(res[3], 16)}` : '255,255,255';
};

const labelStyle: React.CSSProperties = { fontSize: 11, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 5 };
const inputStyle: React.CSSProperties = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', color: '#e0e0e0', fontSize: 13, outline: 'none', boxSizing: 'border-box' };
const selectStyle: React.CSSProperties = { ...inputStyle, appearance: 'none' };
const btnStyle: React.CSSProperties = { padding: '9px 18px', borderRadius: 10, border: '1px solid transparent', cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6, transition: 'all 0.2s ease' };

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
  const [sortDir, setSortDir] = useState('desc');

  // Active KPI filter
  const [kpiFilter, setKpiFilter] = useState('');

  // Modals
  const [updateItem, setUpdateItem] = useState<FacultyActionItem | null>(null);
  const [timelineItem, setTimelineItem] = useState<{ id: number; name: string } | null>(null);

  // Row expand
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = {
        page, page_size: PAGE_SIZE,
        sort_by: sortBy, sort_dir: sortDir,
      };
      if (filterPriority) params.priority = filterPriority;
      if (filterStatus) params.status = filterStatus;
      if (filterYear) params.year_level = filterYear;
      if (search.trim()) params.search = search.trim();

      const [kpiRes, listRes] = await Promise.all([
        getFacultyActionKPIs(),
        getFacultyActionsList(params),
      ]);
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

  const handleKPIClick = (priority: string) => {
    setKpiFilter(prev => {
      const next = prev === priority ? '' : priority;
      setFilterPriority(next);
      setPage(1);
      return next;
    });
  };

  const handleStatusKPIClick = (status: string) => {
    setKpiFilter(prev => {
      const next = prev === status ? '' : status;
      setFilterStatus(next);
      setPage(1);
      return next;
    });
  };

  const handleSync = async () => {
    setSyncing(true); setSyncMsg('');
    try {
      const res = await triggerSignalDetection();
      setSyncMsg(`✅ ${res.new_signals_created} new signals, ${res.existing_signals_updated} updated`);
      await loadData();
    } catch {
      setSyncMsg('❌ Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleSort = (col: string) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('desc'); }
  };

  const SortIcon = ({ col }: { col: string }) =>
    sortBy === col ? (sortDir === 'desc' ? <ChevronDown size={12} /> : <ChevronUp size={12} />) : null;

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div style={{ minHeight: '100vh', background: '#0d0d1a', color: '#e0e0e0', fontFamily: "'Inter', sans-serif", padding: '28px 32px' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, background: 'linear-gradient(135deg,#a29bfe,#74b9ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Faculty Action Center
            </h1>
            <p style={{ margin: '6px 0 0', color: '#888', fontSize: 13 }}>
              {kpis?.subtitle || 'Real-time student intervention & mentoring management'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {syncMsg && <span style={{ fontSize: 12, color: syncMsg.startsWith('✅') ? '#7bed9f' : '#ff4757' }}>{syncMsg}</span>}
            <button onClick={handleSync} disabled={syncing} style={{ ...btnStyle, background: 'rgba(116,185,255,0.12)', border: '1px solid rgba(116,185,255,0.3)', color: '#74b9ff' }}>
              <RefreshCw size={14} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
              {syncing ? 'Syncing...' : 'Force Sync'}
            </button>
            <button onClick={loadData} style={{ ...btnStyle, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#aaa' }}>
              <RotateCcw size={14} /> Refresh
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      {kpis && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
          <KPICard label="Critical" value={kpis.critical_count} color="255,71,87" icon={<ShieldAlert size={16} />}
            active={kpiFilter === 'Critical'} onClick={() => handleKPIClick('Critical')} subtitle="Immediate action" />
          <KPICard label="High" value={kpis.high_count} color="255,127,80" icon={<AlertTriangle size={16} />}
            active={kpiFilter === 'High'} onClick={() => handleKPIClick('High')} subtitle="Urgent review" />
          <KPICard label="Monitoring" value={kpis.monitoring_count} color="255,211,42" icon={<Activity size={16} />}
            active={kpiFilter === 'Monitoring'} onClick={() => handleStatusKPIClick('Monitoring')} />
          <KPICard label="In Progress" value={kpis.in_progress_count} color="116,185,255" icon={<Zap size={16} />}
            active={kpiFilter === 'In Progress'} onClick={() => handleStatusKPIClick('In Progress')} />
          <KPICard label="Completed" value={kpis.completed_count} color="0,210,211" icon={<CheckCircle2 size={16} />}
            active={kpiFilter === 'Completed'} onClick={() => handleStatusKPIClick('Completed')} />
          <KPICard label="Resolved" value={kpis.resolved_count} color="123,237,159" icon={<CheckCircle2 size={16} />}
            active={kpiFilter === 'Resolved'} onClick={() => handleStatusKPIClick('Resolved')} />
          <KPICard label="Overdue" value={kpis.overdue_count} color="253,121,168" icon={<Bell size={16} />}
            active={false} onClick={() => {}} subtitle="Follow-up missed" />
          <KPICard label="Escalated" value={kpis.escalated_count} color="162,155,254" icon={<ArrowUpRight size={16} />}
            active={false} onClick={() => {}} />
        </div>
      )}

      {/* Filters */}
      <div style={{
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 14, padding: '14px 18px', marginBottom: 20,
        display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 220px' }}>
          <Search size={14} color="#666" />
          <input
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name, reg no, or username..."
            style={{ ...inputStyle, border: 'none', background: 'none', flex: 1 }}
          />
        </div>
        <select value={filterPriority} onChange={e => { setFilterPriority(e.target.value); setKpiFilter(e.target.value); setPage(1); }} style={{ ...selectStyle, width: 130 }}>
          <option value="">All Priority</option>
          {['Critical', 'High', 'Medium', 'Low'].map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }} style={{ ...selectStyle, width: 140 }}>
          <option value="">All Status</option>
          {['Pending', 'In Progress', 'Monitoring', 'Completed', 'Resolved'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterYear} onChange={e => { setFilterYear(e.target.value); setPage(1); }} style={{ ...selectStyle, width: 120 }}>
          <option value="">All Years</option>
          {['II Year', 'III Year', 'IV Year'].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        {(filterPriority || filterStatus || filterYear || search) && (
          <button onClick={() => { setFilterPriority(''); setFilterStatus(''); setFilterYear(''); setSearch(''); setKpiFilter(''); setPage(1); }}
            style={{ ...btnStyle, background: 'rgba(255,71,87,0.1)', border: '1px solid rgba(255,71,87,0.25)', color: '#ff4757', padding: '7px 12px', fontSize: 12 }}>
            <X size={12} /> Clear
          </button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#555' }}>{total} records</span>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#555' }}>
          <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', opacity: 0.5 }} />
          <div style={{ marginTop: 12 }}>Loading action queue...</div>
        </div>
      ) : items.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '80px 20px',
          background: 'rgba(123,237,159,0.05)', border: '1px solid rgba(123,237,159,0.15)',
          borderRadius: 20, color: '#7bed9f',
        }}>
          <CheckCircle2 size={48} style={{ opacity: 0.6, marginBottom: 16 }} />
          <div style={{ fontSize: 20, fontWeight: 700 }}>🎉 All Clear</div>
          <div style={{ fontSize: 14, color: '#888', marginTop: 8 }}>No students currently require faculty intervention.</div>
        </div>
      ) : (
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden' }}>
          {/* Table Header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '200px 140px 90px 160px 120px 130px 100px 110px',
            padding: '10px 16px', background: 'rgba(255,255,255,0.04)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            fontSize: 11, color: '#666', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6,
          }}>
            {[['Student', 'student_name'], ['Priority', 'priority_score'], ['Score', 'priority_score'], ['Signal', ''], ['Status', 'status'], ['Faculty', ''], ['Due Date', 'due_date'], ['Actions', '']].map(([label, col]) => (
              <div key={label} onClick={() => col && handleSort(col)} style={{ cursor: col ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 4, userSelect: 'none' }}>
                {label} {col && <SortIcon col={col} />}
              </div>
            ))}
          </div>

          {/* Rows */}
          {items.map((item) => {
            const statusCfg = STATUS_CONFIG[item.status] || { color: '#aaa', bg: 'rgba(170,170,170,0.1)' };
            const isExpanded = expandedRow === item.id;
            return (
              <React.Fragment key={item.id}>
                <div
                  onClick={() => setExpandedRow(isExpanded ? null : item.id)}
                  style={{
                    display: 'grid', gridTemplateColumns: '200px 140px 90px 160px 120px 130px 100px 110px',
                    padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)',
                    cursor: 'pointer', transition: 'background 0.15s',
                    background: isExpanded ? 'rgba(162,155,254,0.06)' : 'transparent',
                  }}
                  onMouseEnter={e => !isExpanded && ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)')}
                  onMouseLeave={e => !isExpanded && ((e.currentTarget as HTMLElement).style.background = 'transparent')}
                >
                  {/* Student */}
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#e0e0e0' }}>{item.student_name}</div>
                    <div style={{ fontSize: 11, color: '#666' }}>{item.reg_no} · {item.department_code} · {item.year_level}</div>
                  </div>

                  {/* Priority Badge */}
                  <div style={{ display: 'flex', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                    <PriorityBadge priority={item.priority} score={item.priority_score} reason={item.priority_score_reason} />
                  </div>

                  {/* Stats */}
                  <div style={{ fontSize: 11, color: '#888' }}>
                    <div>⭐ {item.current_rating}</div>
                    <div>🧩 {item.total_solved}</div>
                  </div>

                  {/* Signal */}
                  <div>
                    <div style={{ fontSize: 11, color: '#aaa', lineHeight: 1.4 }}>{item.signal_type}</div>
                    {item.is_escalated && <span style={{ fontSize: 10, color: '#ff4757', fontWeight: 700 }}>🔺 Escalated</span>}
                    {item.is_overdue_followup && <span style={{ fontSize: 10, color: '#fd79a8', fontWeight: 700, marginLeft: 4 }}>⏰ {item.days_overdue}d overdue</span>}
                  </div>

                  {/* Status */}
                  <div>
                    <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 20, background: statusCfg.bg, color: statusCfg.color, fontWeight: 600 }}>
                      {item.status}
                    </span>
                  </div>

                  {/* Faculty */}
                  <div style={{ fontSize: 11, color: item.assigned_faculty_name ? '#74b9ff' : '#444' }}>
                    {item.assigned_faculty_name || '— Unassigned'}
                  </div>

                  {/* Due Date */}
                  <div style={{ fontSize: 11, color: '#888' }}>
                    {item.due_date || '—'}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => setUpdateItem(item)}
                      title="Update"
                      style={{ background: 'rgba(162,155,254,0.15)', border: '1px solid rgba(162,155,254,0.3)', borderRadius: 8, padding: '5px 8px', cursor: 'pointer', color: '#a29bfe', display: 'flex', alignItems: 'center' }}>
                      <FileText size={13} />
                    </button>
                    <button
                      onClick={() => setTimelineItem({ id: item.id, name: item.student_name })}
                      title="Timeline"
                      style={{ background: 'rgba(116,185,255,0.12)', border: '1px solid rgba(116,185,255,0.25)', borderRadius: 8, padding: '5px 8px', cursor: 'pointer', color: '#74b9ff', display: 'flex', alignItems: 'center' }}>
                      <Eye size={13} />
                    </button>
                  </div>
                </div>

                {/* Expanded row */}
                {isExpanded && (
                  <div style={{ padding: '16px 24px', background: 'rgba(162,155,254,0.04)', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 11, color: '#666', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Recommended Action</div>
                      <div style={{ fontSize: 12, color: '#74b9ff', fontStyle: 'italic' }}>{item.recommended_action}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: '#666', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Action Taken</div>
                      <div style={{ fontSize: 12, color: '#aaa' }}>{item.action_taken || '—'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: '#666', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Faculty Notes</div>
                      <div style={{ fontSize: 12, color: '#aaa' }}>{item.faculty_notes || '—'}</div>
                    </div>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 20 }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ ...btnStyle, background: 'rgba(255,255,255,0.05)', color: page === 1 ? '#333' : '#aaa', border: '1px solid rgba(255,255,255,0.08)' }}>← Prev</button>
          <span style={{ padding: '9px 16px', fontSize: 13, color: '#888' }}>Page {page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ ...btnStyle, background: 'rgba(255,255,255,0.05)', color: page === totalPages ? '#333' : '#aaa', border: '1px solid rgba(255,255,255,0.08)' }}>Next →</button>
        </div>
      )}

      {/* Modals */}
      {updateItem && (
        <UpdateModal item={updateItem} onClose={() => setUpdateItem(null)} onSaved={loadData} />
      )}
      {timelineItem && (
        <TimelineDrawer actionId={timelineItem.id} studentName={timelineItem.name} onClose={() => setTimelineItem(null)} />
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        select option { background: #1a1a2e; color: #e0e0e0; }
      `}</style>
    </div>
  );
};

export default FacultyActionCenter;
