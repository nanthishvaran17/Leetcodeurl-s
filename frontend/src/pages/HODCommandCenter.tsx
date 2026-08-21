import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2, RefreshCw, Sparkles, Sliders, Search, Send, Plus,
  Pencil, Trash2, UserCheck, ChevronDown, ChevronUp, X, CheckCircle2,
  AlertTriangle, Users, Activity, TrendingUp, ShieldAlert, BarChart3,
  ArrowUpRight, ArrowDownRight, Star, Zap, BookOpen, RotateCcw
} from 'lucide-react';
import {
  getCommandCenterSummary, getCommandCenterStudents, addStudent, updateStudent,
  deleteStudent, reactivateStudent, getCommandCenterDepartments, askCommandCenterAI,
  CommandCenterSummary, StudentRecord, DeptBenchmark, YearBenchmark, DepartmentRecord,
  StudentAddPayload, StudentUpdatePayload
} from '../services/commandCenterService';
import {
  simulateWhatIfScenario, askAIDepartmentQuery
} from '../services/intelligenceService';

// ─── Shared Components ────────────────────────────────────────────────────────

const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-white dark:bg-navy-900 rounded-3xl border border-slate-200 dark:border-navy-700 shadow-lg ${className}`}>
    {children}
  </div>
);

const SectionHeader: React.FC<{
  icon: React.ReactNode; title: string; subtitle: string;
  color?: string; right?: React.ReactNode;
}> = ({ icon, title, subtitle, color = 'text-brand-500', right }) => (
  <div className="flex items-center justify-between gap-4 flex-wrap">
    <div className="flex items-center gap-3">
      <div className={`p-2.5 rounded-2xl bg-current/10 ${color}`}>{icon}</div>
      <div>
        <h2 className="text-base font-black text-slate-800 dark:text-slate-100">{title}</h2>
        <p className="text-[11px] text-slate-500 dark:text-navy-400 font-medium">{subtitle}</p>
      </div>
    </div>
    {right}
  </div>
);

const ScorePill: React.FC<{ value: number; size?: 'sm' | 'lg' }> = ({ value, size = 'sm' }) => {
  const color = value >= 80 ? 'text-emerald-500' : value >= 65 ? 'text-amber-500' : 'text-red-500';
  const bg    = value >= 80 ? 'bg-emerald-500/10 border-emerald-500/25' : value >= 65 ? 'bg-amber-500/10 border-amber-500/25' : 'bg-red-500/10 border-red-500/25';
  return (
    <span className={`inline-flex items-center gap-1 font-black border rounded-xl ${bg} ${color} ${size === 'lg' ? 'px-4 py-1.5 text-lg' : 'px-2.5 py-1 text-xs'}`}>
      {value} <span className="font-medium opacity-60 text-xs">/ 100</span>
    </span>
  );
};

const ProgressBar: React.FC<{ value: number; color: string; label: string; score: number }> = ({ value, color, label, score }) => (
  <div>
    <div className="flex justify-between text-[10px] font-bold text-slate-500 dark:text-navy-400 mb-1">
      <span>{label}</span>
      <strong className={color}>{score}%</strong>
    </div>
    <div className="h-1.5 rounded-full bg-slate-200 dark:bg-navy-700 overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-700 ${color.replace('text-', 'bg-')}`} style={{ width: `${Math.max(2, value)}%` }} />
    </div>
  </div>
);

// ─── Add/Edit Student Modal ───────────────────────────────────────────────────

