import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Building2, RefreshCw, Search, Plus, Trash2, UserCheck, X, CheckCircle2, AlertTriangle, Users, Activity, TrendingUp, BarChart3, ArrowUpRight, ArrowDownRight, BookOpen, RotateCcw, ShieldCheck, Clock, Download, SlidersHorizontal, ChevronRight, ChevronLeft, ChevronsLeft, ChevronsRight, Loader2, FileSpreadsheet, FileText, HelpCircle, Eye, Compass, Target, PieChart, Layers, BrainCircuit, Award, Filter, ChevronDown, ChevronUp, Check, AlertCircle, ArrowRight, Sliders, User, CheckCircle, XCircle, ExternalLink, Calendar, Info, UserPlus, UserMinus, Shuffle, Printer, Share2, TrendingDown, Minus, Copy } from 'lucide-react';
import { Mail, UserX, GraduationCap, Trophy } from 'lucide-react';
import { SwipeHandle } from '../components/SwipeHandle';
import { StaffDetailDrawer } from '../components/admin/StaffDetailDrawer';
import { DepartmentDetailDrawer } from '../components/admin/DepartmentDetailDrawer';
import { FacultyMentorMatrixCard } from '../components/admin/FacultyMentorMatrixCard';
import { GlobalFilter } from '../components/GlobalFilter';
import {
 getCommandCenterSummary, getCommandCenterStudents, addStudent, updateStudent,
 deleteStudent, getCommandCenterDepartments, askCommandCenterAI,
 getFacultyWorkload, assignStudentsBatch, unassignStudentsBatch, autoDistributeDepartment,
 getReportData, CommandCenterSummary, StudentRecord, DeptBenchmark, YearBenchmark,
 DepartmentRecord, StaffRecord, FacultyWorkloadItem
} from '../services/commandCenterService';
import { simulateWhatIfScenario, askAIDepartmentQuery } from '../services/intelligenceService';
import { CustomDropdown } from '../components/CustomDropdown';
import { AnalyticsDashboard } from '../components/analytics/AnalyticsDashboard';
import { PerformanceChart } from '../components/PerformanceChart';
import { useKeyboardContext } from '../context/KeyboardContext';
import { useDebounce } from '../hooks/useDebounce';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import api, { clearApiCache } from '../services/api';
import { useGlobalWebSocket } from '../context/GlobalWebSocketProvider';
import { triggerDownload } from '../utils/mobileDownload';
import { downloadManager } from '../services/download/downloadManager';

// Shared Card Component 

const Card: React.FC<{ children: React.ReactNode; className?: string; id?: string; onClick?: () => void }> = ({ children, className = '', id, onClick }) => (
  <div id={id} onClick={onClick} className={`bg-white dark:bg-navy-950 rounded-xl sm:rounded-2xl border border-slate-200/90 dark:border-navy-800 shadow-xs sm:shadow-sm hover:shadow-md transition-all ${className}`}>
    {children}
  </div>
);

const getDeptBadgeStyle = (code: string) => {
 const c = (code || '').toUpperCase();
 if (c.includes('CS') && !c.includes('IOT')) {
 return 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30';
 }
 if (c.includes('IOT') || c.includes('CI')) {
 return 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30';
 }
 if (c.includes('IT')) {
 return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
 }
 if (c.includes('AIDS') || c.includes('AI')) {
 return 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30';
 }
 if (c.includes('AGRI') || c.includes('AG')) {
 return 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30';
 }
 if (c.includes('EEE')) {
 return 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30';
 }
 if (c.includes('ECE')) {
 return 'bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-500/30';
 }
 return 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30';
};

// Student Detail Drawer 

const StudentDetailDrawer: React.FC<{
 student: StudentRecord | null;
 staffList: StaffRecord[];
 onClose: () => void;
 onReassign: (studentId: number, targetFacultyId: number) => void;
}> = ({ student, staffList, onClose, onReassign }) => {
 useEffect(() => {
 if (student) {
 document.body.style.overflow = 'hidden';
 }
 return () => {
 document.body.style.overflow = '';
 };
 }, [student]);

 if (!student) return null;

  return createPortal(
    <div className="fixed inset-0 z-[999999] flex items-end sm:items-stretch justify-center sm:justify-end bg-slate-950/95 dark:bg-black/95 backdrop-blur-xl animate-fade-in p-0" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md max-h-[92vh] sm:max-h-none sm:h-full bg-white dark:bg-navy-950 sm:border-l border-slate-200 dark:border-navy-700 shadow-2xl rounded-t-3xl sm:rounded-none sm:rounded-l-3xl p-4 sm:p-6 pt-3 sm:pt-7 overflow-y-auto space-y-6 flex flex-col justify-between">
        {/* Mobile Swipe / Drag Handle Indicator */}
        <SwipeHandle onClose={onClose} className="py-1 mb-1" pillClassName="bg-slate-300 dark:bg-navy-700 hover:bg-slate-400" />
        <div className="space-y-6">
 {/* Header */}
 <div className="flex items-start justify-between pb-4 border-b border-slate-100 dark:border-navy-800">
 <div>
 <span className="px-2 py-0.5 rounded bg-brand-50 dark:bg-brand-950 text-brand-600 text-xs font-bold">
 {student.reg_no}
 </span>
 <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white mt-1">
 {student.name}
 </h3>
 <p className="text-xs text-slate-700 dark:text-slate-400 font-medium">
 {student.department_code} / {student.year_level} Year
 </p>
 </div>
 <button onClick={onClose} className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 transition">
 <X size={18} />
 </button>
 </div>

 {/* Key Metrics Grid */}
 <div className="grid grid-cols-2 gap-3">
 <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-navy-800 border border-slate-100 dark:border-navy-700">
 <div className="text-xs font-extrabold uppercase text-slate-600 dark:text-slate-300 tracking-wider">Total Solved</div>
 <div className="font-display text-2xl font-black text-slate-900 dark:text-white mt-0.5">
 {student.total_solved}
 </div>
 <div className="text-xs text-emerald-600 font-medium">{student.weekly_change || '+0'} this week</div>
 </div>
 <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-navy-800 border border-slate-100 dark:border-navy-700">
 <div className="text-xs font-extrabold uppercase text-slate-600 dark:text-slate-300 tracking-wider">Contest Rating</div>
 <div 
 className="font-display text-2xl font-black text-brand-600 mt-0.5 cursor-pointer"
 title={student.contest_rating && !isNaN(Number(student.contest_rating)) && Math.round(Number(student.contest_rating)) !== 1500 ? `Exact Rating: ${Number(student.contest_rating).toFixed(3)}` : undefined}
 >
 {student.contest_rating && !isNaN(Number(student.contest_rating)) && Number(student.contest_rating) > 0 && Math.round(Number(student.contest_rating)) !== 1500 ? Math.round(Number(student.contest_rating)).toLocaleString('en-US') : '—'}
 </div>
 <div className="text-xs text-slate-700 dark:text-slate-400">Contest: {student.contest_standing || '—'}</div>
 </div>
 </div>

 {/* Difficulty Breakdown */}
 <div className="space-y-2">
 <h4 className="font-display text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-400">
 Problem Difficulty Ratio
 </h4>
 <div className="grid grid-cols-3 gap-2 text-center text-xs">
 <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold">
 <div className="text-xs text-emerald-600">Easy</div>
 <div>{student.easy_solved}</div>
 </div>
 <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-bold">
 <div className="text-xs text-amber-600">Medium</div>
 <div>{student.medium_solved}</div>
 </div>
 <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-bold">
 <div className="text-xs text-rose-600">Hard</div>
 <div>{student.hard_solved}</div>
 </div>
 </div>
 </div>

 {/* Mentorship Allocation Control */}
 <div className="space-y-2.5">
 <h4 className="font-display text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-400">
 Faculty Mentorship Allocation
 </h4>
 <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-navy-800 border border-slate-100 dark:border-navy-700 space-y-3">
 <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1.5 sm:gap-3 text-xs">
 <span className="text-slate-700 dark:text-slate-400">Current Mentor:</span>
 <span className="font-bold text-slate-900 dark:text-white truncate">
 {student.assigned_staff || 'Unassigned'}
 </span>
 </div>
 <div>
 <label className="block text-xs font-extrabold uppercase text-slate-600 dark:text-slate-300 mb-1">
 Reassign Faculty Mentor:
 </label>
 <GlobalFilter
 value={""}
 onChange={val => {
 if (val) {
 onReassign(student.id, Number(val));
 }
 }}
 dropdownWidth="w-full"
 options={[
 { value: "", label: "Select target faculty member..." },
 ...staffList.map((s: any) => ({ value: String(s.id), label: `${s.username} (${s.assigned_count}/20)` }))
 ]}
 icon={<User className="w-4 h-4" />}
 />
 </div>
 </div>
 </div>

 {/* Details list */}
 <div className="space-y-2.5 text-xs">
 <h4 className="font-display text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-400 font-mono">
 Operational Attributes
 </h4>
 <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-navy-800 space-y-3 border border-slate-100 dark:border-navy-700">
 <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-3">
 <span className="text-slate-700 dark:text-slate-400 shrink-0">LeetCode Username:</span>
 <a href={`https://leetcode.com/${student.leetcode_username}`} target="_blank" rel="noreferrer" className="font-mono font-bold text-brand-600 hover:underline inline-flex items-center gap-1 min-w-0 truncate">
 <span className="truncate">@{student.leetcode_username}</span> <ExternalLink size={11} className="shrink-0" />
 </a>
 </div>
 <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-3">
 <span className="text-slate-700 dark:text-slate-400 shrink-0">Activity Status:</span>
 <span className={`font-bold font-mono px-2 py-0.5 rounded text-xs w-max ${student.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : student.status === 'IMPROVING' ? 'bg-brand-100 text-brand-700' : 'bg-rose-100 text-rose-700'}`}>
 {student.status || 'ACTIVE'}
 </span>
 </div>
 <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-3">
 <span className="text-slate-700 dark:text-slate-400 shrink-0">Last Telemetry Sync:</span>
 <span className="font-mono text-slate-600 min-w-0 truncate">{student.last_updated}</span>
 </div>
 </div>
 </div>
 </div>

 <div className="pt-4 border-t border-slate-100 dark:border-navy-800 flex gap-2">
 <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-navy-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-bold transition">
 Close Drawer
 </button>
 </div>
 </div>
 </div>,
 document.body
 );
};

// HOD Staff Allocation Manager Modal 

