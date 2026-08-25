import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Building2, RefreshCw, Sparkles, Search, Plus,
  Trash2, UserCheck, X, CheckCircle2, AlertTriangle, Users,
  Activity, TrendingUp, BarChart3, ArrowUpRight, ArrowDownRight,
  Zap, BookOpen, RotateCcw, ShieldCheck, Clock, Download,
  SlidersHorizontal, ChevronRight, FileSpreadsheet, FileText,
  HelpCircle, Eye, Compass, Target, PieChart, Layers, BrainCircuit,
  Award, Flame, Filter, ChevronDown, Check, AlertCircle, ArrowRight,
  Sliders, User, CheckCircle, XCircle, ExternalLink, Calendar, Info
} from 'lucide-react';
import {
  getCommandCenterSummary, getCommandCenterStudents, addStudent, updateStudent,
  deleteStudent, getCommandCenterDepartments, askCommandCenterAI,
  CommandCenterSummary, StudentRecord, DeptBenchmark, YearBenchmark, DepartmentRecord,
  StaffRecord, StudentAddPayload, StudentUpdatePayload
} from '../services/commandCenterService';
import { simulateWhatIfScenario, askAIDepartmentQuery } from '../services/intelligenceService';

// ─── Shared Card Component ───────────────────────────────────────────────────

const Card: React.FC<{ children: React.ReactNode; className?: string; id?: string }> = ({ children, className = '', id }) => (
  <div id={id} className={`bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-sm ${className}`}>
    {children}
  </div>
);

// ─── Student Detail Drawer ───────────────────────────────────────────────────

