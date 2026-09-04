import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Search, UserPlus, Edit2, Shield, Ban, CheckCircle, RefreshCcw, UserX, AlertCircle, ArrowRight, Building2, GraduationCap, Award, Sparkles, Key, Mail, User, Calendar, Check, X, Trash2, Phone, Briefcase, Activity, ShieldAlert, FileText, Database, Lock, KeyRound, Loader2 } from 'lucide-react';
import api from '../../services/api';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import { CustomDropdown, DropdownOption } from '../CustomDropdown';
import { GlobalModalBackdrop } from '../GlobalModalBackdrop';
import { CreateStaffModal } from './CreateStaffModal';
import { EditStaffModal } from './EditStaffModal';

const DEFAULT_DEPARTMENTS = [
  { id: 1, name: 'Computer Science and Engineering (Cyber Security)', code: 'CSE(CS)' },
  { id: 2, name: 'Computer Science and Engineering (IoT)', code: 'CSE(IOT)' }
];

export const StaffManagement: React.FC = () => {
  const [staffList, setStaffList] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>(DEFAULT_DEPARTMENTS);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [creationSuccess, setCreationSuccess] = useState<any>(null);
  const [deletingStaff, setDeletingStaff] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null);

  // Single Source of Truth: Derive selected staff directly from staffList
  const editingStaff = useMemo(() => {
    if (!selectedStaffId) return null;
    return staffList.find(s => s.id === selectedStaffId) || null;
  }, [staffList, selectedStaffId]);

  const { notify } = useNotification();
  const { user: currentUser } = useAuth();
  const isSuperAdmin = currentUser?.role?.toLowerCase() === 'super admin';

  const handleOpenEditModal = (staff: any) => {
    if (staff && staff.id) {
      setSelectedStaffId(staff.id);
    }
  };

  const [formData, setFormData] = useState({
    institutional_id: '',
    username: '',
    email: '',
    phone_number: '',
    password: '',
    confirm_password: '',
    role: 'Faculty',
    department_id: '1',
    academic_year: '',
    mentoring_role: '',
    date_of_birth: '',
    require_password_change: true,
    reporting_manager: '',
    account_status: 'Active'
  });
  const [idProofFile, setIdProofFile] = useState<File | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [passwordStrengthError, setPasswordStrengthError] = useState('');

  useEffect(() => {
    fetchStaff();
    fetchDepartments();
  }, []);

  const autoGenerateInstId = (deptIdVal: string, roleVal: string) => {
    const dept = (departments.length > 0 ? departments : DEFAULT_DEPARTMENTS).find(d => String(d.id) === String(deptIdVal));
    const deptCode = (dept?.code || 'GEN').replace(/[\(\)-]/g, '').toUpperCase();
    const rolePrefix = roleVal === 'Faculty' ? 'FAC' : (roleVal === 'Staff' ? 'STF' : (roleVal === 'HOD' ? 'HOD' : 'ADM'));
    const randomNum = Math.floor(100 + Math.random() * 900);
    return `NEC-${deptCode}-${rolePrefix}-${randomNum}`;
  };

  const handleDeptChange = (newDeptId: string) => {
    const nextId = (!formData.institutional_id || formData.institutional_id.startsWith('NEC-'))
      ? autoGenerateInstId(newDeptId, formData.role)
      : formData.institutional_id;
    setFormData({ ...formData, department_id: newDeptId, institutional_id: nextId });
  };

  const handleRoleChange = (newRole: string) => {
    const nextId = (!formData.institutional_id || formData.institutional_id.startsWith('NEC-'))
      ? autoGenerateInstId(formData.department_id, newRole)
      : formData.institutional_id;
    setFormData({ ...formData, role: newRole, institutional_id: nextId });
  };

  const [dobDisplay, setDobDisplay] = useState('');

  const handleDobInput = (val: string) => {
    let cleaned = val.replace(/[^0-9/]/g, '');

    if (cleaned.length === 2 && !cleaned.includes('/') && !dobDisplay.endsWith('/')) {
      cleaned = cleaned + '/';
    } else if (cleaned.length === 5 && cleaned.split('/').length === 2 && !dobDisplay.endsWith('/')) {
      cleaned = cleaned + '/';
    }

    if (cleaned.length > 10) cleaned = cleaned.slice(0, 10);
    setDobDisplay(cleaned);

    const match = cleaned.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (match) {
      const [, d, m, y] = match;
      const dayNum = parseInt(d, 10);
      const monthNum = parseInt(m, 10);
      const yearNum = parseInt(y, 10);
      if (dayNum >= 1 && dayNum <= 31 && monthNum >= 1 && monthNum <= 12 && yearNum >= 1940 && yearNum <= 2015) {
        setFormData(prev => ({ ...prev, date_of_birth: `${y}-${m}-${d}` }));
        return;
      }
    }
    if (!cleaned) {
      setFormData(prev => ({ ...prev, date_of_birth: '' }));
    }
  };



  const [errorState, setErrorState] = useState<{ type: 'API_ERROR' | 'FORBIDDEN' | 'NETWORK_ERROR'; message: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');

  const fetchDepartments = async () => {
    try {
      const res = await api.get('/departments');
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        setDepartments(res.data);
      } else {
        setDepartments(DEFAULT_DEPARTMENTS);
      }
    } catch (err) {
      console.warn('Using default department fallback list in StaffManagement:', err);
      setDepartments(DEFAULT_DEPARTMENTS);
    }
  };

  const fetchStaff = async () => {
    setLoading(true);
    setErrorState(null);
    try {
      const res = await api.get('/admin/staff-list');
      if (res.data && Array.isArray(res.data)) {
        setStaffList(res.data);
      } else {
        setStaffList([]);
      }
    } catch (err: any) {
      console.error('Failed to load staff list:', err);
      const status = err.response?.status;
      if (status === 403) {
        setErrorState({
          type: 'FORBIDDEN',
          message: 'You do not have permission to view staff accounts.'
        });
      } else if (!err.response) {
        setErrorState({
          type: 'NETWORK_ERROR',
          message: 'Connection to the administration service failed.'
        });
      } else {
        setErrorState({
          type: 'API_ERROR',
          message: err.response?.data?.detail || 'Unable to load staff accounts.'
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const filteredStaff = useMemo(() => {
    return staffList.filter((s) => {
      if (roleFilter !== 'ALL') {
        const r = (s.role || '').toUpperCase();
        if (roleFilter === 'FACULTY' && !r.includes('FAC')) return false;
        if (roleFilter === 'STAFF' && (!r.includes('STAFF') || r.includes('DELETED'))) return false;
        if (roleFilter === 'HOD' && !r.includes('HOD')) return false;
        if (roleFilter === 'ADMIN' && (!r.includes('ADM') || r.includes('SUPER'))) return false;
        if (roleFilter === 'SUPER_ADMIN' && !r.includes('SUPER')) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const u = (s.username || '').toLowerCase();
        const e = (s.email || '').toLowerCase();
        const i = (s.institutional_id || '').toLowerCase();
        if (!u.includes(q) && !e.includes(q) && !i.includes(q)) return false;
      }
      return true;
    });
  }, [staffList, roleFilter, searchQuery]);

  const resetForm = () => {
    setFormData({
      institutional_id: '',
      username: '',
      email: '',
      phone_number: '',
      password: '',
      confirm_password: '',
      role: 'Faculty',
      department_id: String(departments[0]?.id || 1),
      academic_year: '',
      mentoring_role: '',
      date_of_birth: '',
      require_password_change: true,
      reporting_manager: '',
      account_status: 'Active'
    });
    setIdProofFile(null);
    setFormErrors({});
    setDobDisplay('');
    setCreationSuccess(null);
    setPasswordStrengthError('');
  };

  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const handleCloseModal = () => {
    const isFormDirty = formData.username || formData.email || formData.phone_number || formData.institutional_id;
    if (isFormDirty) {
      setShowCancelConfirm(true);
      return;
    }
    setShowModal(false);
    resetForm();
  };

  const [showConfirmCreate, setShowConfirmCreate] = useState(false);

  const handleCreateStaff = (e?: React.FormEvent | React.MouseEvent) => {
    if (e && e.preventDefault) e.preventDefault();
    const errors: Record<string, string> = {};

    if (!formData.username.trim()) {
      errors.username = 'Username is required.';
    } else if (!/^[a-zA-Z0-9_.]+$/.test(formData.username)) {
      errors.username = 'Only letters, numbers, underscores, and dots are allowed.';
    } else if (staffList.some(s => s.username === formData.username.trim())) {
      errors.username = 'Username is already taken.';
    }

    if (!formData.email.trim()) {
      errors.email = 'Official Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errors.email = 'Please enter a valid email address.';
    }

    if (!formData.phone_number.trim()) {
      errors.phone_number = 'Phone Number is required.';
    } else if (!/^\+?[0-9\s-]{10,15}$/.test(formData.phone_number.trim())) {
      errors.phone_number = 'Invalid phone number format.';
    }

    if (formData.institutional_id && staffList.some(s => s.institutional_id === formData.institutional_id.trim())) {
      errors.institutional_id = 'Institutional ID is already in use.';
    }

    if (formData.role !== 'Admin' && formData.role !== 'Super Admin') {
      if (!formData.department_id || formData.department_id === '0') {
        errors.department_id = 'Department is required for this role.';
      }
      if (!formData.academic_year) {
        errors.academic_year = 'Academic Year Cohort is required.';
      }
    }

    if (!formData.date_of_birth) {
      errors.date_of_birth = 'Date of Birth is required.';
    }

    if (formData.password) {
      const pwd = formData.password;
      if (pwd.length < 8 || !/[A-Z]/.test(pwd) || !/[0-9]/.test(pwd) || !/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) {
        errors.password = 'Min 8 chars, 1 uppercase, 1 number, 1 special char.';
      } else if (formData.password !== formData.confirm_password) {
        errors.confirm_password = 'Passwords do not match.';
      }
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      notify.error('Please fix the errors in the form before submitting.', '', { category: 'ADMIN' });
      return;
    }

    setFormErrors({});
    setShowConfirmCreate(true);
  };

  const confirmAndSubmitStaff = async () => {
    const rawDeptId = formData.department_id ? parseInt(String(formData.department_id), 10) : 0;
    const deptIdToSend = (rawDeptId > 0 && ['Staff', 'Faculty', 'HOD'].includes(formData.role))
      ? rawDeptId
      : null;

    setSubmitting(true);
    try {
      const payload = {
        institutional_id: formData.institutional_id?.trim() || undefined,
        username: formData.username.trim(),
        email: formData.email.trim().toLowerCase(),
        phone_number: formData.phone_number.trim(),
        password: formData.password?.trim() || undefined,
        role: formData.role || 'Faculty',
        department_id: deptIdToSend,
        academic_year: formData.academic_year || undefined,
        mentoring_role: formData.mentoring_role || undefined,
        date_of_birth: formData.date_of_birth || undefined,
        is_active: formData.account_status === 'Active',
        require_password_change: formData.require_password_change ?? true
      };

      const res = await api.post('/admin/staff', payload);
      notify.success(`Staff account '${formData.username}' created successfully!`, '', { category: 'ADMIN' });
      setShowConfirmCreate(false);
      setShowModal(false);
      resetForm();
      await fetchStaff();
      window.dispatchEvent(new CustomEvent('nec_staff_updated'));
    } catch (err: any) {
      console.error('Failed to create staff account:', err);
      const detail = err.response?.data?.detail || err.message || 'Failed to create staff account.';
      notify.error(detail, '', { category: 'ADMIN' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (staffId: number, currentStatus: boolean) => {
    try {
      await api.patch(`/admin/staff/${staffId}`, { is_active: !currentStatus });
      notify.success(`Staff account ${currentStatus ? 'deactivated' : 'activated'}.`, '', { category: 'ADMIN' });
      fetchStaff();
      window.dispatchEvent(new CustomEvent('nec_staff_updated'));
    } catch (err: any) {
      notify.error(err.response?.data?.detail || 'Failed to update status.', '', { category: 'ADMIN' });
    }
  };

  const confirmDeleteStaff = async () => {
    if (!deletingStaff) return;
    setIsDeleting(true);
    try {
      await api.delete(`/admin/staff/${deletingStaff.id}`);
      setStaffList(prev => prev.filter(staff => staff.id !== deletingStaff.id));
      notify.success(`Staff account '${deletingStaff.username}' deleted successfully.`, '', { category: 'ADMIN' });
      setDeletingStaff(null);
      window.dispatchEvent(new CustomEvent('nec_staff_updated'));
    } catch (err: any) {
      console.error('Failed to delete staff:', err);
      notify.error(err.response?.data?.detail || 'Failed to delete staff account.', '', { category: 'ADMIN' });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-500" /> Staff Management
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Manage institutional staff accounts, administrative roles, and student mentoring access.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchStaff}
            className="p-2 rounded-xl border border-gray-200 dark:border-navy-700 hover:bg-gray-50 dark:hover:bg-navy-750 text-gray-500 transition-colors cursor-pointer"
            title="Refresh staff list"
          >
            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => { resetForm(); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white rounded-xl font-bold text-xs shadow-md shadow-brand-500/20 transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4" /> Add Staff Member
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-gray-50 dark:bg-navy-900/60 rounded-2xl border border-gray-200/80 dark:border-navy-700">
        <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
          {[
            { id: 'ALL', label: `All (${staffList.length})` },
            { id: 'FACULTY', label: 'Faculty' },
            { id: 'STAFF', label: 'Staff' },
            { id: 'HOD', label: 'HOD' },
            { id: 'ADMIN', label: 'Admins' }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setRoleFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${roleFilter === tab.id
                ? 'bg-brand-600 text-white shadow-sm'
                : 'bg-white dark:bg-navy-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-navy-700 border border-gray-200/60 dark:border-navy-700'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 sm:max-w-xs">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search username, email, ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-8 text-xs font-medium rounded-xl border border-gray-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none shadow-sm"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Table / State Views */}
      <div className="bg-white dark:bg-navy-800 rounded-3xl border border-gray-200 dark:border-navy-700 overflow-hidden shadow-sm">
        {/* 1. LOADING STATE */}
        {loading && (
          <div className="p-16 text-center space-y-3">
            <RefreshCcw className="w-8 h-8 text-brand-500 animate-spin mx-auto" />
            <p className="text-sm font-bold text-gray-700 dark:text-gray-300">
              Loading staff accounts...
            </p>
            <p className="text-xs text-gray-400">Querying authoritative database records.</p>
          </div>
        )}

        {/* 2. ERROR STATES (403, Network, API) */}
        {!loading && errorState && (
          <div className="p-16 text-center space-y-4 max-w-md mx-auto">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto ${errorState.type === 'FORBIDDEN'
              ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600'
              : 'bg-rose-100 dark:bg-rose-500/20 text-rose-600'
              }`}>
              <AlertCircle className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                {errorState.type === 'FORBIDDEN'
                  ? 'Access Restricted'
                  : (errorState.type === 'NETWORK_ERROR' ? 'Network Connection Error' : 'Unable to load staff accounts')}
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                {errorState.message}
              </p>
            </div>
            {errorState.type !== 'FORBIDDEN' && (
              <button
                type="button"
                onClick={fetchStaff}
                className="px-4 py-2 rounded-xl bg-brand-600 text-white font-bold text-xs hover:bg-brand-700 transition-all shadow-sm cursor-pointer"
              >
                Retry Request
              </button>
            )}
          </div>
        )}

        {/* 3. SUCCESS WITH ZERO RECORDS */}
        {!loading && !errorState && staffList.length === 0 && (
          <div className="p-16 text-center space-y-4 max-w-md mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-navy-900 text-gray-400 flex items-center justify-center mx-auto">
              <UserX className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                No staff accounts have been created.
              </h3>
              <p className="text-xs text-gray-500">
                Click "Add Staff Member" above to provision faculty, mentors, or administrators.
              </p>
            </div>
            <button
              type="button"
              onClick={() => { resetForm(); setShowModal(true); }}
              className="px-4 py-2 rounded-xl bg-brand-600 text-white font-bold text-xs hover:bg-brand-700 transition-all shadow-sm cursor-pointer"
            >
              Add First Staff Member
            </button>
          </div>
        )}

        {/* 4. SUCCESS WITH DATA */}
        {!loading && !errorState && staffList.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 dark:bg-navy-900/50 text-gray-600 dark:text-gray-400 font-bold uppercase text-[10px] tracking-wider border-b border-gray-100 dark:border-navy-700">
                <tr>
                  <th className="px-6 py-4">Institutional ID</th>
                  <th className="px-6 py-4">Username / Email</th>
                  <th className="px-6 py-4">Department / Scope</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Workload</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-navy-700">
                {filteredStaff.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-xs font-bold text-gray-400">
                      No staff accounts match your current filter.
                    </td>
                  </tr>
                ) : (
                  filteredStaff.map((staff) => (
                    <tr key={staff.id} className="hover:bg-gray-50/80 dark:hover:bg-navy-750/50 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                        {staff.institutional_id || `NEC-STAFF-${staff.id}`}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                          <span>{staff.username}</span>
                          {staff.role === 'Super Admin' && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                              ROOT
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">{staff.email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${staff.department === 'CSE(CS)'
                          ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
                          : (staff.department === 'CSE(IOT)'
                            ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20'
                            : 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20')
                          }`}>
                          {staff.department || 'INSTITUTIONAL'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${staff.role === 'Faculty'
                          ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
                          : (staff.role === 'HOD'
                            ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
                            : (staff.role?.includes('Admin')
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                              : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'))
                          }`}>
                          {staff.role || 'Staff'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs font-bold text-gray-700 dark:text-gray-300">
                          {staff.assigned_count || 0} / {staff.max_capacity || 30}
                        </div>
                        <div className="w-20 h-1.5 bg-gray-100 dark:bg-navy-900 rounded-full overflow-hidden mt-1">
                          <div
                            className="h-full bg-brand-500 rounded-full"
                            style={{ width: `${Math.min(100, ((staff.assigned_count || 0) / (staff.max_capacity || 30)) * 100)}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {staff.is_active ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <CheckCircle className="w-3 h-3" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-500 dark:text-rose-400 border border-rose-500/20">
                            <Ban className="w-3 h-3" /> Suspended
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right space-x-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(staff)}
                          className="p-2 rounded-xl text-gray-400 hover:bg-brand-100 hover:text-brand-600 dark:hover:bg-brand-500/20 dark:hover:text-brand-400 transition-colors cursor-pointer"
                          title="Edit Staff Account & Role"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(staff.id, staff.is_active)}
                          className={`p-2 rounded-xl transition-colors cursor-pointer ${staff.is_active ? 'hover:bg-amber-100 hover:text-amber-600 dark:hover:bg-amber-500/20 text-gray-400' : 'hover:bg-emerald-100 hover:text-emerald-600 dark:hover:bg-emerald-500/20 text-gray-400'}`}
                          title={staff.is_active ? "Suspend Account" : "Activate Account"}
                        >
                          {staff.is_active ? <UserX className="w-4 h-4" /> : <RefreshCcw className="w-4 h-4" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingStaff(staff)}
                          className="p-2 rounded-xl text-gray-400 hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-500/20 dark:hover:text-rose-400 transition-colors cursor-pointer"
                          title="Permanently Delete Staff Account"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>


      {showModal && (
        <CreateStaffModal
          onClose={handleCloseModal}
          onSuccess={() => {
            setShowModal(false);
            fetchStaff();
            window.dispatchEvent(new CustomEvent('nec_staff_updated'));
          }}
          departments={departments}
          staffList={staffList}
          notify={notify}
        />
      )}
      {/* Edit Staff Member Modal */}
      {editingStaff && (
        <EditStaffModal
          staff={editingStaff}
          onClose={() => setSelectedStaffId(null)}
          onSuccess={async (updatedStaff?: any) => {
            if (updatedStaff && updatedStaff.id) {
              setStaffList(prev => prev.map(s => s.id === updatedStaff.id ? { ...s, ...updatedStaff } : s));
            }
            setSelectedStaffId(null);
            await fetchStaff();
            window.dispatchEvent(new CustomEvent('nec_staff_updated'));
          }}
          departments={departments}
          staffList={staffList}
          notify={notify}
        />
      )}
      {/* Custom Cancel Confirmation Dialog */}
      {createPortal(
        <>
          {showCancelConfirm && (
            <GlobalModalBackdrop isOpen={true} className="flex items-center justify-center p-4">
              <div className="bg-white dark:bg-navy-900 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-gray-200 dark:border-navy-700 p-6 text-center space-y-5">
                <div className="w-14 h-14 bg-rose-100 dark:bg-rose-500/20 text-rose-500 rounded-2xl flex items-center justify-center mx-auto">
                  <UserX className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900 dark:text-white mb-1">Discard Changes?</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">You have unsaved changes in this form. Are you sure you want to discard them? This cannot be undone.</p>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCancelConfirm(false)}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 dark:border-navy-700 bg-white dark:bg-navy-900 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-navy-800 transition-all cursor-pointer"
                  >
                    Keep Editing
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowCancelConfirm(false); setShowModal(false); resetForm(); }}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold transition-all cursor-pointer shadow-lg shadow-rose-500/30"
                  >
                    Yes, Discard
                  </button>
                </div>
              </div>
            </GlobalModalBackdrop>
          )}

          {/* Centered Create Staff Account Confirmation Modal */}
          {showConfirmCreate && (
            <GlobalModalBackdrop isOpen={true} className="flex items-center justify-center p-4">
              <div className="bg-white dark:bg-navy-900 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-indigo-200/50 dark:border-indigo-900/40 p-6 text-center space-y-5">
                <div className="w-16 h-16 bg-brand-100 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-brand-500/20">
                  <UserPlus className="w-8 h-8" />
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-xl font-black text-gray-900 dark:text-white">
                    Create Institutional Account?
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                    Please confirm the details before creating this staff account.
                  </p>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-navy-800/60 rounded-2xl border border-gray-200/80 dark:border-navy-700/80 text-left space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-medium">Username:</span>
                    <span className="font-bold text-gray-900 dark:text-white">{formData.username}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-medium">Official Email:</span>
                    <span className="font-mono text-gray-800 dark:text-gray-200">{formData.email}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-medium">Assigned Role:</span>
                    <span className="font-black px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                      {formData.role}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-medium">Department:</span>
                    <span className="font-semibold text-gray-700 dark:text-gray-300 truncate max-w-[200px]">
                      {departments.find(d => String(d.id) === String(formData.department_id))?.code || 'CSE(CS)'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-1.5 border-t border-gray-200 dark:border-navy-700 text-[11px] text-gray-500">
                    <span>Default Password:</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {formData.password?.trim() ? 'Custom Provided' : 'Staff@123456!'}
                    </span>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => setShowConfirmCreate(false)}
                    className="flex-1 px-4 py-2.5 rounded-xl font-bold text-xs bg-gray-100 dark:bg-navy-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-navy-700 transition-colors cursor-pointer"
                  >
                    Cancel / Edit
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={confirmAndSubmitStaff}
                    className="flex-1 px-4 py-2.5 rounded-xl font-black text-xs bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white shadow-lg shadow-indigo-500/30 flex items-center justify-center space-x-1.5 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <RefreshCcw className="w-3.5 h-3.5 animate-spin" />
                        <span>Creating...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Yes, Create Account</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </GlobalModalBackdrop>
          )}
        </>,
        document.body
      )}

          {deletingStaff && (
            <GlobalModalBackdrop isOpen={true} className="flex items-center justify-center p-4">
              <div className="bg-white dark:bg-navy-900 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-rose-200/50 dark:border-rose-900/40 p-6 text-center space-y-5">
                <div className="w-16 h-16 bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-rose-500/20">
                  <Trash2 className="w-8 h-8" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl font-black text-gray-900 dark:text-white">
                    Delete Staff Account?
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                    You are about to permanently remove this institutional staff account from the system.
                  </p>
                </div>

                <div className="p-3.5 bg-rose-50/50 dark:bg-rose-950/30 rounded-2xl border border-rose-100 dark:border-rose-900/30 text-left space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500 font-medium">Username:</span>
                    <span className="font-bold text-gray-900 dark:text-white">{deletingStaff.username}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500 font-medium">Official Email:</span>
                    <span className="font-semibold text-gray-700 dark:text-gray-300">{deletingStaff.email}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500 font-medium">Role:</span>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">{deletingStaff.role}</span>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => setDeletingStaff(null)}
                    className="flex-1 px-4 py-2.5 rounded-xl font-bold text-xs bg-gray-100 dark:bg-navy-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-navy-700 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={confirmDeleteStaff}
                    className="flex-1 px-4 py-2.5 rounded-xl font-black text-xs bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-lg shadow-rose-500/30 flex items-center justify-center space-x-1.5 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isDeleting ? (
                      <>
                        <RefreshCcw className="w-3.5 h-3.5 animate-spin" />
                        <span>Deleting...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Account</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </GlobalModalBackdrop>
          )}
        </div>
      );
    };