const StudentModal: React.FC<{
  mode: 'add' | 'edit';
  student?: StudentRecord;
  departments: DepartmentRecord[];
  onClose: () => void;
  onSaved: () => void;
}> = ({ mode, student, departments, onClose, onSaved }) => {
  const [form, setForm] = useState({
    reg_no:            student?.reg_no || '',
    name:              student?.name || '',
    department_id:     student?.department_id?.toString() || '',
    year_level:        student?.year_level || 'II',
    leetcode_username: student?.leetcode_username || '',
    email:             student?.email || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const inputCls = "w-full rounded-xl bg-slate-100 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 px-3 py-2.5 text-sm text-slate-800 dark:text-slate-200 outline-none focus:border-brand-500 transition";
  const labelCls = "block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-navy-400 mb-1.5";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError(''); setSuccess('');

    try {
      if (mode === 'add') {
        if (!form.reg_no || !form.name || !form.department_id || !form.leetcode_username) {
          setError('Reg No, Name, Department, and LeetCode Username are required.'); setSaving(false); return;
        }
        const res = await addStudent({
          reg_no:            form.reg_no.trim().toUpperCase(),
          name:              form.name.trim(),
          department_id:     Number(form.department_id),
          year_level:        form.year_level,
          leetcode_username: form.leetcode_username.trim().toLowerCase(),
          email:             form.email || undefined,
        });
        setSuccess(res.message);
        setTimeout(() => { onSaved(); onClose(); }, 1000);
      } else {
        // Edit mode — only send changed fields
        const payload: StudentUpdatePayload = {};
        if (form.name !== student?.name) payload.name = form.name;
        if (form.department_id && Number(form.department_id) !== student?.department_id) payload.department_id = Number(form.department_id);
        if (form.year_level !== student?.year_level) payload.year_level = form.year_level;
        if (form.leetcode_username !== student?.leetcode_username) payload.leetcode_username = form.leetcode_username;
        if (form.email !== student?.email) payload.email = form.email;

        const res = await updateStudent(student!.reg_no, payload);
        setSuccess(res.message + (res.resync_pending ? ' (LeetCode re-sync queued)' : ''));
        setTimeout(() => { onSaved(); onClose(); }, 1000);
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Operation failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
         onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-navy-850 border border-slate-200 dark:border-navy-700 shadow-2xl overflow-hidden">

        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900/50">
          <div>
            <h3 className="font-black text-slate-800 dark:text-slate-100">
              {mode === 'add' ? '➕ Add New Student' : `✏️ Edit — ${student?.name}`}
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {mode === 'add' ? 'LeetCode username will be validated via LeetCode API.' : 'Only changed fields are updated.'}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Reg No *</label>
              <input value={form.reg_no} onChange={e => setForm(f => ({ ...f, reg_no: e.target.value }))}
                className={inputCls} placeholder="e.g. 22CSA001" disabled={mode === 'edit'} required />
            </div>
            <div>
              <label className={labelCls}>Year *</label>
              <select value={form.year_level} onChange={e => setForm(f => ({ ...f, year_level: e.target.value }))} className={inputCls}>
                {['II', 'III', 'IV'].map(y => <option key={y} value={y}>{y} Year</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Full Name *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className={inputCls} placeholder="e.g. Aakash Kumar S" required />
          </div>

          <div>
            <label className={labelCls}>Department *</label>
            <select value={form.department_id} onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))} className={inputCls} required>
              <option value="">Select Department</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name} ({d.code})</option>)}
            </select>
          </div>

          <div>
            <label className={labelCls}>LeetCode Username *</label>
            <input value={form.leetcode_username} onChange={e => setForm(f => ({ ...f, leetcode_username: e.target.value.toLowerCase() }))}
              className={inputCls} placeholder="e.g. aakash_kumar" required />
          </div>

          <div>
            <label className={labelCls}>Email (optional)</label>
            <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className={inputCls} type="email" placeholder="student@nandhaengg.org" />
          </div>

          {error   && <div className="text-red-400 text-xs font-semibold bg-red-500/10 border border-red-500/25 rounded-xl px-3 py-2">{error}</div>}
          {success && <div className="text-emerald-400 text-xs font-semibold bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-3 py-2">✅ {success}</div>}

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-200 dark:border-navy-700">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 text-sm font-semibold hover:bg-slate-200 dark:hover:bg-navy-700 transition">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="px-5 py-2 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition flex items-center gap-2 shadow-md disabled:opacity-60">
              {saving ? <><RefreshCw size={13} className="animate-spin" /> Processing...</> : mode === 'add' ? '➕ Add Student' : '💾 Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

const DeleteConfirmModal: React.FC<{ student: StudentRecord; onClose: () => void; onConfirm: () => void; deleting: boolean }> = ({ student, onClose, onConfirm, deleting }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
    <div className="w-full max-w-md rounded-2xl bg-white dark:bg-navy-850 border border-slate-200 dark:border-navy-700 shadow-2xl p-6 text-center">
      <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
        <Trash2 size={24} className="text-red-400" />
      </div>
      <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-1">Deactivate Student?</h3>
      <p className="text-sm text-slate-500 dark:text-navy-400 mb-2">
        <strong className="text-slate-700 dark:text-slate-200">{student.name}</strong> ({student.reg_no})
      </p>
      <p className="text-xs text-slate-400 dark:text-navy-400 mb-6">
        This is a soft-delete. Historical contest evidence is preserved. The student can be reactivated later.
      </p>
      <div className="flex gap-3 justify-center">
        <button onClick={onClose} className="px-5 py-2 rounded-xl bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 text-sm font-semibold hover:bg-slate-200 transition">
          Cancel
        </button>
        <button onClick={onConfirm} disabled={deleting} className="px-5 py-2 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition flex items-center gap-2 disabled:opacity-60">
          {deleting ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />} Deactivate
        </button>
      </div>
    </div>
  </div>
);

// ─── Main Page ────────────────────────────────────────────────────────────────

const TABS = ['Overview', 'Student CRUD', 'Benchmarks', 'What-If', 'AI Query'] as const;
type Tab = typeof TABS[number];

export const HODCommandCenter: React.FC = () => {
  const [tab, setTab] = useState<Tab>('Overview');
  const [summary, setSummary] = useState<CommandCenterSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Students state
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [studentsTotal, setStudentsTotal] = useState(0);
  const [studentsPage, setStudentsPage] = useState(1);
  const [studentsSearch, setStudentsSearch] = useState('');
  const [studentsYear, setStudentsYear] = useState('');
  const [studentsDept, setStudentsDept] = useState('');
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [showModal, setShowModal] = useState<'add' | 'edit' | null>(null);
  const [editStudent, setEditStudent] = useState<StudentRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StudentRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  // What-If state
  const [targetPart, setTargetPart] = useState(87);
  const [scenarioResult, setScenarioResult] = useState<any>(null);

  // AI Query state
  const [queryText, setQueryText] = useState('');
  const [queryResponse, setQueryResponse] = useState<any>(null);
  const [queryLoading, setQueryLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadSummary = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true); else setRefreshing(true);
    setLoadError(null);
    try {
      const data = await getCommandCenterSummary();
      setSummary(data);
      // Init what-if simulation
      const hp = data.department_health;
      if (hp) {
        const sim = await simulateWhatIfScenario(hp.participation_score, targetPart, hp.at_risk_count);
        setScenarioResult(sim);
      }
    } catch (err: any) {
      console.error('HOD summary load failed:', err);
      setLoadError(err?.message || 'Failed to connect to database analytics engine');
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [targetPart]);

  const loadStudents = useCallback(async () => {
    setStudentsLoading(true);
    try {
      const res = await getCommandCenterStudents({
        page: studentsPage, page_size: 15,
        search: studentsSearch || undefined,
        dept_id: studentsDept ? Number(studentsDept) : undefined,
        year_level: studentsYear || undefined,
      });
      setStudents(res.students || []);
      setStudentsTotal(res.total || 0);
    } catch (err) {
      console.error('Students load failed:', err);
    } finally {
      setStudentsLoading(false);
    }
  }, [studentsPage, studentsSearch, studentsDept, studentsYear]);

  useEffect(() => { loadSummary(); getCommandCenterDepartments().then(setDepartments).catch(() => {}); }, []);
  useEffect(() => { if (tab === 'Student CRUD') loadStudents(); }, [tab, studentsPage, studentsSearch, studentsDept, studentsYear, loadStudents]);

  // Auto-refresh every 60s
  useEffect(() => {
    const interval = setInterval(() => loadSummary(true), 60000);
    return () => clearInterval(interval);
  }, [loadSummary]);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteStudent(deleteTarget.reg_no);
      setDeleteTarget(null);
      loadStudents();
    } catch (err) { console.error(err); }
    finally { setDeleting(false); }
  };

  const handleSimulate = async (val: number) => {
    setTargetPart(val);
    if (!summary) return;
    const hp = summary.department_health;
    if (hp) {
      const sim = await simulateWhatIfScenario(hp.participation_score, val, hp.at_risk_count);
      setScenarioResult(sim);
    }
  };

  const handleAIQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!queryText.trim()) return;
    setQueryLoading(true);
    try {
      const res = await askAIDepartmentQuery(queryText);
      setQueryResponse(res);
    } catch (err) { console.error(err); }
    finally { setQueryLoading(false); }
  };

  const thCls = "py-2.5 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-navy-400 text-left first:pl-4 last:pr-4";
  const tdCls = "py-3 px-3 text-sm first:pl-4 last:pr-4";

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <RefreshCw size={28} className="animate-spin mb-4 text-brand-500" />
        <p className="text-sm font-semibold">Computing institutional intelligence from database...</p>
      </div>
    );
  }

  const health  = summary?.department_health;
  const execSum = summary?.executive_summary;
  const deptMatrix: DeptBenchmark[] = summary?.benchmarks?.department_matrix || [];
  const yearMatrix: YearBenchmark[] = summary?.benchmarks?.year_matrix || [];

  return (
    <div className="space-y-5 pb-12 animate-fade-in font-sans">

      {/* ── Executive Header Banner ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white p-6 sm:p-8 shadow-2xl border border-brand-500/30">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-80 h-80 bg-brand-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-brand-500/20 border border-brand-400/30 text-brand-300 text-xs font-black">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>EXECUTIVE INTELLIGENCE ENGINE</span>
            </div>

            <h1 className="text-2xl sm:text-3xl xl:text-4xl font-black tracking-tight flex items-center gap-3">
              <Building2 className="w-7 h-7 sm:w-8 sm:h-8 text-brand-400 stroke-[2.5]" />
              Department Coding <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-400 via-indigo-300 to-cyan-300">Command Center</span>
            </h1>

            <p className="text-xs md:text-sm text-gray-300 font-medium leading-relaxed">
              Coding Health Score (0-100) • Institutional Benchmarking • What-If Simulator • AI Query • {summary?.refreshed_at || 'Live Ground Truth'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => loadSummary(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-navy-900/90 hover:bg-navy-800 text-white text-xs font-bold border border-gray-700/80 backdrop-blur-md shadow-inner transition-all cursor-pointer"
              title="Refresh Intelligence Data"
            >
              <RotateCcw size={14} className={refreshing ? 'animate-spin text-brand-400' : 'text-gray-300'} />
              <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Error Alert if summary failed */}
      {loadError && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} />
            <span>{loadError}</span>
          </div>
          <button onClick={() => loadSummary()} className="px-3 py-1 bg-rose-500 text-white rounded-xl text-xs font-bold hover:bg-rose-600">
            Retry
          </button>
        </div>
      )}

      {/* ── TABS ── */}
      <div className="flex gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 w-fit">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tab === t ? 'bg-white dark:bg-navy-700 text-brand-500 shadow-sm' : 'text-slate-500 dark:text-navy-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 1: OVERVIEW — Health Score Hero + Executive Summary
          ════════════════════════════════════════════════════════════════════ */}
      {tab === 'Overview' && (
        health ? (
          <>
            {/* Health Score Hero */}
            <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white border border-navy-800 shadow-2xl">
              <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, rgba(99,102,241,0.3) 0%, transparent 60%)' }} />
              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-2">
                  <span className="inline-block px-3 py-1 rounded-xl text-[10px] font-black bg-brand-500/20 text-brand-400 border border-brand-500/30 uppercase tracking-wider">
                    NANDHA ENGINEERING COLLEGE · LIVE CODING HEALTH SCORE
                  </span>
                  <div className="flex items-baseline gap-3">
                    <span className="text-5xl font-black">{health.health_score}</span>
                    <span className="text-xl text-slate-400 font-bold">/ 100</span>
                  </div>
                  <p className="text-xs text-slate-300">Computed from {health.total_students} active students across 5 weighted institutional dimensions.</p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Total Students', value: health.total_students, color: 'text-white' },
                    { label: 'Active (Solved > 0)', value: health.active_this_week, color: 'text-emerald-400' },
                    { label: 'At-Risk', value: health.at_risk_count, color: 'text-rose-400' },
                    { label: 'Improving', value: health.improving_count, color: 'text-indigo-400' },
                  ].map(kpi => (
                    <div key={kpi.label} className="bg-white/5 backdrop-blur-md rounded-2xl p-3.5 border border-white/10 text-center">
                      <div className="text-[9px] font-extrabold uppercase text-slate-400 mb-0.5">{kpi.label}</div>
                      <div className={`text-2xl font-black ${kpi.color}`}>{kpi.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 5 Dimension Bars */}
              <div className="relative z-10 grid grid-cols-5 gap-4 pt-5 mt-5 border-t border-white/10 text-xs">
                {[
                  { label: 'Participation', score: health.participation_score, color: 'text-brand-400' },
                  { label: 'Consistency', score: health.consistency_score, color: 'text-emerald-400' },
                  { label: 'Growth', score: health.growth_score, color: 'text-indigo-400' },
                  { label: 'Contest Perf.', score: health.contest_performance_score, color: 'text-purple-400' },
                  { label: 'Difficulty', score: health.difficulty_progress_score, color: 'text-amber-400' },
                ].map(dim => (
                  <div key={dim.label}>
                    <div className="flex justify-between font-bold text-slate-300 mb-1">
                      <span>{dim.label}</span><strong className={dim.color}>{dim.score}%</strong>
                    </div>
                    <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${dim.color.replace('text-', 'bg-')}`} style={{ width: `${dim.score}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Executive Summary */}
            {execSum && (
              <Card className="p-6 space-y-4">
                <SectionHeader icon={<Sparkles size={20} />} title={execSum.executive_title} subtitle={`DB-derived intelligence · ${execSum.timestamp}`} color="text-indigo-500" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {[
                    { key: 'what_improved', label: '✅ What Improved', color: 'bg-emerald-500/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' },
                    { key: 'what_declined', label: '⚠️ What Declined', color: 'bg-red-500/5 border-red-500/20 text-red-600 dark:text-red-400' },
                    { key: 'weakest_skill', label: '🎯 Weakest Skill Gap', color: 'bg-amber-500/5 border-amber-500/20 text-amber-600 dark:text-amber-400' },
                    { key: 'recommended_intervention', label: '💡 Recommended Action', color: 'bg-brand-500/5 border-brand-500/20 text-brand-600 dark:text-brand-400' },
                  ].map(({ key, label, color }) => (
                    <div key={key} className={`p-4 rounded-2xl border ${color.split(' ').slice(0, 2).join(' ')}`}>
                      <span className={`font-black uppercase tracking-wider text-[10px] block mb-1 ${color.split(' ').slice(2).join(' ')}`}>{label}</span>
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-medium">{(execSum as any)[key]}</p>
                    </div>
                  ))}
                </div>
                <div className="bg-slate-50 dark:bg-navy-900/50 rounded-2xl border border-slate-200 dark:border-navy-700 p-4 text-xs">
                  <span className="font-black uppercase tracking-wider text-slate-400 dark:text-navy-400 text-[10px] block mb-1">📋 Management Action Item</span>
                  <p className="text-slate-700 dark:text-slate-300 font-semibold">{execSum.management_action_item}</p>
                </div>
              </Card>
            )}
          </>
        ) : (
          <Card className="p-8 text-center space-y-3">
            <p className="text-slate-500 text-sm font-semibold">No summary data available.</p>
            <button onClick={() => loadSummary()} className="px-4 py-2 bg-brand-500 text-white rounded-xl text-xs font-bold hover:bg-brand-600">
              Refresh Data
            </button>
          </Card>
        )
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 2: STUDENT CRUD
          ════════════════════════════════════════════════════════════════════ */}
      {tab === 'Student CRUD' && (
        <Card className="overflow-hidden">
          {/* Toolbar */}
          <div className="p-4 border-b border-slate-200 dark:border-navy-700 flex flex-wrap gap-3 items-center">
            <SectionHeader icon={<Users size={18} />} title="Student Roster Management" subtitle={`${studentsTotal} total records · CRUD operations`} color="text-violet-500" />
            <div className="ml-auto flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2 bg-slate-100 dark:bg-navy-800 rounded-xl px-3 py-2 border border-slate-200 dark:border-navy-700 focus-within:border-brand-500 transition">
                <Search size={13} className="text-slate-400" />
                <input value={studentsSearch} onChange={e => { setStudentsSearch(e.target.value); setStudentsPage(1); }}
                  placeholder="Search name / reg no / username..." className="bg-transparent text-sm text-slate-700 dark:text-slate-200 outline-none w-48 placeholder:text-slate-400" />
              </div>
              <select value={studentsYear} onChange={e => { setStudentsYear(e.target.value); setStudentsPage(1); }}
                className="rounded-xl bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 outline-none cursor-pointer">
                <option value="">All Years</option>
                {['II', 'III', 'IV'].map(y => <option key={y} value={y}>{y} Year</option>)}
              </select>
              <select value={studentsDept} onChange={e => { setStudentsDept(e.target.value); setStudentsPage(1); }}
                className="rounded-xl bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 outline-none cursor-pointer">
                <option value="">All Depts</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.code}</option>)}
              </select>
              <button onClick={() => { setEditStudent(null); setShowModal('add'); }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition shadow-md">
                <Plus size={13} /> Add Student
              </button>
            </div>
          </div>

          {/* Table */}
          {studentsLoading ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <RefreshCw size={20} className="animate-spin mr-2" /> Loading...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full table-fixed">
                <colgroup>
                  <col style={{ width: '14%' }} /><col style={{ width: '18%' }} />
                  <col style={{ width: '8%' }} /><col style={{ width: '14%' }} />
                  <col style={{ width: '12%' }} /><col style={{ width: '10%' }} />
                  <col style={{ width: '8%' }} /><col style={{ width: '8%' }} />
                  <col style={{ width: '8%' }} />
                </colgroup>
                <thead className="border-b border-slate-200 dark:border-navy-700 bg-slate-50/80 dark:bg-navy-900/50">
                  <tr>
                    {['Reg No', 'Name', 'Year', 'Department', 'LeetCode', 'Solved', 'Rating', 'Updated', 'Actions'].map(h => (
                      <th key={h} className={thCls}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-navy-700/60">
                  {students.map(s => {
                    const isExpanded = expandedRow === s.id;
                    return (
                      <React.Fragment key={s.id}>
                        <tr onClick={() => setExpandedRow(isExpanded ? null : s.id)}
                          className={`cursor-pointer transition-colors ${isExpanded ? 'bg-brand-500/5' : 'hover:bg-slate-50 dark:hover:bg-navy-700/30'}`}>
                          <td className={tdCls}><span className="font-mono text-xs text-brand-500">{s.reg_no}</span></td>
                          <td className={tdCls}><span className="font-semibold text-slate-800 dark:text-slate-100 truncate block">{s.name}</span></td>
                          <td className={tdCls}><span className="text-xs text-slate-500 dark:text-navy-400">{s.year_level} Yr</span></td>
                          <td className={tdCls}><span className="text-xs truncate block text-slate-600 dark:text-slate-300">{s.department_code}</span></td>
                          <td className={tdCls}><span className="text-xs text-brand-500 truncate block">@{s.leetcode_username || '—'}</span></td>
                          <td className={tdCls}><span className="font-bold text-slate-700 dark:text-slate-200">{s.total_solved}</span></td>
                          <td className={tdCls}><span className="font-bold text-indigo-500">{s.contest_rating || '—'}</span></td>
                          <td className={tdCls}><span className="text-[10px] text-slate-400">{s.last_updated}</span></td>
                          <td className={`${tdCls}`} onClick={e => e.stopPropagation()}>
                            <div className="flex gap-1.5">
                              <button onClick={() => { setEditStudent(s); setShowModal('edit'); }}
                                title="Edit" className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-400 hover:bg-amber-500/20 transition">
                                <Pencil size={11} />
                              </button>
                              <button onClick={() => setDeleteTarget(s)}
                                title="Deactivate" className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/25 text-red-400 hover:bg-red-500/20 transition">
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-brand-500/3 dark:bg-navy-900/40">
                            <td colSpan={9} className="px-5 py-3">
                              <div className="grid grid-cols-4 gap-4 text-xs">
                                <div><span className="text-slate-400 block text-[10px] uppercase font-bold mb-0.5">Easy</span><span className="font-bold text-emerald-500">{s.easy_solved}</span></div>
                                <div><span className="text-slate-400 block text-[10px] uppercase font-bold mb-0.5">Medium</span><span className="font-bold text-amber-500">{s.medium_solved}</span></div>
                                <div><span className="text-slate-400 block text-[10px] uppercase font-bold mb-0.5">Hard</span><span className="font-bold text-red-500">{s.hard_solved}</span></div>
                                <div><span className="text-slate-400 block text-[10px] uppercase font-bold mb-0.5">Email</span><span className="text-slate-600 dark:text-slate-300">{s.email || '—'}</span></div>
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

          {/* Pagination */}
          {studentsTotal > 15 && (
            <div className="flex items-center justify-center gap-3 py-4 border-t border-slate-200 dark:border-navy-700">
              <button onClick={() => setStudentsPage(p => Math.max(1, p - 1))} disabled={studentsPage === 1}
                className="px-4 py-2 rounded-xl bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-sm font-semibold disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-navy-700 transition text-slate-600 dark:text-slate-300">
                ← Prev
              </button>
              <span className="text-sm text-slate-500 dark:text-navy-400">Page {studentsPage} / {Math.ceil(studentsTotal / 15)}</span>
              <button onClick={() => setStudentsPage(p => p + 1)} disabled={studentsPage >= Math.ceil(studentsTotal / 15)}
                className="px-4 py-2 rounded-xl bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-sm font-semibold disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-navy-700 transition text-slate-600 dark:text-slate-300">
                Next →
              </button>
            </div>
          )}
        </Card>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 3: BENCHMARKS — Real DB-driven Dept + Year Matrix
          ════════════════════════════════════════════════════════════════════ */}
      {tab === 'Benchmarks' && (
        <div className="space-y-5">
          {/* Department Matrix */}
          <Card className="p-6 space-y-4">
            <SectionHeader icon={<BarChart3 size={18} />} title="Department Benchmarking Matrix" subtitle="Live DB · Avg Rating, Solved, Participation, Health Score" color="text-blue-500" />
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-navy-700 bg-slate-50/50 dark:bg-navy-900/50">
                    {['Department', 'Students', 'Active', 'Avg Rating', 'Avg Solved', 'Participation %', 'Health Score'].map(h => (
                      <th key={h} className={thCls}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-navy-700/60">
                  {deptMatrix.map(d => (
                    <tr key={d.department_id} className="hover:bg-slate-50 dark:hover:bg-navy-700/30 transition-colors">
                      <td className="py-3.5 px-3 pl-4 font-bold text-slate-800 dark:text-slate-100 text-sm">
                        {d.department_name}<br />
                        <span className="text-[10px] font-mono text-slate-400">({d.department_code})</span>
                      </td>
                      <td className="py-3.5 px-3 text-sm text-slate-600 dark:text-slate-300">{d.student_count}</td>
                      <td className="py-3.5 px-3 text-sm font-bold text-emerald-500">{d.active_count}</td>
                      <td className="py-3.5 px-3 text-sm font-black text-indigo-500">{d.avg_rating}</td>
                      <td className="py-3.5 px-3 text-sm font-black text-brand-500">{d.avg_solved}</td>
                      <td className="py-3.5 px-3 text-sm text-slate-600 dark:text-slate-300">{d.participation_rate_pct}%</td>
                      <td className="py-3.5 px-3"><ScorePill value={d.health_score} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Year Matrix */}
          <Card className="p-6 space-y-4">
            <SectionHeader icon={<TrendingUp size={18} />} title="Year-Level Benchmarking Matrix" subtitle="Live DB · GROUP BY year_level — no hardcoded values" color="text-emerald-500" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {yearMatrix.map(y => (
                <div key={y.year} className="rounded-2xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900/50 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-base font-black text-slate-800 dark:text-slate-100">{y.year}</span>
                    <ScorePill value={y.health_score} />
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div><div className="text-[10px] text-slate-400 uppercase font-bold mb-0.5">Students</div><div className="font-black text-slate-700 dark:text-slate-200 text-lg">{y.student_count}</div></div>
                    <div><div className="text-[10px] text-slate-400 uppercase font-bold mb-0.5">Active</div><div className="font-black text-emerald-500 text-lg">{y.active_count}</div></div>
                    <div><div className="text-[10px] text-slate-400 uppercase font-bold mb-0.5">Avg Solved</div><div className="font-black text-brand-500">{y.avg_solved}</div></div>
                    <div><div className="text-[10px] text-slate-400 uppercase font-bold mb-0.5">Avg Rating</div><div className="font-black text-indigo-500">{y.avg_rating || '—'}</div></div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                      <span>Participation</span><span>{y.participation_pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-200 dark:bg-navy-700 overflow-hidden">
                      <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${y.participation_pct}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 4: WHAT-IF SIMULATOR
          ════════════════════════════════════════════════════════════════════ */}
      {tab === 'What-If' && (
        <Card className="p-6 space-y-5">
          <SectionHeader icon={<Sliders size={18} />} title="What-If Scenario Simulator" subtitle="Simulate participation & growth policy adjustments (HOD / Management Only)" color="text-amber-500"
            right={<span className="px-2.5 py-1 rounded-xl text-[10px] font-black bg-amber-500/10 text-amber-500 border border-amber-500/20">PROJECTION — Not guaranteed</span>} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4 p-5 rounded-2xl bg-slate-50 dark:bg-navy-900/50 border border-slate-200 dark:border-navy-700">
              <div className="flex justify-between items-center text-sm font-bold">
                <span className="text-slate-600 dark:text-slate-300">Simulated Target Participation:</span>
                <span className="text-brand-500 text-xl font-black">{targetPart}%</span>
              </div>
              <input type="range" min="50" max="100" value={targetPart} onChange={e => handleSimulate(Number(e.target.value))} className="w-full accent-brand-500 cursor-pointer" />
              <div className="flex justify-between text-[10px] font-bold text-slate-400">
                <span>50%</span>
                <span>Current: {health?.participation_score?.toFixed(1)}%</span>
                <span>100%</span>
              </div>
            </div>

            {scenarioResult && (
              <div className="p-5 rounded-2xl bg-gradient-to-r from-navy-950 to-indigo-950 text-white space-y-4">
                <span className="text-[11px] font-black uppercase text-amber-400 block">📈 Projected Outcome</span>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-slate-400 text-xs block">Growth Boost</span><span className="text-xl font-black text-emerald-400">{scenarioResult.estimated_growth_boost_pct}</span></div>
                  <div><span className="text-slate-400 text-xs block">Avg Rating Boost</span><span className="text-xl font-black text-brand-400">{scenarioResult.estimated_avg_rating_boost}</span></div>
                </div>
                <div className="pt-3 border-t border-white/10 text-sm">
                  <span className="text-slate-400 text-xs block mb-1">At-Risk Reduction</span>
                  <span className="font-black text-white">{scenarioResult.risk_reduction_label}</span>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 5: AI QUERY
          ════════════════════════════════════════════════════════════════════ */}
      {tab === 'AI Query' && (
        <Card className="p-6 space-y-4">
          <SectionHeader icon={<Sparkles size={18} />} title="Natural-Language AI Department Query" subtitle="Zero hallucination · Deterministic SQL + AI synthesis · Database-backed insights" color="text-purple-500" />

          <form onSubmit={handleAIQuery} className="flex gap-3">
            <div className="flex-1 flex items-center gap-2 bg-slate-100 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 focus-within:border-brand-500 rounded-2xl px-4 py-3 transition">
              <Search size={14} className="text-slate-400 flex-shrink-0" />
              <input value={queryText} onChange={e => setQueryText(e.target.value)} placeholder="e.g. 'Which year has the highest average solved?' or 'Who are the top 5 students?'"
                className="flex-1 bg-transparent text-sm text-slate-700 dark:text-slate-200 outline-none placeholder:text-slate-400" />
            </div>
            <button type="submit" disabled={queryLoading}
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-black text-sm shadow-md transition flex items-center gap-2 disabled:opacity-50">
              {queryLoading ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />} Ask AI
            </button>
          </form>

          {/* Quick prompts */}
          <div className="flex flex-wrap gap-2">
            {['Which department has the highest health score?', 'Who are the top 5 solvers?', 'How many students are at risk?', 'Compare II Year vs III Year performance'].map(q => (
              <button key={q} onClick={() => setQueryText(q)} className="text-[10px] px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 hover:bg-purple-500/20 transition font-semibold">
                {q}
              </button>
            ))}
          </div>

          {queryResponse && (
            <div className="p-5 rounded-2xl bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white space-y-3 shadow-xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-2 text-xs">
                <span className="font-bold text-brand-400">Query: "{queryResponse.query}"</span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-extrabold text-[10px]">
                  Confidence: {queryResponse.data_confidence}
                </span>
              </div>
              <p className="text-sm leading-relaxed font-medium text-slate-200 whitespace-pre-line">{queryResponse.answer}</p>
              {queryResponse.traceable_metrics?.length > 0 && (
                <div className="pt-2 border-t border-white/10 text-[11px] space-y-1 text-slate-300">
                  <span className="font-bold text-slate-400 block">Traceable DB Metrics:</span>
                  {queryResponse.traceable_metrics.map((m: string, i: number) => <span key={i} className="block">• {m}</span>)}
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* ── Modals ── */}
      {showModal === 'add' && (
        <StudentModal mode="add" departments={departments} onClose={() => setShowModal(null)} onSaved={loadStudents} />
      )}
      {showModal === 'edit' && editStudent && (
        <StudentModal mode="edit" student={editStudent} departments={departments} onClose={() => { setShowModal(null); setEditStudent(null); }} onSaved={loadStudents} />
      )}
      {deleteTarget && (
        <DeleteConfirmModal student={deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDeleteConfirm} deleting={deleting} />
      )}
    </div>
  );
};

export default HODCommandCenter;
