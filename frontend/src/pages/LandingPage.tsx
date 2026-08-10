import React from 'react';
import { Shield, ArrowRight, Trophy, Users, Layers, Activity, Calendar, CheckCircle2 } from 'lucide-react';
import { CountdownTimer } from '../components/CountdownTimer';

interface LandingPageProps {
  summaryData: any;
  onViewDashboard: () => void;
  onOpenLogin: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  summaryData,
  onViewDashboard,
  onOpenLogin
}) => {
  return (
    <div className="space-y-10 py-6">
      
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-900 via-navy-900 to-indigo-950 text-white p-8 md:p-12 shadow-2xl border border-brand-500/30">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 max-w-3xl space-y-6">
          <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-brand-500/20 border border-brand-400/30 text-brand-300 text-xs font-semibold backdrop-blur-md">
            <Shield className="w-3.5 h-3.5 text-amber-400" />
            <span>Official College Platform • Session Tracking & Analytics</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-tight">
            College LeetCode <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-400 via-blue-300 to-indigo-300">
              Weekly Tracker & Leaderboard
            </span>
          </h1>

          <p className="text-gray-300 text-sm md:text-base leading-relaxed">
            Real-time automated performance monitoring for 150+ students across Cyber Security, IoT, CSE, AI & DS, ECE, EEE, Mechanical, and Civil departments. Sunday session tracking, multi-level rankings, 8-sheet Excel reporting, and PDF dispatch.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button
              onClick={onViewDashboard}
              className="px-6 py-3.5 rounded-2xl bg-brand-500 hover:bg-brand-600 font-bold text-sm shadow-xl shadow-brand-500/30 flex items-center space-x-2 transition-all transform hover:-translate-y-0.5"
            >
              <span>View Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={onOpenLogin}
              className="px-6 py-3.5 rounded-2xl glass-card text-white hover:bg-white/10 font-semibold text-sm border border-white/20 transition-all"
            >
              Admin Login
            </button>
          </div>
        </div>
      </div>

      {/* Countdown Timer Widget */}
      <CountdownTimer targetSeconds={summaryData?.next_session_countdown_seconds || 86400} />

      {/* Highlights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        
        <div className="glass-card p-6 rounded-2xl space-y-2 border">
          <div className="p-3 w-fit rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <Users className="w-6 h-6" />
          </div>
          <h4 className="text-2xl font-black text-gray-900 dark:text-white">{summaryData?.total_students || 150}</h4>
          <p className="text-xs font-semibold text-gray-500">Total Enrolled Students</p>
        </div>

        <div className="glass-card p-6 rounded-2xl space-y-2 border">
          <div className="p-3 w-fit rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Activity className="w-6 h-6" />
          </div>
          <h4 className="text-2xl font-black text-gray-900 dark:text-white">{summaryData?.active_students || 0}</h4>
          <p className="text-xs font-semibold text-gray-500">Active This Week (STARTED)</p>
        </div>

        <div className="glass-card p-6 rounded-2xl space-y-2 border">
          <div className="p-3 w-fit rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
            <Trophy className="w-6 h-6" />
          </div>
          <h4 className="text-2xl font-black text-gray-900 dark:text-white">{summaryData?.total_problems_solved?.toLocaleString() || 0}</h4>
          <p className="text-xs font-semibold text-gray-500">Total Problems Solved</p>
        </div>

        <div className="glass-card p-6 rounded-2xl space-y-2 border">
          <div className="p-3 w-fit rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Layers className="w-6 h-6" />
          </div>
          <h4 className="text-2xl font-black text-gray-900 dark:text-white">{summaryData?.top_college_ranker || 'Arun Kumar'}</h4>
          <p className="text-xs font-semibold text-gray-500">Top College Ranker (#1)</p>
        </div>

      </div>

    </div>
  );
};
