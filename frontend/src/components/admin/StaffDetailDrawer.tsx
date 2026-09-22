import React, { useState, useEffect } from 'react';
import { StaffRecord, StudentRecord, getCommandCenterStudents } from '../../services/commandCenterService';
import { Users, X, Code, CheckCircle, Clock, Calendar, Mail, Briefcase, Activity, ExternalLink, RefreshCw } from 'lucide-react';

interface StaffDetailDrawerProps {
  staff: StaffRecord | null;
  studentList: StudentRecord[];
  onClose: () => void;
  onManageAllocation: () => void;
  onSelectStudent?: (student: StudentRecord) => void;
}

export const StaffDetailDrawer: React.FC<StaffDetailDrawerProps> = ({ 
  staff, 
  studentList, 
  onClose, 
  onManageAllocation,
  onSelectStudent
}) => {
  if (!staff) return null;

  const [mentees, setMentees] = useState<StudentRecord[]>([]);
  const [loadingMentees, setLoadingMentees] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    async function loadStaffMentees() {
      if (!staff) return;
      setLoadingMentees(true);
      try {
        const res = await getCommandCenterStudents({
          staff_id: staff.id,
          page_size: 100,
          include_inactive: true
        });
        if (isMounted && res.students) {
          setMentees(res.students);
        }
      } catch (err) {
        console.error('Failed to load staff mentees:', err);
        // Fallback to studentList filtered by staff.id
        if (isMounted) {
          const fallback = studentList.filter(s => s.assigned_faculty_id === staff.id);
          setMentees(fallback);
        }
      } finally {
        if (isMounted) setLoadingMentees(false);
      }
    }

    loadStaffMentees();
    return () => { isMounted = false; };
  }, [staff?.id, studentList]);

  const assignedCount = staff.assigned_count || mentees.length;
  const activeCount = staff.active_count ?? mentees.filter(m => (m.total_solved || 0) > 0 || m.is_active).length;
  const completionRate = assignedCount > 0 
    ? Math.round((activeCount / assignedCount) * 100) 
    : 0;

  const totalProblemsSolved = mentees.reduce((acc, m) => acc + (m.total_solved || 0), 0) || staff.coding_activity || 0;
  const targetCompletedCount = mentees.filter(m => (m.total_solved || 0) >= 10).length;

  return (
    <div className="fixed inset-0 z-[100050] flex justify-end bg-slate-950/85 dark:bg-black/85 backdrop-blur-md animate-fade-in" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-xl h-full bg-white dark:bg-navy-950 border-l border-slate-200 dark:border-navy-700 shadow-2xl p-0 overflow-y-auto flex flex-col rounded-l-3xl">
        {/* Header Profile Section */}
        <div className="bg-gradient-to-r from-brand-900 via-navy-900 to-slate-900 p-6 sm:p-7 text-white border-b border-brand-800/50 relative overflow-hidden rounded-tl-3xl">
          <div className="absolute right-0 top-0 w-64 h-64 bg-brand-500/10 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-3xl bg-white/10 backdrop-blur-md text-brand-300 font-extrabold flex items-center justify-center text-2xl shadow-lg border border-white/20 shrink-0">
                {staff.username ? staff.username.charAt(0).toUpperCase() : 'S'}
              </div>
              <div>
                <h3 className="font-display text-xl font-bold text-white tracking-tight flex items-center gap-2">
                  <span>{staff.username}</span>
                  <span className="px-3 py-1 rounded-full bg-brand-500/30 text-brand-200 text-[10px] font-extrabold border border-brand-400/30 uppercase">
                    {staff.department_code || 'FACULTY'}
                  </span>
                </h3>
                <p className="text-xs text-slate-300 font-medium flex items-center gap-1 mt-1">
                  <Mail size={13} className="text-brand-400" /> {staff.email}
                </p>
                <div className="flex items-center gap-2 mt-2.5">
                  <span className="px-3 py-1 rounded-full bg-white/10 text-slate-200 text-[10px] font-bold border border-white/10">
                    {staff.role || 'Faculty Mentor'}
                  </span>
                  {staff.is_active ? (
                    <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Active Status
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-bold">
                      Inactive
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="p-2.5 bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white rounded-2xl backdrop-blur-md transition cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6 flex-1 overflow-y-auto bg-slate-50/50 dark:bg-navy-950">
          {/* Mentorship Workload & Solver Metrics */}
          <div className="space-y-3">
            <h4 className="font-display text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Users size={15} className="text-brand-500" /> Mentorship Performance Summary
              </span>
              <span className="text-[11px] text-slate-500 font-semibold">
                Scope: {staff.department_code || 'Dept'}
              </span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Assigned Capacity */}
              <div className="bg-white dark:bg-navy-900 p-4 rounded-2xl border border-slate-200 dark:border-navy-800 shadow-sm">
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mb-1">Assigned Capacity</div>
                <div className="text-xl font-black text-slate-900 dark:text-white">
                  {assignedCount} <span className="text-xs text-slate-400 font-normal">/ {staff.max_allowed || 30}</span>
                </div>
                <div className="mt-2 text-[10px] font-bold">
                  {assignedCount >= (staff.max_allowed || 30) ? (
                    <span className="text-purple-700 bg-purple-100 dark:bg-purple-950 dark:text-purple-300 px-2.5 py-1 rounded-full border border-purple-300">MAX CAPACITY</span>
                  ) : assignedCount >= 20 ? (
                    <span className="text-emerald-700 bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300 px-2.5 py-1 rounded-full border border-emerald-300">TARGET REACHED</span>
                  ) : (
                    <span className="text-blue-700 bg-blue-100 dark:bg-blue-950 dark:text-blue-300 px-2.5 py-1 rounded-full border border-blue-300">WITHIN CAPACITY</span>
                  )}
                </div>
              </div>

              {/* Active Solvers */}
              <div className="bg-white dark:bg-navy-900 p-4 rounded-2xl border border-slate-200 dark:border-navy-800 shadow-sm">
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mb-1">Active Solvers</div>
                <div className="flex items-baseline gap-1">
                  <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                    {activeCount}
                  </div>
                  <div className="text-[11px] text-slate-500">/ {assignedCount} mentees</div>
                </div>
                <div className="mt-2 w-full h-2 rounded-full bg-slate-100 dark:bg-navy-800 overflow-hidden border border-slate-200 dark:border-navy-700">
                  <div className={`h-full rounded-full transition-all duration-500 ${completionRate >= 80 ? 'bg-emerald-500' : completionRate >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${completionRate}%` }} />
                </div>
                <div className="text-[10px] text-slate-700 dark:text-slate-300 mt-1 font-bold text-right">{completionRate}% active conversion</div>
              </div>

              {/* Problems Solved */}
              <div className="bg-white dark:bg-navy-900 p-4 rounded-2xl border border-slate-200 dark:border-navy-800 shadow-sm">
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mb-1">Total Solved</div>
                <div className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Activity size={16} className="text-brand-500" />
                  <span>{totalProblemsSolved}</span>
                </div>
                <div className="mt-2 text-[10px] text-slate-600 dark:text-slate-400 font-bold">
                  {targetCompletedCount} mentees with 10+ solves
                </div>
              </div>
            </div>
          </div>

          {/* Mentee Activity Summary */}
          <div className="space-y-3">
            <h4 className="font-display text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Code size={15} className="text-brand-500" /> Activity & Verification Meta
            </h4>
            <div className="grid grid-cols-2 gap-3 bg-white dark:bg-navy-900 p-4 rounded-2xl border border-slate-200 dark:border-navy-800 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-300 flex items-center justify-center shrink-0 border border-purple-200 dark:border-purple-800">
                  <Clock size={16} />
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase">Staff Last Active</div>
                  <div className="text-xs font-extrabold text-slate-900 dark:text-white">{staff.last_active || 'N/A'}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-300 flex items-center justify-center shrink-0 border border-amber-200 dark:border-amber-800">
                  <Calendar size={16} />
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase">Account Created</div>
                  <div className="text-xs font-extrabold text-slate-900 dark:text-white">{staff.joined_date || 'N/A'}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Assigned Students Detailed List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-display text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Briefcase size={15} className="text-brand-500" /> 
                Assigned Mentees Directory ({mentees.length})
              </h4>
              {loadingMentees && (
                <span className="text-[10px] text-brand-600 font-bold flex items-center gap-1 animate-pulse">
                  <RefreshCw size={11} className="animate-spin" /> Loading mentees...
                </span>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-navy-800 overflow-hidden bg-white dark:bg-navy-900 shadow-sm">
              {mentees.length === 0 ? (
                <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-xs font-semibold">
                  {loadingMentees ? 'Fetching assigned mentees data...' : 'No students assigned to this faculty mentor yet.'}
                </div>
              ) : (
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 dark:bg-navy-800 text-[10px] font-bold text-slate-700 dark:text-slate-300 sticky top-0 border-b border-slate-200 dark:border-navy-700">
                      <tr>
                        <th className="py-2.5 px-3">Student Info</th>
                        <th className="py-2.5 px-3 text-center">Year / Sec</th>
                        <th className="py-2.5 px-3 text-right">Solved</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                        {onSelectStudent && <th className="py-2.5 px-3 text-center">Action</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
                      {mentees.map(s => {
                        const isStudentActive = (s.total_solved || 0) > 0 || s.is_active || s.status === 'ACTIVE';
                        return (
                          <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-navy-800/80 transition">
                            <td className="py-2.5 px-3">
                              <div className="font-extrabold text-slate-900 dark:text-white text-xs">{s.name}</div>
                              <div className="text-[10px] text-amber-700 dark:text-amber-400 font-bold">{s.reg_no}</div>
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold text-slate-700 dark:text-slate-300 text-[11px]">
                              {s.year_level || 'Yr-N/A'} {s.department_code ? `(${s.department_code})` : ''}
                            </td>
                            <td className="py-2.5 px-3 text-right font-extrabold text-slate-900 dark:text-white text-xs">
                              {s.total_solved || 0}
                              {s.easy_solved !== undefined && (
                                <div className="text-[9px] text-slate-500 font-normal">
                                  {s.easy_solved}E / {s.medium_solved || 0}M / {s.hard_solved || 0}H
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {isStudentActive ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[10px] font-extrabold border border-emerald-300 dark:border-emerald-800">
                                  <CheckCircle size={11} className="text-emerald-600 dark:text-emerald-400" /> Active
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold border border-slate-300 dark:border-navy-700">
                                  Inactive
                                </span>
                              )}
                            </td>
                            {onSelectStudent && (
                              <td className="py-2.5 px-3 text-center">
                                <button
                                  onClick={() => onSelectStudent(s)}
                                  className="px-2.5 py-1 rounded-full bg-brand-50 hover:bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-300 font-bold text-[10px] transition cursor-pointer border border-brand-200"
                                >
                                  Inspect →
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 dark:border-navy-700 bg-slate-100 dark:bg-navy-950 flex justify-between items-center">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 dark:bg-navy-800 hover:bg-slate-300 dark:hover:bg-navy-700 text-slate-800 dark:text-slate-200 rounded-2xl text-xs font-bold transition cursor-pointer"
          >
            Close Drawer
          </button>
          <button 
            onClick={onManageAllocation}
            className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl text-xs font-extrabold transition shadow-md shadow-brand-600/20 cursor-pointer flex items-center gap-1.5"
          >
            <Users size={14} />
            <span>Manage Allocation</span>
          </button>
        </div>
      </div>
    </div>
  );
};

