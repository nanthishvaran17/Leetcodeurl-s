import React from 'react';
import { StaffRecord, StudentRecord } from '../../services/commandCenterService';
import { Users, X, Code, CheckCircle, Clock, Calendar, Mail, Briefcase, Activity } from 'lucide-react';

interface StaffDetailDrawerProps {
  staff: StaffRecord | null;
  studentList: StudentRecord[];
  onClose: () => void;
  onManageAllocation: () => void;
}

export const StaffDetailDrawer: React.FC<StaffDetailDrawerProps> = ({ staff, studentList, onClose, onManageAllocation }) => {
  if (!staff) return null;

  const assignedStudents = studentList.filter(s => s.assigned_faculty_id === staff.id);
  const completionRate = staff.assigned_count > 0 
    ? Math.round(((staff.active_count || 0) / staff.assigned_count) * 100) 
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-none animate-fade-in" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg h-full bg-white dark:bg-navy-900 border-l border-slate-200 dark:border-navy-700 shadow-2xl p-0 overflow-y-auto flex flex-col">
        {/* Header Profile Section */}
        <div className="bg-brand-50 dark:bg-navy-800 p-6 border-b border-slate-200 dark:border-navy-700">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white dark:bg-navy-900 text-brand-600 dark:text-brand-300 font-extrabold flex items-center justify-center text-2xl shadow-sm border border-slate-100 dark:border-navy-700">
                {staff.username ? staff.username.charAt(0).toUpperCase() : 'S'}
              </div>
              <div>
                <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                  {staff.username}
                </h3>
                <p className="text-xs text-slate-500 font-mono flex items-center gap-1 mt-1">
                  <Mail size={12} /> {staff.email}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="px-2 py-0.5 rounded bg-brand-100 dark:bg-brand-900 text-brand-700 font-mono text-[10px] font-bold">
                    {staff.department_code || 'N/A'}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-navy-700 text-slate-700 dark:text-slate-300 font-mono text-[10px] font-bold">
                    {staff.role || 'Faculty'}
                  </span>
                  {staff.is_active ? (
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-bold">Active</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-700 text-[10px] font-bold">Inactive</span>
                  )}
                </div>
              </div>
            </div>
            <button onClick={onClose} className="p-2 bg-white dark:bg-navy-900 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 shadow-sm transition">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-8 flex-1 overflow-y-auto">
          {/* Mentorship Performance */}
          <div className="space-y-3">
            <h4 className="font-display text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider font-mono flex items-center gap-2">
              <Users size={14} className="text-brand-500" /> Mentorship Workload
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 dark:bg-navy-800/50 p-4 rounded-xl border border-slate-100 dark:border-navy-700">
                <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">Assigned Capacity</div>
                <div className="text-xl font-black text-slate-900 dark:text-white font-mono">
                  {staff.assigned_count} <span className="text-sm text-slate-400">/ {staff.max_allowed || 30}</span>
                </div>
                <div className="mt-2 text-[10px] font-bold">
                  {staff.assigned_count >= (staff.max_allowed || 30) ? (
                    <span className="text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">MAX CAPACITY</span>
                  ) : staff.assigned_count >= 20 ? (
                    <span className="text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">HIGH WORKLOAD</span>
                  ) : (
                    <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">WITHIN CAPACITY</span>
                  )}
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-navy-800/50 p-4 rounded-xl border border-slate-100 dark:border-navy-700">
                <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">Solver Conversion</div>
                <div className="flex items-end gap-2">
                  <div className="text-xl font-black text-emerald-600 font-mono">
                    {staff.active_count || 0}
                  </div>
                  <div className="text-xs text-slate-500 font-mono mb-1">active mentees</div>
                </div>
                <div className="mt-2 w-full h-1.5 rounded-full bg-slate-200 dark:bg-navy-700 overflow-hidden">
                  <div className={`h-full rounded-full ${completionRate >= 80 ? 'bg-emerald-500' : completionRate >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${completionRate}%` }} />
                </div>
                <div className="text-[10px] text-slate-400 mt-1 font-mono font-bold text-right">{completionRate}% completion rate</div>
              </div>
            </div>
          </div>

          {/* Coding Performance */}
          <div className="space-y-3">
            <h4 className="font-display text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider font-mono flex items-center gap-2">
              <Code size={14} className="text-brand-500" /> Mentee Coding Activity
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-navy-800">
                <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-500 flex items-center justify-center shrink-0">
                  <Activity size={18} />
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Problems Solved</div>
                  <div className="text-lg font-black text-slate-900 dark:text-white font-mono">{staff.coding_activity || 0}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-navy-800">
                <div className="w-10 h-10 rounded-full bg-purple-50 dark:bg-purple-900/20 text-purple-500 flex items-center justify-center shrink-0">
                  <Clock size={18} />
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Last Active</div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white font-mono">{staff.last_active || 'N/A'}</div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2 px-3">
               <Calendar size={12} className="text-slate-400" />
               <span className="text-[10px] text-slate-400 font-mono">Joined Date: <span className="font-bold text-slate-600 dark:text-slate-300">{staff.joined_date || 'N/A'}</span></span>
            </div>
          </div>

          {/* Assigned Students */}
          <div className="space-y-3">
            <h4 className="font-display text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider font-mono flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Briefcase size={14} className="text-brand-500" /> 
                Assigned Students ({assignedStudents.length})
              </div>
            </h4>
            <div className="rounded-xl border border-slate-100 dark:border-navy-800 overflow-hidden bg-slate-50/50 dark:bg-navy-900/50">
              {assignedStudents.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs font-mono">No students assigned to this mentor.</div>
              ) : (
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-navy-800 text-[10px] font-bold text-slate-500 font-mono sticky top-0">
                      <tr>
                        <th className="py-2 px-3">Student</th>
                        <th className="py-2 px-3 text-right">Solved</th>
                        <th className="py-2 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-navy-800 font-mono">
                      {assignedStudents.map(s => (
                        <tr key={s.id} className="hover:bg-white dark:hover:bg-navy-800 transition">
                          <td className="py-2 px-3">
                            <div className="font-bold text-slate-900 dark:text-white text-[11px]">{s.name}</div>
                            <div className="text-[9px] text-slate-400">{s.reg_no}</div>
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-slate-700 dark:text-slate-300">
                            {s.total_solved}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {s.status === 'ACTIVE' ? (
                              <CheckCircle size={14} className="text-emerald-500 mx-auto" />
                            ) : (
                              <div className="w-2 h-2 rounded-full bg-slate-300 mx-auto" />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900 flex justify-end gap-3">
          <button 
            onClick={onManageAllocation}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
          >
            Manage Allocation
          </button>
        </div>
      </div>
    </div>
  );
};
