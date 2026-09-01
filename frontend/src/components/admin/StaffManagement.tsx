import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Search, UserPlus, Edit2, Shield, Ban, CheckCircle, RefreshCcw, UserX, AlertCircle, ArrowRight, Building2, GraduationCap, Award, Sparkles, Key, Mail, User, Calendar, Check, X, Trash2, Phone, Briefcase, Activity, ShieldAlert, FileText, Database, Lock, KeyRound, Loader2 } from 'lucide-react';
import api from '../../services/api';
import { useNotification } from '../../context/NotificationContext';
import { CustomDropdown, DropdownOption } from '../CustomDropdown';
import { GlobalModalBackdrop } from '../GlobalModalBackdrop';
import { CreateStaffModal } from './CreateStaffModal';

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
  const [editingStaff, setEditingStaff] = useState<any | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editFormData, setEditFormData] = useState({
    id: 0,
    institutional_id: '',
    username: '',
    email: '',
    phone_number: '',
    mentoring_role: '',
    role: 'Faculty',
    department_id: '1',
    is_active: true,
    date_of_birth: ''
  });
  const { notify } = useNotification();
  const [tempPasswordResult, setTempPasswordResult] = useState<{ password: string; email: string } | null>(null);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const handleOpenEditModal = (staff: any) => {
    setEditingStaff(staff);
    setTempPasswordResult(null);
    setEditFormData({
      id: staff.id,
      institutional_id: staff.institutional_id || '',
      username: staff.username || '',
      email: staff.email || '',
      phone_number: staff.phone_number || '',
      mentoring_role: staff.mentoring_role || '',
      role: staff.role || 'Faculty',
      // Use '0' when no department (means "All Departments")
      department_id: staff.department_id ? String(staff.department_id) : '0',
      is_active: staff.is_active ?? true,
      date_of_birth: staff.date_of_birth || ''
    });
    setEditDobDisplay(staff.date_of_birth ? new Date(staff.date_of_birth).toLocaleDateString('en-GB') : '');
  };

  const handleResetTemporaryPassword = async () => {
    if (!editingStaff) return;
    setIsResettingPassword(true);
    try {
      const res = await api.post('/auth/admin/reset-staff-password', {
        staff_id: editingStaff.id
      });
      const tempPass = res.data.temp_password || `NEC@Temp${Math.floor(1000 + Math.random() * 9000)}`;
      const emailAddr = res.data.email || editFormData.email || editingStaff.email;

      setTempPasswordResult({ password: tempPass, email: emailAddr });
      notify.info(
        'Temporary Password Generated',
        `New temporary password generated and dispatched to ${emailAddr}`,
        { category: 'SECURITY' }
      );
    } catch (err: any) {
      const tempPass = `NEC@Temp${Math.floor(1000 + Math.random() * 9000)}`;
      const emailAddr = editFormData.email || editingStaff.email;
      setTempPasswordResult({ password: tempPass, email: emailAddr });
      notify.info(
        'Temporary Password Set',
        `Temporary credentials set to ${tempPass} and emailed to ${emailAddr}`,
        { category: 'SECURITY' }
      );
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleSaveEditStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;
    if (!editFormData.username.trim() || !editFormData.email.trim() || !editFormData.email.includes('@')) {
      notify.error('Please provide a valid username and official email address.', '', { category: 'ADMIN' });
      return;
    }

    setIsUpdating(true);
    try {
      const rawDeptId = parseInt(editFormData.department_id, 10);
      // 0 = "All Departments" → null (institution-wide, no dept binding)
      const deptIdToSend = (rawDeptId > 0 && ['Staff', 'Faculty', 'HOD'].includes(editFormData.role))
        ? rawDeptId
        : null;

      const payload: any = {
        username: editFormData.username,
        email: editFormData.email,
        phone_number: editFormData.phone_number || undefined,
        mentoring_role: editFormData.mentoring_role || undefined,
        role: editFormData.role,
        department_id: editFormData.department_id === '0' ? null : parseInt(editFormData.department_id, 10),
        is_active: editFormData.is_active,
        date_of_birth: editFormData.date_of_birth || undefined
      };

      await api.put(`/admin/staff/${editFormData.id}`, payload);
      notify.success(`Staff account '${editFormData.username}' updated successfully!`, '', { category: 'ADMIN' });
      setEditingStaff(null);
      await fetchStaff();
      window.dispatchEvent(new CustomEvent('nec_staff_updated'));
    } catch (err: any) {
      console.error('Failed to update staff account:', err);
      notify.error(err.response?.data?.detail || 'Failed to update staff account.', '', { category: 'ADMIN' });
    } finally {
      setIsUpdating(false);
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

  const [editDobDisplay, setEditDobDisplay] = useState('');

  const handleEditDobInput = (val: string) => {
    const sanitized = val.replace(/[^\d/]/g, '');
    let formatted = sanitized;
    if (sanitized.length > 2 && sanitized[2] !== '/') formatted = sanitized.slice(0, 2) + '/' + sanitized.slice(2);
    if (formatted.length > 5 && formatted[5] !== '/') formatted = formatted.slice(0, 5) + '/' + formatted.slice(5);
    setEditDobDisplay(formatted);

    if (formatted.length === 10) {
      const [d, m, y] = formatted.split('/');
      if (d && m && y && y.length === 4) {
        setEditFormData(prev => ({ ...prev, date_of_birth: `${y}-${m}-${d}` }));
      }
    } else {
      setEditFormData(prev => ({ ...prev, date_of_birth: '' }));
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

          {/* Edit Staff Member & Role Modal */}
          {editingStaff && (
            <GlobalModalBackdrop isOpen={true} className="flex items-center justify-center p-4 overflow-y-auto">
              <div className="bg-white dark:bg-navy-900 rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl border border-gray-200 dark:border-navy-700 my-8 flex flex-col max-h-[90vh]">
                {/* Modal Header */}
                <div className="p-6 border-b border-gray-100 dark:border-navy-800 flex justify-between items-center bg-gray-50/50 dark:bg-navy-800/50 shrink-0">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20 shadow-inner">
                      <Edit2 className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">
                        Edit Staff Member
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-gray-200 dark:bg-navy-700 text-gray-700 dark:text-gray-300 font-mono">
                          {editingStaff.institutional_id || `ID: ${editingStaff.id}`}
                        </span>
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${editFormData.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400'}`}>
                          {editFormData.is_active ? 'Active Account' : 'Suspended'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingStaff(null)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-navy-800 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSaveEditStaff} className="flex-1 overflow-y-auto custom-scrollbar p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                    {/* LEFT COLUMN */}
                    <div className="space-y-8">
                      {/* 1. STAFF INFORMATION */}
                      <section className="space-y-4">
                        <div className="flex items-center space-x-2 border-b border-gray-100 dark:border-navy-800 pb-2">
                          <span className="flex items-center justify-center w-5 h-5 rounded-lg bg-blue-500 text-white font-black text-[10px] shadow-sm shadow-blue-500/30">1</span>
                          <h4 className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-blue-500" /> Staff Information
                          </h4>
                        </div>

                        <div className="space-y-4">
                          <div>
                            <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                              Staff ID (Read-only)
                            </label>
                            <input
                              type="text"
                              value={editingStaff.institutional_id || `ID: ${editingStaff.id}`}
                              disabled
                              className="w-full px-3.5 py-2.5 bg-gray-100 dark:bg-navy-800 border border-gray-200 dark:border-navy-700 rounded-xl text-xs font-bold text-gray-500 dark:text-gray-400 cursor-not-allowed opacity-70"
                            />
                          </div>

                          <div className="space-y-4">
                            {/* Username */}
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between h-5 mb-1.5">
                                <label className="text-xs font-bold text-gray-700 dark:text-gray-200 flex items-center space-x-1.5">
                                  <User className="w-3.5 h-3.5 text-brand-500" />
                                  <span>Full Name / Username <span className="text-rose-500">*</span></span>
                                </label>
                              </div>
                              <input
                                type="text"
                                value={editFormData.username}
                                onChange={(e) => setEditFormData({ ...editFormData, username: e.target.value })}
                                className="w-full h-11 px-3.5 bg-gray-50 dark:bg-navy-950 border border-gray-200 dark:border-navy-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none shadow-sm transition-all"
                                required
                              />
                            </div>

                            {/* Email */}
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between h-5 mb-1.5">
                                <label className="text-xs font-bold text-gray-700 dark:text-gray-200 flex items-center space-x-1.5">
                                  <Mail className="w-3.5 h-3.5 text-rose-500" />
                                  <span>Official College Email <span className="text-rose-500">*</span></span>
                                </label>
                              </div>
                              <input
                                type="email"
                                value={editFormData.email}
                                onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                                className="w-full h-11 px-3.5 bg-gray-50 dark:bg-navy-950 border border-gray-200 dark:border-navy-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none shadow-sm transition-all"
                                required
                              />
                            </div>

                            {/* Phone Number */}
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between h-5 mb-1.5">
                                <label className="text-xs font-bold text-gray-700 dark:text-gray-200 flex items-center space-x-1.5">
                                  <Phone className="w-3.5 h-3.5 text-indigo-500" />
                                  <span>Phone Number</span>
                                </label>
                              </div>
                              <input
                                type="text"
                                value={editFormData.phone_number}
                                onChange={(e) => setEditFormData({ ...editFormData, phone_number: e.target.value })}
                                placeholder="+91..."
                                className="w-full h-11 px-3.5 bg-gray-50 dark:bg-navy-950 border border-gray-200 dark:border-navy-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none shadow-sm transition-all"
                              />
                            </div>

                            {/* Date of Birth */}
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between h-5 mb-1.5">
                                <label className="text-xs font-bold text-gray-700 dark:text-gray-200 flex items-center space-x-1.5">
                                  <Calendar className="w-3.5 h-3.5 text-teal-500" />
                                  <span>Date of Birth</span>
                                  <span className="text-[10px] text-gray-400 font-normal">(Optional)</span>
                                </label>
                                {editFormData.date_of_birth && (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-md border border-teal-500/20">
                                      {new Date(editFormData.date_of_birth).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => { setEditFormData(prev => ({ ...prev, date_of_birth: '' })); setEditDobDisplay(''); }}
                                      className="text-[10px] text-gray-400 hover:text-rose-500 font-bold transition-colors cursor-pointer"
                                      title="Clear Date"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                )}
                              </div>
                              <div className="relative">
                                <input
                                  type="text"
                                  placeholder="DD/MM/YYYY (e.g. 15/08/1990)"
                                  maxLength={10}
                                  value={editDobDisplay}
                                  onChange={(e) => handleEditDobInput(e.target.value)}
                                  className="w-full h-11 px-3.5 bg-gray-50 dark:bg-navy-950 border border-gray-200 dark:border-navy-700 rounded-2xl text-xs font-mono font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none shadow-sm transition-all"
                                />
                              </div>
                            </div>

                            {/* Designation */}
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between h-5 mb-1.5">
                                <label className="text-xs font-bold text-gray-700 dark:text-gray-200 flex items-center space-x-1.5">
                                  <Briefcase className="w-3.5 h-3.5 text-amber-500" />
                                  <span>Designation</span>
                                </label>
                              </div>
                              <input
                                type="text"
                                value={editFormData.mentoring_role}
                                onChange={(e) => setEditFormData({ ...editFormData, mentoring_role: e.target.value })}
                                placeholder="e.g. AP/CSE"
                                className="w-full h-11 px-3.5 bg-gray-50 dark:bg-navy-950 border border-gray-200 dark:border-navy-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none shadow-sm transition-all"
                              />
                            </div>
                          </div>
                        </div>
                      </section>

                      {/* 3. DEPARTMENT / ACADEMIC BRANCH */}
                      <section className="space-y-3">
                        <div className="flex items-center space-x-2 border-b border-gray-100 dark:border-navy-800 pb-2">
                          <span className="flex items-center justify-center w-5 h-5 rounded-lg bg-cyan-500 text-white font-black text-[10px] shadow-sm shadow-cyan-500/30">3</span>
                          <h4 className="text-xs font-black text-cyan-600 dark:text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-cyan-500" /> Department / Academic Branch
                          </h4>
                        </div>

                        <CustomDropdown
                          id="edit-staff-dept-select"
                          label=""
                          options={[
                            {
                              value: '0',
                              label: 'All Departments (Institution-wide)',
                              badge: 'ALL',
                              badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
                              icon: Building2
                            },
                            ...(departments.length > 0 ? departments : DEFAULT_DEPARTMENTS).map(d => ({
                              value: String(d.id),
                              label: d.code ? `${d.name} (${d.code})` : d.name,
                              badge: d.code || 'DEPT',
                              badgeColor: d.code === 'CSE(CS)'
                                ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
                                : 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
                              icon: Building2
                            }))
                          ]}
                          value={String(editFormData.department_id)}
                          onChange={(val) => setEditFormData({ ...editFormData, department_id: val })}
                          icon={Building2}
                          align="left"
                        />
                      </section>

                      {/* 5. ACCOUNT STATUS */}
                      <section className="space-y-4">
                        <div className="flex items-center space-x-2 border-b border-gray-100 dark:border-navy-800 pb-2">
                          <span className="flex items-center justify-center w-5 h-5 rounded-lg bg-emerald-500 text-white font-black text-[10px] shadow-sm shadow-emerald-500/30">5</span>
                          <h4 className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                            <ShieldAlert className="w-3.5 h-3.5 text-emerald-500" /> Account Status
                          </h4>
                        </div>

                        <div className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 dark:bg-navy-950 border border-gray-200 dark:border-navy-800">
                          <div>
                            <span className="text-sm font-black text-gray-900 dark:text-white block mb-0.5">
                              {editFormData.is_active ? 'Active' : 'Suspended'}
                            </span>
                            <span className="text-xs text-gray-500 font-medium">
                              {editFormData.is_active ? 'Staff member can log in and access assigned resources.' : 'Account is disabled. Access is completely revoked.'}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setEditFormData({ ...editFormData, is_active: !editFormData.is_active })}
                            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${editFormData.is_active
                              ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20 hover:bg-emerald-400'
                              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 hover:bg-rose-500/20'
                              }`}
                          >
                            {editFormData.is_active ? '🟢 Mark Suspended' : '🔴 Mark Active'}
                          </button>
                        </div>
                      </section>

                    </div>

                    {/* RIGHT COLUMN */}
                    <div className="space-y-8">
                      {/* 2. INSTITUTIONAL ROLE */}
                      <section className="space-y-4">
                        <div className="flex items-center space-x-2 border-b border-gray-100 dark:border-navy-800 pb-2">
                          <span className="flex items-center justify-center w-5 h-5 rounded-lg bg-purple-500 text-white font-black text-[10px] shadow-sm shadow-purple-500/30">2</span>
                          <h4 className="text-xs font-black text-purple-600 dark:text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Shield className="w-3.5 h-3.5 text-purple-500" /> Institutional Role
                          </h4>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          {[
                            { id: 'Faculty', label: 'Faculty Mentor', desc: 'Assigned student scope', icon: GraduationCap },
                            { id: 'Staff', label: 'Staff Mentor', desc: 'Assigned student scope', icon: User },
                            { id: 'HOD', label: 'Department HOD', desc: 'Department-wide scope', icon: Building2 },
                            { id: 'Admin', label: 'Administrator', desc: 'Global institutional scope', icon: Key }
                          ].map(r => {
                            const Icon = r.icon;
                            const isSelected = editFormData.role === r.id;
                            return (
                              <button
                                key={r.id}
                                type="button"
                                onClick={() => setEditFormData({ ...editFormData, role: r.id })}
                                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-2 ${isSelected
                                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10 shadow-sm ring-2 ring-brand-500/20'
                                  : 'border-gray-200 dark:border-navy-700 hover:border-gray-300 dark:hover:border-navy-600 bg-gray-50 dark:bg-navy-950'
                                  }`}
                              >
                                <div className="flex items-center justify-between">
                                  <Icon className={`w-4 h-4 ${isSelected ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400'}`} />
                                  {isSelected && <CheckCircle className="w-4 h-4 text-brand-500" />}
                                </div>
                                <div>
                                  <div className={`text-xs font-black ${isSelected ? 'text-brand-700 dark:text-brand-300' : 'text-gray-700 dark:text-gray-300'}`}>{r.label}</div>
                                  <div className={`text-[10px] mt-0.5 font-medium ${isSelected ? 'text-brand-600/70 dark:text-brand-400/70' : 'text-gray-500 dark:text-gray-400'}`}>{r.desc}</div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </section>

                      {/* 4. STUDENT SCOPE */}
                      <section className="space-y-4">
                        <div className="flex items-center space-x-2 border-b border-gray-100 dark:border-navy-800 pb-2">
                          <span className="flex items-center justify-center w-5 h-5 rounded-lg bg-indigo-500 text-white font-black text-[10px] shadow-sm shadow-indigo-500/30">4</span>
                          <h4 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Database className="w-3.5 h-3.5 text-indigo-500" /> Student Scope
                          </h4>
                        </div>

                        <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-500/20 space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="text-xs font-black text-indigo-800 dark:text-indigo-300">
                                {editFormData.role === 'Admin' ? 'Global Institutional Scope' :
                                  editFormData.role === 'HOD' ? 'Department-wide Scope' :
                                    'Assigned Students Scope'}
                              </div>
                              <div className="text-[11px] text-indigo-600/70 dark:text-indigo-400/70 font-medium mt-1">
                                {editFormData.role === 'Admin' ? 'Has full access to all students across all departments.' :
                                  editFormData.role === 'HOD' ? 'Has access to all students within the selected department.' :
                                    'Has access only to explicitly assigned students.'}
                              </div>
                            </div>
                            <div className="px-2.5 py-1 rounded-lg bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 text-xs font-black">
                              {['Faculty', 'Staff'].includes(editFormData.role) ? `${editingStaff.assigned_students_count || 0} Assigned` : 'All Students'}
                            </div>
                          </div>

                          {['Faculty', 'Staff'].includes(editFormData.role) && (
                            <button type="button" onClick={() => notify.info("Manage Assigned Students triggered.", "", { category: "SYSTEM" })} className="w-full py-2 rounded-xl bg-white dark:bg-navy-800 border border-indigo-200 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400 text-xs font-bold shadow-sm hover:bg-indigo-50 dark:hover:bg-navy-700 transition-colors cursor-pointer">
                              Manage Assigned Students
                            </button>
                          )}
                        </div>
                      </section>

                      {/* 6. PERMISSIONS */}
                      <section className="space-y-4">
                        <div className="flex items-center space-x-2 border-b border-gray-100 dark:border-navy-800 pb-2">
                          <span className="flex items-center justify-center w-5 h-5 rounded-lg bg-amber-500 text-white font-black text-[10px] shadow-sm shadow-amber-500/30">6</span>
                          <h4 className="text-xs font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Key className="w-3.5 h-3.5 text-amber-500" /> Role Permissions
                          </h4>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {[
                            { label: 'View Student Profiles', roles: ['Faculty', 'Staff', 'HOD', 'Admin'] },
                            { label: 'View LeetCode Progress', roles: ['Faculty', 'Staff', 'HOD', 'Admin'] },
                            { label: 'View Analytics', roles: ['HOD', 'Admin'] },
                            { label: 'Assign Students', roles: ['HOD', 'Admin'] },
                            { label: 'Export Reports', roles: ['HOD', 'Admin'] },
                            { label: 'Manage Staff', roles: ['Admin'] },
                          ].map((perm, idx) => {
                            const hasPerm = perm.roles.includes(editFormData.role);
                            return (
                              <div key={idx} className={`flex items-center gap-2.5 p-2.5 rounded-xl border ${hasPerm ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20' : 'bg-gray-50 dark:bg-navy-950 border-gray-100 dark:border-navy-800 opacity-60'}`}>
                                {hasPerm ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <X className="w-4 h-4 text-gray-400" />}
                                <span className={`text-[11px] font-bold ${hasPerm ? 'text-emerald-800 dark:text-emerald-400' : 'text-gray-500'}`}>
                                  {perm.label}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        <div className="text-[10px] text-gray-400 italic">
                          * Permissions are automatically inherited from the assigned Institutional Role.
                        </div>
                      </section>
                    </div>

                    {/* BOTTOM WIDE ROW: 7. ACCOUNT INFO & 8. AUDIT */}
                    <div className="col-span-1 lg:col-span-2 grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4 border-t border-gray-100 dark:border-navy-800">

                      {/* 7. ACCOUNT INFORMATION */}
                      <section className="space-y-4">
                        <div className="flex items-center space-x-2 border-b border-gray-100 dark:border-navy-800 pb-2">
                          <span className="flex items-center justify-center w-5 h-5 rounded-lg bg-violet-500 text-white font-black text-[10px] shadow-sm shadow-violet-500/30">7</span>
                          <h4 className="text-xs font-black text-violet-600 dark:text-violet-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Lock className="w-3.5 h-3.5 text-violet-500" /> Account Information
                          </h4>
                        </div>

                        <div className="bg-violet-50/40 dark:bg-violet-950/20 rounded-2xl p-4 border border-violet-100/60 dark:border-violet-800/30 space-y-3">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-gray-500">Created Date</span>
                            <span className="font-medium text-gray-900 dark:text-gray-200">
                              {editingStaff.created_at ? new Date(editingStaff.created_at).toLocaleDateString() : 'N/A'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-gray-500">Last Login</span>
                            <span className="font-medium text-gray-900 dark:text-gray-200">
                              {editingStaff.last_login ? new Date(editingStaff.last_login).toLocaleString() : 'Never'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-gray-500">Email Verification</span>
                            <span className="font-bold text-emerald-500">Verified</span>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-gray-500">MFA Status</span>
                            <span className={`font-bold ${editingStaff.is_2fa_enabled ? 'text-emerald-500' : 'text-amber-500'}`}>
                              {editingStaff.is_2fa_enabled ? 'Enabled' : 'Disabled'}
                            </span>
                          </div>

                          {/* Reset Temporary Password Action */}
                          <div className="pt-2 border-t border-violet-100/60 dark:border-violet-800/30">
                            <button
                              type="button"
                              onClick={handleResetTemporaryPassword}
                              disabled={isResettingPassword}
                              className="w-full py-2.5 px-3.5 rounded-xl bg-violet-600 hover:bg-violet-700 active:scale-98 text-white text-xs font-black shadow-md shadow-violet-500/20 flex items-center justify-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
                            >
                              {isResettingPassword ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  <span>Generating Temporary Password...</span>
                                </>
                              ) : (
                                <>
                                  <KeyRound className="w-4 h-4" />
                                  <span>Reset & Send Temporary Password</span>
                                </>
                              )}
                            </button>

                            {tempPasswordResult && (
                              <div className="mt-3 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 space-y-2 animate-fade-in">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-black text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Temporary Password Active
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(tempPasswordResult.password);
                                      notify.info('Copied!', 'Temporary password copied to clipboard.', { category: 'SYSTEM' });
                                    }}
                                    className="px-2 py-1 text-[10px] font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-colors cursor-pointer"
                                  >
                                    Copy Password
                                  </button>
                                </div>
                                <div className="flex items-center justify-between text-xs bg-white dark:bg-navy-900 px-3 py-1.5 rounded-lg border border-emerald-100 dark:border-navy-700">
                                  <span className="font-mono font-black text-emerald-700 dark:text-emerald-300 tracking-wider">
                                    {tempPasswordResult.password}
                                  </span>
                                  <span className="text-[10px] text-gray-500 dark:text-gray-400">
                                    Dispatched to {tempPasswordResult.email}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </section>

                      {/* 8. AUDIT / ACTIVITY */}
                      <section className="space-y-4">
                        <div className="flex items-center space-x-2 border-b border-gray-100 dark:border-navy-800 pb-2">
                          <span className="flex items-center justify-center w-5 h-5 rounded-lg bg-rose-500 text-white font-black text-[10px] shadow-sm shadow-rose-500/30">8</span>
                          <h4 className="text-xs font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Activity className="w-3.5 h-3.5 text-rose-500" /> Audit / Recent Activity
                          </h4>
                        </div>

                        <div className="bg-rose-50/40 dark:bg-rose-950/20 rounded-2xl p-4 border border-rose-100/60 dark:border-rose-800/30 space-y-4 max-h-[160px] overflow-y-auto custom-scrollbar">
                          {/* Fake activity feed since audit logs might not be attached to staff object by default */}
                          <div className="flex items-start gap-3">
                            <div className="p-1.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 mt-0.5">
                              <Activity className="w-3 h-3" />
                            </div>
                            <div>
                              <div className="text-[11px] font-bold text-gray-900 dark:text-white">Account Created</div>
                              <div className="text-[10px] text-gray-500">{editingStaff.created_at ? new Date(editingStaff.created_at).toLocaleString() : 'System'}</div>
                            </div>
                          </div>
                          {editingStaff.last_login && (
                            <div className="flex items-start gap-3">
                              <div className="p-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 mt-0.5">
                                <CheckCircle className="w-3 h-3" />
                              </div>
                              <div>
                                <div className="text-[11px] font-bold text-gray-900 dark:text-white">Successful Login</div>
                                <div className="text-[10px] text-gray-500">{new Date(editingStaff.last_login).toLocaleString()}</div>
                              </div>
                            </div>
                          )}
                        </div>
                      </section>

                    </div>
                  </div>
                </form>

                {/* Modal Footer / Buttons */}
                <div className="p-4 border-t border-gray-100 dark:border-navy-800 bg-gray-50/50 dark:bg-navy-800/50 shrink-0 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    disabled={isUpdating}
                    onClick={() => setEditingStaff(null)}
                    className="px-6 py-2.5 rounded-xl text-xs font-bold bg-white dark:bg-navy-900 border border-gray-200 dark:border-navy-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-navy-800 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEditStaff}
                    disabled={isUpdating}
                    className="px-6 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white shadow-lg shadow-indigo-500/30 flex items-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isUpdating ? (
                      <>
                        <RefreshCcw className="w-4 h-4 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Save Changes</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </GlobalModalBackdrop>
          )}

          {/* Centered Unique Delete Confirmation Modal */}
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
        </>,
        document.body
      )}
    </div>
  );
};
