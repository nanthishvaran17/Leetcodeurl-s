import React, { useState, useEffect, useMemo } from 'react';
import {
 Users, UserPlus, RefreshCw, CheckCircle2, AlertTriangle,
 Search, Sliders, ArrowRight, Power, Filter, X, Building2,
 Trash2, UserCheck, ShieldAlert, Sparkles, Check, AlertOctagon,
 Eye, BookOpen, Trophy, Award, UserMinus
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { AllocationConfirmationModal } from './admin/AllocationConfirmationModal';

export const AdminStaffAllocationPanel: React.FC = () => {
 const { user } = useAuth();
 const { notify } = useNotification();

 const [staffList, setStaffList] = useState<any[]>([]);
 const [unassigned, setUnassigned] = useState<any[]>([]);
 const [departments, setDepartments] = useState<any[]>([]);
 const [selectedStudents, setSelectedStudents] = useState<number[]>([]);
 const [targetStaffId, setTargetStaffId] = useState<number | ''>('');
 const [loading, setLoading] = useState<boolean>(true);
 const [submitting, setSubmitting] = useState<boolean>(false);
 const [showAllocationConfirmModal, setShowAllocationConfirmModal] = useState<boolean>(false);

 // Filter States for Unassigned Queue
 const [selectedDept, setSelectedDept] = useState<string>('ALL');
 const [selectedYear, setSelectedYear] = useState<string>('ALL');
 const [searchQuery, setSearchQuery] = useState<string>('');

 // Filter States for Staff Roster
 const [staffSearchQuery, setStaffSearchQuery] = useState<string>('');
 const [staffWorkloadFilter, setStaffWorkloadFilter] = useState<string>('ALL'); // ALL, FULL, PARTIAL, EMPTY, DISABLED

 // Modals & Confirmation States (Zero Native Alerts/Confirms)
 const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
 const [newUsername, setNewUsername] = useState<string>('');
 const [newEmail, setNewEmail] = useState<string>('');
 const [newPassword, setNewPassword] = useState<string>('Staff@123');
 const [newDeptId, setNewDeptId] = useState<number | ''>('');

 // Custom Confirmation Dialog State
 const [confirmModal, setConfirmModal] = useState<{
 isOpen: boolean;
 type: 'auto_assign' | 'delete_staff' | 'toggle_status' | 'auto_rebalance' | null;
 title: string;
 description: string;
 targetStaff?: any;
 processing?: boolean;
 result?: any;
 }>({
 isOpen: false,
 type: null,
 title: '',
 description: ''
 });

 // View Staff Assigned Roster & Mentoring Progress Modal State
 const [viewRosterModal, setViewRosterModal] = useState<{
 isOpen: boolean;
 loading: boolean;
 staff: any;
 data: any;
 }>({
 isOpen: false,
 loading: false,
 staff: null,
 data: null
 });

 useEffect(() => {
 fetchInitialData();
 }, []);

 const fetchInitialData = async () => {
 setLoading(true);
 try {
 const [staffRes, unassignedRes, deptRes] = await Promise.all([
 api.get('/admin/staff-list'),
 api.get('/admin/unassigned-students'),
 api.get('/departments')
 ]);
 setStaffList(staffRes.data || []);
 setUnassigned(unassignedRes.data?.students || []);
 const depts = deptRes.data || [];
 setDepartments(depts);

 if (user?.department_id) {
 setNewDeptId(user.department_id);
 } else if (depts.length > 0) {
 setNewDeptId(depts[0].id);
 }
 } catch (err) {
 console.error('Error loading allocation data:', err);
 } finally {
 setLoading(false);
 }
 };

 const fetchAllocationData = async () => {
 setLoading(true);
 try {
 const params: any = {};
 if (selectedDept !== 'ALL') params.dept_id = Number(selectedDept);
 if (selectedYear !== 'ALL') params.year_level = selectedYear;

 const [staffRes, unassignedRes] = await Promise.all([
 api.get('/admin/staff-list', { params: selectedDept !== 'ALL' ? { dept_id: Number(selectedDept) } : {} }),
 api.get('/admin/unassigned-students', { params })
 ]);
 setStaffList(staffRes.data || []);
 setUnassigned(unassignedRes.data?.students || []);
 } catch (err) {
 console.error('Error loading filtered allocation data:', err);
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 fetchAllocationData();
 }, [selectedDept, selectedYear]);

 // Client-side filtering for Unassigned Queue
 const filteredUnassigned = useMemo(() => {
 return unassigned.filter((st: any) => {
 const matchSearch = !searchQuery.trim() ||
 (st.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
 (st.reg_no || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
 (st.username || '').toLowerCase().includes(searchQuery.toLowerCase());

 const matchDept = selectedDept === 'ALL' ||
 String(st.department_id) === String(selectedDept) ||
 (st.department || '').toUpperCase() === selectedDept.toUpperCase();

 const matchYear = selectedYear === 'ALL' ||
 (st.year_level || '').toUpperCase() === selectedYear.toUpperCase();

 return matchSearch && matchDept && matchYear;
 });
 }, [unassigned, searchQuery, selectedDept, selectedYear]);

 // Client-side filtering for Staff List
 const filteredStaffList = useMemo(() => {
 return staffList.filter((st: any) => {
 if (selectedDept !== 'ALL' && String(st.department_id) !== String(selectedDept)) {
 return false;
 }
 if (staffSearchQuery.trim()) {
 const q = staffSearchQuery.toLowerCase();
 const matchName = (st.username || '').toLowerCase().includes(q);
 const matchEmail = (st.email || '').toLowerCase().includes(q);
 if (!matchName && !matchEmail) return false;
 }
 const count = st.assigned_count || 0;
 if (staffWorkloadFilter === 'FULL' && count < 30) return false;
 if (staffWorkloadFilter === 'PARTIAL' && (count === 0 || count >= 30)) return false;
 if (staffWorkloadFilter === 'EMPTY' && count > 0) return false;
 if (staffWorkloadFilter === 'DISABLED' && st.is_active) return false;

 return true;
 });
 }, [staffList, selectedDept, staffSearchQuery, staffWorkloadFilter]);

 const activeStaffCount = useMemo(() => staffList.filter(s => s.is_active).length, [staffList]);

 // ─── Staff Assigned Roster Modal Handler ─────────────────────────
 const handleOpenStaffRoster = async (st: any) => {
 setViewRosterModal({ isOpen: true, loading: true, staff: st, data: null });
 try {
 const res = await api.get(`/faculty-assignments/faculty/${st.id}`);
 setViewRosterModal({ isOpen: true, loading: false, staff: st, data: res.data });
 } catch (err: any) {
 notify.error('Failed to Load Roster', err.response?.data?.detail || 'Could not fetch assigned students.');
 setViewRosterModal({ isOpen: false, loading: false, staff: null, data: null });
 }
 };

 const handleUnassignStudentFromStaff = async (studentId: number) => {
 if (!viewRosterModal.staff) return;
 try {
 await api.post('/faculty-assignments/unassign', {
 faculty_id: viewRosterModal.staff.id,
 student_ids: [studentId]
 });
 notify.success('Student Unassigned', 'Student removed from staff portfolio.');
 handleOpenStaffRoster(viewRosterModal.staff);
 fetchAllocationData();
 } catch (err: any) {
 notify.error('Unassign Failed', err.response?.data?.detail || 'Could not unassign student.');
 }
 };

 // ─── 1. Create Staff Handler ──────────────────────────────────────────────
 const handleCreateStaff = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!newUsername.trim() || !newEmail.trim()) return;

 setSubmitting(true);
 try {
 await api.post('/admin/staff', {
 username: newUsername.trim(),
 email: newEmail.trim(),
 password: newPassword,
 department_id: newDeptId ? Number(newDeptId) : (user?.department_id || undefined)
 });
 notify.success('Staff Account Created', `Credentials: ${newEmail.trim()} / ${newPassword}`);
 setNewUsername('');
 setNewEmail('');
 setShowCreateModal(false);
 fetchAllocationData();
 } catch (err: any) {
 notify.error('Creation Failed', err.response?.data?.detail || 'Failed to create staff account.');
 } finally {
 setSubmitting(false);
 }
 };

 // ─── 2. Delete Staff Handler with Custom Confirm Modal ───────────────────
 const triggerDeleteStaffModal = (st: any) => {
 setConfirmModal({
 isOpen: true,
 type: 'delete_staff',
 title: 'Delete Staff Member',
 description: `Are you sure you want to permanently delete staff member '${st.username}'?`,
 targetStaff: st
 });
 };

 const executeDeleteStaff = async () => {
 if (!confirmModal.targetStaff) return;
 const st = confirmModal.targetStaff;

 setConfirmModal(prev => ({ ...prev, processing: true }));
 try {
 const res = await api.delete(`/faculty-assignments/staff/${st.id}`);
 notify.success('Staff Deleted', res.data?.message || `Staff '${st.username}' deleted.`);
 setConfirmModal({ isOpen: false, type: null, title: '', description: '' });
 fetchAllocationData();
 } catch (err: any) {
 notify.error('Delete Failed', err.response?.data?.detail || 'Failed to delete staff member.');
 setConfirmModal(prev => ({ ...prev, processing: false }));
 }
 };

 // ─── 3. Toggle Staff Active Status Handler ───────────────────────────────
 const triggerToggleStatusModal = (st: any) => {
 const actionLabel = st.is_active ? 'deactivate' : 'activate';
 setConfirmModal({
 isOpen: true,
 type: 'toggle_status',
 title: `${st.is_active ? 'Deactivate' : 'Activate'} Staff Account`,
 description: `Are you sure you want to ${actionLabel} '${st.username}'? ${st.is_active ? 'Disabling will return their assigned students to the unassigned allocation queue.' : ''}`,
 targetStaff: st
 });
 };

 const executeToggleStatus = async () => {
 if (!confirmModal.targetStaff) return;
 const st = confirmModal.targetStaff;

 setConfirmModal(prev => ({ ...prev, processing: true }));
 try {
 const res = await api.post(`/admin/staff/${st.id}/toggle-status`);
 notify.success('Status Updated', res.data?.message || `Status updated for '${st.username}'.`);
 setConfirmModal({ isOpen: false, type: null, title: '', description: '' });
 fetchAllocationData();
 } catch (err: any) {
 notify.error('Update Failed', err.response?.data?.detail || 'Failed to toggle status.');
 setConfirmModal(prev => ({ ...prev, processing: false }));
 }
 };

 // ─── 4. Smart Auto-Assign Handler ─────────────────────────────────────────
 const triggerSmartAutoAssignModal = () => {
 if (filteredUnassigned.length === 0) {
 notify.warning('Queue Empty', 'No unassigned students match the selected filter criteria.');
 return;
 }
 setConfirmModal({
 isOpen: true,
 type: 'auto_assign',
 title: 'Smart Auto-Assignment',
 description: 'Automatically distribute unassigned students evenly across active staff members up to max 30 capacity.'
 });
 };

 const executeSmartAutoAssign = async () => {
 setConfirmModal(prev => ({ ...prev, processing: true }));
 try {
 const deptIdToPass = selectedDept !== 'ALL' ? Number(selectedDept) : (filteredUnassigned[0]?.department_id || 1);
 const res = await api.post('/faculty-assignments/auto-distribute', {
 department_id: deptIdToPass
 });

 const allocatedCount = res.data?.allocated_count || res.data?.assignments_created || 0;
 setConfirmModal(prev => ({
 ...prev,
 processing: false,
 result: {
 assigned: allocatedCount,
 remaining: Math.max(0, unassigned.length - allocatedCount),
 staffUpdated: activeStaffCount
 }
 }));
 notify.success('Auto-Assignment Completed', `Allocated ${allocatedCount} students across active staff.`);
 fetchAllocationData();
 } catch (err: any) {
 notify.error('Auto-Assign Failed', err.response?.data?.detail || 'Failed auto assignment.');
 setConfirmModal(prev => ({ ...prev, processing: false }));
 }
 };

 // ─── 5. Auto Rebalance Handler ─────────────────────────────────────────────
 const triggerAutoRebalanceModal = () => {
 setConfirmModal({
 isOpen: true,
 type: 'auto_rebalance',
 title: 'Workload Auto-Rebalance',
 description: 'Run workload rebalancing across all staff allocations to smooth out distribution?'
 });
 };

 const executeAutoRebalance = async () => {
 setConfirmModal(prev => ({ ...prev, processing: true }));
 try {
 const res = await api.post('/admin/auto-rebalance');
 notify.success('Rebalance Complete', res.data?.message || 'Workload rebalancing complete.');
 setConfirmModal({ isOpen: false, type: null, title: '', description: '' });
 fetchAllocationData();
 } catch (err: any) {
 notify.error('Rebalance Failed', err.response?.data?.detail || 'Failed auto rebalancing.');
 setConfirmModal(prev => ({ ...prev, processing: false }));
 }
 };

 // ─── 6. Bulk Manual Student Assignment ───────────────────────────────────
 const handleBulkAssign = () => {
 if (!targetStaffId || selectedStudents.length === 0) {
 notify.warning('Selection Required', 'Please select a target staff member and at least one student.');
 return;
 }

 const targetStaff = staffList.find(s => s.id === Number(targetStaffId));
 if (targetStaff) {
 const currentCount = targetStaff.assigned_count || 0;
 if (currentCount + selectedStudents.length > 30) {
 notify.error('Capacity Exceeded', `Assignment exceeds configured staff capacity cap of 30 students. Target staff currently has ${currentCount}/30.`);
 return;
 }
 }

 setShowAllocationConfirmModal(true);
 };

 const executeConfirmAllocation = async () => {
 await api.post('/admin/bulk-assign', {
 staff_id: Number(targetStaffId),
 student_ids: selectedStudents
 });
 notify.success('Students Assigned', `Successfully assigned ${selectedStudents.length} students.`);
 setSelectedStudents([]);
 setTargetStaffId('');
 fetchAllocationData();
 };

 const toggleSelectStudent = (id: number) => {
 setSelectedStudents(prev =>
 prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
 );
 };

 const toggleSelectAll = () => {
 if (selectedStudents.length === filteredUnassigned.length) {
 setSelectedStudents([]);
 } else {
 setSelectedStudents(filteredUnassigned.map(s => s.id));
 }
 };

 const clearFilters = () => {
 setSelectedDept('ALL');
 setSelectedYear('ALL');
 setSearchQuery('');
 setStaffSearchQuery('');
 setStaffWorkloadFilter('ALL');
 };

 const isFilterActive = selectedDept !== 'ALL' || selectedYear !== 'ALL' || searchQuery.trim() !== '' || staffSearchQuery.trim() !== '' || staffWorkloadFilter !== 'ALL';

 return (
 <div className="space-y-8" style={{ fontFamily:"'Times New Roman', Times, serif" }}>

 {/* ─── 1. STAFF WORKLOAD MATRIX PANEL ─── */}
 <div className="bg-white dark:bg-navy-900 p-6 rounded-3xl border border-slate-200 dark:border-navy-700 shadow-xl space-y-6">
 <div className="flex items-center justify-between flex-wrap gap-4">
 <div>
 <h3 className="text-base font-black text-slate-800 dark:text-slate-100 flex items-center space-x-2">
 <Users className="w-5 h-5 text-sky-600" />
 <span>Staff Workload & Mentoring Completion Tracking</span>
 </h3>
 <p className="text-xs text-slate-500 dark:text-navy-400">
 Enforced Capacity Cap: 30 Students Max per Staff Member
 </p>
 </div>

 <div className="flex items-center space-x-3">
 <button
 onClick={() => setShowCreateModal(true)}
 className="px-4 py-2 rounded-xl bg-sky-700 hover:bg-sky-800 text-white text-xs font-bold flex items-center space-x-2 shadow-md transition-all cursor-pointer transform hover:scale-[1.01]"
 >
 <UserPlus className="w-4 h-4" />
 <span>Create Staff Member</span>
 </button>

 <button
 onClick={triggerAutoRebalanceModal}
 disabled={submitting}
 className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-navy-800 hover:bg-slate-200 dark:hover:bg-navy-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center space-x-2 border border-slate-200 dark:border-navy-700 transition-all cursor-pointer"
 >
 <Sliders className="w-4 h-4 text-sky-600" />
 <span>Auto Rebalance</span>
 </button>
 </div>
 </div>

 {/* Staff Roster Search & Filter Controls */}
 <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-navy-800/60 border border-slate-200 dark:border-navy-700 flex flex-wrap items-center justify-between gap-3">
 <div className="flex items-center space-x-3 flex-wrap gap-2 flex-1">
 <div className="relative min-w-[200px] flex-1">
 <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
 <input
 type="text"
 value={staffSearchQuery}
 onChange={(e) => setStaffSearchQuery(e.target.value)}
 placeholder="Search staff name or email..."
 className="w-full pl-9 pr-4 py-1.5 rounded-xl border border-slate-200 dark:border-navy-600 bg-white dark:bg-navy-900 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-sky-500"
 />
 </div>

 <div className="flex items-center space-x-1.5 bg-white dark:bg-navy-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-navy-600">
 <Filter className="w-3.5 h-3.5 text-sky-600" />
 <select
 value={staffWorkloadFilter}
 onChange={(e) => setStaffWorkloadFilter(e.target.value)}
 className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
 >
 <option value="ALL">All Workload Statuses</option>
 <option value="FULL">Cap Reached (30/30)</option>
 <option value="PARTIAL">Partially Allocated</option>
 <option value="EMPTY">Unallocated (0/30)</option>
 <option value="DISABLED">Disabled Accounts</option>
 </select>
 </div>
 </div>
 </div>

 {/* Staff Workload Grid */}
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
 {loading ? (
 <p className="text-xs text-slate-500 animate-pulse">Loading staff workload...</p>
 ) : filteredStaffList.length === 0 ? (
 <p className="text-xs text-slate-400 italic">No staff accounts match the filter criteria.</p>
 ) : (
 filteredStaffList.map((st: any) => {
 const count = st.assigned_count || 0;
 const maxCap = 30;
 const availableSlots = Math.max(0, maxCap - count);
 const percent = Math.min(100, Math.round((count / maxCap) * 100));
 const isFull = count >= maxCap;

 return (
 <div
 key={st.id}
 className={`p-5 rounded-2xl border transition-all ${
 !st.is_active
 ? 'bg-slate-50 dark:bg-navy-950/40 border-slate-200 opacity-60'
 : isFull
 ? 'bg-rose-50/20 dark:bg-rose-950/10 border-rose-500/30'
 : 'bg-slate-50/50 dark:bg-navy-800/50 border-slate-200 dark:border-navy-700'
 }`}
 >
 <div className="flex items-center justify-between">
 <div>
 <h4 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center space-x-2">
 <span>{st.username}</span>
 {!st.is_active ? (
 <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-500/20 text-rose-500">
 ● DISABLED
 </span>
 ) : isFull ? (
 <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-500/20 text-rose-600">
 ● CAPACITY FULL
 </span>
 ) : (
 <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/20 text-emerald-600">
 ● AVAILABLE
 </span>
 )}
 </h4>
 <div className="flex items-center space-x-2 mt-0.5">
 <p className="text-xs text-slate-400">{st.email}</p>
 {st.department && (
 <span className="px-2 py-0.5 rounded bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 text-[9px] font-bold border border-sky-100 dark:border-sky-500/20">
 {st.department}
 </span>
 )}
 </div>
 </div>

 <div className="flex items-center space-x-1.5">
 {/* View Assigned Students Modal Button */}
 <button
 onClick={() => handleOpenStaffRoster(st)}
 className="p-2 rounded-xl bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 hover:bg-sky-200 dark:hover:bg-sky-800/40 text-xs transition-all cursor-pointer"
 title="View Assigned Students & Mentoring Progress"
 >
 <Eye className="w-4 h-4" />
 </button>

 {/* Enable/Disable Power Button */}
 <button
 onClick={() => triggerToggleStatusModal(st)}
 className={`p-2 rounded-xl text-xs transition-all cursor-pointer ${
 st.is_active
 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 hover:bg-amber-200'
 : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 hover:bg-emerald-200'
 }`}
 title={st.is_active ? 'Disable Staff Account' : 'Enable Staff Account'}
 >
 <Power className="w-4 h-4" />
 </button>

 {/* Delete Staff Button */}
 <button
 onClick={() => triggerDeleteStaffModal(st)}
 className="p-2 rounded-xl bg-rose-100 dark:bg-rose-900/30 text-rose-600 hover:bg-rose-200 dark:hover:bg-rose-800/40 text-xs transition-all cursor-pointer"
 title="Delete Staff Member & Unassign Students"
 >
 <Trash2 className="w-4 h-4" />
 </button>
 </div>
 </div>

 {/* Progress Bar & Available Slots */}
 <div className="mt-4 space-y-1.5">
 <div className="flex justify-between text-xs font-bold text-slate-500">
 <span>Student Allocation</span>
 <span className={isFull ? 'text-rose-500 font-black' : 'text-slate-800 dark:text-white'}>
 {count} / {maxCap}
 </span>
 </div>
 <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-navy-700 overflow-hidden">
 <div
 className={`h-full rounded-full transition-all duration-500 ${
 isFull ? 'bg-rose-500' : count >= 20 ? 'bg-amber-500' : 'bg-emerald-500'
 }`}
 style={{ width: `${percent}%` }}
 />
 </div>
 <div className="flex justify-between items-center text-[11px] text-slate-400 pt-0.5">
 <button
 onClick={() => handleOpenStaffRoster(st)}
 className="text-sky-700 dark:text-sky-400 font-bold hover:underline cursor-pointer"
 >
 Inspect Progress →
 </button>
 <span>{isFull ? 'Cap Reached (30 max)' : `${availableSlots} slots available`}</span>
 </div>
 </div>
 </div>
 );
 })
 )}
 </div>
 </div>

 {/* ─── 2. UNASSIGNED STUDENTS QUEUE PANEL ─── */}
 <div className="bg-white dark:bg-navy-900 p-6 rounded-3xl border border-slate-200 dark:border-navy-700 shadow-xl space-y-6">
 <div className="flex items-center justify-between flex-wrap gap-4">
 <div>
 <h3 className="text-base font-black text-slate-800 dark:text-slate-100 flex items-center space-x-2">
 <AlertTriangle className="w-5 h-5 text-amber-500" />
 <span>Unassigned Student Allocation Queue ({filteredUnassigned.length}{unassigned.length !== filteredUnassigned.length ? ` of ${unassigned.length}` : ''})</span>
 </h3>
 <p className="text-xs text-slate-500 dark:text-navy-400">
 Students awaiting mentor assignment. Select students to assign in bulk or use Smart Auto-Assign.
 </p>
 </div>

 <div className="flex items-center space-x-3 flex-wrap gap-2">
 <button
 onClick={triggerSmartAutoAssignModal}
 disabled={submitting || filteredUnassigned.length === 0}
 className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold flex items-center space-x-2 shadow-md transition-all cursor-pointer transform hover:scale-[1.01]"
 >
 <CheckCircle2 className="w-4 h-4" />
 <span>Smart Auto Assign</span>
 </button>
 </div>
 </div>

 {/* Filters Bar: Department Filter, Year Level Filter & Search Bar */}
 <div className="p-4 rounded-2xl bg-slate-50 dark:bg-navy-800/60 border border-slate-200 dark:border-navy-700 flex flex-wrap items-center justify-between gap-3">
 
 <div className="flex items-center space-x-3 flex-wrap gap-2 flex-1">
 <div className="relative min-w-[200px] flex-1">
 <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
 <input
 type="text"
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 placeholder="Search reg no, name, username..."
 className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-navy-600 bg-white dark:bg-navy-900 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-sky-500"
 />
 </div>

 <div className="flex items-center space-x-1.5 bg-white dark:bg-navy-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-navy-600">
 <Building2 className="w-3.5 h-3.5 text-sky-600" />
 <select
 value={selectedDept}
 onChange={(e) => setSelectedDept(e.target.value)}
 className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
 >
 <option value="ALL">All Departments</option>
 {departments.map((d: any) => (
 <option key={d.id} value={d.id}>{d.code || d.name}</option>
 ))}
 </select>
 </div>

 <div className="flex items-center space-x-1.5 bg-white dark:bg-navy-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-navy-600">
 <Filter className="w-3.5 h-3.5 text-sky-600" />
 <select
 value={selectedYear}
 onChange={(e) => setSelectedYear(e.target.value)}
 className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
 >
 <option value="ALL">All Year Levels</option>
 <option value="I">Year I</option>
 <option value="II">Year II</option>
 <option value="III">Year III</option>
 <option value="IV">Year IV</option>
 </select>
 </div>

 {isFilterActive && (
 <button
 onClick={clearFilters}
 className="p-2 rounded-xl bg-slate-200 dark:bg-navy-700 hover:bg-slate-300 dark:hover:bg-navy-600 text-slate-600 dark:text-slate-300 text-xs flex items-center space-x-1 transition-all cursor-pointer"
 title="Clear all active filters"
 >
 <X className="w-3.5 h-3.5" />
 <span className="text-[11px] font-bold">Clear</span>
 </button>
 )}
 </div>

 <div className="flex items-center space-x-2">
 <select
 value={targetStaffId}
 onChange={(e) => setTargetStaffId(e.target.value ? Number(e.target.value) : '')}
 className="px-3 py-2 rounded-xl border border-slate-200 dark:border-navy-600 bg-white dark:bg-navy-900 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
 >
 <option value="">Select Target Staff...</option>
 {staffList.filter(s => s.is_active && (s.assigned_count || 0) < 30).map((st: any) => (
 <option key={st.id} value={st.id}>
 {st.username} ({st.assigned_count || 0}/30)
 </option>
 ))}
 </select>

 <button
 onClick={handleBulkAssign}
 disabled={submitting || selectedStudents.length === 0 || !targetStaffId}
 className="px-4 py-2 rounded-xl bg-sky-700 hover:bg-sky-800 disabled:opacity-50 text-white text-xs font-bold flex items-center space-x-1 shadow-md transition-all cursor-pointer"
 >
 <span>Assign ({selectedStudents.length})</span>
 <ArrowRight className="w-3.5 h-3.5" />
 </button>
 </div>
 </div>

 {/* Unassigned Students Table */}
 <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-navy-700">
 <table className="w-full text-left text-xs border-collapse">
 <thead>
 <tr className="bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-navy-300 font-bold border-b border-slate-200 dark:border-navy-700">
 <th className="p-3 text-center">
 <input
 type="checkbox"
 checked={selectedStudents.length === filteredUnassigned.length && filteredUnassigned.length > 0}
 onChange={toggleSelectAll}
 className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
 />
 </th>
 <th className="p-3">Register No</th>
 <th className="p-3">Student Name</th>
 <th className="p-3">Department</th>
 <th className="p-3">Year / Class</th>
 <th className="p-3">LeetCode Handle</th>
 <th className="p-3 text-right">Total Solved</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-200 dark:divide-navy-800">
 {loading ? (
 <tr>
 <td colSpan={7} className="p-4 text-center text-slate-500 animate-pulse">
 Loading unassigned students...
 </td>
 </tr>
 ) : filteredUnassigned.length === 0 ? (
 <tr>
 <td colSpan={7} className="p-6 text-center text-slate-400 italic">
 All students are currently assigned to primary mentors! 🎉
 </td>
 </tr>
 ) : (
 filteredUnassigned.map((st: any) => {
 const isSelected = selectedStudents.includes(st.id);
 return (
 <tr
 key={st.id}
 onClick={() => toggleSelectStudent(st.id)}
 className={`cursor-pointer transition-colors ${
 isSelected
 ? 'bg-sky-50/70 dark:bg-sky-950/40'
 : 'hover:bg-slate-50 dark:hover:bg-navy-800/50'
 }`}
 >
 <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
 <input
 type="checkbox"
 checked={isSelected}
 onChange={() => toggleSelectStudent(st.id)}
 className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
 />
 </td>
 <td className="p-3 font-bold text-slate-800 dark:text-slate-200">{st.reg_no}</td>
 <td className="p-3 font-extrabold text-slate-900 dark:text-white">{st.name}</td>
 <td className="p-3 font-bold text-sky-700 dark:text-sky-400">{st.department || 'CSE'}</td>
 <td className="p-3 text-slate-600 dark:text-navy-300">{st.year_level || 'III'}</td>
 <td className="p-3 text-slate-500 dark:text-navy-400">{st.username || '—'}</td>
 <td className="p-3 text-right font-bold text-slate-800 dark:text-slate-200">
 {st.total_solved || 0}
 </td>
 </tr>
 );
 })
 )}
 </tbody>
 </table>
 </div>
 </div>

 {/* ─── 3. VIEW STAFF ASSIGNED ROSTER & COMPLETION MODAL ─── */}
 {viewRosterModal.isOpen && (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
 <div className="bg-white dark:bg-navy-900 w-full max-w-3xl p-6 rounded-3xl border border-slate-200 dark:border-navy-700 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
 
 <div className="flex items-center justify-between border-b border-slate-200 dark:border-navy-800 pb-3">
 <div>
 <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center space-x-2">
 <UserCheck className="w-5 h-5 text-sky-600" />
 <span>{viewRosterModal.staff?.username}'s Mentoring Roster</span>
 </h3>
 <p className="text-xs text-slate-500 dark:text-navy-400">
 {viewRosterModal.staff?.email} • Department: {viewRosterModal.staff?.department || 'CSE'}
 </p>
 </div>
 <button
 onClick={() => setViewRosterModal({ isOpen: false, loading: false, staff: null, data: null })}
 className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
 >
 <X className="w-5 h-5" />
 </button>
 </div>

 {viewRosterModal.loading ? (
 <div className="text-center py-8 space-y-3">
 <RefreshCw className="w-8 h-8 text-sky-600 animate-spin mx-auto" />
 <p className="text-xs text-slate-500">Fetching assigned student progress...</p>
 </div>
 ) : viewRosterModal.data ? (
 <div className="space-y-4">
 {/* Roster Overview Summary Cards */}
 <div className="grid grid-cols-3 gap-3 text-center">
 <div className="p-3 rounded-2xl bg-sky-50 dark:bg-navy-800 border border-sky-100 dark:border-navy-700">
 <p className="text-[10px] font-bold text-sky-700 dark:text-sky-300 uppercase">Assigned Capacity</p>
 <p className="text-xl font-black text-sky-900 dark:text-white mt-0.5">
 {viewRosterModal.data.total_assigned} / {viewRosterModal.data.max_allowed || 30}
 </p>
 </div>
 <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40">
 <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase">Active Solvers (&gt;30 Solved)</p>
 <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
 {viewRosterModal.data.students?.filter((s: any) => (s.total_solved || 0) >= 30).length || 0}
 </p>
 </div>
 <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40">
 <p className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase">Average Problems Solved</p>
 <p className="text-xl font-black text-amber-600 dark:text-amber-400 mt-0.5">
 {viewRosterModal.data.students?.length ? 
 Math.round(viewRosterModal.data.students.reduce((acc: number, cur: any) => acc + (cur.total_solved || 0), 0) / viewRosterModal.data.students.length)
 : 0}
 </p>
 </div>
 </div>

 {/* Assigned Students Roster Table */}
 <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-navy-700">
 <table className="w-full text-left text-xs border-collapse">
 <thead>
 <tr className="bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-navy-300 font-bold border-b border-slate-200 dark:border-navy-700">
 <th className="p-3">Register No</th>
 <th className="p-3">Student Name</th>
 <th className="p-3">Year</th>
 <th className="p-3">LeetCode Username</th>
 <th className="p-3 text-right">Problems Solved</th>
 <th className="p-3 text-center">Action</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-200 dark:divide-navy-800">
 {viewRosterModal.data.students?.length === 0 ? (
 <tr>
 <td colSpan={6} className="p-4 text-center text-slate-400 italic">
 No students currently assigned to this staff member.
 </td>
 </tr>
 ) : (
 viewRosterModal.data.students?.map((s: any) => (
 <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-navy-800/50">
 <td className="p-3 font-bold text-slate-800 dark:text-slate-200">{s.reg_no}</td>
 <td className="p-3 font-extrabold text-slate-900 dark:text-white">{s.name}</td>
 <td className="p-3 text-slate-600 dark:text-navy-300">{s.year_level}</td>
 <td className="p-3 text-sky-700 dark:text-sky-400">{s.username || '—'}</td>
 <td className="p-3 text-right font-bold text-slate-800 dark:text-slate-200">
 <span className={`px-2.5 py-1 rounded-lg font-black ${
 s.total_solved >= 100 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
 s.total_solved >= 30 ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300' :
 'bg-slate-100 text-slate-700 dark:bg-navy-800 dark:text-slate-300'
 }`}>
 {s.total_solved || 0}
 </span>
 </td>
 <td className="p-3 text-center">
 <button
 onClick={() => handleUnassignStudentFromStaff(s.id)}
 className="p-1.5 rounded-lg bg-rose-100 dark:bg-rose-900/30 text-rose-600 hover:bg-rose-200 transition-colors"
 title="Unassign Student"
 >
 <UserMinus className="w-3.5 h-3.5" />
 </button>
 </td>
 </tr>
 ))
 )}
 </tbody>
 </table>
 </div>

 <div className="flex justify-end pt-2">
 <button
 onClick={() => setViewRosterModal({ isOpen: false, loading: false, staff: null, data: null })}
 className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-navy-800 text-slate-800 dark:text-slate-200 font-bold text-xs cursor-pointer"
 >
 Close
 </button>
 </div>
 </div>
 ) : null}

 </div>
 </div>
 )}

 {/* ─── 4. REUSABLE PREMIUM CONFIRMATION MODAL ─── */}
 {confirmModal.isOpen && (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
 <div className="bg-white dark:bg-navy-900 w-full max-w-md p-6 rounded-3xl border border-slate-200 dark:border-navy-700 shadow-2xl space-y-5">
 <div className="flex items-center justify-between border-b border-slate-200 dark:border-navy-800 pb-3">
 <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center space-x-2">
 {confirmModal.type === 'delete_staff' ? (
 <Trash2 className="w-5 h-5 text-rose-500" />
 ) : confirmModal.type === 'auto_assign' ? (
 <CheckCircle2 className="w-5 h-5 text-emerald-500" />
 ) : (
 <AlertOctagon className="w-5 h-5 text-amber-500" />
 )}
 <span>{confirmModal.title}</span>
 </h3>
 {!confirmModal.processing && (
 <button
 onClick={() => setConfirmModal({ isOpen: false, type: null, title: '', description: '' })}
 className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
 >
 <X className="w-5 h-5" />
 </button>
 )}
 </div>

 {confirmModal.result ? (
 <div className="space-y-4 py-2 text-center">
 <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
 <Check className="w-6 h-6" />
 </div>
 <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">Auto-Assignment Completed</h4>
 
 <div className="grid grid-cols-3 gap-2 text-xs text-center p-3 rounded-2xl bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700">
 <div>
 <p className="text-[10px] text-slate-400 uppercase font-bold">Assigned</p>
 <p className="text-base font-black text-emerald-600">{confirmModal.result.assigned}</p>
 </div>
 <div>
 <p className="text-[10px] text-slate-400 uppercase font-bold">Unassigned</p>
 <p className="text-base font-black text-amber-600">{confirmModal.result.remaining}</p>
 </div>
 <div>
 <p className="text-[10px] text-slate-400 uppercase font-bold">Staff Active</p>
 <p className="text-base font-black text-sky-600">{confirmModal.result.staffUpdated}</p>
 </div>
 </div>

 <button
 onClick={() => setConfirmModal({ isOpen: false, type: null, title: '', description: '' })}
 className="w-full py-2.5 rounded-xl bg-sky-700 hover:bg-sky-800 text-white font-bold text-xs shadow-md cursor-pointer"
 >
 Close & View Assignments
 </button>
 </div>
 ) : confirmModal.processing ? (
 <div className="text-center py-6 space-y-3">
 <RefreshCw className="w-8 h-8 text-sky-600 animate-spin mx-auto" />
 <p className="text-xs font-bold text-slate-800 dark:text-white">Processing operation...</p>
 <p className="text-[11px] text-slate-500">Please wait while database allocations update.</p>
 </div>
 ) : (
 <>
 <p className="text-xs text-slate-600 dark:text-navy-300 leading-relaxed">
 {confirmModal.description}
 </p>

 {confirmModal.type === 'auto_assign' && (
 <div className="grid grid-cols-3 gap-2 text-xs text-center p-3 rounded-2xl bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700">
 <div>
 <p className="text-[10px] text-slate-400 uppercase font-bold">Unassigned</p>
 <p className="text-sm font-black text-amber-600">{unassigned.length}</p>
 </div>
 <div>
 <p className="text-[10px] text-slate-400 uppercase font-bold">Active Staff</p>
 <p className="text-sm font-black text-sky-600">{activeStaffCount}</p>
 </div>
 <div>
 <p className="text-[10px] text-slate-400 uppercase font-bold">Max / Staff</p>
 <p className="text-sm font-black text-slate-700 dark:text-white">30</p>
 </div>
 </div>
 )}

 {confirmModal.type === 'delete_staff' && confirmModal.targetStaff && (
 <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-700 dark:text-rose-300 space-y-1">
 <p><strong>Faculty:</strong> {confirmModal.targetStaff.username} ({confirmModal.targetStaff.email})</p>
 <p><strong>Assigned Students:</strong> {confirmModal.targetStaff.assigned_count || 0} students will return to queue.</p>
 </div>
 )}

 <div className="flex items-center justify-end space-x-3 pt-2">
 <button
 type="button"
 onClick={() => setConfirmModal({ isOpen: false, type: null, title: '', description: '' })}
 className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
 >
 Cancel
 </button>
 <button
 type="button"
 onClick={() => {
 if (confirmModal.type === 'delete_staff') executeDeleteStaff();
 else if (confirmModal.type === 'toggle_status') executeToggleStatus();
 else if (confirmModal.type === 'auto_assign') executeSmartAutoAssign();
 else if (confirmModal.type === 'auto_rebalance') executeAutoRebalance();
 }}
 className={`px-4 py-2 rounded-xl text-white text-xs font-bold shadow-md transition-all cursor-pointer transform hover:scale-[1.01] ${
 confirmModal.type === 'delete_staff' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-sky-700 hover:bg-sky-800'
 }`}
 >
 {confirmModal.type === 'delete_staff' ? 'Delete Staff Member' : 'Confirm & Proceed →'}
 </button>
 </div>
 </>
 )}

 </div>
 </div>
 )}

 {/* ─── 5. CREATE STAFF MODAL ─── */}
 {showCreateModal && (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
 <div className="bg-white dark:bg-navy-900 w-full max-w-md p-6 rounded-3xl border border-slate-200 dark:border-navy-700 shadow-2xl space-y-4">
 <div className="flex items-center justify-between border-b border-slate-200 dark:border-navy-800 pb-3">
 <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center space-x-2">
 <UserPlus className="w-5 h-5 text-sky-600" />
 <span>Create Staff Account</span>
 </h3>
 <button
 onClick={() => setShowCreateModal(false)}
 className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
 >
 <X className="w-5 h-5" />
 </button>
 </div>

 <form onSubmit={handleCreateStaff} className="space-y-4 text-xs font-medium">
 <div>
 <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Username / Name</label>
 <input
 type="text"
 value={newUsername}
 onChange={(e) => setNewUsername(e.target.value)}
 placeholder="e.g. Dr. K. Anand"
 className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-white outline-none focus:border-sky-500"
 required
 />
 </div>

 <div>
 <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Official Email</label>
 <input
 type="email"
 value={newEmail}
 onChange={(e) => setNewEmail(e.target.value)}
 placeholder="anand@nandha.edu.in"
 className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-white outline-none focus:border-sky-500"
 required
 />
 </div>

 <div>
 <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Initial Password</label>
 <input
 type="text"
 value={newPassword}
 onChange={(e) => setNewPassword(e.target.value)}
 className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-white outline-none focus:border-sky-500"
 required
 />
 </div>

 <div>
 <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Department</label>
 <select
 value={newDeptId}
 onChange={(e) => setNewDeptId(Number(e.target.value))}
 className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-white outline-none cursor-pointer"
 >
 {departments.map((d: any) => (
 <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
 ))}
 </select>
 </div>

 <div className="flex items-center justify-end space-x-3 pt-2">
 <button
 type="button"
 onClick={() => setShowCreateModal(false)}
 className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300 font-bold cursor-pointer"
 >
 Cancel
 </button>
 <button
 type="submit"
 disabled={submitting}
 className="px-4 py-2 rounded-xl bg-sky-700 hover:bg-sky-800 text-white font-bold disabled:opacity-50 cursor-pointer"
 >
 {submitting ? 'Creating...' : 'Create Account'}
 </button>
 </div>
 </form>
 </div>
 </div>
 )}

 {/* Premium Institutional Allocation Confirmation Modal */}
 <AllocationConfirmationModal
 isOpen={showAllocationConfirmModal}
 onClose={() => setShowAllocationConfirmModal(false)}
 onConfirm={executeConfirmAllocation}
 targetStaff={staffList.find(s => s.id === Number(targetStaffId)) || null}
 selectedCount={selectedStudents.length}
 />

 </div>
 );
};
