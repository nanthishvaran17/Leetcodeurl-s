import React, { useState, useEffect, useMemo } from 'react';
import { Search, UserPlus, Edit2, Shield, Ban, CheckCircle, RefreshCcw, UserX, AlertCircle, ArrowRight, Building2, GraduationCap, Award, Sparkles, Key, Mail, User, Calendar, Check, X, Trash2 } from 'lucide-react';
import api from '../../services/api';
import { useNotification } from '../../context/NotificationContext';
import { CustomDropdown, DropdownOption } from '../CustomDropdown';

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
    role: 'Faculty',
    department_id: '1',
    is_active: true
  });
  const { notify } = useNotification();

  const handleOpenEditModal = (staff: any) => {
    setEditingStaff(staff);
    setEditFormData({
      id: staff.id,
      institutional_id: staff.institutional_id || '',
      username: staff.username || '',
      email: staff.email || '',
      role: staff.role || 'Faculty',
      department_id: String(staff.department_id || departments[0]?.id || 1),
      is_active: staff.is_active ?? true
    });
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
      const payload = {
        username: editFormData.username.trim(),
        email: editFormData.email.trim().toLowerCase(),
        role: editFormData.role,
        department_id: ['Staff', 'Faculty', 'HOD'].includes(editFormData.role) ? parseInt(editFormData.department_id, 10) : null,
        is_active: editFormData.is_active
      };

      await api.patch(`/admin/staff/${editingStaff.id}`, payload);
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
    password: '',
    role: 'Faculty',
    department_id: '1',
    academic_year: '',
    mentoring_role: '',
    date_of_birth: '',
    require_password_change: false
  });

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
    // Only digits and slashes
    let cleaned = val.replace(/[^0-9/]/g, '');

    // Auto add slashes: DD/MM/YYYY
    if (cleaned.length === 2 && !cleaned.includes('/') && !dobDisplay.endsWith('/')) {
      cleaned = cleaned + '/';
    } else if (cleaned.length === 5 && cleaned.split('/').length === 2 && !dobDisplay.endsWith('/')) {
      cleaned = cleaned + '/';
    }

    if (cleaned.length > 10) cleaned = cleaned.slice(0, 10);
    setDobDisplay(cleaned);

    // If fully typed DD/MM/YYYY
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
      password: '',
      role: 'Faculty',
      department_id: String(departments[0]?.id || 1),
      academic_year: '',
      mentoring_role: '',
      date_of_birth: '',
      require_password_change: false
    });
    setDobDisplay('');
    setCreationSuccess(null);
    setPasswordStrengthError('');
  };

  const [showConfirmCreate, setShowConfirmCreate] = useState(false);

  const handleCreateStaff = (e?: React.FormEvent | React.MouseEvent) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!formData.username || !formData.username.trim()) {
      notify.error('Please enter a username.', '', { category: 'ADMIN' });
      return;
    }
    if (!formData.email || !formData.email.trim()) {
      notify.error('Please enter an official email.', '', { category: 'ADMIN' });
      return;
    }
    if (!formData.email.includes('@')) {
      notify.error('Please enter a valid official email address.', '', { category: 'ADMIN' });
      return;
    }
    setShowConfirmCreate(true);
  };

  const confirmAndSubmitStaff = async () => {
    const deptIdNumber = formData.department_id
      ? parseInt(String(formData.department_id), 10)
      : (departments[0]?.id || 1);

    setSubmitting(true);
    try {
      const payload = {
        institutional_id: formData.institutional_id?.trim() || undefined,
        username: formData.username.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password?.trim() || 'Staff@123456!',
        role: formData.role || 'Faculty',
        department_id: ['Staff', 'Faculty', 'HOD'].includes(formData.role) ? deptIdNumber : null,
        academic_year: formData.academic_year || undefined,
        mentoring_role: formData.mentoring_role || undefined,
        date_of_birth: formData.date_of_birth || undefined,
        require_password_change: formData.require_password_change ?? false
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
      notify.success(`Staff account '${deletingStaff.username}' deleted successfully.`, '', { category: 'ADMIN' });
      setDeletingStaff(null);
      await fetchStaff();
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in overflow-y-auto">
          <div className="bg-white dark:bg-navy-900 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border border-gray-200 dark:border-navy-700 my-8">
            <div className="p-6 border-b border-gray-100 dark:border-navy-800 flex justify-between items-center bg-gray-50/50 dark:bg-navy-800/50">
              <h3 className="text-xl font-extrabold text-gray-900 dark:text-white flex items-center gap-3">
                <Shield className="w-6 h-6 text-brand-500" />
                Create Institutional Account
              </h3>
              <button
                type="button"
                onClick={() => { setShowModal(false); resetForm(); }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer p-1"
              >
                <UserX className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="p-6 space-y-5 max-h-[78vh] overflow-y-auto custom-scrollbar">

              {/* SECTION 1: ROLE & ACADEMIC COHORT FIRST */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-500/5 via-white to-gray-50 dark:from-indigo-950/30 dark:via-navy-900/80 dark:to-navy-950/80 border border-indigo-200/50 dark:border-indigo-800/40 shadow-sm space-y-4">
                <div className="flex items-center space-x-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-indigo-500 text-white font-black text-xs shadow-md shadow-indigo-500/30">1</span>
                  <h4 className="text-xs font-black text-indigo-700 dark:text-indigo-300 tracking-wider uppercase">
                    Role &amp; Academic Scope (Select First)
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <CustomDropdown
                    id="staff-role-select"
                    label="Staff Role *"
                    labelClassName="text-xs font-bold text-gray-700 dark:text-gray-200 flex items-center justify-between h-5 mb-1.5"
                    options={[
                      { value: 'Faculty', label: 'Faculty', badge: 'FAC', badgeColor: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20', icon: Shield },
                      { value: 'Staff', label: 'Staff', badge: 'STF', badgeColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20', icon: Shield },
                      { value: 'HOD', label: 'HOD (Head of Dept)', badge: 'HOD', badgeColor: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20', icon: Award },
                      { value: 'Admin', label: 'Admin (System Admin)', badge: 'ADM', badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20', icon: Shield },
                      { value: 'Super Admin', label: 'Super Admin', badge: 'ROOT', badgeColor: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20', icon: Shield }
                    ]}
                    value={formData.role}
                    onChange={(val) => handleRoleChange(val)}
                    icon={Shield}
                    align="left"
                  />

                  {['Staff', 'Faculty', 'HOD'].includes(formData.role) ? (
                    <CustomDropdown
                      id="staff-dept-select"
                      label="Department *"
                      labelClassName="text-xs font-bold text-gray-700 dark:text-gray-200 flex items-center justify-between h-5 mb-1.5"
                      options={(departments.length > 0 ? departments : DEFAULT_DEPARTMENTS).map(d => ({
                        value: String(d.id),
                        label: d.name,
                        badge: d.code || 'DEPT',
                        badgeColor: d.code === 'CSE(CS)'
                          ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
                          : 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
                        icon: Building2
                      }))}
                      value={formData.department_id}
                      onChange={(val) => handleDeptChange(val)}
                      icon={Building2}
                      align="left"
                    />
                  ) : (
                    <div className="space-y-1.5">
                      <div className="h-5 mb-1.5 text-xs font-bold text-gray-400 dark:text-gray-500">Department Scope</div>
                      <div className="w-full h-11 px-4 flex items-center rounded-2xl border border-dashed border-gray-300 dark:border-navy-700 text-xs font-semibold text-gray-400 bg-gray-50/50 dark:bg-navy-950/40">
                        Institution-wide System Access
                      </div>
                    </div>
                  )}

                  {['Staff', 'Faculty', 'HOD'].includes(formData.role) && (
                    <CustomDropdown
                      id="staff-year-select"
                      label="Academic Year Cohort"
                      labelClassName="text-xs font-bold text-gray-700 dark:text-gray-200 flex items-center justify-between h-5 mb-1.5"
                      options={[
                        { value: '', label: 'All Academic Years (N/A)', badge: 'ALL', icon: GraduationCap },
                        { value: 'I Year', label: '1st Year (Batch 2030)', badge: 'I Year', icon: GraduationCap },
                        { value: 'II Year', label: '2nd Year (Batch 2029)', badge: 'II Year', icon: GraduationCap },
                        { value: 'III Year', label: '3rd Year (Batch 2028)', badge: 'III Year', icon: GraduationCap },
                        { value: 'IV Year', label: 'Final Year (Batch 2027)', badge: 'IV Year', icon: GraduationCap }
                      ]}
                      value={formData.academic_year}
                      onChange={(val) => setFormData({ ...formData, academic_year: val })}
                      icon={GraduationCap}
                      align="left"
                    />
                  )}

                  {['Staff', 'Faculty'].includes(formData.role) && (
                    <CustomDropdown
                      id="staff-mentor-select"
                      label="Mentoring Designation"
                      labelClassName="text-xs font-bold text-gray-700 dark:text-gray-200 flex items-center justify-between h-5 mb-1.5"
                      options={[
                        { value: '', label: 'Select Role (Optional)', badge: 'NONE' },
                        { value: 'Faculty Mentor', label: 'Faculty Mentor', badge: 'MENTOR', icon: Award },
                        { value: 'Class Mentor', label: 'Class Mentor', badge: 'CLASS', icon: Award },
                        { value: 'Department Staff', label: 'Department Staff', badge: 'DEPT', icon: Award },
                        { value: 'Contest Coordinator', label: 'Contest Coordinator', badge: 'CONTEST', icon: Award }
                      ]}
                      value={formData.mentoring_role}
                      onChange={(val) => setFormData({ ...formData, mentoring_role: val })}
                      icon={Award}
                      align="left"
                    />
                  )}
                </div>
              </div>

              {/* SECTION 2: IDENTITY DETAILS */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500/5 via-white to-gray-50 dark:from-emerald-950/30 dark:via-navy-900/80 dark:to-navy-950/80 border border-emerald-200/50 dark:border-emerald-800/40 shadow-sm space-y-4">
                <div className="flex items-center space-x-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-emerald-500 text-white font-black text-xs shadow-md shadow-emerald-500/30">2</span>
                  <h4 className="text-xs font-black text-emerald-700 dark:text-emerald-300 tracking-wider uppercase">
                    User Identity &amp; Credentials
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Institutional ID */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between h-5 mb-1.5">
                      <label className="text-xs font-bold text-gray-700 dark:text-gray-200 flex items-center space-x-1.5">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Institutional ID</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, institutional_id: autoGenerateInstId(formData.department_id, formData.role) })}
                        className="inline-flex items-center space-x-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-0.5 rounded-md transition-all cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Auto-Generate</span>
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="e.g. NEC-CSECS-FAC-001 or custom"
                      value={formData.institutional_id}
                      onChange={(e) => setFormData({ ...formData, institutional_id: e.target.value })}
                      className="w-full h-11 px-3.5 rounded-2xl border border-gray-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-xs font-mono font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none shadow-sm transition-all"
                    />
                    <p className="text-[10px] text-gray-400">Flexible custom ID or auto-generated by Department.</p>
                  </div>

                  {/* Username */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between h-5 mb-1.5">
                      <label className="text-xs font-bold text-gray-700 dark:text-gray-200 flex items-center space-x-1.5">
                        <User className="w-3.5 h-3.5 text-blue-500" />
                        <span>Username <span className="text-rose-500">*</span></span>
                      </label>
                    </div>
                    <input
                      type="text"
                      placeholder="e.g. jdoe_staff"
                      required
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      className="w-full h-11 px-3.5 rounded-2xl border border-gray-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-xs font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none shadow-sm transition-all"
                    />
                    <p className="text-[10px] text-gray-400">Used for portal authentication and mentions.</p>
                  </div>

                  {/* Email */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between h-5 mb-1.5">
                      <label className="text-xs font-bold text-gray-700 dark:text-gray-200 flex items-center space-x-1.5">
                        <Mail className="w-3.5 h-3.5 text-rose-500" />
                        <span>Official Email <span className="text-rose-500">*</span></span>
                      </label>
                    </div>
                    <input
                      type="email"
                      placeholder="faculty@nandha.edu.in"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full h-11 px-3.5 rounded-2xl border border-gray-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-xs font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none shadow-sm transition-all"
                    />
                    <p className="text-[10px] text-gray-400">Official institutional domain email for OTPs.</p>
                  </div>

                  {/* Date of Birth: Direct Text Input */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between h-5 mb-1.5">
                      <label className="text-xs font-bold text-gray-700 dark:text-gray-200 flex items-center space-x-1.5">
                        <Calendar className="w-3.5 h-3.5 text-teal-500" />
                        <span>Date of Birth</span>
                        <span className="text-[10px] text-gray-400 font-normal">(Optional)</span>
                      </label>
                      {formData.date_of_birth && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-md border border-teal-500/20">
                            {new Date(formData.date_of_birth).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                          <button
                            type="button"
                            onClick={() => { setFormData(prev => ({ ...prev, date_of_birth: '' })); setDobDisplay(''); }}
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
                        value={dobDisplay}
                        onChange={(e) => handleDobInput(e.target.value)}
                        className="w-full h-11 px-3.5 rounded-2xl border border-gray-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-xs font-mono font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none shadow-sm transition-all"
                      />
                    </div>
                    <p className="text-[10px] text-gray-400">Type date directly in DD/MM/YYYY format.</p>
                  </div>
                </div>
              </div>

              {/* SECTION 3: ACCOUNT SECURITY (COMPACT & SIMPLE) */}
              <div className="p-4 rounded-2xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/40 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="flex items-center justify-center w-5 h-5 rounded-lg bg-amber-500 text-white font-black text-[10px] shadow-sm">3</span>
                    <h4 className="text-xs font-black text-amber-700 dark:text-amber-300 tracking-wider uppercase">
                      Account Security
                    </h4>
                  </div>
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono font-bold bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                    Default: Staff@123456!
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
                  {/* Password Input */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700 dark:text-gray-200 flex items-center space-x-1">
                      <Key className="w-3.5 h-3.5 text-amber-500" />
                      <span>Initial Password</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Staff@123456!"
                      value={formData.password}
                      onChange={(e) => {
                        const pwd = e.target.value;
                        setFormData({ ...formData, password: pwd });
                        if (pwd && (pwd.length < 12 || !/[A-Z]/.test(pwd) || !/[a-z]/.test(pwd) || !/[0-9]/.test(pwd) || !/[!@#$%^&*(),.?":{}|<>]/.test(pwd))) {
                          setPasswordStrengthError('Min 12 chars (A-Z, a-z, 0-9, symbol)');
                        } else {
                          setPasswordStrengthError('');
                        }
                      }}
                      className="w-full h-11 px-3.5 rounded-2xl border border-gray-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-xs font-mono font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none shadow-sm transition-all"
                    />
                    {passwordStrengthError && <p className="text-[10px] text-rose-500 font-medium">{passwordStrengthError}</p>}
                  </div>

                  {/* Require change on first login */}
                  <label className="flex items-center gap-2.5 p-3 h-11 bg-white dark:bg-navy-950 border border-gray-200 dark:border-navy-800 rounded-2xl cursor-pointer hover:bg-gray-50 dark:hover:bg-navy-900 transition-colors shadow-sm">
                    <input
                      type="checkbox"
                      checked={formData.require_password_change}
                      onChange={(e) => setFormData({ ...formData, require_password_change: e.target.checked })}
                      className="w-4 h-4 text-amber-600 rounded border-gray-300 focus:ring-amber-500 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                      Force reset on 1st login
                    </span>
                  </label>
                </div>
              </div>

              {/* MODAL FOOTER */}
              <div className="pt-2 flex items-center justify-end space-x-3 border-t border-gray-100 dark:border-navy-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 rounded-xl border border-gray-300 dark:border-navy-700 bg-white dark:bg-navy-900 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-navy-800 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateStaff}
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 via-indigo-600 to-purple-600 hover:from-brand-500 hover:to-purple-500 text-white text-xs font-black shadow-lg shadow-indigo-500/30 flex items-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <RefreshCcw className="w-4 h-4 animate-spin" />
                      <span>Creating Account...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>Create Staff Account</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Centered Create Staff Account Confirmation Modal */}
      {showConfirmCreate && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
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
        </div>
      )}

      {/* Edit Staff Member & Role Modal */}
      {editingStaff && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in overflow-y-auto">
          <div className="bg-white dark:bg-navy-900 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-gray-200 dark:border-navy-700 my-8">
            <div className="p-6 border-b border-gray-100 dark:border-navy-800 flex justify-between items-center bg-gray-50/50 dark:bg-navy-800/50">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-900 dark:text-white">
                    Edit Staff Member
                  </h3>
                  <p className="text-xs text-gray-400 font-mono">
                    {editingStaff.institutional_id || `ID: ${editingStaff.id}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingStaff(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditStaff} className="p-6 space-y-4">
              {/* Role Selector */}
              <div>
                <label className="block text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
                  Institutional Role
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'Faculty', label: 'Faculty Mentor', desc: 'Assigned student scope' },
                    { id: 'Staff', label: 'Staff Mentor', desc: 'Assigned student scope' },
                    { id: 'HOD', label: 'Department HOD', desc: 'Department-wide scope' },
                    { id: 'Admin', label: 'Administrator', desc: 'Global institutional scope' }
                  ].map(r => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setEditFormData({ ...editFormData, role: r.id })}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${editFormData.role === r.id
                          ? 'border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-400 shadow-sm'
                          : 'border-gray-200 dark:border-navy-700 hover:border-gray-300 text-gray-700 dark:text-gray-300'
                        }`}
                    >
                      <div className="text-xs font-black">{r.label}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">{r.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Department Selector (for Faculty, Staff, HOD) */}
              {['Staff', 'Faculty', 'HOD'].includes(editFormData.role) && (
                <div>
                  <label className="block text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                    Department / Academic Branch
                  </label>
                  <select
                    value={editFormData.department_id}
                    onChange={(e) => setEditFormData({ ...editFormData, department_id: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-navy-950 border border-gray-200 dark:border-navy-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500"
                  >
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Username Input */}
              <div>
                <label className="block text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                  Full Name / Username
                </label>
                <input
                  type="text"
                  value={editFormData.username}
                  onChange={(e) => setEditFormData({ ...editFormData, username: e.target.value })}
                  placeholder="Enter staff full name..."
                  className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-navy-950 border border-gray-200 dark:border-navy-700 rounded-xl text-xs font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500"
                  required
                />
              </div>

              {/* Email Input */}
              <div>
                <label className="block text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                  Official College Email
                </label>
                <input
                  type="email"
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  placeholder="name@nandhaengg.org"
                  className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-navy-950 border border-gray-200 dark:border-navy-700 rounded-xl text-xs font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500"
                  required
                />
              </div>

              {/* Active Status Switch */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50 dark:bg-navy-950 border border-gray-200 dark:border-navy-800">
                <div>
                  <span className="text-xs font-black text-gray-900 dark:text-white block">
                    Account Status
                  </span>
                  <span className="text-[11px] text-gray-400">
                    {editFormData.is_active ? 'Account is active and can login.' : 'Account is suspended from signing in.'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setEditFormData({ ...editFormData, is_active: !editFormData.is_active })}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${editFormData.is_active
                      ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-500 border border-rose-500/30'
                    }`}
                >
                  {editFormData.is_active ? '🟢 Active' : '🔴 Suspended'}
                </button>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center gap-3 pt-3 border-t border-gray-100 dark:border-navy-800">
                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={() => setEditingStaff(null)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-gray-100 dark:bg-navy-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-navy-700 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="flex-1 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white shadow-lg shadow-indigo-500/30 flex items-center justify-center space-x-1.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isUpdating ? (
                    <>
                      <RefreshCcw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Centered Unique Delete Confirmation Modal */}
      {deletingStaff && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
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
        </div>
      )}
    </div>
  );
};
