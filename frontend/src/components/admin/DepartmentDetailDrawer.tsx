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
          <div className="p-6 border-b border-slate-100 dark:border-navy-800 flex items-center justify-between bg-slate-50/50 dark:bg-navy-800/50">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 flex items-center justify-center">
                <Building2 size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-display font-bold text-slate-900 dark:text-white">
                    {department.department_name}
                  </h2>
                  <span className="px-2 py-0.5 text-xs font-bold font-mono rounded bg-slate-200 text-slate-700 dark:bg-navy-700 dark:text-slate-300">
                    {department.department_code}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1.5 text-sm">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                    department.health_status === 'Excellent' ? 'bg-emerald-100 text-emerald-800' :
                    department.health_status === 'Healthy' ? 'bg-brand-100 text-brand-800' :
                    department.health_status === 'Needs Attention' ? 'bg-amber-100 text-amber-800' :
                    'bg-rose-100 text-rose-800'
                  }`}>
                    {department.health_status}
                  </span>
                  <span className="text-slate-500 font-medium text-xs">
                    Rank #{department.rank} Institutionally
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 transition"
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
