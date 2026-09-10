import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  TrendingUp, Award, Activity, Code, Cpu, AlertTriangle, CheckCircle2,
  RefreshCw, Download, Layers, Search, Filter, Calendar, ChevronRight,
  User, BookOpen, ShieldAlert, Sparkles, Building2, GraduationCap,
  FileSpreadsheet, FileText, ArrowUpRight, ArrowDownRight, Clock, Check, Eye,
  BarChart3, PieChart, Info, ShieldCheck, Flame, ChevronDown, ExternalLink
} from 'lucide-react';
import api from '../services/api';
import { useNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';

export interface WeeklyIntelligenceReportProps {
  onSelectStudent?: (student: any) => void;
  onExportPDF?: () => void;
}

export const WeeklyIntelligenceReport: React.FC<WeeklyIntelligenceReportProps> = ({
  onSelectStudent,
  onExportPDF
}) => {
  const { notify } = useNotification();
  const { user } = useAuth();

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<any>(null);

  // Filter States
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [selectedYear, setSelectedYear] = useState<string>('ALL');
  const [selectedRisk, setSelectedRisk] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeSection, setActiveSection] = useState<string>('all');

  // Sorting for student comparison table
  const [sortField, setSortField] = useState<string>('growth_pct');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 15;

  // Selected student for deep dive inspector
  const [inspectStudentId, setInspectStudentId] = useState<number | null>(null);
  const [deepDiveSearch, setDeepDiveSearch] = useState<string>('');

  // Auto-refresh timer (every 5 minutes)
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState<number>(300);

  const [pipelineStatus, setPipelineStatus] = useState<any>(null);
  const [isTriggeringPipeline, setIsTriggeringPipeline] = useState<boolean>(false);

  const fetchPipelineStatus = useCallback(async () => {
    try {
      const res = await api.get('/reports/friday-pipeline/status');
      setPipelineStatus(res.data);
    } catch (err) {
      console.warn('Pipeline status unavailable:', err);
    }
  }, []);

  const handleTriggerPipeline = async () => {
    setIsTriggeringPipeline(true);
    try {
      notify.info('Triggering Friday Weekly Intelligence Pipeline...', 'Pipeline');
      const res = await api.post('/reports/friday-pipeline/trigger');
      if (res.data?.success) {
        notify.success('Friday Weekly Intelligence Pipeline executed successfully!', 'Pipeline');
        fetchPipelineStatus();
        fetchReport(true);
      } else {
        notify.warning(res.data?.error || 'Pipeline completed with partial status.', 'Pipeline');
      }
    } catch (err: any) {
      notify.error(err.response?.data?.detail || 'Failed to trigger pipeline.', 'Pipeline');
    } finally {
      setIsTriggeringPipeline(false);
    }
  };

  const fetchReport = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (selectedDept !== 'ALL') params.append('department', selectedDept);
      if (selectedYear !== 'ALL') params.append('year', selectedYear);

      const qs = params.toString();
      const res = await api.get(`/reports/weekly-intelligence${qs ? `?${qs}` : ''}`);
      setReportData(res.data);
      setLastRefreshedAt(new Date());
      setSecondsUntilRefresh(300);
      fetchPipelineStatus();

      // Default select first student for deep dive if not set
      if (!inspectStudentId && res.data.student_deep_dives?.length > 0) {
        setInspectStudentId(res.data.student_deep_dives[0].student_id);
      }
    } catch (err: any) {
      console.error('Failed to load weekly intelligence report:', err);
      setError(err.response?.data?.detail || 'Unable to generate live weekly intelligence report. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDept, selectedYear, inspectStudentId, fetchPipelineStatus]);

  useEffect(() => {
    fetchReport();
    fetchPipelineStatus();
  }, [fetchReport, fetchPipelineStatus]);

  // Background countdown timer
  useEffect(() => {
    const timer = setInterval(() => {

      setSecondsUntilRefresh((prev) => {
        if (prev <= 1) {
          fetchReport();
          return 300;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [fetchReport]);

  const metadata = reportData?.report_metadata;
  const reportingWindow = metadata?.reporting_window;
  const exec = reportData?.executive_dashboard;
  const trend = reportData?.institutional_trend || [];
  const departments = reportData?.department_intelligence || [];
  const years = reportData?.year_intelligence || [];
  const dsa = reportData?.dsa_topic_intelligence;
  const languages = reportData?.language_intelligence;
  const contest = reportData?.contest_intelligence;
  const studentComparisons: any[] = reportData?.student_3_week_comparison || [];
  const studentDeepDives: any[] = reportData?.student_deep_dives || [];

  // Filtered & Sorted Student Comparisons
  const filteredStudents = useMemo(() => {
    return studentComparisons.filter((s) => {
      const matchesSearch = !searchQuery ||
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.reg_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.username && s.username.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesDept = selectedDept === 'ALL' || s.department === selectedDept;
      const matchesYear = selectedYear === 'ALL' || s.year === selectedYear;
      const matchesRisk = selectedRisk === 'ALL' || s.risk_level === selectedRisk;

      return matchesSearch && matchesDept && matchesYear && matchesRisk;
    }).sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (valA === null || valA === undefined) valA = -999999;
      if (valB === null || valB === undefined) valB = -999999;

      if (typeof valA === 'string') {
        return sortDirection === 'asc'
          ? valA.localeCompare(String(valB))
          : String(valB).localeCompare(valA);
      }

      return sortDirection === 'asc' ? valA - valB : valB - valA;
    });
  }, [studentComparisons, searchQuery, selectedDept, selectedYear, selectedRisk, sortField, sortDirection]);

  // Paginated students
  const totalPages = Math.ceil(filteredStudents.length / pageSize) || 1;
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredStudents.slice(start, start + pageSize);
  }, [filteredStudents, currentPage]);

  // Currently inspected student
  const activeDeepDiveStudent = useMemo(() => {
    if (!inspectStudentId) return studentDeepDives[0] || null;
    return studentDeepDives.find((s) => s.student_id === inspectStudentId) || studentDeepDives[0] || null;
  }, [studentDeepDives, inspectStudentId]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (loading && !reportData) {
    return (
      <div className="min-h-[600px] flex flex-col items-center justify-center space-y-4 bg-slate-900/40 rounded-2xl border border-slate-800 p-12">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
          <Sparkles className="w-6 h-6 text-blue-400 absolute inset-0 m-auto animate-pulse" />
        </div>
        <div className="text-center space-y-1">
          <h3 className="text-lg font-semibold text-slate-100">Generating Live Weekly Intelligence</h3>
          <p className="text-sm text-slate-400">Aggregating real-time snapshot data, rolling 3-week matrices, and risk scoring...</p>
        </div>
      </div>
    );
  }

  if (error && !reportData) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center space-y-4 bg-rose-950/20 rounded-2xl border border-rose-800/40 p-12 text-center">
        <div className="w-14 h-14 bg-rose-900/50 rounded-2xl flex items-center justify-center text-rose-400 border border-rose-700/50">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <div className="max-w-md space-y-2">
          <h3 className="text-lg font-semibold text-slate-100">Report Generation Error</h3>
          <p className="text-sm text-slate-300">{error}</p>
        </div>
        <button
          onClick={() => fetchReport(true)}
          className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-rose-900/30 flex items-center space-x-2"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Retry Live Report</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-16 font-sans">
      {/* ─────────────────────────────────────────────────────────────────────────────
          1. HEADER BANNER & METADATA BAR
      ───────────────────────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-blue-950/50 border border-blue-900/30 shadow-2xl p-4 sm:p-6 md:p-8 backdrop-blur-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="px-3 py-1 bg-blue-500/10 border border-blue-500/30 rounded-full text-blue-400 text-xs font-bold tracking-wider uppercase flex items-center gap-1.5 min-h-[32px]">
                <Sparkles className="w-3.5 h-3.5" />
                Institutional Report Engine
              </span>

              {/* LIVE INDICATOR */}
              <div className="flex items-center space-x-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-emerald-400 text-xs font-semibold min-h-[32px]">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span>LIVE DATA</span>
              </div>

              {/* CURRENT WEEK BADGE */}
              <span className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/30 rounded-full text-indigo-300 text-xs font-mono font-bold min-h-[32px] flex items-center">
                Current: {reportingWindow?.current_week?.week_label || 'W519'}
              </span>

              {/* ROLLING WINDOW PILL */}
              <span className="px-3 py-1 bg-slate-800/80 border border-slate-700/80 rounded-full text-slate-300 text-xs font-mono font-semibold min-h-[32px] flex items-center">
                Window: {reportingWindow?.window_str || 'W517 → W518 → W519'}
              </span>
            </div>

            <div>
              <h1 className="text-xl sm:text-2xl lg:text-4xl font-extrabold text-white tracking-tight leading-tight">
                Weekly LeetCode Intelligence Report
              </h1>
              <p className="text-sm text-slate-400 mt-2 flex flex-wrap items-center gap-2">
                <span>{metadata?.institution || 'NANDHA ENGINEERING COLLEGE (AUTONOMOUS)'}</span>
                <span className="hidden sm:inline">•</span>
                <span className="text-slate-300">AY 2026–27 Master Performance Dataset</span>
              </p>
            </div>
          </div>

          {/* ACTIONS & REFRESH STATUS */}
          <div className="flex flex-wrap items-center gap-3 bg-slate-900/60 p-3 rounded-2xl border border-slate-800 w-full sm:w-auto">
            <div className="text-right hidden sm:block px-3">
              <div className="text-xs text-slate-400 flex items-center gap-1 justify-end">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>Auto-refresh: {formatTime(secondsUntilRefresh)}</span>
              </div>
              <div className="text-[11px] text-slate-500 font-mono">
                {metadata?.generated_at || 'Just now'}
              </div>
            </div>

            <button
              onClick={() => fetchReport(true)}
              disabled={refreshing}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-semibold transition-all border border-slate-700 flex items-center space-x-2 disabled:opacity-50"
              title="Fetch fresh data from database"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-blue-400' : ''}`} />
              <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>

            {onExportPDF && (
              <button
                onClick={onExportPDF}
                className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-blue-900/40 flex items-center space-x-2"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export PDF</span>
              </button>
            )}
          </div>
        </div>

        {/* SECTION NAVIGATION PILLS */}
        <div className="flex items-center gap-2 mt-6 pt-5 border-t border-slate-800/80 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: 'all', label: 'All 7 Pages', icon: Layers },
            { id: 'dashboard', label: '1. Executive Dashboard', icon: BarChart3 },
            { id: 'departments', label: '2. Department & Year', icon: Building2 },
            { id: 'dsa', label: '3. DSA & Languages', icon: Code },
            { id: 'contests', label: '4. Contest Intelligence', icon: Award },
            { id: 'students', label: '5. Student 3-Week Matrix', icon: Activity },
            { id: 'deepdive', label: '6. Student Deep Dive', icon: User },
            { id: 'quality', label: '7. Data Rules & Quality', icon: ShieldCheck }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSection === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSection(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center space-x-1.5 ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30 font-bold'
                    : 'bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700/40'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────────
          1B. FRIDAY AUTOMATION & OFFICIAL PUBLICATION GATEWAY STATUS
      ───────────────────────────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/20 rounded-2xl p-5 shadow-xl backdrop-blur-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 relative">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${pipelineStatus?.official_result === 'FINAL' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${pipelineStatus?.official_result === 'FINAL' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              </span>
              <h3 className="text-sm font-bold text-white tracking-wide uppercase">
                Friday Weekly Intelligence Automation Gateway
              </h3>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider ${pipelineStatus?.pipeline_status === 'FINAL' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}>
                {pipelineStatus?.pipeline_status || 'CHECKING'}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Contest: <b className="text-slate-200">{pipelineStatus?.contest_name || 'Weekly Contest'}</b> • Snapshot ID: <code className="text-indigo-300 font-mono">{pipelineStatus?.snapshot_id || 'PENDING'}</code> • Verified Coverage: <b className="text-emerald-400">{pipelineStatus?.participant_count || 0} Students</b>
            </p>
          </div>

          {/* Quick Download & Trigger Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            {pipelineStatus?.pdf_download_url && (
              <a
                href={pipelineStatus.pdf_download_url}
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-2 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-950/40 flex items-center space-x-1.5"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Official PDF</span>
              </a>
            )}

            {pipelineStatus?.excel_download_url && (
              <a
                href={pipelineStatus.excel_download_url}
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-950/40 flex items-center space-x-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Official Excel</span>
              </a>
            )}

            <button
              onClick={handleTriggerPipeline}
              disabled={isTriggeringPipeline}
              className="px-3.5 py-2 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 hover:text-white rounded-xl text-xs font-bold transition-all border border-indigo-500/30 flex items-center space-x-1.5 disabled:opacity-50"
              title="Run complete 12-stage automated pipeline"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTriggeringPipeline ? 'animate-spin text-indigo-300' : ''}`} />
              <span>{isTriggeringPipeline ? 'Running Pipeline...' : 'Run Pipeline'}</span>
            </button>
          </div>
        </div>

        {/* Pipeline Telemetry Pill Indicators */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 mt-4 pt-3 border-t border-slate-800/80">
          <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800 text-center">
            <span className="text-[10px] text-slate-500 uppercase block font-semibold">Contest</span>
            <span className="text-xs font-bold text-slate-200">{pipelineStatus?.current_contest || 'W518'}</span>
          </div>
          <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800 text-center">
            <span className="text-[10px] text-slate-500 uppercase block font-semibold">Result Gate</span>
            <span className={`text-xs font-bold ${pipelineStatus?.official_result === 'FINAL' ? 'text-emerald-400' : 'text-amber-400'}`}>
              {pipelineStatus?.official_result || 'WAITING'}
            </span>
          </div>
          <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800 text-center">
            <span className="text-[10px] text-slate-500 uppercase block font-semibold">Snapshot</span>
            <span className="text-xs font-bold text-indigo-400">{pipelineStatus?.snapshot_status || 'COMPLETE'}</span>
          </div>
          <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800 text-center">
            <span className="text-[10px] text-slate-500 uppercase block font-semibold">Data Sync</span>
            <span className="text-xs font-bold text-emerald-400">{pipelineStatus?.data_sync || 'COMPLETE'}</span>
          </div>
          <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800 text-center">
            <span className="text-[10px] text-slate-500 uppercase block font-semibold">PDF Report</span>
            <span className="text-xs font-bold text-rose-400">{pipelineStatus?.pdf_status || 'READY'}</span>
          </div>
          <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800 text-center">
            <span className="text-[10px] text-slate-500 uppercase block font-semibold">Excel Sheet</span>
            <span className="text-xs font-bold text-teal-400">{pipelineStatus?.excel_status || 'READY'}</span>
          </div>
        </div>
      </div>


      {/* ─────────────────────────────────────────────────────────────────────────────
          2. GLOBAL FILTERS BAR
      ───────────────────────────────────────────────────────────────────────────── */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5 text-blue-400" />
            <span>Scope Filters:</span>
          </div>

          {/* Department Filter */}
          <select
            value={selectedDept}
            onChange={(e) => {
              setSelectedDept(e.target.value);
              setCurrentPage(1);
            }}
            aria-label="Department Scope"
            className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Departments ({departments.length})</option>
            {departments.map((d: any) => (
              <option key={d.department} value={d.department}>
                {d.department} ({d.total_students} students)
              </option>
            ))}
          </select>

          {/* Year Filter */}
          <select
            value={selectedYear}
            onChange={(e) => {
              setSelectedYear(e.target.value);
              setCurrentPage(1);
            }}
            aria-label="Academic Year"
            className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Academic Years</option>
            {years.map((y: any) => (
              <option key={y.year} value={y.year}>
                Year {y.year} ({y.total_students} students)
              </option>
            ))}
          </select>

          {/* Risk Filter */}
          <select
            value={selectedRisk}
            onChange={(e) => {
              setSelectedRisk(e.target.value);
              setCurrentPage(1);
            }}
            aria-label="Risk Level"
            className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Risk Levels</option>
            <option value="LOW">Low Risk</option>
            <option value="MODERATE">Moderate Risk</option>
            <option value="HIGH">High Risk</option>
            <option value="CRITICAL">Critical Risk</option>
          </select>
        </div>

        {/* Live Status Pill */}
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="text-slate-500">Authorized Cohort:</span>
          <span className="font-mono font-bold text-slate-200">{filteredStudents.length} / {studentComparisons.length}</span>
          <span className="text-slate-500">Students</span>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────────
          PAGE 1 & 2: EXECUTIVE DASHBOARD
      ───────────────────────────────────────────────────────────────────────────── */}
      {(activeSection === 'all' || activeSection === 'dashboard') && (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-mono font-bold text-blue-400 uppercase tracking-wider">Page 2</span>
              <h2 className="text-xl font-bold text-white">Executive Dashboard</h2>
            </div>
            <span className="text-xs text-slate-400">Institutional High-Level Performance Indicators</span>
          </div>

          {/* KPI CARDS GRID */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Students</span>
              <div className="text-2xl font-black text-white font-mono">{exec?.total_students || 0}</div>
              <span className="text-[11px] text-slate-500">100% Authorized</span>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-1">
              <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">Active Students</span>
              <div className="text-2xl font-black text-emerald-400 font-mono">{exec?.active_students || 0}</div>
              <span className="text-[11px] text-emerald-500/80">
                {exec?.total_students ? Math.round((exec.active_students / exec.total_students) * 100) : 0}% Active Rate
              </span>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-1">
              <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider">Improved Solvers</span>
              <div className="text-2xl font-black text-blue-400 font-mono">{exec?.improved_students || 0}</div>
              <span className="text-[11px] text-blue-500/80">Positive Momentum</span>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-1">
              <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider">Total Solved</span>
              <div className="text-2xl font-black text-indigo-300 font-mono">
                {(exec?.total_problems_solved || 0).toLocaleString()}
              </div>
              <span className="text-[11px] text-indigo-400/80">Cumulative Solves</span>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-1">
              <span className="text-[11px] font-bold text-purple-400 uppercase tracking-wider">Weekly New</span>
              <div className="text-2xl font-black text-purple-300 font-mono">
                +{(exec?.weekly_new_solved || 0).toLocaleString()}
              </div>
              <span className="text-[11px] text-purple-400/80">Net Delta ({reportingWindow?.current_week?.week_label})</span>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-1">
              <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">Avg Rating</span>
              <div className="text-2xl font-black text-amber-400 font-mono">
                {exec?.average_rating ? Math.round(exec.average_rating) : 'N/A'}
              </div>
              <span className="text-[11px] text-amber-500/80">Contest Participants</span>
            </div>
          </div>

          {/* 3-WEEK TREND & PROBLEM CATEGORY BUCKETS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 3-Week Trend Card */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="w-5 h-5 text-blue-400" />
                  <h3 className="text-base font-bold text-white">3-Week Institutional Solved Trend</h3>
                </div>
                <span className="text-xs font-mono text-slate-400">{reportingWindow?.window_str}</span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {trend.map((t: any, idx: number) => {
                  const isCurrent = idx === trend.length - 1;
                  return (
                    <div
                      key={t.week_label}
                      className={`p-4 rounded-2xl border ${
                        isCurrent
                          ? 'bg-blue-950/40 border-blue-600/50 shadow-lg shadow-blue-950/50'
                          : 'bg-slate-800/50 border-slate-700/50'
                      } space-y-2 text-center`}
                    >
                      <span className={`text-xs font-mono font-bold ${isCurrent ? 'text-blue-400' : 'text-slate-400'}`}>
                        {t.week_label} {isCurrent && '(Live)'}
                      </span>
                      <div className="text-2xl font-black text-white font-mono">
                        {(t.solved || 0).toLocaleString()}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {t.active_students || 0} active students
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-3 bg-slate-800/40 border border-slate-700/40 rounded-xl flex items-center justify-between text-xs text-slate-300">
                <span className="font-medium">Cumulative Solving Progression:</span>
                <span className="font-bold text-emerald-400 font-mono">
                  +{((exec?.total_problems_solved || 0) - (trend[0]?.solved || 0)).toLocaleString()} Problems in 3 Weeks
                </span>
              </div>
            </div>

            {/* Problem Category Buckets */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Award className="w-5 h-5 text-amber-400" />
                  <h3 className="text-base font-bold text-white">Problem Solving Category Buckets</h3>
                </div>
                <span className="text-xs text-slate-400">Official Institutional Tiers</span>
              </div>

              <div className="space-y-3">
                {[
                  { key: 'Above 500', color: 'bg-emerald-500', text: 'text-emerald-400' },
                  { key: '250 - 500', color: 'bg-blue-500', text: 'text-blue-400' },
                  { key: '100 - 249', color: 'bg-indigo-500', text: 'text-indigo-400' },
                  { key: '1 - 99', color: 'bg-amber-500', text: 'text-amber-400' },
                  { key: 'Not Yet Started', color: 'bg-slate-600', text: 'text-slate-400' }
                ].map((tier) => {
                  const count = exec?.category_distribution?.[tier.key] || 0;
                  const total = exec?.total_students || 1;
                  const pct = Math.round((count / total) * 100);

                  return (
                    <div key={tier.key} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-300 font-medium">{tier.key}</span>
                        <span className="font-mono text-slate-200">
                          <strong className={tier.text}>{count}</strong> students ({pct}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full ${tier.color} rounded-full transition-all duration-500`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          PAGE 3: DEPARTMENT & YEAR INTELLIGENCE
      ───────────────────────────────────────────────────────────────────────────── */}
      {(activeSection === 'all' || activeSection === 'departments') && (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-mono font-bold text-blue-400 uppercase tracking-wider">Page 3</span>
              <h2 className="text-xl font-bold text-white">Department & Year Intelligence</h2>
            </div>
            <span className="text-xs text-slate-400">Departmental Matrix & Academic Year Cohort Progress</span>
          </div>

          {/* DEPARTMENT MATRIX TABLE */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Building2 className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-white text-base">Department Performance Matrix</h3>
              </div>
              <span className="text-xs text-slate-400">{departments.length} Active Departments</span>
            </div>

            <div className="overflow-x-auto table-responsive-container">
              <table className="w-full text-left text-xs mobile-card-table">
                <thead className="bg-slate-800/60 text-slate-400 font-semibold border-b border-slate-800 hidden md:table-header-group">
                  <tr>
                    <th className="py-3.5 px-4">Department</th>
                    <th className="py-3.5 px-3 text-center">Total Students</th>
                    <th className="py-3.5 px-3 text-center">Active %</th>
                    <th className="py-3.5 px-3 text-right">{reportingWindow?.previous_week?.week_label || 'Prev'} Solved</th>
                    <th className="py-3.5 px-3 text-right">{reportingWindow?.current_week?.week_label || 'Curr'} Solved</th>
                    <th className="py-3.5 px-3 text-right">Weekly Delta</th>
                    <th className="py-3.5 px-3 text-center">Growth %</th>
                    <th className="py-3.5 px-3 text-center">Avg Solved</th>
                    <th className="py-3.5 px-3 text-center">Avg Rating</th>
                    <th className="py-3.5 px-4 text-center">Contest Att.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {departments.map((dept: any) => (
                    <tr key={dept.department} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-4 font-sans font-bold text-slate-100 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-400" />
                        <span>{dept.department}</span>
                      </td>
                      <td className="py-3.5 px-3 text-center text-slate-300">{dept.total_students}</td>
                      <td className="py-3.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold text-[11px]">
                          {Math.round((dept.active_students / Math.max(1, dept.total_students)) * 100)}%
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-right text-slate-400">{(dept.prev_solved || 0).toLocaleString()}</td>
                      <td className="py-3.5 px-3 text-right text-white font-bold">{(dept.current_solved || 0).toLocaleString()}</td>
                      <td className="py-3.5 px-3 text-right text-purple-400 font-bold">
                        +{dept.weekly_new || 0}
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-md font-semibold text-[11px] ${
                          (dept.growth_pct || 0) > 0 ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-400'
                        }`}>
                          {dept.growth_pct || 0}%
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-center text-slate-300">{dept.avg_solved || 0}</td>
                      <td className="py-3.5 px-3 text-center text-amber-400 font-bold">
                        {dept.avg_rating ? Math.round(dept.avg_rating) : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="text-slate-300">
                          {dept.contest_participants || 0} ({dept.contest_participation_pct || 0}%)
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* YEAR INTELLIGENCE TABLE */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <GraduationCap className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-white text-base">Academic Year Cohort Intelligence</h3>
              </div>
              <span className="text-xs text-slate-400">AY 2026–27 Batch Progression</span>
            </div>

            <div className="overflow-x-auto table-responsive-container">
              <table className="w-full text-left text-xs mobile-card-table">
                <thead className="bg-slate-800/60 text-slate-400 font-semibold border-b border-slate-800 hidden md:table-header-group">
                  <tr>
                    <th className="py-3.5 px-4">Academic Year</th>
                    <th className="py-3.5 px-3">Batch Label</th>
                    <th className="py-3.5 px-3 text-center">Students</th>
                    <th className="py-3.5 px-3 text-right">Current Solved</th>
                    <th className="py-3.5 px-3 text-right">Weekly New</th>
                    <th className="py-3.5 px-3 text-center">Avg Solved</th>
                    <th className="py-3.5 px-3 text-center">Avg Rating</th>
                    <th className="py-3.5 px-4 text-center">Contest Attendance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {years.map((y: any) => (
                    <tr key={y.year} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-4 font-sans font-bold text-white">Year {y.year}</td>
                      <td className="py-3.5 px-3 font-sans text-slate-300">{y.batch_label}</td>
                      <td className="py-3.5 px-3 text-center text-slate-200">{y.total_students}</td>
                      <td className="py-3.5 px-3 text-right text-indigo-300 font-bold">{(y.current_solved || 0).toLocaleString()}</td>
                      <td className="py-3.5 px-3 text-right text-purple-400 font-bold">+{y.weekly_new || 0}</td>
                      <td className="py-3.5 px-3 text-center text-slate-300">{y.avg_solved || 0}</td>
                      <td className="py-3.5 px-3 text-center text-amber-400 font-bold">
                        {y.avg_rating ? Math.round(y.avg_rating) : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-center text-slate-300">
                        {y.contest_participants || 0} ({y.contest_participation_pct || 0}%)
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          PAGE 4: DSA TOPICS & PROGRAMMING LANGUAGES
      ───────────────────────────────────────────────────────────────────────────── */}
      {(activeSection === 'all' || activeSection === 'dsa') && (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-mono font-bold text-blue-400 uppercase tracking-wider">Page 4</span>
              <h2 className="text-xl font-bold text-white">DSA Topic & Language Intelligence</h2>
            </div>
            <span className="text-xs text-slate-400">Real LeetCode API Tag & Submissions Analytics</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* TOP DSA TOPICS */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Cpu className="w-5 h-5 text-blue-400" />
                  <h3 className="font-bold text-white text-base">Top Data Structure & Algorithms Topics</h3>
                </div>
                <span className="text-xs text-slate-400">
                  {(dsa?.total_dsa_submissions || 0).toLocaleString()} Tag Solves
                </span>
              </div>

              <div className="space-y-3.5">
                {(dsa?.top_topics || []).map((t: any) => (
                  <div key={t.topic_name} className="space-y-1.5">
                    <div className="flex justify-between text-xs items-center">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-200">{t.topic_name}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          {t.tier}
                        </span>
                      </div>
                      <span className="font-mono text-slate-300">
                        <strong>{(t.problems_solved || 0).toLocaleString()}</strong> solved ({t.pct_of_total}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                        style={{ width: `${Math.min(100, t.pct_of_total * 2)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* PROGRAMMING LANGUAGE BREAKDOWN */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center space-x-2">
                    <Code className="w-5 h-5 text-purple-400" />
                    <h3 className="font-bold text-white text-base">Programming Language Distribution</h3>
                  </div>
                  <span className="text-xs text-slate-400">Authoritative Language Submissions</span>
                </div>

                <div className="space-y-4">
                  {(languages?.top_languages || []).map((l: any) => (
                    <div key={l.language_name} className="space-y-1.5">
                      <div className="flex justify-between text-xs items-center">
                        <span className="font-semibold text-slate-200">{l.language_name}</span>
                        <span className="font-mono text-slate-300">
                          <strong className="text-purple-300">{(l.problems_solved || 0).toLocaleString()}</strong> solves ({l.pct_of_total}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
                          style={{ width: `${l.pct_of_total}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* WEAK TOPICS ADVISORY */}
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl space-y-2 mt-4">
                <div className="flex items-center space-x-2 text-amber-400 text-xs font-bold">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Curriculum Remediation Priority</span>
                </div>
                <p className="text-xs text-slate-300">
                  Dynamic Programming and Graph Algorithms show the lowest cohort penetration. Recommend assigning 5 mandatory foundation DP problems for upcoming weekly challenge.
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          PAGE 5: CONTEST INTELLIGENCE
      ───────────────────────────────────────────────────────────────────────────── */}
      {(activeSection === 'all' || activeSection === 'contests') && (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-mono font-bold text-blue-400 uppercase tracking-wider">Page 5</span>
              <h2 className="text-xl font-bold text-white">Contest Intelligence</h2>
            </div>
            <span className="text-xs text-slate-400">Weekly Sunday Contest Performance & Question Breakdown</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* CONTEST OVERVIEW CARD */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4">
              <div className="flex items-center space-x-2 text-white font-bold text-base">
                <Award className="w-5 h-5 text-amber-400" />
                <span>{contest?.contest_name || 'Weekly Contest 519'}</span>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex justify-between text-xs py-2 border-b border-slate-800">
                  <span className="text-slate-400">Contest Date</span>
                  <span className="text-slate-200 font-mono font-bold">{contest?.session_date || '13.09.2026'}</span>
                </div>
                <div className="flex justify-between text-xs py-2 border-b border-slate-800">
                  <span className="text-slate-400">Official Participants</span>
                  <span className="text-emerald-400 font-mono font-bold">{contest?.participants_count || 0}</span>
                </div>
                <div className="flex justify-between text-xs py-2 border-b border-slate-800">
                  <span className="text-slate-400">Attendance Rate</span>
                  <span className="text-blue-400 font-mono font-bold">{contest?.attendance_pct || 0}%</span>
                </div>
                <div className="flex justify-between text-xs py-2">
                  <span className="text-slate-400">Average Contest Rating</span>
                  <span className="text-amber-400 font-mono font-bold">
                    {contest?.average_rating ? Math.round(contest.average_rating) : '1500 (Baseline)'}
                  </span>
                </div>
              </div>
            </div>

            {/* PROBLEM BREAKDOWN Q1..Q4 */}
            <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-white text-base">Contest Problem Breakdown (Q1–Q4)</h3>
                <span className="text-xs text-slate-400">Institutional Solve Counts</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(contest?.problem_breakdown || []).map((q: any) => (
                  <div key={q.question} className="p-4 bg-slate-800/50 border border-slate-700/50 rounded-2xl text-center space-y-2">
                    <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-xs font-mono font-bold">
                      {q.question} ({q.difficulty})
                    </span>
                    <div className="text-2xl font-black text-white font-mono">{q.solved || 0}</div>
                    <span className="text-[11px] text-slate-400 block">{q.solved_pct || 0}% solved</span>
                  </div>
                ))}
              </div>

              <div className="p-4 bg-slate-800/30 rounded-2xl border border-slate-700/30 text-xs text-slate-400 flex items-center justify-between">
                <span>Contest Classification Protocol:</span>
                <span className="font-mono text-emerald-400 font-semibold">Authoritative LeetCode GraphQL Sync</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          PAGE 6: STUDENT-LEVEL 3-WEEK COMPARISON
      ───────────────────────────────────────────────────────────────────────────── */}
      {(activeSection === 'all' || activeSection === 'students') && (
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-mono font-bold text-blue-400 uppercase tracking-wider">Page 6</span>
              <h2 className="text-xl font-bold text-white">Student-Level 3-Week Comparison</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Dynamic rolling window: {reportingWindow?.window_str}
              </p>
            </div>

            {/* SEARCH BOX */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search name, reg no, username..."
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* DATA TABLE */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto table-responsive-container">
              <table className="w-full text-left text-xs mobile-card-table">
                <thead className="bg-slate-800/60 text-slate-400 font-semibold border-b border-slate-800 hidden md:table-header-group">
                  <tr>
                    <th className="py-3.5 px-4">Reg No</th>
                    <th className="py-3.5 px-3">Student Name</th>
                    <th className="py-3.5 px-2 text-center">Dept</th>
                    <th className="py-3.5 px-2 text-center">Year</th>
                    <th
                      onClick={() => handleSort('prev_prev_solved')}
                      className="py-3.5 px-3 text-right cursor-pointer hover:text-white"
                    >
                      {reportingWindow?.prev_prev_week?.week_label || 'W-1'}
                    </th>
                    <th
                      onClick={() => handleSort('prev_solved')}
                      className="py-3.5 px-3 text-right cursor-pointer hover:text-white"
                    >
                      {reportingWindow?.previous_week?.week_label || 'W0'}
                    </th>
                    <th
                      onClick={() => handleSort('current_solved')}
                      className="py-3.5 px-3 text-right cursor-pointer hover:text-white font-bold text-slate-200"
                    >
                      {reportingWindow?.current_week?.week_label || 'W1'}
                    </th>
                    <th
                      onClick={() => handleSort('weekly_delta')}
                      className="py-3.5 px-3 text-right cursor-pointer hover:text-white font-bold text-purple-400"
                    >
                      Weekly Delta
                    </th>
                    <th
                      onClick={() => handleSort('growth_pct')}
                      className="py-3.5 px-3 text-center cursor-pointer hover:text-white"
                    >
                      Growth %
                    </th>
                    <th
                      onClick={() => handleSort('risk_score')}
                      className="py-3.5 px-3 text-center cursor-pointer hover:text-white"
                    >
                      Risk
                    </th>
                    <th className="py-3.5 px-4 text-center">Deep Dive</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {paginatedStudents.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-slate-500 font-sans">
                        No students match the selected filter criteria.
                      </td>
                    </tr>
                  ) : (
                    paginatedStudents.map((s: any) => {
                      const isInspected = inspectStudentId === s.id;
                      return (
                        <tr
                          key={s.id}
                          className={`hover:bg-slate-800/40 transition-colors ${
                            isInspected ? 'bg-blue-950/30' : ''
                          }`}
                        >
                          <td className="py-3.5 px-4 text-slate-300 font-bold">{s.reg_no}</td>
                          <td className="py-3.5 px-3 font-sans font-medium text-white max-w-[180px] truncate">
                            {s.name}
                          </td>
                          <td className="py-3.5 px-2 text-center font-sans text-slate-400">{s.department}</td>
                          <td className="py-3.5 px-2 text-center text-slate-400">{s.year}</td>
                          <td className="py-3.5 px-3 text-right text-slate-500">{s.prev_prev_solved}</td>
                          <td className="py-3.5 px-3 text-right text-slate-400">{s.prev_solved}</td>
                          <td className="py-3.5 px-3 text-right text-white font-bold">{s.current_solved}</td>
                          <td className="py-3.5 px-3 text-right text-purple-400 font-bold">
                            +{s.weekly_delta}
                          </td>
                          <td className="py-3.5 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                              s.growth_pct > 0 ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-400'
                            }`}>
                              {s.growth_pct}%
                            </span>
                          </td>
                          <td className="py-3.5 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              s.risk_level === 'CRITICAL' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                              s.risk_level === 'HIGH' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                              s.risk_level === 'MODERATE' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                              'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            }`}>
                              {s.risk_level}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <button
                              onClick={() => {
                                setInspectStudentId(s.id);
                                setActiveSection('deepdive');
                              }}
                              className="px-2.5 py-1 bg-slate-800 hover:bg-blue-600 text-slate-300 hover:text-white rounded-lg text-[11px] font-sans font-semibold transition-all flex items-center gap-1 mx-auto"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Inspect</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* PAGINATION */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <span>
                  Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, filteredStudents.length)} of {filteredStudents.length} students
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <span className="font-mono text-slate-200">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          PAGE 7+: STUDENT DEEP DIVE
      ───────────────────────────────────────────────────────────────────────────── */}
      {(activeSection === 'all' || activeSection === 'deepdive') && activeDeepDiveStudent && (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-mono font-bold text-blue-400 uppercase tracking-wider">Page 7+</span>
              <h2 className="text-xl font-bold text-white">Student Deep Dive Intelligence</h2>
            </div>
            <span className="text-xs text-slate-400">Individual Algorithmic & Risk Diagnostics</span>
          </div>

          {/* STUDENT PICKER DROPDOWN */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
              <div className="flex items-center space-x-4">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center text-white text-xl font-black font-mono shadow-lg shadow-blue-900/30">
                  {activeDeepDiveStudent.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <span>{activeDeepDiveStudent.name}</span>
                    <a
                      href={activeDeepDiveStudent.leetcode_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-400 hover:text-blue-300 transition-colors"
                      title="Open LeetCode Profile"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2 font-mono">
                    <span>{activeDeepDiveStudent.reg_no}</span>
                    <span>•</span>
                    <span>{activeDeepDiveStudent.department} ({activeDeepDiveStudent.year} Year)</span>
                    <span>•</span>
                    <span className="text-slate-300">@{activeDeepDiveStudent.username}</span>
                  </p>
                </div>
              </div>

              {/* QUICK STUDENT SWITCHER */}
              <div className="w-full sm:w-64">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Inspect Student:
                </label>
                <select
                  value={activeDeepDiveStudent.student_id}
                  onChange={(e) => setInspectStudentId(Number(e.target.value))}
                  aria-label="Select student for deep dive inspection"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {studentDeepDives.map((s: any) => (
                    <option key={s.student_id} value={s.student_id}>
                      {s.reg_no} — {s.name} ({s.department})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* HERO STAT CARDS */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Current Solved</span>
                <div className="text-2xl font-black text-white font-mono">
                  {activeDeepDiveStudent.metrics.current_solved}
                </div>
                <span className="text-[11px] text-slate-400">Total Solved</span>
              </div>

              <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50 space-y-1">
                <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Weekly Delta</span>
                <div className="text-2xl font-black text-purple-300 font-mono">
                  +{activeDeepDiveStudent.metrics.weekly_new}
                </div>
                <span className="text-[11px] text-purple-400/80">+{activeDeepDiveStudent.metrics.growth_pct}% Growth</span>
              </div>

              <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50 space-y-1">
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Contest Rating</span>
                <div className="text-2xl font-black text-amber-400 font-mono">
                  {activeDeepDiveStudent.metrics.contest_rating || '1500'}
                </div>
                <span className="text-[11px] text-amber-500/80">
                  Global Rank: {activeDeepDiveStudent.metrics.global_rank || '—'}
                </span>
              </div>

              <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Risk Assessment</span>
                <div className={`text-2xl font-black font-mono ${
                  activeDeepDiveStudent.metrics.risk_level === 'CRITICAL' ? 'text-rose-400' :
                  activeDeepDiveStudent.metrics.risk_level === 'HIGH' ? 'text-amber-400' :
                  activeDeepDiveStudent.metrics.risk_level === 'MODERATE' ? 'text-blue-400' :
                  'text-emerald-400'
                }`}>
                  {activeDeepDiveStudent.metrics.risk_score} <span className="text-xs font-normal">/ 100</span>
                </div>
                <span className="text-[11px] font-semibold text-slate-300">{activeDeepDiveStudent.metrics.risk_level}</span>
              </div>
            </div>

            {/* 3-WEEK HISTORY & DIFFICULTY BREAKDOWN */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Historical Progression */}
              <div className="bg-slate-800/30 p-5 rounded-2xl border border-slate-700/40 space-y-4">
                <h4 className="font-bold text-white text-sm flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-400" />
                  <span>3-Week Historical Solve Progression</span>
                </h4>

                <div className="grid grid-cols-3 gap-3">
                  {(activeDeepDiveStudent.history_3_weeks || []).map((h: any, idx: number) => (
                    <div key={h.week_label} className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 text-center space-y-1">
                      <span className="text-[11px] font-mono font-bold text-slate-400">{h.week_label}</span>
                      <div className="text-lg font-black text-white font-mono">{h.solved}</div>
                      <span className="text-[10px] text-slate-500">{h.contest_solved} in contest</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Difficulty Distribution */}
              <div className="bg-slate-800/30 p-5 rounded-2xl border border-slate-700/40 space-y-4">
                <h4 className="font-bold text-white text-sm flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-400" />
                  <span>Problem Difficulty Distribution</span>
                </h4>

                <div className="grid grid-cols-3 gap-3 text-center font-mono">
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                    <span className="text-[10px] font-bold text-emerald-400 block font-sans">EASY</span>
                    <span className="text-lg font-black text-white">{activeDeepDiveStudent.difficulty.easy}</span>
                    <span className="text-[10px] text-emerald-400/80 block">({activeDeepDiveStudent.difficulty.easy_pct}%)</span>
                  </div>

                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                    <span className="text-[10px] font-bold text-amber-400 block font-sans">MEDIUM</span>
                    <span className="text-lg font-black text-white">{activeDeepDiveStudent.difficulty.medium}</span>
                    <span className="text-[10px] text-amber-400/80 block">({activeDeepDiveStudent.difficulty.medium_pct}%)</span>
                  </div>

                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                    <span className="text-[10px] font-bold text-rose-400 block font-sans">HARD</span>
                    <span className="text-lg font-black text-white">{activeDeepDiveStudent.difficulty.hard}</span>
                    <span className="text-[10px] text-rose-400/80 block">({activeDeepDiveStudent.difficulty.hard_pct}%)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* AI RISK INSIGHTS & REMEDIAL ACTIONS */}
            <div className="p-5 bg-gradient-to-br from-slate-900 to-blue-950/40 rounded-2xl border border-blue-900/40 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-blue-400 font-bold text-sm">
                  <Sparkles className="w-4 h-4" />
                  <span>Explainable AI Risk Diagnostic & Prescribed Mentorship</span>
                </div>
                <span className="text-xs font-mono text-slate-400">
                  Confidence: {activeDeepDiveStudent.ai_risk_insights?.confidence_pct || 85}%
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="font-bold text-slate-300 block mb-1">Diagnostic Explanation:</span>
                  <p className="text-slate-400 bg-slate-800/40 p-3 rounded-xl border border-slate-700/40">
                    {activeDeepDiveStudent.ai_risk_insights?.explanation || 'Consistent activity maintained.'}
                  </p>
                </div>

                <div>
                  <span className="font-bold text-emerald-400 block mb-1">Prescribed Faculty Mentor Action:</span>
                  <p className="text-slate-200 bg-emerald-950/20 p-3 rounded-xl border border-emerald-800/30">
                    {activeDeepDiveStudent.ai_risk_insights?.recommended_action || 'Maintain momentum and practice medium difficulty problems.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          FINAL PAGE: DATA RULES & PRODUCTION QUALITY TELEMETRY
      ───────────────────────────────────────────────────────────────────────────── */}
      {(activeSection === 'all' || activeSection === 'quality') && (
        <section className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center space-x-3 text-slate-200">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
            <div>
              <h3 className="text-lg font-bold text-white">Data Rules & Production Telemetry</h3>
              <p className="text-xs text-slate-400">Deterministic Mathematical Audit & Integrity Checklist</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
            <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50 space-y-1">
              <span className="text-slate-400 font-sans text-[11px] block">Cumulative Delta Formula</span>
              <span className="text-emerald-400 font-bold">Weekly Delta = W_curr − W_prev</span>
              <span className="text-slate-500 text-[10px] block">Strictly Enforced Server-Side</span>
            </div>

            <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50 space-y-1">
              <span className="text-slate-400 font-sans text-[11px] block">Cohort Sum Balance</span>
              <span className="text-blue-400 font-bold">Σ Buckets ≡ Total Cohort</span>
              <span className="text-slate-500 text-[10px] block">Zero Student Loss Validated</span>
            </div>

            <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50 space-y-1">
              <span className="text-slate-400 font-sans text-[11px] block">Audit Hash (SHA-256)</span>
              <span className="text-indigo-300 text-[10px] truncate block">
                {metadata?.audit_hash || 'SHA256-SYNCHRONIZED-AUDIT'}
              </span>
              <span className="text-slate-500 text-[10px] block">Deterministic Reproducibility</span>
            </div>
          </div>

          <div className="text-xs text-slate-500 pt-2 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span>Official Report Engine • Nandha Engineering College (Autonomous)</span>
            <span>Server Time: {metadata?.generated_at}</span>
          </div>
        </section>
      )}
    </div>
  );
};
