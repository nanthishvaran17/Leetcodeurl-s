import React, { useState, useEffect } from 'react';
import {
  Trophy, Flame, Award, Star, ExternalLink, CheckCircle2, TrendingUp,
  AlertCircle, Shield, User, Clock, Zap, BookOpen, BarChart2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { StudentData } from '../components/LeaderboardTable';
import api from '../services/api';

export const StudentDashboardView: React.FC = () => {
  const { user } = useAuth();
  const [studentData, setStudentData] = useState<StudentData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStudentProfile();
  }, [user]);

  const fetchStudentProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      if (user?.registerNo) {
        const res = await api.get('/students');
        const found = res.data.find((s: StudentData) => s.reg_no === user.registerNo);
        if (found) {
          setStudentData(found);
        } else {
          setError(`No LeetCode records found for register number ${user.registerNo}.`);
        }
      } else if (user?.email) {
        const res = await api.get('/students');
        const found = res.data.find((s: StudentData) => s.email && s.email.toLowerCase() === user.email.toLowerCase());
        if (found) {
          setStudentData(found);
        } else {
          setError("Your Google account is signed in, but not yet linked to a college student record.");
        }
      } else {
        setError("User profile details are unavailable.");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load student metrics.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-bold text-gray-500">Loading your LeetCode student dashboard...</p>
      </div>
    );
  }

  // Data Consistency check: Easy + Medium + Hard
  const easyCount = studentData?.stats?.easy_solved || 0;
  const medCount = studentData?.stats?.medium_solved || 0;
  const hardCount = studentData?.stats?.hard_solved || 0;
  const calculatedTotal = easyCount + medCount + hardCount;
  const reportedTotal = studentData?.stats?.total_solved || 0;
  const isDataConsistent = calculatedTotal === reportedTotal || reportedTotal === 0;

  // Activity check
  const hasActivityData = (studentData?.weekly_progress || 0) > 0 || (studentData?.streak_count || 0) > 0 || (studentData?.consistency_score || 0) > 0;

  return (
    <div className="space-y-8 py-2">

      {/* Student Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-navy-950 via-slate-900 to-brand-950 text-white p-8 shadow-lg border border-brand-500/30">

        <div className="relative z-10 flex items-center justify-between flex-wrap gap-6">
          <div className="flex items-center space-x-5">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.name}
                className="w-20 h-20 rounded-3xl border-4 border-brand-400 shadow-xl object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-brand-600 to-indigo-600 font-black text-2xl flex items-center justify-center shadow-xl border-2 border-white/20">
                {user?.name ? user.name[0] : 'S'}
              </div>
            )}

            <div className="space-y-1">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-brand-500/20 text-brand-300 text-xs font-black border border-brand-400/30">
                <Shield className="w-3.5 h-3.5 text-amber-400" />
                <span>AUTHENTICATED STUDENT DASHBOARD</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black">{user?.name}</h1>
              <p className="text-xs text-gray-300 font-mono font-bold">
                {user?.registerNo ? `Reg No: ${user.registerNo}` : user?.email} • {user?.department || 'Department'} • {user?.year ? `${user.year} Year` : ''}
              </p>
            </div>
          </div>

          {studentData?.leetcode_url && (
            <a
              href={studentData.leetcode_url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-2.5 rounded-2xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-black shadow-lg shadow-brand-500/30 flex items-center space-x-2 transition-all"
            >
              <span>LeetCode Profile</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>

      {error && !studentData && (
        <div className="p-5 rounded-3xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs space-y-2">
          <div className="flex items-center space-x-2 font-bold text-sm">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
            <span>Profile Linking Note</span>
          </div>
          <p className="leading-relaxed">{error}</p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            If your Google account email is not matched with your student record, please contact your department admin.
          </p>
        </div>
      )}

      {studentData && (
        <div className="space-y-8">

          {/* Key Metrics Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">

            {/* Total Solved */}
            <div className="glass-card p-6 rounded-3xl border border-brand-500/30 space-y-2 shadow-lg">
              <div className="flex items-center justify-between text-xs font-bold text-gray-400 uppercase tracking-wider">
                <span>Total Solved</span>
                <Trophy className="w-5 h-5 text-amber-500" />
              </div>
              <h3 className="text-3xl font-black text-gray-900 dark:text-white">
                {reportedTotal}
              </h3>
              <p className="text-xs text-brand-600 dark:text-brand-400 font-bold">
                College Rank: #{studentData.college_rank || '—'}
              </p>
            </div>

            {/* Contest Rating */}
            <div className="glass-card p-6 rounded-3xl border border-amber-500/30 space-y-2 shadow-lg">
              <div className="flex items-center justify-between text-xs font-bold text-gray-400 uppercase tracking-wider">
                <span>Contest Rating</span>
                <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
              </div>
              <h3 className="text-3xl font-black text-amber-500">
                {studentData.stats?.contest_rating ? Math.round(studentData.stats.contest_rating) : 'Unrated'}
              </h3>
              <p className="text-xs text-gray-500 font-medium">
                Global Rank: {studentData.stats?.contest_global_ranking ? `#${studentData.stats.contest_global_ranking}` : 'N/A'}
              </p>
            </div>

            {/* Weekly Progress */}
            <div className="glass-card p-6 rounded-3xl border border-emerald-500/30 space-y-2 shadow-lg">
              <div className="flex items-center justify-between text-xs font-bold text-gray-400 uppercase tracking-wider">
                <span>Weekly Progress</span>
                <TrendingUp className="w-5 h-5 text-emerald-500" />
              </div>
              {hasActivityData ? (
                <>
                  <h3 className="text-3xl font-black text-emerald-500">
                    +{studentData.weekly_progress || 0}
                  </h3>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                    Active Coding Trend
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xs text-gray-400 font-bold pt-1">No activity data available yet</p>
                  <p className="text-[10px] text-gray-500">Awaiting Sunday session sync</p>
                </>
              )}
            </div>

            {/* Active Streak */}
            <div className="glass-card p-6 rounded-3xl border border-rose-500/30 space-y-2 shadow-lg">
              <div className="flex items-center justify-between text-xs font-bold text-gray-400 uppercase tracking-wider">
                <span>Active Streak</span>
                <Flame className="w-5 h-5 text-rose-500 fill-rose-500" />
              </div>
              {hasActivityData ? (
                <>
                  <h3 className="text-3xl font-black text-rose-500">
                    {studentData.streak_count || 0} Days
                  </h3>
                  <p className="text-xs text-gray-500 font-medium">
                    Consistency: {studentData.consistency_score || 0}%
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xs text-gray-400 font-bold pt-1">No streak recorded</p>
                  <p className="text-[10px] text-gray-500">Solve daily problems to build streak</p>
                </>
              )}
            </div>

          </div>

          {/* Difficulty Breakdown */}
          <div className="glass-card p-6 rounded-3xl border space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-gray-900 dark:text-white flex items-center space-x-2">
                <Zap className="w-5 h-5 text-brand-500" />
                <span>Difficulty Distribution</span>
              </h3>
              {!isDataConsistent && (
                <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2.5 py-1 rounded-full border border-amber-200">
                  Calculated sum: {calculatedTotal} (Total: {reportedTotal})
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">Easy Solved</p>
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{easyCount}</p>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                <p className="text-xs font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider">Medium Solved</p>
                <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{medCount}</p>
              </div>

              <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800">
                <p className="text-xs font-bold text-rose-700 dark:text-rose-300 uppercase tracking-wider">Hard Solved</p>
                <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">{hardCount}</p>
              </div>
            </div>
          </div>

          {/* Badges Shelf */}
          {studentData.badge_list && studentData.badge_list.length > 0 && (
            <div className="glass-card p-6 rounded-3xl border space-y-4 shadow-xl">
              <h3 className="text-base font-black text-gray-900 dark:text-white flex items-center space-x-2">
                <Award className="w-5 h-5 text-amber-500" />
                <span>Earned Achievements & Badges</span>
              </h3>

              <div className="flex flex-wrap gap-2">
                {studentData.badge_list.map((badge, idx) => (
                  <span
                    key={idx}
                    className="px-3.5 py-1.5 rounded-2xl bg-gradient-to-r from-brand-500/10 via-brand-500/20 to-indigo-500/10 border border-brand-500/30 text-brand-700 dark:text-brand-300 text-xs font-black shadow-sm"
                  >
                    {badge}
                  </span>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
};
