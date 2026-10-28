import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Building2, Users, Activity, TrendingUp, TrendingDown, Minus,
  AlertCircle, CheckCircle, Code, Info, Mail, GraduationCap,
  ChevronDown, ChevronUp, Search, Award, ShieldCheck
} from 'lucide-react';
import { SwipeHandle } from '../SwipeHandle';
import { getDepartmentIntelligenceDetails, DepartmentIntelligenceDetails, DeptBenchmark } from '../../services/commandCenterService';

interface DepartmentDetailDrawerProps {
  department: DeptBenchmark | null;
  onClose: () => void;
}

const CANONICAL_DEPT_HOD: Record<string, string> = {
  IT: 'Dr. M. Senthilkumar',
  'CSE(CS)': 'Dr. S. Prabhu',
  'CSE(IOT)': 'Dr. S. Karthikeyan',
  CSE: 'Dr. S. Prabhu',
};

const resolveDepartmentHODName = (deptCode?: string, rawName?: string) => {
  const code = (deptCode || '').toUpperCase().trim();
  const raw = (rawName || '').trim();
  const isCoordinator = /santhoshkumar|devayani|sivakumar/i.test(raw);
  if (raw && !isCoordinator && !raw.startsWith('HOD -') && !raw.startsWith('HOD (')) {
    return raw;
  }
  return CANONICAL_DEPT_HOD[code] || raw || (deptCode ? `HOD (${deptCode})` : 'Head of Department');
};

