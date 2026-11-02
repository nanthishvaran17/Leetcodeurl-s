import React, { useState, useEffect } from 'react';







import api from '../../services/api';







import { 







  Loader2, 







  Activity, 







  Users, 







  Percent, 







  AlertCircle, 







  Flame, 







  Trophy, 







  Calendar, 







  Code2, 







  Clock, 







  CheckCircle2, 







  ExternalLink, 







  Award,







  TrendingUp,







  Grid,







  Palette







} from 'lucide-react';







import {







  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer







} from 'recharts';















interface ActivityAnalyticsProps {







  studentId?: number;







  period?: string;







  deptId?: number | null;







  yearLevel?: string | null;







}















interface LanguageStat {







  language: string;







  solved: number;







}















interface RecentSubmission {







  id: number;







  title: string;







  title_slug: string;







  lang: string;







  status: string;







  runtime?: string;







  memory?: string;







  timestamp?: string;







  relative_time?: string;







}















interface BadgeItem {







  id: number;







  name: string;







  icon_url?: string;







  awarded_at?: string;







}















const PERIOD_OPTIONS = [







  { key: '7d', label: '7D' },







  { key: '30d', label: '30D' },







  { key: '90d', label: '90D' },







  { key: '365d', label: '1Y' },







  { key: 'all', label: 'All Time' },







];















const LANGUAGE_COLORS: Record<string, { bg: string; text: string; bar: string }> = {







  Java: { bg: 'bg-amber-500/10 dark:bg-amber-500/20', text: 'text-amber-600 dark:text-amber-400', bar: 'bg-amber-500' },







  Python: { bg: 'bg-blue-500/10 dark:bg-blue-500/20', text: 'text-blue-600 dark:text-blue-400', bar: 'bg-blue-500' },







  Python3: { bg: 'bg-blue-500/10 dark:bg-blue-500/20', text: 'text-blue-600 dark:text-blue-400', bar: 'bg-blue-500' },







  'C++': { bg: 'bg-rose-500/10 dark:bg-rose-500/20', text: 'text-rose-600 dark:text-rose-400', bar: 'bg-rose-500' },







  C: { bg: 'bg-indigo-500/10 dark:bg-indigo-500/20', text: 'text-indigo-600 dark:text-indigo-400', bar: 'bg-indigo-500' },







  JavaScript: { bg: 'bg-yellow-500/10 dark:bg-yellow-500/20', text: 'text-yellow-600 dark:text-yellow-400', bar: 'bg-yellow-500' },







  TypeScript: { bg: 'bg-sky-500/10 dark:bg-sky-500/20', text: 'text-sky-600 dark:text-sky-400', bar: 'bg-sky-500' },







  SQL: { bg: 'bg-emerald-500/10 dark:bg-emerald-500/20', text: 'text-emerald-600 dark:text-emerald-400', bar: 'bg-emerald-500' },







  MySQL: { bg: 'bg-teal-500/10 dark:bg-teal-500/20', text: 'text-teal-600 dark:text-teal-400', bar: 'bg-teal-500' },







  'C#': { bg: 'bg-purple-500/10 dark:bg-purple-500/20', text: 'text-purple-600 dark:text-purple-400', bar: 'bg-purple-500' },







  Rust: { bg: 'bg-orange-500/10 dark:bg-orange-500/20', text: 'text-orange-600 dark:text-orange-400', bar: 'bg-orange-500' },







  Go: { bg: 'bg-cyan-500/10 dark:bg-cyan-500/20', text: 'text-cyan-600 dark:text-cyan-400', bar: 'bg-cyan-500' },







};















function formatBadgeUrl(url?: string): string {







  if (!url) return '';







  if (url.startsWith('http://') || url.startsWith('https://')) return url;







  if (url.startsWith('/')) return `https://leetcode.com${url}`;







  return url;







}















const formatDateTick = (dateStr: string) => {







  try {







    const parts = dateStr.split('-');







    if (parts.length === 3) {







      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];







      const mIdx = parseInt(parts[1], 10) - 1;







      const day = parseInt(parts[2], 10);







      return `${monthNames[mIdx]} ${day}`;







    }







  } catch {}







  return dateStr;







};















const formatTooltipDate = (dateStr: string) => {







  try {







    const parts = dateStr.split('-');







    if (parts.length === 3) {







      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];







      const mIdx = parseInt(parts[1], 10) - 1;







      const day = parseInt(parts[2], 10);







      const yr = parts[0];







      return `${monthNames[mIdx]} ${day}, ${yr}`;







    }







  } catch {}







  return dateStr;







};















export type HeatmapPaletteKey = 'purple' | 'emerald' | 'amber' | 'cyan' | 'rose';















export interface HeatmapPaletteConfig {







  key: HeatmapPaletteKey;







  label: string;







  dotColor: string;







  levels: [string, string, string, string];







}















