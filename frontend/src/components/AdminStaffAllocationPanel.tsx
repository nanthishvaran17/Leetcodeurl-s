import React, { useState, useEffect, useMemo } from 'react';
import {
 Users, UserPlus, RefreshCw, CheckCircle2, AlertTriangle, User,
 Search, Sliders, ArrowRight, Power, Filter, X, Building2,
 Trash2, UserCheck, ShieldAlert, Sparkles, Check, AlertOctagon,
 Eye, BookOpen, Trophy, Award, UserMinus
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { studentLiveStore, useStudentListIds, useStudentStoreVersion } from '../stores/studentLiveStore';
import { GlobalModalBackdrop } from './GlobalModalBackdrop';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNotification } from '../context/NotificationContext';
import { AllocationConfirmationModal } from './admin/AllocationConfirmationModal';
import { CustomDropdown, DropdownOption } from './CustomDropdown';

export const AdminStaffAllocationPanel: React.FC = () => {
 const { user } = useAuth();
 const { notify } = useNotification();

 const queryClient = useQueryClient();
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

 // Tab state: 'assign' | 'unassign'
 const [activeTab, setActiveTab] = useState<'assign' | 'unassign'>('assign');
 // For unassign tab: selected staff to view roster
 const [unassignStaffId, setUnassignStaffId] = useState<number | ''>('');
 const [assignedRoster, setAssignedRoster] = useState<any[]>([]);
 const [rosterLoading, setRosterLoading] = useState<boolean>(false);
 const [selectedAssignedStudents, setSelectedAssignedStudents] = useState<number[]>([]);
 const [unassignSearchQuery, setUnassignSearchQuery] = useState<string>('');
 const [studentToUnassign, setStudentToUnassign] = useState<{ student: any; staffId: number; source: 'tab' | 'modal' } | null>(null);

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


 const { data: staffList = [], isLoading: isLoadingStaff } = useQuery({
   queryKey: ['staffList'],
   queryFn: async () => {
     const res = await api.get('/admin/staff-list');
     return res.data || [];
   }
 });

 const { data: unassigned = [], isLoading: isLoadingUnassigned } = useQuery({
   queryKey: ['unassignedStudents', selectedDept, selectedYear],
   queryFn: async () => {
     const params: any = {};
     if (selectedDept !== 'ALL') params.dept_id = Number(selectedDept);
     if (selectedYear !== 'ALL') params.year_level = selectedYear;
     const res = await api.get('/admin/unassigned-students', { params });
     return res.data?.students || [];
   }
 });

 const { data: deptsData = [] } = useQuery({
   queryKey: ['departments'],
   queryFn: async () => {
     const res = await api.get('/departments');
     return res.data || [];
   },
   staleTime: 30 * 60 * 1000
 });

 useEffect(() => {
   if (deptsData.length > 0) {
     setDepartments(deptsData);
     if (!newDeptId) {
       if (user?.department_id) setNewDeptId(user.department_id);
       else setNewDeptId(deptsData[0].id);
     }
   }
 }, [deptsData, user]);

 useEffect(() => {
   setLoading(isLoadingStaff || isLoadingUnassigned);
 }, [isLoadingStaff, isLoadingUnassigned]);


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

 // Client-side filtering for Staff List (NOT affected by student dept filter)
 const filteredStaffList = useMemo(() => {
 return staffList.filter((st: any) => {
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
 }, [staffList, staffSearchQuery, staffWorkloadFilter]);

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

 const handleUnassignStudentFromStaff = (student: any) => {
 if (!viewRosterModal.staff) return;
 setStudentToUnassign({
  student: student,
  staffId: viewRosterModal.staff.id,
  source: 'modal'
 });
 };

 const confirmUnassignStudent = async () => {
 if (!studentToUnassign) return;
 try {
  await api.post('/faculty-assignments/unassign', {
  faculty_id: studentToUnassign.staffId,
  student_ids: [studentToUnassign.student.id]
  });
  notify.success('Student Unassigned', `${studentToUnassign.student.name} removed from staff portfolio.`);
  
  if (studentToUnassign.source === 'modal' && viewRosterModal.staff) {
  handleOpenStaffRoster(viewRosterModal.staff);
  } else if (studentToUnassign.source === 'tab' && unassignStaffId) {
  handleLoadUnassignRoster(Number(unassignStaffId));
  }
  
  setStudentToUnassign(null);
  queryClient.invalidateQueries({ queryKey: ['staffList'] });
    queryClient.invalidateQueries({ queryKey: ['unassignedStudents'] });
 } catch (err: any) {
  console.error("Unassign error details:", err.response);
  const errMsg = err.response?.data?.detail 
    ? (typeof err.response.data.detail === 'string' ? err.response.data.detail : JSON.stringify(err.response.data.detail))
    : (err.message || 'Could not unassign student.');
  notify.error('Unassign Failed', errMsg);
 }
 };

 // ─── Unassign Tab: Load roster for selected staff ──────────────────────────
 const handleLoadUnassignRoster = async (staffId: number) => {
 setUnassignStaffId(staffId);
 setSelectedAssignedStudents([]);
 setRosterLoading(true);
 try {
  const res = await api.get(`/faculty-assignments/faculty/${staffId}`);
  setAssignedRoster(res.data?.students || []);
 } catch (err: any) {
  notify.error('Failed to Load', err.response?.data?.detail || 'Could not load assigned students.');
  setAssignedRoster([]);
 } finally {
  setRosterLoading(false);
 }
 };

 const handleBulkUnassign = async () => {
 if (!unassignStaffId || selectedAssignedStudents.length === 0) {
  notify.warning('Selection Required', 'Select at least one student to unassign.');
  return;
 }
 try {
  await api.post('/faculty-assignments/unassign', {
  faculty_id: Number(unassignStaffId),
  student_ids: selectedAssignedStudents
  });
  notify.success('Students Unassigned', `${selectedAssignedStudents.length} students moved back to unassigned queue.`);
  setSelectedAssignedStudents([]);
  handleLoadUnassignRoster(Number(unassignStaffId));
  queryClient.invalidateQueries({ queryKey: ['staffList'] });
    queryClient.invalidateQueries({ queryKey: ['unassignedStudents'] });
 } catch (err: any) {
  console.error("Bulk Unassign error details:", err.response);
  const errMsg = err.response?.data?.detail 
    ? (typeof err.response.data.detail === 'string' ? err.response.data.detail : JSON.stringify(err.response.data.detail))
    : (err.message || 'Failed to unassign students.');
  notify.error('Unassign Failed', errMsg);
 }
 };

 const toggleAssignedStudent = (id: number) => {
 setSelectedAssignedStudents(prev =>
  prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
 );
 };

 const filteredRoster = useMemo(() => {
 if (!unassignSearchQuery.trim()) return assignedRoster;
 const q = unassignSearchQuery.toLowerCase();
 return assignedRoster.filter(s =>
  (s.name || '').toLowerCase().includes(q) ||
  (s.reg_no || '').toLowerCase().includes(q) ||
  (s.username || '').toLowerCase().includes(q)
 );
 }, [assignedRoster, unassignSearchQuery]);

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
 queryClient.invalidateQueries({ queryKey: ['staffList'] });
    queryClient.invalidateQueries({ queryKey: ['unassignedStudents'] });
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
      // setStaffList(prev => prev.filter(staff => staff.id !== st.id));
      notify.success('Staff Deleted', res.data?.message || `Staff '${st.username}' deleted.`);
      setConfirmModal({ isOpen: false, type: null, title: '', description: '' });
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
 queryClient.invalidateQueries({ queryKey: ['staffList'] });
    queryClient.invalidateQueries({ queryKey: ['unassignedStudents'] });
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
 queryClient.invalidateQueries({ queryKey: ['staffList'] });
    queryClient.invalidateQueries({ queryKey: ['unassignedStudents'] });
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
 queryClient.invalidateQueries({ queryKey: ['staffList'] });
    queryClient.invalidateQueries({ queryKey: ['unassignedStudents'] });
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
 queryClient.invalidateQueries({ queryKey: ['staffList'] });
    queryClient.invalidateQueries({ queryKey: ['unassignedStudents'] });
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

 const deptOptions: DropdownOption[] = [
   { value: 'ALL', label: 'All Departments' },
   ...departments.map((d: any) => ({
     value: String(d.id),
     label: d.name,
     badge: d.code,
     badgeColor: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
   }))
 ];

 const yearOptions: DropdownOption[] = [
   { value: 'ALL', label: 'All Year Levels' },
   { value: 'I', label: 'Year I' },
   { value: 'II', label: 'Year II' },
   { value: 'III', label: 'Year III' },
   { value: 'IV', label: 'Year IV' }
 ];

 const staffOptions: DropdownOption[] = [
   { value: '', label: 'Select Target Staff...' },
   ...staffList.filter(s => s.is_active && (s.assigned_count || 0) < 30).map((st: any) => ({
     value: String(st.id),
     label: st.username,
     sublabel: `${st.assigned_count || 0} / 30 slots filled`,
     badge: (st.assigned_count || 0) >= 30 ? 'FULL' : 'AVAILABLE',
     badgeColor: (st.assigned_count || 0) >= 30 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
   }))
 ];

 return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">


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
     className={`relative rounded-3xl border overflow-hidden transition-all shadow-md hover:shadow-xl ${
       !st.is_active
         ? 'bg-slate-100/80 dark:bg-navy-950/60 border-slate-200 opacity-70'
         : isFull
         ? 'bg-gradient-to-br from-rose-50 to-white dark:from-rose-950/20 dark:to-navy-900 border-rose-300 dark:border-rose-800/50'
         : 'bg-gradient-to-br from-white to-slate-50 dark:from-navy-800 dark:to-navy-900 border-slate-200 dark:border-navy-700 hover:border-sky-400/50'
     }`}
   >
     {/* Top accent bar */}
     <div className={`h-1.5 w-full ${
       !st.is_active ? 'bg-slate-400' : isFull
         ? 'bg-gradient-to-r from-rose-500 to-orange-500'
         : 'bg-gradient-to-r from-sky-500 to-indigo-500'
     }`} />

     <div className="p-5">
       {/* Avatar + Name */}
       <div className="flex items-start justify-between">
         <div className="flex items-center space-x-3">
           <div className={`relative w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-black text-white shadow-lg shrink-0 ${
             !st.is_active ? 'bg-slate-400'
             : isFull ? 'bg-gradient-to-br from-rose-500 to-orange-500'
             : 'bg-gradient-to-br from-sky-500 to-indigo-600'
           }`}>
             {st.username?.charAt(0)?.toUpperCase() || '?'}
             {st.is_active && (
               <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-navy-800 bg-emerald-500" />
             )}
           </div>
           <div className="min-w-0">
             <h4 className="font-black text-sm text-slate-900 dark:text-white leading-tight truncate">{st.username}</h4>
             <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate mt-0.5">{st.email}</p>
           </div>
         </div>

         <div className="flex flex-col items-end space-y-1.5">
           <span className={`px-2.5 py-1 rounded-full text-[10px] font-black tracking-wide ${
             !st.is_active ? 'bg-slate-200 text-slate-500'
             : isFull ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400'
             : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
           }`}>
             {!st.is_active ? '⊘ DISABLED' : isFull ? 'FULL' : '● AVAILABLE'}
           </span>
           <div className="flex items-center space-x-1">
             <button onClick={() => handleOpenStaffRoster(st)}
               className="p-1.5 rounded-xl bg-sky-100 dark:bg-sky-900/30 text-sky-600 hover:bg-sky-200 transition-all cursor-pointer" title="View Roster">
               <Eye className="w-3.5 h-3.5" />
             </button>
             <button onClick={() => triggerToggleStatusModal(st)}
               className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                 st.is_active ? 'bg-amber-100 text-amber-600 hover:bg-amber-200' : 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'
               }`} title={st.is_active ? 'Disable' : 'Enable'}>
               <Power className="w-3.5 h-3.5" />
             </button>
             <button onClick={() => triggerDeleteStaffModal(st)}
               className="p-1.5 rounded-xl bg-rose-100 dark:bg-rose-900/30 text-rose-600 hover:bg-rose-200 transition-all cursor-pointer" title="Delete">
               <Trash2 className="w-3.5 h-3.5" />
             </button>
           </div>
         </div>
       </div>

       {/* Dept Tag */}
       {st.department && (
         <div className="mt-3">
           <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold border border-indigo-100 dark:border-indigo-800/40">
             {st.department}
           </span>
         </div>
       )}

       {/* Progress Bar */}
       <div className="mt-4 space-y-1.5">
         <div className="flex justify-between text-xs font-bold">
           <span className="text-slate-500 dark:text-slate-400">Student Allocation</span>
           <span className={isFull ? 'text-rose-500' : count >= 20 ? 'text-amber-500' : 'text-emerald-600'}>
             {count} / {maxCap}
           </span>
         </div>
         <div className="w-full h-2.5 rounded-full bg-slate-200 dark:bg-navy-700 overflow-hidden">
           <div
             className={`h-full rounded-full transition-all duration-700 ${
               isFull ? 'bg-gradient-to-r from-rose-500 to-orange-500'
               : count >= 20 ? 'bg-gradient-to-r from-amber-400 to-orange-400'
               : 'bg-gradient-to-r from-sky-500 to-indigo-500'
             }`}
             style={{ width: `${percent}%` }}
           />
         </div>
         <div className="flex justify-between items-center text-[11px]">
           <button onClick={() => handleOpenStaffRoster(st)}
             className="text-sky-600 dark:text-sky-400 font-bold hover:underline cursor-pointer">
             Inspect Progress →
           </button>
           <span className={`font-semibold ${
             isFull ? 'text-rose-500' : availableSlots <= 5 ? 'text-amber-500' : 'text-slate-400'
           }`}>
             {isFull ? 'Cap Reached' : `${availableSlots} slots free`}
           </span>
         </div>
       </div>
     </div>
   </div>
  );
  })
  )}
  </div>
  </div>


 {/* ─── 2. ASSIGN / UNASSIGN TAB PANEL ─── */}
 <div className="bg-white dark:bg-navy-900 rounded-3xl border border-slate-200 dark:border-navy-700 shadow-xl overflow-hidden">

  {/* Tab Header */}
  <div className="flex items-stretch border-b border-slate-200 dark:border-navy-700">
   <button
    onClick={() => setActiveTab('assign')}
    className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 text-sm font-black transition-all ${
     activeTab === 'assign'
      ? 'bg-sky-600 text-white'
      : 'bg-slate-50 dark:bg-navy-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-700'
    }`}
   >
    <CheckCircle2 className="w-4 h-4" />
    <span>Assign Students</span>
    {unassigned.length > 0 && (
     <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-black ${
      activeTab === 'assign' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'
     }`}>
      {unassigned.length} pending
     </span>
    )}
   </button>
   <button
    onClick={() => setActiveTab('unassign')}
    className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 text-sm font-black transition-all ${
     activeTab === 'unassign'
      ? 'bg-rose-600 text-white'
      : 'bg-slate-50 dark:bg-navy-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-700'
    }`}
   >
    <UserMinus className="w-4 h-4" />
    <span>Unassign Students</span>
   </button>
  </div>

  {/* ── ASSIGN TAB ── */}
  {activeTab === 'assign' && (
   <div className="p-6 space-y-6">
    {/* Header row */}
    <div className="flex items-center justify-between flex-wrap gap-3">
     <div>
      <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
       Unassigned Queue
       <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
        {filteredUnassigned.length}{unassigned.length !== filteredUnassigned.length ? ` of ${unassigned.length}` : ''}
       </span>
      </h3>
      <p className="text-xs text-slate-500 dark:text-navy-400 mt-0.5">Select students below and assign to a staff mentor</p>
     </div>
     <button
      onClick={triggerSmartAutoAssignModal}
      disabled={submitting || filteredUnassigned.length === 0}
      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-2 shadow-md transition-all cursor-pointer"
     >
      <Sparkles className="w-4 h-4" />
      <span>Smart Auto Assign</span>
     </button>
    </div>

    {/* Filters */}
    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-navy-800/60 border border-slate-200 dark:border-navy-700 flex flex-col md:flex-row items-center gap-3">
     <div className="relative flex-1 min-w-[200px]">
      <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
      <input
       type="text"
       value={searchQuery}
       onChange={(e) => setSearchQuery(e.target.value)}
       placeholder="Search reg no, name, username..."
       className="w-full pl-10 pr-4 h-10 rounded-xl border border-slate-200 dark:border-navy-600 bg-white dark:bg-navy-900 text-sm text-slate-800 dark:text-slate-200 outline-none focus:border-sky-500 transition-all"
      />
     </div>
     <div className="w-full md:w-[200px]">
      <CustomDropdown label="Department Filter" options={deptOptions} value={String(selectedDept)} onChange={setSelectedDept} icon={Building2} />
     </div>
     <div className="w-full md:w-[180px]">
      <CustomDropdown label="Academic Year" options={yearOptions} value={selectedYear} onChange={setSelectedYear} icon={Filter} />
     </div>
     {isFilterActive && (
      <button onClick={clearFilters} className="p-2.5 rounded-xl bg-slate-200 dark:bg-navy-700 hover:bg-slate-300 text-slate-600 dark:text-slate-300 transition-all cursor-pointer" title="Clear filters">
       <X className="w-4 h-4" />
      </button>
     )}
     {/* Assign controls */}
     <div className="w-full md:w-[220px]">
      <CustomDropdown label="Assign To Staff" options={staffOptions} value={targetStaffId ? String(targetStaffId) : ''} onChange={(val) => setTargetStaffId(val ? Number(val) : '')} icon={UserPlus} align="right" />
     </div>
     <button
      onClick={handleBulkAssign}
      disabled={submitting || selectedStudents.length === 0 || !targetStaffId}
      className="w-full md:w-auto px-5 h-10 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-black flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer whitespace-nowrap"
     >
      <span>Assign ({selectedStudents.length})</span>
      <ArrowRight className="w-4 h-4" />
     </button>
    </div>

    {/* Table */}
    <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-navy-700">
     <table className="w-full text-left text-xs border-collapse">
      <thead>
       <tr className="bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-navy-300 font-bold border-b border-slate-200 dark:border-navy-700">
        <th className="p-3 text-center">
         <input type="checkbox" checked={selectedStudents.length === filteredUnassigned.length && filteredUnassigned.length > 0} onChange={toggleSelectAll} className="rounded border-slate-300 text-sky-600 cursor-pointer" />
        </th>
        <th className="p-3">Register No</th>
        <th className="p-3">Student Name</th>
        <th className="p-3">Department</th>
        <th className="p-3">Year / Class</th>
        <th className="p-3">LeetCode Handle</th>
        <th className="p-3 text-right">Total Solved</th>
       </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
       {loading ? (
        <tr><td colSpan={7} className="p-6 text-center text-slate-500 animate-pulse">Loading unassigned students...</td></tr>
       ) : filteredUnassigned.length === 0 ? (
        <tr><td colSpan={7} className="p-8 text-center">
         <div className="flex flex-col items-center gap-2">
          <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">All students are currently assigned to primary mentors! </p>
         </div>
        </td></tr>
       ) : (
        filteredUnassigned.map((st: any) => {
         const isSelected = selectedStudents.includes(st.id);
         return (
          <tr key={st.id} onClick={() => toggleSelectStudent(st.id)}
           className={`cursor-pointer transition-colors ${isSelected ? 'bg-sky-50 dark:bg-sky-950/40' : 'hover:bg-slate-50 dark:hover:bg-navy-800/50'}`}
          >
           <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
            <input type="checkbox" checked={isSelected} onChange={() => toggleSelectStudent(st.id)} className="rounded border-slate-300 text-sky-600 cursor-pointer" />
           </td>
           <td className="p-3 font-bold text-slate-800 dark:text-slate-200">{st.reg_no}</td>
           <td className="p-3 font-extrabold text-slate-900 dark:text-white">{st.name}</td>
           <td className="p-3 font-bold text-sky-700 dark:text-sky-400">{st.department || 'CSE'}</td>
           <td className="p-3 text-slate-600 dark:text-navy-300">{st.year_level || '—'}</td>
           <td className="p-3 text-slate-500 dark:text-navy-400">{st.username || '—'}</td>
           <td className="p-3 text-right font-bold text-slate-800 dark:text-slate-200">{st.total_solved || 0}</td>
          </tr>
         );
        })
       )}
      </tbody>
     </table>
    </div>
   </div>
  )}

  {/* ── UNASSIGN TAB ── */}
  {activeTab === 'unassign' && (
   <div className="p-6 space-y-6">
    {/* Staff picker */}
    <div className="flex items-center gap-4 flex-wrap">
     <div className="flex-1 min-w-[260px]">
      <CustomDropdown
       label="Select Staff Member to Manage"
       options={[
        { value: '', label: '— Pick a Staff Member —' },
        ...staffList.filter(s => s.is_active).map((st: any) => ({
         value: String(st.id),
         label: `${st.username} (${st.assigned_count || 0}/30 students) — ${st.department}`
        }))
       ]}
       value={String(unassignStaffId || '')}
       onChange={(val) => {
        const id = Number(val);
        if (id) handleLoadUnassignRoster(id);
        else { setUnassignStaffId(''); setAssignedRoster([]); }
       }}
       icon={User}
      />
     </div>

     {unassignStaffId && (
      <>
       <div className="relative flex-1 min-w-[200px]">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
         type="text"
         value={unassignSearchQuery}
         onChange={(e) => setUnassignSearchQuery(e.target.value)}
         placeholder="Search assigned student..."
         className="w-full pl-10 pr-4 h-11 rounded-xl border border-slate-200 dark:border-navy-600 bg-white dark:bg-navy-900 text-sm text-slate-800 dark:text-slate-200 outline-none focus:border-rose-500 transition-all"
        />
       </div>
       <button
        onClick={handleBulkUnassign}
        disabled={selectedAssignedStudents.length === 0}
        className="h-11 px-6 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-black flex items-center gap-2 shadow-md transition-all cursor-pointer whitespace-nowrap"
       >
        <UserMinus className="w-4 h-4" />
        <span>Unassign ({selectedAssignedStudents.length})</span>
       </button>
      </>
     )}
    </div>

    {/* Roster Table */}
    {!unassignStaffId ? (
     <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
      <Users className="w-10 h-10 opacity-30" />
      <p className="text-sm font-bold">Select a staff member above to view their assigned students</p>
     </div>
    ) : rosterLoading ? (
     <div className="flex items-center justify-center py-12 gap-3">
      <RefreshCw className="w-6 h-6 text-rose-500 animate-spin" />
      <p className="text-sm font-bold text-slate-500">Loading assigned students...</p>
     </div>
    ) : (
     <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-navy-700">
      <table className="w-full text-left text-xs border-collapse">
       <thead>
        <tr className="bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 font-bold border-b border-rose-100 dark:border-rose-900/50">
         <th className="p-3 text-center">
          <input type="checkbox"
           checked={selectedAssignedStudents.length === filteredRoster.length && filteredRoster.length > 0}
           onChange={() => {
            if (selectedAssignedStudents.length === filteredRoster.length) setSelectedAssignedStudents([]);
            else setSelectedAssignedStudents(filteredRoster.map((s: any) => s.id));
           }}
           className="rounded border-rose-300 text-rose-600 cursor-pointer"
          />
         </th>
         <th className="p-3">Register No</th>
         <th className="p-3">Student Name</th>
         <th className="p-3">Year</th>
         <th className="p-3">LeetCode Handle</th>
         <th className="p-3 text-right">Problems Solved</th>
         <th className="p-3 text-center">Quick Unassign</th>
        </tr>
       </thead>
       <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
        {filteredRoster.length === 0 ? (
         <tr><td colSpan={7} className="p-8 text-center text-slate-400 italic">No students found for this staff member.</td></tr>
        ) : (
         filteredRoster.map((s: any) => {
          const isSel = selectedAssignedStudents.includes(s.id);
          return (
           <tr key={s.id} onClick={() => toggleAssignedStudent(s.id)}
            className={`cursor-pointer transition-colors ${isSel ? 'bg-rose-50 dark:bg-rose-950/30' : 'hover:bg-slate-50 dark:hover:bg-navy-800/50'}`}
           >
            <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
             <input type="checkbox" checked={isSel} onChange={() => toggleAssignedStudent(s.id)} className="rounded border-rose-300 text-rose-600 cursor-pointer" />
            </td>
            <td className="p-3 font-bold text-slate-800 dark:text-slate-200">{s.reg_no}</td>
            <td className="p-3 font-extrabold text-slate-900 dark:text-white">{s.name}</td>
            <td className="p-3 text-slate-600 dark:text-navy-300">{s.year_level || '—'}</td>
            <td className="p-3 text-sky-700 dark:text-sky-400">{s.username || '—'}</td>
            <td className="p-3 text-right">
             <span className={`px-2 py-1 rounded-lg font-black text-[11px] ${
              s.total_solved >= 100 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
              s.total_solved >= 30 ? 'bg-sky-100 text-sky-800' :
              'bg-slate-100 text-slate-600 dark:bg-navy-800 dark:text-slate-300'
             }`}>{s.total_solved || 0}</span>
            </td>
            <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
             <button
              onClick={() => setStudentToUnassign({ student: s, staffId: Number(unassignStaffId), source: 'tab' })}
              className="p-1.5 rounded-lg bg-rose-100 dark:bg-rose-900/30 text-rose-600 hover:bg-rose-200 transition-colors cursor-pointer"
              title="Unassign this student"
             >
              <UserMinus className="w-3.5 h-3.5" />
             </button>
            </td>
           </tr>
          );
         })
        )}
       </tbody>
      </table>
     </div>
    )}
   </div>
  )}

 </div>


 {/* ─── 3. VIEW STAFF ASSIGNED ROSTER & COMPLETION MODAL ─── */}
 {viewRosterModal.isOpen && (
 <GlobalModalBackdrop isOpen={true} className="flex items-center justify-center p-4">
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
 onClick={() => setStudentToUnassign({ student: s, staffId: Number(viewRosterModal.staff?.id), source: 'modal' })}
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
 </GlobalModalBackdrop>
 )}

 {/* ─── 4. REUSABLE PREMIUM CONFIRMATION MODAL ─── */}
 {confirmModal.isOpen && (
 <GlobalModalBackdrop isOpen={true} className="flex items-center justify-center p-4">
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
 </GlobalModalBackdrop>
 )}

 {/* ─── 5. CREATE STAFF MODAL ─── */}
 {showCreateModal && (
 <GlobalModalBackdrop isOpen={true} className="flex items-center justify-center p-4">
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
 className="px-4 py-2 rounded-xl bg-sky-700 hover:bg-sky-800 text-white font-bold disabled:opacity-50"
 >
 {submitting ? 'Creating...' : 'Create Account'}
 </button>
 </div>
 </form>
 </div>
 </GlobalModalBackdrop>
 )}

 {/* Premium Institutional Allocation Confirmation Modal */}
 <AllocationConfirmationModal
 isOpen={showAllocationConfirmModal}
 onClose={() => setShowAllocationConfirmModal(false)}
 onConfirm={executeConfirmAllocation}
 targetStaff={staffList.find(s => s.id === Number(targetStaffId)) || null}
 selectedCount={selectedStudents.length}
 />

 {/* ─── 6. UNASSIGN STUDENT WARNING MODAL ─── */}
 {studentToUnassign && (
 <GlobalModalBackdrop isOpen={true} className="flex items-center justify-center p-4">
  <div className="bg-white dark:bg-navy-900 w-full max-w-md p-6 rounded-3xl border border-rose-200 dark:border-rose-900/50 shadow-2xl space-y-5 text-center relative">
   <div className="w-16 h-16 bg-rose-100 dark:bg-rose-900/30 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-2">
    <AlertTriangle className="w-8 h-8" />
   </div>
   
   <div>
    <h3 className="font-black text-lg text-slate-900 dark:text-white mb-2">
     Remove Student?
    </h3>
    <p className="text-sm text-slate-600 dark:text-navy-300">
     Are you sure you want to unassign <strong>{studentToUnassign.student.name} ({studentToUnassign.student.reg_no})</strong>?
    </p>
    <p className="text-xs text-rose-500 font-medium mt-2">
     This student will be moved back to the unassigned queue.
    </p>
   </div>

   <div className="flex items-center justify-center space-x-3 pt-4 border-t border-slate-100 dark:border-navy-800">
    <button
     onClick={() => setStudentToUnassign(null)}
     className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-navy-800 hover:bg-slate-200 dark:hover:bg-navy-700 text-slate-700 dark:text-slate-300 font-bold text-sm transition-all cursor-pointer"
    >
     Cancel
    </button>
    <button
     onClick={confirmUnassignStudent}
     className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm shadow-md transition-all cursor-pointer"
    >
     Yes, Remove
    </button>
   </div>
  </div>
 </GlobalModalBackdrop>
 )}

 </div>
 );
};
