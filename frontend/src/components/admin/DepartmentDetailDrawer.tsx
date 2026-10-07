import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Building2, Users, Activity, TrendingUp, TrendingDown, Minus,
  AlertCircle, CheckCircle, Code, Info, Mail
} from 'lucide-react';
import { getDepartmentIntelligenceDetails, DepartmentIntelligenceDetails, DeptBenchmark } from '../../services/commandCenterService';

interface DepartmentDetailDrawerProps {
  department: DeptBenchmark | null;
  onClose: () => void;
}

export const DepartmentDetailDrawer: React.FC<DepartmentDetailDrawerProps> = ({ department, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState<DepartmentIntelligenceDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  if (!department) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex justify-end">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          onClick={onClose}
        />
        
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="relative w-full max-w-2xl bg-white dark:bg-navy-950 h-full shadow-2xl flex flex-col border-l border-slate-200 dark:border-navy-700"
        >
          {/* Header */}
          <div className="relative p-6 border-b border-indigo-200/50 dark:border-indigo-900/50 flex items-start justify-between bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-navy-900 dark:via-navy-950 dark:to-indigo-950 overflow-hidden">
            {/* Background elements */}
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-10 left-10 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex items-start gap-4 relative z-10 w-full pr-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
                <Building2 size={28} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-display font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-700 to-purple-700 dark:from-indigo-300 dark:to-purple-300">
                    {department.department_name}
                  </h2>
                  <span className="px-2.5 py-1 text-[10px] font-black font-mono rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/50 shadow-sm shrink-0">
                    {department.department_code}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 mt-2 text-sm">
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
              className="p-2 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-white dark:hover:bg-navy-800 transition-all hover:shadow-sm border border-transparent hover:border-slate-200 relative z-10 shrink-0"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8 stylish-scrollbar">
            {/* KPI Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 shadow-sm">
                <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Users size={14} /> Total Roster
                </div>
                <div className="text-2xl font-display font-bold text-slate-900 dark:text-white">
                  {department.student_count}
                </div>
                <div className="text-xs text-slate-500 mt-1 font-mono">
                  {department.active_count} active
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 shadow-sm">
                <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Activity size={14} /> Engagement
                </div>
                <div className="text-2xl font-display font-bold text-slate-900 dark:text-white">
                  {department.coding_engagement || 'N/A'}
                </div>
                <div className="w-full bg-slate-100 dark:bg-navy-950 rounded-full h-1.5 mt-2">
                  <div className="bg-brand-500 h-1.5 rounded-full" style={{ width: `${department.active_score || 0}%` }} />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 shadow-sm">
                <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Code size={14} /> Avg Solved
                </div>
                <div className="text-2xl font-display font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  {department.avg_solved}
                  {department.performance_trend === '↑' && <TrendingUp size={16} className="text-emerald-500" />}
                  {department.performance_trend === '↓' && <TrendingDown size={16} className="text-rose-500" />}
                  {department.performance_trend === '→' && <Minus size={16} className="text-slate-400" />}
                </div>
                <div className="text-xs text-emerald-600 font-bold mt-1">
                  {department.growth_rate_pct}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 shadow-sm">
                <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <CheckCircle size={14} /> Completion
                </div>
                <div className="text-2xl font-display font-bold text-slate-900 dark:text-white">
                  {department.completion_rate}%
                </div>
                <div className="w-full bg-slate-100 dark:bg-navy-950 rounded-full h-1.5 mt-2">
                  <div className="bg-brand-500 h-1.5 rounded-full" style={{ width: `${department.completion_rate || 0}%` }} />
                </div>
              </div>
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
                {/* Top Performers */}
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
                            <th className="p-3">Rank</th>
                            <th className="p-3">Student</th>
                            <th className="p-3">Problems Solved</th>
                            <th className="p-3">Last Active</th>
                          </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-slate-100 dark:divide-navy-800">
                          {details.top_performers.map(p => (
                            <tr key={p.student_id} className="hover:bg-slate-50 dark:hover:bg-navy-700/50 transition">
                              <td className="p-3 font-mono font-bold text-slate-400">#{p.rank}</td>
                              <td className="p-3">
                                <div className="font-bold text-slate-900 dark:text-white">{p.name}</div>
                                <div className="text-[11px] text-slate-500 font-mono">{p.register_number}</div>
                              </td>
                              <td className="p-3 font-mono font-bold text-brand-600">{p.total_solved}</td>
                              <td className="p-3 text-[11px] text-slate-500">
                                {p.last_active ? new Date(p.last_active).toLocaleDateString() : 'N/A'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* At-Risk Students */}
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
                    <div className="bg-white dark:bg-navy-800 rounded-2xl border border-slate-200 dark:border-navy-700 overflow-hidden">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-navy-950 border-b border-slate-200 dark:border-navy-700 text-[11px] uppercase tracking-wider text-slate-500 font-bold">
                            <th className="p-3">Student</th>
                            <th className="p-3">Risk Level</th>
                            <th className="p-3">Problems Solved</th>
                            <th className="p-3">Explanation</th>
                          </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-slate-100 dark:divide-navy-800">
                          {details.at_risk_students.map(r => (
                            <tr key={r.student_id} className="hover:bg-slate-50 dark:hover:bg-navy-700/50 transition">
                              <td className="p-3 min-w-[150px]">
                                <div className="font-bold text-slate-900 dark:text-white">{r.name}</div>
                                <div className="text-[11px] text-slate-500 font-mono">{r.register_number}</div>
                              </td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                                  r.risk_level === 'CRITICAL' ? 'bg-rose-100 text-rose-800 border border-rose-200' : 'bg-orange-100 text-orange-800 border border-orange-200'
                                }`}>
                                  {r.risk_level}
                                </span>
                              </td>
                              <td className="p-3 font-mono font-bold text-slate-700 dark:text-slate-300">
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
                  )}
                </div>
              </>
            ) : null}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