export const HEATMAP_PALETTES: Record<HeatmapPaletteKey, HeatmapPaletteConfig> = {







  purple: {







    key: 'purple',







    label: 'Purple',







    dotColor: 'bg-violet-600 dark:bg-violet-500',







    levels: [







      'bg-slate-100 dark:bg-navy-800/80',







      'bg-violet-200 dark:bg-violet-900/60',







      'bg-violet-400 dark:bg-violet-600',







      'bg-violet-600 dark:bg-violet-400',







    ],







  },







  emerald: {







    key: 'emerald',







    label: 'Emerald',







    dotColor: 'bg-emerald-600 dark:bg-emerald-500',







    levels: [







      'bg-slate-100 dark:bg-navy-800/80',







      'bg-emerald-200 dark:bg-emerald-900/60',







      'bg-emerald-400 dark:bg-emerald-600',







      'bg-emerald-600 dark:bg-emerald-400',







    ],







  },







  amber: {







    key: 'amber',







    label: 'Amber',







    dotColor: 'bg-amber-500 dark:bg-amber-400',







    levels: [







      'bg-slate-100 dark:bg-navy-800/80',







      'bg-amber-200 dark:bg-amber-900/60',







      'bg-amber-400 dark:bg-amber-600',







      'bg-amber-500 dark:bg-amber-400',







    ],







  },







  cyan: {







    key: 'cyan',







    label: 'Cyan',







    dotColor: 'bg-cyan-500 dark:bg-cyan-400',







    levels: [







      'bg-slate-100 dark:bg-navy-800/80',







      'bg-cyan-200 dark:bg-cyan-900/60',







      'bg-cyan-400 dark:bg-cyan-600',







      'bg-cyan-600 dark:bg-cyan-400',







    ],







  },







  rose: {







    key: 'rose',







    label: 'Rose',







    dotColor: 'bg-rose-500 dark:bg-rose-400',







    levels: [







      'bg-slate-100 dark:bg-navy-800/80',







      'bg-rose-200 dark:bg-rose-900/60',







      'bg-rose-400 dark:bg-rose-600',







      'bg-rose-600 dark:bg-rose-400',







    ],







  },







};















const getHeatmapColor = (count: number, palette: HeatmapPaletteKey = 'purple') => {







  const pal = HEATMAP_PALETTES[palette] || HEATMAP_PALETTES.purple;







  if (count === 0) return pal.levels[0];







  if (count <= 2) return pal.levels[1];







  if (count <= 5) return pal.levels[2];







  return pal.levels[3];







};















