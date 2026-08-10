import React, { useState, useEffect } from 'react';
import {
  Users, Layers, Trophy, Activity, AlertTriangle, FileSpreadsheet,
  Download, Play, CheckCircle2, RefreshCw, BarChart2, Plus
} from 'lucide-react';
import { StatCard } from '../components/StatCard';
import { CountdownTimer } from '../components/CountdownTimer';
import { LeaderboardTable, StudentData } from '../components/LeaderboardTable';
import api from '../services/api';

import { BatchPerformanceMatrix } from '../components/BatchPerformanceMatrix';

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
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const sumRes = await api.get('/sessions/dashboard-summary');
      setSummary(sumRes.data);
    } catch (err) {
      console.error("Failed to load dashboard summary data", err);
    }

    try {
      const studRes = await api.get('/students');
      setStudents(studRes.data ? studRes.data.slice(0, 10) : []);
    } catch (err) {
      console.error("Failed to load leaderboard data", err);
    } finally {
      setLoading(false);
    }
  };

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

  const handleDownloadExcel = () => {
    window.open('/api/reports/export-excel', '_blank');
  };

  const handleDownloadPDF = () => {
    window.open('/api/reports/export-pdf', '_blank');
  };

  return (
    <div className="space-y-8">
      
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white p-8 shadow-2xl border border-brand-500/30">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-80 h-80 bg-brand-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-brand-500/20 border border-brand-400/30 text-brand-300 text-xs font-black">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span>OFFICIAL INSTITUTIONAL DASHBOARD • REAL-TIME LEETCODE ANALYTICS</span>
            </div>

            <h1 className="text-3xl md:text-4xl font-black tracking-tight">
              College LeetCode <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-400 via-teal-300 to-indigo-300">Executive Dashboard</span>
            </h1>

            <p className="text-xs md:text-sm text-gray-300 font-bold tracking-wide">
              Real-time weekly performance monitoring, department stats & automated report generation
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
              onClick={handleDownloadExcel}
              className="px-4 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black text-xs shadow-lg shadow-emerald-500/30 flex items-center space-x-2 transition-all transform hover:scale-105"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export Excel</span>
            </button>

            <button
              onClick={handleDownloadPDF}
              className="px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-black text-xs flex items-center space-x-2 backdrop-blur-md transition-all transform hover:scale-105"
            >
              <Download className="w-4 h-4" />
              <span>Download PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Top 10 Summary Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard title="Total Students" value={summary?.total_students ?? 221} icon={Users} color="blue" />
        <StatCard title="Active (Started)" value={summary?.active_students ?? 151} icon={CheckCircle2} color="green" />
        <StatCard title="Not Started" value={summary?.not_started_students ?? 70} icon={AlertTriangle} color="rose" />
        <StatCard title="Total Solved" value={(summary?.total_problems_solved || 22300).toLocaleString()} icon={Trophy} color="purple" />
        <StatCard title="Avg Weekly Progress" value={`+${summary?.average_weekly_progress || 100.9}`} icon={Activity} color="indigo" />
      </div>

      {/* Live Session Control Card */}
      <div className="glass-card p-6 rounded-3xl border border-brand-500/30 space-y-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                🟢 SESSION {summary?.current_session?.status || 'UPCOMING'}
              </span>
              <span className="text-xs font-semibold text-gray-500">Sunday 08:00 AM – 09:30 AM IST</span>
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Weekly Session Snapshot Controls</h3>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleTriggerStart}
              disabled={triggering}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center space-x-1.5 shadow-md shadow-indigo-600/30 disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>8:00 AM Baseline Snapshot</span>
            </button>

            <button
              onClick={handleTriggerEnd}
              disabled={triggering}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center space-x-1.5 shadow-md shadow-emerald-600/30 disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>9:30 AM Final Evaluation</span>
            </button>
          </div>
        </div>

        <CountdownTimer targetSeconds={summary?.next_session_countdown_seconds || 86400} />
      </div>

      {/* College Leaderboard */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-lg text-gray-900 dark:text-white flex items-center space-x-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            <span>Top College Leaderboard</span>
          </h3>
          <button
            onClick={() => onNavigateTab('leaderboard')}
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