export const DepartmentDetailDrawer: React.FC<DepartmentDetailDrawerProps> = ({ department, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState<DepartmentIntelligenceDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'staff' | 'top' | 'risk'>('staff');
  const [expandedStaffId, setExpandedStaffId] = useState<number | null>(null);
  const [staffSearch, setStaffSearch] = useState<string>('');

  useEffect(() => {
    if (department?.department_id) {
      loadDetails(department.department_id);
    } else {
      setDetails(null);
    }
  }, [department]);

  const loadDetails = async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getDepartmentIntelligenceDetails(id);
      setDetails(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load department intelligence');
    } finally {
      setLoading(false);
    }
  };

  const filteredStaff = useMemo(() => {
    if (!details?.staff_list) return [];
    if (!staffSearch.trim()) return details.staff_list;
    const q = staffSearch.toLowerCase();
    return details.staff_list.filter(s => 
      s.name.toLowerCase().includes(q) || 
      s.username.toLowerCase().includes(q) || 
      (s.email && s.email.toLowerCase().includes(q))
    );
  }, [details?.staff_list, staffSearch]);

  if (!department || typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[999999] flex items-end sm:items-stretch justify-center sm:justify-end p-0">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-slate-950/95 dark:bg-black/95 backdrop-blur-xl"
          onClick={onClose}
        />
        
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="relative w-full max-w-3xl bg-white dark:bg-navy-950 h-full sm:h-full shadow-2xl flex flex-col sm:border-l border-slate-200 dark:border-navy-700 rounded-none overflow-hidden"
        >
          {/* Header */}
          <div className="relative p-4 sm:p-6 border-b border-indigo-200/50 dark:border-indigo-900/50 flex flex-col bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-navy-900 dark:via-navy-950 dark:to-indigo-950 overflow-hidden rounded-none">
            {/* Mobile indicator */}
            <SwipeHandle onClose={onClose} className="pt-1 pb-1 relative z-20" pillClassName="bg-indigo-300 dark:bg-indigo-700 hover:bg-indigo-400" />
            
            <div className="flex items-start justify-between w-full">
              {/* Background elements */}
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-10 left-10 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
              
              <div className="flex items-start gap-3 sm:gap-4 relative z-10 w-full pr-2 sm:pr-4">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
                  <Building2 size={24} className="sm:hidden" />
                  <Building2 size={28} className="hidden sm:block" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg sm:text-2xl font-display font-black leading-tight break-words bg-clip-text text-transparent bg-gradient-to-r from-indigo-700 to-purple-700 dark:from-indigo-300 dark:to-purple-300">
                      {department.department_name}
                    </h2>
                    <span className="px-2.5 py-1 text-[10px] font-black font-mono rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/50 shadow-sm shrink-0">
                      {department.department_code}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-2 text-sm">
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black tracking-wider uppercase shadow-sm border ${
                      department.health_status === 'Excellent' ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800' :
                      department.health_status === 'Healthy' ? 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800' :
                      department.health_status === 'Needs Attention' ? 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800' :
                      'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
                    }`}>
                      {department.health_status}
                    </span>
                    <span className="text-slate-600 dark:text-slate-300 font-bold text-xs flex items-center gap-1 bg-white/50 dark:bg-navy-900/50 px-2 py-0.5 rounded-full border border-slate-200 dark:border-navy-700 shrink-0">
                      Rank <span className="text-indigo-600 dark:text-indigo-400 font-black">#{department.rank}</span> Institutionally
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-white dark:hover:bg-navy-800 transition-all hover:shadow-sm border border-transparent hover:border-slate-200 relative z-10 shrink-0 touch-manipulation active:scale-90 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 sm:space-y-6 stylish-scrollbar">
            {/* KPI Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 shadow-sm">
                <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Users size={13} /> Total Roster
                </div>
                <div className="text-xl sm:text-2xl font-display font-bold text-slate-900 dark:text-white">
                  {department.student_count}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
                  {department.active_count} active
                </div>
              </div>

              <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 shadow-sm">
                <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Activity size={13} /> Engagement
                </div>
                <div className="text-xl sm:text-2xl font-display font-bold text-slate-900 dark:text-white">
                  {department.coding_engagement || 'N/A'}
                </div>
                <div className="w-full bg-slate-100 dark:bg-navy-950 rounded-full h-1.5 mt-2">
                  <div className="bg-brand-500 h-1.5 rounded-full" style={{ width: `${department.active_score || 0}%` }} />
                </div>
              </div>

              <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 shadow-sm">
                <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Code size={13} /> Avg Solved
                </div>
                <div className="text-xl sm:text-2xl font-display font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  {department.avg_solved}
                  {department.performance_trend === '↑' && <TrendingUp size={15} className="text-emerald-500" />}
                  {department.performance_trend === '↓' && <TrendingDown size={15} className="text-rose-500" />}
                  {department.performance_trend === '→' && <Minus size={15} className="text-slate-400" />}
                </div>
                <div className="text-[11px] text-emerald-600 font-bold mt-0.5">
                  {department.growth_rate_pct}
                </div>
              </div>

              <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 shadow-sm">
                <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <CheckCircle size={13} /> Completion
                </div>
                <div className="text-xl sm:text-2xl font-display font-bold text-slate-900 dark:text-white">
                  {department.completion_rate}%
                </div>
                <div className="w-full bg-slate-100 dark:bg-navy-950 rounded-full h-1.5 mt-2">
                  <div className="bg-brand-500 h-1.5 rounded-full" style={{ width: `${department.completion_rate || 0}%` }} />
                </div>
              </div>
            </div>

            {/* HOD Leadership Executive Card */}
            {details?.hod && (
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 border border-blue-500/25 dark:border-indigo-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black shadow-md shrink-0">
                    <GraduationCap size={22} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                        Head of Department
                      </span>
                      <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                        {department.department_code}
                      </span>
                    </div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white mt-0.5">
                      {resolveDepartmentHODName(department.department_code, details.hod.name)}
                    </h3>
                    {details.hod.email && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                        <Mail size={12} /> {details.hod.email}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-left sm:text-right flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200/60 dark:border-navy-800">
                  <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider">
                    Mentorship Team
                  </span>
                  <span className="font-mono font-black text-sm text-indigo-600 dark:text-indigo-400">
                    {details.staff_list?.length || 0} Faculty Mentors
                  </span>
                </div>
              </div>
            )}

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-navy-800 pb-2">
              <button
                type="button"
                onClick={() => setActiveTab('staff')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'staff'
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-navy-900 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-navy-800'
                }`}
              >
                <Users size={14} />
                <span>Faculty Mentors ({details?.staff_list?.length || 0})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('top')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'top'
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-navy-900 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-navy-800'
                }`}
              >
                <TrendingUp size={14} />
                <span>Top Solvers ({details?.top_performers?.length || 0})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('risk')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'risk'
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-navy-900 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-navy-800'
                }`}
              >
                <AlertCircle size={14} />
                <span>At-Risk ({details?.at_risk_students?.length || 0})</span>
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
              </div>
            ) : error ? (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-3">
                <AlertCircle size={20} />
                <span className="font-medium text-sm">{error}</span>
              </div>
            ) : details ? (
              <>
                {/* 1. FACULTY MENTORS TAB */}
                {activeTab === 'staff' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="relative flex-1">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={staffSearch}
                          onChange={(e) => setStaffSearch(e.target.value)}
                          placeholder="Search faculty by name or email..."
                          className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      </div>
                      <span className="text-xs font-bold text-slate-500 shrink-0 font-mono">
                        Showing {filteredStaff.length} / {details.staff_list?.length || 0} Staff
                      </span>
                    </div>

                    {filteredStaff.length === 0 ? (
                      <div className="p-8 text-center border-2 border-dashed border-slate-200 dark:border-navy-800 rounded-2xl text-slate-500 text-xs font-bold">
                        No faculty mentors found matching your search.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {filteredStaff.map((staff) => {
                          const isExpanded = expandedStaffId === staff.id;
                          return (
                            <div
                              key={staff.id}
                              className="rounded-2xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900/90 shadow-xs hover:shadow-md transition overflow-hidden"
                            >
                              {/* Staff Summary Header */}
                              <div
                                onClick={() => setExpandedStaffId(isExpanded ? null : staff.id)}
                                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-navy-800/50 transition"
                              >
                                <div className="flex items-start gap-3 min-w-0">
                                  <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-sm shrink-0">
                                    {staff.name.slice(0, 2).toUpperCase()}
                                  </div>
                                  <div className="min-w-0">
                                    <h4 className="font-display font-black text-sm text-slate-900 dark:text-white truncate">
                                      {staff.name}
                                    </h4>
                                    <p className="text-xs text-slate-500 font-mono truncate">
                                      {staff.email || `@${staff.username}`}
                                    </p>
                                  </div>
                                </div>

                                {/* Progress & Quick Stats */}
                                <div className="flex items-center gap-4 sm:gap-6 self-stretch sm:self-auto justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 dark:border-navy-800">
                                  <div className="text-left sm:text-right">
                                    <div className="text-[10.5px] font-extrabold uppercase text-slate-500">
                                      Assigned
                                    </div>
                                    <div className="text-xs font-black font-mono text-slate-900 dark:text-white">
                                      {staff.assigned_count} Students
                                    </div>
                                  </div>

                                  <div className="text-left sm:text-right">
                                    <div className="text-[10.5px] font-extrabold uppercase text-slate-500">
                                      Total Solved
                                    </div>
                                    <div className="text-xs font-black font-mono text-brand-600 dark:text-brand-400">
                                      {staff.total_solved}
                                    </div>
                                  </div>

                                  <div className="min-w-[90px] text-right">
                                    <div className="text-[10.5px] font-extrabold uppercase text-slate-500 flex items-center justify-end gap-1">
                                      <span>Completion</span>
                                      <span className="font-mono text-emerald-600 dark:text-emerald-400">{staff.completion_rate}%</span>
                                    </div>
                                    <div className="w-full bg-slate-100 dark:bg-navy-950 rounded-full h-1.5 mt-1 overflow-hidden">
                                      <div
                                        className="bg-gradient-to-r from-emerald-500 to-teal-500 h-1.5 rounded-full"
                                        style={{ width: `${Math.min(100, staff.completion_rate)}%` }}
                                      />
                                    </div>
                                  </div>

                                  <div className="text-slate-400 shrink-0">
                                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                  </div>
                                </div>
                              </div>

                              {/* Expanded Assigned Students List */}
                              {isExpanded && (
                                <div className="p-4 bg-slate-50/80 dark:bg-navy-950/80 border-t border-slate-100 dark:border-navy-800 space-y-3">
                                  <div className="flex items-center justify-between">
                                    <h5 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                      <GraduationCap size={14} className="text-indigo-500" />
                                      Assigned Mentees ({staff.students?.length || 0})
                                    </h5>
                                    <span className="text-[11px] font-bold text-slate-500 font-mono">
                                      Avg: {staff.avg_solved} solved / student
                                    </span>
                                  </div>

                                  {(!staff.students || staff.students.length === 0) ? (
                                    <div className="p-4 text-center text-xs text-slate-400 font-bold">
                                      No student records linked to this faculty mentor yet.
                                    </div>
                                  ) : (
                                    <div className="rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 overflow-hidden">
                                      <table className="w-full text-left border-collapse text-xs">
                                        <thead>
                                          <tr className="bg-slate-100/70 dark:bg-navy-950 text-[10.5px] font-black uppercase text-slate-500 border-b border-slate-200 dark:border-navy-800">
                                            <th className="py-2 px-3">Student</th>
                                            <th className="py-2 px-2 text-center">Year</th>
                                            <th className="py-2 px-3 text-right">Problems Solved</th>
                                            <th className="py-2 px-3 text-right">Rating</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
                                          {staff.students.map((st) => (
                                            <tr key={st.id} className="hover:bg-slate-50 dark:hover:bg-navy-800/50">
                                              <td className="py-2 px-3">
                                                <div className="font-bold text-slate-900 dark:text-white">{st.name}</div>
                                                <div className="text-[10px] text-slate-500 font-mono">{st.reg_no}</div>
                                              </td>
                                              <td className="py-2 px-2 text-center font-bold text-slate-600 dark:text-slate-400 font-mono">
                                                {st.year_level}
                                              </td>
                                              <td className="py-2 px-3 text-right font-black font-mono text-brand-600 dark:text-brand-400">
                                                {st.total_solved}
                                              </td>
                                              <td className="py-2 px-3 text-right font-bold font-mono text-slate-600 dark:text-slate-300">
                                                {st.contest_rating && st.contest_rating > 0 ? st.contest_rating : '—'}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* 2. TOP PERFORMERS TAB */}
                {activeTab === 'top' && (
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                      <TrendingUp size={16} className="text-emerald-500" />
                      Top Performing Students
                    </h3>
                    
                    {details.top_performers.length === 0 ? (
                      <div className="p-6 text-center border-2 border-dashed border-slate-200 dark:border-navy-700 rounded-2xl text-slate-500 text-sm">
                        No top performer data available.
                      </div>
                    ) : (
                      <div className="bg-white dark:bg-navy-800 rounded-2xl border border-slate-200 dark:border-navy-700 overflow-hidden">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 dark:bg-navy-950 border-b border-slate-200 dark:border-navy-700 text-[11px] uppercase tracking-wider text-slate-500 font-bold">
                              <th className="py-2.5 px-2 sm:px-3 w-10 sm:w-14 text-center">Rank</th>
                              <th className="py-2.5 px-2 sm:px-3">Student</th>
                              <th className="py-2.5 px-2.5 sm:px-3 text-right">Problems Solved</th>
                              <th className="py-2.5 px-3 text-right hidden sm:table-cell">Last Active</th>
                            </tr>
                          </thead>
                          <tbody className="text-sm divide-y divide-slate-100 dark:divide-navy-800">
                            {details.top_performers.map(p => (
                              <tr key={p.student_id} className="hover:bg-slate-50 dark:hover:bg-navy-700/50 transition">
                                <td className="py-2.5 px-2 sm:px-3 font-mono font-black text-slate-400 dark:text-slate-500 text-center text-xs sm:text-sm">
                                  #{p.rank}
                                </td>
                                <td className="py-2.5 px-2 sm:px-3 min-w-0">
                                  <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                                    {p.name}
                                  </div>
                                  <div className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1.5 flex-wrap">
                                    <span>{p.register_number}</span>
                                    <span className="sm:hidden text-slate-400">
                                      • {p.last_active ? new Date(p.last_active).toLocaleDateString() : 'N/A'}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-2.5 px-2.5 sm:px-3 font-mono font-black text-xs sm:text-sm text-brand-600 dark:text-brand-400 text-right whitespace-nowrap">
                                  {p.total_solved}
                                </td>
                                <td className="py-2.5 px-3 text-[11px] text-slate-500 text-right whitespace-nowrap hidden sm:table-cell">
                                  {p.last_active ? new Date(p.last_active).toLocaleDateString() : 'N/A'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* 3. AT-RISK STUDENTS TAB */}
                {activeTab === 'risk' && (
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                      <AlertCircle size={16} className="text-rose-500" />
                      At-Risk / Intervention Required
                    </h3>
                    
                    {details.at_risk_students.length === 0 ? (
                      <div className="p-6 text-center border-2 border-dashed border-slate-200 dark:border-navy-700 rounded-2xl text-slate-500 text-sm">
                        No high-risk students detected.
                      </div>
                    ) : (
                      <>
                        {/* Mobile Cards View (Zero Horizontal Scroll) */}
                        <div className="sm:hidden space-y-2.5">
                          {details.at_risk_students.map(r => (
                            <div key={r.student_id} className="p-3.5 rounded-2xl bg-slate-50/90 dark:bg-navy-900/90 border border-slate-200 dark:border-navy-700 space-y-2 transition-all active:scale-[0.98] touch-manipulation">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                                    {r.name}
                                  </div>
                                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                                    {r.register_number}
                                  </div>
                                </div>
                                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider shrink-0 ${
                                  r.risk_level === 'CRITICAL' ? 'bg-rose-100 text-rose-800 border border-rose-200 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800' : 'bg-orange-100 text-orange-800 border border-orange-200 dark:bg-orange-950/70 dark:text-orange-300 dark:border-orange-800'
                                }`}>
                                  {r.risk_level}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-100 dark:border-navy-800/80">
                                <span className="text-[11px] text-slate-500">Solved:</span>
                                <span className="font-mono font-black text-slate-800 dark:text-slate-200">{r.total_solved}</span>
                              </div>
                              {r.explanation && (
                                <p className="text-[11px] text-slate-600 dark:text-slate-400 bg-white dark:bg-navy-950 p-2.5 rounded-xl border border-slate-100 dark:border-navy-800/80 leading-relaxed">
                                  {r.explanation}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Desktop / Tablet Table (Full Width) */}
                        <div className="hidden sm:block bg-white dark:bg-navy-800 rounded-2xl border border-slate-200 dark:border-navy-700 overflow-hidden">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-50 dark:bg-navy-950 border-b border-slate-200 dark:border-navy-700 text-[11px] uppercase tracking-wider text-slate-500 font-bold">
                                <th className="p-3">Student</th>
                                <th className="p-3">Risk Level</th>
                                <th className="p-3 text-center">Problems Solved</th>
                                <th className="p-3">Explanation</th>
                              </tr>
                            </thead>
                            <tbody className="text-sm divide-y divide-slate-100 dark:divide-navy-800">
                              {details.at_risk_students.map(r => (
                                <tr key={r.student_id} className="hover:bg-slate-50 dark:hover:bg-navy-700/50 transition">
                                  <td className="p-3 min-w-[140px]">
                                    <div className="font-bold text-slate-900 dark:text-white">{r.name}</div>
                                    <div className="text-[11px] text-slate-500 font-mono">{r.register_number}</div>
                                  </td>
                                  <td className="p-3">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                                      r.risk_level === 'CRITICAL' ? 'bg-rose-100 text-rose-800 border border-rose-200 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800' : 'bg-orange-100 text-orange-800 border border-orange-200 dark:bg-orange-950/70 dark:text-orange-300 dark:border-orange-800'
                                    }`}>
                                      {r.risk_level}
                                    </span>
                                  </td>
                                  <td className="p-3 font-mono font-bold text-slate-700 dark:text-slate-300 text-center">
                                    {r.total_solved}
                                  </td>
                                  <td className="p-3 text-[11px] text-slate-500 leading-tight">
                                    {r.explanation || 'No clear signals available.'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </>
            ) : null}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
};