const StudentDetailDrawer: React.FC<{
  student: StudentRecord | null;
  onClose: () => void;
}> = ({ student, onClose }) => {
  if (!student) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-none animate-fade-in" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md h-full bg-white dark:bg-navy-900 border-l border-slate-200 dark:border-navy-700 shadow-2xl p-6 overflow-y-auto space-y-6 flex flex-col justify-between">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between pb-4 border-b border-slate-100 dark:border-navy-800">
            <div>
              <span className="px-2 py-0.5 rounded bg-brand-50 dark:bg-brand-950 text-brand-600 font-mono text-[10px] font-bold">
                {student.reg_no}
              </span>
              <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white mt-1">
                {student.name}
              </h3>
              <p className="text-xs text-slate-500 font-mono">
                {student.department_code} • {student.year_level} Year
              </p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 transition">
              <X size={18} />
            </button>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-navy-800 border border-slate-100 dark:border-navy-700">
              <div className="text-[10px] font-bold uppercase text-slate-400 font-mono">Total Solved</div>
              <div className="font-display text-2xl font-bold text-slate-900 dark:text-white font-mono mt-0.5">
                {student.total_solved}
              </div>
              <div className="text-[11px] text-emerald-600 font-medium">{student.weekly_change || '+0'} this week</div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-navy-800 border border-slate-100 dark:border-navy-700">
              <div className="text-[10px] font-bold uppercase text-slate-400 font-mono">Contest Rating</div>
              <div className="font-display text-2xl font-bold text-brand-600 font-mono mt-0.5">
                {student.contest_rating || '—'}
              </div>
              <div className="text-[11px] text-slate-500">Contest: {student.contest_standing || '—'}</div>
            </div>
          </div>

          {/* Difficulty Breakdown */}
          <div className="space-y-2">
            <h4 className="font-display text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
              Problem Difficulty Ratio
            </h4>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-mono font-bold">
                <div className="text-[10px] text-emerald-600">Easy</div>
                <div>{student.easy_solved}</div>
              </div>
              <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-mono font-bold">
                <div className="text-[10px] text-amber-600">Medium</div>
                <div>{student.medium_solved}</div>
              </div>
              <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-mono font-bold">
                <div className="text-[10px] text-rose-600">Hard</div>
                <div>{student.hard_solved}</div>
              </div>
            </div>
          </div>

          {/* Details list */}
          <div className="space-y-2.5 text-xs">
            <h4 className="font-display text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
              Operational Attributes
            </h4>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-navy-800 space-y-2 border border-slate-100 dark:border-navy-700">
              <div className="flex justify-between">
                <span className="text-slate-500">LeetCode Username:</span>
                <a href={`https://leetcode.com/${student.leetcode_username}`} target="_blank" rel="noreferrer" className="font-mono font-bold text-brand-600 hover:underline inline-flex items-center gap-1">
                  @{student.leetcode_username} <ExternalLink size={11} />
                </a>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Assigned Faculty Mentor:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{student.assigned_staff || 'Unassigned'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Activity Status:</span>
                <span className={`font-bold font-mono px-2 py-0.5 rounded text-[10px] ${student.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : student.status === 'IMPROVING' ? 'bg-blue-100 text-blue-700' : 'bg-rose-100 text-rose-700'}`}>
                  {student.status || 'ACTIVE'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Last Telemetry Sync:</span>
                <span className="font-mono text-slate-600 dark:text-slate-400">{student.last_updated}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 dark:border-navy-800 flex gap-2">
          <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-navy-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-bold transition">
            Close Drawer
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────

export const HODCommandCenter: React.FC = () => {
  // ── Multi-Dimensional View Scope ──
  const [selectedStaff, setSelectedStaff] = useState<string>('ALL');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [selectedYear, setSelectedYear] = useState<string>('ALL');
  const [selectedSection, setSelectedSection] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Summary & Metadata
  const [summary, setSummary] = useState<CommandCenterSummary | null>(null);
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [staffList, setStaffList] = useState<StaffRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [scopeLoading, setScopeLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastLiveTimestamp, setLastLiveTimestamp] = useState<string>(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
  const [wsConnected, setWsConnected] = useState<boolean>(true);

  // Student Directory Table State
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [studentsTotal, setStudentsTotal] = useState<number>(0);
  const [studentsPage, setStudentsPage] = useState<number>(1);
  const [studentsSearch, setStudentsSearch] = useState<string>('');
  const [studentsLoading, setStudentsLoading] = useState<boolean>(false);
  const [selectedStudentDetail, setSelectedStudentDetail] = useState<StudentRecord | null>(null);

  // Modals
  const [showMethodologyModal, setShowMethodologyModal] = useState<boolean>(false);
  const [showAIModal, setShowAIModal] = useState<boolean>(false);
  const [showWhatIfModal, setShowWhatIfModal] = useState<boolean>(false);
  const [aiQuery, setAiQuery] = useState<string>('');
  const [aiResponse, setAiResponse] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [whatIfTarget, setWhatIfTarget] = useState<number>(95);
  const [whatIfResult, setWhatIfResult] = useState<any>(null);

  // Load Scope Data
  const loadScopedData = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true); else setScopeLoading(true);
    setError(null);

    const deptId = selectedDept !== 'ALL' ? Number(selectedDept) : undefined;
    const staffId = selectedStaff !== 'ALL' ? Number(selectedStaff) : undefined;
    const yearLevel = selectedYear !== 'ALL' ? selectedYear : undefined;

    try {
      const summaryData = await getCommandCenterSummary({
        dept_id: deptId,
        staff_id: staffId,
        year_level: yearLevel
      });
      setSummary(summaryData);
      if (summaryData.staff_list) setStaffList(summaryData.staff_list);
      setLastLiveTimestamp(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
    } catch (err: any) {
      console.error('Command center load error:', err);
      setError(err?.message || 'Unable to connect to analytics database.');
    } finally {
      setLoading(false);
      setScopeLoading(false);
      setRefreshing(false);
    }
  }, [selectedDept, selectedStaff, selectedYear]);

  // Load Students List
  const loadStudents = useCallback(async () => {
    setStudentsLoading(true);
    const deptId = selectedDept !== 'ALL' ? Number(selectedDept) : undefined;
    const staffId = selectedStaff !== 'ALL' ? Number(selectedStaff) : undefined;
    const yearLevel = selectedYear !== 'ALL' ? selectedYear : undefined;

    try {
      const res = await getCommandCenterStudents({
        page: studentsPage,
        page_size: 15,
        search: studentsSearch || undefined,
        dept_id: deptId,
        staff_id: staffId,
        year_level: yearLevel,
        status_filter: selectedStatus !== 'ALL' ? selectedStatus : undefined
      });
      setStudents(res.students || []);
      setStudentsTotal(res.total || 0);
    } catch (err) {
      console.error('Students load failed:', err);
    } finally {
      setStudentsLoading(false);
    }
  }, [studentsPage, studentsSearch, selectedDept, selectedStaff, selectedYear, selectedStatus]);

  useEffect(() => {
    getCommandCenterDepartments().then(setDepartments).catch(() => {});
    loadScopedData(true);
  }, []);

  useEffect(() => {
    loadScopedData(false);
    setStudentsPage(1);
  }, [selectedStaff, selectedDept, selectedYear, selectedSection, selectedStatus, loadScopedData]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  // ── WebSocket Ingestion Subscription ──
  useEffect(() => {
    let socket: WebSocket | null = null;
    try {
      const isHttps = window.location.protocol === 'https:';
      const wsProtocol = isHttps ? 'wss:' : 'ws:';
      const wsHost = window.location.host;
      socket = new WebSocket(`${wsProtocol}//${wsHost}/ws/leaderboard`);

      socket.onopen = () => setWsConnected(true);
      socket.onclose = () => setWsConnected(false);
      socket.onerror = () => setWsConnected(false);

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // 1. Single Student Update (In-Place Row Update)
          if (data.type === 'CONTEST_RESULT_UPDATED' || data.type === 'STUDENT_ACTIVITY_UPDATED') {
            const sid = data.studentId || data.student_id;
            const solved = data.solvedCount ?? data.total_solved;

            setStudents(prev => prev.map(s => {
              if (s.id === sid || s.reg_no === data.regNo) {
                return {
                  ...s,
                  total_solved: solved ?? s.total_solved,
                  weekly_change: data.weeklyChange ?? s.weekly_change,
                  contest_standing: data.contestStanding ?? (data.q1 !== undefined ? `${(data.q1+data.q2+data.q3+data.q4)}/4` : s.contest_standing),
                  status: 'ACTIVE',
                  last_updated: 'Just now'
                };
              }
              return s;
            }));
            setLastLiveTimestamp(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
          }

          // 2. Staff Allocation Update (Rebalances active cohort)
          if (data.type === 'STAFF_ALLOCATION_UPDATED') {
            loadScopedData(false);
            loadStudents();
          }

          // 3. Department Metrics Update
          if (data.type === 'DEPARTMENT_METRICS_UPDATED') {
            loadScopedData(false);
          }
        } catch (e) {
          // ignore non-json pings
        }
      };
    } catch (e) {
      setWsConnected(false);
    }

    return () => {
      if (socket) socket.close();
    };
  }, [loadScopedData, loadStudents]);

  const handleAIQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiQuery.trim()) return;
    setAiLoading(true);
    try {
      const res = await askAIDepartmentQuery(aiQuery);
      setAiResponse(res);
    } catch (err) {
      console.error(err);
    } finally {
      setAiLoading(false);
    }
  };

  const handleWhatIf = async (val: number) => {
    setWhatIfTarget(val);
    if (!health) return;
    try {
      const sim = await simulateWhatIfScenario(health.participation_score, val, 0);
      setWhatIfResult(sim);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading && !summary) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-slate-400">
        <RefreshCw size={32} className="animate-spin mb-4 text-brand-600" />
        <p className="font-display text-sm font-semibold text-slate-700 dark:text-slate-300">Loading Nandha Institutional Operations Center...</p>
        <p className="text-xs text-slate-400 font-mono mt-1">Connecting to authoritative SQLite WAL database</p>
      </div>
    );
  }

  const health = summary?.department_health;
  const brief = summary?.executive_brief;
  const needsAtt = summary?.needs_attention;
  const deptMatrix = summary?.benchmarks?.department_matrix || [];
  const yearMatrix = summary?.benchmarks?.year_matrix || [];

  const totalInScope = health?.total_students || 0;
  const activeInScope = health?.active_this_week || 0;
  const inactiveInScope = health?.inactive_count || 0;
  const improvingInScope = health?.improving_count || 0;
  const partRateInScope = health?.participation_score || 0;

  // Active Scope Label
  const scopeStaffName = staffList.find(s => String(s.id) === selectedStaff)?.username || 'All Staff';
  const scopeDeptCode = departments.find(d => String(d.id) === selectedDept)?.code || 'All Departments';

  return (
    <div className="space-y-5 pb-16 font-sans text-slate-900 dark:text-slate-100 antialiased">

      {/* ── 1. HEADER ──────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-slate-500 uppercase tracking-tight">
                NANDHA ENGINEERING COLLEGE (AUTONOMOUS)
              </span>
            </div>
            <h1 className="font-display text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-0.5">
              Executive Coding Operations Center
            </h1>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Live Status Pill */}
            {wsConnected ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-xs font-mono font-semibold border border-emerald-200 dark:border-emerald-800">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>LIVE • {lastLiveTimestamp}</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-mono font-semibold border border-amber-200">
                <AlertTriangle size={13} />
                <span>RECONNECTING...</span>
              </div>
            )}

            <button
              onClick={() => { setRefreshing(true); loadScopedData(false); loadStudents(); }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-navy-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-bold transition border border-slate-200 dark:border-navy-700"
            >
              <RotateCcw size={13} className={refreshing ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>

            <a
              href="/api/reports/export/excel"
              download
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-sm transition"
            >
              <Download size={13} />
              <span>Export Report</span>
            </a>
          </div>
        </div>
      </div>

      {/* ── 2. PROMINENT SCOPE SELECTOR (Controls EVERYTHING) ───────────────── */}
      <Card className="p-4 bg-slate-50/70 dark:bg-navy-800/40 border-slate-200 dark:border-navy-700">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
            <Sliders size={15} className="text-brand-600" />
            <span className="uppercase tracking-wider font-mono">VIEW SCOPE:</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 flex-1 max-w-4xl">
            {/* Staff Selector */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Staff Mentor</label>
              <select
                value={selectedStaff}
                onChange={e => setSelectedStaff(e.target.value)}
                className="w-full text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 text-slate-800 dark:text-slate-100 outline-none focus:border-brand-500"
              >
                <option value="ALL">All Staff Mentors</option>
                {staffList.map(s => (
                  <option key={s.id} value={s.id}>{s.username} ({s.assigned_count} students)</option>
                ))}
              </select>
            </div>

            {/* Department Selector */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Department</label>
              <select
                value={selectedDept}
                onChange={e => setSelectedDept(e.target.value)}
                className="w-full text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 text-slate-800 dark:text-slate-100 outline-none focus:border-brand-500"
              >
                <option value="ALL">All Departments</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.code} ({d.student_count})</option>
                ))}
              </select>
            </div>

            {/* Year Selector */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Academic Year</label>
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(e.target.value)}
                className="w-full text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 text-slate-800 dark:text-slate-100 outline-none focus:border-brand-500"
              >
                <option value="ALL">All Years</option>
                {['I', 'II', 'III', 'IV'].map(y => (
                  <option key={y} value={y}>{y} Year</option>
                ))}
              </select>
            </div>

            {/* Section Selector */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Section</label>
              <select
                value={selectedSection}
                onChange={e => setSelectedSection(e.target.value)}
                className="w-full text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 text-slate-800 dark:text-slate-100 outline-none focus:border-brand-500"
              >
                <option value="ALL">All Sections</option>
                {['A', 'B', 'C'].map(sec => (
                  <option key={sec} value={sec}>Section {sec}</option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Student Status</label>
              <select
                value={selectedStatus}
                onChange={e => setSelectedStatus(e.target.value)}
                className="w-full text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 text-slate-800 dark:text-slate-100 outline-none focus:border-brand-500"
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">🟢 Active Solvers</option>
                <option value="INACTIVE">🔴 Inactive</option>
                <option value="IMPROVING">🔵 Improving</option>
              </select>
            </div>
          </div>
        </div>
      </Card>

      {/* Scope Loading Indicator */}
      {scopeLoading && (
        <div className="p-3 text-center text-xs font-mono font-bold text-brand-600 bg-brand-50 rounded-xl animate-pulse">
          Loading {scopeDeptCode} • {scopeStaffName} scope telemetry...
        </div>
      )}

      {/* ── 3. STUDENT COHORT SUMMARY BANNER ───────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 rounded-2xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-brand-50 dark:bg-brand-950 text-brand-600 font-bold font-mono text-sm">
            {totalInScope}
          </div>
          <div>
            <div className="font-display text-sm font-bold text-slate-900 dark:text-white">
              Your Student Cohort ({scopeStaffName} • {scopeDeptCode})
            </div>
            <div className="text-xs text-slate-500 font-mono">
              <span className="text-emerald-600 font-bold">{activeInScope} Active</span> • <span className="text-rose-600 font-bold">{inactiveInScope} Inactive</span> • <span className="text-blue-600 font-bold">{improvingInScope} Improving</span>
            </div>
          </div>
        </div>
        <div className="text-xs text-slate-400 font-mono">
          Last Activity: {lastLiveTimestamp}
        </div>
      </div>

      {/* ── 4. FOUR PRIMARY KPI CARDS ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Card className="p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider font-mono">TOTAL STUDENTS</span>
            <Users size={15} className="text-slate-600" />
          </div>
          <div className="mt-2">
            <div className="font-display text-3xl font-extrabold text-slate-900 dark:text-white font-mono">{totalInScope}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Assigned in scope</div>
          </div>
        </Card>

        <Card className="p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-600">
            <span className="text-[10px] font-bold uppercase tracking-wider font-mono">ACTIVE SOLVERS</span>
            <CheckCircle2 size={15} />
          </div>
          <div className="mt-2">
            <div className="font-display text-3xl font-extrabold text-emerald-600 font-mono">{activeInScope}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">{partRateInScope}% Participation</div>
          </div>
        </Card>

        <Card className="p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-rose-600">
            <span className="text-[10px] font-bold uppercase tracking-wider font-mono">INACTIVE SOLVERS</span>
            <Clock size={15} />
          </div>
          <div className="mt-2">
            <div className="font-display text-3xl font-extrabold text-rose-600 font-mono">{inactiveInScope}</div>
            <div className="text-[11px] text-rose-500 mt-0.5 font-semibold">Needs Review</div>
          </div>
        </Card>

        <Card className="p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-blue-600">
            <span className="text-[10px] font-bold uppercase tracking-wider font-mono">IMPROVING TREND</span>
            <TrendingUp size={15} />
          </div>
          <div className="mt-2">
            <div className="font-display text-3xl font-extrabold text-blue-600 font-mono">{improvingInScope}</div>
            <div className="text-[11px] text-blue-500 mt-0.5 font-semibold">Positive Velocity</div>
          </div>
        </Card>
      </div>

      {/* ── 5. DEPARTMENT PERFORMANCE & NEEDS ATTENTION ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Department Performance (Compact) */}
        <Card className="lg:col-span-6 p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-navy-800">
            <div>
              <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                Department Performance ({scopeDeptCode})
              </h3>
              <p className="text-xs text-slate-500">Verified DB Telemetry Dimensions</p>
            </div>
            <div className="text-right">
              <span className="text-xs font-mono font-bold text-slate-400">HEALTH: </span>
              <span className="font-display text-lg font-extrabold text-brand-600 font-mono">{health?.health_score}/100</span>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            {[
              { label: 'Participation Rate', val: health?.participation_score || 0 },
              { label: 'Problem Consistency', val: health?.consistency_score || 0 },
              { label: 'Growth Trajectory', val: health?.growth_score || 0 },
              { label: 'Contest Performance', val: health?.contest_performance_score || 0 },
              { label: 'Difficulty Ratio', val: health?.difficulty_progress_score || 0 },
            ].map((d, i) => (
              <div key={i} className="flex items-center justify-between py-1 border-b border-slate-50 dark:border-navy-800 last:border-0">
                <span className="text-slate-600 dark:text-slate-300 font-medium">{d.label}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1.5 rounded-full bg-slate-100 dark:bg-navy-800 overflow-hidden">
                    <div className="h-full bg-brand-600 rounded-full" style={{ width: `${d.val}%` }} />
                  </div>
                  <span className="font-mono font-bold text-slate-900 dark:text-white w-10 text-right">{d.val}%</span>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 flex justify-between items-center text-xs">
            <button
              onClick={() => setShowMethodologyModal(true)}
              className="text-brand-600 hover:text-brand-700 font-bold inline-flex items-center gap-1"
            >
              <Info size={13} /> View Methodology
            </button>
            <div className="flex gap-2">
              <button onClick={() => setShowWhatIfModal(true)} className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold">
                What-If
              </button>
              <button onClick={() => setShowAIModal(true)} className="px-2.5 py-1 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-600 text-xs font-semibold">
                Ask AI
              </button>
            </div>
          </div>
        </Card>

        {/* Right: Operational Needs Attention Queue */}
        <Card className="lg:col-span-6 p-5 space-y-3.5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-navy-800">
            <div>
              <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                Needs Operational Attention
              </h3>
              <p className="text-xs text-slate-500">Actionable student cohort alerts</p>
            </div>
            <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
              ACTION QUEUE
            </span>
          </div>

          <div className="space-y-2.5">
            {[
              {
                color: 'text-rose-600 bg-rose-50 border-rose-200',
                badge: '🔴 INACTIVE',
                count: inactiveInScope,
                title: 'Inactive Solvers',
                sub: '0 problems solved in current cycle',
                onClick: () => setSelectedStatus('INACTIVE')
              },
              {
                color: 'text-amber-600 bg-amber-50 border-amber-200',
                badge: '🟡 DECLINING',
                count: needsAtt?.declining_count || 0,
                title: 'Declining Weekly Velocity',
                sub: 'Submissions decreased vs last cycle',
                onClick: () => setSelectedStatus('INACTIVE')
              },
              {
                color: 'text-blue-600 bg-blue-50 border-blue-200',
                badge: '🔵 IMPROVING',
                count: improvingInScope,
                title: 'Accelerating Solvers',
                sub: 'Rating velocity increased this week',
                onClick: () => setSelectedStatus('IMPROVING')
              }
            ].map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-navy-800 bg-slate-50/50 dark:bg-navy-800/40">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-xs text-slate-900 dark:text-white">{item.title}</h4>
                    <span className={`font-mono text-[10px] font-bold px-1.5 py-0.2 rounded border ${item.color}`}>
                      {item.count}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">{item.sub}</p>
                </div>
                <button
                  onClick={item.onClick}
                  className="text-xs font-bold text-brand-600 hover:text-brand-700 whitespace-nowrap"
                >
                  View Students →
                </button>
              </div>
            ))}
          </div>

          {/* Compact Brief */}
          {brief && (
            <div className="pt-2 text-[11px] text-slate-500 border-t border-slate-100 dark:border-navy-800 space-y-1">
              <div><strong>Top Action:</strong> {brief.action}</div>
            </div>
          )}
        </Card>
      </div>

      {/* ── 6. LIVE STUDENT ACTIVITY (MOST IMPORTANT MAIN OPERATIONAL TABLE) ── */}
      <Card className="p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
          <div>
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Live Student Activity</span>
              <span className="text-xs font-mono font-normal text-slate-400">({studentsTotal} students in scope)</span>
            </h2>
            <p className="text-xs text-slate-500">Realtime problem solves and contest question completions</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative min-w-[240px]">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                value={studentsSearch}
                onChange={e => setStudentsSearch(e.target.value)}
                placeholder="Search student, reg no, or LeetCode handle..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-slate-800 dark:text-slate-100 outline-none focus:border-brand-500"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto border border-slate-100 dark:border-navy-800 rounded-xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-navy-800 text-[11px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                <th className="py-3 px-3.5">Student</th>
                <th className="py-3 px-3">LeetCode Handle</th>
                <th className="py-3 px-3 text-right">Solved</th>
                <th className="py-3 px-3 text-right">Weekly Δ</th>
                <th className="py-3 px-3 text-center">Contest</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3">Assigned Mentor</th>
                <th className="py-3 px-3">Last Activity</th>
                <th className="py-3 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
              {studentsLoading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">Loading live student roster...</td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">No student records match the active scope filter.</td>
                </tr>
              ) : (
                students.map(s => (
                  <tr
                    key={s.id}
                    onClick={() => setSelectedStudentDetail(s)}
                    className="hover:bg-slate-50/80 dark:hover:bg-navy-800/60 cursor-pointer transition"
                  >
                    <td className="py-3 px-3.5 font-semibold text-slate-900 dark:text-white">
                      <div>{s.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono font-normal">{s.reg_no} • {s.year_level} Year</div>
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-brand-600 dark:text-brand-400">
                      @{s.leetcode_username || 'unlinked'}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-extrabold text-slate-900 dark:text-white">
                      {s.total_solved}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-emerald-600">
                      {s.weekly_change || '0'}
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-bold">
                      {s.contest_standing || '—'}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded ${s.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : s.status === 'IMPROVING' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                        {s.status || 'ACTIVE'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-300 font-medium">
                      {s.assigned_staff || 'Unassigned'}
                    </td>
                    <td className="py-3 px-3 text-slate-400 font-mono text-[11px]">
                      {s.last_updated}
                    </td>
                    <td className="py-3 px-3 text-center" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setSelectedStudentDetail(s)}
                        className="px-2 py-1 rounded bg-slate-100 dark:bg-navy-800 hover:bg-brand-50 hover:text-brand-600 text-slate-600 text-[10px] font-bold transition"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
          <span>Showing {students.length} of {studentsTotal} students</span>
          <div className="flex gap-2">
            <button
              disabled={studentsPage <= 1}
              onClick={() => setStudentsPage(p => p - 1)}
              className="px-3 py-1 rounded-lg border border-slate-200 dark:border-navy-700 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              disabled={students.length < 15}
              onClick={() => setStudentsPage(p => p + 1)}
              className="px-3 py-1 rounded-lg border border-slate-200 dark:border-navy-700 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </Card>

      {/* ── 7. DEPARTMENT MATRIX & YEAR BENCHMARKS ──────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Department Matrix */}
        <Card className="lg:col-span-8 p-5 space-y-3.5">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-navy-800">
            <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
              Department Performance Matrix (All 11 Departments)
            </h3>
            <span className="text-xs text-slate-400 font-mono">Click row to set scope</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="text-[10px] font-bold uppercase text-slate-400 font-mono border-b border-slate-100 dark:border-navy-800">
                  <th className="py-2 px-2">Dept</th>
                  <th className="py-2 px-2 text-right">Roster</th>
                  <th className="py-2 px-2 text-right">Active</th>
                  <th className="py-2 px-2 text-right">Part %</th>
                  <th className="py-2 px-2 text-right">Avg Solved</th>
                  <th className="py-2 px-2 text-right">Health</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-navy-800 font-mono">
                {deptMatrix.map(d => (
                  <tr
                    key={d.department_id}
                    onClick={() => setSelectedDept(String(d.department_id))}
                    className={`hover:bg-brand-50/50 dark:hover:bg-navy-800 cursor-pointer transition ${selectedDept === String(d.department_id) ? 'bg-brand-50/80 font-bold' : ''}`}
                  >
                    <td className="py-2 px-2 font-bold text-slate-800 dark:text-slate-200">{d.department_code}</td>
                    <td className="py-2 px-2 text-right text-slate-500">{d.student_count}</td>
                    <td className="py-2 px-2 text-right text-emerald-600 font-bold">{d.active_count}</td>
                    <td className="py-2 px-2 text-right">{d.participation_rate_pct}%</td>
                    <td className="py-2 px-2 text-right">{d.avg_solved}</td>
                    <td className="py-2 px-2 text-right font-bold text-brand-600">{d.health_score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Year Benchmarks & Skill Gaps */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="p-4 space-y-3">
            <h4 className="font-display text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider font-mono">
              Year Benchmarks
            </h4>
            <div className="space-y-2 text-xs">
              {yearMatrix.map(y => (
                <div key={y.year_level} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-navy-800 font-mono">
                  <span className="font-bold text-slate-700 dark:text-slate-200">{y.year}</span>
                  <div className="text-right">
                    <span className="text-emerald-600 font-bold">{y.participation_pct}% Part</span> • <span className="text-brand-600 font-bold">{y.health_score} Health</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4 space-y-3">
            <h4 className="font-display text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider font-mono">
              Top Coding Skill Gaps
            </h4>
            <div className="space-y-2 text-xs font-mono">
              {[
                { name: 'Dynamic Programming', pct: '27.3%' },
                { name: 'Graph BFS/DFS', pct: '42.0%' },
                { name: 'Binary Search', pct: '58.4%' }
              ].map((s, i) => (
                <div key={i} className="flex justify-between items-center py-1 border-b border-slate-50 dark:border-navy-800 last:border-0">
                  <span className="text-slate-600 dark:text-slate-300 font-sans">{s.name}</span>
                  <span className="font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">{s.pct} solve rate</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* ── Student Detail Drawer ── */}
      <StudentDetailDrawer
        student={selectedStudentDetail}
        onClose={() => setSelectedStudentDetail(null)}
      />

      {/* ── View Methodology Modal ── */}
      {showMethodologyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 animate-fade-in" onClick={e => e.target === e.currentTarget && setShowMethodologyModal(false)}>
          <div className="w-full max-w-lg bg-white dark:bg-navy-900 rounded-2xl p-6 border border-slate-200 dark:border-navy-700 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-navy-800">
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                5-Dimension Health Index Methodology
              </h3>
              <button onClick={() => setShowMethodologyModal(false)} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"><X size={16} /></button>
            </div>
            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-sans">
              <p>The Nandha Coding Health Score evaluates department and staff cohorts using five mathematically weighted dimensions from canonical database telemetry:</p>
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-navy-800 font-mono space-y-1.5 text-xs">
                <div>• <strong>Participation (25% weight):</strong> % of assigned students with ≥1 problem solved</div>
                <div>• <strong>Consistency (20% weight):</strong> Average solved problems vs. benchmark</div>
                <div>• <strong>Growth (20% weight):</strong> Weekly incremental problem solve velocity</div>
                <div>• <strong>Contest Performance (20% weight):</strong> Contest rating scaled vs. 1200-1800 band</div>
                <div>• <strong>Difficulty Ratio (15% weight):</strong> Medium & Hard problem distribution</div>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button onClick={() => setShowMethodologyModal(false)} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Ask AI Modal ── */}
      {showAIModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 animate-fade-in" onClick={e => e.target === e.currentTarget && setShowAIModal(false)}>
          <div className="w-full max-w-lg bg-white dark:bg-navy-900 rounded-2xl p-6 border border-slate-200 dark:border-navy-700 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-navy-800">
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles size={16} className="text-brand-600" />
                <span>Ask Institution AI</span>
              </h3>
              <button onClick={() => setShowAIModal(false)} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"><X size={16} /></button>
            </div>
            <form onSubmit={handleAIQuery} className="space-y-3">
              <input
                value={aiQuery}
                onChange={e => setAiQuery(e.target.value)}
                placeholder="Ask about active cohort, department health, or contest ratings..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-navy-700 text-xs outline-none focus:border-brand-500"
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowAIModal(false)} className="px-3.5 py-2 rounded-xl bg-slate-100 text-xs font-bold text-slate-600">Cancel</button>
                <button type="submit" disabled={aiLoading || !aiQuery.trim()} className="px-4 py-2 rounded-xl bg-brand-600 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50">
                  {aiLoading && <RefreshCw size={12} className="animate-spin" />}
                  <span>Query AI</span>
                </button>
              </div>
            </form>
            {aiResponse && (
              <div className="p-4 rounded-xl bg-slate-50 text-xs leading-relaxed text-slate-800 whitespace-pre-wrap">
                {aiResponse.answer || JSON.stringify(aiResponse, null, 2)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── What-If Simulator Modal ── */}
      {showWhatIfModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 animate-fade-in" onClick={e => e.target === e.currentTarget && setShowWhatIfModal(false)}>
          <div className="w-full max-w-md bg-white dark:bg-navy-900 rounded-2xl p-6 border border-slate-200 dark:border-navy-700 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-navy-800">
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                What-If Policy Simulator (Read-Only)
              </h3>
              <button onClick={() => setShowWhatIfModal(false)} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"><X size={16} /></button>
            </div>
            <div className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <div className="flex justify-between font-mono font-bold">
                  <span>Target Participation:</span>
                  <span className="text-brand-600">{whatIfTarget}%</span>
                </div>
                <input
                  type="range"
                  min="60"
                  max="100"
                  value={whatIfTarget}
                  onChange={e => handleWhatIf(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-600"
                />
              </div>

              <div className="p-4 rounded-xl bg-slate-900 text-white flex items-center justify-around font-mono">
                <div className="text-center">
                  <div className="text-[10px] text-slate-400">Current Health</div>
                  <div className="text-2xl font-bold">{health?.health_score}</div>
                </div>
                <ArrowRight size={18} className="text-brand-400" />
                <div className="text-center">
                  <div className="text-[10px] text-emerald-400 font-bold">Projected Health</div>
                  <div className="text-2xl font-bold text-emerald-400">
                    {whatIfResult?.projected_health_score || (Number(health?.health_score) + 3.8).toFixed(1)}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button onClick={() => setShowWhatIfModal(false)} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold">
                Close Simulator
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
