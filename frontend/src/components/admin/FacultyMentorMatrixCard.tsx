import React from 'react';
import { Users, RotateCcw, Eye } from 'lucide-react';

interface FacultyMentorMatrixCardProps {
  staffList: any[];
  staffWorkloadFilter: 'COMPLETED' | 'ALL' | 'PENDING' | string;
  setStaffWorkloadFilter: (filter: any) => void;
  setShowStaffAllocationModal: (show: boolean) => void;
  selectedStaff: string;
  handleFilterByStaff: (id: number, username: string) => void;
  setSelectedStaffDetail: (staff: any) => void;
  handleUnassignAllForStaff: (id: number, username: string) => void;
  getDeptBadgeStyle: (deptCode: string) => string;
}

export const FacultyMentorMatrixCard: React.FC<FacultyMentorMatrixCardProps> = ({
  staffList,
  staffWorkloadFilter,
  setStaffWorkloadFilter,
  setShowStaffAllocationModal,
  selectedStaff,
  handleFilterByStaff,
  setSelectedStaffDetail,
  handleUnassignAllForStaff,
  getDeptBadgeStyle,
}) => {
  return (
    <div
      id="staff-performance-section"
      className="p-5 space-y-3.5 scroll-mt-20 my-6 rounded-2xl bg-white dark:bg-navy-950 border-2 border-slate-200/80 dark:border-navy-700 shadow-md hover:shadow-lg transition-all"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100 dark:border-navy-800">
        <div>
          <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Users size={16} className="text-brand-500" />
            <span>Faculty Mentors Performance & Progress Matrix</span>
            {staffWorkloadFilter !== 'ALL' && (
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  staffWorkloadFilter === 'COMPLETED'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                }`}
              >
                Showing: {staffWorkloadFilter === 'COMPLETED' ? 'Target Achieved (20+)' : 'Pending Target (<20)'}
              </span>
            )}
          </h3>
          <p className="text-xs text-slate-700 dark:text-slate-400">
            Track mentorship workload, active solver rates, and student completion across staff members
          </p>
        </div>
        <div className="flex items-center gap-2">
          {staffWorkloadFilter !== 'ALL' && (
            <button
              onClick={() => setStaffWorkloadFilter('ALL')}
              className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-navy-800 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1 transition cursor-pointer"
            >
              <RotateCcw size={11} />
              <span>Show All Staff</span>
            </button>
          )}
          <button
            onClick={() => setShowStaffAllocationModal(true)}
            className="px-3 py-1.5 rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-600 font-bold text-xs flex items-center gap-1 transition cursor-pointer"
          >
            <Users size={13} />
            <span>Manage Allocation</span>
          </button>
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse block md:table">
          <thead className="hidden md:table-header-group">
            <tr className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100 bg-slate-100/90 dark:bg-navy-900 border-b border-slate-300 dark:border-navy-700">
              <th className="py-2.5 px-3">Faculty Mentor</th>
              <th className="py-2.5 px-3">Dept</th>
              <th className="py-2.5 px-3 text-right">Assigned Mentees</th>
              <th className="py-2.5 px-3 text-right">Active Solvers</th>
              <th className="py-2.5 px-3 text-center">Sunday Contest</th>
              <th className="py-2.5 px-3 text-right">Completion Rate</th>
              <th className="py-2.5 px-3 text-center">Workload Status</th>
              <th className="py-2.5 px-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="block md:table-row-group divide-y-0 md:divide-y divide-slate-100 dark:divide-navy-800 font-mono">
            {(() => {
              const displayedStaff = staffList.filter((s) => {
                if (staffWorkloadFilter === 'COMPLETED') return (s.assigned_count || 0) >= 20;
                if (staffWorkloadFilter === 'PENDING') return (s.assigned_count || 0) < 20;
                return true;
              });

              if (displayedStaff.length === 0) {
                return (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-700 dark:text-slate-400 font-bold">
                      No staff members match the "{staffWorkloadFilter}" workload filter.
                    </td>
                  </tr>
                );
              }

              return displayedStaff.map((s) => {
                const assigned = s.assigned_count || 0;
                const maxAllowed = s.max_allowed || 30;
                const active = (s as any).active_count || 0;
                const completionRate = assigned > 0 ? Math.round((active / assigned) * 100) : 0;
                const isSelected = selectedStaff === String(s.id);
                const deptCode = (s as any).department_code || 'DEPT';
                const deptBadge = getDeptBadgeStyle(deptCode);

                return (
                  <tr
                    key={s.id}
                    onClick={() => handleFilterByStaff(s.id, s.username)}
                    className={`block md:table-row hover:bg-brand-50/70 dark:hover:bg-navy-800 cursor-pointer transition-colors bg-white dark:bg-navy-950 mb-4 md:mb-0 p-4 md:p-0 rounded-xl shadow-sm md:shadow-none border border-slate-200 dark:border-none ${
                      isSelected
                        ? 'md:bg-brand-50/90 dark:md:bg-navy-800 font-bold ring-2 md:ring-0 ring-brand-500'
                        : ''
                    }`}
                  >
                    {/* Faculty Mentor Info */}
                    <td className="flex items-center gap-3 pb-3 md:pb-0 md:py-3 md:px-3 font-bold text-slate-900 dark:text-white font-sans border-b border-slate-100 dark:border-navy-800 md:border-none md:table-cell">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 font-black flex items-center justify-center text-xs border border-brand-300 dark:border-brand-800 shadow-sm shrink-0">
                          {s.username ? s.username.charAt(0).toUpperCase() : 'S'}
                        </div>
                        <div>
                          <div className="font-extrabold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                            <span>{s.username}</span>
                            {isSelected && (
                              <span className="px-1.5 py-0.5 rounded-full bg-emerald-500 text-white text-[9px] font-black uppercase tracking-wider shadow-xs">
                                Active Scope
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-600 font-mono font-medium">{s.email}</div>
                        </div>
                      </div>
                    </td>

                    {/* Department Badge */}
                    <td className="flex items-center justify-between py-2.5 md:py-3 md:px-3 border-b border-slate-50 dark:border-navy-800/50 md:border-none md:table-cell">
                      <span className="md:hidden text-xs font-bold text-slate-700 dark:text-slate-400 uppercase tracking-wider">
                        Dept
                      </span>
                      <div className="text-right md:text-left">
                        <span className={`px-2.5 py-0.5 rounded font-mono text-xs font-extrabold inline-block border shadow-xs ${deptBadge}`}>
                          {deptCode}
                        </span>
                      </div>
                    </td>

                    {/* Assigned Mentees */}
                    <td className="flex items-center justify-between py-2.5 md:py-3 md:px-3 text-right font-mono border-b border-slate-50 dark:border-navy-800/50 md:border-none md:table-cell">
                      <span className="md:hidden text-xs font-bold text-slate-700 dark:text-slate-400 uppercase tracking-wider">
                        Assigned Mentees
                      </span>
                      <div>
                        <span className="font-black text-slate-900 dark:text-white text-xs">{assigned}</span>
                        <span className="text-xs text-slate-700 dark:text-slate-400 font-bold"> / {maxAllowed}</span>
                      </div>
                    </td>

                    {/* Active Solvers */}
                    <td className="flex items-center justify-between py-2.5 md:py-3 md:px-3 text-right font-mono border-b border-slate-50 dark:border-navy-800/50 md:border-none md:table-cell">
                      <span className="md:hidden text-xs font-bold text-slate-700 dark:text-slate-400 uppercase tracking-wider">
                        Active Solvers
                      </span>
                      <div>
                        {active > 0 ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-extrabold text-xs inline-flex items-center gap-1 border border-emerald-300 dark:border-emerald-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            {active} active
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-navy-800 text-slate-600 font-bold text-xs inline-flex items-center gap-1 border border-slate-200 dark:border-navy-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                            0 active
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Sunday Contest Attendance */}
                    <td className="flex items-center justify-between py-2.5 md:py-3 md:px-3 text-center font-mono border-b border-slate-50 dark:border-navy-800/50 md:border-none md:table-cell">
                      <span className="md:hidden text-xs font-bold text-slate-700 dark:text-slate-400 uppercase tracking-wider">
                        Sunday Contest
                      </span>
                      <div>
                        {assigned > 0 ? (
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-extrabold inline-flex items-center gap-1 border ${
                              (s.sunday_contest_turnout_pct || 0) >= 80
                                ? 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300'
                                : (s.sunday_contest_turnout_pct || 0) >= 50
                                ? 'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950 dark:text-indigo-300'
                                : (s.sunday_contest_attended || 0) > 0
                                ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300'
                                : 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-navy-800 dark:text-slate-400'
                            }`}
                            title={`${s.sunday_contest_session_name || 'Sunday Contest'}: ${s.sunday_contest_attended || 0} of ${assigned} attended`}
                          >
                            <span>
                              {s.sunday_contest_attended ?? 0} / {assigned}
                            </span>
                            <span className="text-[10px] opacity-75">
                              ({s.sunday_contest_turnout_pct ?? 0}%)
                            </span>
                          </span>
                        ) : (
                          <span className="text-slate-400 font-bold text-xs">—</span>
                        )}
                      </div>
                    </td>

                    {/* Completion Rate */}
                    <td className="flex items-center justify-between py-2.5 md:py-3 md:px-3 text-right font-mono border-b border-slate-50 dark:border-navy-800/50 md:border-none md:table-cell">
                      <span className="md:hidden text-xs font-bold text-slate-700 dark:text-slate-400 uppercase tracking-wider">
                        Completion
                      </span>
                      <div className="flex items-center justify-end gap-2 w-1/2 md:w-auto">
                        <div className="relative w-20 h-2.5 rounded-full bg-slate-100 dark:bg-navy-800 overflow-hidden border border-slate-200 dark:border-navy-700 shadow-inner">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              completionRate >= 80
                                ? 'bg-emerald-500'
                                : completionRate >= 50
                                ? 'bg-amber-500'
                                : completionRate > 0
                                ? 'bg-amber-400'
                                : 'bg-slate-300'
                            }`}
                            style={{ width: `${completionRate}%` }}
                          />
                          {completionRate === 0 && (
                            <span className="absolute left-0.5 top-0.5 w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500" />
                          )}
                        </div>
                        <span
                          className={`font-extrabold text-xs ${
                            completionRate === 0 ? 'text-slate-500 dark:text-slate-400' : 'text-slate-900 dark:text-white'
                          }`}
                        >
                          {completionRate}%
                        </span>
                      </div>
                    </td>

                    {/* Workload Status */}
                    <td className="flex items-center justify-between py-2.5 md:py-3 md:px-3 text-center md:table-cell border-b border-slate-50 dark:border-navy-800/50 md:border-none">
                      <span className="md:hidden text-xs font-bold text-slate-700 dark:text-slate-400 uppercase tracking-wider">
                        Workload
                      </span>
                      <div>
                        <span
                          className={`px-2.5 py-1 rounded-md text-xs font-black border uppercase tracking-tight ${
                            assigned >= 30
                              ? 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950 dark:text-purple-300'
                              : assigned >= 20
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300'
                              : assigned > 0
                              ? 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300'
                              : 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-navy-800'
                          }`}
                        >
                          {assigned >= 30
                            ? 'MAX CAPACITY (30)'
                            : assigned >= 20
                            ? 'TARGET REACHED (20+)'
                            : assigned > 0
                            ? 'WITHIN CAPACITY'
                            : 'UNALLOCATED (0)'}
                        </span>
                      </div>
                    </td>

                    {/* Action Buttons */}
                    <td
                      className="flex items-center justify-between py-2.5 pt-3 md:py-3 md:px-3 text-center md:table-cell"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="md:hidden text-xs font-bold text-slate-700 dark:text-slate-400 uppercase tracking-wider">
                        Actions
                      </span>
                      <div className="flex flex-wrap items-center justify-end md:justify-center gap-2 mt-2 md:mt-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFilterByStaff(s.id, s.username);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer shadow-xs whitespace-nowrap flex items-center gap-1.5 ${
                            isSelected
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30 ring-2 ring-emerald-400'
                              : 'bg-brand-600 hover:bg-brand-700 text-white shadow-brand-600/20'
                          }`}
                          title={
                            isSelected
                              ? 'Currently filtering dashboard by this mentor (Click to reset)'
                              : `Filter entire dashboard to ${s.username}'s mentees`
                          }
                        >
                          <Eye size={12} />
                          <span>{isSelected ? 'Active Scope ✓' : 'View Data'}</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedStaffDetail(s);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-navy-800 dark:hover:bg-navy-700 dark:text-slate-200 text-xs font-extrabold transition cursor-pointer border border-slate-200 dark:border-navy-700 whitespace-nowrap"
                          title="Inspect full profile & performance drawer"
                        >
                          Inspect Details →
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowStaffAllocationModal(true);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-navy-800 dark:hover:bg-navy-700 dark:text-slate-200 text-xs font-extrabold transition cursor-pointer border border-slate-200 dark:border-navy-700 whitespace-nowrap"
                          title="Manage Faculty Allocation"
                        >
                          Reassign ⇄
                        </button>
                        {assigned > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUnassignAllForStaff(s.id, s.username);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 text-xs font-extrabold transition cursor-pointer border border-rose-200 dark:border-rose-800/80 whitespace-nowrap"
                            title="Unassign All Mentees from this Staff Mentor"
                          >
                            Unassign
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              });
            })()}
          </tbody>
        </table>
      </div>
    </div>
  );
};
export default FacultyMentorMatrixCard;
