import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, Calendar, Shield, Key, CheckCircle, Building2, History, CreditCard, Clock, LogIn, KeyRound, Award, GraduationCap } from 'lucide-react';
import api from '../../services/api';
import { CustomDropdown } from '../CustomDropdown';
import { GlobalModalBackdrop } from '../GlobalModalBackdrop';

interface EditStaffModalProps {
  staff: any;
  onClose: () => void;
  onSuccess: () => void;
  departments: any[];
  staffList: any[];
  notify: any;
}

export const EditStaffModal: React.FC<EditStaffModalProps> = ({ staff, onClose, onSuccess, departments, staffList, notify }) => {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone_number: '',
    role: 'Faculty Mentor',
    department_id: '0',
    academic_year: '',
    designation: '',
    date_of_birth: '',
    reporting_manager: '',
    enforce_mfa: false
  });
  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (staff) {
      setFormData({
        full_name: staff.full_name || staff.username || '',
        email: staff.email || '',
        phone_number: staff.phone_number || '',
        role: staff.role || 'Faculty Mentor',
        department_id: staff.department_id ? String(staff.department_id) : '0',
        academic_year: staff.academic_year || '',
        designation: staff.designation || '',
        date_of_birth: staff.date_of_birth || '',
        reporting_manager: staff.reporting_manager || '',
        enforce_mfa: staff.enforce_mfa || false
      });
      setIsActive(staff.is_active ?? true);
    }
  }, [staff]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const rawDeptId = parseInt(formData.department_id, 10);
      const deptIdToSend = (rawDeptId > 0 && !['Administrator', 'Super Admin'].includes(formData.role))
        ? rawDeptId
        : null;

      const payload = {
        email: formData.email,
        phone_number: formData.phone_number || undefined,
        role: formData.role,
        department_id: deptIdToSend,
        academic_year: formData.academic_year || undefined,
        designation: formData.designation || undefined,
        date_of_birth: formData.date_of_birth || undefined,
        reporting_manager: formData.reporting_manager || undefined,
        is_active: isActive
      };
      
      await api.put(`/admin/staff/${staff.id}`, payload);
      notify.success(`Staff account updated successfully!`, '', { category: 'ADMIN' });
      onSuccess();
    } catch (err: any) {
      console.error(err);
      notify.error(err.response?.data?.detail || 'Failed to update staff account.', '', { category: 'ADMIN' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = () => notify.info('Password reset triggered.', '', { category: 'ADMIN' });
  const handleSendResetLink = () => notify.info('Reset link sent to email.', '', { category: 'ADMIN' });

  return (
    <GlobalModalBackdrop isOpen={true} onClose={onClose} className="flex items-center justify-center p-4 bg-navy-950/60 overflow-y-auto">
      <div className="bg-slate-50 dark:bg-navy-900 rounded-[2rem] w-full max-w-[850px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-white/20 dark:border-navy-800 animate-fade-in-up">
        <div className="px-8 py-6 border-b border-gray-100 dark:border-navy-800 flex items-center justify-between shrink-0 bg-slate-50 dark:bg-navy-950/50 rounded-t-[2rem]">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center">
              <User className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                Edit Staff Member
                <span className={`text-[10px] px-2 py-1 rounded-md font-bold uppercase tracking-wider ${isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                  {isActive ? 'ACTIVE' : 'SUSPENDED'}
                </span>
              </h2>
              <p className="text-sm font-mono text-gray-500 mt-1">ID: {staff.institutional_id || staff.username}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 transition-colors">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7 space-y-8">
              
              {/* 1. Staff Info */}
              <section className="space-y-4">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center border-b border-gray-200 dark:border-navy-700 pb-2">
                  <User className="w-4 h-4 mr-2 text-blue-500" /> 1. Staff Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700 dark:text-gray-200">Full Name *</label>
                    <input type="text" value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} className="w-full h-11 px-3.5 rounded-xl border border-gray-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-sm font-semibold" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700 dark:text-gray-200">Username <span className="text-[10px] text-gray-400 font-normal">(Locked)</span></label>
                    <input type="text" value={staff.username} disabled className="w-full h-11 px-3.5 rounded-xl border border-gray-200 dark:border-navy-700 bg-gray-100 dark:bg-navy-800 text-sm font-semibold text-gray-500 cursor-not-allowed opacity-70" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700 dark:text-gray-200">Official College Email *</label>
                    <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full h-11 px-3.5 rounded-xl border border-gray-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-sm font-semibold" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700 dark:text-gray-200">Phone Number *</label>
                    <input type="tel" value={formData.phone_number} onChange={e => setFormData({...formData, phone_number: e.target.value})} className="w-full h-11 px-3.5 rounded-xl border border-gray-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-sm font-semibold" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700 dark:text-gray-200">Date of Birth</label>
                    <input type="text" value={formData.date_of_birth} onChange={e => setFormData({...formData, date_of_birth: e.target.value})} className="w-full h-11 px-3.5 rounded-xl border border-gray-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-sm font-semibold" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700 dark:text-gray-200">Designation</label>
                    <input type="text" value={formData.designation} onChange={e => setFormData({...formData, designation: e.target.value})} className="w-full h-11 px-3.5 rounded-xl border border-gray-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-sm font-semibold" />
                  </div>
                </div>
              </section>

              {/* 2. Institutional Role & Scope */}
              <section className="space-y-4">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center border-b border-gray-200 dark:border-navy-700 pb-2">
                  <Building2 className="w-4 h-4 mr-2 text-indigo-500" /> 2. Institutional Role & Scope
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5 col-span-2">
                    <CustomDropdown
                      id="edit-modal-role-select"
                      label="Institutional Role *"
                      options={[
                        { value: 'Faculty Mentor', label: 'Faculty Mentor', badge: 'FAC', badgeColor: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20', icon: GraduationCap },
                        { value: 'Staff Mentor', label: 'Staff Mentor', badge: 'STF', badgeColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20', icon: User },
                        { value: 'Department HOD', label: 'Department HOD', badge: 'HOD', badgeColor: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20', icon: Building2 },
                        { value: 'Administrator', label: 'Administrator', badge: 'ADM', badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20', icon: Key },
                        { value: 'Super Admin', label: 'Super Admin', badge: 'ROOT', badgeColor: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20', icon: Shield }
                      ]}
                      value={formData.role}
                      onChange={(val) => setFormData({ ...formData, role: val })}
                      icon={Shield}
                      align="left"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <CustomDropdown
                      id="edit-modal-dept-select"
                      label="Department *"
                      options={[
                        { value: '0', label: 'All Departments', badge: 'ALL', badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20', icon: Building2 },
                        ...departments.map(d => ({
                          value: String(d.id),
                          label: d.code ? `${d.name} (${d.code})` : d.name,
                          badge: d.code || 'DEPT',
                          badgeColor: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
                          icon: Building2
                        }))
                      ]}
                      value={['Administrator', 'Super Admin'].includes(formData.role) ? '0' : formData.department_id}
                      onChange={(val) => setFormData({ ...formData, department_id: val })}
                      icon={Building2}
                      align="left"
                    />
                  </div>
                  {['Faculty Mentor', 'Staff Mentor'].includes(formData.role) && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-700 dark:text-gray-200">Academic Year Cohort *</label>
                      <input type="text" value={formData.academic_year} onChange={e => setFormData({...formData, academic_year: e.target.value})} className="w-full h-11 px-3.5 rounded-xl border border-gray-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-sm font-semibold" />
                    </div>
                  )}
                  <div className="space-y-1.5 col-span-2">
                    <label className="text-xs font-bold text-gray-700 dark:text-gray-200">Student Scope (Auto)</label>
                    <div className="w-full h-11 px-3.5 flex items-center rounded-xl border border-gray-200 dark:border-navy-700 bg-gray-100 dark:bg-navy-800 text-sm font-semibold text-gray-500">
                      {['Administrator', 'Super Admin'].includes(formData.role) ? 'All Students (Global)' : formData.role === 'Department HOD' ? 'Department-wide' : 'Assigned Students Only'}
                    </div>
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <CustomDropdown
                      id="edit-modal-manager-select"
                      label="Reporting Manager / HOD *"
                      options={[
                        { value: '', label: 'Select Reporting Manager...', badge: 'NONE' },
                        ...staffList.filter(s => s.id !== staff.id).map(s => ({
                          value: String(s.id),
                          label: s.username,
                          badge: s.role || 'STAFF',
                          icon: User
                        }))
                      ]}
                      value={formData.reporting_manager}
                      onChange={(val) => setFormData({ ...formData, reporting_manager: val })}
                      icon={User}
                      align="left"
                    />
                  </div>
                </div>
              </section>
              
              {/* 3. Account Status */}
              <section className="space-y-4">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center border-b border-gray-200 dark:border-navy-700 pb-2">
                  <Shield className="w-4 h-4 mr-2 text-emerald-500" /> 3. Account Status
                </h3>
                <div className="bg-gray-50 dark:bg-navy-950/50 rounded-xl p-4 border border-gray-200 dark:border-navy-800 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white">Active Status</h4>
                    <p className="text-xs text-gray-500">Controls access to the platform.</p>
                  </div>
                  <button type="button" onClick={() => setIsActive(!isActive)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${isActive ? 'bg-rose-100 text-rose-600 hover:bg-rose-200' : 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'}`}>
                    {isActive ? 'Mark Suspended' : 'Reactivate Account'}
                  </button>
                </div>
              </section>

            </div>

            <div className="lg:col-span-5 space-y-8">
              {/* 5. Security Actions */}
              <section className="bg-rose-50/50 dark:bg-rose-950/10 rounded-2xl p-6 border border-rose-100 dark:border-rose-900/30">
                <h3 className="text-sm font-bold text-rose-900 dark:text-rose-400 mb-5 flex items-center">
                  <KeyRound className="w-4 h-4 mr-2 text-rose-500" /> 5. Security Actions
                </h3>
                <div className="space-y-3">
                  <button type="button" onClick={handleResetPassword} className="w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-navy-900 rounded-xl border border-rose-200 dark:border-rose-800 hover:bg-rose-50 transition-colors">
                    <span className="text-sm font-bold text-gray-700 dark:text-gray-200">Force Password Reset</span>
                    <Key className="w-4 h-4 text-rose-500" />
                  </button>
                  <button type="button" onClick={handleSendResetLink} className="w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-navy-900 rounded-xl border border-rose-200 dark:border-rose-800 hover:bg-rose-50 transition-colors">
                    <span className="text-sm font-bold text-gray-700 dark:text-gray-200">Send Reset Link to Email</span>
                    <Mail className="w-4 h-4 text-rose-500" />
                  </button>
                  <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-navy-900 rounded-xl border border-gray-200 dark:border-navy-700">
                    <div>
                      <span className="text-sm font-bold text-gray-700 dark:text-gray-200">Enforce MFA</span>
                      <p className="text-[10px] text-gray-500">Require 2FA on next login</p>
                    </div>
                    <input type="checkbox" checked={formData.enforce_mfa} onChange={e => setFormData({...formData, enforce_mfa: e.target.checked})} className="w-4 h-4 text-indigo-600 rounded" />
                  </div>
                </div>
              </section>

              {/* 6. Account Information */}
              <section className="bg-slate-50 dark:bg-navy-950/50 rounded-2xl p-6 border border-slate-200 dark:border-navy-800">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center">
                  <CreditCard className="w-4 h-4 mr-2 text-slate-500" /> 6. Account Information
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-navy-700">
                    <span className="text-xs text-slate-500 font-semibold">Created Date</span>
                    <span className="text-xs font-bold text-slate-900 dark:text-white">{staff.created_at ? new Date(staff.created_at).toLocaleDateString() : 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-navy-700">
                    <span className="text-xs text-slate-500 font-semibold">Last Login</span>
                    <span className="text-xs font-bold text-slate-900 dark:text-white">Just now (Mock)</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-navy-700">
                    <span className="text-xs text-slate-500 font-semibold">Email Verification</span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">VERIFIED</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500 font-semibold">MFA Status</span>
                    <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">DISABLED</span>
                  </div>
                </div>
              </section>

              {/* 7. Audit / Recent Activity */}
              <section className="bg-slate-50 dark:bg-navy-950/50 rounded-2xl p-6 border border-slate-200 dark:border-navy-800">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center">
                  <History className="w-4 h-4 mr-2 text-slate-500" /> 7. Audit / Recent Activity
                </h3>
                <div className="space-y-4 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
                  <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className="flex items-center justify-center w-4 h-4 rounded-full border-2 border-white bg-indigo-500 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow"></div>
                    <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                      <div className="flex items-center justify-between space-x-2 mb-1">
                        <div className="font-bold text-xs text-slate-900">Account Created</div>
                        <time className="font-mono text-[10px] text-slate-500">{staff.created_at ? new Date(staff.created_at).toLocaleDateString() : 'N/A'}</time>
                      </div>
                      <div className="text-[10px] text-slate-500">System (Auto)</div>
                    </div>
                  </div>
                </div>
              </section>

            </div>
          </div>
        </div>

        <div className="px-8 py-5 border-t border-gray-100 dark:border-navy-800 flex items-center justify-end space-x-3 shrink-0 bg-gray-50/50 dark:bg-navy-900/50 rounded-b-[2rem]">
          <button onClick={onClose} className="h-11 px-6 rounded-xl font-bold text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-navy-800 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={isSubmitting} className="h-11 px-8 rounded-xl font-bold text-sm text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-sm flex items-center">
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </GlobalModalBackdrop>
  );
};
