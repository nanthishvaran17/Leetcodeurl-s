import React, { useState, useEffect } from 'react';
import {
  Users, Layers, Trophy, Activity, AlertTriangle, FileSpreadsheet,
  Download, Play, CheckCircle2, RefreshCw, BarChart2, Plus
} from 'lucide-react';
import { StatCard } from '../components/StatCard';
import { CountdownTimer } from '../components/CountdownTimer';
import { LeaderboardTable, StudentData } from '../components/LeaderboardTable';
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
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [sumRes, studRes] = await Promise.all([
        api.get('/sessions/dashboard-summary'),
        api.get('/leaderboard?limit=10')
      ]);
      setSummary(sumRes.data);
      setStudents(studRes.data);
    } catch (err) {
      console.error("Failed to load dashboard data", err);
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
      
      {/* Top Title & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white">College LeetCode Executive Dashboard</h2>
          <p className="text-xs text-gray-500">Real-time weekly performance monitoring, department stats & automated report generation</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onOpenImport}
            className="px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs shadow-md shadow-brand-600/30 flex items-center space-x-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Import Excel</span>
          </button>
          
          <button
            onClick={handleDownloadExcel}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-md shadow-emerald-600/30 flex items-center space-x-1.5"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Excel</span>
          </button>

          <button
            onClick={handleDownloadPDF}
            className="px-3.5 py-2 rounded-xl border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 font-semibold text-xs flex items-center space-x-1.5"
          >
            <Download className="w-4 h-4" />
            <span>Download PDF</span>
          </button>
        </div>
      </div>

      {/* Top 10 Summary Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard title="Total Students" value={summary?.total_students || 0} icon={Users} color="blue" />
        <StatCard title="Active (Started)" value={summary?.active_students || 0} icon={CheckCircle2} color="green" />
        <StatCard title="Not Started" value={summary?.not_started_students || 0} icon={AlertTriangle} color="rose" />
        <StatCard title="Total Solved" value={summary?.total_problems_solved?.toLocaleString() || 0} icon={Trophy} color="purple" />
        <StatCard title="Avg Weekly Progress" value={`+${summary?.average_weekly_progress || 0}`} icon={Activity} color="indigo" />
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
