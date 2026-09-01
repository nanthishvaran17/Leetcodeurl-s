import React, { useState, useMemo } from 'react';
import { User, Shield, CheckCircle, Building2, Key, Check, Loader2, FileCheck, X, Briefcase, ChevronRight, Hash, Mail, Phone, Calendar, Search } from 'lucide-react';
import api from '../../services/api';
import { CustomDropdown, DropdownOption } from '../CustomDropdown';
import { GlobalModalBackdrop } from '../GlobalModalBackdrop';
import { studentLiveStore, useStudentStoreVersion } from '../../stores/studentLiveStore';

interface CreateStaffModalProps {
  onClose: () => void;
  onSuccess: () => void;
  departments: any[];
  staffList: any[];
  notify: any;
}

export const CreateStaffModal: React.FC<CreateStaffModalProps> = ({ onClose, onSuccess, departments, staffList, notify }) => {
  const storeVersion = useStudentStoreVersion(); // Triggers re-render when live data changes

  // Derive dynamic Academic Year options from live students
  const academicYearOptions = useMemo(() => {
    const students = Object.values(studentLiveStore.getAllEntities());
    const years = new Set<string>();
    students.forEach((s: any) => {
      if (s.academic_year) {
        years.add(s.academic_year.trim());
      }
    });
    
    // Sort logic (e.g., "I", "II", "III", "IV" or "2024-2028")
    const sortedYears = Array.from(years).sort((a, b) => {
      if (a === b) return 0;
      return a > b ? 1 : -1;
    });

    const options: DropdownOption[] = sortedYears.map(y => ({
      value: y,
      label: y.length <= 4 ? `${y} Year` : y,
      badge: y.substring(0, 5),
    }));

    return options;
  }, [storeVersion]);

  // Transform Departments into DropdownOptions
  const departmentOptions: DropdownOption[] = useMemo(() => {
    return departments.map(d => ({
      value: String(d.id),
      label: d.name,
      badge: d.code || 'DEPT'
    }));
  }, [departments]);

  const staffOptions: DropdownOption[] = useMemo(() => {
    return [
      { value: 'none', label: 'None (Top Level)' },
      ...staffList.map(s => ({
        value: String(s.id),
        label: s.full_name || s.username,
        sublabel: s.role,
      }))
    ];
  }, [staffList]);

  const roleOptions: DropdownOption[] = [
    { value: 'Faculty Mentor', label: 'Faculty Mentor', badge: 'FAC' },
    { value: 'Staff Mentor', label: 'Staff Mentor', badge: 'STF' },
    { value: 'Department HOD', label: 'Department HOD', badge: 'HOD' },
    { value: 'Administrator', label: 'Administrator', badge: 'ADM' },
    { value: 'Super Admin', label: 'Super Admin', badge: 'S-ADM' }
  ];

  const statusOptions: DropdownOption[] = [
    { value: 'Active', label: 'Active', badge: 'ON' },
    { value: 'Suspended', label: 'Suspended', badge: 'OFF', badgeColor: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30' }
  ];

  const [formData, setFormData] = useState({
    institutional_id: '',
    username: '',
    full_name: '',
    email: '',
    phone_number: '',
    password: '',
    confirm_password: '',
    role: 'Faculty Mentor',
    department_id: departments.length > 0 ? String(departments[0].id) : '1',
    academic_year: '',
    designation: '',
    date_of_birth: '',
    require_password_change: true,
    reporting_manager: 'none',
    account_status: 'Active',
    consent_checked: false
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [idProofFile, setIdProofFile] = useState<File | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!formData.full_name.trim()) errors.full_name = 'Required';
    if (!formData.username.trim()) errors.username = 'Required';
    if (!formData.email.trim()) errors.email = 'Required';
    if (!formData.phone_number.trim()) errors.phone_number = 'Required';
    
    // Check academic year for mentor roles
    if (['Faculty Mentor', 'Staff Mentor'].includes(formData.role) && !formData.academic_year) {
      errors.academic_year = 'Required for Mentors';
    }

    if (formData.password && formData.password !== formData.confirm_password) {
      errors.confirm_password = 'Passwords do not match';
    }

    if (!formData.consent_checked) errors.consent = 'Required';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      notify.error('Please fix the highlighted errors before submitting.', '', { category: 'ADMIN' });
      return;
    }

    setIsSubmitting(true);
    setFormErrors({});

    try {
      const isGlobalAdmin = ['Administrator', 'Super Admin'].includes(formData.role);
      const rawDeptId = formData.department_id ? parseInt(formData.department_id, 10) : 0;
      const deptIdToSend = (rawDeptId > 0 && !isGlobalAdmin) ? rawDeptId : null;

      const payload = {
        institutional_id: formData.institutional_id?.trim() || undefined,
        username: formData.username.trim(),
        full_name: formData.full_name.trim(),
        email: formData.email.trim().toLowerCase(),
        phone_number: formData.phone_number.trim(),
        password: formData.password?.trim() || undefined,
        role: formData.role,
        department_id: deptIdToSend,
        academic_year: formData.academic_year || undefined,
        designation: formData.designation || undefined,
        date_of_birth: formData.date_of_birth || undefined,
        is_active: formData.account_status === 'Active',
        require_password_change: true
      };

      await api.post('/admin/staff', payload);
      notify.success(`Staff account '${formData.username}' created successfully!`, '', { category: 'ADMIN' });
      onSuccess();
    } catch (err: any) {
      console.error(err);
      notify.error(err.response?.data?.detail || 'Failed to create staff account', '', { category: 'ADMIN' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isGlobalRole = ['Administrator', 'Super Admin'].includes(formData.role);

  return (
    <GlobalModalBackdrop isOpen={true} onClose={onClose} className="flex items-center justify-center p-4 sm:p-6">
      <div className="bg-slate-50 dark:bg-navy-900 rounded-[2rem] w-full max-w-[850px] shadow-2xl flex flex-col max-h-full overflow-hidden border border-white/20 dark:border-navy-800">
        
        {/* Fixed Header */}
        <div className="px-6 py-5 bg-white dark:bg-navy-900 border-b border-gray-200 dark:border-navy-800 flex items-center justify-between shrink-0 z-10 shadow-sm">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center border border-brand-100 dark:border-brand-500/20">
              <Shield className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white tracking-tight">Create Institutional Account</h2>
              <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 font-semibold mt-0.5">Provision a new staff access profile</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:text-gray-200 dark:hover:bg-navy-800 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar bg-slate-50 dark:bg-navy-950/30">
          <form id="create-staff-form" onSubmit={handleCreate} className="space-y-6 max-w-[100%]">
            
            {/* SECTION 1: Role & Academic Scope */}
            <section className="bg-white dark:bg-navy-900/80 rounded-2xl p-5 border border-gray-200 dark:border-navy-800 shadow-sm">
              <h3 className="text-xs font-bold text-brand-700 dark:text-brand-300 mb-4 flex items-center uppercase tracking-wider bg-brand-50 dark:bg-brand-500/10 p-2.5 rounded-xl">
                <Building2 className="w-4 h-4 mr-2 text-brand-500" /> 1. Role & Academic Scope
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                <div className="space-y-1.5 relative z-[105]">
                  <CustomDropdown
                    label="Staff Role"
                    options={roleOptions}
                    value={formData.role}
                    onChange={(val) => setFormData({...formData, role: val})}
                    icon={Briefcase}
                  />
                </div>

                <div className="space-y-1.5 relative z-[104]">
                  <CustomDropdown
                    label="Department"
                    options={departmentOptions}
                    value={isGlobalRole ? '' : formData.department_id}
                    onChange={(val) => setFormData({...formData, department_id: val})}
                    placeholder={isGlobalRole ? "All Departments (Global)" : "Select Department..."}
                    icon={Building2}
                  />
                  {isGlobalRole && <p className="text-[10px] text-gray-500 ml-1">Disabled for Admins</p>}
                </div>

                <div className="space-y-1.5 relative z-[103]">
                  <CustomDropdown
                    label="Academic Year"
                    options={academicYearOptions}
                    value={isGlobalRole ? '' : formData.academic_year}
                    onChange={(val) => setFormData({...formData, academic_year: val})}
                    placeholder={isGlobalRole ? "Global Scope" : "Select Year Cohort..."}
                    icon={Calendar}
                  />
                  {formErrors.academic_year && <p className="text-[10px] text-red-500 ml-1 font-semibold">{formErrors.academic_year}</p>}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-extrabold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Mentoring Designation</label>
                  <input 
                    type="text" 
                    value={formData.designation} 
                    onChange={e => setFormData({...formData, designation: e.target.value})} 
                    className="w-full h-11 px-4 rounded-2xl border border-gray-200 dark:border-navy-700 bg-gray-50 dark:bg-navy-800 text-sm font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all" 
                    
                    autoComplete="off"
                  />
                </div>

              </div>
            </section>

            {/* SECTION 2: User Identity & Credentials */}
            <section className="bg-white dark:bg-navy-900/80 rounded-2xl p-5 border border-gray-200 dark:border-navy-800 shadow-sm">
              <h3 className="text-xs font-bold text-indigo-700 dark:text-indigo-300 mb-4 flex items-center uppercase tracking-wider bg-indigo-50 dark:bg-indigo-500/10 p-2.5 rounded-xl">
                <User className="w-4 h-4 mr-2 text-indigo-500" /> 2. User Identity & Credentials
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="block text-[10px] font-extrabold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Full Legal Name *</label>
                  <input 
                    type="text" 
                    value={formData.full_name} 
                    onChange={e => {
                      const val = e.target.value;
                      setFormData({...formData, full_name: val, username: val.toLowerCase().replace(/\s+/g, '.')});
                    }} 
                    className={`w-full h-11 px-4 rounded-2xl border ${formErrors.full_name ? 'border-red-400 ring-2 ring-red-500/10' : 'border-gray-200 dark:border-navy-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20'} bg-gray-50 dark:bg-navy-800 text-sm font-bold text-gray-900 dark:text-white outline-none transition-all`} 
                    
                    autoComplete="name"
                  />
                  {formErrors.full_name && <p className="text-[10px] text-red-500 ml-1 font-semibold">{formErrors.full_name}</p>}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-extrabold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center"><Hash className="w-3 h-3 mr-1"/> Username *</label>
                  <input 
                    type="text" 
                    value={formData.username} 
                    onChange={e => setFormData({...formData, username: e.target.value})} 
                    className={`w-full h-11 px-4 rounded-2xl border ${formErrors.username ? 'border-red-400 ring-2 ring-red-500/10' : 'border-gray-200 dark:border-navy-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20'} bg-gray-50 dark:bg-navy-800 text-sm font-bold text-gray-900 dark:text-white outline-none transition-all`} 
                    
                    autoComplete="username"
                  />
                  {formErrors.username && <p className="text-[10px] text-red-500 ml-1 font-semibold">{formErrors.username}</p>}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-extrabold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center"><Mail className="w-3 h-3 mr-1"/> Official Email *</label>
                  <input 
                    type="email" 
                    value={formData.email} 
                    onChange={e => setFormData({...formData, email: e.target.value})} 
                    className={`w-full h-11 px-4 rounded-2xl border ${formErrors.email ? 'border-red-400 ring-2 ring-red-500/10' : 'border-gray-200 dark:border-navy-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20'} bg-gray-50 dark:bg-navy-800 text-sm font-bold text-gray-900 dark:text-white outline-none transition-all`} 
                    
                    autoComplete="email"
                  />
                  {formErrors.email && <p className="text-[10px] text-red-500 ml-1 font-semibold">{formErrors.email}</p>}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-extrabold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center"><Phone className="w-3 h-3 mr-1"/> Phone Number *</label>
                  <input 
                    type="tel" 
                    value={formData.phone_number} 
                    onChange={e => setFormData({...formData, phone_number: e.target.value})} 
                    className={`w-full h-11 px-4 rounded-2xl border ${formErrors.phone_number ? 'border-red-400 ring-2 ring-red-500/10' : 'border-gray-200 dark:border-navy-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20'} bg-gray-50 dark:bg-navy-800 text-sm font-bold text-gray-900 dark:text-white outline-none transition-all`} 
                    
                    autoComplete="tel"
                  />
                  {formErrors.phone_number && <p className="text-[10px] text-red-500 ml-1 font-semibold">{formErrors.phone_number}</p>}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-extrabold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center"><Calendar className="w-3 h-3 mr-1"/> Date of Birth</label>
                  <input 
                    type="text" 
                    value={formData.date_of_birth} 
                    onChange={e => setFormData({...formData, date_of_birth: e.target.value})} 
                    className="w-full h-11 px-4 rounded-2xl border border-gray-200 dark:border-navy-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 bg-gray-50 dark:bg-navy-800 text-sm font-bold text-gray-900 dark:text-white outline-none transition-all" 
                    placeholder="YYYY-MM-DD"
                    autoComplete="off"
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label className="block text-[10px] font-extrabold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Institutional ID</label>
                  <div className="flex space-x-2">
                    <input 
                      type="text" 
                      value={formData.institutional_id} 
                      onChange={e => setFormData({...formData, institutional_id: e.target.value})} 
                      className="flex-1 h-11 px-4 rounded-2xl border border-gray-200 dark:border-navy-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 bg-gray-50 dark:bg-navy-800 text-sm font-bold text-gray-900 dark:text-white outline-none transition-all" 
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const randomHex = Math.floor(Math.random() * 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
                        const prefix = formData.department_id ? formData.department_id.toUpperCase().substring(0, 3) : 'GLB';
                        const rolePrefix = formData.role === 'Administrator' || formData.role === 'Super Admin' ? 'ADM' : 'FAC';
                        setFormData({...formData, institutional_id: `NEC-${prefix}-${rolePrefix}-${randomHex}`});
                      }}
                      className="h-11 px-4 rounded-2xl bg-brand-100 dark:bg-brand-500/20 text-brand-700 dark:text-brand-300 text-xs font-bold hover:bg-brand-200 dark:hover:bg-brand-500/30 transition-all flex items-center shrink-0"
                    >
                      <Sparkles className="w-3 h-3 mr-1.5" /> Generate ID
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* SECTION 3: Staff Verification */}
            <section className="bg-white dark:bg-navy-900/80 rounded-2xl p-5 border border-gray-200 dark:border-navy-800 shadow-sm">
              <h3 className="text-xs font-bold text-emerald-700 dark:text-emerald-300 mb-4 flex items-center uppercase tracking-wider bg-emerald-50 dark:bg-emerald-500/10 p-2.5 rounded-xl">
                <FileCheck className="w-4 h-4 mr-2 text-emerald-500" /> 3. Staff Verification
              </h3>
              <div className="space-y-1.5">
                <label className="block text-[10px] font-extrabold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Employee ID Proof / Document (Optional)</label>
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-gray-300 dark:border-navy-700 border-dashed rounded-2xl cursor-pointer bg-gray-50 dark:bg-navy-800 hover:bg-gray-100 dark:hover:bg-navy-700/80 transition-all">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <FileCheck className="w-6 h-6 mb-2 text-gray-400" />
                      <p className="mb-1 text-[11px] font-bold text-gray-500 dark:text-gray-400">
                        {idProofFile ? idProofFile.name : <><span className="text-brand-500 font-extrabold">Click to upload</span> or drag and drop</>}
                      </p>
                      <p className="text-[9px] text-gray-500 font-semibold uppercase tracking-wider">PDF, JPG or PNG (MAX. 5MB)</p>
                    </div>
                    <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setIdProofFile(e.target.files?.[0] || null)} />
                  </label>
                </div>
              </div>
            </section>

            {/* SECTION 4: Security & Password */}
            <section className="bg-white dark:bg-navy-900/80 rounded-2xl p-5 border border-gray-200 dark:border-navy-800 shadow-sm">
              <h3 className="text-xs font-bold text-rose-700 dark:text-rose-300 mb-4 flex items-center uppercase tracking-wider bg-rose-50 dark:bg-rose-500/10 p-2.5 rounded-xl">
                <Key className="w-4 h-4 mr-2 text-rose-500" /> 4. Security & Password
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-extrabold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Initial Password</label>
                  <input 
                    type="password" 
                    value={formData.password} 
                    onChange={e => setFormData({...formData, password: e.target.value})} 
                    className="w-full h-11 px-4 rounded-2xl border border-gray-200 dark:border-navy-700 bg-gray-50 dark:bg-navy-800 text-sm font-bold text-gray-900 dark:text-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all" 
                    
                    autoComplete="new-password"
                  />
                </div>
                
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-extrabold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Confirm Password</label>
                  <input 
                    type="password" 
                    value={formData.confirm_password} 
                    onChange={e => setFormData({...formData, confirm_password: e.target.value})} 
                    className={`w-full h-11 px-4 rounded-2xl border ${formErrors.confirm_password ? 'border-red-400 ring-2 ring-red-500/10' : 'border-gray-200 dark:border-navy-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20'} bg-gray-50 dark:bg-navy-800 text-sm font-bold text-gray-900 dark:text-white outline-none transition-all`} 
                    
                    autoComplete="new-password"
                  />
                  {formErrors.confirm_password && <p className="text-[10px] text-red-500 ml-1 font-semibold">{formErrors.confirm_password}</p>}
                </div>

                <div className="col-span-1 sm:col-span-2">
                  <div className="flex items-center space-x-3 p-3 rounded-xl bg-gray-50 dark:bg-navy-800 border border-gray-200 dark:border-navy-700">
                    <div className="w-5 h-5 rounded flex items-center justify-center bg-gray-200 dark:bg-navy-700">
                      <Check className="w-3 h-3 text-gray-500" />
                    </div>
                    <span className="text-[11px] font-bold text-gray-600 dark:text-gray-400">Force password reset on first login (Always ON for security compliance)</span>
                  </div>
                </div>
              </div>
            </section>

            {/* SECTION 5: Account Status & Agreement */}
            <section className="bg-brand-50/40 dark:bg-navy-900/80 rounded-2xl p-5 border border-brand-100 dark:border-navy-800 shadow-sm">
              <h3 className="text-xs font-bold text-sky-700 dark:text-sky-300 mb-4 flex items-center uppercase tracking-wider bg-sky-50 dark:bg-sky-500/10 p-2.5 rounded-xl">
                <CheckCircle className="w-4 h-4 mr-2 text-sky-500" /> 5. Account Status & Agreement
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-1.5 relative z-[101]">
                    <CustomDropdown
                      label="Account Status"
                      options={statusOptions}
                      value={formData.account_status}
                      onChange={(val) => setFormData({...formData, account_status: val})}
                    />
                  </div>

                  <div className="space-y-1.5 relative z-[100]">
                    <CustomDropdown
                      label="Reporting Manager (Optional)"
                      options={staffOptions}
                      value={formData.reporting_manager}
                      onChange={(val) => setFormData({...formData, reporting_manager: val})}
                      placeholder="Select reporting manager..."
                      icon={Search}
                    />
                  </div>
                  
                  <div className="flex items-start space-x-3 mt-4 pt-2">
                    <input 
                      type="checkbox" 
                      id="consent-check"
                      checked={formData.consent_checked} 
                      onChange={e => setFormData({...formData, consent_checked: e.target.checked})} 
                      className="mt-1 w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer" 
                    />
                    <label htmlFor="consent-check" className="cursor-pointer select-none">
                      <p className="text-sm font-bold text-gray-900 dark:text-white">Consent & Compliance Acknowledgment *</p>
                      <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">I verify that this staff member is authorized to access student academic records and agree to adhere strictly to the institution's data privacy & security policies.</p>
                      {formErrors.consent && <p className="text-[10px] text-red-500 mt-1 font-bold">{formErrors.consent}</p>}
                    </label>
                  </div>
                </div>

                <div className="bg-white dark:bg-navy-950/60 rounded-2xl p-4 border border-gray-200 dark:border-navy-800 h-full flex flex-col">
                  <h4 className="text-[10px] font-extrabold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Role Permissions Map</h4>
                  <div className="space-y-2.5 flex-1 overflow-y-auto custom-scrollbar max-h-48 pr-2">
                    {['View Student Profiles', 'View LeetCode Progress', 'View Gamification Analytics'].map((perm, i) => (
                      <div key={i} className="flex items-center space-x-2.5 opacity-90">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300">{perm}</span>
                      </div>
                    ))}
                    {isGlobalRole && ['Assign Interventions', 'Export Global Reports', 'Manage Staff Accounts'].map((perm, i) => (
                       <div key={'g'+i} className="flex items-center space-x-2.5 opacity-90">
                        <CheckCircle className="w-3.5 h-3.5 text-brand-500 shrink-0" />
                        <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300">{perm}</span>
                      </div>
                    ))}
                    {!isGlobalRole && (
                      <div className="flex items-center space-x-2.5 opacity-60 mt-3 pt-3 border-t border-gray-100 dark:border-navy-800">
                        <X className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 line-through">Global Admin Actions</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>

          </form>
        </div>

        {/* Fixed Footer Actions */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-navy-900 border-t border-gray-200 dark:border-navy-800 flex items-center justify-end space-x-3 shrink-0 z-10">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-gray-600 hover:text-gray-900 bg-white hover:bg-gray-100 dark:bg-navy-800 dark:text-gray-300 dark:hover:text-white dark:hover:bg-navy-700 border border-gray-200 dark:border-navy-700 transition-all cursor-pointer"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            form="create-staff-form"
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 dark:disabled:bg-brand-800 transition-all shadow-md shadow-brand-500/20 flex items-center cursor-pointer active:scale-95"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                Create Account
                <ChevronRight className="w-4 h-4 ml-1.5" />
              </>
            )}
          </button>
        </div>

      </div>
    </GlobalModalBackdrop>
  );
};
