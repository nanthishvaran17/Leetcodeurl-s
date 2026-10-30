import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { 
  ShieldCheck, CheckCircle2, AlertTriangle, XCircle, RefreshCw, 
  Layers, Search, FileText, AlertCircle, ExternalLink, Clock,
  Building2, GraduationCap, RotateCcw, ChevronRight, Eye, UserCheck, UserX,
  Wifi, User, ArrowRight, Check, SlidersHorizontal, Filter, Globe
} from 'lucide-react';
import api from '../services/api';
import { useNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { getUserCollege, isGlobalAccessRole } from '../services/auth/authTypes';
import { useDepartments } from '../contexts/DepartmentContext';
import PremiumDepartmentSelect from '../components/ui/PremiumDepartmentSelect';
import { GlobalFilter } from '../components/GlobalFilter';

const StudentProfilePage = lazy(() => import('./StudentProfilePage').then(m => ({ default: m.StudentProfilePage })));

const getInitials = (name: string) => {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const getStatusConfig = (status: string) => {
  switch (status) {
    case 'VALID_PROFILE':
      return {
        label: 'VALID PROFILE',
        bg: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30',
        dot: 'bg-emerald-500'
      };
    case 'MISSING_USERNAME':
      return {
        label: 'MISSING HANDLE',
        bg: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30',
        dot: 'bg-amber-500'
      };
    case 'PROFILE_NOT_FOUND':
      return {
        label: 'NOT FOUND (404)',
        bg: 'bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-500/30',
        dot: 'bg-rose-500'
      };
    case 'INVALID_PROFILE_URL':
      return {
        label: 'INVALID URL',
        bg: 'bg-orange-500/15 text-orange-800 dark:text-orange-300 border-orange-500/30',
        dot: 'bg-orange-500'
      };
    case 'NETWORK_ERROR':
      return {
        label: 'NETWORK SYNC',
        bg: 'bg-cyan-500/15 text-cyan-800 dark:text-cyan-300 border-cyan-500/30',
        dot: 'bg-cyan-500'
      };
    default:
      return {
        label: (status || 'UNKNOWN').replace(/_/g, ' '),
        bg: 'bg-slate-500/15 text-slate-800 dark:text-slate-300 border-slate-500/30',
        dot: 'bg-slate-400'
      };
  }
};

interface DataQualityPageProps {
  onNavigateTab?: (tab: string) => void;
  onSelectStudent?: (student: any) => void;
}

export const DataQualityPage: React.FC<DataQualityPageProps> = ({ onNavigateTab, onSelectStudent }) => {
  const { notify } = useNotification();
  const { departments } = useDepartments();
  const { user } = useAuth();
  const userCollege = useMemo(() => getUserCollege(user), [user]);
  const isGlobalAccess = isGlobalAccessRole(user);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [lastAuditTime, setLastAuditTime] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCollege, setSelectedCollege] = useState<'ALL' | 'NEC' | 'NCT'>(() => isGlobalAccess ? 'ALL' : userCollege);

  useEffect(() => {
    if (!isGlobalAccess && selectedCollege !== userCollege) {
      setSelectedCollege(userCollege);
    }
  }, [isGlobalAccess, userCollege, selectedCollege]);
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [selectedYear, setSelectedYear] = useState<string>('ALL');
  const [selectedStudentForProfile, setSelectedStudentForProfile] = useState<any | null>(null);

  const [isMobile, setIsMobile] = useState<boolean>(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(() => typeof window !== 'undefined' && window.innerWidth < 768 ? 10 : 25);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, filterCategory, selectedCollege, selectedDept, selectedYear]);

  useEffect(() => {
    fetchQualityData(false);
  }, [selectedCollege, selectedDept, selectedYear]);

  // Pull-to-refresh listener: re-run quality audit
  useEffect(() => {
    const handlePull = () => {
      fetchQualityData(true);
    };
    window.addEventListener('pull_to_refresh', handlePull);
    return () => window.removeEventListener('pull_to_refresh', handlePull);
  }, [selectedCollege, selectedDept, selectedYear]);

  const fetchQualityData = async (force: boolean = false) => {
    if (force) {
      setRefreshing(true);
      notify.info('Initiating Quality Audit', 'Re-evaluating student roster records against canonical schemas...', { category: 'DATA AUDITOR' });
    } else {
      setLoading(true);
    }

    try {
      const res = await api.get('/analytics/data-quality', {
        params: {
          college: selectedCollege,
          dept: selectedDept,
          year: selectedYear,
          ...(force ? { force_refresh: true } : {})
        }
      });
      setData(res.data);
      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastAuditTime(nowStr);

      if (force) {
        notify.success('Audit Complete', `Roster Accuracy Score: ${res.data.health_score_percentage}% (${res.data.valid_profiles} valid, ${res.data.issues_count} action items).`, { category: 'DATA AUDITOR' });
      }
    } catch (err: any) {
      console.error("Failed to fetch quality data", err);
      notify.error('Audit Failure', 'Failed to calculate database quality telemetry.', { category: 'DATA AUDITOR' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center space-y-4">
        <RefreshCw className="w-8 h-8 animate-spin text-brand-500" />
        <p className="font-bold text-slate-700 dark:text-slate-300">Auditing Data Quality & Student Roster Health...</p>
      </div>
    );
  }

  const healthScore = data?.health_score_percentage ?? 100;
  const issuesList = data?.issues_list || [];

  // Filter issues list dynamically based on search query and selected filter category
  const filteredIssues = issuesList.filter((item: any) => {
    const matchesSearch = !searchQuery.trim() || 
      item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.reg_no?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.dept?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.issue?.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (filterCategory === 'ALL') return true;
    if (filterCategory === 'VALID') return item.status === 'VALID_PROFILE';
    if (filterCategory === 'MISSING') return item.status === 'MISSING_USERNAME';
    if (filterCategory === 'NOT_FOUND') return item.status === 'PROFILE_NOT_FOUND';
    if (filterCategory === 'INVALID') return item.status === 'INVALID_PROFILE_URL';
    if (filterCategory === 'NETWORK') return item.status === 'NETWORK_ERROR';
    return true;
  });

  const handleStudentClick = (item: any) => {
    const studentObj = {
      id: item.id || item.reg_no,
      name: item.name,
      reg_no: item.reg_no,
      username: item.username || '',
      leetcode_url: item.leetcode_url || '',
      department: item.department || { code: item.dept, name: item.dept },
      dept: item.dept,
      year_level: item.year_level || item.year || 'III',
      stats: item.stats || {
        total_solved: 0,
        sync_status: item.status === 'VALID_PROFILE' ? 'verified' : 'pending'
      }
    };
    if (onSelectStudent) {
      onSelectStudent(studentObj);
    } else {
      setSelectedStudentForProfile(studentObj);
    }
  };

  return (
    <div className="w-full space-y-3 sm:space-y-6 md:space-y-8 animate-fade-in pb-32 sm:pb-16 font-sans px-0 max-w-full">
      
      {/* Hero Banner with Rich Styling */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white p-3.5 sm:p-6 md:p-8 shadow-lg border border-brand-500/30">

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-6">
          <div className="space-y-1.5 sm:space-y-3 max-w-3xl">
            {/* Mobile Top Strip: Badge + Audit Time */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg sm:rounded-full bg-brand-500/20 border border-brand-400/30 text-brand-300 text-[9px] sm:text-xs font-black tracking-wider leading-none">
                <span>DATA INTEGRITY • REALTIME AUDIT</span>
              </div>
              {lastAuditTime && (
                <div className="flex sm:hidden items-center space-x-1 px-2.5 py-1 rounded-xl bg-white/10 border border-white/15 text-slate-200 text-[10px] font-mono font-bold shadow-xs">
                  <Clock className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span>{lastAuditTime}</span>
                </div>
              )}
            </div>

            <h1 className="text-xl sm:text-3xl md:text-4xl font-black tracking-tight leading-tight">
              Data Quality &amp; <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-400 via-orange-300 to-rose-300">Profile Health</span>
            </h1>

            <p className="text-[11px] sm:text-sm text-slate-300 font-medium sm:font-bold tracking-wide line-clamp-2 sm:line-clamp-none leading-relaxed">
              Monitor missing links, invalid profile URLs, profile not found errors, and network anomalies across all institutional student records.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 w-full lg:w-auto shrink-0 pt-1 sm:pt-0">
            {lastAuditTime && (
              <div className="hidden sm:flex items-center space-x-2 px-3 py-2 rounded-2xl bg-white/10 border border-white/15 text-slate-200 text-xs font-mono font-bold shadow-xs">
                <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Audited: {lastAuditTime}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center w-full sm:w-auto">
              {onNavigateTab && (
                <button
                  type="button"
                  onClick={() => onNavigateTab('data-issues')}
                  className="px-3 sm:px-4 py-2 sm:py-2.5 min-h-[40px] sm:min-h-[44px] bg-gradient-to-r from-rose-600 via-rose-500 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white text-[11px] sm:text-xs font-black rounded-xl sm:rounded-2xl shadow-lg shadow-rose-600/30 transition-all flex items-center justify-center space-x-1.5 cursor-pointer active:scale-95 border border-rose-400/30 touch-manipulation"
                >
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Issues &amp; Recovery</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => fetchQualityData(true)}
                disabled={refreshing}
                className="px-3 sm:px-4 py-2 sm:py-2.5 min-h-[40px] sm:min-h-[44px] bg-white/10 hover:bg-white/20 active:bg-white/25 text-white text-[11px] sm:text-xs font-black rounded-xl sm:rounded-2xl border border-white/20 transition-all backdrop-blur-md flex items-center justify-center space-x-1.5 cursor-pointer active:scale-95 shadow-xs touch-manipulation disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''} shrink-0 text-brand-300`} />
                <span>{refreshing ? 'Auditing...' : 'Run Audit'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Scope Filter Controls - 2026 SaaS Glassmorphic Bar */}
      <div className="bg-white/90 dark:bg-navy-950/90 backdrop-blur-xl p-3 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-white/10 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-end justify-between gap-2.5 sm:gap-4 w-full">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-5 flex-1 w-full max-w-4xl min-w-0">
          {/* College Campus Filter — Admin & Management only */}
          {isGlobalAccess && (
            <GlobalFilter
              label="College Campus"
              value={selectedCollege}
              onChange={(val) => setSelectedCollege(val as 'ALL' | 'NEC' | 'NCT')}
              dropdownWidth="w-full max-w-xs sm:max-w-md min-w-0"
              options={[
                { value: "ALL", label: "All Colleges", pillText: "ALL" },
                { value: "NEC", label: "Nandha Engineering College (NEC)", pillText: "NEC" },
                { value: "NCT", label: "Nandha College of Technology (NCT)", pillText: "NCT" }
              ]}
            />
          )}

          {/* Department Filter */}
          <PremiumDepartmentSelect
            selectedDept={selectedDept}
            onChange={(val) => setSelectedDept(val)}
            useIdAsValue={false}
            label="Department Scope"
            dropdownWidth="w-full max-w-xs sm:max-w-md min-w-0"
          />

          {/* Academic Year Filter */}
          <GlobalFilter
            label="Academic Year"
            value={selectedYear}
            onChange={setSelectedYear}
            dropdownWidth="w-full max-w-xs sm:max-w-md min-w-0"
            searchPlaceholder="Search academic year..."
            options={[
              { value: "ALL", label: "All Academic Years", pillText: "ALL" },
              { value: "1", label: "I Year", pillText: "1ST" },
              { value: "2", label: "II Year", pillText: "2ND" },
              { value: "3", label: "III Year", pillText: "3RD" },
              { value: "4", label: "IV Year", pillText: "4TH" }
            ]}
          />
        </div>

        {((isGlobalAccess ? selectedCollege !== 'ALL' : false) || selectedDept !== 'ALL' || selectedYear !== 'ALL') && (
          <button
            type="button"
            onClick={() => { setSelectedCollege(isGlobalAccess ? 'ALL' : userCollege); setSelectedDept('ALL'); setSelectedYear('ALL'); }}
            className="text-[11px] sm:text-xs font-black text-rose-600 dark:text-rose-400 hover:text-rose-700 flex items-center justify-center space-x-1.5 cursor-pointer bg-rose-50 dark:bg-rose-950/40 px-3 py-2 min-h-[38px] sm:min-h-[44px] rounded-xl sm:rounded-2xl border border-rose-200 dark:border-rose-800 shadow-xs transition-all shrink-0 self-stretch sm:self-end touch-manipulation active:scale-95"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Filters</span>
          </button>
        )}
      </div>

      {/* Metrics Snapshot Grid — 5 2026 SaaS Bento Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4">
        {/* 1. Health Score */}
        <div 
          onClick={() => setFilterCategory('ALL')}
          className={`relative overflow-hidden p-3 sm:p-5 rounded-2xl sm:rounded-3xl border flex flex-col justify-between min-h-[92px] sm:min-h-[110px] transition-all duration-200 cursor-pointer touch-manipulation hover:-translate-y-0.5 active:scale-95 ${
            filterCategory === 'ALL' 
              ? 'bg-gradient-to-br from-emerald-50 via-white to-teal-50/50 dark:from-emerald-950/40 dark:via-slate-900/90 dark:to-slate-950 border-emerald-500 ring-2 ring-emerald-500/30 shadow-md shadow-emerald-500/10' 
              : 'bg-white/90 dark:bg-[#0c1324] border-slate-200/90 dark:border-white/10 hover:border-emerald-400 dark:hover:border-emerald-500/50 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">Health Score</span>
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl bg-emerald-500/15 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-xl sm:text-3xl font-black text-emerald-800 dark:text-emerald-300 tracking-tight my-0.5 sm:my-1">{healthScore}%</p>
          <span className="inline-flex items-center text-[9px] sm:text-[10px] font-black text-emerald-800 dark:text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-md sm:rounded-full w-fit border border-emerald-500/20">
            Roster Accuracy
          </span>
        </div>

        {/* 2. Valid Profiles */}
        <div 
          onClick={() => setFilterCategory('VALID')}
          className={`relative overflow-hidden p-3 sm:p-5 rounded-2xl sm:rounded-3xl border flex flex-col justify-between min-h-[92px] sm:min-h-[110px] transition-all duration-200 cursor-pointer touch-manipulation hover:-translate-y-0.5 active:scale-95 ${
            filterCategory === 'VALID' 
              ? 'bg-gradient-to-br from-indigo-50 via-white to-blue-50/50 dark:from-indigo-950/40 dark:via-slate-900/90 dark:to-slate-950 border-brand-500 ring-2 ring-brand-500/30 shadow-md shadow-indigo-500/10' 
              : 'bg-white/90 dark:bg-[#0c1324] border-slate-200/90 dark:border-white/10 hover:border-brand-400 dark:hover:border-brand-500/50 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-brand-800 dark:text-brand-300">Valid Profiles</span>
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl bg-brand-500/15 border border-brand-500/20 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-xl sm:text-3xl font-black text-slate-950 dark:text-white tracking-tight my-0.5 sm:my-1">
            {data?.valid_profiles || 0}
            {data?.total_students ? <span className="text-[10px] sm:text-sm font-semibold text-slate-500 dark:text-slate-400 font-mono"> / {data.total_students}</span> : null}
          </p>
          <span className="inline-flex items-center text-[9px] sm:text-[10px] font-black text-brand-800 dark:text-brand-300 bg-brand-500/10 px-2 py-0.5 rounded-md sm:rounded-full w-fit border border-brand-500/20">
            Strictly Mapped
          </span>
        </div>

        {/* 3. Missing Links */}
        <div 
          onClick={() => setFilterCategory('MISSING')}
          className={`relative overflow-hidden p-3 sm:p-5 rounded-2xl sm:rounded-3xl border flex flex-col justify-between min-h-[92px] sm:min-h-[110px] transition-all duration-200 cursor-pointer touch-manipulation hover:-translate-y-0.5 active:scale-95 ${
            filterCategory === 'MISSING' 
              ? 'bg-gradient-to-br from-amber-50 via-white to-orange-50/50 dark:from-amber-950/40 dark:via-slate-900/90 dark:to-slate-950 border-amber-500 ring-2 ring-amber-500/30 shadow-md shadow-amber-500/10' 
              : 'bg-white/90 dark:bg-[#0c1324] border-slate-200/90 dark:border-white/10 hover:border-amber-400 dark:hover:border-amber-500/50 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">Missing Links</span>
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl bg-amber-500/15 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <AlertCircle className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-xl sm:text-3xl font-black text-amber-800 dark:text-amber-300 tracking-tight my-0.5 sm:my-1">{data?.missing_links || 0}</p>
          <span className="inline-flex items-center text-[9px] sm:text-[10px] font-black text-amber-800 dark:text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-md sm:rounded-full w-fit border border-amber-500/20">
            No Username
          </span>
        </div>

        {/* 4. Profile Not Found */}
        <div 
          onClick={() => setFilterCategory('NOT_FOUND')}
          className={`relative overflow-hidden p-3 sm:p-5 rounded-2xl sm:rounded-3xl border flex flex-col justify-between min-h-[92px] sm:min-h-[110px] transition-all duration-200 cursor-pointer touch-manipulation hover:-translate-y-0.5 active:scale-95 ${
            filterCategory === 'NOT_FOUND' 
              ? 'bg-gradient-to-br from-rose-50 via-white to-red-50/50 dark:from-rose-950/40 dark:via-slate-900/90 dark:to-slate-950 border-rose-500 ring-2 ring-rose-500/30 shadow-md shadow-rose-500/10' 
              : 'bg-white/90 dark:bg-[#0c1324] border-slate-200/90 dark:border-white/10 hover:border-rose-400 dark:hover:border-rose-500/50 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-rose-800 dark:text-rose-300">Not Found</span>
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl bg-rose-500/15 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <UserX className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-xl sm:text-3xl font-black text-rose-800 dark:text-rose-300 tracking-tight my-0.5 sm:my-1">{data?.profile_not_found || 0}</p>
          <span className="inline-flex items-center text-[9px] sm:text-[10px] font-black text-rose-800 dark:text-rose-300 bg-rose-500/10 px-2 py-0.5 rounded-md sm:rounded-full w-fit border border-rose-500/20">
            Invalid LC
          </span>
        </div>

        {/* 5. Network / Sync */}
        <div 
          onClick={() => setFilterCategory('NETWORK')}
          className={`col-span-2 sm:col-span-1 relative overflow-hidden p-3 sm:p-5 rounded-2xl sm:rounded-3xl border flex flex-col justify-between min-h-[82px] sm:min-h-[110px] transition-all duration-200 cursor-pointer touch-manipulation hover:-translate-y-0.5 active:scale-95 ${
            filterCategory === 'NETWORK' 
              ? 'bg-gradient-to-br from-cyan-50 via-white to-blue-50/50 dark:from-cyan-950/40 dark:via-slate-900/90 dark:to-slate-950 border-cyan-500 ring-2 ring-cyan-500/30 shadow-md shadow-cyan-500/10' 
              : 'bg-white/90 dark:bg-[#0c1324] border-slate-200/90 dark:border-white/10 hover:border-cyan-400 dark:hover:border-cyan-500/50 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-cyan-800 dark:text-cyan-300">Network / Sync</span>
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl bg-cyan-500/15 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
              <Wifi className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between sm:block">
            <p className="text-xl sm:text-3xl font-black text-cyan-800 dark:text-cyan-300 tracking-tight my-0.5 sm:my-1">{data?.network_errors || 0}</p>
            <span className="inline-flex items-center text-[9px] sm:text-[10px] font-black text-cyan-800 dark:text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded-md sm:rounded-full w-fit border border-cyan-500/20">
              Retry Anomalies
            </span>
          </div>
        </div>
      </div>

      {/* Profile Attention & Quality Issues Board */}
      <div className="border border-slate-200/90 dark:border-white/10 rounded-2xl sm:rounded-3xl overflow-hidden shadow-xl bg-white dark:bg-navy-950 p-3 sm:p-6 space-y-3 sm:space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2.5 sm:gap-4 pb-2 border-b border-slate-100 dark:border-white/10">
          <div className="space-y-0.5 sm:space-y-1">
            <h3 className="text-xs sm:text-sm font-black uppercase text-slate-900 dark:text-white flex items-center space-x-1.5 sm:space-x-2">
              <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500" />
              <span>Data Quality Roster ({filteredIssues.length})</span>
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium">Filter by category or search name, register number, or issue flag.</p>
          </div>

          {/* Interactive Search & Filter Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2.5 w-full xl:w-auto">
            <div className="relative flex-1 min-w-[180px]">
              <input
                type="text"
                placeholder="Search name, reg no..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                className="pl-8 sm:pl-9 pr-8 py-2 sm:py-2.5 min-h-[40px] sm:min-h-[44px] rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-navy-900/60 text-xs font-bold text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 w-full shadow-xs transition-all"
              />
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 sm:pl-3 z-10 text-slate-400">
                <Search className="w-3.5 h-3.5 stroke-[2.5]" />
              </div>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 z-10 flex items-center px-2.5 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 cursor-pointer transition-colors"
                  title="Clear search"
                >
                  <XCircle className="w-3.5 h-3.5 stroke-[2]" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1 bg-slate-100 dark:bg-navy-900 p-1 sm:p-1.5 rounded-xl sm:rounded-2xl border border-slate-200/80 dark:border-navy-700/80 text-[10px] sm:text-[11px] font-bold overflow-x-auto no-scrollbar scrollbar-none max-w-full shadow-2xs">
              <button
                type="button"
                onClick={() => { setFilterCategory('ALL'); setPage(1); }}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 min-h-[32px] sm:min-h-[36px] rounded-lg sm:rounded-xl transition-all shrink-0 cursor-pointer touch-manipulation active:scale-95 ${filterCategory === 'ALL' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm font-black' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
              >
                All ({issuesList.length})
              </button>
              <button
                type="button"
                onClick={() => { setFilterCategory('VALID'); setPage(1); }}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 min-h-[32px] sm:min-h-[36px] rounded-lg sm:rounded-xl transition-all shrink-0 cursor-pointer touch-manipulation active:scale-95 ${filterCategory === 'VALID' ? 'bg-emerald-600 text-white shadow-sm font-black' : 'text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400'}`}
              >
                Valid ({data?.valid_profiles || 0})
              </button>
              <button
                type="button"
                onClick={() => { setFilterCategory('MISSING'); setPage(1); }}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 min-h-[32px] sm:min-h-[36px] rounded-lg sm:rounded-xl transition-all shrink-0 cursor-pointer touch-manipulation active:scale-95 ${filterCategory === 'MISSING' ? 'bg-amber-500 text-white shadow-sm font-black' : 'text-slate-600 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400'}`}
              >
                Missing ({data?.missing_links || 0})
              </button>
              <button
                type="button"
                onClick={() => { setFilterCategory('NOT_FOUND'); setPage(1); }}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 min-h-[32px] sm:min-h-[36px] rounded-lg sm:rounded-xl transition-all shrink-0 cursor-pointer touch-manipulation active:scale-95 ${filterCategory === 'NOT_FOUND' ? 'bg-rose-600 text-white shadow-sm font-black' : 'text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400'}`}
              >
                Not Found ({data?.profile_not_found || 0})
              </button>
              <button
                type="button"
                onClick={() => { setFilterCategory('NETWORK'); setPage(1); }}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 min-h-[32px] sm:min-h-[36px] rounded-lg sm:rounded-xl transition-all shrink-0 cursor-pointer touch-manipulation active:scale-95 ${filterCategory === 'NETWORK' ? 'bg-cyan-600 text-white shadow-sm font-black' : 'text-slate-600 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400'}`}
              >
                Network ({data?.network_errors || 0})
              </button>
            </div>

            {data?.source_status === 'UNAVAILABLE' && (
              <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-600 border border-rose-500/30">
                SOURCE UNAVAILABLE
              </span>
            )}
          </div>
        </div>

        {filteredIssues.length > 0 ? (
          <>
            {/* Mobile Issue Cards (2026 SaaS Bento Cards) */}
            <div className="block md:hidden space-y-3.5 my-3">
              {filteredIssues.slice((page - 1) * pageSize, page * pageSize).map((item: any, idx: number) => {
                const statusCfg = getStatusConfig(item.status);
                const initials = getInitials(item.name);
                return (
                  <div
                    key={idx}
                    onClick={() => handleStudentClick(item)}
                    className="relative overflow-hidden rounded-3xl bg-white dark:bg-[#0c1324] border border-slate-200/90 dark:border-white/10 p-4 sm:p-5 shadow-md shadow-slate-200/40 dark:shadow-black/40 space-y-3.5 cursor-pointer hover:border-brand-500/50 transition-all duration-200 active:scale-[0.98] touch-manipulation group"
                  >
                    {/* Top Row: Avatar + Student Info + Department */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center space-x-3 min-w-0 flex-1">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-600 to-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-md shadow-brand-500/20 border border-white/20">
                          {initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-black text-sm text-slate-950 dark:text-white truncate group-hover:text-brand-500 transition-colors">
                            {item.name}
                          </h4>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 dark:text-slate-400 font-mono font-bold">
                            <span>{item.reg_no}</span>
                            {(() => {
                              const rawYear = String(item.year_level || item.year || '').trim();
                              if (!rawYear) return null;
                              const formattedYear = rawYear.toLowerCase().includes('year') || rawYear.toLowerCase().includes('yr') 
                                ? rawYear 
                                : `Year ${rawYear}`;
                              return (
                                <>
                                  <span>•</span>
                                  <span>{formattedYear}</span>
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      </div>

                      <span className="px-2.5 py-1 rounded-xl bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/25 font-black text-xs shrink-0 font-mono">
                        {item.dept}
                      </span>
                    </div>

                    {/* Middle Row: 2 Micro Bento Tiles (Diagnostic & Handle) */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {/* Status Tile */}
                      <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/70 dark:border-white/[0.06] space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 block">
                          Audit Status
                        </span>
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-black text-[10px] border ${statusCfg.bg}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                          <span className="truncate">{statusCfg.label}</span>
                        </span>
                      </div>

                      {/* Handle Tile */}
                      <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/70 dark:border-white/[0.06] space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 block">
                          LeetCode Profile
                        </span>
                        {item.username ? (
                          <span className="inline-flex items-center gap-1 font-mono font-bold text-amber-600 dark:text-amber-400 truncate max-w-full text-[11px]">
                            <Globe className="w-3 h-3 shrink-0" />
                            <span className="truncate">@{item.username}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-mono text-rose-500 font-bold text-[10px]">
                            <AlertCircle className="w-3 h-3 shrink-0" />
                            <span>No Handle</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Issue Detail & Action Callout */}
                    <div className="p-3 rounded-2xl bg-gradient-to-r from-slate-50 to-indigo-50/30 dark:from-white/[0.03] dark:to-white/[0.01] border border-slate-200/70 dark:border-white/[0.06] flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] text-slate-400 uppercase font-black block">Action Item</span>
                        <span className="text-xs font-black text-slate-800 dark:text-slate-200 truncate block">
                          {item.action_required || (item.status === 'VALID_PROFILE' ? 'Verified Record' : 'Audit & Resolve Profile')}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="px-3.5 py-1.5 min-h-[36px] rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-black text-xs shadow-sm flex items-center gap-1.5 shrink-0 group-hover:translate-x-0.5 transition-transform touch-manipulation active:scale-95"
                      >
                        <span>Inspect</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block border border-slate-200 dark:border-slate-800 rounded-2xl overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[700px]">
                <thead className="bg-navy-950 text-white font-black uppercase">
                  <tr>
                    <th className="px-4 py-3">Register No</th>
                    <th className="px-4 py-3">Student Name</th>
                    <th className="px-4 py-3 text-center">Dept</th>
                    <th className="px-4 py-3">Status / Flag</th>
                    <th className="px-4 py-3 text-right">Action Required</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {filteredIssues.slice((page - 1) * pageSize, page * pageSize).map((item: any, idx: number) => (
                    <tr 
                      key={idx} 
                      onClick={() => handleStudentClick(item)}
                      className="hover:bg-slate-50 dark:hover:bg-navy-800/50 transition-colors cursor-pointer group"
                    >
                      <td className="px-4 py-2.5 font-bold text-slate-900 dark:text-white font-mono">{item.reg_no}</td>
                      <td className="px-4 py-2.5 font-semibold text-slate-800 dark:text-slate-200 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                        <div className="flex items-center gap-1.5">
                          <span>{item.name}</span>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0" />
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-center font-bold text-indigo-600 dark:text-indigo-400">{item.dept}</td>
                      <td className="px-4 py-2.5">
                        <span className={`px-3 py-1 rounded-full font-black text-[10px] ${
                          item.status === 'VALID_PROFILE'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-500/30'
                            : item.status === 'MISSING_USERNAME' || item.status === 'INVALID_PROFILE_URL'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-500/30'
                            : item.status === 'NETWORK_ERROR'
                            ? 'bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-300 border border-brand-500/30'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-500/30'
                        }`}>
                          {item.issue}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold text-slate-700 dark:text-slate-300">
                        {item.action_required || (item.status === 'VALID_PROFILE' ? 'Verified Record' : item.status === 'MISSING_USERNAME' || item.status === 'INVALID_PROFILE_URL' ? 'Verify LeetCode URL' : 'Audit Profile')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 text-xs text-slate-700 dark:text-slate-200 font-bold border-t border-slate-200 dark:border-slate-800">
              <div className="text-slate-700 dark:text-slate-200 font-bold text-center sm:text-left">
                Showing <strong className="text-slate-900 dark:text-white font-extrabold">{Math.min((page - 1) * pageSize + 1, filteredIssues.length)}</strong> to{' '}
                <strong className="text-slate-900 dark:text-white font-extrabold">{Math.min(page * pageSize, filteredIssues.length)}</strong> of{' '}
                <strong className="text-slate-900 dark:text-white font-extrabold">{filteredIssues.length}</strong> items
              </div>

              <div className="flex items-center gap-3 flex-wrap justify-center">
                <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-navy-900 p-1 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold shrink-0">
                  <span className="text-xs text-slate-700 dark:text-slate-200 px-1 font-mono font-bold">Show:</span>
                  {[10, 25, 50, 100].map((sz) => (
                    <button
                      key={sz}
                      onClick={() => { setPageSize(sz); setPage(1); }}
                      className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer text-xs ${
                        pageSize === sz
                          ? 'bg-brand-600 text-white shadow-xs font-black'
                          : 'text-slate-800 dark:text-slate-200 hover:text-brand-600 dark:hover:text-brand-400 font-bold bg-white dark:bg-navy-800 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {sz}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="px-3.5 py-1.5 rounded-xl border border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-900 text-slate-900 dark:text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-navy-800 transition font-extrabold cursor-pointer shadow-2xs"
                  >
                    Previous
                  </button>
                  <span className="text-xs font-mono font-black px-2.5 py-1 bg-slate-100 dark:bg-navy-900 rounded-lg text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800">
                    {page} / {Math.ceil(filteredIssues.length / pageSize) || 1}
                  </span>
                  <button
                    disabled={page >= Math.ceil(filteredIssues.length / pageSize)}
                    onClick={() => setPage((p) => p + 1)}
                    className="px-3.5 py-1.5 rounded-xl border border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-900 text-slate-900 dark:text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-navy-800 transition font-extrabold cursor-pointer shadow-2xs"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="p-10 sm:p-14 text-center rounded-3xl bg-slate-50/80 dark:bg-navy-900/60 border border-slate-200/80 dark:border-navy-700/80 shadow-lg backdrop-blur-md space-y-3 my-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 dark:bg-emerald-950/60 text-emerald-500 border border-emerald-500/20 flex items-center justify-center mx-auto shadow-md shadow-emerald-500/10">
              <CheckCircle2 className="w-7 h-7 text-emerald-500" />
            </div>
            <div className="space-y-1">
              <h4 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">No Matching Issues Found</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold max-w-sm mx-auto">
                Zero data quality anomalies match your active filter parameters or search query.
              </p>
            </div>
            {(searchQuery || filterCategory !== 'ALL') && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => { setSearchQuery(''); setFilterCategory('ALL'); setPage(1); }}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-200/80 dark:bg-navy-800 hover:bg-slate-300 dark:hover:bg-navy-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                >
                  Reset All Filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Fallback Student Profile Modal (if rendered standalone) */}
      {selectedStudentForProfile && (
        <div
          className="fixed inset-0 z-[999999] flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in"
          style={{ zIndex: 999999 }}
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedStudentForProfile(null); }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Student profile for ${selectedStudentForProfile.name}`}
            className="w-full max-w-6xl rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden h-[94dvh] sm:h-[88vh] max-h-[94dvh] sm:max-h-[88vh] text-slate-900 dark:text-slate-100 animate-modal-content isolate bg-white dark:bg-navy-950"
          >
            <Suspense fallback={<div className="p-12 text-center font-bold text-slate-500">Loading profile...</div>}>
              <StudentProfilePage
                student={selectedStudentForProfile}
                onBack={() => setSelectedStudentForProfile(null)}
              />
            </Suspense>
          </div>
        </div>
      )}

    </div>
  );
};