const StaffAllocationModal: React.FC<{
 isOpen: boolean;
 onClose: () => void;
 deptId?: number;
 departments: DepartmentRecord[];
 onRefreshAll: () => void;
}> = ({ isOpen, onClose, deptId, departments, onRefreshAll }) => {
 const [selectedDeptId, setSelectedDeptId] = useState<number>(deptId || 1);
 const [workload, setWorkload] = useState<FacultyWorkloadItem[]>([]);
 const [unassignedStudents, setUnassignedStudents] = useState<StudentRecord[]>([]);
 const [selectedUnassigned, setSelectedUnassigned] = useState<number[]>([]);
 const [targetFacultyId, setTargetFacultyId] = useState<number | null>(null);
 const [loading, setLoading] = useState<boolean>(true);
 const [actionLoading, setActionLoading] = useState<boolean>(false);
 const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

 useEffect(() => {
 if (deptId && deptId !== selectedDeptId) {
 setSelectedDeptId(deptId);
 }
 }, [deptId]);

 const loadData = useCallback(async () => {
 setLoading(true);
 setMessage(null);
 try {
 const wRes = await getFacultyWorkload(selectedDeptId);
 setWorkload(wRes.faculty_workload || []);

 const uRes = await getCommandCenterStudents({
 dept_id: selectedDeptId,
 allocation_filter: 'UNASSIGNED',
 page_size: 50
 });
 setUnassignedStudents(uRes.students || []);
 setSelectedUnassigned([]);
 } catch (e: any) {
 console.error('Workload load failed:', e);
 } finally {
 setLoading(false);
 }
 }, [selectedDeptId]);

 useEffect(() => {
 if (isOpen) {
 loadData();
 document.body.style.overflow = 'hidden';
 }
 return () => {
 document.body.style.overflow = '';
 };
 }, [isOpen, selectedDeptId, loadData]);

 const handleAutoDistribute = async () => {
 setActionLoading(true);
 setMessage(null);
 try {
 const res = await autoDistributeDepartment(selectedDeptId);
 setMessage({ type: 'success', text: `Auto-distribution complete: ${res.assigned_count || 0} students assigned across faculty mentors.` });
 await loadData();
 onRefreshAll();
 } catch (e: any) {
 setMessage({ type: 'error', text: e?.response?.data?.detail || 'Auto-distribution failed.' });
 } finally {
 setActionLoading(false);
 }
 };

 const handleBatchAssign = async () => {
 if (!targetFacultyId || selectedUnassigned.length === 0) return;
 setActionLoading(true);
 setMessage(null);
 try {
 await assignStudentsBatch(targetFacultyId, selectedUnassigned);
 setMessage({ type: 'success', text: `Successfully allocated ${selectedUnassigned.length} students to mentor.` });
 await loadData();
 onRefreshAll();
 } catch (e: any) {
 setMessage({ type: 'error', text: e?.response?.data?.detail || 'Batch assignment failed.' });
 } finally {
 setActionLoading(false);
 }
 };

 const handleUnassignStudent = async (facultyId: number, studentId: number) => {
 setActionLoading(true);
 try {
 await unassignStudentsBatch(facultyId, [studentId]);
 setMessage({ type: 'success', text: 'Student unassigned and returned to queue.' });
 await loadData();
 onRefreshAll();
 } catch (e: any) {
 setMessage({ type: 'error', text: 'Unassign failed.' });
 } finally {
 setActionLoading(false);
 }
 };

 if (!isOpen) return null;

 return createPortal(
 <div className="modal-overlay-responsive z-[999999] animate-fade-in" onClick={e => e.target === e.currentTarget && onClose()}>
 <div className="modal-container-responsive mobile-responsive-modal bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 w-full max-w-4xl max-h-[92vh] sm:max-h-[90vh]">
        {/* Mobile Swipe Drag Handle */}
        <SwipeHandle onClose={onClose} className="pt-2 pb-1 mt-1 mb-1" pillClassName="bg-slate-300 dark:bg-navy-700 hover:bg-slate-400" />
 {/* Modal Header */}
 <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-navy-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
 <div className="flex items-center gap-3">
 <div className="p-2 rounded-xl bg-brand-50 text-brand-600 shrink-0">
 <Users size={18} />
 </div>
 <div className="min-w-0">
 <h3 className="font-display text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
 HOD Faculty Mentorship & Student Allocation Manager
 </h3>
 <p className="text-xs text-slate-700 dark:text-slate-400 truncate">Enforces institutional 1:20 faculty-to-student mentor ratio</p>
 </div>
 </div>
 <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto pr-1">
 <div className="flex-1 sm:flex-initial min-w-0 relative max-w-[260px] sm:max-w-[300px]">
 <GlobalFilter
 value={selectedDeptId.toString()}
 onChange={val => setSelectedDeptId(Number(val))}
 dropdownWidth="w-64 sm:w-72"
 align="right"
 options={departments.map((d: any) => ({ value: String(d.id), label: d.name, pillText: d.code }))}
 icon={<Building2 className="w-4 h-4" />}
 />
 </div>
 <button onClick={onClose} className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 shrink-0 touch-target-min flex items-center justify-center"><X size={18} /></button>
 </div>
 </div>

 {/* Modal Body */}
 <div className="p-4 sm:p-5 overflow-y-auto overflow-x-hidden space-y-5 flex-1 text-xs">
 {message && (
 <div className={`p-3 rounded-xl font-medium ${message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
 {message.text}
 </div>
 )}

 {/* Quick Actions Bar */}
 <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 dark:border-amber-500/30 flex items-center justify-between shadow-2xs">
 <div className="flex items-center gap-3">
 <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">
 <UserX className="w-4 h-4" />
 </div>
 <div>
 <div className="font-black text-slate-900 dark:text-white text-xs uppercase tracking-wider font-display">Unassigned Students Queue</div>
 <div className="text-xs text-slate-700 dark:text-slate-200 font-bold">Students waiting for faculty mentor allocation</div>
 </div>
 </div>
 <span className="px-3.5 py-1.5 rounded-full bg-amber-500/15 text-amber-900 dark:text-amber-300 border border-amber-500/30 font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-2xs">
  {unassignedStudents.length} Pending
 </span>
 </div>

 {/* Faculty Workload Grid */}
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <h4 className="font-black text-slate-900 dark:text-white text-xs uppercase tracking-wider flex items-center gap-2 font-display">
 <Users className="w-4 h-4 text-brand-500" />
 <span>Department Faculty Workload Matrix</span>
 </h4>
 <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-navy-800 text-slate-800 dark:text-slate-200 font-extrabold text-[11px] uppercase tracking-wider border border-slate-300 dark:border-navy-600">
 1:20 Ideal Ratio Target
 </span>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 {workload.map(fac => {
 const count = fac.assigned_students || 0;
 const maxCapacity = fac.max_capacity || 20;
 const pct = Math.min(100, Math.round((count / maxCapacity) * 100));
 const initials = (fac.faculty_name || 'FC')
 .split(' ')
 .filter(Boolean)
 .map(n => n[0])
 .join('')
 .substring(0, 2)
 .toUpperCase();

 const isOverloaded = count > maxCapacity;
 const isAtRatio = fac.workload_status === 'AT_RATIO';

 const badgeStyle = isOverloaded
 ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30'
 : isAtRatio
 ? 'bg-brand-500/10 text-brand-700 dark:text-brand-300 border-brand-500/30'
 : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';

 const dotColor = isOverloaded ? 'bg-rose-500' : isAtRatio ? 'bg-brand-500' : 'bg-emerald-500';

 const progressFillStyle = isOverloaded
 ? 'bg-gradient-to-r from-rose-500 via-pink-500 to-rose-400 shadow-xs shadow-rose-500/20'
 : count > 0
 ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 shadow-xs shadow-emerald-500/20'
 : 'bg-slate-300 dark:bg-navy-700';

 return (
 <div
 key={fac.faculty_id}
 className="p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-navy-700/80 bg-white/95 dark:bg-navy-900/95 shadow-2xs hover:shadow-md hover:border-slate-300 dark:hover:border-navy-600 transition-all duration-200 space-y-4 group relative overflow-hidden"
 >
 {/* Header: Avatar, Info & Status */}
 <div className="flex items-start justify-between gap-3">
 <div className="flex items-center gap-3 min-w-0">
 <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 via-indigo-600 to-purple-600 text-white font-black text-xs flex items-center justify-center shadow-xs shrink-0 font-display group-hover:scale-105 transition-transform duration-200">
 {initials}
 </div>
 <div className="min-w-0">
 <div className="font-black text-slate-900 dark:text-white font-display text-sm truncate leading-snug">
 {fac.faculty_name}
 </div>
                        <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate flex items-center gap-1 mt-0.5">
                          <Mail className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 shrink-0" />
                          <span className="truncate">{fac.email}</span>
                        </div>
                      </div>
                    </div>

                    <span className={`px-2.5 py-1 rounded-full text-xs font-black border flex items-center gap-1.5 shrink-0 shadow-2xs ${
                      isOverloaded
                        ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30'
                        : count === maxCapacity
                        ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
                        : count > 0
                        ? 'bg-brand-500/10 text-brand-700 dark:text-brand-300 border-brand-500/30'
                        : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                    }`}>
                      <span className={`w-2 h-2 rounded-full ${
                        isOverloaded ? 'bg-rose-500 animate-ping' : count === maxCapacity ? 'bg-amber-500' : count > 0 ? 'bg-brand-500' : 'bg-emerald-500'
                      }`} />
                      {count}/{maxCapacity} ({pct}%)
                    </span>
                  </div>

                  {/* Redesigned Visual Mentorship Workload Section */}
                  <div className="p-3 rounded-xl bg-slate-50/90 dark:bg-navy-950/80 border border-slate-200/80 dark:border-navy-800 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px] font-black text-slate-800 dark:text-slate-100 font-display">
                        <Activity className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                        Mentorship Workload
                      </span>
                      <span className="font-mono font-black text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <span className="text-brand-600 dark:text-brand-400">{count}</span> / {maxCapacity} slots
                        <span className={`text-[10px] font-sans font-extrabold px-1.5 py-0.5 rounded ${
                          maxCapacity - count > 0 
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                        }`}>
                          {maxCapacity - count > 0 ? `${maxCapacity - count} free` : 'Full'}
                        </span>
                      </span>
                    </div>

                    {/* 20 Segmented Slot Blocks Indicator */}
                    <div className="flex gap-1 h-3.5 items-center">
                      {Array.from({ length: maxCapacity }).map((_, idx) => {
                        const isSlotFilled = idx < count;
                        return (
                          <div
                            key={idx}
                            title={`Slot ${idx + 1}: ${isSlotFilled ? (fac.students?.[idx]?.name || 'Assigned Mentee') : 'Available Slot'}`}
                            className={`flex-1 h-full rounded-xs transition-all duration-300 ${
                              isSlotFilled
                                ? isOverloaded
                                  ? 'bg-rose-500 shadow-xs shadow-rose-500/30'
                                  : count === maxCapacity
                                  ? 'bg-amber-500 shadow-xs shadow-amber-500/30'
                                  : 'bg-gradient-to-t from-emerald-600 to-teal-400 dark:from-emerald-500 dark:to-teal-300 shadow-xs shadow-emerald-500/30'
                                : 'bg-slate-200/80 dark:bg-navy-800/80 border border-slate-300/50 dark:border-navy-700/50 hover:bg-slate-300 dark:hover:bg-navy-700'
                            }`}
                          />
                        );
                      })}
                    </div>

                    {/* Micro progress line beneath slot blocks */}
                    <div className="w-full h-1.5 rounded-full bg-slate-200/90 dark:bg-navy-900 overflow-hidden relative">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ease-out ${
                          isOverloaded
                            ? 'bg-gradient-to-r from-rose-500 via-pink-500 to-red-600'
                            : count === maxCapacity
                            ? 'bg-gradient-to-r from-amber-500 to-orange-400'
                            : count > 0
                            ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-brand-500'
                            : 'bg-transparent'
                        }`}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </div>

                  {/* Assigned Mentees Section */}
                  <div className="pt-2 border-t border-slate-200/80 dark:border-navy-800 space-y-2">
                    <div className="flex items-center justify-between text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider font-display">
                      <span>Assigned Mentees ({fac.students?.length || 0})</span>
                      {fac.students && fac.students.length > 0 && (
                        <span className="text-[10px] text-slate-700 dark:text-slate-200 font-extrabold">
                          {Math.max(0, maxCapacity - count)} slots available
                        </span>
                      )}
                    </div>

                    {fac.students && fac.students.length > 0 ? (
                      <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-1 custom-scrollbar content-start">
                        {fac.students.map(s => (
                          <span
                            key={s.id}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white dark:bg-navy-800 border border-slate-200/90 dark:border-navy-700 text-[11px] font-bold text-slate-700 dark:text-slate-300 shadow-sm group/tag hover:-translate-y-0.5 hover:border-rose-300 dark:hover:border-rose-800 hover:shadow-md transition-all"
                          >
                            <span className="w-4 h-4 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 text-[9px] font-black flex items-center justify-center shrink-0">
                              {s.name ? s.name.charAt(0).toUpperCase() : 'S'}
                            </span>
                            <span className="truncate max-w-[110px]">{s.name}</span>
                            <button
                              onClick={() => handleUnassignStudent(fac.faculty_id, s.id)}
                              title="Unassign mentee"
                              className="!min-h-0 !min-w-0 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1 rounded-lg transition-colors flex items-center justify-center hover:bg-rose-50 dark:hover:bg-rose-500/10"
                            >
                              <X size={12} strokeWidth={2.5} />
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 py-2.5 px-3.5 rounded-xl border border-emerald-200/80 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-2xs">
                        <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>No mentees assigned — {maxCapacity} slots ready for allocation</span>
                      </div>
                    )}
                  </div>
 </div>
 );
 })}
 </div>
 </div>

        {/* Unassigned Students Selection Box */}
        {unassignedStudents.length > 0 && (
          <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-navy-700/80 bg-white/95 dark:bg-navy-900/95 space-y-4 shadow-2xs">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-slate-100 dark:border-navy-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-black text-slate-900 dark:text-white text-sm font-display leading-tight">
                    Manual Student Allocation
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Select pending students to assign to a faculty mentor</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 w-full sm:w-auto">
                <div className="flex-1 sm:flex-initial min-w-0 relative">
                  <GlobalFilter
                    value={targetFacultyId?.toString() || ""}
                    onChange={val => setTargetFacultyId(Number(val))}
                    dropdownWidth="w-full sm:w-64"
                    align="right"
                    options={[
                      { value: "", label: "Select target faculty..." },
                      ...workload.map((f: any) => ({ value: String(f.faculty_id), label: `${f.faculty_name} (${f.assigned_students}/20)` }))
                    ]}
                    icon={<User className="w-4 h-4" />}
                  />
                </div>
                <button
                  disabled={!targetFacultyId || selectedUnassigned.length === 0 || actionLoading}
                  onClick={handleBatchAssign}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs disabled:opacity-40 transition shadow-sm cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <UserCheck size={14} />
                  Assign ({selectedUnassigned.length})
                </button>
              </div>
            </div>

            {/* Select All Controls */}
            <div className="flex items-center justify-between py-1">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={selectedUnassigned.length === unassignedStudents.length && unassignedStudents.length > 0}
                  onChange={e => {
                    if (e.target.checked) setSelectedUnassigned(unassignedStudents.map(s => s.id));
                    else setSelectedUnassigned([]);
                  }}
                  className="w-4 h-4 rounded-md border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                />
                <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300">
                  Select All ({unassignedStudents.length} Students)
                </span>
              </label>
              {selectedUnassigned.length > 0 && (
                <span className="px-2.5 py-0.5 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 font-extrabold text-xs">
                  {selectedUnassigned.length} selected
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-80 overflow-y-auto pt-1 pr-1 custom-scrollbar">
              {unassignedStudents.map(s => {
                const isChecked = selectedUnassigned.includes(s.id);
                return (
                  <label
                    key={s.id}
                    className={`p-3 rounded-xl border flex items-center gap-3 transition-all cursor-pointer select-none ${
                      isChecked
                        ? 'bg-brand-50/80 dark:bg-brand-950/80 border-brand-400 dark:border-brand-600 shadow-2xs ring-1 ring-brand-400/30'
                        : 'border-slate-200/80 dark:border-navy-700/80 bg-slate-50/50 dark:bg-navy-950/40 hover:bg-slate-100 dark:hover:bg-navy-800/60'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={e => {
                        if (e.target.checked) setSelectedUnassigned(prev => [...prev, s.id]);
                        else setSelectedUnassigned(prev => prev.filter(id => id !== s.id));
                      }}
                      className="w-4 h-4 rounded-md border-slate-300 text-brand-600 focus:ring-brand-500 shrink-0 cursor-pointer"
                    />
                    <div className="truncate min-w-0 flex-1">
                      <div className="truncate text-slate-900 dark:text-white font-extrabold text-xs leading-snug">
                        {s.name}
                      </div>
                      <div className="text-[11px] font-bold text-amber-700 dark:text-amber-400 mt-0.5 font-mono">
                        {s.reg_no}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-100 dark:border-navy-800 flex justify-end gap-2">
        <button onClick={onClose} className="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-navy-800 hover:bg-slate-200 dark:hover:bg-navy-700 text-slate-700 dark:text-slate-300 font-extrabold text-xs transition shadow-2xs cursor-pointer">
          Close Manager
        </button>
      </div>
 </div>
 </div>,
 document.body
 );
};

// Dedicated Report Hub Modal 

const ReportHubModal: React.FC<{
 isOpen: boolean;
 onClose: () => void;
 deptId?: number;
 departments: DepartmentRecord[];
}> = ({ isOpen, onClose, deptId, departments }) => {
 const [selectedReportType, setSelectedReportType] = useState<string>('EXECUTIVE');
 const [selectedDeptId, setSelectedDeptId] = useState<number | string | undefined>(deptId);
 const [selectedYear, setSelectedYear] = useState<string>('ALL');
 const [selectedSection, setSelectedSection] = useState<string>('ALL');
 const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
 
 const [reportData, setReportData] = useState<any>(null);
 const [loading, setLoading] = useState<boolean>(true);
 const [downloadingExcel, setDownloadingExcel] = useState(false);
 const [downloadingPdf, setDownloadingPdf] = useState(false);

 const currentDeptObj = useMemo(() => {
   if (!selectedDeptId && selectedDeptId !== 0) return undefined;
   return departments.find(d => String(d.id) === String(selectedDeptId) || d.code === String(selectedDeptId));
 }, [selectedDeptId, departments]);

 const isSingleCohortDept = useMemo(() => {
   if (!currentDeptObj) return false;
   const code = (currentDeptObj.code || '').toUpperCase();
   const name = (currentDeptObj.name || '').toLowerCase();
   return code.includes('CS') || code.includes('CYBER') || code.includes('IOT') || name.includes('cyber') || name.includes('iot');
 }, [currentDeptObj]);

 useEffect(() => {
   if (isSingleCohortDept && selectedSection !== 'ALL') {
     setSelectedSection('ALL');
   }
 }, [isSingleCohortDept, selectedSection]);

 // Canonical Single Source of Truth Report Scope Object
 const reportScope = useMemo(() => {
 const dept = currentDeptObj;
 return {
 reportType: selectedReportType,
 departmentId: selectedDeptId,
 departmentCode: dept?.code || 'ALL',
 departmentName: dept?.name || 'All Institutional Departments',
 academicYear: selectedYear,
 section: isSingleCohortDept ? 'ALL' : selectedSection,
 status: selectedStatus,
 };
 }, [selectedReportType, selectedDeptId, selectedYear, selectedSection, selectedStatus, currentDeptObj, isSingleCohortDept]);

 const loadReport = useCallback(async () => {
 setLoading(true);
 try {
 const data = await getReportData({
 report_type: selectedReportType,
 dept_id: (selectedDeptId !== undefined && selectedDeptId !== '') ? Number(selectedDeptId) : undefined,
 year_level: selectedYear !== 'ALL' ? selectedYear : undefined,
 section: selectedSection !== 'ALL' ? selectedSection : undefined,
 status_filter: selectedStatus !== 'ALL' ? selectedStatus : undefined,
 });
 setReportData(data);
 } catch (e) {
 console.error(e);
 } finally {
 setLoading(false);
 }
 }, [selectedReportType, selectedDeptId, selectedYear, selectedSection, selectedStatus]);

 const getFilterQueryParams = () => {
 const params = new URLSearchParams();
 if (selectedDeptId) params.append('dept_id', String(selectedDeptId));
 if (reportScope.departmentCode !== 'ALL') params.append('department', reportScope.departmentCode);
 if (selectedYear !== 'ALL') params.append('year', selectedYear);
 if (selectedSection !== 'ALL') params.append('section', selectedSection);
 if (selectedStatus !== 'ALL') params.append('status', selectedStatus);
 const qs = params.toString();
 return qs ? `?${qs}` : '';
 };

 const handleDownloadExcel = async () => {
 setDownloadingExcel(true);
 try {
 const qsParams = new URLSearchParams();
      qsParams.append("report_type", selectedReportType);
      if (selectedDeptId) qsParams.append("dept_id", String(selectedDeptId));
      if (selectedYear !== "ALL") qsParams.append("year_level", selectedYear);
      if (selectedSection !== "ALL") qsParams.append("section", selectedSection);
      if (selectedStatus !== "ALL") qsParams.append("status_filter", selectedStatus);
      const qParam = getFilterQueryParams();
 const deptSlug = reportScope.departmentCode !== 'ALL' ? `_${reportScope.departmentCode}` : '_ALL';
 const yearSlug = selectedYear !== 'ALL' ? `_Yr${selectedYear}` : '';
 const secSlug = selectedSection !== 'ALL' ? `_Sec${selectedSection}` : '';
 const filename = `NEC_${selectedReportType}_Report_${currentDeptObj?.code || reportScope.departmentCode}${selectedYear !== 'ALL' ? `_Yr${selectedYear}` : ''}${selectedSection !== 'ALL' ? `_Sec${selectedSection}` : ''}_${new Date().toISOString().slice(0, 10)}.xlsx`;

 const res = await downloadManager.download({
 endpoint: `/command-center/reports/export-excel?${qsParams.toString()}`,
 filename,
 mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
 });
 if (!res.success) {
 alert(res.error || "Failed to download Excel report.");
 }
 } catch (err) {
 console.error("Report download error:", err);
 alert("Failed to download Excel report.");
 } finally {
 setDownloadingExcel(false);
 }
 };

 const handleDownloadPdf = async () => {
 setDownloadingPdf(true);
 try {
 const qParam = getFilterQueryParams();
 const deptSlug = reportScope.departmentCode !== 'ALL' ? `_${reportScope.departmentCode}` : '_ALL';
 const yearSlug = selectedYear !== 'ALL' ? `_Yr${selectedYear}` : '';
 const secSlug = selectedSection !== 'ALL' ? `_Sec${selectedSection}` : '';
 const filename = `NEC_${selectedReportType}_Report${deptSlug}${yearSlug}${secSlug}_${new Date().toISOString().slice(0, 10)}.pdf`;

 const res = await downloadManager.download({
 endpoint: `/reports/export-pdf${qParam}`,
 filename,
 mimeType: 'application/pdf',
 });
 if (!res.success) {
 alert(res.error || "Failed to download PDF report.");
 }
 } catch (err) {
 console.error("Report download error:", err);
 alert("Failed to download PDF report.");
 } finally {
 setDownloadingPdf(false);
 }
 };

 useEffect(() => {
 if (isOpen) {
 loadReport();
 document.body.style.overflow = 'hidden';
 }
 return () => {
 document.body.style.overflow = '';
 };
 }, [isOpen, loadReport]);

 if (!isOpen || typeof document === 'undefined') return null;

 return createPortal(
 <div className="fixed inset-0 w-screen h-[100dvh] z-[999999] flex flex-col bg-slate-50 dark:bg-navy-950 animate-fade-in overflow-hidden" onClick={e => e.target === e.currentTarget && onClose()}>
 <div className="w-full h-full flex flex-col text-slate-900 dark:text-white antialiased bg-white dark:bg-navy-950">
 {/* Header */}
 <div className="px-4 py-3 sm:px-6 sm:py-4 bg-slate-50 dark:bg-navy-900 border-b border-slate-200 dark:border-navy-800 flex items-center justify-between shrink-0">
 <div className="flex items-center gap-3">
 <div className="p-2.5 rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20 shadow-xs">
 <FileSpreadsheet className="w-5 h-5" />
 </div>
 <div>
 <h3 className="font-display text-sm sm:text-lg font-black text-slate-950 dark:text-white">
 Institutional Executive Report Generator
 </h3>
 <p className="text-[10px] sm:text-xs text-slate-600 dark:text-slate-300 font-bold">Dynamic filter-aware audit and accreditation reports</p>
 </div>
 </div>
 <button
 onClick={onClose}
 className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-navy-800 transition-colors cursor-pointer"
 >
 <X className="w-5 h-5" />
 </button>
 </div>

 {/* Body */}
 <div className="p-3 sm:p-8 overflow-y-auto space-y-4 sm:space-y-7 flex-1 min-h-0 text-xs custom-scrollbar">
 {/* Controls Grid */}
 <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-slate-50 via-white to-slate-100/80 dark:from-navy-900 dark:via-navy-950 dark:to-navy-900 border border-slate-200/90 dark:border-navy-800 shadow-md p-3 sm:p-6 space-y-3 sm:space-y-4">
 <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-500 via-indigo-500 to-purple-500" />

 <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-navy-800 pb-3 mb-1">
 <div className="flex items-center gap-2.5">
 <div className="p-2 rounded-xl bg-brand-50 dark:bg-brand-950/70 text-brand-600 dark:text-brand-400 border border-brand-200/60 dark:border-brand-800/40 shadow-xs">
 <SlidersHorizontal className="w-4 h-4" />
 </div>
 <div>
 <h4 className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-wider">Report Configuration & Scope Filters</h4>
 <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Refine parameters to dynamically update institutional reports</p>
 </div>
 </div>
 <div className="hidden sm:flex items-center px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono font-bold border border-emerald-200 dark:border-emerald-800/40 shadow-xs">
 <span>Live Scope Synced</span>
 </div>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-12 gap-2 sm:gap-5">
 <div className="md:col-span-4 bg-white/80 dark:bg-navy-950/60 p-2 sm:p-3.5 rounded-xl sm:rounded-2xl border border-slate-200/80 dark:border-navy-800/70 shadow-2xs hover:border-brand-300 dark:hover:border-brand-700 transition-colors">
 <div className="flex items-center justify-between mb-1.5">
 <label className="block text-[11px] font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Report Type</label>
 <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400 border border-brand-200/50 dark:border-brand-800/50">Primary</span>
 </div>
 <GlobalFilter
 value={selectedReportType}
 onChange={val => setSelectedReportType(val)}
 dropdownWidth="min-w-[460px]"
 options={[
 { value: "EXECUTIVE", label: "Executive Coding Health Report", pillText: "EXE" },
 { value: "FACULTY_ALLOCATION", label: "Faculty Mentorship Audit Report", pillText: "FAC" },
 { value: "INACTIVE_AT_RISK", label: "Inactive & At-Risk Intervention Report", pillText: "INA" }
 ]}
 icon={<FileText className="w-4 h-4 text-brand-500" />}
 />
 </div>

 <div className="md:col-span-4 bg-white/80 dark:bg-navy-950/60 p-2 sm:p-3.5 rounded-xl sm:rounded-2xl border border-slate-200/80 dark:border-navy-800/70 shadow-2xs hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
 <div className="flex items-center justify-between mb-1.5">
 <label className="block text-[11px] font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Department Scope</label>
 <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/50">Scope</span>
 </div>
 <GlobalFilter
 value={selectedDeptId?.toString() || ""}
 onChange={val => setSelectedDeptId(val ? (isNaN(Number(val)) ? val : Number(val)) : undefined)}
 dropdownWidth="min-w-[460px]"
 options={[
   ...(departments.length > 1 ? [{ value: "", label: "All Authorized Departments", pillText: "ALL" }] : []),
   ...departments.map((d: any) => ({ value: String(d.id ?? d.code), label: d.name, pillText: d.code }))
 ]}
 icon={<Building2 className="w-4 h-4 text-indigo-500" />}
 />
 </div>

 <div className={`bg-white/80 dark:bg-navy-950/60 p-2 sm:p-3.5 rounded-xl sm:rounded-2xl border border-slate-200/80 dark:border-navy-800/70 shadow-2xs hover:border-amber-300 dark:hover:border-amber-700 transition-colors ${isSingleCohortDept ? 'md:col-span-4' : 'md:col-span-2'}`}>
 <div className="flex items-center justify-between mb-1.5">
 <label className="block text-[11px] font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Academic Year</label>
 <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/50">Batch</span>
 </div>
 <GlobalFilter
 value={selectedYear}
 onChange={val => setSelectedYear(val)}
 dropdownWidth="min-w-[320px]"
 searchPlaceholder="Search academic year..."
 options={[
 { value: "ALL", label: "All Academic Years", pillText: "ALL" },
 { value: "1", label: "I Year", pillText: "1ST" },
 { value: "2", label: "II Year", pillText: "2ND" },
 { value: "3", label: "III Year", pillText: "3RD" },
 { value: "4", label: "IV Year", pillText: "4TH" }
 ]}
 icon={<Calendar className="w-4 h-4 text-amber-500" />}
 />
 </div>

 {!isSingleCohortDept && (
 <div className="md:col-span-2 bg-white/80 dark:bg-navy-950/60 p-2 sm:p-3.5 rounded-xl sm:rounded-2xl border border-slate-200/80 dark:border-navy-800/70 shadow-2xs hover:border-purple-300 dark:hover:border-purple-700 transition-colors">
 <div className="flex items-center justify-between mb-1.5">
 <label className="block text-[11px] font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Section / Cohort</label>
 <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 border border-purple-200/50 dark:border-purple-800/50">
   Cohort
 </span>
 </div>
 <GlobalFilter
 value={selectedSection}
 onChange={val => setSelectedSection(val)}
 dropdownWidth="min-w-[240px]"
 searchPlaceholder="Search section..."
 options={[
   { value: "ALL", label: "All Sections", pillText: "ALL" },
   { value: "A", label: "Section A", pillText: "A" },
   { value: "B", label: "Section B", pillText: "B" },
   { value: "C", label: "Section C", pillText: "C" }
 ]}
 icon={<Layers className="w-4 h-4 text-purple-500" />}
 />
 </div>
 )}
 </div>
 </div>



 {/* Live Preview Paper */}
 {loading ? (
 <div className="p-16 text-center text-slate-700 dark:text-slate-400 font-black text-sm">Loading live report data for selected scope...</div>
 ) : (
 <div className="mt-6 sm:mt-8 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 shadow-lg space-y-6 sm:space-y-7 text-slate-900 dark:text-white">
 <div className="border-b border-slate-200 dark:border-navy-800 pb-4 sm:pb-5 mb-2 flex justify-between items-center flex-wrap gap-4">
 <div className="flex items-center space-x-3">
 <img src="/nandha_emblem.png" alt="Nandha Emblem" className="h-10 w-auto object-contain hidden sm:block" onError={(e: any) => { e.target.style.display = 'none'; }} />
 <div>
 <div className="text-xs font-extrabold uppercase text-slate-700 dark:text-slate-400 tracking-wider">INSTITUTIONAL AUDIT & PERFORMANCE REPORT</div>
 <h2 className="text-base sm:text-lg font-black text-slate-950 dark:text-white mt-0.5 tracking-tight">{reportData?.report_title}</h2>
 </div>
 </div>
 <div className="flex items-center space-x-3">
 <div className="text-right text-xs text-slate-600 dark:text-slate-300 font-bold">
 {reportData?.generated_at}
 </div>
 <img src="/nec_25_years_logo_transparent.png" alt="Nandha 25 Years Logo" className="h-10 w-auto object-contain hidden sm:block" onError={(e: any) => { e.target.style.display = 'none'; }} />
 </div>
 </div>

 {/* Report Contents */}
 {selectedReportType === 'EXECUTIVE' && (
 <div className="space-y-4">
 <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-5">
 {Object.entries(reportData?.summary_metrics || {}).map(([k, v]: any) => (
 <div key={k} className="p-3 sm:p-5 rounded-2xl bg-slate-50 dark:bg-navy-950 border border-slate-200/90 dark:border-navy-800 shadow-xs">
 <div className="text-[10px] sm:text-xs text-slate-700 dark:text-slate-400 font-extrabold uppercase tracking-wider leading-snug">{k}</div>
 <div className="text-lg sm:text-2xl font-black text-brand-600 dark:text-brand-400 mt-1 sm:mt-1.5 tracking-tight">{String(v)}</div>
 </div>
 ))}
 </div>

 <div className="overflow-x-auto table-responsive-container">
 <table className="w-full text-left text-xs border-collapse mobile-card-table">
 <thead className="hidden md:table-header-group">
 <tr className="border-b border-slate-200 dark:border-navy-800 font-bold text-slate-700 dark:text-slate-400 uppercase text-xs tracking-wider">
 <th className="py-2.5 px-3">Dimension</th>
 <th className="py-2.5 px-3 text-right">Score</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100 dark:divide-navy-800/80 text-slate-800 dark:text-slate-200 font-sans">
 {(reportData?.dimension_breakdown || []).map((row: any, i: number) => (
 <tr key={i} className="hover:bg-slate-50 dark:hover:bg-navy-800/50 transition-colors">
 <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100">{row.dimension}</td>
 <td className="py-2.5 px-3 text-right font-extrabold text-brand-600 dark:text-brand-400">{row.score}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 )}

 {selectedReportType === 'FACULTY_ALLOCATION' && (
 <div className="space-y-5 font-sans">
 {/* Summary Cards */}
 <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-4">
 {Object.entries(reportData?.summary_metrics || {}).map(([k, v]: any) => (
 <div key={k} className="p-3 sm:p-4 rounded-2xl bg-slate-50 dark:bg-navy-950 border border-slate-200/90 dark:border-navy-800 shadow-xs">
 <div className="text-[10px] sm:text-xs text-slate-700 dark:text-slate-400 font-extrabold uppercase tracking-wider leading-snug">{k}</div>
 <div className="text-lg sm:text-xl font-black text-brand-600 dark:text-brand-400 mt-1 tracking-tight">{String(v)}</div>
 </div>
 ))}
 </div>

 <div className="overflow-x-auto table-responsive-container">
 <table className="w-full text-left text-xs border-collapse mobile-card-table font-sans">
 <thead className="hidden md:table-header-group">
 <tr className="border-b border-slate-300 dark:border-navy-700 font-extrabold text-slate-800 dark:text-slate-100 bg-slate-100/90 dark:bg-navy-900 uppercase text-xs tracking-wider">
 <th className="py-2.5 px-3">Faculty Mentor</th>
 <th className="py-2.5 px-3">Dept</th>
 <th className="py-2.5 px-3 text-right">Limit</th>
 <th className="py-2.5 px-3 text-right">Assigned</th>
 <th className="py-2.5 px-3 text-right">Active</th>
 <th className="py-2.5 px-3 text-right">Inactive</th>
 <th className="py-2.5 px-3 text-right">Active %</th>
 <th className="py-2.5 px-3 text-right">Total Solves</th>
 <th className="py-2.5 px-3 text-center">Ratio Status</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100 dark:divide-navy-800/80 text-slate-900 dark:text-slate-100 font-sans">
 {(reportData?.faculty_records || []).map((fac: any) => (
 <tr key={fac.faculty_id} className="hover:bg-slate-50 dark:hover:bg-navy-800/60 transition-colors">
 <td className="py-2.5 px-3 font-bold text-slate-950 dark:text-white text-xs sm:text-sm">{fac.faculty_name}</td>
 <td className="py-2.5 px-3 font-bold text-slate-700 dark:text-slate-300">{fac.department_code}</td>
 <td className="py-2.5 px-3 text-right font-bold text-slate-500">{fac.max_capacity || 20}</td>
 <td className="py-2.5 px-3 text-right font-extrabold">{fac.assigned_students}</td>
 <td className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400 font-extrabold">{fac.active_students}</td>
 <td className="py-2.5 px-3 text-right text-rose-600 dark:text-rose-400 font-bold">{fac.inactive_students ?? (fac.assigned_students - fac.active_students)}</td>
 <td className="py-2.5 px-3 text-right font-extrabold text-brand-600 dark:text-brand-400">{fac.conversion_rate_pct ?? (fac.assigned_students > 0 ? ((fac.active_students / fac.assigned_students) * 100).toFixed(1) : '0')}%</td>
 <td className="py-2.5 px-3 text-right font-black text-amber-600 dark:text-amber-400">{fac.total_mentee_solves ?? 0}</td>
 <td className="py-2.5 px-3 text-center">
 <span className={`px-2.5 py-1 rounded-full text-xs font-black shadow-xs ${
 fac.workload_status === 'NORMAL' || fac.workload_status === 'AT_RATIO'
 ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-900 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40'
 : 'bg-rose-100 dark:bg-rose-500/20 text-rose-900 dark:text-rose-300 border border-rose-300 dark:border-rose-500/40'
 }`}>
 {fac.workload_status}
 </span>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 )}

 {selectedReportType === 'INACTIVE_AT_RISK' && (
 <div className="space-y-3 font-sans">
 <div className="text-xs font-black text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 p-3 rounded-xl border border-rose-200 dark:border-rose-800/50">
 Total Inactive Solvers in Scope: {reportData?.total_inactive}
 </div>
 <div className="overflow-x-auto table-responsive-container">
 <table className="w-full text-left text-xs border-collapse mobile-card-table font-sans">
 <thead className="hidden md:table-header-group">
 <tr className="border-b border-slate-300 dark:border-navy-700 font-extrabold text-slate-800 dark:text-slate-100 bg-slate-100/90 dark:bg-navy-900 uppercase text-xs tracking-wider">
 <th className="py-2.5 px-3">Reg No</th>
 <th className="py-2.5 px-3">Student Name</th>
 <th className="py-2.5 px-3">Dept</th>
 <th className="py-2.5 px-3">Assigned Faculty Mentor</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100 dark:divide-navy-800/80 text-slate-900 dark:text-slate-100 font-sans">
 {(reportData?.students || []).map((st: any) => (
 <tr key={st.reg_no} className="hover:bg-slate-50 dark:hover:bg-navy-800/60 transition-colors">
 <td className="py-2.5 px-3 font-black text-amber-700 dark:text-amber-300 font-sans">{st.reg_no}</td>
 <td className="py-2.5 px-3 font-bold text-slate-950 dark:text-white">{st.name}</td>
 <td className="py-2.5 px-3 font-semibold">{st.department}</td>
 <td className="py-2.5 px-3 text-brand-600 dark:text-brand-400 font-extrabold">{st.assigned_mentor}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 )}
 </div>
 )}
 </div>

 {/* Footer */}
 <div className="p-3 sm:px-6 sm:py-4 bg-slate-50 dark:bg-navy-900 border-t border-slate-200 dark:border-navy-800 flex flex-col sm:flex-row justify-between items-stretch sm:items-center shrink-0 gap-2.5">
 <button
 onClick={handleDownloadPdf}
 disabled={downloadingPdf}
 className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-950 hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-900 dark:text-slate-200 text-xs font-black inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-all touch-manipulation active:scale-95 shadow-xs"
 >
 <Printer size={14} className={downloadingPdf ? 'animate-spin text-amber-500' : 'text-amber-500'} />
 <span>{downloadingPdf ? 'Generating PDF...' : 'Print / Export PDF'}</span>
 </button>
 <div className="grid grid-cols-2 sm:flex gap-2">
 <button
 onClick={handleDownloadExcel}
 disabled={downloadingExcel}
 className="min-h-[42px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all touch-manipulation active:scale-95 shadow-md shadow-emerald-600/20"
 >
 <Download size={13} className={downloadingExcel ? 'animate-spin' : ''} />
 <span>{downloadingExcel ? 'Downloading...' : 'Export Excel (.xlsx)'}</span>
 </button>
 <button
 onClick={onClose}
 className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-200 dark:bg-navy-800 text-slate-900 dark:text-slate-200 font-black hover:bg-slate-300 dark:hover:bg-navy-700 text-xs cursor-pointer transition-all touch-manipulation active:scale-95 flex items-center justify-center"
 >
 Close Hub
 </button>
 </div>
 </div>
 </div>
 </div>,
 document.body
 );
};

export interface InstitutionalSkillGap {
  id: string;
  name: string;
  solve: string;
  solvePct: number;
  target: string;
  targetPct: number;
  status: string;
  color: 'rose' | 'amber' | 'blue';
  deficit: string;
  diagnosis: string;
  rootCauses: string[];
  sprintPlan: {
    duration: string;
    phase1Title: string;
    phase1Desc: string;
    phase2Title: string;
    phase2Desc: string;
    mentorDirectives: string[];
  };
  problems: {
    number: number;
    title: string;
    slug: string;
    difficulty: 'Easy' | 'Medium' | 'Hard';
    pattern: string;
    url: string;
  }[];
}

export const institutionalSkillGaps: InstitutionalSkillGap[] = [
  {
    id: 'dp',
    name: 'Dynamic Programming (DP)',
    solve: '27.3%',
    solvePct: 27.3,
    target: '60.0%',
    targetPct: 60.0,
    status: 'Critical Gap',
    color: 'rose',
    deficit: '-32.7%',
    diagnosis: 'Students demonstrate high cognitive friction when identifying recurrence relations, defining overlapping subproblem state spaces, and transitioning from naive recursive trees to memoization and bottom-up tabulation.',
    rootCauses: [
      'Subproblem overlap and state transition formulation (f(n) = f(n-1) + f(n-2) vs knapsack choice tables)',
      'High overhead converting recursion trees into 1D/2D memory-efficient iterative matrices',
      'Edge condition handling for base cases, 0/negative states, and unfeasible sub-branches'
    ],
    sprintPlan: {
      duration: '2-Week Intensive Sprint',
      phase1Title: 'Week 1: 1D Array Recurrence & Memoization Drill',
      phase1Desc: 'Focus on recursion tree visualization, caching overlapping calls, and 1D state transition tables (Climbing Stairs, House Robber, Coin Change).',
      phase2Title: 'Week 2: 2D Matrix DP, Subsequences & Interview Patterns',
      phase2Desc: 'Transition to grid traversals, longest common subsequences, and hard string edits with space-optimized 2-row rolling buffers.',
      mentorDirectives: [
        'Conduct 2 mandatory live problem walkthrough labs per section with whiteboard state tracing',
        'Require all cohort students to verify test cases and submit at least 5 benchmark DP problems',
        'Pair students with < 30% solve rate with peer coding leads for guided step-by-step debugging'
      ]
    },
    problems: [
      { number: 70, title: 'Climbing Stairs', slug: 'climbing-stairs', difficulty: 'Easy', pattern: '1D State DP / Fibonacci', url: 'https://leetcode.com/problems/climbing-stairs/' },
      { number: 198, title: 'House Robber', slug: 'house-robber', difficulty: 'Medium', pattern: '1D DP / Optimal Substructure Decision', url: 'https://leetcode.com/problems/house-robber/' },
      { number: 322, title: 'Coin Change', slug: 'coin-change', difficulty: 'Medium', pattern: 'Unbounded Knapsack / Min Choice Tabulation', url: 'https://leetcode.com/problems/coin-change/' },
      { number: 300, title: 'Longest Increasing Subsequence', slug: 'longest-increasing-subsequence', difficulty: 'Medium', pattern: '1D DP with Binary Search Patience Sort', url: 'https://leetcode.com/problems/longest-increasing-subsequence/' },
      { number: 72, title: 'Edit Distance', slug: 'edit-distance', difficulty: 'Hard', pattern: '2D String Matrix State Transition', url: 'https://leetcode.com/problems/edit-distance/' }
    ]
  },
  {
    id: 'graph',
    name: 'Graph BFS/DFS & Shortest Path',
    solve: '42.0%',
    solvePct: 42.0,
    target: '65.0%',
    targetPct: 65.0,
    status: 'Attention Needed',
    color: 'amber',
    deficit: '-23.0%',
    diagnosis: 'Students struggle with abstract graph representations (adjacency lists vs matrices), cycle detection invariants in directed graphs, and multi-source BFS queue synchronizations.',
    rootCauses: [
      'Translating grid matrices (2D arrays) into implicit graph vertices and directional neighbors',
      'Cycle detection invariants and topological sorting orders (Kahn\'s algorithm indegree vs DFS 3-color states)',
      'Shortest path edge relaxation and heap state tracking in Dijkstra algorithms'
    ],
    sprintPlan: {
      duration: '2-Week Intensive Sprint',
      phase1Title: 'Week 1: Grid Traversals, Connected Components & Visited Sets',
      phase1Desc: 'Focus on 2D grid flood fill, directional vectors (dx, dy), and visited matrix management (Number of Islands, Clone Graph).',
      phase2Title: 'Week 2: Topological Sorting, DAGs & Dijkstra Shortest Path',
      phase2Desc: 'Drill dependency resolution in course schedules, cycle detection, and weighted shortest path priority queues.',
      mentorDirectives: [
        'Demonstrate BFS queue stepping vs DFS recursion stack unwinding side-by-side in lab',
        'Verify every student implements graph adjacency lists from scratch without helper libraries',
        'Enforce time-complexity proofs (O(V + E)) for all lab assignment submissions'
      ]
    },
    problems: [
      { number: 200, title: 'Number of Islands', slug: 'number-of-islands', difficulty: 'Medium', pattern: 'Grid Traversal / BFS & DFS Visited Island Sinks', url: 'https://leetcode.com/problems/number-of-islands/' },
      { number: 133, title: 'Clone Graph', slug: 'clone-graph', difficulty: 'Medium', pattern: 'Graph Traversal / Hash Map Visited Node Copy', url: 'https://leetcode.com/problems/clone-graph/' },
      { number: 785, title: 'Is Graph Bipartite?', slug: 'is-graph-bipartite', difficulty: 'Medium', pattern: 'BFS / 2-Color Graph Partition Invariant', url: 'https://leetcode.com/problems/is-graph-bipartite/' },
      { number: 207, title: 'Course Schedule', slug: 'course-schedule', difficulty: 'Medium', pattern: 'Topological Sort / Indegree & Cycle Detection', url: 'https://leetcode.com/problems/course-schedule/' },
      { number: 743, title: 'Network Delay Time', slug: 'network-delay-time', difficulty: 'Medium', pattern: 'Dijkstra Algorithm / Min-Heap Edge Relaxation', url: 'https://leetcode.com/problems/network-delay-time/' }
    ]
  },
  {
    id: 'bs_tp',
    name: 'Binary Search & Two Pointers',
    solve: '58.4%',
    solvePct: 58.4,
    target: '75.0%',
    targetPct: 75.0,
    status: 'Improving',
    color: 'blue',
    deficit: '-16.6%',
    diagnosis: 'While linear scanning is familiar, students encounter repeated off-by-one errors on search space boundary updates, monotonic predicates on answer spaces, and multi-pointer symmetry.',
    rootCauses: [
      'Off-by-one boundary bugs (low <= high vs low < high, mid + 1 vs mid)',
      'Determining monotonic properties for binary search on answer spaces (minimum capacity / rate)',
      'Multi-variable sorting constraints and duplicate skipping logic in two-pointer algorithms'
    ],
    sprintPlan: {
      duration: '2-Week Intensive Sprint',
      phase1Title: 'Week 1: Strict Invariants & Rotated Array Search',
      phase1Desc: 'Master canonical binary search templates, integer overflow prevention, and partitioned monotonic intervals.',
      phase2Title: 'Week 2: Search on Answer Space & Two-Pointer Opposing Scans',
      phase2Desc: 'Apply opposing pointers for 2Sum/3Sum duplicate deduplication and greedy interval narrowing.',
      mentorDirectives: [
        'Drill students on the 3 fundamental binary search boundary templates until error-free',
        'Review extreme edge cases: 1-element arrays, duplicated pivot elements, and integer overflow',
        'Conduct a 30-minute speed quiz requiring bug-free two-pointer interval narrowing'
      ]
    },
    problems: [
      { number: 704, title: 'Binary Search', slug: 'binary-search', difficulty: 'Easy', pattern: 'Canonical Template / Boundary Invariant Verification', url: 'https://leetcode.com/problems/binary-search/' },
      { number: 167, title: 'Two Sum II - Input Array Is Sorted', slug: 'two-sum-ii-input-array-is-sorted', difficulty: 'Medium', pattern: 'Opposing Ends Two-Pointer Shrinking Scan', url: 'https://leetcode.com/problems/two-sum-ii-input-array-is-sorted/' },
      { number: 33, title: 'Search in Rotated Sorted Array', slug: 'search-in-rotated-sorted-array', difficulty: 'Medium', pattern: 'Partitioned Monotonic Interval Binary Search', url: 'https://leetcode.com/problems/search-in-rotated-sorted-array/' },
      { number: 11, title: 'Container With Most Water', slug: 'container-with-most-water', difficulty: 'Medium', pattern: 'Greedy Two-Pointer Shrink on Shorter Boundary', url: 'https://leetcode.com/problems/container-with-most-water/' },
      { number: 15, title: '3Sum', slug: '3sum', difficulty: 'Medium', pattern: 'Array Sorting + Opposing Two-Pointer Duplicate Skip', url: 'https://leetcode.com/problems/3sum/' }
    ]
  }
];

// Main Component 

export const HODCommandCenter: React.FC = () => {
 const { user } = useAuth();
 const { notify } = useNotification();
 const roleClean = useMemo(() => (user?.role || '').trim().toLowerCase(), [user?.role]);
 const isGlobalAdmin = useMemo(() => ['admin', 'administrator', 'super admin', 'super_admin'].includes(roleClean), [roleClean]);
 const isHod = useMemo(() => ['hod', 'department hod', 'department_hod', 'placement coordinator'].includes(roleClean), [roleClean]);
 const isGlobalRole = useMemo(() => ['admin', 'super admin', 'super_admin', 'administrator', 'principal', 'management', 'director'].includes(roleClean), [roleClean]);

 const defaultDeptValue = useMemo(() => {
   if (isHod && !isGlobalRole) {
     const authIds: number[] = Array.isArray(user?.authorized_department_ids) ? user.authorized_department_ids : [];
     if (authIds.length > 1) {
       return 'ALL'; // Multi-dept HOD defaults to combined view of all authorized depts (e.g. 150 + 150 = 300)
     }
     if (authIds.length === 1) {
       return String(authIds[0]);
     }
     if (user?.department_id) return String(user.department_id);
   }
   return 'ALL';
 }, [isHod, isGlobalRole, user]);

 // Multi-Dimensional View Scope 
 const [selectedStaff, setSelectedStaff] = useState<string>('ALL');
 const [selectedDept, setSelectedDept] = useState<string>(() => defaultDeptValue);
 const [selectedYear, setSelectedYear] = useState<string>('ALL');
 const [selectedSection, setSelectedSection] = useState<string>('ALL');
 const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
 const [allocationFilter, setAllocationFilter] = useState<'ALL' | 'ALLOCATED' | 'UNASSIGNED'>('ALL');
 const [staffWorkloadFilter, setStaffWorkloadFilter] = useState<'ALL' | 'PENDING' | 'COMPLETED'>('ALL');
  const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false);

 useEffect(() => {
   if (isHod && !isGlobalAdmin) {
     const authIds: number[] = Array.isArray(user?.authorized_department_ids) ? user.authorized_department_ids : [];
     // Only lock to single department if HOD has exactly 1 authorized department
     if (authIds.length === 1 && (selectedDept === 'ALL' || !selectedDept)) {
       setSelectedDept(String(authIds[0]));
     } else if (!selectedDept) {
       setSelectedDept(defaultDeptValue);
     }
   }
 }, [isHod, isGlobalAdmin, defaultDeptValue, selectedDept, user?.authorized_department_ids]);

 // Summary & Metadata
 const [summary, setSummary] = useState<CommandCenterSummary | null>(null);
 const [departments, setDepartments] = useState<DepartmentRecord[]>([]);

 const filteredDepartments = useMemo(() => {
   if (isGlobalRole) return departments;
   if (isHod) {
     const authIds: number[] = Array.isArray(user?.authorized_department_ids) ? user.authorized_department_ids : [];
     const authCodes: string[] = (Array.isArray(user?.authorized_department_codes) ? user.authorized_department_codes : []).map((c: string) => String(c).toUpperCase());
     const uDeptId = user?.department_id ? Number(user.department_id) : null;
     const uDeptCode = String(user?.department || (user as any)?.department_code || '').toUpperCase();

     const matched = departments.filter(d => {
       if (authIds.length > 0 && d.id && authIds.includes(Number(d.id))) return true;
       if (authCodes.length > 0 && d.code && authCodes.includes(d.code.toUpperCase())) return true;
       if (uDeptId && d.id && Number(d.id) === uDeptId) return true;
       if (uDeptCode && d.code && (d.code.toUpperCase() === uDeptCode || uDeptCode.includes(d.code.toUpperCase()))) return true;
       return false;
     });

     return matched.length > 0 ? matched : departments;
   }
   return departments;
 }, [departments, isGlobalRole, isHod, user]);

 const deptOptions = useMemo(() => {
   const list = filteredDepartments.filter(d => (d as any).student_count === undefined || (d as any).student_count > 0);
   const opts = list.map(d => ({ value: String(d.id), label: d.name, pillText: d.code }));

   if (isGlobalRole) {
     return [{ value: 'ALL', label: 'All Institutional Departments', pillText: 'ALL' }, ...opts];
   }
   if (isHod) {
     if (list.length > 1) {
       return [{ value: 'ALL', label: 'All My Authorized Departments', pillText: 'ALL' }, ...opts];
     }
     return opts;
   }
   return [{ value: 'ALL', label: 'All Departments', pillText: 'ALL' }, ...opts];
 }, [filteredDepartments, isGlobalRole, isHod]);

 const [staffList, setStaffList] = useState<StaffRecord[]>([]);
 const [loading, setLoading] = useState<boolean>(true);
 const [scopeLoading, setScopeLoading] = useState<boolean>(false);
 const [refreshing, setRefreshing] = useState<boolean>(false);
 const [error, setError] = useState<string | null>(null);
 const [lastLiveTimestamp, setLastLiveTimestamp] = useState<string>(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
 const [wsConnected, setWsConnected] = useState<boolean>(true);

 // Student Directory Table State
 const [isMobile, setIsMobile] = useState<boolean>(() => typeof window !== 'undefined' && window.innerWidth < 768);
 const [students, setStudents] = useState<StudentRecord[]>([]);
 const [studentsTotal, setStudentsTotal] = useState<number>(0);
 const [studentsPage, setStudentsPage] = useState<number>(1);
 const [studentsSearch, setStudentsSearch] = useState<string>('');
 const [studentsLoading, setStudentsLoading] = useState<boolean>(false);
 const [selectedStudentDetail, setSelectedStudentDetail] = useState<StudentRecord | null>(null);
 const [selectedStaffDetail, setSelectedStaffDetail] = useState<StaffRecord | null>(null);
 const [selectedDeptIntelligence, setSelectedDeptIntelligence] = useState<DeptBenchmark | null>(null);
 const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
 const [batchTargetFaculty, setBatchTargetFaculty] = useState<number | null>(null);

 useEffect(() => {
 const handleResize = () => setIsMobile(window.innerWidth < 768);
 window.addEventListener('resize', handleResize);
 return () => window.removeEventListener('resize', handleResize);
 }, []);

 // Modals
 const [showStaffAllocationModal, setShowStaffAllocationModal] = useState<boolean>(false);
 const [showReportHubModal, setShowReportHubModal] = useState<boolean>(false);
 const [showMethodologyModal, setShowMethodologyModal] = useState<boolean>(false);
 const [showAIModal, setShowAIModal] = useState<boolean>(false);
 const [showWhatIfModal, setShowWhatIfModal] = useState<boolean>(false);
  const [selectedYearBenchmark, setSelectedYearBenchmark] = useState<YearBenchmark | null>(null);
  const [selectedSkillGap, setSelectedSkillGap] = useState<InstitutionalSkillGap | null>(null);
  const [copiedSkillPlan, setCopiedSkillPlan] = useState<boolean>(false);
 const [confirmUnassignTarget, setConfirmUnassignTarget] = useState<{ id: number; name: string } | null>(null);
 const [confirmUnassignLoading, setConfirmUnassignLoading] = useState(false);
 const [aiQuery, setAiQuery] = useState<string>('');
 const [aiResponse, setAiResponse] = useState<any>(null);
 const [aiLoading, setAiLoading] = useState<boolean>(false);
 const [whatIfTarget, setWhatIfTarget] = useState<number>(95);
 const [whatIfResult, setWhatIfResult] = useState<any>(null);

 const { pushContext, popContext, registerEscHandler } = useKeyboardContext();

 const isAnyModalOrDrawerOpen = Boolean(
 selectedStudentDetail || selectedStaffDetail || selectedDeptIntelligence ||
 showStaffAllocationModal || showReportHubModal || showMethodologyModal ||
 showAIModal || showWhatIfModal || confirmUnassignTarget ||
 selectedYearBenchmark || selectedSkillGap
 );

 useEffect(() => {
 if (isAnyModalOrDrawerOpen) {
 document.body.style.overflow = 'hidden';
 pushContext('MODAL');
 const unregister = registerEscHandler(() => {
 if (selectedStudentDetail) setSelectedStudentDetail(null);
 if (selectedStaffDetail) setSelectedStaffDetail(null);
 if (selectedDeptIntelligence) setSelectedDeptIntelligence(null);
 if (showStaffAllocationModal) setShowStaffAllocationModal(false);
 if (showReportHubModal) setShowReportHubModal(false);
 if (showMethodologyModal) setShowMethodologyModal(false);
 if (showAIModal) setShowAIModal(false);
 if (showWhatIfModal) setShowWhatIfModal(false);
 if (confirmUnassignTarget) setConfirmUnassignTarget(null);
 if (selectedYearBenchmark) setSelectedYearBenchmark(null);
 if (selectedSkillGap) setSelectedSkillGap(null);
 });
 return () => {
 document.body.style.overflow = '';
 unregister();
 popContext('MODAL');
 };
 }
 }, [
 isAnyModalOrDrawerOpen, selectedStudentDetail, selectedStaffDetail, selectedDeptIntelligence,
 showStaffAllocationModal, showReportHubModal, showMethodologyModal, showAIModal,
 showWhatIfModal, confirmUnassignTarget, selectedYearBenchmark, selectedSkillGap, pushContext, popContext, registerEscHandler
 ]);


 // Load Scope Data
 const loadScopedData = useCallback(async (isInitial = false, isRefresh = false) => {
 if (isInitial) setLoading(true); else setScopeLoading(true);
 setError(null);

 const deptId = selectedDept !== 'ALL' ? Number(selectedDept) : undefined;
 const staffId = selectedStaff !== 'ALL' ? Number(selectedStaff) : undefined;
 const yearLevel = selectedYear !== 'ALL' ? selectedYear : undefined;

 try {
 if (isRefresh) {
 clearApiCache();
 }
 const summaryData = await getCommandCenterSummary({
 dept_id: deptId,
 staff_id: staffId,
 year_level: yearLevel,
 refresh: isRefresh
 });
 setSummary(summaryData);
 if (summaryData.staff_list) setStaffList(summaryData.staff_list);
 setLastLiveTimestamp(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
 } catch (err: any) {
 console.error('Command center load error:', err);
 setError(err?.message || 'Unable to connect to analytics database.');
 } finally {
 setLoading(false);
 setScopeLoading(false);
 setRefreshing(false);
 }
 }, [selectedDept, selectedStaff, selectedYear]);

 // Load Students List
 const loadStudents = useCallback(async () => {
 setStudentsLoading(true);
 clearApiCache();
 const deptId = selectedDept !== 'ALL' ? Number(selectedDept) : undefined;
 const staffId = selectedStaff !== 'ALL' ? Number(selectedStaff) : undefined;
 const yearLevel = selectedYear !== 'ALL' ? selectedYear : undefined;
 const section = selectedSection !== 'ALL' ? selectedSection : undefined;
 const pageSize = isMobile ? 6 : 15;

 try {
 const res = await getCommandCenterStudents({
 page: studentsPage,
 page_size: pageSize,
 search: studentsSearch || undefined,
 dept_id: deptId,
 staff_id: staffId,
 year_level: yearLevel,
 section: section,
 status_filter: selectedStatus !== 'ALL' ? selectedStatus : undefined,
 allocation_filter: allocationFilter !== 'ALL' ? allocationFilter : undefined
 });
 setStudents(res.students || []);
 setStudentsTotal(res.total || 0);
 setSelectedStudentIds([]);
 } catch (err) {
 console.error('Students load failed:', err);
 } finally {
 setStudentsLoading(false);
 }
 }, [studentsPage, studentsSearch, selectedDept, selectedStaff, selectedYear, selectedSection, selectedStatus, allocationFilter, isMobile]);

 const isFirstMount = useRef(true);

 useEffect(() => {
 getCommandCenterDepartments().then(setDepartments).catch(() => {});
 }, []);

 useEffect(() => {
 loadScopedData(isFirstMount.current);
 isFirstMount.current = false;
 setStudentsPage(1);
 }, [selectedStaff, selectedDept, selectedYear, selectedSection, selectedStatus, allocationFilter, loadScopedData]);

 useEffect(() => {
 loadStudents();
 }, [loadStudents]);

 const { isConnected: isGlobalWsConnected, registerCallback, unregisterCallback } = useGlobalWebSocket();

 useEffect(() => {
 setWsConnected(isGlobalWsConnected);
 }, [isGlobalWsConnected]);

 // WebSocket Ingestion Subscription 
 useEffect(() => {
 registerCallback('hod_command_center', (data) => {
 if (!data) return;

 if (data.type === 'CONTEST_RESULT_UPDATED' || data.type === 'STUDENT_ACTIVITY_UPDATED') {
 const sid = data.studentId || data.student_id;
 const solved = data.solvedCount ?? data.total_solved;

 setStudents(prev => prev.map(s => {
 if (s.id === sid || s.reg_no === data.regNo) {
 return {
 ...s,
 total_solved: solved ?? s.total_solved,
 weekly_change: data.weeklyChange ?? s.weekly_change,
 contest_standing: data.contestStanding ?? (data.q1 !== undefined ? `${(data.q1+data.q2+data.q3+data.q4)}/4` : s.contest_standing),
 status: 'ACTIVE',
 last_updated: 'Just now'
 };
 }
 return s;
 }));
 setLastLiveTimestamp(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
 }

 if (data.type === 'STAFF_ALLOCATION_UPDATED') {
 loadScopedData(false);
 loadStudents();
 }

 if (data.type === 'DEPARTMENT_METRICS_UPDATED') {
 loadScopedData(false);
 }
 });

 return () => unregisterCallback('hod_command_center');
 }, [registerCallback, unregisterCallback, loadScopedData, loadStudents]);

 const handleReassign = async (studentId: number, targetFacultyId: number) => {
 try {
 await assignStudentsBatch(targetFacultyId, [studentId]);
 setSelectedStudentDetail(null);
 loadScopedData(false);
 loadStudents();
 } catch (e) {
 console.error(e);
 }
 };

 const handleBatchAssignFromTable = async () => {
 if (!batchTargetFaculty || selectedStudentIds.length === 0) return;
 try {
 await assignStudentsBatch(batchTargetFaculty, selectedStudentIds);
 setSelectedStudentIds([]);
 loadScopedData(false);
 loadStudents();
 } catch (e) {
 console.error(e);
 }
 };

 const handleUnassignAllForStaff = (staffId: number, staffName: string) => {
 setConfirmUnassignTarget({ id: staffId, name: staffName });
 };

 const handleFilterByStaff = (staffId: number, staffName?: string) => {
   if (selectedStaff === String(staffId)) {
     setSelectedStaff('ALL');
     notify.info(`Cleared staff filter. Showing all faculty mentors.`, '', { category: 'ALLOCATION' });
   } else {
     setSelectedStaff(String(staffId));
     notify.success(`Dashboard scoped to ${staffName || 'selected faculty'}.`, '', { category: 'ALLOCATION' });
     setTimeout(() => {
       const el = document.getElementById('student-directory-section') || document.getElementById('student-cohort-section');
       el?.scrollIntoView({ behavior: 'smooth' });
     }, 100);
   }
 };

 const executeUnassignAll = async () => {
 if (!confirmUnassignTarget) return;
 setConfirmUnassignLoading(true);
 try {
 await unassignStudentsBatch(confirmUnassignTarget.id, []);
 notify.success(`All mentees unassigned from ${confirmUnassignTarget.name}.`, '', { category: 'ALLOCATION' });
 setConfirmUnassignTarget(null);
 loadScopedData(false);
 loadStudents();
 } catch (err: any) {
 notify.error('Failed to unassign mentees.', '', { category: 'ALLOCATION' });
 } finally {
 setConfirmUnassignLoading(false);
 }
 };

 const handleAIQuery = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!aiQuery.trim()) return;
 setAiLoading(true);
 try {
 const res = await askAIDepartmentQuery(aiQuery);
 setAiResponse(res);
 } catch (err) {
 console.error(err);
 } finally {
 setAiLoading(false);
 }
 };

 const handleWhatIf = async (val: number) => {
 setWhatIfTarget(val);
 if (!health) return;
 try {
 const sim = await simulateWhatIfScenario(health.participation_score, val, 0);
 setWhatIfResult(sim);
 } catch (err) {
 console.error(err);
 }
 };

  const handleYearClick = useCallback((y: YearBenchmark) => {
    const targetVal = y.year_level === 'II' ? '2' : y.year_level === 'III' ? '3' : y.year_level === 'IV' ? '4' : y.year_level;
    const isSelected = selectedYear === targetVal || selectedYear === y.year_level;
    if (isSelected) {
      setSelectedYear('ALL');
      notify.info('Cleared cohort filter. Showing all cohorts.', '', { category: 'ALLOCATION' });
    } else {
      setSelectedYear(targetVal);
      notify.info(`Filtered to ${y.year} cohort (${y.student_count || 0} students) · Health: ${y.health_score}`, '', { category: 'ALLOCATION' });
      setTimeout(() => {
        document.getElementById('student-directory-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [selectedYear, notify]);

 const rawYearMatrix = summary?.benchmarks?.year_matrix || [];
  const yearMatrix = useMemo(() => {
    const map = new Map<string, YearBenchmark>();
    const canonicalOrder: Record<string, number> = { 'II': 2, 'III': 3, 'IV': 4, 'I': 1 };
    for (const item of rawYearMatrix) {
      const raw = String(item.year_level || item.year || '').toUpperCase().trim();
      let code = '';
      if (raw.includes('IV') || raw.includes('4')) code = 'IV';
      else if (raw.includes('III') || raw.includes('3')) code = 'III';
      else if (raw.includes('II') || raw.includes('2')) code = 'II';
      else if (raw.includes('I') || raw.includes('1')) code = 'I';

      if (!code || (!item.student_count || item.student_count === 0)) {
        continue;
      }

      if (!map.has(code)) {
        map.set(code, {
          ...item,
          year: `${code} Year`,
          year_level: code
        });
      } else {
        const existing = map.get(code)!;
        existing.student_count = (existing.student_count || 0) + (item.student_count || 0);
        existing.active_count = (existing.active_count || 0) + (item.active_count || 0);
        existing.health_score = Math.max(existing.health_score || 0, item.health_score || 0);
        existing.participation_pct = Math.round(((existing.active_count || 0) / Math.max(1, existing.student_count || 1)) * 100);
      }
    }
    return Array.from(map.values())
      .filter(y => (y.student_count || 0) > 0)
      .sort((a, b) => (canonicalOrder[a.year_level] || 99) - (canonicalOrder[b.year_level] || 99));
  }, [rawYearMatrix]);

 if (loading && !summary) {
 return (
 <div className="flex flex-col items-center justify-center py-32 text-slate-600 dark:text-slate-400">
 <RefreshCw size={32} className="animate-spin mb-4 text-brand-600" />
 <p className="font-display text-sm font-semibold text-slate-700 dark:text-slate-300">Loading Nandha Institutional Operations Center...</p>
 <p className="text-xs text-slate-600 dark:text-slate-400 font-mono mt-1">Connecting to authoritative SQLite WAL database</p>
 </div>
 );
 }

 const health = summary?.department_health;
 const brief = summary?.executive_brief;
 const needsAtt = summary?.needs_attention;
 const deptMatrix = summary?.benchmarks?.department_matrix || [];

 const totalInScope = health?.total_students || 0;
 const activeInScope = health?.active_this_week || 0;
 const inactiveInScope = health?.inactive_count || 0;
 const improvingInScope = health?.improving_count || 0;
 const partRateInScope = health?.participation_score || 0;

 const scopeStaffName = staffList.find(s => String(s.id) === selectedStaff)?.username || 'All Staff';
 const scopeDeptCode = departments.find(d => String(d.id) === selectedDept)?.code || 'All Departments';

  const staffOptions = [
    { value: 'ALL', label: isGlobalRole ? 'All Campus Faculty Mentors' : isHod ? 'All Department Staff Mentors' : 'All Staff Mentors', pillText: 'ALL' },
    ...staffList.map(s => ({ value: String(s.id), label: `${s.username} (${s.assigned_count}/20)`, pillText: `${s.assigned_count}/20` }))
  ];

  const yearOptions = [
    { value: 'ALL', label: 'All Cohorts', pillText: 'ALL' },
    { value: '2', label: 'II Year', pillText: '2ND' },
    { value: '3', label: 'III Year', pillText: '3RD' },
    { value: '4', label: 'IV Year', pillText: '4TH' }
  ];

  const isSingleIntakeDeptSelected = Boolean(
    selectedDept && departments.some((d: any) => String(d.id) === String(selectedDept) && (d.code?.toUpperCase().includes('CS') || d.code?.toUpperCase().includes('CYBER') || d.code?.toUpperCase().includes('IOT') || d.name?.toLowerCase().includes('cyber') || d.name?.toLowerCase().includes('iot')))
  );

  const sectionOptions = isSingleIntakeDeptSelected
    ? [{ value: 'ALL', label: 'Single Cohort (All Students)', pillText: 'SINGLE' }]
    : [
        { value: 'ALL', label: 'All Sections', pillText: 'ALL' },
        { value: 'A', label: 'Section A', pillText: 'A' },
        { value: 'B', label: 'Section B', pillText: 'B' },
        { value: 'C', label: 'Section C', pillText: 'C' }
      ];

  const statusOptions = [
    { value: 'ALL', label: 'All Status', pillText: 'ALL' },
    { value: 'ACTIVE', label: 'Active Solvers', pillText: 'ACTIVE' },
    { value: 'INACTIVE', label: 'Inactive Solvers', pillText: 'INACTIVE' },
    { value: 'IMPROVING', label: 'Improving Solvers', pillText: 'IMPROVING' }
  ];

 return (
 <div className="max-w-full w-full box-border space-y-5 sm:space-y-6 md:space-y-8 pb-24 md:pb-16 font-sans text-slate-900 dark:text-slate-100 antialiased">



  {/* 1. HEADER - SLEEK MODERN MOBILE & DESKTOP HERO */}
  <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-navy-950 via-slate-900 to-indigo-950 text-white p-3.5 sm:p-7 md:p-8 shadow-xl border border-brand-500/30 backdrop-blur-md">
    <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-6">
      
      {/* Title & Metadata */}
      <div className="space-y-1.5 sm:space-y-2.5 min-w-0">
        {/* Mobile Top Row: Pill Badge + Quick Refresh */}
        <div className="flex items-center justify-between gap-2">
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-brand-500/20 border border-brand-400/30 text-brand-300 text-[10px] sm:text-xs font-black">
            <span className="uppercase tracking-wide truncate max-w-[220px] xs:max-w-none">
              {['principal', 'management', 'director'].includes((user?.role || '').trim().toLowerCase())
                ? 'EXECUTIVE LEADERSHIP DECK | ALL DEPARTMENTS'
                : user?.role?.toLowerCase() === 'hod'
                ? `LEADERSHIP DECK | ${departments[0]?.name || 'Loading...'}`
                : ['faculty', 'staff', 'professor', 'faculty mentor', 'staff mentor', 'faculty_mentor', 'staff_mentor'].includes((user?.role || '').trim().toLowerCase())
                ? 'FACULTY PORTAL'
                : 'NANDHA INTELLIGENCE COMMAND'}
            </span>
          </div>

          {/* Quick Refresh Icon on Mobile */}
          <button
            onClick={() => { setRefreshing(true); clearApiCache(); loadScopedData(false, true); loadStudents(); }}
            className="sm:hidden inline-flex items-center justify-center w-8 h-8 rounded-xl bg-white/10 hover:bg-white/15 active:scale-90 text-slate-200 border border-white/10 transition-all shadow-xs cursor-pointer"
            title="Refresh live data"
            aria-label="Refresh live data"
          >
            <RotateCcw size={13} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>

        <h1 className="text-lg sm:text-2xl md:text-3xl lg:text-4xl font-black tracking-tight text-white uppercase max-w-xl leading-snug">
          {['principal', 'management', 'director'].includes((user?.role || '').trim().toLowerCase()) ? (
            <>
              CAMPUS EXECUTIVE <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-400 via-teal-300 to-indigo-300">LEADERSHIP DECK</span>
            </>
          ) : ['faculty', 'staff', 'professor', 'faculty mentor', 'staff mentor', 'faculty_mentor', 'staff_mentor'].includes((user?.role || '').trim().toLowerCase()) ? (
            <>
              MY FACULTY <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-400 via-teal-300 to-indigo-300">ACTION CENTER</span>
            </>
          ) : user?.role?.toLowerCase() === 'hod' ? (
            <>
              DEPARTMENT <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-400 via-teal-300 to-indigo-300">LEADERSHIP DECK</span>
            </>
          ) : (
            <>
              INSTITUTIONAL <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-400 via-teal-300 to-indigo-300">ANALYTICS DASHBOARD</span>
            </>
          )}
        </h1>

        <p className="hidden sm:block text-xs sm:text-sm text-slate-300 max-w-2xl font-normal leading-relaxed pt-0.5">
          {['principal', 'management', 'director'].includes((user?.role || '').trim().toLowerCase())
            ? 'Campus-wide departmental oversight: Inspect any department HOD process, staff mentoring allocations, student progress, and real-time operational health.'
            : user?.role?.toLowerCase() === 'hod'
            ? 'Department-scoped performance analytics, student cohort tracking, and faculty oversight for your HOD scope.'
            : ['faculty', 'staff', 'professor', 'faculty mentor', 'staff mentor', 'faculty_mentor', 'staff_mentor'].includes((user?.role || '').trim().toLowerCase())
            ? 'Track your assigned student cohort progress, submit mentoring actions, and manage student interventions.'
            : 'Real-time institutional performance analytics, automated student mentoring, and forensic integrity tracking.'}
        </p>
      </div>

      {/* MOBILE ACTION PILLS (Native App Horizontal Dock) */}
      <div className="flex sm:hidden items-center gap-2 overflow-x-auto no-scrollbar w-full pt-0.5 pb-0.5 -mx-0.5 px-0.5">
        <button
          onClick={() => {
            document.getElementById('staff-performance-section')?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="inline-flex shrink-0 items-center gap-1.5 h-8 px-3 rounded-full bg-indigo-500/20 active:bg-indigo-500/40 text-indigo-200 border border-indigo-400/30 text-xs font-bold transition-all active:scale-95 touch-manipulation shadow-xs cursor-pointer"
        >
          <Users size={12} className="shrink-0 text-indigo-300" />
          <span className="whitespace-nowrap">Faculty Matrix</span>
        </button>

        <button
          onClick={() => setShowStaffAllocationModal(true)}
          className="inline-flex shrink-0 items-center gap-1.5 h-8 px-3 rounded-full bg-purple-500/20 active:bg-purple-500/40 text-purple-200 border border-purple-400/30 text-xs font-bold transition-all active:scale-95 touch-manipulation shadow-xs cursor-pointer"
        >
          <Users size={12} className="shrink-0 text-purple-300" />
          <span className="whitespace-nowrap">Staff Allocation</span>
        </button>

        <button
          onClick={() => setShowReportHubModal(true)}
          className="inline-flex shrink-0 items-center gap-1.5 h-8 px-3 rounded-full bg-emerald-500/20 active:bg-emerald-500/40 text-emerald-200 border border-emerald-400/30 text-xs font-bold transition-all active:scale-95 touch-manipulation shadow-xs cursor-pointer"
        >
          <FileSpreadsheet size={12} className="shrink-0 text-emerald-300" />
          <span className="whitespace-nowrap">Reports</span>
        </button>
      </div>

      {/* DESKTOP ACTION BUTTONS (sm and up) */}
      <div className="hidden sm:flex sm:flex-wrap sm:items-center gap-2.5 sm:gap-3 w-full sm:w-auto sm:justify-end pt-2 sm:pt-0">
        {/* Quick Faculty Matrix Button */}
        <button
          onClick={() => {
            document.getElementById('staff-performance-section')?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="inline-flex min-w-0 items-center justify-center gap-2 h-10 sm:h-11 px-3 sm:px-4 rounded-xl sm:rounded-2xl bg-indigo-900/40 hover:bg-indigo-900/60 text-indigo-200 sm:text-indigo-300 border border-indigo-700/50 text-xs sm:text-sm font-bold transition-all cursor-pointer shadow-xs active:scale-95 touch-manipulation"
          title="Jump to Faculty Mentors Performance & Progress Matrix"
        >
          <Users size={15} className="shrink-0 text-indigo-400" />
          <span className="truncate">Faculty Matrix</span>
        </button>

        {/* HOD Staff Allocation Manager Button */}
        <button
          onClick={() => setShowStaffAllocationModal(true)}
          className="inline-flex min-w-0 items-center justify-center gap-2 h-10 sm:h-11 px-3 sm:px-4 rounded-xl sm:rounded-2xl bg-purple-900/40 hover:bg-purple-900/60 text-purple-200 sm:text-purple-300 border border-purple-700/50 text-xs sm:text-sm font-bold transition-all cursor-pointer shadow-xs active:scale-95 touch-manipulation"
        >
          <Users size={15} className="shrink-0 text-purple-400" />
          <span className="truncate">Staff Allocation</span>
        </button>

        {/* Dedicated Report Hub Button */}
        <button
          onClick={() => setShowReportHubModal(true)}
          className="inline-flex min-w-0 items-center justify-center gap-2 h-10 sm:h-11 px-3 sm:px-4 rounded-xl sm:rounded-2xl bg-emerald-900/40 hover:bg-emerald-900/60 text-emerald-200 sm:text-emerald-300 border border-emerald-700/50 text-xs sm:text-sm font-bold transition-all cursor-pointer shadow-xs active:scale-95 touch-manipulation"
        >
          <FileSpreadsheet size={15} className="shrink-0 text-emerald-400" />
          <span className="truncate">Reports</span>
        </button>

        {/* Refresh Button */}
        <button
          onClick={() => { setRefreshing(true); clearApiCache(); loadScopedData(false, true); loadStudents(); }}
          className="inline-flex min-w-0 items-center justify-center gap-2 h-10 sm:h-11 px-3 sm:px-4 rounded-xl sm:rounded-2xl bg-slate-800/80 hover:bg-slate-700/90 text-slate-200 sm:text-slate-300 border border-slate-700/60 text-xs sm:text-sm font-bold transition-all cursor-pointer shadow-xs active:scale-95 touch-manipulation"
        >
          <RotateCcw size={15} className={`shrink-0 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

    </div>
  </div>

  {/* 2. EXECUTIVE MULTI-SCOPE FILTER BAR */}
  {(() => {
    const activeFilterCount = [
      selectedDept !== 'ALL',
      selectedStaff !== 'ALL',
      selectedYear !== 'ALL',
      selectedSection !== 'ALL',
      selectedStatus !== 'ALL',
      allocationFilter !== 'ALL',
      staffWorkloadFilter !== 'ALL'
    ].filter(Boolean).length;

    return (
      <div className="rounded-xl sm:rounded-2xl bg-white/95 dark:bg-navy-950/95 backdrop-blur-md border border-slate-200/90 dark:border-navy-800 shadow-xs sm:shadow-sm overflow-hidden transition-all duration-200">
        {/* Toggle Header */}
        <div 
          onClick={() => setIsFilterOpen(prev => !prev)}
          className="p-2.5 sm:p-4 flex items-center justify-between gap-2.5 cursor-pointer select-none hover:bg-slate-50/80 dark:hover:bg-navy-900/50 transition-colors"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsFilterOpen(prev => !prev); } }}
          aria-expanded={isFilterOpen}
        >
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0 border border-brand-500/20">
              <Filter className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2 min-w-0">
              <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white truncate">
                Active Scope
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] sm:text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-navy-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-navy-700 font-bold truncate max-w-[160px] sm:max-w-none">
                  {scopeDeptCode} / {scopeStaffName}
                </span>
                {activeFilterCount > 0 && (
                  <span className="text-[10px] font-mono font-black px-1.5 py-0.5 rounded-full bg-brand-500/15 text-brand-500 dark:text-brand-400 border border-brand-400/30">
                    {activeFilterCount}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSelectedDept(defaultDeptValue);
                  setSelectedStaff('ALL');
                  setSelectedYear('ALL');
                  setSelectedSection('ALL');
                  setSelectedStatus('ALL');
                  setAllocationFilter('ALL');
                  setStaffWorkloadFilter('ALL');
                }}
                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] sm:text-xs font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 hover:bg-rose-500/10 rounded-lg sm:rounded-xl transition cursor-pointer"
                title="Reset all active filters to default"
              >
                <RotateCcw size={11} />
                <span className="hidden sm:inline">Reset All</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsFilterOpen(prev => !prev)}
              className="inline-flex items-center gap-1 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold bg-brand-500/10 hover:bg-brand-500/20 text-brand-600 dark:text-brand-300 border border-brand-500/20 hover:border-brand-500/40 transition-all cursor-pointer shadow-2xs active:scale-95"
            >
              <SlidersHorizontal size={12} />
              <span>{isFilterOpen ? 'Hide' : 'Filters'}</span>
              {isFilterOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          </div>
        </div>

        {/* Collapsible Filter Body */}
        {isFilterOpen && (
          <div className="p-2.5 sm:p-4 pt-2 border-t border-slate-100 dark:border-navy-900 bg-slate-50/50 dark:bg-navy-900/30 space-y-2.5 animate-in fade-in duration-200">
            {/* MOBILE NATIVE HORIZONTAL FILTER CHIPS (< sm: Airbnb / Swiggy / GitHub Mobile Style) */}
            <div className="block sm:hidden">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 px-0.5 touch-pan-x">
                {/* 1. Department Scope Chip */}
                <div className="shrink-0">
                  <GlobalFilter
                    compact={true}
                    value={selectedDept}
                    onChange={val => {
                      setSelectedDept(val);
                      setSelectedStaff('ALL');
                    }}
                    dropdownWidth="w-[calc(100vw-24px)]"
                    searchPlaceholder="Search department..."
                    options={deptOptions}
                    icon={<Building2 className="w-3.5 h-3.5 text-brand-500" />}
                    className={selectedDept !== defaultDeptValue && selectedDept !== 'ALL' ? 'ring-2 ring-brand-500 border-brand-500' : ''}
                  />
                </div>

                {/* 2. Staff Mentor Chip */}
                <div className="shrink-0">
                  <GlobalFilter
                    compact={true}
                    value={selectedStaff}
                    onChange={val => setSelectedStaff(val)}
                    dropdownWidth="w-[calc(100vw-24px)]"
                    searchPlaceholder="Search staff mentor..."
                    options={staffOptions}
                    icon={<User className="w-3.5 h-3.5 text-indigo-500" />}
                    className={selectedStaff !== 'ALL' ? 'ring-2 ring-indigo-500 border-indigo-500' : ''}
                  />
                </div>

                {/* 3. Cohort Year Chip */}
                <div className="shrink-0">
                  <GlobalFilter
                    compact={true}
                    value={selectedYear}
                    onChange={val => setSelectedYear(val)}
                    dropdownWidth="w-[calc(100vw-24px)]"
                    options={yearOptions}
                    icon={<Calendar className="w-3.5 h-3.5 text-amber-500" />}
                    className={selectedYear !== 'ALL' ? 'ring-2 ring-amber-500 border-amber-500' : ''}
                  />
                </div>

                {/* 4. Section Chip */}
                <div className="shrink-0">
                  <GlobalFilter
                    compact={true}
                    value={selectedSection}
                    onChange={val => setSelectedSection(val)}
                    dropdownWidth="w-[calc(100vw-24px)]"
                    options={sectionOptions}
                    icon={<Layers className="w-3.5 h-3.5 text-purple-500" />}
                    className={selectedSection !== 'ALL' ? 'ring-2 ring-purple-500 border-purple-500' : ''}
                  />
                </div>

                {/* 5. Solver Status Chip */}
                <div className="shrink-0">
                  <GlobalFilter
                    compact={true}
                    value={selectedStatus}
                    onChange={val => setSelectedStatus(val)}
                    dropdownWidth="w-[calc(100vw-24px)]"
                    options={statusOptions}
                    icon={<Activity className="w-3.5 h-3.5 text-emerald-500" />}
                    className={selectedStatus !== 'ALL' ? 'ring-2 ring-emerald-500 border-emerald-500' : ''}
                  />
                </div>

                {/* Mobile Reset Chip */}
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDept(defaultDeptValue);
                      setSelectedStaff('ALL');
                      setSelectedYear('ALL');
                      setSelectedSection('ALL');
                      setSelectedStatus('ALL');
                      setAllocationFilter('ALL');
                      setStaffWorkloadFilter('ALL');
                    }}
                    className="shrink-0 h-9 px-3 rounded-xl border border-rose-300 dark:border-rose-800/80 bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-300 text-xs font-black flex items-center gap-1.5 active:scale-95 transition-transform cursor-pointer shadow-2xs"
                  >
                    <RotateCcw size={12} className="text-rose-500 shrink-0" />
                    <span>Reset</span>
                  </button>
                )}
              </div>
            </div>

            {/* DESKTOP / TABLET GRID (>= sm) */}
            <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-3.5">
              {/* 1. Department Scope */}
              <div className="space-y-1.5 min-w-0">
                <label className="block text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider truncate">
                  Department Scope
                </label>
                <GlobalFilter
                  value={selectedDept}
                  onChange={val => {
                    setSelectedDept(val);
                    setSelectedStaff('ALL');
                  }}
                  dropdownWidth="min-w-[280px] sm:min-w-[320px]"
                  searchPlaceholder="Search department..."
                  options={deptOptions}
                  icon={<Building2 className="w-4 h-4 text-brand-500" />}
                />
              </div>

              {/* 2. Staff Mentor Scope */}
              <div className="space-y-1.5 min-w-0">
                <label className="block text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider truncate">
                  Faculty Mentor
                </label>
                <GlobalFilter
                  value={selectedStaff}
                  onChange={val => setSelectedStaff(val)}
                  dropdownWidth="min-w-[280px] sm:min-w-[320px]"
                  searchPlaceholder="Search staff mentor..."
                  options={staffOptions}
                  icon={<User className="w-4 h-4 text-indigo-500" />}
                />
              </div>

              {/* 3. Academic Year */}
              <div className="space-y-1.5 min-w-0">
                <label className="block text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider truncate">
                  Cohort Year
                </label>
                <GlobalFilter
                  value={selectedYear}
                  onChange={val => setSelectedYear(val)}
                  dropdownWidth="min-w-[220px] sm:min-w-[250px]"
                  options={yearOptions}
                  icon={<Calendar className="w-4 h-4 text-amber-500" />}
                />
              </div>

              {/* 4. Section */}
              <div className="space-y-1.5 min-w-0">
                <label className="block text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider truncate">
                  Section / Cohort
                </label>
                <GlobalFilter
                  value={selectedSection}
                  onChange={val => setSelectedSection(val)}
                  dropdownWidth="min-w-[220px] sm:min-w-[250px]"
                  options={sectionOptions}
                  icon={<Layers className="w-4 h-4 text-purple-500" />}
                />
              </div>

              {/* 5. Solver Status */}
              <div className="space-y-1.5 min-w-0">
                <label className="block text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider truncate">
                  Solver Status
                </label>
                <GlobalFilter
                  value={selectedStatus}
                  onChange={val => setSelectedStatus(val)}
                  dropdownWidth="min-w-[220px] sm:min-w-[250px]"
                  options={statusOptions}
                  icon={<Activity className="w-4 h-4 text-emerald-500" />}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  })()}

 {/* 3. STUDENT COHORT SUMMARY BANNER */}
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 p-3.5 sm:px-6 sm:py-5 rounded-xl sm:rounded-2xl bg-white dark:bg-navy-950 border border-slate-200/90 sm:border-2 dark:border-navy-700 shadow-xs sm:shadow-sm">
 {/* Left: Cohort Identity */}
 <div className="flex items-center gap-3 min-w-0">
 <div className="shrink-0 w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-lg sm:rounded-xl bg-brand-50 dark:bg-brand-950 text-brand-600 font-black font-mono text-sm sm:text-base border border-brand-200 dark:border-brand-900">
 {totalInScope}
 </div>
 <div className="min-w-0">
 <div className="font-display text-sm font-bold text-slate-900 dark:text-white truncate">
 Your Student Cohort ({scopeStaffName} / {scopeDeptCode})
 </div>
 <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-mono mt-0.5">
 <span className="text-emerald-600 font-bold">{activeInScope} Active</span>
 <span className="text-slate-300 dark:text-slate-600">/</span>
 <span className="text-rose-600 font-bold">{inactiveInScope} Inactive</span>
 <span className="text-slate-300 dark:text-slate-600">/</span>
 <span className="text-brand-600 font-bold">{improvingInScope} Improving</span>
 </div>
 </div>
 </div>

 {/* Right: Meta + Action */}
 <div className="flex items-center justify-between sm:justify-end gap-2 border-t sm:border-0 border-slate-100 dark:border-navy-900 pt-2 sm:pt-0 shrink-0">
 {/* High-Contrast Live Telemetry Pill */}
 <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg sm:rounded-xl bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200/90 dark:border-white/10 text-[10px] sm:text-xs font-mono shadow-2xs">
            <Clock size={11} className="text-emerald-500 shrink-0" />
 <span className="text-slate-500 dark:text-slate-400 font-semibold hidden xs:inline">Last Sync:</span>
 <span className="font-black text-slate-900 dark:text-white tracking-wide">{lastLiveTimestamp}</span>
 </div>

 {/* High-Contrast Interactive Unassigned Students Actions */}
 {summary?.unassigned_student_count ? (
 <div className="flex items-center gap-1.5">
 <button
 onClick={() => {
 setAllocationFilter('UNASSIGNED');
 notify.info(`Filtered directory to ${summary.unassigned_student_count} unassigned students.`, '', { category: 'ALLOCATION' });
 document.getElementById('student-directory-section')?.scrollIntoView({ behavior: 'smooth' });
 }}
 className="px-2.5 py-1 sm:px-3.5 sm:py-1.5 rounded-lg sm:rounded-xl bg-amber-100/90 hover:bg-amber-200/90 dark:bg-amber-950/70 dark:hover:bg-amber-900/80 text-amber-950 dark:text-amber-200 font-extrabold text-[11px] sm:text-xs border border-amber-300 dark:border-amber-700/80 transition-all flex items-center gap-1 shadow-2xs active:scale-95 cursor-pointer whitespace-nowrap"
 title="Click to view and filter unassigned students in directory below"
 >
 <UserX size={12} className="text-amber-700 dark:text-amber-400 shrink-0" />
 <span className="font-mono font-black">{summary.unassigned_student_count}</span>
 <span className="hidden xs:inline">Unassigned</span>
 </button>

 <button
 onClick={() => setShowStaffAllocationModal(true)}
 className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-black text-[11px] sm:text-xs border border-amber-600/30 transition-all flex items-center gap-1 shadow-2xs active:scale-95 cursor-pointer whitespace-nowrap"
 title="Open Faculty Allocation Manager to assign students"
 >
 <Users size={12} className="shrink-0" />
 <span>Assign</span>
 </button>
 </div>
 ) : (
 <span className="px-2.5 py-1 rounded-lg sm:rounded-xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-300 font-bold text-[11px] sm:text-xs border border-emerald-300 dark:border-emerald-700/60 flex items-center gap-1 shadow-2xs">
 <CheckCircle2 size={12} className="text-emerald-600 dark:text-emerald-400" />
 <span>All Assigned</span>
 </span>
 )}
 </div>
 </div>

 {/* 4. SIX AUTHORITATIVE HOD KPI CARDS */}
 <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3.5 lg:gap-5 mb-4 sm:mb-8">
 <Card 
 className={`p-2.5 sm:p-5 flex flex-col justify-between min-h-[90px] sm:min-h-[140px] transition-all hover:-translate-y-0.5 hover:shadow-lg cursor-pointer ${staffWorkloadFilter === 'ALL' && selectedStaff === 'ALL' && allocationFilter === 'ALL' && selectedStatus === 'ALL' ? '' : ''}`}
 onClick={() => {
 setStaffWorkloadFilter('ALL');
 document.getElementById('staff-performance-section')?.scrollIntoView({ behavior: 'smooth' });
 }}
 >
 <div className="flex items-center justify-between text-slate-700 dark:text-slate-400">
 <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider font-mono">TOTAL STAFF</span>
 <Users size={14} className="text-indigo-500" />
 </div>
 <div className="mt-1.5 sm:mt-3">
 <div className="font-display text-lg sm:text-2xl lg:text-3xl font-extrabold text-slate-900 dark:text-white font-mono">
 {summary?.kpi_summary?.total_staff ?? staffList.length}
 </div>
 <div className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">Faculty Mentors</div>
 </div>
 </Card>

 <Card 
 className={`p-2.5 sm:p-5 flex flex-col justify-between min-h-[90px] sm:min-h-[140px] cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-lg ${selectedStatus === 'ALL' && allocationFilter === 'ALL' ? 'ring-2 ring-slate-400 bg-slate-50 dark:bg-navy-800' : ''}`}
 onClick={() => {
 setSelectedStatus('ALL');
 setAllocationFilter('ALL');
 notify.info(`Showing all enrolled students in scope (${summary?.kpi_summary?.total_students ?? totalInScope}).`, '', { category: 'ALLOCATION' });
 document.getElementById('student-directory-section')?.scrollIntoView({ behavior: 'smooth' });
 }}
 >
 <div className="flex items-center justify-between text-slate-700 dark:text-slate-400">
 <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider font-mono">TOTAL STUDENTS</span>
 <BookOpen size={14} className="text-slate-600" />
 </div>
 <div className="mt-1.5 sm:mt-3">
 <div className="font-display text-lg sm:text-2xl lg:text-3xl font-extrabold text-slate-900 dark:text-white font-mono">
 {summary?.kpi_summary?.total_students ?? totalInScope}
 </div>
 <div className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">Enrolled Scope</div>
 </div>
 </Card>

 <Card 
 className={`p-2.5 sm:p-5 flex flex-col justify-between min-h-[90px] sm:min-h-[140px] transition-all hover:-translate-y-0.5 hover:shadow-lg cursor-pointer ${allocationFilter === 'ALLOCATED' ? 'ring-2 ring-brand-500 bg-brand-50/50 dark:bg-brand-950/40' : ''}`}
 onClick={() => {
 if (allocationFilter === 'ALLOCATED') {
   setAllocationFilter('ALL');
   notify.info('Cleared allocated filter. Showing all students.', '', { category: 'ALLOCATION' });
 } else {
   setAllocationFilter('ALLOCATED');
   notify.success(`Filtering to only ${summary?.kpi_summary?.total_allocated ?? activeInScope} allocated students.`, '', { category: 'ALLOCATION' });
 }
 document.getElementById('student-directory-section')?.scrollIntoView({ behavior: 'smooth' });
 }}
 >
 <div className="flex items-center justify-between text-brand-600">
 <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider font-mono">ALLOCATED</span>
 <UserCheck size={14} />
 </div>
 <div className="mt-1.5 sm:mt-3">
 <div className="font-display text-lg sm:text-2xl lg:text-3xl font-extrabold text-brand-600 font-mono">
 {summary?.kpi_summary?.total_allocated ?? activeInScope}
 </div>
 <div className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">{summary?.kpi_summary?.unassigned ?? 0} Unassigned</div>
 </div>
 </Card>

  <Card 
    className={`p-2.5 sm:p-5 flex flex-col justify-between min-h-[90px] sm:min-h-[140px] transition-all hover:-translate-y-0.5 hover:shadow-lg cursor-pointer group ${selectedStatus === 'COMPLETED' ? 'ring-2 ring-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40' : ''}`}
    onClick={() => {
      if (selectedStatus === 'COMPLETED') {
        setSelectedStatus('ALL');
        setAllocationFilter('ALL');
        notify.info('Cleared target completed filter. Showing all students.', '', { category: 'ALLOCATION' });
      } else {
        setSelectedStatus('COMPLETED');
        setAllocationFilter((summary?.kpi_summary?.total_allocated ?? 0) === 0 ? 'ALL' : 'ALLOCATED');
        notify.success(`Viewing ${summary?.kpi_summary?.completed ?? 0} students who achieved target (10+ solved).`, '', { category: 'ALLOCATION' });
      }
      document.getElementById('student-directory-section')?.scrollIntoView({ behavior: 'smooth' });
    }}
  >
    <div className="flex items-center justify-between text-emerald-600">
      <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider font-mono">COMPLETED</span>
      <CheckCircle2 size={14} />
    </div>
    <div className="mt-1.5 sm:mt-3">
      <div className="font-display text-lg sm:text-2xl lg:text-3xl font-extrabold text-emerald-600 font-mono">
        {summary?.kpi_summary?.completed ?? 0}
      </div>
      <div className="flex items-center justify-between text-[10px] sm:text-xs text-emerald-600 dark:text-emerald-500 font-semibold mt-0.5">
        <span>Target Done</span>
        <span className="text-[9px] sm:text-[10px] font-mono font-bold group-hover:underline flex items-center gap-0.5">
          {summary?.kpi_summary?.completed ?? 0} →
        </span>
      </div>
    </div>
  </Card>

  <Card 
    className={`p-2.5 sm:p-5 flex flex-col justify-between min-h-[90px] sm:min-h-[140px] transition-all hover:-translate-y-0.5 hover:shadow-lg cursor-pointer group ${selectedStatus === 'PENDING' ? 'ring-2 ring-amber-500 bg-amber-50/70 dark:bg-amber-950/40' : ''}`}
    onClick={() => {
      if (selectedStatus === 'PENDING') {
        setSelectedStatus('ALL');
        setAllocationFilter('ALL');
        notify.info('Cleared pending target filter. Showing all students.', '', { category: 'ALLOCATION' });
      } else {
        setSelectedStatus('PENDING');
        setAllocationFilter((summary?.kpi_summary?.total_allocated ?? 0) === 0 ? 'ALL' : 'ALLOCATED');
        notify.warning(`Viewing ${summary?.kpi_summary?.pending ?? 0} students with target in progress (< 10 solved).`, '', { category: 'ALLOCATION' });
      }
      document.getElementById('student-directory-section')?.scrollIntoView({ behavior: 'smooth' });
    }}
  >
    <div className="flex items-center justify-between text-amber-600">
      <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider font-mono">PENDING</span>
      <Clock size={14} />
    </div>
    <div className="mt-1.5 sm:mt-3">
      <div className="font-display text-lg sm:text-2xl lg:text-3xl font-extrabold text-amber-600 font-mono">
        {summary?.kpi_summary?.pending ?? 0}
      </div>
      <div className="flex items-center justify-between text-[10px] sm:text-xs text-amber-600 dark:text-amber-500 font-semibold mt-0.5">
        <span>In Progress</span>
        <span className="text-[9px] sm:text-[10px] font-mono font-bold group-hover:underline flex items-center gap-0.5">
          {summary?.kpi_summary?.pending ?? 0} →
        </span>
      </div>
    </div>
  </Card>

 <Card 
 className="p-2.5 sm:p-5 flex flex-col justify-between min-h-[90px] sm:min-h-[140px] transition-all hover:-translate-y-0.5 hover:shadow-lg cursor-pointer !bg-slate-900 text-white border-slate-800"
 >
 <div className="flex items-center justify-between text-brand-300">
 <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider font-mono text-slate-300">PROGRESS</span>
 <Activity size={14} className="text-amber-400" />
 </div>
 <div className="mt-1.5 sm:mt-3">
 <div className="font-display text-lg sm:text-2xl lg:text-3xl font-extrabold text-amber-400 font-mono drop-shadow-sm">
 {summary?.kpi_summary?.overall_progress ?? 0}%
 </div>
 <div className="flex items-center gap-1.5 mt-1">
 <span className={`px-1.5 py-0.2 sm:px-2 sm:py-0.5 rounded text-[9px] sm:text-[10px] font-mono font-bold ${
 (summary?.kpi_summary?.overall_progress ?? 0) >= 80 ? 'bg-emerald-500 text-white' :
 (summary?.kpi_summary?.overall_progress ?? 0) >= 60 ? 'bg-amber-500 text-white' : 'bg-rose-500 text-white'
 }`}>
 {(summary?.kpi_summary?.overall_progress ?? 0) >= 80 ? 'GOOD' :
 (summary?.kpi_summary?.overall_progress ?? 0) >= 60 ? 'WATCH' : 'ACTION'}
 </span>
 </div>
 </div>
 </Card>
 </div>

      {/* 5. FACULTY MENTORS PERFORMANCE & PROGRESS MATRIX (PRIMARY HOD VIEW) */}
      <div id="staff-performance-section" className="scroll-mt-20">
        <FacultyMentorMatrixCard
          staffList={staffList}
          staffWorkloadFilter={staffWorkloadFilter}
          setStaffWorkloadFilter={(f: string) => setStaffWorkloadFilter(f as any)}
          setShowStaffAllocationModal={setShowStaffAllocationModal}
          selectedStaff={selectedStaff}
          handleFilterByStaff={handleFilterByStaff}
          setSelectedStaffDetail={setSelectedStaffDetail}
          handleUnassignAllForStaff={handleUnassignAllForStaff}
          getDeptBadgeStyle={getDeptBadgeStyle}
        />
      </div>

      {/* 6. TODAY'S ACTION REQUIRED */}
 <Card className="p-3.5 sm:p-7 my-4 sm:my-8 shadow-sm">
 <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-slate-100 dark:border-navy-800">
 <div className="flex items-center gap-2 sm:gap-2.5">
 <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
 <h3 className="font-display text-xs sm:text-base font-bold text-slate-900 dark:text-white">
 TODAY'S ACTION REQUIRED
 </h3>
 </div>
 <span className="text-[10px] sm:text-xs font-bold font-mono px-2 py-0.5 sm:px-3 sm:py-1 rounded-md bg-rose-50 text-rose-700 border border-rose-200">
 REAL-TIME INTELLIGENCE
 </span>
 </div>

 <div className="mt-3.5 sm:mt-6">
 {summary?.action_items && summary.action_items.length > 0 ? (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-7">
 {summary.action_items.map((action) => {
   const isZeroSolved = action.id === 'action_zero_solved' || action.type === 'ZERO_SOLVED_PENDING' || action.target_tab === 'pending';
   const isUnassigned = action.id === 'action_unassigned' || action.type === 'UNASSIGNED_STUDENTS' || action.target_tab === 'unassigned';
   const isLowStaff = action.id === 'action_low_staff' || action.type === 'LOW_PROGRESS_STAFF' || action.target_tab === 'staff-performance';

   const handleActionClick = (mode?: 'modal' | 'table') => {
     if (isZeroSolved) {
       setAllocationFilter('ALLOCATED');
       setSelectedStatus('ZERO_SOLVED');
       setStudentsPage(1);
       notify.warning(`Filtered student directory to ${action.count} allocated student(s) with 0 completed problems.`, '', { category: 'ALLOCATION' });
       setTimeout(() => {
         document.getElementById('student-directory-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
       }, 50);
     } else if (isUnassigned) {
       setAllocationFilter('UNASSIGNED');
       setSelectedStatus('ALL');
       setStudentsPage(1);
       if (mode === 'table') {
         notify.info(`Filtered student directory to ${action.count} unassigned student(s).`, '', { category: 'ALLOCATION' });
         setTimeout(() => {
           document.getElementById('student-directory-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
         }, 50);
       } else {
         setShowStaffAllocationModal(true);
         notify.info(`Opened faculty allocation manager for ${action.count} unassigned student(s).`, '', { category: 'ALLOCATION' });
       }
     } else if (isLowStaff) {
       document.getElementById('staff-performance-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
     } else {
       document.getElementById('student-directory-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
     }
   };

   return (
     <div
       key={action.id}
       className={`p-4 sm:p-6 rounded-xl sm:rounded-2xl border flex flex-col justify-between min-h-[140px] sm:min-h-[160px] space-y-3 sm:space-y-5 shadow-2xs sm:shadow-sm transition-all hover:shadow-md ${
         action.severity === 'URGENT'
           ? 'bg-rose-50/60 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/50'
           : 'bg-amber-50/60 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/50'
       }`}
     >
       <div className="space-y-2.5">
         <div className="flex items-center justify-between">
           <span className={`text-xs font-bold font-mono px-2.5 py-0.5 rounded ${
             action.severity === 'URGENT' ? 'bg-rose-600 text-white' : 'bg-amber-600 text-white'
           }`}>
             {action.severity}
           </span>
           <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-400">Count: {action.count}</span>
         </div>
         <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white pt-1">{action.title}</h4>
         <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{action.reason}</p>
       </div>
       <div className="flex items-center gap-2 pt-1">
         <button
           onClick={() => handleActionClick(isUnassigned ? 'modal' : undefined)}
           className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer ${
             action.severity === 'URGENT'
               ? 'bg-rose-600 hover:bg-rose-700 text-white'
               : 'bg-amber-600 hover:bg-amber-700 text-white'
           }`}
         >
           {action.action_label} →
         </button>
         {isUnassigned && (
           <button
             onClick={() => handleActionClick('table')}
             className="px-3 py-2.5 rounded-xl text-xs font-bold border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-100/60 dark:hover:bg-rose-950/40 transition cursor-pointer whitespace-nowrap"
             title="View unassigned students in table"
           >
             View Table →
           </button>
         )}
       </div>
     </div>
   );
 })}
 </div>
 ) : (
 <div className="p-6 text-center text-emerald-600 dark:text-emerald-400 font-mono text-xs font-bold bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200">
  Everything is on track. No critical departmental actions pending today.
 </div>
 )}
 </div>
 </Card>

        {/* 6. OPERATIONAL NEEDS ATTENTION */}
        <Card className="p-3.5 sm:p-6 space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-navy-800">
            <div>
              <h3 className="font-display text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                Needs Operational Attention
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-700 dark:text-slate-400">Actionable student cohort alerts</p>
            </div>
            <span className="text-[10px] sm:text-xs font-bold font-mono px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
              ACTION QUEUE
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 sm:gap-4">
            {[
              {
                color: 'text-rose-600 bg-rose-50 border-rose-200',
                badge: 'INACTIVE',
                count: inactiveInScope,
                title: 'Inactive Solvers',
                sub: '0 problems solved in current cycle',
                onClick: () => {
                  setSelectedStatus('INACTIVE');
                  setTimeout(() => document.getElementById('student-directory-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
                }
              },
              {
                color: 'text-amber-600 bg-amber-50 border-amber-200',
                badge: 'DECLINING',
                count: needsAtt?.declining_count || 0,
                title: 'Declining Weekly Velocity',
                sub: 'Submissions decreased vs last cycle',
                onClick: () => {
                  setSelectedStatus('INACTIVE');
                  setTimeout(() => document.getElementById('student-directory-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
                }
              },
              {
                color: 'text-brand-600 bg-brand-50 border-brand-200',
                badge: 'IMPROVING',
                count: improvingInScope,
                title: 'Accelerating Solvers',
                sub: 'Rating velocity increased this week',
                onClick: () => {
                  setSelectedStatus('IMPROVING');
                  setTimeout(() => document.getElementById('student-directory-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
                }
              }
            ].map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 sm:p-4 rounded-xl border border-slate-100 dark:border-navy-800 bg-slate-50/50 dark:bg-navy-800/40 min-h-[64px] sm:min-h-[76px]">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-xs text-slate-900 dark:text-white">{item.title}</h4>
                    <span className={`font-mono text-xs font-bold px-1.5 py-0.2 rounded border ${item.color}`}>
                      {item.count}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-400">{item.sub}</p>
                </div>
                <button
                  onClick={item.onClick}
                  className="text-xs font-bold text-brand-600 hover:text-brand-700 whitespace-nowrap ml-2"
                >
                  View Students →
                </button>
              </div>
            ))}
          </div>

          {/* Compact Brief */}
          {brief && (
            <div className="pt-2 text-xs text-slate-700 dark:text-slate-400 border-t border-slate-100 dark:border-navy-800 space-y-1">
              <div><strong>Top Action:</strong> {brief.action}</div>
            </div>
          )}
        </Card>

  {/* 6. REAL-TIME INSTITUTIONAL PERFORMANCE TRAJECTORY */}
  <div className="my-4 sm:my-8">
    <PerformanceChart department={selectedDept} yearLevel={selectedYear} />
  </div>

  {/* 6. GRAPH ANALYTICS LAYER */}
  <AnalyticsDashboard />

  {/* 7. LIVE STUDENT ACTIVITY (MOST IMPORTANT MAIN OPERATIONAL TABLE) */}
  <Card id="student-directory-section" className="p-3.5 sm:p-5 space-y-3 sm:space-y-4 scroll-mt-20">
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
 <div>
 <h2 className="font-display text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
 <span>Live Student Activity</span>
 <span className="text-xs font-mono font-normal text-slate-600 dark:text-slate-400">({studentsTotal} students in scope)</span>
 {(allocationFilter !== 'ALL' || selectedStatus !== 'ALL') && (
   <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
     selectedStatus === 'COMPLETED'
       ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
       : selectedStatus === 'PENDING'
       ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
       : selectedStatus === 'ZERO_SOLVED' || selectedStatus === 'INACTIVE'
       ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-700'
       : selectedStatus === 'IMPROVING'
       ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-300 dark:border-blue-700'
       : allocationFilter === 'ALLOCATED'
       ? 'bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-300'
       : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
   }`}>
     Showing: {
       selectedStatus === 'COMPLETED' ? 'Target Achieved (10+ Solved)' :
       selectedStatus === 'PENDING' ? 'Target In Progress (< 10 Solved)' :
       selectedStatus === 'ZERO_SOLVED' ? 'Allocated with 0 Problems Solved' :
       selectedStatus === 'INACTIVE' ? '0 Problems Solved' :
       selectedStatus === 'IMPROVING' ? 'Accelerating Solvers' :
       allocationFilter === 'ALLOCATED' ? 'Allocated Only' : 'Unassigned Only'
     }
   </span>
 )}
 </h2>
 <p className="text-xs text-slate-700 dark:text-slate-400">Realtime problem solves and contest question completions</p>
 </div>

          <div className="flex items-center gap-2">
            {(allocationFilter !== 'ALL' || selectedStatus !== 'ALL') && (
              <button
                onClick={() => {
                  setAllocationFilter('ALL');
                  setSelectedStatus('ALL');
                  setStudentsPage(1);
                }}
                className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-navy-800 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1 transition cursor-pointer"
                title="Reset filters and show all students"
              >
                <RotateCcw size={12} />
                <span>Show All</span>
              </button>
            )}
            <div className="relative min-w-[240px] flex items-center">
              <input
                value={studentsSearch}
                onChange={e => setStudentsSearch(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                placeholder="Search student, reg no, or LeetCode handle..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-slate-800 dark:text-slate-100 outline-none focus:border-brand-500 text-left transition-all"
              />
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 z-10 text-slate-500 dark:text-slate-400">
                <Search size={14} />
              </div>
            </div>
          </div>
 </div>

 {/* Batch Allocation Floating Bar */}
 {selectedStudentIds.length > 0 && (
 <div className="p-3 rounded-xl bg-brand-50 border border-brand-200 flex flex-wrap items-center justify-between gap-3 animate-fade-in">
 <div className="text-xs font-bold text-brand-900 font-mono">
 Selected {selectedStudentIds.length} students for faculty allocation:
 </div>
 <div className="flex items-center gap-2">
 <GlobalFilter
 value={batchTargetFaculty?.toString() || ""}
 onChange={val => setBatchTargetFaculty(Number(val))}
 dropdownWidth="w-64"
 options={[
 { value: "", label: "Select Target Staff Mentor..." },
 ...staffList.map((s: any) => ({ value: String(s.id), label: `${s.username} (${s.assigned_count}/20)` }))
 ]}
 icon={<User className="w-4 h-4" />}
 />
 <button
 onClick={handleBatchAssignFromTable}
 disabled={!batchTargetFaculty}
 className="px-3.5 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold disabled:opacity-50 transition"
 >
 Allocate Selected
 </button>
 <button
 onClick={() => setSelectedStudentIds([])}
 className="px-2.5 py-1.5 rounded-lg text-slate-700 dark:text-slate-400 hover:bg-slate-200 text-xs"
 >
 Cancel
 </button>
 </div>
 </div>
 )}

 {/* Mobile Select-All Action Bar */}
 {students.length > 0 && !studentsLoading && (
   <div className="flex md:hidden items-center justify-between px-1 py-0.5 text-[11px] text-slate-500 dark:text-slate-400">
     <label className="flex items-center gap-2 cursor-pointer select-none">
       <input
         type="checkbox"
         checked={students.length > 0 && selectedStudentIds.length === students.length}
         onChange={e => {
           if (e.target.checked) setSelectedStudentIds(students.map(s => s.id));
           else setSelectedStudentIds([]);
         }}
         className="rounded text-brand-600 focus:ring-brand-500 w-3.5 h-3.5 cursor-pointer"
       />
       <span className="font-semibold text-slate-700 dark:text-slate-300">Select all on this page ({students.length})</span>
     </label>
     {selectedStudentIds.length > 0 && (
       <button
         type="button"
         onClick={() => setSelectedStudentIds([])}
         className="text-brand-600 dark:text-brand-400 font-bold hover:underline cursor-pointer"
       >
         Clear ({selectedStudentIds.length})
       </button>
     )}
   </div>
 )}

 {/* Mobile Student Cards (Compact, structured, no horizontal clipping) */}
 <div className="block md:hidden space-y-2">
 {studentsLoading ? (
 <div className="py-8 text-center text-slate-600 dark:text-slate-400 text-xs font-medium">Loading live student roster...</div>
 ) : students.length === 0 ? (
 <div className="py-8 text-center text-slate-600 dark:text-slate-400 text-xs font-medium">No student records match the active scope filter.</div>
 ) : (
 students.map(s => {
 const isChecked = selectedStudentIds.includes(s.id);
 const cleanYear = s.year_level ? s.year_level.replace(/(?:\s*Year)+/gi, '').trim() + ' Year' : '';
 return (
 <div
 key={s.id}
 onClick={() => setSelectedStudentDetail(s)}
 className={`p-2.5 sm:p-3 rounded-xl border transition cursor-pointer bg-white dark:bg-navy-900 shadow-2xs space-y-1.5 touch-manipulation active:scale-[0.99] ${
 isChecked ? 'border-brand-500 bg-brand-50/40 dark:bg-brand-950/40 ring-1 ring-brand-500/30' : 'border-slate-200/90 dark:border-navy-800 hover:border-brand-300'
 }`}
 >
 {/* Top Row: Checkbox + Name + Reg No + Solved & Status */}
 <div className="flex items-center justify-between gap-1.5">
 <div className="flex items-center gap-2 min-w-0 flex-1">
 <div onClick={e => e.stopPropagation()} className="shrink-0 flex items-center">
 <input
 type="checkbox"
 checked={isChecked}
 onChange={e => {
 if (e.target.checked) setSelectedStudentIds(prev => [...prev, s.id]);
 else setSelectedStudentIds(prev => prev.filter(id => id !== s.id));
 }}
 className="rounded text-brand-600 focus:ring-brand-500 w-3.5 h-3.5"
 />
 </div>
 <div className="min-w-0 flex-1">
 <span className="font-bold text-xs text-slate-900 dark:text-white truncate block">
 {s.name}
 </span>
 <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate">
 <span>{s.reg_no}</span>
 {cleanYear && <span>• {cleanYear}</span>}
 {s.leetcode_username && (
 <span className="text-brand-600 dark:text-brand-400 font-bold truncate">@{s.leetcode_username}</span>
 )}
 </div>
 </div>
 </div>

 <div className="text-right shrink-0 flex items-center gap-1.5">
 <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 font-mono">
 {s.total_solved} Solved
 </span>
 <span className={`text-[10px] font-bold font-mono px-1.5 py-0.2 rounded-md ${
 s.status === 'ACTIVE'
 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
 : s.status === 'IMPROVING'
 ? 'bg-brand-50 text-brand-700 border border-brand-200 dark:bg-brand-950/40 dark:text-brand-300'
 : 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300'
 }`}>
 {s.status || 'ACTIVE'}
 </span>
 </div>
 </div>

 {/* Metrics Strip */}
 <div className="flex items-center justify-between gap-1.5 px-2 py-1 rounded-lg bg-slate-50/90 dark:bg-navy-950/80 border border-slate-100 dark:border-navy-800 text-[11px] font-mono">
 <div className="flex items-center gap-2 truncate">
 <span className="text-slate-500 text-[10px]">Mentor:</span>
 <span className="font-semibold text-slate-700 dark:text-slate-300 text-[10.5px] truncate">{s.assigned_staff || 'Unassigned'}</span>
 </div>
 <div className="flex items-center gap-2 shrink-0 text-[10px]">
 <span className="text-emerald-600 dark:text-emerald-400 font-bold">
 Δ {(() => {
 const w = String(s.weekly_change ?? 0);
 return w.startsWith('+') || w.startsWith('-') ? w : `+${w}`;
 })()}
 </span>
 {s.contest_standing && s.contest_standing !== '—' && (
 <span className="text-purple-600 dark:text-purple-400 font-bold">
 Rank #{s.contest_standing}
 </span>
 )}
 <span className="text-brand-600 dark:text-brand-400 font-bold">Inspect →</span>
 </div>
 </div>
 </div>
 );
 })
 )}
 </div>

 {/* Desktop Table View */}
 <div className="hidden md:block overflow-x-auto table-responsive-container border border-slate-100 dark:border-navy-800 rounded-xl">
 <table className="w-full min-w-[760px] text-left text-xs border-collapse">
 <thead className="table-header-group">
 <tr className="bg-slate-50 dark:bg-navy-800 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-400 font-mono">
 <th className="py-3 px-3 w-8">
 <input
 type="checkbox"
 checked={students.length > 0 && selectedStudentIds.length === students.length}
 onChange={e => {
 if (e.target.checked) setSelectedStudentIds(students.map(s => s.id));
 else setSelectedStudentIds([]);
 }}
 />
 </th>
 <th className="py-3 px-3">Student</th>
 <th className="py-3 px-3">LeetCode Handle</th>
 <th className="py-3 px-3 text-right">Solved</th>
 <th className="py-3 px-3 text-right">Weekly Δ</th>
 <th className="py-3 px-3 text-center">Contest</th>
 <th className="py-3 px-3 text-center">Status</th>
 <th className="py-3 px-3">Assigned Mentor</th>
 <th className="py-3 px-3">Last Activity</th>
 <th className="py-3 px-3 text-center">Actions</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
 {studentsLoading ? (
 <tr>
 <td colSpan={10} className="py-8 text-center text-slate-600 dark:text-slate-400">Loading live student roster...</td>
 </tr>
 ) : students.length === 0 ? (
 <tr>
 <td colSpan={10} className="py-8 text-center text-slate-600 dark:text-slate-400">No student records match the active scope filter.</td>
 </tr>
 ) : (
 students.map(s => {
 const isChecked = selectedStudentIds.includes(s.id);
 const cleanYear = s.year_level ? s.year_level.replace(/(?:\s*Year)+/gi, '').trim() + ' Year' : '';
 return (
 <tr
 key={s.id}
 onClick={() => setSelectedStudentDetail(s)}
 className={`hover:bg-slate-50/80 dark:hover:bg-navy-800/60 cursor-pointer transition ${isChecked ? 'bg-brand-50/30' : ''}`}
 >
 <td className="py-3 px-3" onClick={e => e.stopPropagation()}>
 <input
 type="checkbox"
 checked={isChecked}
 onChange={e => {
 if (e.target.checked) setSelectedStudentIds(prev => [...prev, s.id]);
 else setSelectedStudentIds(prev => prev.filter(id => id !== s.id));
 }}
 />
 </td>
 <td className="py-3 px-3 font-semibold text-slate-900 dark:text-white">
 <div>{s.name}</div>
 <div className="text-xs text-slate-600 dark:text-slate-400 font-mono font-normal">{s.reg_no}{cleanYear ? ` / ${cleanYear}` : ''}</div>
 </td>
 <td className="py-3 px-3 font-mono font-bold text-brand-600 dark:text-brand-400">
 @{s.leetcode_username || 'unlinked'}
 </td>
 <td className="py-3 px-3 text-right font-mono font-extrabold text-slate-900 dark:text-white">
 {s.total_solved}
 </td>
 <td className="py-3 px-3 text-right font-mono font-bold text-emerald-600">
 {s.weekly_change || '0'}
 </td>
 <td className="py-3 px-3 text-center font-mono font-bold">
 {s.contest_standing || '—'}
 </td>
 <td className="py-3 px-3 text-center">
 <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${s.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : s.status === 'IMPROVING' ? 'bg-brand-50 text-brand-700 border border-brand-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
 {s.status || 'ACTIVE'}
 </span>
 </td>
 <td className="py-3 px-3 text-slate-600 dark:text-slate-300 font-medium">
 {s.assigned_staff || 'Unassigned'}
 </td>
 <td className="py-3 px-3 text-slate-600 dark:text-slate-400 font-mono text-xs">
 {s.last_updated}
 </td>
 <td className="py-3 px-3 text-center" onClick={e => e.stopPropagation()}>
 <button
 onClick={() => setSelectedStudentDetail(s)}
 className="px-2 py-1 rounded bg-slate-100 dark:bg-navy-800 hover:bg-brand-50 hover:text-brand-600 text-slate-600 text-xs font-bold transition"
 >
 Inspect
 </button>
 </td>
 </tr>
 );
 })
 )}
 </tbody>
 </table>
 </div>

 {/* Dynamic Live Pagination */}
 {(() => {
   const pageSize = isMobile ? 6 : 15;
   const totalPages = Math.max(1, Math.ceil(studentsTotal / pageSize));
   const startIdx = studentsTotal === 0 ? 0 : (studentsPage - 1) * pageSize + 1;
   const endIdx = Math.min(studentsPage * pageSize, studentsTotal);

   const handlePageChange = (newPage: number) => {
     if (newPage < 1 || newPage > totalPages || newPage === studentsPage || studentsLoading) return;
     setStudentsPage(newPage);
     const el = document.getElementById('student-directory-section');
     if (el) {
       const rect = el.getBoundingClientRect();
       if (rect.top < 0) {
         el.scrollIntoView({ behavior: 'smooth', block: 'start' });
       }
     }
   };

   return (
     <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-700 dark:text-slate-400 pt-3 border-t border-slate-100 dark:border-navy-800">
       <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-center sm:justify-start">
         <span className="font-medium text-slate-700 dark:text-slate-300">
           Showing <strong className="font-mono text-brand-600 dark:text-brand-400 font-extrabold">{startIdx}–{endIdx}</strong> of <strong className="font-mono text-slate-900 dark:text-white font-extrabold">{studentsTotal}</strong> students
         </span>
         <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300 font-bold border border-slate-200/80 dark:border-navy-700">
           Page {studentsPage} of {totalPages}
         </span>
         {studentsLoading && (
           <span className="inline-flex items-center gap-1 text-[11px] text-brand-600 dark:text-brand-400 font-semibold animate-pulse">
             <Loader2 size={12} className="animate-spin" />
             Loading...
           </span>
         )}
       </div>

       <div className="flex items-center gap-1.5 shrink-0">
         {totalPages > 2 && (
           <button
             type="button"
             disabled={studentsPage <= 1 || studentsLoading}
             onClick={() => handlePageChange(1)}
             title="First Page"
             className="p-1.5 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 hover:bg-slate-100 dark:hover:bg-navy-700 text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:pointer-events-none font-bold transition flex items-center justify-center cursor-pointer active:scale-95 shadow-2xs"
           >
             <ChevronsLeft size={14} />
           </button>
         )}

         <button
           type="button"
           disabled={studentsPage <= 1 || studentsLoading}
           onClick={() => handlePageChange(studentsPage - 1)}
           aria-label="Previous Page"
           className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 hover:bg-slate-100 dark:hover:bg-navy-700 text-slate-700 dark:text-slate-200 disabled:opacity-30 disabled:pointer-events-none font-bold transition flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
         >
           <ChevronLeft size={14} />
           <span>Previous</span>
         </button>

         <div className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-navy-800/80 font-mono text-xs font-bold text-slate-800 dark:text-slate-200 border border-slate-200/60 dark:border-navy-700 flex items-center gap-1 select-none">
           <span className="text-brand-600 dark:text-brand-400 font-black">{studentsPage}</span>
           <span className="text-slate-400 font-normal">/</span>
           <span>{totalPages}</span>
         </div>

         <button
           type="button"
           disabled={studentsPage >= totalPages || studentsLoading}
           onClick={() => handlePageChange(studentsPage + 1)}
           aria-label="Next Page"
           className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 hover:bg-slate-100 dark:hover:bg-navy-700 text-slate-700 dark:text-slate-200 disabled:opacity-30 disabled:pointer-events-none font-bold transition flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
         >
           <span>Next</span>
           <ChevronRight size={14} />
         </button>

         {totalPages > 2 && (
           <button
             type="button"
             disabled={studentsPage >= totalPages || studentsLoading}
             onClick={() => handlePageChange(totalPages)}
             title="Last Page"
             className="p-1.5 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 hover:bg-slate-100 dark:hover:bg-navy-700 text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:pointer-events-none font-bold transition flex items-center justify-center cursor-pointer active:scale-95 shadow-2xs"
           >
             <ChevronsRight size={14} />
           </button>
         )}
       </div>
     </div>
   );
 })()}
 </Card>

 {/* 7. DEPARTMENT MATRIX & YEAR BENCHMARKS */}
 <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
 {/* Department Matrix */}
 <Card className="lg:col-span-12 p-5 space-y-3.5">
 <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-navy-800">
 <div>
 <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
 <Building2 size={16} className="text-brand-500" />
 <span>Department Performance & Intelligence Matrix</span>
 </h3>
 <p className="text-xs text-slate-700 dark:text-slate-400">Comprehensive real-time view of departmental health, engagement, and mentorship.</p>
 </div>
 <span className="text-xs text-slate-600 dark:text-slate-400 font-mono bg-slate-50 dark:bg-navy-950 px-2 py-1 rounded-md border border-slate-100 dark:border-navy-700">
 Click row to inspect details
 </span>
 </div>

 {/* Mobile View Cards (Fits without horizontal scroll) */}
 <div className="md:hidden space-y-3">
 {deptMatrix.map(d => {
 const isSelected = selectedDept === String(d.department_id);
 const badgeStyle = getDeptBadgeStyle(d.department_code);
 return (
 <div
 key={d.department_id}
 onClick={() => {
 setSelectedDept(String(d.department_id));
 setSelectedDeptIntelligence(d);
 }}
 className={`p-3.5 rounded-2xl border transition cursor-pointer space-y-3 ${
 isSelected 
 ? 'bg-brand-50/70 dark:bg-brand-900/30 border-brand-500 shadow-md ring-1 ring-brand-500/50' 
 : 'bg-slate-50/70 dark:bg-navy-950/70 border-slate-200 dark:border-navy-800'
 }`}
 >
 {/* Top Bar */}
 <div className="flex items-start justify-between gap-2">
 <div className="flex items-center gap-2 min-w-0 flex-wrap">
 {d.rank === 1 ? (
 <span className="px-1.5 py-0.5 rounded text-xs font-black bg-amber-400/20 text-amber-700 dark:text-amber-300 border border-amber-400/40">#1</span>
 ) : d.rank === 2 ? (
 <span className="px-1.5 py-0.5 rounded text-xs font-black bg-slate-200 dark:bg-navy-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-navy-600">#2</span>
 ) : d.rank === 3 ? (
 <span className="px-1.5 py-0.5 rounded text-xs font-black bg-amber-600/20 text-amber-800 dark:text-amber-400 border border-amber-600/40">#3</span>
 ) : (
 <span className="font-extrabold text-slate-600 text-xs">{d.rank ? `#${d.rank}` : '-'}</span>
 )}
 <span className={`px-2 py-0.5 rounded-md text-xs font-black border uppercase tracking-wider ${badgeStyle}`}>
 {d.department_code}
 </span>
 </div>

 <div className="flex items-center gap-1.5 shrink-0">
 <span className={`px-2 py-1 rounded-lg text-[10px] leading-tight text-center font-black border max-w-[94px] ${
 d.health_status === 'Excellent' || d.health_status === 'Healthy' ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30' :
 d.health_status === 'Needs Attention' ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/40' :
 'bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-500/40'
 }`}>
 {d.health_status || 'Unknown'}
 </span>
 <button
 onClick={(e) => { e.stopPropagation(); setSelectedDeptIntelligence(d); }}
 className="!min-h-0 px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 dark:bg-navy-800 dark:hover:bg-navy-700 dark:text-brand-300 dark:border-navy-700 inline-flex items-center gap-1"
 >
 <Activity size={11} />
 <span>Inspect</span>
 </button>
 </div>
 </div>

 {/* Metrics 3-Col Grid */}
 <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-xs">
 <div className="p-2.5 rounded-xl bg-white dark:bg-navy-900 border border-slate-100 dark:border-navy-800 shadow-sm">
 <div className="text-xs text-slate-600 dark:text-slate-400 font-semibold uppercase">Roster</div>
 <div className="font-extrabold text-slate-900 dark:text-white mt-0.5">{d.student_count}</div>
 <div className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">{d.active_count} active</div>
 </div>

 <div className="p-2.5 rounded-xl bg-white dark:bg-navy-900 border border-slate-100 dark:border-navy-800 shadow-sm">
 <div className="text-xs text-slate-600 dark:text-slate-400 font-semibold uppercase">Avg Solved</div>
 <div className="font-extrabold text-slate-900 dark:text-white mt-0.5 flex items-center justify-between">
 <span>{d.avg_solved}</span>
 <span className={`text-xs ${d.performance_trend === '↑' ? 'text-emerald-600' : d.performance_trend === '↓' ? 'text-rose-600' : 'text-slate-600 dark:text-slate-400'}`}>
 {d.performance_trend === '↑' ? '↑' : d.performance_trend === '↓' ? '↓' : '—'}
 </span>
 </div>
 <div className="text-xs text-indigo-600 dark:text-indigo-400 font-bold">{d.active_score || 0}/100 score</div>
 </div>

 <div className="p-2.5 rounded-xl bg-white dark:bg-navy-900 border border-slate-100 dark:border-navy-800 shadow-sm">
 <div className="text-xs text-slate-600 dark:text-slate-400 font-semibold uppercase">Mentors</div>
 <div className="font-extrabold text-slate-900 dark:text-white mt-0.5">{d.faculty_mentors || 0}</div>
 <div className="text-xs text-slate-700 dark:text-slate-400 font-bold">
 {d.faculty_mentors && d.faculty_mentors > 0 && d.student_count > 0 ? `1:${Math.round(d.student_count / d.faculty_mentors)} ratio` : 'Active'}
 </div>
 </div>
 </div>
 </div>
 );
 })}
 </div>

 {/* Desktop Table View */}
 <div className="hidden md:block overflow-x-auto table-responsive-container stylish-scrollbar">
 <table className="w-full min-w-[700px] text-left text-xs border-collapse whitespace-nowrap">
 <thead className="hidden md:table-header-group">
 <tr className="text-xs font-bold uppercase text-slate-700 dark:text-slate-400 font-mono border-b border-slate-100 dark:border-navy-800 bg-slate-50 dark:bg-navy-950/50">
 <th className="py-2.5 px-3 rounded-tl-lg">Rank</th>
 <th className="py-2.5 px-3">Dept</th>
 <th className="py-2.5 px-3 text-right">Roster</th>
 <th className="py-2.5 px-3 text-right">Active Score</th>
 <th className="py-2.5 px-3 text-center">Engagement</th>
 <th className="py-2.5 px-3 text-right">Avg Solved</th>

 <th className="py-2.5 px-3 text-right">Mentors</th>
 <th className="py-2.5 px-3 text-center">Health</th>
 <th className="py-2.5 px-3 text-center rounded-tr-lg">Action</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100 dark:divide-navy-800/60 font-mono">
 {deptMatrix.map(d => {
 const isSelected = selectedDept === String(d.department_id);
 const badgeStyle = getDeptBadgeStyle(d.department_code);
 return (
 <tr
 key={d.department_id}
 onClick={() => {
 setSelectedDept(String(d.department_id));
 setSelectedDeptIntelligence(d);
 }}
 className={`hover:bg-slate-50/80 dark:hover:bg-navy-800/80 cursor-pointer transition ${isSelected ? 'bg-brand-50/60 dark:bg-brand-900/20' : ''}`}
 >
 <td className="py-3 px-3">
 {d.rank === 1 ? (
 <span className="px-2 py-0.5 rounded text-xs font-black bg-amber-400/20 text-amber-700 dark:text-amber-300 border border-amber-400/40">#1</span>
 ) : d.rank === 2 ? (
 <span className="px-2 py-0.5 rounded text-xs font-black bg-slate-200 dark:bg-navy-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-navy-600">#2</span>
 ) : d.rank === 3 ? (
 <span className="px-2 py-0.5 rounded text-xs font-black bg-amber-600/20 text-amber-800 dark:text-amber-400 border border-amber-600/40">#3</span>
 ) : (
 <span className="font-extrabold text-slate-600 text-xs">{d.rank ? `#${d.rank}` : '-'}</span>
 )}
 </td>
 <td className="py-3 px-3">
 <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-black border uppercase tracking-wider ${badgeStyle}`}>
 {d.department_code}
 </span>
 </td>
 <td className="py-3 px-3 text-right">
 <div className="text-sm font-extrabold text-slate-900 dark:text-white font-mono">{d.student_count}</div>
 <div className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center justify-end gap-1 mt-0.5">
  <span>{d.active_count} active</span>
 </div>
 </td>
 <td className="py-3 px-3 text-right">
 <div className="flex flex-col items-end gap-1">
 <span className="font-extrabold text-slate-900 dark:text-white text-xs">{d.active_score || 0}/100</span>
 <div className="w-16 bg-slate-200 dark:bg-navy-900 rounded-full h-1.5 overflow-hidden">
 <div className="bg-gradient-to-r from-blue-600 to-indigo-600 h-1.5 rounded-full" style={{ width: `${d.active_score || 0}%` }} />
 </div>
 </div>
 </td>
 <td className="py-3 px-3 text-center">
 <span className={`px-2.5 py-1 rounded text-xs font-black tracking-wide uppercase border ${
 d.coding_engagement === 'HIGH' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' :
 d.coding_engagement === 'MEDIUM' ? 'bg-brand-500/15 text-brand-700 dark:text-brand-300 border-brand-500/30' :
 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
 }`}>
 {d.coding_engagement || 'N/A'}
 </span>
 </td>
 <td className="py-3 px-3 text-right">
 <div className="flex items-center justify-end gap-1.5">
 <span className="font-extrabold text-slate-900 dark:text-white text-xs">{d.avg_solved}</span>
 <span className={`text-xs font-bold flex items-center ${d.performance_trend === '↑' ? 'text-emerald-600 dark:text-emerald-400' : d.performance_trend === '↓' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-400'}`}>
 {d.performance_trend === '↑' ? <TrendingUp size={13} className="stroke-[2.5]" /> : d.performance_trend === '↓' ? <TrendingDown size={13} className="stroke-[2.5]" /> : <Minus size={13} />}
 </span>
 </div>
 </td>

 <td className="py-3 px-3 text-right">
 <div className="font-extrabold text-slate-900 dark:text-white text-xs">{d.faculty_mentors || 0}</div>
 {d.faculty_mentors && d.faculty_mentors > 0 && d.student_count > 0 ? (
 <div className="text-xs font-bold text-slate-600 dark:text-slate-300 font-mono mt-0.5">
 1:{Math.round(d.student_count / d.faculty_mentors)} ratio
 </div>
 ) : null}
 </td>
 <td className="py-3 px-3 text-center">
 <span className={`px-2.5 py-1 rounded text-xs font-black whitespace-nowrap border ${
 d.health_status === 'Excellent' || d.health_status === 'Healthy' ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30' :
 d.health_status === 'Needs Attention' ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/40' :
 'bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-500/40'
 }`}>
 {d.health_status || 'Unknown'}
 </span>
 </td>
 <td className="py-3 px-3 text-center">
 <button
 onClick={(e) => { e.stopPropagation(); setSelectedDeptIntelligence(d); }}
 className="px-2.5 py-1 rounded-lg text-xs font-bold bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200/60 dark:bg-navy-800 dark:hover:bg-navy-700 dark:text-brand-300 dark:border-navy-700 inline-flex items-center gap-1 transition shadow-xs cursor-pointer"
 title="Inspect Details"
 >
 <Activity size={13} />
 <span>Inspect</span>
 </button>
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 
 {deptMatrix.length === 0 && !loading && (
 <div className="p-8 text-center text-slate-700 dark:text-slate-400 font-mono text-sm border-t border-slate-100 dark:border-navy-800">
 No department data available.
 </div>
 )}
 </div>
 </Card>

 {/* Year Benchmarks & Skill Gaps Full-Width Row */}
 <div className="lg:col-span-12 grid grid-cols-1 lg:grid-cols-2 gap-6 my-6">
 {/* Year-Wise Academic Benchmarks Card */}
 <Card className="p-5 space-y-4">
 <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-navy-800">
 <div>
 <h4 className="font-display text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider font-mono flex items-center gap-2">
 <BarChart3 size={16} className="text-brand-500" />
 <span>Year-Wise Academic Benchmarks</span>
 </h4>
 <p className="text-xs text-slate-700 dark:text-slate-400 font-sans mt-0.5">Participation and health score breakdown by academic cohort.</p>
 </div>
 <span className="text-xs font-mono text-emerald-700 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 font-bold">
 Target: 80%+ Active
 </span>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 {yearMatrix.length === 0 ? (
 <div className="col-span-2 p-6 text-center text-slate-600 dark:text-slate-400 font-mono text-xs">No year benchmark metrics recorded.</div>
 ) : (
 yearMatrix.map(y => {
   const targetVal = y.year_level === 'II' ? '2' : y.year_level === 'III' ? '3' : y.year_level === 'IV' ? '4' : y.year_level;
   const isSelectedCohort = selectedYear === targetVal || selectedYear === y.year_level;
   return (
     <div
       key={y.year_level}
       onClick={() => setSelectedYearBenchmark(y)}
       className={`group relative p-4 rounded-xl font-mono flex flex-col justify-between shadow-xs transition-all duration-200 cursor-pointer border ${
         isSelectedCohort
           ? 'bg-brand-50/70 dark:bg-brand-950/40 border-brand-500 shadow-md ring-2 ring-brand-500/30'
           : 'bg-slate-50 dark:bg-navy-900/80 border-slate-200 dark:border-navy-800 hover:border-brand-500/60 hover:shadow-md hover:bg-slate-100/70 dark:hover:bg-navy-800/80'
       }`}
       title="Click to view detailed Cohort Benchmark Deck & Analytics"
     >
       <div className="flex items-start justify-between gap-2">
         <div className="space-y-1 min-w-0">
           <div className="font-extrabold text-slate-900 dark:text-white text-sm font-display flex items-center gap-2 flex-wrap">
             <span>{y.year}</span>
             <span className="text-[10px] font-sans px-2 py-0.5 rounded-full bg-slate-200 dark:bg-navy-800 text-slate-700 dark:text-slate-300 font-semibold">
               {y.student_count || 0} Students
             </span>
             {isSelectedCohort && (
               <span className="text-[10px] font-sans px-2 py-0.5 rounded-full bg-brand-600 text-white font-bold animate-pulse">
                 Active Filter
               </span>
             )}
           </div>
           <div className="text-xs text-slate-600 dark:text-slate-400 font-sans">
             Active: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{y.active_count || 0}</strong> / Inactive: <strong className="text-rose-600 dark:text-rose-400 font-bold">{y.inactive_count || 0}</strong>
           </div>
         </div>
         <div className="text-right shrink-0">
           <div className={`font-extrabold text-base ${y.participation_pct >= 80 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
             {y.participation_pct}%
           </div>
           <div className="text-xs font-sans text-slate-500 dark:text-slate-400">
             Health: <span className="font-bold text-brand-600 dark:text-brand-400">{y.health_score}</span>
           </div>
         </div>
       </div>

       <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-navy-800 flex items-center justify-between text-xs">
         <button
           type="button"
           onClick={(e) => {
             e.stopPropagation();
             handleYearClick(y);
           }}
           className={`px-2 py-1 rounded-lg text-[11px] font-sans font-bold transition flex items-center gap-1 ${
             isSelectedCohort
               ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 hover:bg-rose-200'
               : 'bg-slate-200 dark:bg-navy-800 text-slate-700 dark:text-slate-300 hover:bg-brand-100 hover:text-brand-700 dark:hover:bg-brand-900/40'
           }`}
           title={isSelectedCohort ? "Clear cohort filter" : "Filter student roster to this cohort"}
         >
           <Filter size={11} />
           <span>{isSelectedCohort ? 'Clear Cohort Filter' : 'Filter Roster'}</span>
         </button>

         <span className="text-[11px] font-sans text-brand-600 dark:text-brand-400 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
           <span>Inspect Cohort Deck</span>
           <ChevronRight size={13} />
         </span>
       </div>
     </div>
   );
 })
 )}
 </div>
 </Card>

 {/* Top Coding Skill Gaps Card */}
 <Card className="p-5 space-y-4">
 <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-2 border-b border-slate-100 dark:border-navy-800">
 <div className="min-w-0">
 <h4 className="font-display text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider font-mono flex items-start gap-2 leading-tight">
 <Target size={16} className="text-rose-500" />
 <span className="break-words">Top Institutional Skill Gaps & Focus Areas</span>
 </h4>
 <p className="text-xs text-slate-700 dark:text-slate-400 font-sans mt-0.5 leading-relaxed">Key problem topics requiring targeted mentor-led lab sprints.</p>
 </div>
 <span className="self-start shrink-0 text-xs font-mono text-rose-700 bg-rose-50 dark:bg-rose-950 dark:text-rose-300 px-2 py-1 rounded border border-rose-200 dark:border-rose-800 font-bold whitespace-nowrap">
 Priority Action
 </span>
 </div>

 <div className="space-y-3 font-mono">
 {institutionalSkillGaps.map((s) => (
 <div
   key={s.id}
   onClick={() => setSelectedSkillGap(s)}
   className="group relative p-3.5 rounded-xl bg-slate-50 dark:bg-navy-900/80 border border-slate-200 dark:border-navy-800 hover:border-brand-500/60 hover:shadow-md hover:bg-slate-100/70 dark:hover:bg-navy-800/80 transition-all duration-200 cursor-pointer flex flex-col justify-between gap-2.5"
   title="Click to open full Skill Diagnostic & 2-Week Lab Sprint Plan"
 >
   <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
     <div className="space-y-1 min-w-0">
       <div className="font-extrabold text-slate-900 dark:text-white text-xs font-sans leading-snug break-words flex items-center gap-1.5">
         <span>{s.name}</span>
       </div>
       <div className="text-xs text-slate-700 dark:text-slate-400 leading-relaxed">
         Benchmark Target: <strong className="text-slate-700 dark:text-slate-300 font-bold">{s.target}</strong>
       </div>
     </div>
     <div className="text-left sm:text-right flex flex-col items-start sm:items-end gap-1 min-w-0 shrink-0">
       <span className={`max-w-full px-2.5 py-0.5 rounded-full text-xs font-extrabold border whitespace-normal leading-tight ${
         s.color === 'rose' ? 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800' :
         s.color === 'amber' ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800' :
         'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800'
       }`}>
         {s.solve} solve rate
       </span>
       <span className="text-xs text-slate-700 dark:text-slate-400 font-bold uppercase tracking-tight leading-tight">{s.status}</span>
     </div>
   </div>

   {/* Progress bar comparison */}
   <div className="w-full bg-slate-200 dark:bg-navy-800 h-1.5 rounded-full overflow-hidden flex">
     <div
       className={`h-full ${s.color === 'rose' ? 'bg-rose-500' : s.color === 'amber' ? 'bg-amber-500' : 'bg-blue-500'}`}
       style={{ width: `${s.solvePct}%` }}
     />
     <div
       className="h-full bg-slate-300 dark:bg-navy-700 border-l border-white/40"
       style={{ width: `${Math.max(0, s.targetPct - s.solvePct)}%` }}
     />
   </div>

   <div className="flex items-center justify-between text-[11px] font-sans text-slate-500 dark:text-slate-400 pt-1">
     <span>Deficit: <strong className="text-rose-600 dark:text-rose-400 font-mono font-bold">{s.deficit}</strong></span>
     <span className="text-brand-600 dark:text-brand-400 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
       <span>Inspect Sprint Deck</span>
       <ChevronRight size={13} />
     </span>
   </div>
 </div>
 ))}
 </div>
 </Card>
 </div>
 </div>



 {/* Student Detail Drawer */}
 <StudentDetailDrawer
 student={selectedStudentDetail}
 staffList={staffList}
 onClose={() => setSelectedStudentDetail(null)}
 onReassign={handleReassign}
 />

 {/* Department Detail Drawer */}
 <DepartmentDetailDrawer
 department={selectedDeptIntelligence}
 onClose={() => setSelectedDeptIntelligence(null)}
 />

 {/* Staff Detail Drawer */}
 <StaffDetailDrawer
 staff={selectedStaffDetail}
 studentList={students}
 onClose={() => setSelectedStaffDetail(null)}
 onManageAllocation={() => {
 setSelectedStaffDetail(null);
 setShowStaffAllocationModal(true);
 }}
 onFilterDashboard={(staffId) => handleFilterByStaff(staffId, selectedStaffDetail?.username)}
 />

 {/* HOD Staff Allocation Manager Modal */}
 <StaffAllocationModal
 isOpen={showStaffAllocationModal}
 onClose={() => setShowStaffAllocationModal(false)}
 deptId={selectedDept !== 'ALL' ? Number(selectedDept) : undefined}
 departments={filteredDepartments}
 onRefreshAll={() => { loadScopedData(false); loadStudents(); }}
 />

 {/* Unassign All Mentees Confirmation Modal */}
 {confirmUnassignTarget && typeof document !== 'undefined' && createPortal(
 <div
 className="fixed inset-0 w-screen h-[100dvh] z-[999999] flex items-center justify-center p-4 bg-slate-950/90 dark:bg-black/90 backdrop-blur-xl animate-fade-in"
 onClick={e => { if (e.target === e.currentTarget) setConfirmUnassignTarget(null); }}
 >
 <div className="w-full max-w-md bg-white dark:bg-navy-950 rounded-2xl shadow-2xl border border-rose-200 dark:border-rose-800/60 overflow-hidden">
 {/* Red warning header */}
 <div className="bg-rose-50 dark:bg-rose-900/30 px-6 py-4 border-b border-rose-100 dark:border-rose-800/50 flex items-center gap-3">
 <div className="w-9 h-9 rounded-full bg-rose-100 dark:bg-rose-800/60 flex items-center justify-center flex-shrink-0">
 <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
 </div>
 <div>
 <div className="font-display text-sm font-bold text-rose-800 dark:text-rose-200">Unassign All Mentees</div>
 <div className="text-xs text-rose-600 dark:text-rose-400 font-mono">This action cannot be undone automatically</div>
 </div>
 </div>
 {/* Body */}
 <div className="px-6 py-5 space-y-3">
 <p className="text-sm text-slate-700 dark:text-slate-300">
 You are about to remove <span className="font-bold text-slate-900 dark:text-white">all assigned students</span> from:
 </p>
 <div className="px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 font-mono font-bold text-slate-900 dark:text-white text-sm">
 {confirmUnassignTarget.name}
 </div>
 <p className="text-xs text-slate-700 dark:text-slate-400">
 All students will be moved back to the <span className="font-semibold text-amber-600">unassigned queue</span>. They can be reassigned manually or via auto-distribute.
 </p>
 </div>
 {/* Actions */}
 <div className="px-4 py-3 sm:px-6 sm:py-4 bg-slate-50 dark:bg-navy-950/50 border-t border-slate-100 dark:border-navy-800 flex items-center justify-end gap-3">
 <button
 onClick={() => setConfirmUnassignTarget(null)}
 disabled={confirmUnassignLoading}
 className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 hover:bg-slate-100 transition disabled:opacity-50"
 >
 Cancel
 </button>
 <button
 onClick={executeUnassignAll}
 disabled={confirmUnassignLoading}
 className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition disabled:opacity-60 flex items-center gap-2"
 >
 {confirmUnassignLoading ? (
 <><span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full" />Unassigning...</>
 ) : (
 <>Confirm Unassign All</>
 )}
 </button>
 </div>
 </div>
 </div>,
 document.body
 )}

 {/* Dedicated Report Hub Modal */}
 <ReportHubModal
 isOpen={showReportHubModal}
 onClose={() => setShowReportHubModal(false)}
 deptId={selectedDept !== 'ALL' ? Number(selectedDept) : undefined}
 departments={filteredDepartments}
 />

 {/* View Methodology Modal */}
 {showMethodologyModal && typeof document !== 'undefined' && createPortal(
 <div className="fixed inset-0 w-screen h-[100dvh] z-[999999] flex items-center justify-center p-4 bg-slate-950/85 dark:bg-black/85 backdrop-blur-md animate-fade-in" onClick={e => e.target === e.currentTarget && setShowMethodologyModal(false)}>
 <div className="w-full max-w-lg bg-white dark:bg-navy-950 rounded-2xl p-6 border border-slate-200 dark:border-navy-700 shadow-2xl space-y-4">
 <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-navy-800">
 <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
 5-Dimension Health Index Methodology
 </h3>
 <button onClick={() => setShowMethodologyModal(false)} className="p-1 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100"><X size={16} /></button>
 </div>
 <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-sans">
 <p>The Nandha Coding Health Score evaluates department and staff cohorts using five mathematically weighted dimensions from canonical database telemetry:</p>
 <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-navy-800 font-mono space-y-1.5 text-xs">
 <div>• <strong>Participation (25% weight):</strong> % of assigned students with ≥1 problem solved</div>
 <div>• <strong>Consistency (20% weight):</strong> Average solved problems vs. benchmark</div>
 <div>• <strong>Growth (20% weight):</strong> Weekly incremental problem solve velocity</div>
 <div>• <strong>Contest Performance (20% weight):</strong> Contest rating scaled vs. 1200-1800 band</div>
 <div>• <strong>Difficulty Ratio (15% weight):</strong> Medium & Hard problem distribution</div>
 </div>
 </div>
 <div className="flex justify-end pt-2">
 <button onClick={() => setShowMethodologyModal(false)} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200">
 Close
 </button>
 </div>
 </div>
 </div>,
 document.body
 )}

 {/* Ask AI Modal */}
 {showAIModal && typeof document !== 'undefined' && createPortal(
 <div className="fixed inset-0 w-screen h-[100dvh] z-[999999] flex items-center justify-center p-4 bg-slate-950/85 dark:bg-black/85 backdrop-blur-md animate-fade-in" onClick={e => e.target === e.currentTarget && setShowAIModal(false)}>
 <div className="w-full max-w-lg bg-white dark:bg-navy-950 rounded-2xl p-6 border border-slate-200 dark:border-navy-700 shadow-2xl space-y-4">
 <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-navy-800">
 <h3 className="font-display text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
 <CheckCircle2 size={16} className="text-brand-600" />
 <span>Ask Institution AI</span>
 </h3>
 <button onClick={() => setShowAIModal(false)} className="p-1 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100"><X size={16} /></button>
 </div>
 <form onSubmit={handleAIQuery} className="space-y-3">
 <input
 value={aiQuery}
 onChange={e => setAiQuery(e.target.value)}
 placeholder="Ask about active cohort, department health, or contest ratings..."
 className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-navy-700 text-xs outline-none focus:border-brand-500"
 />
 <div className="flex justify-end gap-2">
 <button type="button" onClick={() => setShowAIModal(false)} className="px-3.5 py-2 rounded-xl bg-slate-100 text-xs font-bold text-slate-600">Cancel</button>
 <button type="submit" disabled={aiLoading || !aiQuery.trim()} className="px-4 py-2 rounded-xl bg-brand-600 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50">
 {aiLoading && <RefreshCw size={12} className="animate-spin" />}
 <span>Query AI</span>
 </button>
 </div>
 </form>
 {aiResponse && (
 <div className="p-4 rounded-xl bg-slate-50 text-xs leading-relaxed text-slate-800 whitespace-pre-wrap">
 {aiResponse.answer || JSON.stringify(aiResponse, null, 2)}
 </div>
 )}
 </div>
 </div>,
 document.body
 )}

 {/* What-If Simulator Modal */}
 {showWhatIfModal && typeof document !== 'undefined' && createPortal(
 <div className="fixed inset-0 w-screen h-[100dvh] z-[999999] flex items-center justify-center p-4 bg-slate-950/85 dark:bg-black/85 backdrop-blur-md animate-fade-in" onClick={e => e.target === e.currentTarget && setShowWhatIfModal(false)}>
 <div className="w-full max-w-md bg-white dark:bg-navy-950 rounded-2xl p-6 border border-slate-200 dark:border-navy-700 shadow-2xl space-y-4">
 <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-navy-800">
 <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
 What-If Policy Simulator (Read-Only)
 </h3>
 <button onClick={() => setShowWhatIfModal(false)} className="p-1 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100"><X size={16} /></button>
 </div>
 <div className="space-y-4 text-xs">
 <div className="space-y-1.5">
 <div className="flex justify-between font-mono font-bold">
 <span>Target Participation:</span>
 <span className="text-brand-600">{whatIfTarget}%</span>
 </div>
 <input
 type="range"
 min="60"
 max="100"
 value={whatIfTarget}
 onChange={e => handleWhatIf(Number(e.target.value))}
 className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-600"
 />
 </div>

 <div className="p-4 rounded-xl bg-slate-900 text-white flex items-center justify-around font-mono">
 <div className="text-center">
 <div className="text-xs text-slate-600 dark:text-slate-400">Current Health</div>
 <div className="text-2xl font-bold">{health?.health_score}</div>
 </div>
 <ArrowRight size={18} className="text-brand-400" />
 <div className="text-center">
 <div className="text-xs text-emerald-400 font-bold">Projected Health</div>
 <div className="text-2xl font-bold text-emerald-400">
 {whatIfResult?.projected_health_score || (Number(health?.health_score) + 3.8).toFixed(1)}
 </div>
 </div>
 </div>
 </div>
 <div className="flex justify-end pt-2">
 <button onClick={() => setShowWhatIfModal(false)} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold">
 Close Simulator
 </button>
 </div>
 </div>
 </div>,
 document.body
 )}

      {/* =========================================================================
          COHORT ACADEMIC BENCHMARK & INTELLIGENCE DECK MODAL
          ========================================================================= */}
      {selectedYearBenchmark && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 w-screen h-[100dvh] z-[999999] flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/95 dark:bg-black/95 backdrop-blur-xl animate-fade-in"
          onClick={e => e.target === e.currentTarget && setSelectedYearBenchmark(null)}
        >
          <div className="w-full max-w-2xl bg-white dark:bg-navy-950 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-navy-800 flex items-center justify-between gap-3 shrink-0 bg-slate-50/50 dark:bg-navy-900/50">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-950/60 border border-brand-200 dark:border-brand-800 flex items-center justify-center text-brand-600 dark:text-brand-400 shrink-0">
                  <GraduationCap size={20} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-display text-base font-bold text-slate-900 dark:text-white truncate flex items-center gap-2">
                    <span>{selectedYearBenchmark.year} Cohort Intelligence Deck</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 font-bold border border-brand-200 dark:border-brand-800">
                      Cohort {selectedYearBenchmark.year_level}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-sans mt-0.5 truncate">
                    Academic performance, participation health, and mentor intervention roadmap
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedYearBenchmark(null)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-800 transition"
                title="Close Deck"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-5 custom-scrollbar text-xs font-sans">
              {/* Telemetry Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-navy-900/80 border border-slate-200 dark:border-navy-800">
                  <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block font-mono">Cohort Strength</span>
                  <span className="text-xl font-extrabold text-slate-900 dark:text-white font-mono mt-0.5 block">
                    {selectedYearBenchmark.student_count || 0}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">Total Enrolled</span>
                </div>

                <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/60">
                  <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 block font-mono">Active Solvers</span>
                  <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5 block">
                    {selectedYearBenchmark.active_count || 0}
                  </span>
                  <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold">
                    {selectedYearBenchmark.participation_pct}% Participation
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200/70 dark:border-rose-800/60">
                  <span className="text-[10px] uppercase font-bold text-rose-700 dark:text-rose-400 block font-mono">Inactive Cohort</span>
                  <span className="text-xl font-extrabold text-rose-600 dark:text-rose-400 font-mono mt-0.5 block">
                    {selectedYearBenchmark.inactive_count || Math.max(0, (selectedYearBenchmark.student_count || 0) - (selectedYearBenchmark.active_count || 0))}
                  </span>
                  <span className="text-[11px] text-rose-700 dark:text-rose-300 font-semibold">Needs Follow-Up</span>
                </div>

                <div className="p-3 rounded-xl bg-brand-50/60 dark:bg-brand-950/30 border border-brand-200/70 dark:border-brand-800/60">
                  <span className="text-[10px] uppercase font-bold text-brand-700 dark:text-brand-400 block font-mono">Health Score</span>
                  <span className="text-xl font-extrabold text-brand-600 dark:text-brand-400 font-mono mt-0.5 block">
                    {selectedYearBenchmark.health_score}
                  </span>
                  <span className="text-[11px] text-brand-700 dark:text-brand-300 font-semibold">Out of 100 Index</span>
                </div>
              </div>

              {/* Target Compliance Progress Strip */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-navy-900/80 border border-slate-200 dark:border-navy-800 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Target size={14} className="text-brand-600" />
                    <span>80%+ Institutional Participation Benchmark</span>
                  </span>
                  <span className={`font-extrabold ${selectedYearBenchmark.participation_pct >= 80 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                    {selectedYearBenchmark.participation_pct}% / 80.0%
                  </span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-navy-800 h-2.5 rounded-full overflow-hidden relative">
                  <div
                    className={`h-full transition-all duration-500 ${selectedYearBenchmark.participation_pct >= 80 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                    style={{ width: `${Math.min(100, selectedYearBenchmark.participation_pct)}%` }}
                  />
                  {/* Target line at 80% */}
                  <div className="absolute top-0 bottom-0 left-[80%] w-0.5 bg-rose-500 shadow-sm" title="80% Target" />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
                  <span>
                    {selectedYearBenchmark.participation_pct >= 80 ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                        <CheckCircle2 size={13} />
                        Exceeds target by +{(selectedYearBenchmark.participation_pct - 80).toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
                        <AlertTriangle size={13} />
                        Deficit: {(80 - selectedYearBenchmark.participation_pct).toFixed(1)}% below institutional target
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-slate-500">Benchmark: 80.0% Minimum</span>
                </div>
              </div>

              {/* Strategic Cohort Directives */}
              <div className="space-y-2">
                <h4 className="font-display text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 font-mono flex items-center gap-1.5">
                  <BrainCircuit size={14} className="text-brand-600" />
                  <span>Strategic Interventions For {selectedYearBenchmark.year}</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-800 space-y-1">
                    <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Activity size={13} className="text-rose-500" />
                      <span>Inactive Reactivation</span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                      Assign faculty mentors to the {selectedYearBenchmark.inactive_count || Math.max(0, (selectedYearBenchmark.student_count || 0) - (selectedYearBenchmark.active_count || 0))} zero-solve students for 1-on-1 account verification.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-800 space-y-1">
                    <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Activity size={13} className="text-amber-500" />
                      <span>Weekly Solve Velocity</span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                      Target 3 solved problems weekly per student via supervised laboratory coding hours and Friday sync sprints.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-800 space-y-1">
                    <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Award size={13} className="text-indigo-500" />
                      <span>Contest Onboarding</span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                      Mandate bi-weekly LeetCode contest attendance to build real-time problem-solving resilience and algorithmic grit.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-navy-800 bg-slate-50/70 dark:bg-navy-950/50 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setAiQuery(`Provide a detailed faculty intervention roadmap for ${selectedYearBenchmark.year} cohort. Total students: ${selectedYearBenchmark.student_count}, Active: ${selectedYearBenchmark.active_count}, Inactive: ${selectedYearBenchmark.inactive_count || 0}, Health score: ${selectedYearBenchmark.health_score}/100.`);
                  setSelectedYearBenchmark(null);
                  setShowAIModal(true);
                }}
                className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 font-bold text-xs flex items-center gap-1.5 transition"
              >
                <CheckCircle2 size={13} className="text-brand-600" />
                <span>Ask AI About Cohort</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    handleYearClick(selectedYearBenchmark);
                    setSelectedYearBenchmark(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-sm"
                >
                  <Filter size={13} />
                  <span>Filter Student Roster to {selectedYearBenchmark.year}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedYearBenchmark(null)}
                  className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-navy-800 text-slate-800 dark:text-slate-200 hover:bg-slate-300 font-bold text-xs transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* =========================================================================
          INSTITUTIONAL SKILL GAP & 2-WEEK LAB SPRINT DECK MODAL
          ========================================================================= */}
      {selectedSkillGap && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 w-screen h-[100dvh] z-[999999] flex items-center justify-center p-2 sm:p-4 bg-slate-950/95 dark:bg-black/95 backdrop-blur-xl animate-fade-in"
          onClick={e => e.target === e.currentTarget && setSelectedSkillGap(null)}
        >
          <div className="w-full max-w-3xl sm:max-w-4xl bg-white dark:bg-navy-950 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-2xl overflow-hidden flex flex-col max-h-[88dvh] sm:max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-3.5 sm:p-5 border-b border-slate-100 dark:border-navy-800 flex items-center justify-between gap-2.5 shrink-0 bg-slate-50/50 dark:bg-navy-900/50">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl border flex items-center justify-center shrink-0 ${
                  selectedSkillGap.color === 'rose'
                    ? 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/60 dark:border-rose-800'
                    : selectedSkillGap.color === 'amber'
                    ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/60 dark:border-amber-800'
                    : 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/60 dark:border-blue-800'
                }`}>
                  <Target size={18} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-display text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate flex items-center gap-2">
                    <span className="truncate">{selectedSkillGap.name}</span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border shrink-0 ${
                      selectedSkillGap.color === 'rose'
                        ? 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300'
                        : selectedSkillGap.color === 'amber'
                        ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300'
                        : 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300'
                    }`}>
                      {selectedSkillGap.status}
                    </span>
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 font-sans mt-0.5 truncate">
                    Institutional algorithmic gap diagnostic & faculty-led 2-week laboratory intervention plan
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSkillGap(null)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-800 transition shrink-0"
                title="Close Deck"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-3.5 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5 custom-scrollbar text-xs font-sans flex-1 min-h-0">
              {/* Telemetry Metric Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-navy-900/80 border border-slate-200 dark:border-navy-800">
                  <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block font-mono">Current Solve Rate</span>
                  <span className={`text-xl font-extrabold font-mono mt-0.5 block ${
                    selectedSkillGap.color === 'rose' ? 'text-rose-600' : selectedSkillGap.color === 'amber' ? 'text-amber-600' : 'text-blue-600'
                  }`}>
                    {selectedSkillGap.solve}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">Telemetry Data</span>
                </div>

                <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/60">
                  <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 block font-mono">Benchmark Target</span>
                  <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5 block">
                    {selectedSkillGap.target}
                  </span>
                  <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold">Institutional Standard</span>
                </div>

                <div className="p-3 rounded-xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200/70 dark:border-rose-800/60">
                  <span className="text-[10px] uppercase font-bold text-rose-700 dark:text-rose-400 block font-mono">Deficit Gap</span>
                  <span className="text-xl font-extrabold text-rose-600 dark:text-rose-400 font-mono mt-0.5 block">
                    {selectedSkillGap.deficit}
                  </span>
                  <span className="text-[11px] text-rose-700 dark:text-rose-300 font-semibold">Rate Deficit</span>
                </div>

                <div className="p-3 rounded-xl bg-brand-50/60 dark:bg-brand-950/30 border border-brand-200/70 dark:border-brand-800/60">
                  <span className="text-[10px] uppercase font-bold text-brand-700 dark:text-brand-400 block font-mono">Intervention</span>
                  <span className="text-xl font-extrabold text-brand-600 dark:text-brand-400 font-mono mt-0.5 block">
                    2-Week
                  </span>
                  <span className="text-[11px] text-brand-700 dark:text-brand-300 font-semibold">Lab Sprint Program</span>
                </div>
              </div>

              {/* Algorithmic Diagnostic & Root Causes */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-navy-900/80 border border-slate-200 dark:border-navy-800 space-y-3">
                <div className="flex items-center gap-2 font-display text-xs font-bold text-slate-900 dark:text-white uppercase font-mono tracking-wider">
                  <AlertTriangle size={15} className="text-amber-500" />
                  <span>Algorithmic Diagnosis & Student Cognitive Friction</span>
                </div>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-xs">
                  {selectedSkillGap.diagnosis}
                </p>
                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-tight block font-mono">
                    Identified Root Causes:
                  </span>
                  {selectedSkillGap.rootCauses.map((rc, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                      <span>{rc}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 2-Week Lab Sprint Plan */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-navy-900/80 border border-slate-200 dark:border-navy-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-display text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white font-mono flex items-center gap-2">
                    <BookOpen size={15} className="text-brand-600" />
                    <span>2-Week Laboratory Intervention Curriculum</span>
                  </h4>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-300 font-bold">
                    Faculty-Led
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-800 space-y-1">
                    <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-md bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-300 flex items-center justify-center font-mono text-[11px] font-extrabold">1</span>
                      <span>{selectedSkillGap.sprintPlan.phase1Title}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                      {selectedSkillGap.sprintPlan.phase1Desc}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-800 space-y-1">
                    <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-md bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 flex items-center justify-center font-mono text-[11px] font-extrabold">2</span>
                      <span>{selectedSkillGap.sprintPlan.phase2Title}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                      {selectedSkillGap.sprintPlan.phase2Desc}
                    </p>
                  </div>
                </div>

                <div className="pt-1">
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-tight block font-mono mb-1.5">
                    Faculty Mentor Directives:
                  </span>
                  <div className="space-y-1">
                    {selectedSkillGap.sprintPlan.mentorDirectives.map((md, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-[11px] text-slate-700 dark:text-slate-300">
                        <CheckCircle2 size={13} className="text-emerald-500 mt-0.5 shrink-0" />
                        <span>{md}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Curated 5-Problem LeetCode Practice Ladder */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="font-display text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white font-mono flex items-center gap-2">
                    <Award size={15} className="text-amber-500" />
                    <span>Curated LeetCode Problem Ladder (5 Key Sprints)</span>
                  </h4>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-sans">
                    Click problem to open directly on LeetCode
                  </span>
                </div>

                <div className="border border-slate-200 dark:border-navy-800 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-navy-800 bg-white dark:bg-navy-950">
                  {selectedSkillGap.problems.map((prob) => (
                    <div
                      key={prob.number}
                      className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-navy-900/60 transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs font-mono font-bold text-slate-400 dark:text-slate-500 w-8">
                          #{prob.number}
                        </span>
                        <div className="min-w-0">
                          <a
                            href={prob.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-bold text-slate-900 dark:text-white hover:text-brand-600 dark:hover:text-brand-400 text-xs flex items-center gap-1.5 group"
                          >
                            <span className="truncate">{prob.title}</span>
                            <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity text-brand-600" />
                          </a>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono">
                            Pattern: {prob.pattern}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                          prob.difficulty === 'Easy'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : prob.difficulty === 'Medium'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        }`}>
                          {prob.difficulty}
                        </span>
                        <a
                          href={prob.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-navy-800 hover:bg-brand-600 hover:text-white text-slate-700 dark:text-slate-300 text-[11px] font-bold flex items-center gap-1 transition"
                        >
                          <span>Solve</span>
                          <ExternalLink size={11} />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 sm:p-4 border-t border-slate-100 dark:border-navy-800 bg-slate-50/90 dark:bg-navy-950/90 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const text = `=== 2-WEEK LAB SPRINT: ${selectedSkillGap.name} ===\nDeficit: ${selectedSkillGap.deficit} (Current: ${selectedSkillGap.solve}, Target: ${selectedSkillGap.target})\n\n${selectedSkillGap.sprintPlan.phase1Title}:\n${selectedSkillGap.sprintPlan.phase1Desc}\n\n${selectedSkillGap.sprintPlan.phase2Title}:\n${selectedSkillGap.sprintPlan.phase2Desc}\n\nCurated LeetCode Ladder:\n${selectedSkillGap.problems.map(p => `#${p.number} ${p.title} (${p.difficulty}) - ${p.url}`).join('\n')}`;
                    navigator.clipboard.writeText(text);
                    setCopiedSkillPlan(true);
                    notify.success('Sprint syllabus copied to clipboard!', '', { category: 'SYSTEM' });
                    setTimeout(() => setCopiedSkillPlan(false), 2000);
                  }}
                  className="flex-1 sm:flex-initial px-3 py-2 rounded-xl bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
                >
                  <Copy size={13} className="text-slate-600" />
                  <span className="truncate">{copiedSkillPlan ? 'Copied!' : 'Copy Sprint Syllabus'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAiQuery(`Generate a customized day-by-day lesson plan and laboratory code examples for teaching ${selectedSkillGap.name}. Current cohort solve rate is ${selectedSkillGap.solve} vs target ${selectedSkillGap.target}. Focus on overcoming: ${selectedSkillGap.rootCauses.join('; ')}.`);
                    setSelectedSkillGap(null);
                    setShowAIModal(true);
                  }}
                  className="flex-1 sm:flex-initial px-3 py-2 rounded-xl bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
                >
                  <CheckCircle2 size={13} className="text-brand-600" />
                  <span className="truncate">Ask AI for Lesson Plan</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStatus('PENDING');
                    notify.info(`Filtered directory to in-progress students for ${selectedSkillGap.name} intervention`, '', { category: 'ALLOCATION' });
                    setSelectedSkillGap(null);
                    setTimeout(() => {
                      document.getElementById('student-directory-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 100);
                  }}
                  className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-sm active:scale-95 cursor-pointer"
                >
                  <Filter size={13} />
                  <span className="truncate">Filter Struggling Solvers Below</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedSkillGap(null)}
                  className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-navy-800 text-slate-800 dark:text-slate-200 hover:bg-slate-300 font-bold text-xs transition active:scale-95 cursor-pointer shrink-0"
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