export const ActivityAnalyticsView: React.FC<ActivityAnalyticsProps> = ({ 







  studentId, 







  period = '30d', 







  deptId, 







  yearLevel 







}) => {







  const [selectedPeriod, setSelectedPeriod] = useState<string>(period);







  const [chartMode, setChartMode] = useState<'trend' | 'heatmap'>('trend');







  const [hoveredDay, setHoveredDay] = useState<{ date: string; count: number } | null>(null);



  const [heatmapPalette, setHeatmapPalette] = useState<HeatmapPaletteKey>(() => {







    try {







      const saved = localStorage.getItem('nec_activity_heatmap_palette') as HeatmapPaletteKey;







      if (saved && HEATMAP_PALETTES[saved]) return saved;







    } catch (e) {







      // ignore







    }







    return 'purple';







  });















  const handleSetPalette = (pal: HeatmapPaletteKey) => {







    setHeatmapPalette(pal);







    try {







      localStorage.setItem('nec_activity_heatmap_palette', pal);







    } catch (e) {







      // ignore







    }







  };







  const [submissionLangFilter, setSubmissionLangFilter] = useState<string>('ALL');







  const [loading, setLoading] = useState(true);







  const [isRefreshing, setIsRefreshing] = useState(false);







  const [data, setData] = useState<any>(null);







  const [error, setError] = useState<string | null>(null);















  useEffect(() => {







    let isMounted = true;







    setIsRefreshing(true);







    if (!data) setLoading(true);







    setError(null);















    let url = `/analytics/activity/aggregate?period=${selectedPeriod}&_t=${Date.now()}`;







    if (studentId) url += `&student_id=${studentId}`;







    if (deptId) url += `&dept_id=${deptId}`;







    if (yearLevel && yearLevel !== 'ALL') url += `&year_level=${yearLevel}`;















    api.get(url)







      .then((res) => {







        if (isMounted) {







          if (res.data.error) {







            setError(res.data.error);







          } else {







            setData(res.data);







          }







          setLoading(false);







          setIsRefreshing(false);







        }







      })







      .catch((err) => {







        if (isMounted) {







          setError(err.response?.data?.detail || "Failed to load activity analytics.");







          setLoading(false);







          setIsRefreshing(false);







        }







      });















    return () => { isMounted = false; };







  }, [studentId, selectedPeriod, deptId, yearLevel]);















  if (loading && !data) {







    return (







      <div className="flex flex-col items-center justify-center py-24 text-slate-400">







        <Loader2 className="w-8 h-8 animate-spin mb-4 text-brand-500" />







        <p className="text-sm font-medium">Loading activity analytics...</p>







      </div>







    );







  }















  if (error || !data) {







    return (







      <div className="flex flex-col items-center justify-center py-24 text-slate-400">







        <AlertCircle className="w-12 h-12 mb-4 opacity-30 text-red-500" />







        <p className="font-bold text-lg text-slate-700 dark:text-slate-300">Data Unavailable</p>







        <p className="text-sm mt-1">{error || "No activity data found for the selected period."}</p>







        <button 







          onClick={() => setSelectedPeriod('30d')} 







          className="mt-4 px-4 py-2 bg-slate-100 dark:bg-navy-800 rounded-lg text-sm font-medium hover:bg-slate-200 dark:hover:bg-navy-700 transition-colors"







        >







          Reset Period







        </button>







      </div>







    );







  }















  const { summary, most_active } = data;







  const languages: LanguageStat[] = data.languages || [];







  const recentSubmissions: RecentSubmission[] = data.recent_submissions || [];







  const badges: BadgeItem[] = data.badges || [];















  let trend = data.trend || [];







  if (trend.length === 1) {







    const pt = trend[0];







    const prevDate = new Date(new Date(pt.date).getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];







    trend = [{ ...pt, date: prevDate }, pt];







  }















  const totalPeriodSubs = trend.reduce((acc: number, item: any) => acc + (item.submissions || 0), 0);







  const totalLangSolved = languages.reduce((acc, l) => acc + (l.solved || 0), 0);







  const activePeriodLabel = PERIOD_OPTIONS.find(p => p.key === selectedPeriod)?.label || selectedPeriod;















  // Average daily solves







  const avgDailySolves = (!trend || trend.length === 0) ? '0' : (totalPeriodSubs / trend.length).toFixed(1);















  // Unique languages for Recent Submissions filter







  const availableSubmissionLangs = (() => {







    const set = new Set<string>();







    recentSubmissions.forEach(s => {







      if (s.lang) set.add(s.lang);







    });







    return ['ALL', ...Array.from(set)];







  })();















  // Filtered recent submissions







  const filteredSubmissions = submissionLangFilter === 'ALL'







    ? recentSubmissions







    : recentSubmissions.filter(s => s.lang?.toLowerCase() === submissionLangFilter.toLowerCase());















  // Heatmap generation







  const heatmapWeeks = (() => {







    if (!trend || trend.length === 0) return [];















    const countMap = new Map<string, number>();







    trend.forEach((item: any) => {







      countMap.set(item.date, item.submissions || 0);







    });















    const firstDateStr = trend[0].date;







    const lastDateStr = trend[trend.length - 1].date;















    const [sy, sm, sd] = firstDateStr.split('-').map(Number);







    const [ey, em, ed] = lastDateStr.split('-').map(Number);















    const startDate = new Date(sy, sm - 1, sd);







    const endDate = new Date(ey, em - 1, ed);















    const alignedStart = new Date(startDate);







    alignedStart.setDate(alignedStart.getDate() - alignedStart.getDay());















    const weeks: Array<{







      monthLabel?: string;







      days: Array<{ date: string; count: number; dayOfWeek: number }>;







    }> = [];















    let currentWeekDays: Array<{ date: string; count: number; dayOfWeek: number }> = [];







    const curr = new Date(alignedStart);







    let lastMonth = -1;















    while (curr <= endDate || currentWeekDays.length > 0) {







      const y = curr.getFullYear();







      const m = String(curr.getMonth() + 1).padStart(2, '0');







      const d = String(curr.getDate()).padStart(2, '0');







      const dStr = `${y}-${m}-${d}`;















      currentWeekDays.push({







        date: dStr,







        count: countMap.get(dStr) || 0,







        dayOfWeek: curr.getDay()







      });















      if (currentWeekDays.length === 7) {







        // Label month if first week of month







        let monthLabel: string | undefined = undefined;







        const firstDayOfMonth = currentWeekDays.find(day => {







          const parts = day.date.split('-');







          return parts.length === 3 && parseInt(parts[2], 10) <= 7;







        });















        if (firstDayOfMonth) {







          const mIdx = parseInt(firstDayOfMonth.date.split('-')[1], 10) - 1;







          if (mIdx !== lastMonth) {







            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];







            monthLabel = monthNames[mIdx];







            lastMonth = mIdx;







          }







        }















        weeks.push({ monthLabel, days: currentWeekDays });







        currentWeekDays = [];







      }















      curr.setDate(curr.getDate() + 1);







      if (curr > endDate && currentWeekDays.length === 0) break;







    }















    return weeks;







  })();















  const tooltipStyle = {







    backgroundColor: '#0f172a',







    border: '1px solid rgba(255,255,255,0.1)',







    borderRadius: '12px',







    color: '#f8fafc',







    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',







    padding: '8px 12px'







  };















  return (







    <div className="space-y-6 animate-fade-in mt-2 pb-8">







      {/* Top Header with Period Filter */}







      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-navy-900 p-4 rounded-2xl border border-slate-200 dark:border-navy-700/60 shadow-sm">







        <div>







          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">







            <Activity className="w-5 h-5 text-brand-500" />







            Activity & Submissions Overview







            {isRefreshing && <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-500" />}







          </h2>







          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">







            Real-time daily solving streaks, languages distribution, and recent submissions







          </p>







        </div>















        {/* Period Selector Buttons */}







        <div className="flex items-center gap-1 bg-slate-100 dark:bg-navy-800/80 p-1 rounded-xl self-start sm:self-auto">







          {PERIOD_OPTIONS.map((opt) => (







            <button







              key={opt.key}







              onClick={() => setSelectedPeriod(opt.key)}







              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${







                selectedPeriod === opt.key







                  ? 'bg-brand-500 text-white shadow-sm'







                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-navy-700/50'







              }`}







            >







              {opt.label}







            </button>







          ))}







        </div>







      </div>















      {/* KPI Cards Row */}







      {studentId ? (







        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">







          {/* Card 1: Submissions (Dynamic by period) */}







          <div className="bg-white dark:bg-navy-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-navy-700/60 shadow-sm relative overflow-hidden group hover:border-violet-500/30 transition-all">







            <div className="flex items-center justify-between">







              <span className="text-[11px] font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase">







                {selectedPeriod === 'all' ? 'Total Submissions' : `Submissions (${activePeriodLabel})`}







              </span>







              <div className="p-2 sm:p-2.5 bg-violet-500/10 text-violet-600 dark:text-violet-400 rounded-xl">







                <Activity className="w-4 h-4 sm:w-5 sm:h-5" />







              </div>







            </div>







            <div className="mt-2">







              <p className="text-2xl sm:text-3xl font-display font-extrabold text-slate-900 dark:text-white">







                {(selectedPeriod === 'all' ? (summary?.total_submissions || 0) : totalPeriodSubs).toLocaleString()}







              </p>







              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1 flex-wrap">







                <span>{selectedPeriod === 'all' ? 'All recorded submissions' : `${(summary?.total_submissions || 0).toLocaleString()} all-time`}</span>







                <span className="text-slate-300 dark:text-navy-600">•</span>







                <span className="text-brand-600 dark:text-brand-400 font-semibold">{avgDailySolves}/day avg</span>







              </p>







            </div>







          </div>















          {/* Card 2: Current Streak (Clean text, no emojis) */}







          <div className="bg-white dark:bg-navy-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-navy-700/60 shadow-sm relative overflow-hidden group hover:border-amber-500/30 transition-all">







            <div className="flex items-center justify-between">







              <span className="text-[11px] font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase">







                Current Streak







              </span>







              <div className="p-2 sm:p-2.5 bg-amber-500/10 text-amber-500 dark:text-amber-400 rounded-xl">







                <Flame className="w-4 h-4 sm:w-5 sm:h-5" />







              </div>







            </div>







            <div className="mt-2">







              <p className="text-2xl sm:text-3xl font-display font-extrabold text-slate-900 dark:text-white">







                {summary?.current_streak || 0} <span className="text-sm font-semibold text-slate-400">Days</span>







              </p>







              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 font-medium flex items-center gap-1">







                {(summary?.current_streak || 0) > 0 ? 'Active solving streak' : 'Streak inactive'}







              </p>







            </div>







          </div>















          {/* Card 3: Longest Streak */}







          <div className="bg-white dark:bg-navy-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-navy-700/60 shadow-sm relative overflow-hidden group hover:border-yellow-500/30 transition-all">







            <div className="flex items-center justify-between">







              <span className="text-[11px] font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase">







                Max Streak







              </span>







              <div className="p-2 sm:p-2.5 bg-yellow-500/10 text-yellow-500 dark:text-yellow-400 rounded-xl">







                <Trophy className="w-4 h-4 sm:w-5 sm:h-5" />







              </div>







            </div>







            <div className="mt-2">







              <p className="text-2xl sm:text-3xl font-display font-extrabold text-slate-900 dark:text-white">







                {summary?.longest_streak || 0} <span className="text-sm font-semibold text-slate-400">Days</span>







              </p>







              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">







                <span>Personal best record</span>







              </p>







            </div>







          </div>















          {/* Card 4: Active Days */}







          <div className="bg-white dark:bg-navy-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-navy-700/60 shadow-sm relative overflow-hidden group hover:border-emerald-500/30 transition-all">







            <div className="flex items-center justify-between">







              <span className="text-[11px] font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase">







                Active Days







              </span>







              <div className="p-2 sm:p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">







                <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />







              </div>







            </div>







            <div className="mt-2">







              <p className="text-2xl sm:text-3xl font-display font-extrabold text-slate-900 dark:text-white">







                {summary?.total_active_days || 0} <span className="text-sm font-semibold text-slate-400">Days</span>







              </p>







              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">







                <span>Total active solving days</span>







              </p>







            </div>







          </div>







        </div>







      ) : (







        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">







          <div className="bg-white dark:bg-navy-900 p-5 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-sm flex items-center">







            <div className="p-3 bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 rounded-xl mr-4">







              <Activity className="w-6 h-6" />







            </div>







            <div>







              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Submissions</p>







              <p className="text-2xl font-display font-bold text-slate-900 dark:text-white mt-0.5">{summary?.total_submissions || 0}</p>







            </div>







          </div>







          <div className="bg-white dark:bg-navy-900 p-5 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-sm flex items-center">







            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl mr-4">







              <Users className="w-6 h-6" />







            </div>







            <div>







              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Active Students</p>







              <p className="text-2xl font-display font-bold text-slate-900 dark:text-white mt-0.5">{summary?.active_students || 0}</p>







            </div>







          </div>







          <div className="bg-white dark:bg-navy-900 p-5 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-sm flex items-center">







            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-xl mr-4">







              <Percent className="w-6 h-6" />







            </div>







            <div>







              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Active Rate</p>







              <p className="text-2xl font-display font-bold text-slate-900 dark:text-white mt-0.5">{summary?.active_rate || 0}%</p>







            </div>







          </div>







        </div>







      )}















      {/* Badges Shelf (Clean: Only authentic LeetCode Badges) */}







      {badges.length > 0 && (







        <div className="bg-white dark:bg-navy-900 p-5 rounded-2xl border border-slate-200 dark:border-navy-700/60 shadow-sm">







          <div className="flex items-center justify-between mb-4">







            <div className="flex items-center gap-2">







              <Award className="w-5 h-5 text-amber-500" />







              <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">







                Earned LeetCode Badges







              </h3>







              <span className="text-xs px-2.5 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold rounded-full">







                {badges.length}







              </span>







            </div>







          </div>















          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">







            {badges.map((b) => (







              <div 







                key={b.id || b.name}







                className="flex flex-col items-center p-3 rounded-xl bg-slate-50 dark:bg-navy-800/60 border border-slate-100 dark:border-navy-700/50 hover:border-amber-500/40 hover:shadow-md transition-all text-center group"







              >







                <div className="w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center mb-2 relative">







                  {b.icon_url ? (







                    <img 







                      src={formatBadgeUrl(b.icon_url)} 







                      alt={b.name} 







                      className="max-w-full max-h-full object-contain filter drop-shadow group-hover:scale-105 transition-transform"







                      onError={(e) => {







                        (e.target as HTMLElement).style.display = 'none';







                      }}







                    />







                  ) : (







                    <Award className="w-8 h-8 text-amber-500" />







                  )}







                </div>







                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 line-clamp-2">







                  {b.name}







                </p>







                {b.awarded_at && (







                  <p className="text-[10px] text-slate-400 mt-1">







                    {b.awarded_at}







                  </p>







                )}







              </div>







            ))}







          </div>







        </div>







      )}















      {/* Daily Activity Section (Area Chart OR Contribution Heatmap Grid) */}







      <div className="bg-white dark:bg-navy-900 p-5 rounded-2xl border border-slate-200 dark:border-navy-700/60 shadow-sm flex flex-col">







        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">







          <div>







            <div className="flex items-center gap-2">







              <h3 className="font-bold text-slate-900 dark:text-white text-base">







                Daily Activity Trend







              </h3>







              {isRefreshing && <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-500" />}







              







              {/* Chart Mode Toggle */}







              <div className="flex items-center gap-1 bg-slate-100 dark:bg-navy-800/80 p-0.5 rounded-lg border border-slate-200/60 dark:border-navy-700/60 ml-2">







                <button







                  type="button"







                  onClick={() => setChartMode('trend')}







                  className={`flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-md transition-all ${







                    chartMode === 'trend'







                      ? 'bg-white dark:bg-navy-900 text-brand-600 dark:text-brand-400 shadow-2xs'







                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'







                  }`}







                  title="Line Trend View"







                >







                  <TrendingUp className="w-3 h-3" />







                  <span className="hidden xs:inline">Trend</span>







                </button>







                <button







                  type="button"







                  onClick={() => setChartMode('heatmap')}







                  className={`flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-md transition-all ${







                    chartMode === 'heatmap'







                      ? 'bg-white dark:bg-navy-900 text-brand-600 dark:text-brand-400 shadow-2xs'







                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'







                  }`}







                  title="Calendar Heatmap View"







                >







                  <Grid className="w-3 h-3" />







                  <span className="hidden xs:inline">Heatmap</span>







                </button>







              </div>







            </div>







            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">







              <span className="font-semibold text-slate-700 dark:text-slate-200">{totalPeriodSubs.toLocaleString()}</span> submissions logged in {activePeriodLabel} • <span className="font-semibold text-brand-600 dark:text-brand-400">{avgDailySolves}</span> solves/day avg







            </p>







          </div>















          {/* Synchronized Period Selector on Chart Header */}







          <div className="flex items-center gap-1 bg-slate-100 dark:bg-navy-800/80 p-1 rounded-xl self-start sm:self-auto">







            {PERIOD_OPTIONS.map((opt) => (







              <button







                key={opt.key}







                onClick={() => setSelectedPeriod(opt.key)}







                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${







                  selectedPeriod === opt.key







                    ? 'bg-brand-500 text-white shadow-sm'







                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-navy-700/50'







                }`}







              >







                {opt.label}







              </button>







            ))}







          </div>







        </div>















        {chartMode === 'trend' ? (







          trend && trend.length > 0 ? (







            <div className="w-full h-[260px] sm:h-[300px]">







              <ResponsiveContainer width="100%" height="100%">







                <AreaChart data={trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>







                  <defs>







                    <linearGradient id="activityGradient" x1="0" y1="0" x2="0" y2="1">







                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.35}/>







                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0}/>







                    </linearGradient>







                  </defs>







                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.15} />







                  <XAxis 







                    dataKey="date" 







                    axisLine={false} 







                    tickLine={false} 







                    tick={{ fill: '#94a3b8', fontSize: 11 }} 







                    dy={8} 







                    minTickGap={selectedPeriod === 'all' ? 40 : 25}







                    tickFormatter={formatDateTick}







                  />







                  <YAxis 







                    axisLine={false} 







                    tickLine={false} 







                    tick={{ fill: '#94a3b8', fontSize: 11 }} 







                    allowDecimals={false}







                  />







                  <Tooltip 







                    contentStyle={tooltipStyle}







                    formatter={(val: any) => [`${val} submissions`, 'Solved Submissions']}







                    labelFormatter={formatTooltipDate}







                  />







                  <Area 







                    type="monotone" 







                    dataKey="submissions" 







                    name="Submissions" 







                    stroke="#8b5cf6" 







                    strokeWidth={2.5} 







                    fillOpacity={1} 







                    fill="url(#activityGradient)" 







                  />







                </AreaChart>







              </ResponsiveContainer>







            </div>







          ) : (







            <div className="flex items-center justify-center bg-slate-50 dark:bg-navy-800/50 rounded-xl border border-slate-100 dark:border-navy-700/50 h-[260px]">







              <p className="text-slate-400 dark:text-navy-400 font-medium text-sm">No trend data available for this timeframe.</p>







            </div>







          )







        ) : (







          /* Contribution Heatmap Grid (LeetCode / GitHub style) */

          <div className="py-2 space-y-3">

            {/* Live Hover/Selected Day Info Bar */}

            <div className="flex items-center justify-between text-xs min-h-[28px] px-1">

              {hoveredDay ? (

                <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-navy-700 animate-fade-in shadow-2xs">

                  <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />

                  <span className="font-bold text-brand-600 dark:text-brand-400">

                    {hoveredDay.count} {hoveredDay.count === 1 ? 'submission' : 'submissions'}

                  </span>

                  <span className="text-slate-400">•</span>

                  <span className="font-medium">

                    {new Date(hoveredDay.date + 'T00:00:00').toLocaleDateString(undefined, { 

                      weekday: 'short', 

                      month: 'short', 

                      day: 'numeric', 

                      year: 'numeric' 

                    })}

                  </span>

                </div>

              ) : (

                <span className="text-slate-400 dark:text-slate-500 text-[11px] font-medium">

                  Daily submission count is shown inside each box • Hover or tap for date details

                </span>

              )}

            </div>



            <div className="overflow-x-auto pb-2">

              <div className="inline-block min-w-full">

                <div className="flex gap-2">

                  {/* Day of week labels */}

                  <div className="flex flex-col gap-1.5 pr-1.5 text-[10px] text-slate-400 font-mono select-none pt-5">

                    <span className="h-5 sm:h-6 flex items-center justify-end">Sun</span>

                    <span className="h-5 sm:h-6 flex items-center justify-end text-transparent select-none">Mon</span>

                    <span className="h-5 sm:h-6 flex items-center justify-end">Tue</span>

                    <span className="h-5 sm:h-6 flex items-center justify-end text-transparent select-none">Wed</span>

                    <span className="h-5 sm:h-6 flex items-center justify-end">Thu</span>

                    <span className="h-5 sm:h-6 flex items-center justify-end text-transparent select-none">Fri</span>

                    <span className="h-5 sm:h-6 flex items-center justify-end">Sat</span>

                  </div>



                  {/* Heatmap columns (weeks) */}

                  <div className="flex gap-1.5">

                    {heatmapWeeks.map((week, wIdx) => (

                      <div key={wIdx} className="flex flex-col gap-1.5">

                        {/* Month label header */}

                        <span className="h-4 text-[10px] text-slate-400 font-semibold block truncate">

                          {week.monthLabel || ''}

                        </span>

                        {/* 7 day cells */}

                        {week.days.map((day) => {

                          const isFilled = day.count > 0;

                          const isHovered = hoveredDay?.date === day.date;

                          const textColor = !isFilled 

                            ? 'text-transparent' 

                            : day.count <= 2 

                            ? 'text-slate-800 dark:text-slate-100 font-bold' 

                            : 'text-white font-black';



                          return (

                            <div

                              key={day.date}

                              onMouseEnter={() => setHoveredDay({ date: day.date, count: day.count })}

                              onMouseLeave={() => setHoveredDay(null)}

                              onClick={() => setHoveredDay({ date: day.date, count: day.count })}

                              title={`${day.count} submissions on ${day.date}`}

                              className={`w-5 h-5 sm:w-6 sm:h-6 rounded-[4px] sm:rounded-md flex items-center justify-center text-[9px] sm:text-[10px] font-mono transition-transform hover:scale-125 hover:z-20 cursor-pointer shadow-2xs select-none ${textColor} ${getHeatmapColor(day.count, heatmapPalette)} ${

                                isHovered ? 'ring-2 ring-brand-500 ring-offset-1 ring-offset-white dark:ring-offset-navy-900 scale-110 z-10' : ''

                              }`}

                            >

                              {isFilled ? (day.count > 99 ? '99+' : day.count) : ''}

                            </div>

                          );

                        })}

                      </div>

                    ))}

                  </div>

                </div>

              </div>

            </div>



            {/* Heatmap Legend & Palette Switcher */}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-navy-800 text-xs text-slate-400">

              <div className="flex flex-wrap items-center gap-3">

                <span className="font-medium text-slate-500 dark:text-slate-400">

                  {heatmapWeeks.length} active weeks mapped

                </span>

                

                {/* Theme / Palette selector */}

                <div className="flex items-center gap-1.5 pl-3 border-l border-slate-200 dark:border-navy-700">

                  <Palette className="w-3.5 h-3.5 text-slate-400 shrink-0" />

                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Palette:</span>

                  <div className="inline-flex items-center gap-1.5 bg-slate-100/90 dark:bg-navy-800/90 px-1.5 py-0.5 rounded-full border border-slate-200/60 dark:border-navy-700/60 h-6">

                    {(Object.keys(HEATMAP_PALETTES) as HeatmapPaletteKey[]).map((key) => {

                      const pal = HEATMAP_PALETTES[key];

                      const isSelected = heatmapPalette === key;

                      return (

                        <button

                          key={key}

                          type="button"

                          onClick={() => handleSetPalette(key)}

                          className={`w-3.5 h-3.5 min-w-[14px] min-h-[14px] max-w-[14px] max-h-[14px] p-0 shrink-0 aspect-square rounded-full ${pal.dotColor} transition-transform ${

                            isSelected 

                              ? 'ring-2 ring-offset-1 ring-offset-white dark:ring-offset-navy-900 ring-slate-800 dark:ring-white scale-110 shadow-xs' 

                              : 'opacity-60 hover:opacity-100 hover:scale-105'

                          }`}

                          title={`${pal.label} theme`}

                          aria-label={`${pal.label} theme`}

                        />

                      );

                    })}

                  </div>

                </div>

              </div>



              <div className="flex items-center gap-1.5">

                <span className="text-[11px]">Less</span>

                <div className={`w-3.5 h-3.5 min-w-[14px] min-h-[14px] rounded-[3px] shrink-0 ${HEATMAP_PALETTES[heatmapPalette].levels[0]}`} />

                <div className={`w-3.5 h-3.5 min-w-[14px] min-h-[14px] rounded-[3px] shrink-0 ${HEATMAP_PALETTES[heatmapPalette].levels[1]}`} />

                <div className={`w-3.5 h-3.5 min-w-[14px] min-h-[14px] rounded-[3px] shrink-0 ${HEATMAP_PALETTES[heatmapPalette].levels[2]}`} />

                <div className={`w-3.5 h-3.5 min-w-[14px] min-h-[14px] rounded-[3px] shrink-0 ${HEATMAP_PALETTES[heatmapPalette].levels[3]}`} />

                <span className="text-[11px]">More</span>

              </div>

            </div>

          </div>

        )}







      </div>















      {/* Two-Column Section: Languages Breakdown & Recent Submissions */}







      {studentId ? (







        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">







          {/* Left Column: Language Breakdown */}







          <div className="bg-white dark:bg-navy-900 p-5 rounded-2xl border border-slate-200 dark:border-navy-700/60 shadow-sm flex flex-col">







            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-navy-800">







              <div className="flex items-center gap-2">







                <div className="p-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg">







                  <Code2 className="w-4 h-4" />







                </div>







                <div>







                  <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">







                    Languages Solved







                  </h3>







                  <p className="text-[11px] text-slate-500 dark:text-slate-400">







                    Distribution of solved problems by programming language







                  </p>







                </div>







              </div>







              <span className="text-xs px-2.5 py-1 bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 font-semibold rounded-lg">







                {languages.length} Languages







              </span>







            </div>















            {languages.length > 0 ? (







              <div className="space-y-3.5 flex-1 overflow-auto max-h-[380px] pr-1">







                {languages.map((l, idx) => {







                  const style = LANGUAGE_COLORS[l.language] || {







                    bg: 'bg-slate-500/10 dark:bg-slate-500/20',







                    text: 'text-slate-600 dark:text-slate-400',







                    bar: 'bg-slate-500'







                  };







                  const pct = totalLangSolved > 0 ? ((l.solved / totalLangSolved) * 100).toFixed(1) : '0';







                  const isPrimary = idx === 0 && l.solved > 0;















                  return (







                    <div 







                      key={l.language} 







                      className={`group p-2 rounded-xl transition-colors ${







                        isPrimary ? 'bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40' : ''







                      }`}







                    >







                      <div className="flex items-center justify-between text-xs mb-1.5">







                        <div className="flex items-center gap-2">







                          <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${style.bg} ${style.text}`}>







                            {l.language}







                          </span>







                          <span className="font-semibold text-slate-700 dark:text-slate-200">







                            {l.solved.toLocaleString()} problems







                          </span>







                          {isPrimary && (







                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-500 text-white uppercase tracking-wider">







                              Primary







                            </span>







                          )}







                        </div>







                        <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">







                          {pct}%







                        </span>







                      </div>







                      <div className="w-full h-2 bg-slate-100 dark:bg-navy-800 rounded-full overflow-hidden">







                        <div 







                          className={`h-full rounded-full transition-all duration-500 ${style.bar}`} 







                          style={{ width: `${Math.max(Number(pct), 2)}%` }}







                        />







                      </div>







                    </div>







                  );







                })}







              </div>







            ) : (







              <div className="flex-1 flex items-center justify-center py-12 text-slate-400 text-sm">







                No language data recorded.







              </div>







            )}







          </div>















          {/* Right Column: Recent Submissions with Language Filter */}







          <div className="bg-white dark:bg-navy-900 p-5 rounded-2xl border border-slate-200 dark:border-navy-700/60 shadow-sm flex flex-col">







            <div className="flex flex-col gap-2.5 mb-3 pb-3 border-b border-slate-100 dark:border-navy-800">







              <div className="flex items-center justify-between">







                <div className="flex items-center gap-2">







                  <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg">







                    <Clock className="w-4 h-4" />







                  </div>







                  <div>







                    <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">







                      Recent Submissions







                    </h3>







                    <p className="text-[11px] text-slate-500 dark:text-slate-400">







                      Latest submissions with runtime and memory performance







                    </p>







                  </div>







                </div>







                <span className="text-xs px-2.5 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold rounded-lg">







                  {filteredSubmissions.length} of {recentSubmissions.length}







                </span>







              </div>















              {/* Language Filter Pills for Submissions */}







              {availableSubmissionLangs.length > 2 && (







                <div className="flex items-center gap-1.5 overflow-x-auto pt-1">







                  {availableSubmissionLangs.map(lang => (







                    <button







                      key={lang}







                      onClick={() => setSubmissionLangFilter(lang)}







                      className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase transition-all ${







                        submissionLangFilter === lang







                          ? 'bg-emerald-600 text-white shadow-2xs'







                          : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'







                      }`}







                    >







                      {lang}







                    </button>







                  ))}







                </div>







              )}







            </div>















            {filteredSubmissions.length > 0 ? (







              <div className="space-y-2.5 flex-1 overflow-auto max-h-[380px] pr-1 divide-y divide-slate-100 dark:divide-navy-800/80">







                {filteredSubmissions.map((s) => (







                  <div 







                    key={s.id} 







                    className="pt-2.5 first:pt-0 flex items-center justify-between gap-3 group hover:bg-slate-50 dark:hover:bg-navy-800/40 p-2 rounded-xl transition-colors"







                  >







                    <div className="min-w-0 flex-1">







                      <div className="flex items-center gap-2 flex-wrap">







                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />







                        {s.title_slug ? (







                          <a 







                            href={`https://leetcode.com/problems/${s.title_slug}`}







                            target="_blank"







                            rel="noopener noreferrer"







                            className="font-semibold text-xs sm:text-sm text-slate-800 dark:text-slate-200 hover:text-brand-500 dark:hover:text-brand-400 truncate flex items-center gap-1 transition-colors"







                          >







                            <span>{s.title}</span>







                            <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />







                          </a>







                        ) : (







                          <span className="font-semibold text-xs sm:text-sm text-slate-800 dark:text-slate-200 truncate">







                            {s.title}







                          </span>







                        )}







                      </div>















                      <div className="flex items-center gap-2 mt-1 flex-wrap text-[11px] text-slate-400">







                        {s.lang && (







                          <span className="font-medium text-slate-600 dark:text-slate-300 uppercase text-[10px] px-1.5 py-0.5 bg-slate-100 dark:bg-navy-800 rounded">







                            {s.lang}







                          </span>







                        )}







                        {s.runtime && (







                          <span className="text-slate-600 dark:text-slate-300 font-mono text-[11px] px-1.5 py-0.5 bg-slate-100 dark:bg-navy-800/80 rounded border border-slate-200/50 dark:border-navy-700/50">







                            Runtime: {s.runtime}







                          </span>







                        )}







                        {s.memory && (







                          <span className="text-slate-600 dark:text-slate-300 font-mono text-[11px] px-1.5 py-0.5 bg-slate-100 dark:bg-navy-800/80 rounded border border-slate-200/50 dark:border-navy-700/50">







                            Memory: {s.memory}







                          </span>







                        )}







                      </div>







                    </div>















                    <div className="text-right shrink-0">







                      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">







                        {s.relative_time || s.timestamp?.split(' ')[0]}







                      </span>







                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">







                        {s.status}







                      </span>







                    </div>







                  </div>







                ))}







              </div>







            ) : (







              <div className="flex-1 flex items-center justify-center py-12 text-slate-400 text-sm">







                No submissions found for selected language.







              </div>







            )}







          </div>







        </div>







      ) : (







        /* Department / Admin View: Most Active Table */







        <div className="bg-white dark:bg-navy-900 p-5 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-sm overflow-hidden flex flex-col">







          <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center">







            <Users className="w-5 h-5 text-indigo-500 mr-2" />







            Most Active Students







          </h3>







          <div className="flex-1 overflow-auto pr-2">







            <table className="w-full text-left border-collapse">







              <thead>







                <tr>







                  <th className="py-3 px-2 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-navy-700">Student</th>







                  <th className="py-3 px-2 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-navy-700 text-right">Activity Level (Submissions)</th>







                </tr>







              </thead>







              <tbody className="divide-y divide-slate-100 dark:divide-navy-800">







                {most_active && most_active.length > 0 ? (







                  most_active.map((p: any) => (







                    <tr key={p.student_id} className="hover:bg-slate-50 dark:hover:bg-navy-800/50 transition-colors">







                      <td className="py-3 px-2">







                        <p className="font-semibold text-slate-900 dark:text-white text-sm">{p.name}</p>







                        <p className="text-xs text-slate-500">{p.reg_no}</p>







                      </td>







                      <td className="py-3 px-2 text-right font-medium text-brand-600">







                        {p.solved ? p.solved : '-'}







                      </td>







                    </tr>







                  ))







                ) : (







                  <tr>







                    <td colSpan={2} className="py-8 text-center text-slate-400 text-sm">No activity recorded.</td>







                  </tr>







                )}







              </tbody>







            </table>







          </div>







        </div>







      )}







    </div>







  );







};







