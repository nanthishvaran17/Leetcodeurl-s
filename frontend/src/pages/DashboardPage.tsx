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

import { CANONICAL_ROSTER, getCanonicalSummary } from '../data/canonicalRoster';

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
  const [summary, setSummary] = useState<any>(getCanonicalSummary());
  const [students, setStudents] = useState<StudentData[]>(CANONICAL_ROSTER);
  const [departments, setDepartments] = useState<any[]>([]);
  const [dataQuality, setDataQuality] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const [triggering, setTriggering] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);

  // Live WebSocket connection status
  const { isConnected, lastMessage } = useLiveLeaderboard(() => {
    fetchDashboardData();
  });

  const fetchDashboardData = async () => {
    setLoading(true);

    try {
      const [sumRes, deptRes, qualRes, studRes] = await Promise.allSettled([
        api.get('/sessions/dashboard-summary'),
        api.get('/analytics/department-comparison'),
        api.get('/analytics/data-quality'),
        api.get('/students?limit=10')
      ]);

      if (sumRes.status === 'fulfilled' && sumRes.value.data) {
        setSummary(sumRes.value.data);
      }
      if (deptRes.status === 'fulfilled' && deptRes.value.data && Array.isArray(deptRes.value.data)) {
        setDepartments(deptRes.value.data);
      }
      if (qualRes.status === 'fulfilled' && qualRes.value.data) {
        setDataQuality(qualRes.value.data);
      }
      if (studRes.status === 'fulfilled' && studRes.value.data && Array.isArray(studRes.value.data)) {
        setStudents(studRes.value.data);
      }
      setLoading(false);
    } catch (err) {
      console.warn("REST API request delayed or offline", err);
      setLoading(false);
    }
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
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-gray-400"></span>
            )}
          </span>
          <span className="font-extrabold text-gray-800 dark:text-gray-200">
            {isConnected ? (
              <span className="text-emerald-600 dark:text-emerald-400">Live Push Active</span>
            ) : (
              <span className="text-gray-500 dark:text-gray-400">Standby</span>
            )}
          </span>
        </div>

        <div className="flex items-center space-x-3 text-gray-500 font-bold">
          <span>
            {loading ? (
              <span className="text-amber-500 flex items-center space-x-1">
                <RefreshCw className="w-3.5 h-3.5 animate-spin inline mr-1" />
                <span>Loading live institutional data...</span>
              </span>
            ) : totalStudents > 0 ? (
              <span className="text-emerald-600 dark:text-emerald-400">
                Verified Roster ({totalStudents} Students Loaded)
              </span>
            ) : (
              <span className="text-rose-500">
                Database connection unavailable
              </span>
            )}
          </span>
          <button
            onClick={fetchDashboardData}
            className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-navy-800 text-brand-600 dark:text-brand-400 transition-colors cursor-pointer"
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
              onClick={async () => {
                try {
                  const { triggerFullSync } = await import('../services/api');
                  await triggerFullSync('admin');
                  alert('Live sync started for all active students! Check status in real-time.');
                  fetchDashboardData();
                } catch (err) {
                  alert('Failed to trigger live sync.');
                }
              }}
              className="px-4 py-3 rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white font-black text-xs shadow-lg shadow-brand-600/30 flex items-center space-x-2 transition-all transform hover:scale-105 cursor-pointer"
              title="Perform full live synchronization for active student roster"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Fetch Live Data</span>
            </button>
            <button
              onClick={onOpenImport}
              className="px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-black text-xs backdrop-blur-md border border-white/20 flex items-center space-x-2 transition-all transform hover:scale-105"
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
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4">
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

        <CountdownTimer targetSeconds={summary?.next_session_countdown_seconds || 86400} isLive={summary?.is_session_live} />
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
