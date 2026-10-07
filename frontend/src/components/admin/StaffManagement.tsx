import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { Search, UserPlus, Edit2, Shield, Ban, CheckCircle, RefreshCcw, UserX, AlertCircle, ArrowRight, Building2, GraduationCap, Award, Sparkles, Key, Mail, User, Calendar, Check, X, Trash2, Phone, Briefcase, Activity, ShieldAlert, FileText, Database, Lock, KeyRound, Loader2 } from 'lucide-react';
import api from '../../services/api';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import { useDepartments } from '../../contexts/DepartmentContext';
import { CustomDropdown, DropdownOption } from '../CustomDropdown';
import { GlobalModalBackdrop } from '../GlobalModalBackdrop';
import { CreateStaffModal } from './CreateStaffModal';
import { EditStaffModal } from './EditStaffModal';

let cachedStaffList: any[] | null = null;

export const StaffManagement: React.FC = () => {
  const [staffList, setStaffList] = useState<any[]>(cachedStaffList || []);
  const { departments } = useDepartments();
  const [loading, setLoading] = useState(!cachedStaffList);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [creationSuccess, setCreationSuccess] = useState<any>(null);
  const [deletingStaff, setDeletingStaff] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState<number | string | null>(null);
  const [selectedStaffObj, setSelectedStaffObj] = useState<any | null>(null);

  // Single Source of Truth: Derive selected staff directly from staffList or selected object fallback
  const editingStaff = useMemo(() => {
    if (selectedStaffId === null && !selectedStaffObj) return null;
    const targetId = selectedStaffId ?? selectedStaffObj?.id ?? selectedStaffObj?.user_id;
    if (targetId === null || targetId === undefined) return selectedStaffObj || null;
    const found = staffList.find(s => String(s.id) === String(targetId) || String(s.user_id || s.id) === String(targetId));
    return found || selectedStaffObj || null;
  }, [staffList, selectedStaffId, selectedStaffObj]);

  const { notify } = useNotification();
  const { user: currentUser } = useAuth();
  const isSuperAdmin = currentUser?.role?.toLowerCase() === 'super admin';
  const [previewingPhoto, setPreviewingPhoto] = useState<{ url: string; name: string; role?: string; id?: string } | null>(null);

  const handleOpenEditModal = (staff: any) => {
    if (staff) {
      setSelectedStaffObj(staff);
      setSelectedStaffId(staff.id ?? staff.user_id ?? null);
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
  }, []);

  const autoGenerateInstId = (deptIdVal: string, roleVal: string) => {
    const dept = departments.find(d => String(d.id) === String(deptIdVal));
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

  const fetchStaff = async (silent = false) => {
    if (!silent && !cachedStaffList) setLoading(true);
    setErrorState(null);
    try {
      const res = await api.get('/admin/staff-list');
      if (res.data && Array.isArray(res.data)) {
        setStaffList(res.data);
        cachedStaffList = res.data;
      } else {
        setStaffList([]);
        cachedStaffList = [];
      }
    } catch (err: any) {
      if (axios.isCancel(err) || err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') {
        return;
      }
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
        full_name: formData.username.trim(),
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
          <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-500" /> Staff Management
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Manage institutional staff accounts, administrative roles, and student mentoring access.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { resetForm(); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white rounded-xl font-bold text-xs shadow-md shadow-brand-500/20 transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4" /> Add Staff Member
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-navy-950/60 rounded-2xl border border-slate-200/80 dark:border-navy-700">
        <div className="grid grid-cols-5 gap-1 sm:flex sm:items-center sm:gap-1.5 w-full sm:w-auto">
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
              className={`px-1.5 sm:px-3 py-2 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-black transition-all cursor-pointer text-center min-w-0 flex items-center justify-center ${roleFilter === tab.id
                ? 'bg-brand-600 text-white shadow-sm'
                : 'bg-white dark:bg-navy-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700 border border-slate-200/60 dark:border-navy-700'
                }`}
            >
              <span className="truncate">{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="relative flex-1 sm:max-w-xs">
          <input
            type="text"
            placeholder="Search username, email, ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            className="w-full h-9 pl-9 pr-8 text-xs font-bold rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none shadow-sm text-left transition-all"
          />
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 z-10 text-slate-500 dark:text-slate-400">
            <Search className="w-4 h-4 stroke-[2.5]" />
          </div>
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 z-10 flex items-center px-2.5 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 cursor-pointer transition-colors"
              title="Clear search"
            >
              <X className="w-4 h-4 stroke-[2.5]" />
            </button>
          )}
        </div>
      </div>

      {/* Main Table / State Views */}
      <div className="bg-white dark:bg-navy-800 rounded-3xl border border-slate-200 dark:border-navy-700 overflow-hidden shadow-sm">
        {/* 1. LOADING STATE */}
        {loading && (
          <div className="p-16 text-center space-y-3">
            <RefreshCcw className="w-8 h-8 text-brand-500 animate-spin mx-auto" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
              Loading staff accounts...
            </p>
            <p className="text-xs text-slate-400">Querying authoritative database records.</p>
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
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {errorState.type === 'FORBIDDEN'
                  ? 'Access Restricted'
                  : (errorState.type === 'NETWORK_ERROR' ? 'Network Connection Error' : 'Unable to load staff accounts')}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                {errorState.message}
              </p>
            </div>
            {errorState.type !== 'FORBIDDEN' && (
              <button
                type="button"
                onClick={() => fetchStaff()}
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
            <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-navy-950 text-slate-400 flex items-center justify-center mx-auto">
              <UserX className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                No staff accounts have been created.
              </h3>
              <p className="text-xs text-slate-500">
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
          <div>
            {filteredStaff.length === 0 ? (
              <div className="px-6 py-12 text-center text-xs font-bold text-slate-400">
                No staff accounts match your current filter.
              </div>
            ) : (
              <>
                {/* MOBILE CARD VIEW (< 768px) - High Tech Institutional Card */}
                <div className="block md:hidden p-3 space-y-3 bg-slate-100/50 dark:bg-navy-950/40">
                  {filteredStaff.map((staff) => {
                    const workloadPct = Math.min(100, Math.round(((staff.assigned_count || 0) / (staff.max_capacity || 30)) * 100));
                    const initials = (staff.full_name || staff.username || 'S')
                      .split(' ')
                      .filter(Boolean)
                      .map((n: string) => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2) || 'S';

                    return (
                      <div
                        key={staff.id}
                        className="group relative rounded-3xl p-5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-slate-200/80 dark:border-slate-800/80 hover:border-indigo-500/60 dark:hover:border-indigo-500/60 shadow-md hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 space-y-4 overflow-hidden flex flex-col justify-between"
                      >
                        {/* Linear Glowing Top Accent Line */}
                        <div className={`absolute top-0 left-0 right-0 h-1 transition-all duration-500 ${
                          staff.is_active 
                            ? 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 group-hover:h-1.5' 
                            : 'bg-gradient-to-r from-rose-500 via-amber-500 to-rose-600'
                        }`} />

                        {/* Hover Corner Soft Lighting */}
                        <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-indigo-500/10 dark:bg-indigo-400/10 blur-3xl pointer-events-none group-hover:scale-150 transition-all duration-500" />

                        {/* 1. Header Row: Avatar, Identity & Status */}
                        <div className="flex items-start justify-between gap-3 min-w-0 pt-1">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div 
                              className={`relative shrink-0 ${staff.profile_photo ? 'cursor-pointer active:scale-95 transition-transform' : ''}`}
                              onClick={() => {
                                if (staff.profile_photo) {
                                  setPreviewingPhoto({
                                    url: staff.profile_photo,
                                    name: staff.full_name || staff.username,
                                    role: staff.role,
                                    id: staff.institutional_id || `NEC-STAFF-${staff.id}`
                                  });
                                }
                              }}
                            >
                              {staff.profile_photo ? (
                                <img
                                  src={staff.profile_photo}
                                  alt={staff.full_name || staff.username}
                                  className="w-12 h-12 rounded-2xl object-cover border-2 border-indigo-500/30 shadow-md bg-white dark:bg-slate-950"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 via-blue-600 to-violet-600 text-white font-black text-sm flex items-center justify-center shadow-lg shadow-indigo-500/20 uppercase tracking-wider border border-white/20">
                                  {initials}
                                </div>
                              )}
                              <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-900 ${
                                staff.is_active ? 'bg-emerald-500 shadow-xs' : 'bg-rose-500'
                              }`} />
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h4 
                                  className="font-black text-base text-slate-900 dark:text-white leading-tight truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors"
                                  title={staff.full_name || staff.username}
                                >
                                  {staff.full_name || staff.username}
                                </h4>
                                {staff.role === 'Super Admin' && (
                                  <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shrink-0">
                                    ROOT
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5 truncate" title={staff.email || `@${staff.username}`}>
                                <Mail className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                <span className="truncate">{staff.email || `@${staff.username}`}</span>
                              </div>
                            </div>
                          </div>

                          {/* Status Badge */}
                          <div className="shrink-0">
                            {staff.is_active ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-2xs">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shadow-2xs">
                                <span className="w-2 h-2 rounded-full bg-rose-500" />
                                Suspended
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 2. Linear Hairline Metadata Matrix (2x2) */}
                        <div className="grid grid-cols-2 gap-2.5">
                          {/* 1. Institutional ID */}
                          <div className="p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800/80 flex flex-col justify-between">
                            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1">
                              <KeyRound className="w-3 h-3 text-indigo-500 shrink-0" />
                              <span className="truncate">Institutional ID</span>
                            </span>
                            <span 
                              className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200 mt-1 block truncate"
                              title={staff.institutional_id || `NEC-STAFF-${staff.id}`}
                            >
                              {staff.institutional_id || `NEC-STAFF-${staff.id}`}
                            </span>
                          </div>

                          {/* 2. Department / Scope */}
                          <div className="p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800/80 flex flex-col justify-between">
                            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1">
                              <Building2 className="w-3 h-3 text-emerald-500 shrink-0" />
                              <span className="truncate">Dept / Scope</span>
                            </span>
                            <span 
                              className="text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mt-1 block truncate"
                              title={staff.department || 'INSTITUTIONAL'}
                            >
                              {staff.department || 'INSTITUTIONAL'}
                            </span>
                          </div>

                          {/* 3. Role */}
                          <div className="p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800/80 flex flex-col justify-between">
                            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1">
                              <Shield className="w-3 h-3 text-amber-500 shrink-0" />
                              <span className="truncate">Role</span>
                            </span>
                            <div className="mt-1">
                              <span 
                                className={`px-2 py-0.5 rounded-lg text-xs font-bold inline-block truncate max-w-full ${
                                  staff.role === 'Faculty'
                                    ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
                                    : staff.role === 'HOD'
                                      ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                                      : staff.role?.includes('Admin')
                                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                        : 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20'
                                }`}
                                title={staff.role || 'Staff'}
                              >
                                {staff.role || 'Staff'}
                              </span>
                            </div>
                          </div>

                          {/* 4. Workload Progress */}
                          <div className="p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800/80 flex flex-col justify-between">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                <Activity className="w-3 h-3 text-sky-500 shrink-0" />
                                <span className="truncate">Workload</span>
                              </span>
                              <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                                {staff.assigned_count || 0}/{staff.max_capacity || 30}
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mt-2">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  workloadPct > 85 
                                    ? 'bg-gradient-to-r from-rose-500 to-red-600' 
                                    : workloadPct > 50 
                                      ? 'bg-gradient-to-r from-amber-500 to-orange-500' 
                                      : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500'
                                }`}
                                style={{ width: `${workloadPct}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* 3. Vercel Executive Action Toolbar */}
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(staff)}
                            className="flex-1 py-2 px-3 rounded-xl font-bold text-xs bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:bg-indigo-600 dark:hover:bg-indigo-500 dark:hover:text-white active:scale-95 transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>Edit Account</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(staff.id, staff.is_active)}
                            className={`py-2 px-3 rounded-xl font-bold text-xs border active:scale-95 transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs ${
                              staff.is_active
                                ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-amber-500 hover:text-white dark:hover:bg-amber-500 border-slate-200/80 dark:border-slate-700/80'
                                : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-600 hover:text-white border-emerald-200/80 dark:border-emerald-800/80'
                            }`}
                            title={staff.is_active ? 'Suspend Account' : 'Activate Account'}
                          >
                            {staff.is_active ? <UserX className="w-3.5 h-3.5" /> : <RefreshCcw className="w-3.5 h-3.5" />}
                            <span className="hidden sm:inline">{staff.is_active ? 'Suspend' : 'Activate'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingStaff(staff)}
                            className="p-2.5 rounded-xl font-bold text-xs bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 hover:bg-rose-600 hover:text-white border border-rose-200/60 dark:border-rose-800/60 active:scale-95 transition-all duration-200 flex items-center justify-center cursor-pointer shadow-2xs"
                            title="Delete Staff Account"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* DESKTOP TABLE VIEW (>= 768px) */}
                <div className="hidden md:block overflow-x-auto p-2">
                  <table className="w-full text-left text-sm whitespace-nowrap border-separate border-spacing-y-2">
                    <thead className="bg-gradient-to-r from-slate-100/90 via-slate-100/50 to-slate-100/90 dark:from-navy-900 dark:via-navy-800 dark:to-navy-900 text-slate-800 dark:text-slate-200 font-black uppercase text-[11px] tracking-widest shadow-sm rounded-xl overflow-hidden backdrop-blur-md">
                      <tr>
                        <th className="px-6 py-4 rounded-l-xl">Institutional ID</th>
                        <th className="px-6 py-4">Staff Identity</th>
                        <th className="px-6 py-4">Department</th>
                        <th className="px-6 py-4">Role / Scope</th>
                        <th className="px-6 py-4">Workload Metrics</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4 text-right rounded-r-xl">Operations</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y-0">
                      {filteredStaff.map((staff) => (
                        <tr key={staff.id} className="bg-white dark:bg-navy-950 hover:bg-brand-50/30 dark:hover:bg-brand-900/10 transition-all duration-300 shadow-sm hover:shadow-md rounded-xl group border border-slate-100 dark:border-navy-800">
                          <td className="px-6 py-4">
                            <span className="font-mono text-xs font-black text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800 inline-block shadow-2xs">
                              {staff.institutional_id || `NEC-STAFF-${staff.id}`}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div 
                                className={`relative shrink-0 ${staff.profile_photo ? 'cursor-pointer hover:scale-105 active:scale-95 transition-transform' : ''}`}
                                onClick={() => {
                                  if (staff.profile_photo) {
                                    setPreviewingPhoto({
                                      url: staff.profile_photo,
                                      name: staff.full_name || staff.username,
                                      role: staff.role,
                                      id: staff.institutional_id || `NEC-STAFF-${staff.id}`
                                    });
                                  }
                                }}
                                title={staff.profile_photo ? "Click to view enlarged photo" : ""}
                              >
                                {staff.profile_photo ? (
                                  <img
                                    src={staff.profile_photo}
                                    alt={staff.full_name || staff.username}
                                    className="w-10 h-10 rounded-xl object-cover border-2 border-indigo-500/40 shadow-xs bg-white dark:bg-navy-950"
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 via-indigo-600 to-purple-600 text-white font-black text-xs flex items-center justify-center shadow-xs uppercase tracking-wider border border-white/20">
                                    {(staff.full_name || staff.username || 'S')
                                      .split(' ')
                                      .filter(Boolean)
                                      .map((n: string) => n[0])
                                      .join('')
                                      .toUpperCase()
                                      .slice(0, 2) || 'S'}
                                  </div>
                                )}
                                <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-navy-900 ${
                                  staff.is_active ? 'bg-emerald-500' : 'bg-rose-500'
                                }`} />
                              </div>
                              <div className="min-w-0">
                                <div className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5 text-sm">
                                  <span className="truncate">{staff.full_name || staff.username}</span>
                                  {staff.role === 'Super Admin' && (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300 border border-rose-300 dark:border-rose-500/30">
                                      ROOT
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-0.5 flex items-center gap-1">
                                  <span className="truncate">{staff.email || `@${staff.username}`}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider border bg-slate-100 text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 shadow-2xs inline-block">
                              {staff.department || 'INSTITUTIONAL'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-black border shadow-2xs inline-block ${
                              staff.role === 'Faculty'
                                ? 'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950/70 dark:text-indigo-300 dark:border-indigo-800'
                                : (staff.role === 'HOD'
                                  ? 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/70 dark:text-purple-300 dark:border-purple-800'
                                  : (staff.role?.includes('Admin')
                                    ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800'
                                    : 'bg-brand-100 text-brand-800 border-brand-300 dark:bg-brand-950/70 dark:text-brand-300 dark:border-brand-800'))
                            }`}>
                              {staff.role || 'Staff'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                              {staff.assigned_count || 0} / {staff.max_capacity || 30}
                            </div>
                            <div className="w-24 h-2 bg-slate-200 dark:bg-navy-950 rounded-full overflow-hidden mt-1.5 border border-slate-300 dark:border-navy-700">
                              <div
                                className="h-full bg-brand-500 rounded-full transition-all duration-300"
                                style={{ width: `${Math.min(100, ((staff.assigned_count || 0) / (staff.max_capacity || 30)) * 100)}%` }}
                              />
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {staff.is_active ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 shadow-2xs">
                                <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800 shadow-2xs">
                                <Ban className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" /> Suspended
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right space-x-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(staff)}
                              className="p-2 rounded-xl text-brand-700 hover:bg-brand-100 hover:text-brand-800 bg-brand-50 border border-brand-200 dark:bg-brand-500/10 dark:text-brand-300 dark:hover:bg-brand-500/20 dark:border-brand-500/30 transition-all cursor-pointer shadow-2xs inline-flex items-center justify-center"
                              title="Edit Staff Account & Role"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(staff.id, staff.is_active)}
                              className={`p-2 rounded-xl transition-all cursor-pointer shadow-2xs inline-flex items-center justify-center ${staff.is_active
                                ? 'text-amber-700 hover:bg-amber-100 hover:text-amber-800 bg-amber-50 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/20 dark:border-amber-500/30'
                                : 'text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 bg-emerald-50 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20 dark:border-emerald-500/30'
                              }`}
                              title={staff.is_active ? "Suspend Account" : "Activate Account"}
                            >
                              {staff.is_active ? <UserX className="w-4 h-4" /> : <RefreshCcw className="w-4 h-4" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingStaff(staff)}
                              className="p-2 rounded-xl text-rose-700 hover:bg-rose-100 hover:text-rose-800 bg-rose-50 border border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20 dark:border-rose-500/30 transition-all cursor-pointer shadow-2xs inline-flex items-center justify-center"
                              title="Permanently Delete Staff Account"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </div>


      {showModal && (
        <CreateStaffModal
          onClose={handleCloseModal}
          onSuccess={(newStaff?: any) => {
            if (newStaff) {
              setStaffList(prev => [newStaff, ...prev]);
            }
            fetchStaff(true); // silent fetch to keep in sync
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
          onClose={() => {
            setSelectedStaffId(null);
            setSelectedStaffObj(null);
          }}
          onSuccess={async (updatedStaff?: any) => {
            if (updatedStaff && (updatedStaff.id || updatedStaff.user_id)) {
              const uId = updatedStaff.id || updatedStaff.user_id;
              setStaffList(prev => prev.map(s => String(s.id) === String(uId) ? { ...s, ...updatedStaff } : s));
            }
            setSelectedStaffId(null);
            setSelectedStaffObj(null);
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
              <div className="bg-white dark:bg-navy-950 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-200 dark:border-navy-700 p-6 text-center space-y-5">
                <div className="w-14 h-14 bg-rose-100 dark:bg-rose-500/20 text-rose-500 rounded-2xl flex items-center justify-center mx-auto">
                  <UserX className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white mb-1">Discard Changes?</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">You have unsaved changes in this form. Are you sure you want to discard them? This cannot be undone.</p>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCancelConfirm(false)}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-950 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 transition-all cursor-pointer"
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
              <div className="bg-white dark:bg-navy-950 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-indigo-200/50 dark:border-indigo-900/40 p-6 text-center space-y-5">
                <div className="w-16 h-16 bg-brand-100 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-brand-500/20">
                  <UserPlus className="w-8 h-8" />
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">
                    Create Institutional Account?
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Please confirm the details before creating this staff account.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-navy-800/60 rounded-2xl border border-slate-200/80 dark:border-navy-700/80 text-left space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Username:</span>
                    <span className="font-bold text-slate-900 dark:text-white">{formData.username}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Official Email:</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200">{formData.email}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Assigned Role:</span>
                    <span className="font-black px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                      {formData.role}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Department:</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[200px]">
                      {departments.find(d => String(d.id) === String(formData.department_id))?.code || 'CSE(CS)'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-1.5 border-t border-slate-200 dark:border-navy-700 text-[11px] text-slate-500">
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
                    className="flex-1 px-4 py-2.5 rounded-xl font-bold text-xs bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-navy-700 transition-colors cursor-pointer"
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
              <div className="bg-white dark:bg-navy-950 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-rose-200/80 dark:border-rose-900/60 p-6 text-center space-y-5">
                <div className="w-16 h-16 bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-rose-500/20">
                  <Trash2 className="w-8 h-8" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                    Delete Staff Account?
                  </h3>
                  <p className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 leading-relaxed">
                    You are about to permanently remove this institutional staff account from the system.
                  </p>
                </div>

                <div className="p-4 bg-rose-50/70 dark:bg-rose-950/40 rounded-2xl border border-rose-200/80 dark:border-rose-900/50 text-left space-y-2.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-700 dark:text-slate-300 font-bold">Username:</span>
                    <span className="font-extrabold text-slate-900 dark:text-white font-mono">{deletingStaff.username}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-700 dark:text-slate-300 font-bold">Official Email:</span>
                    <span className="font-extrabold text-slate-900 dark:text-white">{deletingStaff.email}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-700 dark:text-slate-300 font-bold">Role:</span>
                    <span className="font-black text-indigo-700 dark:text-indigo-300 bg-indigo-100/80 dark:bg-indigo-900/50 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800">{deletingStaff.role}</span>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => setDeletingStaff(null)}
                    className="flex-1 px-4 py-2.5 rounded-xl font-extrabold text-xs bg-slate-200/90 dark:bg-navy-800 text-slate-800 dark:text-slate-100 hover:bg-slate-300 dark:hover:bg-navy-700 transition-colors cursor-pointer border border-slate-300 dark:border-navy-700 shadow-2xs"
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

          {/* Full Screen Photo Lightbox for Mobile APK & Desktop */}
          {previewingPhoto && (
            <GlobalModalBackdrop isOpen={true} className="flex items-center justify-center p-4 z-[999999]" onClose={() => setPreviewingPhoto(null)}>
              <div className="relative w-full max-w-md bg-white dark:bg-navy-950 rounded-[2rem] overflow-hidden p-1 shadow-2xl shadow-brand-500/20 animate-scale-up border border-slate-200 dark:border-navy-800 flex flex-col group" onClick={(e) => e.stopPropagation()}>
                {/* Top decorative gradient header */}
                <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-br from-brand-600 via-indigo-600 to-purple-600 opacity-90 rounded-t-[1.8rem]"></div>
                
                {/* Close Button */}
                <button onClick={() => setPreviewingPhoto(null)} className="absolute top-4 right-4 text-white hover:bg-white/20 p-2 rounded-full backdrop-blur-md cursor-pointer transition-all z-10 shadow-sm">
                  <X className="w-5 h-5" />
                </button>
                
                <div className="relative z-10 mt-12 flex flex-col items-center pb-6">
                  {/* Profile Image with Glowing Border */}
                  <div className="relative p-1 bg-white dark:bg-navy-950 rounded-[2rem] shadow-xl">
                    <div className="absolute inset-0 bg-gradient-to-tr from-brand-400 to-indigo-400 rounded-[2rem] blur-md opacity-60 animate-pulse"></div>
                    <div className="w-40 h-40 rounded-3xl overflow-hidden bg-black flex items-center justify-center relative z-10 border-4 border-white dark:border-navy-900 shadow-lg">
                      <img src={previewingPhoto.url} alt={previewingPhoto.name} className="w-full h-full object-cover transition-transform duration-500 hover:scale-110" />
                    </div>
                  </div>

                  {/* Text Information Details */}
                  <div className="mt-6 text-center space-y-2 px-6">
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{previewingPhoto.name}</h2>
                    <div className="inline-flex items-center justify-center px-3 py-1 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-full">
                      <span className="text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                        {previewingPhoto.id} &bull; {previewingPhoto.role}
                      </span>
                    </div>
                  </div>

                  {/* Badges / Extras */}
                  <div className="mt-6 w-full px-6">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-50 dark:bg-navy-900 border border-slate-100 dark:border-navy-800">
                        <Building2 className="w-5 h-5 text-emerald-500 mb-1.5" />
                        <span className="text-[10px] uppercase font-black text-slate-400">Institutional</span>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate w-full text-center">Verified Staff</span>
                      </div>
                      <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-50 dark:bg-navy-900 border border-slate-100 dark:border-navy-800">
                        <Lock className="w-5 h-5 text-brand-500 mb-1.5" />
                        <span className="text-[10px] uppercase font-black text-slate-400">Security</span>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Active Profile</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 border-t border-slate-100 dark:border-navy-800 w-full pt-4 flex justify-center">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5" />
                      Official Admin Control Center
                    </div>
                  </div>
                </div>
              </div>
            </GlobalModalBackdrop>
          )}
        </div>
      );
    };
