import React, { useState, useEffect } from 'react';
import { Search, UserPlus, Edit2, Shield, Ban, CheckCircle, RefreshCcw, UserX, AlertCircle, ArrowRight } from 'lucide-react';
import api from '../../services/api';
import { useNotification } from '../../context/NotificationContext';

export const StaffManagement: React.FC = () => {
  const [staffList, setStaffList] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [creationSuccess, setCreationSuccess] = useState<any>(null);
  const { notify } = useNotification();

  const [formData, setFormData] = useState({
    institutional_id: '',
    username: '',
    email: '',
    password: '',
    role: 'Staff',
    department_id: '',
    academic_year: '',
    mentoring_role: '',
    date_of_birth: '',
    require_password_change: false
  });

  const [passwordStrengthError, setPasswordStrengthError] = useState('');

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

  const fetchDepartments = async () => {
    try {
      const res = await api.get('/departments');
      if (res.data) setDepartments(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/staff-list');
      if (res.data) {
        setStaffList(res.data);
      }
    } catch (err) {
      notify.error('Failed to load staff list.', '', { category: 'ADMIN' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordStrengthError) {
      notify.error('Please fix password strength requirements before continuing.');
      return;
    }
    
    try {
      await api.post('/admin/staff', {
        institutional_id: formData.institutional_id || undefined,
        username: formData.username,
        email: formData.email,
        password: formData.password || 'Staff@123',
        role: formData.role,
        department_id: formData.department_id ? parseInt(formData.department_id) : null,
        academic_year: formData.academic_year || undefined,
        mentoring_role: formData.mentoring_role || undefined,
        date_of_birth: formData.date_of_birth || undefined,
        require_password_change: formData.require_password_change
      });
      setCreationSuccess(formData);
      // Don't close modal immediately, show success screen
      fetchStaff();
    } catch (err: any) {
      notify.error(err.response?.data?.detail || 'Failed to create staff account.', '', { category: 'ADMIN' });
    }
  };

  const handleToggleStatus = async (staffId: number, currentStatus: boolean) => {
    try {
      await api.patch(`/admin/staff/${staffId}`, { is_active: !currentStatus });
      notify.success(`Staff account ${currentStatus ? 'deactivated' : 'activated'}.`, '', { category: 'ADMIN' });
      fetchStaff();
    } catch (err: any) {
      notify.error(err.response?.data?.detail || 'Failed to update status.', '', { category: 'ADMIN' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Staff Management</h2>
          <p className="text-sm text-gray-500">Manage institutional staff accounts and roles.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl hover:bg-brand-700 font-bold text-sm shadow-sm transition-all"
        >
          <UserPlus className="w-4 h-4" /> Add Staff Member
        </button>
      </div>

      <div className="bg-white dark:bg-navy-800 rounded-2xl border border-gray-200 dark:border-navy-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 dark:bg-navy-900/50 text-gray-600 dark:text-gray-400 font-bold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="px-6 py-4">Institutional ID</th>
                <th className="px-6 py-4">Username / Email</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-navy-700">
              {staffList.map((staff) => (
                <tr key={staff.id} className="hover:bg-gray-50 dark:hover:bg-navy-750/50 transition-colors">
                  <td className="px-6 py-4 font-mono text-xs font-bold text-gray-700 dark:text-gray-300">
                    {staff.institutional_id || 'N/A'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-gray-900 dark:text-white">{staff.username}</div>
                    <div className="text-xs text-gray-500">{staff.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400">
                      {staff.role || 'Staff'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {staff.is_active ? (
                      <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                        <CheckCircle className="w-3.5 h-3.5" /> Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-rose-500 dark:text-rose-400 text-xs font-bold">
                        <Ban className="w-3.5 h-3.5" /> Suspended
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button
                      onClick={() => handleToggleStatus(staff.id, staff.is_active)}
                      className={`p-2 rounded-lg transition-colors ${staff.is_active ? 'hover:bg-rose-100 hover:text-rose-600 text-gray-400' : 'hover:bg-emerald-100 hover:text-emerald-600 text-gray-400'}`}
                      title={staff.is_active ? "Suspend Account" : "Activate Account"}
                    >
                      {staff.is_active ? <UserX className="w-4 h-4" /> : <RefreshCcw className="w-4 h-4" />}
                    </button>
                  </td>
                </tr>
              ))}
              {staffList.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500 text-sm">
                    No staff members found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in overflow-y-auto">
          <div className="bg-white dark:bg-navy-900 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border border-gray-200 dark:border-navy-700 my-8">
            <div className="p-6 border-b border-gray-100 dark:border-navy-800 flex justify-between items-center bg-gray-50/50 dark:bg-navy-800/50">
              <h3 className="text-xl font-extrabold text-gray-900 dark:text-white flex items-center gap-3">
                <Shield className="w-6 h-6 text-brand-500" /> 
                {creationSuccess ? 'Staff Account Created' : 'Create Institutional Account'}
              </h3>
              <button onClick={() => { setShowModal(false); setCreationSuccess(null); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <UserX className="w-5 h-5" />
              </button>
            </div>
            
            {creationSuccess ? (
              <div className="p-8 text-center space-y-6">
                <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-10 h-10 text-emerald-500" />
                </div>
                <h4 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">
                  Account Ready
                </h4>
                <div className="bg-gray-50 dark:bg-navy-800 p-6 rounded-2xl border border-gray-100 dark:border-navy-700 max-w-md mx-auto text-left space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-500 text-sm font-medium">Name:</span>
                    <span className="text-gray-900 dark:text-white font-bold">{creationSuccess.username}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 text-sm font-medium">Role:</span>
                    <span className="text-brand-600 dark:text-brand-400 font-bold">{creationSuccess.role}</span>
                  </div>
                  <div className="flex justify-between items-center pt-3 border-t border-gray-200 dark:border-navy-700">
                    <span className="text-gray-500 text-sm font-medium">Assigned Students:</span>
                    <span className="px-3 py-1 bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400 rounded-lg font-black text-sm">
                      0 Students
                    </span>
                  </div>
                </div>
                
                <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 p-4 rounded-xl text-left flex gap-3 max-w-md mx-auto">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    This account currently has no student access. You must allocate students to this staff member for them to view dashboard data.
                  </p>
                </div>
                
                <div className="pt-6 flex gap-4 max-w-md mx-auto">
                  <button onClick={() => { setShowModal(false); setCreationSuccess(null); }} className="flex-1 px-5 py-3 rounded-xl font-bold bg-gray-100 dark:bg-navy-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-navy-700 transition-colors">
                    Close
                  </button>
                  <button onClick={() => { setShowModal(false); setCreationSuccess(null); document.querySelector<HTMLButtonElement>('[data-section="allocation"]')?.click(); }} className="flex-1 px-5 py-3 rounded-xl font-bold bg-brand-600 text-white hover:bg-brand-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-brand-500/30">
                    Open Allocation <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6 space-y-8 max-h-[75vh] overflow-y-auto custom-scrollbar">
                
                {/* SECTION 1: ROLE & ACADEMIC COHORT FIRST */}
                <div className="space-y-4">
                  <h4 className="text-xs font-black text-brand-500 tracking-wider uppercase border-b border-gray-100 dark:border-navy-700 pb-2">
                    1. Role &amp; Academic Scope (Select First)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Role *</label>
                      <select value={formData.role} onChange={(e) => handleRoleChange(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-navy-700 bg-gray-50 dark:bg-navy-800 text-sm focus:ring-2 focus:ring-brand-500 outline-none font-semibold">
                        <option value="Faculty">Faculty</option>
                        <option value="Staff">Staff</option>
                        <option value="HOD">HOD</option>
                        <option value="Admin">Admin</option>
                        <option value="Super Admin">Super Admin</option>
                      </select>
                    </div>
                    
                    {['Staff', 'Faculty', 'HOD'].includes(formData.role) && (
                      <div>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Department *</label>
                        <select value={formData.department_id} onChange={(e) => handleDeptChange(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-navy-700 bg-gray-50 dark:bg-navy-800 text-sm focus:ring-2 focus:ring-brand-500 outline-none">
                          <option value="">Select Department</option>
                          {departments.map(d => (
                            <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                          ))}
                        </select>
                      </div>
                    )}
                    
                    {['Staff', 'Faculty', 'HOD'].includes(formData.role) && (
                      <div>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Academic Year</label>
                        <select value={formData.academic_year} onChange={(e) => setFormData({ ...formData, academic_year: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-navy-700 bg-gray-50 dark:bg-navy-800 text-sm focus:ring-2 focus:ring-brand-500 outline-none">
                          <option value="">N/A</option>
                          <option value="I Year">I Year</option>
                          <option value="II Year">II Year</option>
                          <option value="III Year">III Year</option>
                          <option value="IV Year">IV Year</option>
                        </select>
                      </div>
                    )}

                    {['Staff', 'Faculty'].includes(formData.role) && (
                      <div>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Mentoring Role</label>
                        <select value={formData.mentoring_role} onChange={(e) => setFormData({ ...formData, mentoring_role: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-navy-700 bg-gray-50 dark:bg-navy-800 text-sm focus:ring-2 focus:ring-brand-500 outline-none">
                          <option value="">Select Role</option>
                          <option value="Faculty Mentor">Faculty Mentor</option>
                          <option value="Class Mentor">Class Mentor</option>
                          <option value="Department Staff">Department Staff</option>
                          <option value="Contest Coordinator">Contest Coordinator</option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>

                {/* SECTION 2: IDENTITY DETAILS */}
                <div className="space-y-4">
                  <h4 className="text-xs font-black text-brand-500 tracking-wider uppercase border-b border-gray-100 dark:border-navy-700 pb-2">
                    2. User Identity &amp; ID Details
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">Institutional ID</label>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, institutional_id: autoGenerateInstId(formData.department_id, formData.role) })}
                          className="text-[10px] text-brand-600 dark:text-brand-400 font-bold hover:underline"
                        >
                          Auto-Generate
                        </button>
                      </div>
                      <input 
                        type="text" 
                        placeholder="e.g. NEC-CSECS-FAC-001 or any custom ID" 
                        value={formData.institutional_id} 
                        onChange={(e) => setFormData({ ...formData, institutional_id: e.target.value })} 
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-navy-700 bg-gray-50 dark:bg-navy-800 text-sm focus:ring-2 focus:ring-brand-500 outline-none font-mono" 
                      />
                      <p className="text-[10px] text-gray-400 mt-1">Manual custom ID or auto-generated by Department.</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Username *</label>
                      <input type="text" required value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-navy-700 bg-gray-50 dark:bg-navy-800 text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Official Email *</label>
                      <input type="email" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-navy-700 bg-gray-50 dark:bg-navy-800 text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Date of Birth *</label>
                      <input type="date" required value={formData.date_of_birth} onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-navy-700 bg-gray-50 dark:bg-navy-800 text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
                    </div>
                  </div>
                </div>

                {/* SECTION C: ACCOUNT SECURITY */}
                <div className="space-y-4">
                  <h4 className="text-xs font-black text-brand-500 tracking-wider uppercase border-b border-gray-100 dark:border-navy-700 pb-2">
                    Account Security
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Initial Password *</label>
                      <input type="text" placeholder="Minimum 12 chars, upper, lower, num, spec" value={formData.password} onChange={(e) => {
                        const pwd = e.target.value;
                        setFormData({ ...formData, password: pwd });
                        if (pwd && (pwd.length < 12 || !/[A-Z]/.test(pwd) || !/[a-z]/.test(pwd) || !/[0-9]/.test(pwd) || !/[!@#$%^&*(),.?":{}|<>]/.test(pwd))) {
                          setPasswordStrengthError('Needs 12+ chars, 1 uppercase, 1 lowercase, 1 number, 1 special char.');
                        } else {
                          setPasswordStrengthError('');
                        }
                      }} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-navy-700 bg-gray-50 dark:bg-navy-800 text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
                      {passwordStrengthError && <p className="text-[10px] text-rose-500 mt-1 font-semibold">{passwordStrengthError}</p>}
                    </div>
                  </div>
                  <label className="flex items-center gap-3 mt-4 p-3 border border-gray-200 dark:border-navy-700 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-navy-800 transition-colors">
                    <input type="checkbox" checked={formData.require_password_change} onChange={(e) => setFormData({ ...formData, require_password_change: e.target.checked })} className="w-4 h-4 text-brand-600 rounded border-gray-300 focus:ring-brand-600" />
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Require password change on first login</span>
                  </label>
                </div>
                
                <div className="pt-6 flex gap-4 border-t border-gray-100 dark:border-navy-700">
                  <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-5 py-3 rounded-xl font-bold text-sm bg-gray-100 dark:bg-navy-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-navy-700 transition-colors">
                    Cancel
                  </button>
                  <button type="button" onClick={handleCreateStaff} className="flex-1 px-5 py-3 rounded-xl font-bold text-sm bg-brand-600 text-white hover:bg-brand-700 transition-colors shadow-lg shadow-brand-500/20">
                    Create Account
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
