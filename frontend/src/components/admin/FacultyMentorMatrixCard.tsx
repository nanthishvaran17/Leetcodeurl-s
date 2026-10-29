import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { 
  Users, RotateCcw, Eye, Award, CheckCircle2, 
  Clock, ArrowRightLeft, UserX, Search, Filter,
  ShieldCheck, AlertCircle, ChevronRight, X, Activity,
  ExternalLink, CheckCircle, TrendingUp
} from 'lucide-react';

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
  onViewActiveMentees?: () => void;
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
  onViewActiveMentees,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showActiveMenteesModal, setShowActiveMenteesModal] = useState<boolean>(false);

  // Computed summary metrics for the mentors
  const totalStaff = staffList.length;
  const allocatedStaff = staffList.filter(s => (s.assigned_count || 0) > 0).length;
  const unallocatedStaff = totalStaff - allocatedStaff;
  const totalAssignedMentees = staffList.reduce((acc, s) => acc + (s.assigned_count || 0), 0);
  const totalActiveSolvers = staffList.reduce((acc, s) => acc + ((s as any).active_count || 0), 0);
  const overallActiveRate = totalAssignedMentees > 0 
    ? Math.round((totalActiveSolvers / totalAssignedMentees) * 100) 
    : 0;

  const filteredStaff = staffList.filter((s) => {
    // Workload filter
    if (staffWorkloadFilter === 'COMPLETED' || staffWorkloadFilter === 'ALLOCATED') {
      if ((s.assigned_count || 0) === 0) return false;
    } else if (staffWorkloadFilter === 'PENDING' || staffWorkloadFilter === 'UNALLOCATED') {
      if ((s.assigned_count || 0) > 0) return false;
    }
    // Search query filter
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const u = (s.username || '').toLowerCase();
      const fn = ((s as any).full_name || '').toLowerCase();
      const e = (s.email || '').toLowerCase();
      const d = ((s as any).department_code || (s as any).department || '').toLowerCase();
      return u.includes(q) || fn.includes(q) || e.includes(q) || d.includes(q);
    }
    return true;
  });

  return (
    <div
      id="staff-performance-section"
      className="stagger-4 relative overflow-hidden rounded-2xl sm:rounded-3xl bg-white/95 dark:bg-[#0c1424]/95 backdrop-blur-xl border border-slate-200/90 dark:border-white/10 shadow-lg sm:shadow-xl my-4 sm:my-6 transition-all"
    >
      {/* Decorative ambient gradient backdrop */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-indigo-500/10 via-brand-500/5 to-transparent rounded-bl-full pointer-events-none blur-2xl" />

      {/* 1. Header & Controls */}
      <div className="p-3.5 sm:p-7 border-b border-slate-100 dark:border-white/10 relative z-10 space-y-3 sm:space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
          <div className="space-y-1 sm:space-y-1.5">
            <div className="flex items-center gap-2 sm:gap-2.5">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-gradient-to-br from-indigo-500 to-brand-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
                <Users className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div>
                <h3 className="font-display text-sm sm:text-lg font-black tracking-tight text-slate-900 dark:text-white flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <span>Faculty Mentors Performance &amp; Progress Matrix</span>
                  <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-mono font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-500/30">
                    Live Telemetry
                  </span>
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 font-semibold line-clamp-1 sm:line-clamp-none">
                  Track mentorship workload, active solver rates, Sunday contest engagement, and completion across staff members
                </p>
              </div>
            </div>
          </div>

          {/* Action Hub Buttons */}
          <div className="flex flex-wrap items-center gap-2 sm:self-center">
            {staffWorkloadFilter !== 'ALL' && (
              <button
                onClick={() => setStaffWorkloadFilter('ALL')}
                className="h-9 sm:min-h-[40px] px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-[11px] sm:text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95 touch-manipulation"
              >
                <RotateCcw size={12} className="text-slate-500" />
                <span>Show All Staff</span>
              </button>
            )}
            <button
              onClick={() => setShowStaffAllocationModal(true)}
              className="h-9 sm:min-h-[40px] px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-gradient-to-r from-brand-600 via-indigo-600 to-indigo-700 hover:from-brand-500 hover:to-indigo-600 text-white font-black text-[11px] sm:text-xs flex items-center gap-1.5 sm:gap-2 transition-all cursor-pointer shadow-md shadow-indigo-600/20 active:scale-95 touch-manipulation"
            >
              <Users size={13} className="shrink-0" />
              <span>Manage Allocation</span>
            </button>
          </div>
        </div>

        {/* 2. Micro Executive Summary Strip (All Interactive) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 pt-2">
          {/* Total Mentors Card — Click opens Allocation & Roster Manager */}
          <div 
            onClick={() => {
              setStaffWorkloadFilter('ALL');
              setShowStaffAllocationModal(true);
            }}
            className="p-3 sm:p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-white/5 hover:border-indigo-500/50 hover:bg-indigo-50/20 dark:hover:bg-indigo-950/20 transition-all cursor-pointer group active:scale-[0.98] shadow-xs"
            title="Click to open Faculty Allocation & Mentors Manager"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                Total Mentors
              </span>
              <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 opacity-80 group-hover:opacity-100 flex items-center gap-0.5 transition-all">
                Manage <ChevronRight size={10} className="group-hover:translate-x-0.5 transition-transform" />
              </span>
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-lg sm:text-xl font-black font-mono text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                {totalStaff}
              </span>
              <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">Faculty</span>
            </div>
          </div>

          {/* Allocated Mentors Filter Card */}
          <div 
            onClick={() => setStaffWorkloadFilter(staffWorkloadFilter === 'COMPLETED' ? 'ALL' : 'COMPLETED')}
            className={`p-3 sm:p-3.5 rounded-2xl border transition-all cursor-pointer active:scale-[0.98] shadow-xs ${
              staffWorkloadFilter === 'COMPLETED'
                ? 'bg-emerald-500/10 border-emerald-500/40 ring-2 ring-emerald-500/20'
                : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200/70 dark:border-white/5 hover:border-emerald-500/30'
            }`}
            title="Click to toggle filter for Allocated faculty mentors"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Allocated</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-lg sm:text-xl font-black font-mono text-emerald-600 dark:text-emerald-400">{allocatedStaff}</span>
              <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">Active Duty</span>
            </div>
          </div>

          {/* Unallocated Mentors Filter Card */}
          <div 
            onClick={() => setStaffWorkloadFilter(staffWorkloadFilter === 'PENDING' ? 'ALL' : 'PENDING')}
            className={`p-3 sm:p-3.5 rounded-2xl border transition-all cursor-pointer active:scale-[0.98] shadow-xs ${
              staffWorkloadFilter === 'PENDING'
                ? 'bg-amber-500/10 border-amber-500/40 ring-2 ring-amber-500/20'
                : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200/70 dark:border-white/5 hover:border-amber-500/30'
            }`}
            title="Click to toggle filter for Unallocated faculty mentors"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">Unallocated</span>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-lg sm:text-xl font-black font-mono text-amber-600 dark:text-amber-400">{unallocatedStaff}</span>
              <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">Mentors</span>
            </div>
          </div>

          {/* Mentees Active Card — Click opens Active Mentees & Telemetry Modal */}
          <div 
            onClick={() => setShowActiveMenteesModal(true)}
            className="p-3 sm:p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-white/5 hover:border-indigo-500/50 hover:bg-indigo-50/20 dark:hover:bg-indigo-950/20 transition-all cursor-pointer group active:scale-[0.98] shadow-xs"
            title="Click to open Active Mentees & Solver Participation Telemetry"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                Mentees Active
              </span>
              <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 opacity-80 group-hover:opacity-100 flex items-center gap-0.5 transition-all">
                Inspect <ChevronRight size={10} className="group-hover:translate-x-0.5 transition-transform" />
              </span>
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-lg sm:text-xl font-black font-mono text-indigo-600 dark:text-indigo-400 group-hover:text-indigo-500 transition-colors">
                {totalActiveSolvers}/{totalAssignedMentees}
              </span>
              <span className="text-[10px] font-mono font-bold text-indigo-500">({overallActiveRate}%)</span>
            </div>
          </div>
        </div>

        {/* 3. Search Toolbar */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search faculty mentor by name, email, or department..."
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-300/80 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all font-medium"
          />
        </div>
      </div>

      {/* 4. Table / Responsive Cards Display */}
      {/* DEDICATED MOBILE CARDS VIEW (md:hidden) */}
      <div className="md:hidden p-3.5 space-y-3">
        {filteredStaff.length === 0 ? (
          <div className="py-12 text-center text-slate-500 dark:text-slate-400 font-bold font-sans">
            <div className="flex flex-col items-center justify-center space-y-2">
              <UserX className="w-8 h-8 text-slate-300 dark:text-slate-600" />
              <span>No faculty mentors match the selected criteria.</span>
            </div>
          </div>
        ) : (
          filteredStaff.map((s) => {
            const assigned = s.assigned_count || 0;
            const active = (s as any).active_count || 0;
            const completionRate = assigned > 0 ? Math.round((active / assigned) * 100) : 0;
            const isSelected = selectedStaff === String(s.id);
            const deptCode = (s as any).department_code || 'DEPT';
            const deptBadge = getDeptBadgeStyle(deptCode);
            const initial = (s.username || 'F').charAt(0).toUpperCase();

            return (
              <div
                key={s.id}
                onClick={() => setSelectedStaffDetail(s)}
                className={`p-3.5 rounded-2xl bg-white dark:bg-slate-900/90 border transition-all cursor-pointer shadow-xs active:scale-[0.99] space-y-3 ${
                  isSelected
                    ? 'border-indigo-500 ring-2 ring-indigo-500/30'
                    : 'border-slate-200/80 dark:border-white/10 hover:border-slate-300'
                }`}
              >
                {/* Header: Avatar, Name, Email, Dept Badge */}
                <div className="flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-brand-500/20 text-indigo-600 dark:text-indigo-400 font-black flex items-center justify-center text-sm border border-indigo-400/30 shadow-xs shrink-0">
                      {initial}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                        <span className="truncate">{s.full_name || s.username}</span>
                        {isSelected && (
                          <span className="px-1.5 py-0.2 rounded-full bg-emerald-500 text-white text-[9px] font-black uppercase shrink-0">
                            Active
                          </span>
                        )}
                      </h4>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300 font-mono truncate font-medium">
                        {s.full_name && s.full_name !== s.username && (
                          <>
                            <span className="text-slate-600 dark:text-slate-300 font-semibold">@{s.username}</span>
                            <span className="text-slate-400 dark:text-slate-600">•</span>
                          </>
                        )}
                        <span className="truncate text-slate-600 dark:text-slate-300">{s.email}</span>
                      </div>
                    </div>
                  </div>

                  <span className={`px-2 py-0.5 rounded-lg font-mono text-[10px] font-extrabold border shrink-0 ${deptBadge}`}>
                    {deptCode}
                  </span>
                </div>

                {/* 3-Cell Inset Metric Grid */}
                <div className="grid grid-cols-3 gap-2 p-2 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-100 dark:border-white/5 text-center">
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 block">
                      Mentees
                    </span>
                    <span className="text-xs font-mono font-black text-slate-800 dark:text-white">
                      {assigned}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 block">
                      Active Solvers
                    </span>
                    <span className="text-xs font-mono font-black text-teal-600 dark:text-teal-400">
                      {active}/{assigned}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 block">
                      Sunday Contest
                    </span>
                    <span className="text-xs font-mono font-black text-indigo-600 dark:text-indigo-400">
                      {assigned > 0 ? `${s.sunday_contest_attended ?? 0}/${assigned}` : '—'}
                    </span>
                  </div>
                </div>

                {/* Progress Bar & Status Pill */}
                <div className="flex items-center justify-between gap-3 pt-0.5">
                  <div className="flex-1 flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          completionRate >= 80 ? 'bg-emerald-500' : completionRate > 0 ? 'bg-amber-500' : 'bg-slate-300'
                        }`}
                        style={{ width: `${completionRate}%` }}
                      />
                    </div>
                    <span className={`text-[10px] font-mono font-black shrink-0 ${
                      completionRate === 0 ? 'text-slate-600 dark:text-slate-300 font-bold' : 'text-slate-800 dark:text-white font-bold'
                    }`}>
                      {completionRate}%
                    </span>
                  </div>

                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border shrink-0 ${
                    assigned === 0
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                      : active === assigned
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                      : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                  }`}>
                    {assigned === 0 ? 'Unallocated' : active === assigned ? '100% Active' : `Allocated (${assigned})`}
                  </span>
                </div>

                {/* Mobile Action Buttons */}
                <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-white/5" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedStaffDetail(s);
                    }}
                    className="flex-1 h-8 px-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-brand-600 text-white text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 shadow-xs shadow-indigo-600/20"
                  >
                    <Eye size={12} className="shrink-0" />
                    <span>Inspect</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFilterByStaff(s.id, s.username);
                    }}
                    className={`h-8 px-2.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1 active:scale-95 ${
                      isSelected
                        ? 'bg-emerald-600 text-white shadow-xs shadow-emerald-600/30'
                        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <Filter size={11} className={isSelected ? 'text-white' : 'text-slate-500 dark:text-slate-400'} />
                    <span>{isSelected ? 'Scoped' : 'Scope'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowStaffAllocationModal(true);
                    }}
                    className="h-8 w-8 rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 flex items-center justify-center active:scale-95 shrink-0"
                    title="Manage Allocation"
                  >
                    <ArrowRightLeft size={12} className="text-slate-500 dark:text-slate-400" />
                  </button>

                  {assigned > 0 ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUnassignAllForStaff(s.id, s.username);
                      }}
                      className="h-8 w-8 rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50 flex items-center justify-center active:scale-95 shrink-0"
                      title="Unassign All Mentees"
                    >
                      <UserX size={12} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="h-8 w-8 rounded-xl bg-slate-100/40 text-slate-300 dark:bg-slate-800/20 dark:text-slate-600 border border-dashed border-slate-200/60 dark:border-white/5 flex items-center justify-center cursor-not-allowed shrink-0"
                      title="No mentees allocated"
                    >
                      <UserX size={12} />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* DESKTOP TABLE VIEW (hidden md:block) */}
      <div className="hidden md:block w-full overflow-x-auto pb-6 sm:pb-8">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="text-[11px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 bg-slate-100/90 dark:bg-slate-900/90 border-b border-slate-200 dark:border-white/10">
              <th className="py-4 px-4">Faculty Mentor</th>
              <th className="py-4 px-3">Dept</th>
              <th className="py-4 px-3 text-center">Assigned</th>
              <th className="py-4 px-3 text-center">Active Solvers</th>
              <th className="py-4 px-3 text-center">Sunday Contest</th>
              <th className="py-4 px-3 text-center">Completion Rate</th>
              <th className="py-4 px-3 text-center">Workload Status</th>
              <th className="py-4 px-4 text-center w-[275px] min-w-[275px]">Actions</th>
            </tr>
          </thead>
          <tbody className="block md:table-row-group divide-y-0 md:divide-y divide-slate-100 dark:divide-white/5 font-mono">
            {filteredStaff.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-500 dark:text-slate-400 font-bold font-sans">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <UserX className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                    <span>No faculty mentors match the selected criteria.</span>
                  </div>
                </td>
              </tr>
            ) : (
              filteredStaff.map((s) => {
                const assigned = s.assigned_count || 0;
                const active = (s as any).active_count || 0;
                const completionRate = assigned > 0 ? Math.round((active / assigned) * 100) : 0;
                const isSelected = selectedStaff === String(s.id);
                const deptCode = (s as any).department_code || (s as any).department || 'DEPT';
                const deptBadge = getDeptBadgeStyle(deptCode);
                const initial = ((s.full_name || s.username || 'F').trim().charAt(0)).toUpperCase();

                return (
                  <tr
                    key={s.id}
                    onClick={() => setSelectedStaffDetail(s)}
                    className={`block md:table-row hover:bg-indigo-50/50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors bg-white dark:bg-transparent mb-3.5 md:mb-0 p-4 md:p-0 rounded-2xl shadow-sm md:shadow-none border border-slate-200/80 dark:border-white/5 md:border-none ${
                      isSelected
                        ? 'md:bg-indigo-50/80 dark:md:bg-indigo-950/30 ring-2 ring-indigo-500/50 rounded-2xl'
                        : ''
                    }`}
                  >
                    {/* Faculty Mentor Info */}
                    <td className="flex items-center gap-3 pb-3 md:pb-0 md:py-3.5 md:px-4 font-bold text-slate-900 dark:text-white font-sans border-b border-slate-100 dark:border-white/5 md:border-none md:table-cell">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-brand-500/20 text-indigo-600 dark:text-indigo-400 font-black flex items-center justify-center text-sm border border-indigo-400/30 shadow-sm shrink-0">
                          {initial}
                        </div>
                        <div className="min-w-0">
                          <div className="font-extrabold text-slate-900 dark:text-white text-xs sm:text-sm flex items-center gap-1.5 truncate">
                            <span>{s.full_name || s.username}</span>
                            {isSelected && (
                              <span className="px-1.5 py-0.5 rounded-full bg-emerald-500 text-white text-[9px] font-black uppercase tracking-wider">
                                Active Filter
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-600 dark:text-slate-300 font-mono font-medium truncate flex items-center gap-1.5">
                            {s.full_name && s.full_name !== s.username && (
                              <>
                                <span className="text-slate-600 dark:text-slate-300 font-semibold">@{s.username}</span>
                                <span className="text-slate-400 dark:text-slate-600">•</span>
                              </>
                            )}
                            <span className="truncate text-slate-600 dark:text-slate-300 font-medium">{s.email}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Department Badge */}
                    <td className="flex items-center justify-between py-2 md:py-3.5 md:px-3 border-b border-slate-50 dark:border-white/5 md:border-none md:table-cell">
                      <span className="md:hidden text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Department
                      </span>
                      <div className="text-right md:text-left">
                        <span className={`px-2.5 py-0.5 rounded-lg font-mono text-[11px] font-extrabold inline-block border shadow-xs ${deptBadge}`}>
                          {deptCode}
                        </span>
                      </div>
                    </td>

                    {/* Assigned Mentees */}
                    <td className="flex items-center justify-between py-2 md:py-3.5 md:px-3 text-center font-mono border-b border-slate-50 dark:border-white/5 md:border-none md:table-cell">
                      <span className="md:hidden text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Assigned Mentees
                      </span>
                      <div className="text-right md:text-center">
                        {assigned > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-black">
                            <span>{assigned}</span>
                            <span className="text-[10px] text-slate-500 font-sans font-bold">Mentees</span>
                          </span>
                        ) : (
                          <span className="text-slate-600 dark:text-slate-300 font-bold text-xs">0 Mentees</span>
                        )}
                      </div>
                    </td>

                    {/* Active Solvers */}
                    <td className="flex items-center justify-between py-2 md:py-3.5 md:px-3 text-center font-mono border-b border-slate-50 dark:border-white/5 md:border-none md:table-cell">
                      <span className="md:hidden text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Active Solvers
                      </span>
                      <div className="text-right md:text-center">
                        {assigned > 0 ? (
                          <span className={`px-2.5 py-1 rounded-xl font-extrabold text-xs inline-flex items-center gap-1.5 border ${
                            active === assigned
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                              : active > 0
                              ? 'bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/30'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${active > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                            <span>{active} / {assigned}</span>
                            <span className="text-[10px] opacity-80 font-bold">({completionRate}%)</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs inline-flex items-center gap-1 border border-slate-300/80 dark:border-slate-700">
                            0 / 0
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Sunday Contest Attendance */}
                    <td className="flex items-center justify-between py-2 md:py-3.5 md:px-3 text-center font-mono border-b border-slate-50 dark:border-white/5 md:border-none md:table-cell">
                      <span className="md:hidden text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Sunday Contest
                      </span>
                      <div className="text-right md:text-center">
                        {assigned > 0 ? (
                          <span
                            className={`px-2.5 py-1 rounded-xl text-xs font-extrabold inline-flex items-center gap-1 border ${
                              (s.sunday_contest_turnout_pct || 0) >= 80
                                ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30'
                                : (s.sunday_contest_turnout_pct || 0) >= 50
                                ? 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30'
                                : (s.sunday_contest_attended || 0) > 0
                                ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                            }`}
                            title={`${s.sunday_contest_session_name || 'Sunday Contest'}: ${s.sunday_contest_attended || 0} of ${assigned} attended`}
                          >
                            <span>
                              {s.sunday_contest_attended ?? 0} / {assigned}
                            </span>
                            <span className="text-[10px] opacity-80">
                              ({s.sunday_contest_turnout_pct ?? 0}%)
                            </span>
                          </span>
                        ) : (
                          <span className="text-slate-600 dark:text-slate-300 font-bold text-xs">—</span>
                        )}
                      </div>
                    </td>

                    {/* Completion Rate Gauge */}
                    <td className="flex items-center justify-between py-2 md:py-3.5 md:px-3 text-center font-mono border-b border-slate-50 dark:border-white/5 md:border-none md:table-cell">
                      <span className="md:hidden text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Completion Rate
                      </span>
                      <div className="flex items-center justify-end md:justify-center gap-2">
                        <div className="relative w-16 sm:w-20 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden border border-slate-200 dark:border-slate-700 shadow-inner">
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
                        </div>
                        <span className={`font-black text-xs ${
                          completionRate === 0 ? 'text-slate-600 dark:text-slate-300 font-bold' : 'text-slate-800 dark:text-white font-bold'
                        }`}>
                          {completionRate}%
                        </span>
                      </div>
                    </td>

                    {/* Workload Status */}
                    <td className="flex items-center justify-between py-2 md:py-3.5 md:px-3 text-center md:table-cell border-b border-slate-50 dark:border-white/5 md:border-none">
                      <span className="md:hidden text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Workload Status
                      </span>
                      <div className="text-right md:text-center">
                        <span
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-black border uppercase tracking-wider ${
                            assigned === 0
                              ? 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border-slate-300/80 dark:border-slate-700 font-black'
                              : active === assigned
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                              : active > 0
                              ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30'
                              : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
                          }`}
                        >
                          {assigned === 0
                            ? 'UNALLOCATED (0)'
                            : active === assigned
                            ? `100% ACTIVE (${assigned})`
                            : active > 0
                            ? `ALLOCATED (${assigned})`
                            : `PENDING (${assigned})`}
                        </span>
                      </div>
                    </td>

                    {/* Action Buttons — Perfectly Aligned Fixed Slot Dock */}
                    <td
                      className="py-3 md:py-3.5 md:px-4 text-center w-[275px] min-w-[275px]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedStaffDetail(s);
                          }}
                          className="h-8 px-3 rounded-xl bg-gradient-to-r from-indigo-600 to-brand-600 hover:from-indigo-500 hover:to-brand-500 text-white text-xs font-bold transition-all shadow-xs shadow-indigo-600/20 flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer shrink-0"
                          title="Open full profile & performance popup drawer"
                        >
                          <Eye size={12} className="shrink-0" />
                          <span>Inspect</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFilterByStaff(s.id, s.username);
                          }}
                          className={`h-8 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer shrink-0 ${
                            isSelected
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs shadow-emerald-600/30'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 font-extrabold border border-slate-300/80 dark:border-slate-700'
                          }`}
                          title={
                            isSelected
                              ? 'Currently filtering dashboard by this mentor (Click to reset)'
                              : `Filter entire dashboard table to ${s.username}'s mentees`
                          }
                        >
                          <Filter size={11} className={isSelected ? 'text-white' : 'text-slate-500 dark:text-slate-400'} />
                          <span>{isSelected ? 'Active Scope' : 'Filter Scope'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowStaffAllocationModal(true);
                          }}
                          className="h-8 w-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 border border-slate-300/80 dark:border-slate-700 flex items-center justify-center transition-all active:scale-95 cursor-pointer shrink-0"
                          title="Manage Faculty Allocation & Reassign"
                        >
                          <ArrowRightLeft size={12} className="text-slate-600 dark:text-slate-300" />
                        </button>

                        {assigned > 0 ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUnassignAllForStaff(s.id, s.username);
                            }}
                            className="h-8 w-8 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50 flex items-center justify-center transition-all active:scale-95 cursor-pointer shrink-0"
                            title={`Unassign All (${assigned}) Mentees from this Staff Mentor`}
                          >
                            <UserX size={12} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled
                            className="h-8 w-8 rounded-xl bg-slate-100/40 dark:bg-slate-800/20 text-slate-300 dark:text-slate-600 border border-dashed border-slate-200/60 dark:border-white/5 flex items-center justify-center cursor-not-allowed shrink-0"
                            title="No mentees allocated to unassign"
                          >
                            <UserX size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 5. Matrix Status & Summary Footer Strip */}
      <div className="px-5 sm:px-7 py-3.5 border-t border-slate-100 dark:border-white/10 bg-slate-50/60 dark:bg-slate-900/40 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
        <div className="flex items-center gap-2 font-mono text-[11px]">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>
            Displaying <strong className="text-slate-800 dark:text-slate-200">{filteredStaff.length}</strong> of{' '}
            <strong className="text-slate-800 dark:text-slate-200">{staffList.length}</strong> faculty mentors
          </span>
        </div>
        <div className="text-[11px] text-slate-600 dark:text-slate-300 font-sans">
          Click any faculty row to inspect student telemetry
        </div>
      </div>

      {/* 5. Active Mentees & Solver Participation Telemetry Modal */}
      {showActiveMenteesModal && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[100050] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/85 dark:bg-black/90 backdrop-blur-md animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowActiveMenteesModal(false);
          }}
        >
          <div className="w-full sm:max-w-3xl bg-white dark:bg-navy-950 rounded-t-3xl sm:rounded-3xl p-5 sm:p-7 border-t sm:border border-slate-200 dark:border-navy-700 shadow-2xl space-y-5 max-h-[92vh] sm:max-h-[90vh] overflow-y-auto custom-scrollbar animate-modal-content">
            {/* Mobile Drag Indicator */}
            <div className="w-12 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto sm:hidden mb-1 shrink-0" />

            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100 dark:border-navy-800">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-500/30 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Active Telemetry Matrix</span>
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    {overallActiveRate}% Overall Rate
                  </span>
                </div>
                <h3 className="font-display text-lg sm:text-xl font-black text-slate-950 dark:text-white flex items-center gap-2">
                  <span>Active Mentees &amp; Solver Participation Telemetry</span>
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 font-sans leading-relaxed">
                  Real-time activity audit of students actively solving problems across designated faculty mentors
                </p>
              </div>

              <button 
                onClick={() => setShowActiveMenteesModal(false)} 
                className="p-1.5 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors cursor-pointer shrink-0"
                title="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            {/* 4 Micro Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 sm:p-3.5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-800/40">
                <div className="text-[10px] font-mono uppercase font-bold text-indigo-600 dark:text-indigo-400 flex items-center justify-between">
                  <span>Active Solvers</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                <div className="text-xl sm:text-2xl font-black font-mono text-indigo-700 dark:text-indigo-300 mt-1">
                  {totalActiveSolvers}
                </div>
                <div className="text-[10px] text-slate-500 font-sans">Active this cycle</div>
              </div>

              <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-800">
                <div className="text-[10px] font-mono uppercase font-bold text-slate-500 dark:text-slate-400">Total Assigned</div>
                <div className="text-xl sm:text-2xl font-black font-mono text-slate-900 dark:text-white mt-1">
                  {totalAssignedMentees}
                </div>
                <div className="text-[10px] text-slate-500 font-sans">Enrolled mentees</div>
              </div>

              <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-800">
                <div className="text-[10px] font-mono uppercase font-bold text-slate-500 dark:text-slate-400">Completion Rate</div>
                <div className={`text-xl sm:text-2xl font-black font-mono mt-1 ${
                  overallActiveRate >= 80 ? 'text-emerald-600 dark:text-emerald-400' :
                  overallActiveRate >= 50 ? 'text-amber-600 dark:text-amber-400' :
                  'text-rose-600 dark:text-rose-400'
                }`}>
                  {overallActiveRate}%
                </div>
                <div className="text-[10px] text-slate-500 font-sans">Solver engagement</div>
              </div>

              <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-800">
                <div className="text-[10px] font-mono uppercase font-bold text-slate-500 dark:text-slate-400">Active Faculty</div>
                <div className="text-xl sm:text-2xl font-black font-mono text-slate-900 dark:text-white mt-1">
                  {allocatedStaff} / {totalStaff}
                </div>
                <div className="text-[10px] text-slate-500 font-sans">Assigned mentors</div>
              </div>
            </div>

            {/* Faculty Mentor Telemetry Breakdown */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-display font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Users size={14} className="text-indigo-500" />
                  <span>Faculty Mentor Telemetry Breakdown</span>
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  {staffList.filter(s => (s.assigned_count || 0) > 0).length} Mentors with Active Mentees
                </span>
              </div>

              <div className="space-y-2.5 max-h-[38vh] overflow-y-auto pr-1 custom-scrollbar">
                {staffList.filter(s => (s.assigned_count || 0) > 0).length === 0 ? (
                  <div className="p-6 text-center text-slate-400 text-xs font-bold bg-slate-50 dark:bg-navy-900/40 rounded-2xl border border-slate-200 dark:border-navy-800">
                    No faculty mentors currently have assigned mentees. Click 'Manage Allocation' to distribute students.
                  </div>
                ) : (
                  staffList
                    .filter(s => (s.assigned_count || 0) > 0)
                    .map((s) => {
                      const assigned = s.assigned_count || 0;
                      const active = (s as any).active_count || 0;
                      const rate = assigned > 0 ? Math.round((active / assigned) * 100) : 0;
                      const deptCode = (s as any).department_code || 'DEPT';
                      const initial = (s.username || 'F').charAt(0).toUpperCase();

                      return (
                        <div
                          key={s.id}
                          className="p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-navy-800 bg-slate-50/70 dark:bg-navy-900/60 hover:bg-slate-100/70 dark:hover:bg-navy-800/70 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-brand-500/20 text-indigo-600 dark:text-indigo-400 font-black flex items-center justify-center text-sm border border-indigo-400/30 shadow-xs shrink-0 font-mono">
                              {initial}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-extrabold text-slate-900 dark:text-white text-xs sm:text-sm truncate">
                                  {s.username}
                                </span>
                                <span className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-extrabold border ${getDeptBadgeStyle(deptCode)}`}>
                                  {deptCode}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
                                {s.email}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                            {/* Gauge and Rate */}
                            <div className="text-right space-y-1">
                              <div className="flex items-center justify-end gap-1.5 font-mono text-xs font-black">
                                <span className="text-indigo-600 dark:text-indigo-400">{active}</span>
                                <span className="text-slate-400">/</span>
                                <span className="text-slate-700 dark:text-slate-200">{assigned} Active</span>
                                <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                                  rate >= 80 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' :
                                  rate >= 50 ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' :
                                  'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                                }`}>
                                  {rate}%
                                </span>
                              </div>
                              <div className="w-24 sm:w-28 h-1.5 rounded-full bg-slate-200 dark:bg-navy-800 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-300 ${
                                    rate >= 80 ? 'bg-emerald-500' : rate >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                                  }`}
                                  style={{ width: `${rate}%` }}
                                />
                              </div>
                            </div>

                            {/* Quick Action Buttons */}
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => {
                                  setShowActiveMenteesModal(false);
                                  setSelectedStaffDetail(s);
                                }}
                                className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black transition flex items-center gap-1 shadow-xs cursor-pointer active:scale-95"
                                title="Open full mentor profile & mentees list"
                              >
                                <Eye size={12} />
                                <span>Inspect</span>
                              </button>
                              <button
                                onClick={() => {
                                  setShowActiveMenteesModal(false);
                                  handleFilterByStaff(s.id, s.username);
                                }}
                                className="px-2.5 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-navy-800 dark:hover:bg-navy-700 text-slate-800 dark:text-slate-200 text-[11px] font-bold transition flex items-center gap-1 cursor-pointer active:scale-95"
                                title="Filter entire dashboard to this mentor"
                              >
                                <span>Filter</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="pt-3 border-t border-slate-100 dark:border-navy-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowActiveMenteesModal(false);
                    setShowStaffAllocationModal(true);
                  }}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-navy-700 hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <Users size={13} />
                  <span>Manage Allocation Roster</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowActiveMenteesModal(false);
                    if (onViewActiveMentees) {
                      onViewActiveMentees();
                    } else {
                      document.getElementById('student-directory-section')?.scrollIntoView({ behavior: 'smooth' });
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-brand-600/20 active:scale-95"
                >
                  <TrendingUp size={13} />
                  <span>View Active Solvers in Live Table ↓</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowActiveMenteesModal(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-navy-800 hover:bg-slate-200 dark:hover:bg-navy-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition cursor-pointer active:scale-95"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default FacultyMentorMatrixCard;

