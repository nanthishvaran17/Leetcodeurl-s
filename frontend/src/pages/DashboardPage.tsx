import React, { useState, useEffect } from 'react';
import {
  Users, Layers, Trophy, Activity, AlertTriangle, FileSpreadsheet,
  Download, Play, CheckCircle2, RefreshCw, BarChart2, Plus, Building2,
  PieChart, TrendingUp, ShieldCheck, Radio, FileText, CheckCircle
} from 'lucide-react';
import { StatCard } from '../components/StatCard';
import { CountdownTimer } from '../components/CountdownTimer';
import { LeaderboardTable, StudentData } from '../components/LeaderboardTable';
import { useLiveLeaderboard } from '../hooks/useLiveLeaderboard';
import { getOrInitDb } from '../services/firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import api from '../services/api';

interface DashboardPageProps {
  onSelectStudent: (student: StudentData) => void;
  onOpenImport: () => void;
  onNavigateTab: (tab: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onSelectStudent,
  onOpenImport,
  onNavigateTab
}) => {
  const [summary, setSummary] = useState<any>(null);
  const [students, setStudents] = useState<StudentData[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [dataQuality, setDataQuality] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);

  // Live WebSocket connection status
  const { isConnected, lastMessage } = useLiveLeaderboard(() => {
    fetchDashboardData();
  });

  const fetchDashboardData = async () => {
    setLoading(true);
    let loadedFromApi = false;

    // 1. Try fetching via REST API
    try {
      const [sumRes, deptRes, qualRes, studRes] = await Promise.all([
        api.get('/sessions/dashboard-summary'),
        api.get('/analytics/department-comparison'),
        api.get('/analytics/data-quality'),
        api.get('/students')
      ]);

      if (studRes.data && studRes.data.length > 0) {
        setSummary(sumRes.data);
        setDepartments(deptRes.data);
        setDataQuality(qualRes.data);
        setStudents(studRes.data.slice(0, 10));
        loadedFromApi = true;
      }
    } catch (err) {
      console.warn("REST API request delayed or offline, falling back to Cloud Firestore direct read...", err);
    }

    // 2. Fallback to Cloud Firestore direct read if REST API fails/delays
    if (!loadedFromApi) {
      try {
        const firestoreDb = getOrInitDb();
        const studSnap = await getDocs(collection(firestoreDb, "students"));
        const statsSnap = await getDocs(collection(firestoreDb, "leetcodeStats"));

        const statsMap = new Map();
        statsSnap.forEach(docSnap => {
          statsMap.set(docSnap.id, docSnap.data());
        });

        const list: StudentData[] = [];
        let totalSolvedAll = 0;
        let activeCount = 0;
        const deptMap = new Map();

        studSnap.forEach(docSnap => {
          const sData = docSnap.data();
          const sStats = statsMap.get(docSnap.id) || {};
          // RULE: null/undefined means "not yet fetched" — never convert to 0
          const syncStatus = sStats.syncStatus || 'pending';
          const isVerified = syncStatus === 'success' || syncStatus === 'OK';
          const totSolved = isVerified ? (sStats.totalSolved ?? 0) : null;
          if (totSolved !== null) totalSolvedAll += totSolved;
          if (totSolved !== null && totSolved > 0) activeCount++;

          const dept = sData.department || 'GEN';
          if (!deptMap.has(dept)) {
            deptMap.set(dept, {
              department_code: dept,
              department_name: sData.departmentName || dept,
              total_students: 0,
              active_students: 0,
              total_solved: 0,
              top_student_name: 'N/A',
              top_solved: 0
            });
          }
          const dInfo = deptMap.get(dept);
          dInfo.total_students++;
          dInfo.total_solved += totSolved;
          if (totSolved > 0) dInfo.active_students++;
          if (totSolved > dInfo.top_solved) {
            dInfo.top_solved = totSolved;
            dInfo.top_student_name = sData.name;
          }

          list.push({
            id: sData.id || Number(docSnap.id),
            reg_no: sData.registerNo || '',
            name: sData.name || '',
            email: sData.email || '',
            department: dept,
            year_level: sData.year || 'III',
            section: sData.section || 'A',
            leetcode_url: sData.leetcodeProfileUrl || '',
            username: sData.leetcodeUsername || '',
            college_rank: sStats.collegeRank ?? null,
            weekly_progress: sStats.weeklySolved ?? 0,
            streak_count: sStats.streakCount ?? 0,
            consistency_score: sStats.consistencyScore ?? 0,
            stats: {
              total_solved: totSolved,  // null if not verified
              easy_solved: isVerified ? (sStats.easySolved ?? 0) : null,
              medium_solved: isVerified ? (sStats.mediumSolved ?? 0) : null,
              hard_solved: isVerified ? (sStats.hardSolved ?? 0) : null,
              contest_rating: sStats.contestRating ?? null,
              contest_global_ranking: sStats.globalRanking ?? null,
              status: sStats.status || (isVerified ? 'OK' : 'pending'),
              sync_status: syncStatus,
              last_verified_at: sStats.lastVerifiedAt ?? null
            }
          });
        });

        list.sort((a, b) => (b.stats?.total_solved ?? 0) - (a.stats?.total_solved ?? 0));
        setStudents(list.slice(0, 10));

        // Compute verified counts from real sync states — NO hardcoded fallbacks
        const verifiedCount = list.filter(s => s.stats?.sync_status === 'success' || s.stats?.sync_status === 'OK').length;
        const pendingCount = list.filter(s => !s.stats?.sync_status || s.stats.sync_status === 'pending' || s.stats.sync_status === 'not_started').length;
        const failedCount = list.filter(s => s.stats?.sync_status === 'failed' || s.stats?.sync_status === 'mismatch').length;

        setSummary({
          total_students: list.length,
          active_students: activeCount,
          not_started_students: Math.max(0, list.length - activeCount),
          total_problems_solved: totalSolvedAll,
          average_weekly_progress: 0,  // Will be computed from real data when available
          current_session: { status: 'UPCOMING' },
          verified_count: verifiedCount,
          pending_count: pendingCount,
          failed_count: failedCount
        });

        const formattedDepts = Array.from(deptMap.values()).map(d => ({
          ...d,
          participation_rate: d.total_students > 0 ? round((d.active_students / d.total_students) * 100, 1) : 0,
          avg_solved: d.total_students > 0 ? round(d.total_solved / d.total_students, 1) : 0,
          avg_progress: 0
        }));
        setDepartments(formattedDepts);

        setDataQuality({
          total_students: list.length,
          valid_profiles: verifiedCount,
          missing_links: pendingCount,
          failed_count: failedCount,
          health_score_percentage: list.length > 0 ? round((verifiedCount / list.length) * 100, 1) : 0
        });
      } catch (fErr) {
        console.error("Firestore direct read error", fErr);
      }
    }

    setLoading(false);
  };

  const round = (val: number, dec: number) => Math.round(val * Math.pow(10, dec)) / Math.pow(10, dec);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleTriggerStart = async () => {
    if (!confirm("Trigger 8:00 AM Baseline Snapshot for all students?")) return;
    setTriggering(true);
    try {
      await api.post('/sessions/trigger-start');
      alert("Baseline snapshot triggered!");
      fetchDashboardData();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Trigger failed");
    } finally {
      setTriggering(false);
    }
  };

  const handleTriggerEnd = async () => {
    if (!confirm("Trigger 9:30 AM Final Snapshot & calculate weekly progress?")) return;
    setTriggering(true);
    try {
      await api.post('/sessions/trigger-end');
      alert("Final snapshot & rankings evaluated!");
      fetchDashboardData();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Trigger failed");
    } finally {
      setTriggering(false);
    }
  };

  const handleGenerateReport = async () => {
    setGeneratingReport(true);
    try {
      const res = await api.get('/reports/export-pdf', { responseType: 'blob' });
      const blobUrl = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', `Nandha_LeetCode_Weekly_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Report generation failed", err);
      const baseUrl = api.defaults.baseURL || 'https://leetcodeurl-s.onrender.com/api';
      window.open(`${baseUrl}/reports/export-pdf`, '_blank');
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      const res = await api.get('/reports/export-excel', { responseType: 'blob' });
      const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', `Nandha_LeetCode_College_Summary_${new Date().toISOString().slice(0, 10)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Excel export failed", err);
      const baseUrl = api.defaults.baseURL || 'https://leetcodeurl-s.onrender.com/api';
      window.open(`${baseUrl}/reports/export-excel`, '_blank');
    }
  };

  const totalStudents = summary?.total_students ?? 0;
  const activeStudents = summary?.active_students ?? 0;
  const notStartedStudents = summary?.not_started_students ?? (totalStudents - activeStudents);
  const participationRate = totalStudents > 0 ? ((activeStudents / totalStudents) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-8 py-2">
      
      {/* Real-time Connection Status Indicator Bar */}
      <div className="flex items-center justify-between px-5 py-2.5 rounded-2xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 shadow-sm text-xs">
        <div className="flex items-center space-x-2.5">
          <span className="relative flex h-2.5 w-2.5">
            {isConnected ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </>
            ) : (
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            )}
          </span>
          <span className="font-extrabold text-gray-800 dark:text-gray-200">
          <span className="text-emerald-600 dark:text-emerald-400">🟢 Cloud Firestore Sync</span>
          </span>
        </div>

        <div className="flex items-center space-x-3 text-gray-500 font-bold">
          <span>{loading ? '🔄 Loading...' : '🟢 Data loaded'}</span>
          <button
            onClick={fetchDashboardData}
            className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-navy-800 text-brand-600 dark:text-brand-400 transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Official Executive Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white p-8 shadow-2xl border border-brand-500/30">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-80 h-80 bg-brand-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-brand-500/20 border border-brand-400/30 text-brand-300 text-xs font-black">
              <Building2 className="w-3.5 h-3.5 text-amber-400" />
              <span>OFFICIAL INSTITUTIONAL DASHBOARD • REAL-TIME LEETCODE ANALYTICS</span>
            </div>

            <h1 className="text-3xl md:text-4xl font-black tracking-tight">
              College LeetCode <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-400 via-teal-300 to-indigo-300">Executive Dashboard</span>
            </h1>

            <p className="text-xs md:text-sm text-gray-300 font-bold tracking-wide">
              Real-time weekly performance monitoring, department analytics & automated report generation
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={onOpenImport}
              className="px-4 py-3 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-black text-xs shadow-lg shadow-brand-600/30 flex items-center space-x-2 transition-all transform hover:scale-105"
            >
              <Plus className="w-4 h-4" />
              <span>Import Excel</span>
            </button>
            
            <button
              onClick={handleExportExcel}
              className="px-4 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black text-xs shadow-lg shadow-emerald-500/30 flex items-center space-x-2 transition-all transform hover:scale-105"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export Excel</span>
            </button>

            <button
              onClick={handleGenerateReport}
              disabled={generatingReport}
              className="px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-black text-xs flex items-center space-x-2 backdrop-blur-md transition-all transform hover:scale-105 disabled:opacity-50"
            >
              <FileText className="w-4 h-4 text-amber-400" />
              <span>{generatingReport ? "Generating..." : "Generate Weekly Report"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Top College Institutional KPIs Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard title="Total Students" value={totalStudents} icon={Users} color="blue" />
        <StatCard title="Active Students" value={activeStudents} icon={CheckCircle2} color="green" />
        <StatCard title="Not Started" value={notStartedStudents} icon={AlertTriangle} color="rose" />
        <StatCard title="Total Problems Solved" value={(summary?.total_problems_solved ?? 0).toLocaleString()} icon={Trophy} color="purple" />
        <StatCard title="Avg Weekly Progress" value={`+${summary?.average_weekly_progress ?? 0}`} icon={Activity} color="indigo" />
      </div>

      {/* Weekly Session Monitoring & Countdown Controls */}
      <div className="glass-card p-6 rounded-3xl border border-brand-500/30 space-y-4 shadow-xl">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                🟢 SESSION {summary?.current_session?.status || 'UPCOMING'}
              </span>
              <span className="text-xs font-bold text-gray-500">Sunday 08:00 AM – 09:30 AM IST</span>
            </div>
            <h3 className="text-lg font-black text-gray-900 dark:text-white">Weekly Session Snapshot Controls</h3>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleTriggerStart}
              disabled={triggering}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs flex items-center space-x-1.5 shadow-md shadow-indigo-600/30 disabled:opacity-50 transition-all"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>8:00 AM Baseline Snapshot</span>
            </button>

            <button
              onClick={handleTriggerEnd}
              disabled={triggering}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center space-x-1.5 shadow-md shadow-emerald-600/30 disabled:opacity-50 transition-all"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>9:30 AM Final Evaluation</span>
            </button>
          </div>
        </div>

        <CountdownTimer targetSeconds={summary?.next_session_countdown_seconds || 86400} />
      </div>

      {/* College Participation Analytics & Data Quality Summary Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Participation Rate Card */}
        <div className="glass-card p-6 rounded-3xl border space-y-4 shadow-lg md:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-base text-gray-900 dark:text-white flex items-center space-x-2">
              <PieChart className="w-5 h-5 text-indigo-500" />
              <span>College Participation Analytics</span>
            </h3>
            <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-200">
              {participationRate}% Participation Rate
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs font-bold text-gray-500">
              <span>Active Students ({activeStudents} / {totalStudents})</span>
              <span>Not Started ({notStartedStudents})</span>
            </div>

            <div className="w-full h-4 bg-rose-100 dark:bg-rose-950/60 rounded-full overflow-hidden flex">
              <div
                style={{ width: `${participationRate}%` }}
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500"
              ></div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center text-xs font-bold pt-2">
            <div className="p-3 rounded-2xl bg-gray-50 dark:bg-navy-900 border">
              <p className="text-[10px] text-gray-400 uppercase">Total Enrolled</p>
              <p className="text-lg font-black text-gray-900 dark:text-white mt-0.5">{totalStudents}</p>
            </div>

            <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 text-emerald-700 dark:text-emerald-300">
              <p className="text-[10px] uppercase">Active Coding</p>
              <p className="text-lg font-black mt-0.5">{activeStudents}</p>
            </div>

            <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-rose-700 dark:text-rose-300">
              <p className="text-[10px] uppercase">Action Needed</p>
              <p className="text-lg font-black mt-0.5">{notStartedStudents}</p>
            </div>
          </div>
        </div>

        {/* Institutional Data Quality Card */}
        <div className="glass-card p-6 rounded-3xl border space-y-4 shadow-lg">
          <h3 className="font-extrabold text-base text-gray-900 dark:text-white flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
            <span>Data Quality Board</span>
          </h3>

          <div className="space-y-3 text-xs font-bold">
            <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-gray-800">
              <span className="text-gray-500">Valid Profiles</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-black">{dataQuality?.valid_profiles || totalStudents}</span>
            </div>

            <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-gray-800">
              <span className="text-gray-500">Missing Profile URLs</span>
              <span className="text-amber-500 font-black">{dataQuality?.missing_links || 0}</span>
            </div>

            <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-gray-800">
              <span className="text-gray-500">Profile Health Score</span>
              <span className="text-indigo-600 dark:text-indigo-400 font-black">{dataQuality?.health_score_percentage || 100}%</span>
            </div>

            <button
              onClick={() => onNavigateTab('quality')}
              className="w-full py-2 rounded-xl bg-gray-100 dark:bg-navy-900 hover:bg-gray-200 text-gray-700 dark:text-gray-300 text-xs font-bold transition-all"
            >
              Open Data Quality Details →
            </button>
          </div>
        </div>

      </div>

      {/* Department Performance Overview */}
      <div className="glass-card p-6 rounded-3xl border space-y-4 shadow-xl">
        <h3 className="font-extrabold text-lg text-gray-900 dark:text-white flex items-center space-x-2">
          <Building2 className="w-5 h-5 text-brand-500" />
          <span>Department Performance Matrix</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {departments.map((dept) => (
            <div key={dept.department_code || dept.department_id} className="p-5 rounded-2xl bg-white dark:bg-navy-900 border space-y-3 shadow-md">
              <div className="flex items-center justify-between">
                <span className="font-black text-sm text-gray-900 dark:text-white">
                  {dept.department_name} ({dept.department_code})
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-brand-500/20 text-brand-600 dark:text-brand-300">
                  {dept.total_students} Students
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold">
                <div className="p-2 rounded-xl bg-gray-50 dark:bg-navy-950 border">
                  <p className="text-[10px] text-gray-400">Avg Solved</p>
                  <p className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{dept.avg_solved}</p>
                </div>
                <div className="p-2 rounded-xl bg-gray-50 dark:bg-navy-950 border">
                  <p className="text-[10px] text-gray-400">Participation</p>
                  <p className="text-base font-black text-indigo-600 dark:text-indigo-400 mt-0.5">{dept.participation_rate}%</p>
                </div>
                <div className="p-2 rounded-xl bg-gray-50 dark:bg-navy-950 border">
                  <p className="text-[10px] text-gray-400">Top Performer</p>
                  <p className="text-xs font-black text-amber-500 truncate mt-0.5">{dept.top_student_name}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top 10 Institutional Leaderboard */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-lg text-gray-900 dark:text-white flex items-center space-x-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            <span>Top College Leaderboard</span>
          </h3>
          <button
            onClick={() => onNavigateTab('students')}
            className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline"
          >
            View Full Leaderboard →
          </button>
        </div>

        <LeaderboardTable
          students={students}
          onSelectStudent={onSelectStudent}
          onRefreshStudent={() => fetchDashboardData()}
        />
      </div>

    </div>
  );
};
