import React, { useState, useMemo } from 'react';
import { User, Shield, CheckCircle, Building2, Key, Check, Loader2, FileCheck, X, Briefcase, ChevronRight, Hash, Mail, Phone, Calendar, Search, Sparkles, Eye, EyeOff, AlertCircle, GraduationCap, ChevronDown } from 'lucide-react';
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

  // Derive dynamic Academic Year options from live students, with fallback if store is empty
  const academicYearOptions = useMemo(() => {
    const students = Object.values(studentLiveStore.getAllEntities());
    const years = new Set<string>();
    
    // Add standard fallbacks so the dropdown is never empty
    years.add('2023-2027');
    years.add('2024-2028');
    years.add('2025-2029');
    years.add('2026-2030');

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
    const opts: DropdownOption[] = [
      {
        value: '0',
        label: 'All Departments (Global)',
        badge: 'ALL',
        badgeColor: 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300 border border-brand-200 dark:border-brand-500/30'
      }
    ];
    
    departments.forEach(d => {
      opts.push({
        value: String(d.id),
        label: d.name,
        badge: d.code || 'DEP',
        badgeColor: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30'
      });
    });
    
    return opts;
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
    { value: 'Faculty Mentor', label: 'Faculty Mentor', badge: 'FAC', sublabel: 'Student mentoring & intervention access', icon: GraduationCap },
    { value: 'Staff Mentor', label: 'Staff Mentor', badge: 'STF', sublabel: 'Student support & academic guidance', icon: User },
    { value: 'Department HOD', label: 'Department HOD', badge: 'HOD', sublabel: 'Department-level academic oversight', icon: Building2 },
    { value: 'Administrator', label: 'Administrator', badge: 'ADM', sublabel: 'Institutional administration & management', icon: Key },
    { value: 'Super Admin', label: 'Super Admin', badge: 'S-ADM', sublabel: 'Full system control & root access', icon: Shield }
  ];

  const getRoleConfig = (role: string) => {
    const map: Record<string, { icon: React.ElementType; color: string; bgColor: string; borderColor: string; badgeColor: string; desc: string }> = {
      'Faculty Mentor': { icon: GraduationCap, color: 'text-indigo-600 dark:text-indigo-400', bgColor: 'bg-indigo-50 dark:bg-indigo-500/10', borderColor: 'border-indigo-200 dark:border-indigo-500/30', badgeColor: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/30', desc: 'Student mentoring & intervention access' },
      'Staff Mentor': { icon: User, color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-50 dark:bg-blue-500/10', borderColor: 'border-blue-200 dark:border-blue-500/30', badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 border-blue-200 dark:border-blue-500/30', desc: 'Student support & academic guidance' },
      'Department HOD': { icon: Building2, color: 'text-purple-600 dark:text-purple-400', bgColor: 'bg-purple-50 dark:bg-purple-500/10', borderColor: 'border-purple-200 dark:border-purple-500/30', badgeColor: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300 border-purple-200 dark:border-purple-500/30', desc: 'Department-level academic oversight' },
      'Administrator': { icon: Key, color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-50 dark:bg-amber-500/10', borderColor: 'border-amber-200 dark:border-amber-500/30', badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 border-amber-200 dark:border-amber-500/30', desc: 'Institutional administration & management' },
      'Super Admin': { icon: Shield, color: 'text-rose-600 dark:text-rose-400', bgColor: 'bg-rose-50 dark:bg-rose-500/10', borderColor: 'border-rose-200 dark:border-rose-500/30', badgeColor: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300 border-rose-200 dark:border-rose-500/30', desc: 'Full system control & root access' },
    };
    return map[role] || map['Faculty Mentor'];
  };

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
    consent_checked: false,
    send_email: true
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [idProofFile, setIdProofFile] = useState<File | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // DOB Formatter
  const handleDOBChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, ''); // strip non-digits
    if (val.length > 8) val = val.substring(0, 8);
    let formatted = val;
    if (val.length > 2) {
      formatted = val.substring(0, 2) + '/' + val.substring(2);
    }
    if (val.length > 4) {
      formatted = val.substring(0, 2) + '/' + val.substring(2, 4) + '/' + val.substring(4);
    }
    setFormData({ ...formData, date_of_birth: formatted });
  };

  // Date validator
  const isValidDate = (dateStr: string) => {
    if (dateStr.length !== 10) return false;
    const [dd, mm, yyyy] = dateStr.split('/');
    const d = parseInt(dd, 10);
    const m = parseInt(mm, 10);
    const y = parseInt(yyyy, 10);
    if (m < 1 || m > 12) return false;
    const daysInMonth = new Date(y, m, 0).getDate();
    return d > 0 && d <= daysInMonth && y > 1900 && y < 2100;
  };

  // Password Validator
  const getPasswordReqs = (pw: string) => ({
    length: pw.length >= 8,
    upper: /[A-Z]/.test(pw),
    lower: /[a-z]/.test(pw),
    number: /[0-9]/.test(pw),
    special: /[^A-Za-z0-9]/.test(pw),
  });

  const pwReqs = getPasswordReqs(formData.password);
  const allReqsMet = formData.password && Object.values(pwReqs).every(Boolean);
  const strengthScore = Object.values(pwReqs).filter(Boolean).length;
  const strengthStr = strengthScore <= 2 ? 'Weak' : strengthScore <= 4 ? 'Medium' : 'Strong';
  const passwordsMatch = formData.password && formData.password === formData.confirm_password;

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

    if (formData.date_of_birth && !isValidDate(formData.date_of_birth)) {
      errors.date_of_birth = 'Invalid calendar date';
    }

    if (!allReqsMet) {
      errors.password = 'Password does not meet requirements';
    }

    if (formData.password && !passwordsMatch) {
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

      // Convert DD/MM/YYYY to YYYY-MM-DD for backend
      let formattedDOB = undefined;
      if (formData.date_of_birth && formData.date_of_birth.length === 10) {
        const [dd, mm, yyyy] = formData.date_of_birth.split('/');
        formattedDOB = `${yyyy}-${mm}-${dd}`;
      }

      const payload = {
        institutional_id: formData.institutional_id?.trim() || undefined,
        username: formData.username.trim(),
        full_name: formData.full_name.trim(),
        email: formData.email.trim().toLowerCase(),
        phone_number: formData.phone_number.trim(),
        password: formData.password?.trim() || undefined,
        role: formData.role,
        department_id: isGlobalRole ? 0 : deptIdToSend,
        academic_year: isGlobalRole ? 'All Years' : (formData.academic_year || undefined),
        designation: formData.designation || undefined,
        date_of_birth: formattedDOB,
        is_active: formData.account_status === 'Active',
        require_password_change: true,
        reporting_manager_id: formData.reporting_manager === 'none' ? undefined : parseInt(formData.reporting_manager, 10),
        send_email: formData.send_email
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
  const isFormValid = formData.full_name && formData.username && formData.email && formData.phone_number && allReqsMet && passwordsMatch && formData.consent_checked && (formData.date_of_birth ? isValidDate(formData.date_of_birth) : true);

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
            <section className="relative z-50 bg-white dark:bg-navy-900/80 rounded-2xl p-5 border border-gray-200 dark:border-navy-800 shadow-sm">
              <h3 className="text-xs font-bold text-brand-700 dark:text-brand-300 mb-4 flex items-center uppercase tracking-wider bg-brand-50 dark:bg-brand-500/10 p-2.5 rounded-xl">
                <Building2 className="w-4 h-4 mr-2 text-brand-500" /> 1. Role & Academic Scope
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                {/* ── STAFF ROLE ── Premium trigger with custom face */}
                {(() => {
                  const rc = getRoleConfig(formData.role);
                  const RoleIcon = rc.icon;
                  const [roleOpen, setRoleOpen] = React.useState(false);
                  const roleRef = React.useRef<HTMLDivElement>(null);
                  React.useEffect(() => {
                    const handler = (e: MouseEvent) => {
                      if (roleRef.current && !roleRef.current.contains(e.target as Node)) setRoleOpen(false);
                    };
                    if (roleOpen) document.addEventListener('mousedown', handler);
                    return () => document.removeEventListener('mousedown', handler);
                  }, [roleOpen]);
                  return (
                    <div className="space-y-1.5 relative z-[105]" ref={roleRef}>
                      <label className="block text-[10px] font-extrabold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Staff Role</label>
                      <button
                        type="button"
                        onClick={() => setRoleOpen(o => !o)}
                        className={`w-full flex items-center justify-between px-4 py-0 rounded-2xl border-2 transition-all duration-200 text-left cursor-pointer group shadow-sm min-h-[56px] ${
                          roleOpen
                            ? `${rc.bgColor} ${rc.borderColor} ring-2 ring-offset-1 ring-current/10`
                            : `bg-white dark:bg-navy-900/80 border-gray-200 dark:border-navy-700 hover:${rc.borderColor}`
                        }`}
                      >
                        <div className="flex items-center gap-3 py-3">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${rc.bgColor} border ${rc.borderColor}`}>
                            <RoleIcon className={`w-4 h-4 ${rc.color}`} />
                          </div>
                          <div className="flex flex-col items-start">
                            <div className="flex items-center gap-2">
                              <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border ${rc.badgeColor}`}>
                                {roleOptions.find(r => r.value === formData.role)?.badge}
                              </span>
                              <span className="text-sm font-black text-gray-900 dark:text-gray-100">{formData.role}</span>
                            </div>
                            <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium mt-0.5 leading-tight">{rc.desc}</span>
                          </div>
                        </div>
                        <ChevronDown className={`w-4 h-4 shrink-0 transition-transform duration-200 ${rc.color} ${roleOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {roleOpen && (
                        <div className="absolute left-0 right-0 z-[9999] mt-1.5 rounded-2xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-navy-700 shadow-2xl p-1.5 space-y-0.5" style={{ boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.06)' }}>
                          {roleOptions.map(opt => {
                            const cfg = getRoleConfig(opt.value);
                            const OptIcon = cfg.icon;
                            const isSel = formData.role === opt.value;
                            return (
                              <button key={opt.value} type="button"
                                onClick={() => { setFormData({...formData, role: opt.value}); setRoleOpen(false); }}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer group ${
                                  isSel ? `${cfg.bgColor} border ${cfg.borderColor}` : 'hover:bg-gray-50 dark:hover:bg-navy-800'
                                }`}
                              >
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${cfg.bgColor} border ${cfg.borderColor}`}>
                                  <OptIcon className={`w-3.5 h-3.5 ${cfg.color}`} />
                                </div>
                                <div className="flex flex-col flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border ${cfg.badgeColor}`}>{opt.badge}</span>
                                    <span className={`text-xs font-black truncate ${isSel ? cfg.color : 'text-gray-800 dark:text-gray-100'}`}>{opt.label}</span>
                                  </div>
                                  <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium truncate mt-0.5">{opt.sublabel}</span>
                                </div>
                                {isSel && <Check className={`w-3.5 h-3.5 shrink-0 ${cfg.color} stroke-[2.5]`} />}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* ── DEPARTMENT ── Rich display for global, dropdown for scoped */}
                <div className="space-y-1.5 relative z-[104]">
                  <label className="block text-[10px] font-extrabold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Department</label>
                  {isGlobalRole ? (
                    <div className="w-full min-h-[56px] flex items-center px-4 py-2 rounded-2xl border-2 border-dashed border-brand-300 dark:border-brand-500/40 bg-brand-50/60 dark:bg-brand-500/5 shadow-sm">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300 border-brand-200 dark:border-brand-500/30">ALL</span>
                          <span className="text-sm font-black text-brand-800 dark:text-brand-200">All Departments</span>
                        </div>
                        <span className="text-[10px] text-brand-600/70 dark:text-brand-400/70 font-medium mt-0.5">Institution-wide access</span>
                      </div>
                    </div>
                  ) : (
                    <CustomDropdown
                      options={departmentOptions}
                      label=""
                      value={formData.department_id}
                      onChange={(val) => setFormData({...formData, department_id: val})}
                      placeholder="Select Department..."
                      icon={Building2}
                    />
                  )}
                  {isGlobalRole && (
                    <p className="text-[10px] text-brand-500/80 dark:text-brand-400/70 ml-1">
                      Managed automatically for {formData.role}
                    </p>
                  )}
                </div>

                {/* ── ACADEMIC YEAR ── Rich display for global, dropdown for scoped */}
                <div className="space-y-1.5 relative z-[103]">
                  <label className="block text-[10px] font-extrabold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Academic Year</label>
                  {isGlobalRole ? (
                    <div className="w-full min-h-[56px] flex items-center px-4 py-2 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/30 shadow-sm">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600">ALL</span>
                          <span className="text-sm font-black text-slate-700 dark:text-slate-200">All Years</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium mt-0.5">Institution-wide academic access</span>
                      </div>
                    </div>
                  ) : (
                    <CustomDropdown
                      options={academicYearOptions}
                      label=""
                      value={formData.academic_year}
                      onChange={(val) => setFormData({...formData, academic_year: val})}
                      placeholder="Select Year Cohort..."
                      icon={Calendar}
                    />
                  )}
                  {formErrors.academic_year && <p className="text-[10px] text-red-500 ml-1 font-semibold">{formErrors.academic_year}</p>}
                </div>

                {/* ── MENTORING DESIGNATION ── N/A for global roles */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-extrabold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Mentoring Designation</label>
                  {isGlobalRole ? (
                    <div className="w-full min-h-[56px] flex items-center px-4 py-2 rounded-2xl border border-dashed border-gray-200 dark:border-navy-700 bg-gray-50/50 dark:bg-navy-900/30">
                      <span className="text-[11px] text-gray-400 dark:text-gray-500 font-medium italic">— Not applicable for this role</span>
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={formData.designation}
                      onChange={e => setFormData({...formData, designation: e.target.value})}
                      className="w-full h-11 px-4 rounded-2xl border border-gray-200 dark:border-navy-700 bg-gray-50 dark:bg-navy-800 text-sm font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
                      autoComplete="off"
                    />
                  )}
                </div>

              </div>
            </section>

            {/* SECTION 2: User Identity & Credentials */}
            <section className="relative z-40 bg-white dark:bg-navy-900/80 rounded-2xl p-5 border border-gray-200 dark:border-navy-800 shadow-sm">
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
                    onChange={handleDOBChange} 
                    className={`w-full h-11 px-4 rounded-2xl border ${formErrors.date_of_birth ? 'border-red-400 ring-2 ring-red-500/10' : 'border-gray-200 dark:border-navy-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20'} bg-gray-50 dark:bg-navy-800 text-sm font-bold text-gray-900 dark:text-white outline-none transition-all`} 
                    placeholder="DD/MM/YYYY"
                    autoComplete="off"
                  />
                  {formErrors.date_of_birth && <p className="text-[10px] text-red-500 ml-1 font-semibold">{formErrors.date_of_birth}</p>}
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
            <section className="relative z-30 bg-white dark:bg-navy-900/80 rounded-2xl p-5 border border-gray-200 dark:border-navy-800 shadow-sm">
              <h3 className="text-xs font-bold text-emerald-700 dark:text-emerald-300 mb-4 flex items-center uppercase tracking-wider bg-emerald-50 dark:bg-emerald-500/10 p-2.5 rounded-xl">
                <FileCheck className="w-4 h-4 mr-2 text-emerald-500" /> 3. Staff Verification
              </h3>
              <div className="space-y-1.5">
                <label className="block text-[10px] font-extrabold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Employee ID Proof / Document (Optional)</label>
                <div className="flex items-center justify-center w-full group">
                  <label className="relative flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-300 dark:border-navy-700 rounded-2xl cursor-pointer bg-gray-50 dark:bg-navy-800 hover:bg-brand-50 dark:hover:bg-brand-500/10 hover:border-brand-400 dark:hover:border-brand-500/50 transition-all duration-300 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <div className="flex flex-col items-center justify-center relative z-10 transform group-hover:-translate-y-1 transition-transform duration-300">
                      <div className="w-12 h-12 mb-3 rounded-full bg-white dark:bg-navy-900 shadow-sm flex items-center justify-center group-hover:shadow-md group-hover:scale-110 transition-all duration-300">
                        <FileCheck className="w-6 h-6 text-gray-400 group-hover:text-brand-500 transition-colors duration-300" />
                      </div>
                      <p className="mb-1 text-xs font-bold text-gray-500 dark:text-gray-400">
                        {idProofFile ? (
                          <span className="text-emerald-500 flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5" /> {idProofFile.name}</span>
                        ) : (
                          <><span className="text-brand-500 font-extrabold group-hover:underline">Click to upload</span> or drag and drop</>
                        )}
                      </p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 font-semibold uppercase tracking-wider mt-1">PDF, JPG or PNG (MAX. 5MB)</p>
                    </div>
                    <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setIdProofFile(e.target.files?.[0] || null)} />
                  </label>
                </div>
              </div>
            </section>

            {/* SECTION 4: Security & Password */}
            <section className="relative z-20 bg-white dark:bg-navy-900/80 rounded-2xl p-5 border border-gray-200 dark:border-navy-800 shadow-sm">
              <h3 className="text-xs font-bold text-rose-700 dark:text-rose-300 mb-4 flex items-center uppercase tracking-wider bg-rose-50 dark:bg-rose-500/10 p-2.5 rounded-xl">
                <Key className="w-4 h-4 mr-2 text-rose-500" /> 4. Security & Password
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-1.5 relative">
                    <label className="block text-[10px] font-extrabold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Initial Password</label>
                    <div className="relative">
                      <input 
                        type={showPassword ? "text" : "password"} 
                        value={formData.password} 
                        onChange={e => setFormData({...formData, password: e.target.value})} 
                        className={`w-full h-11 pl-4 pr-10 rounded-2xl border ${!allReqsMet && formData.password ? 'border-orange-400' : 'border-gray-200 dark:border-navy-700'} bg-gray-50 dark:bg-navy-800 text-sm font-bold text-gray-900 dark:text-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all`} 
                        autoComplete="new-password"
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-brand-500 p-1">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  
                  {/* Password Checklist */}
                  <div className="bg-gray-50 dark:bg-navy-900 rounded-xl p-3 border border-gray-100 dark:border-navy-800 select-none">
                    <p className="text-[10px] font-bold text-gray-500 mb-2 uppercase tracking-wider">Password requirements</p>
                    <div className="space-y-1.5">
                      <div className={`flex items-center space-x-2 text-xs font-semibold ${pwReqs.length ? 'text-emerald-500' : 'text-gray-400'}`}>
                        {pwReqs.length ? <Check className="w-3.5 h-3.5" /> : <div className="w-3.5 h-3.5 rounded-full border border-gray-300 dark:border-gray-600" />}
                        <span>At least 8 characters</span>
                      </div>
                      <div className={`flex items-center space-x-2 text-xs font-semibold ${pwReqs.upper ? 'text-emerald-500' : 'text-gray-400'}`}>
                        {pwReqs.upper ? <Check className="w-3.5 h-3.5" /> : <div className="w-3.5 h-3.5 rounded-full border border-gray-300 dark:border-gray-600" />}
                        <span>One uppercase letter</span>
                      </div>
                      <div className={`flex items-center space-x-2 text-xs font-semibold ${pwReqs.lower ? 'text-emerald-500' : 'text-gray-400'}`}>
                        {pwReqs.lower ? <Check className="w-3.5 h-3.5" /> : <div className="w-3.5 h-3.5 rounded-full border border-gray-300 dark:border-gray-600" />}
                        <span>One lowercase letter</span>
                      </div>
                      <div className={`flex items-center space-x-2 text-xs font-semibold ${pwReqs.number ? 'text-emerald-500' : 'text-gray-400'}`}>
                        {pwReqs.number ? <Check className="w-3.5 h-3.5" /> : <div className="w-3.5 h-3.5 rounded-full border border-gray-300 dark:border-gray-600" />}
                        <span>One number</span>
                      </div>
                      <div className={`flex items-center space-x-2 text-xs font-semibold ${pwReqs.special ? 'text-emerald-500' : 'text-gray-400'}`}>
                        {pwReqs.special ? <Check className="w-3.5 h-3.5" /> : <div className="w-3.5 h-3.5 rounded-full border border-gray-300 dark:border-gray-600" />}
                        <span>One special character</span>
                      </div>
                    </div>
                    {formData.password && (
                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-navy-700 flex justify-between items-center">
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Strength</span>
                        <span className={`text-xs font-bold ${strengthStr === 'Strong' ? 'text-emerald-500' : strengthStr === 'Medium' ? 'text-amber-500' : 'text-rose-500'}`}>{strengthStr}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-1.5 relative">
                    <label className="block text-[10px] font-extrabold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Confirm Password</label>
                    <div className="relative">
                      <input 
                        type={showConfirmPassword ? "text" : "password"} 
                        value={formData.confirm_password} 
                        onChange={e => setFormData({...formData, confirm_password: e.target.value})} 
                        className={`w-full h-11 pl-4 pr-10 rounded-2xl border ${formData.confirm_password && !passwordsMatch ? 'border-red-400 ring-2 ring-red-500/10' : 'border-gray-200 dark:border-navy-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20'} bg-gray-50 dark:bg-navy-800 text-sm font-bold text-gray-900 dark:text-white outline-none transition-all`} 
                        autoComplete="new-password"
                      />
                      <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-brand-500 p-1">
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {formData.confirm_password && (
                      <div className="pt-1 flex items-center space-x-1.5">
                        {passwordsMatch ? (
                          <><CheckCircle className="w-3.5 h-3.5 text-emerald-500" /><span className="text-xs font-bold text-emerald-500">Passwords match</span></>
                        ) : (
                          <><AlertCircle className="w-3.5 h-3.5 text-red-500" /><span className="text-xs font-bold text-red-500">Passwords do not match</span></>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-start space-x-2.5 p-3 mt-2 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-900/10 select-none pointer-events-none">
                    <div className="flex shrink-0 items-center justify-center w-4 h-4 mt-0.5 rounded bg-blue-500 border border-blue-600">
                      <Check className="w-3 h-3 text-white" strokeWidth={3} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-blue-900 dark:text-blue-100 leading-tight">Force password reset on first login</p>
                      <p className="text-[9px] font-bold text-blue-700/80 dark:text-blue-300/80 mt-1 uppercase tracking-wider">Required for security compliance</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* SECTION 5: Account Status & Agreement */}
            <section className="relative z-10 bg-brand-50/40 dark:bg-navy-900/80 rounded-2xl p-5 border border-brand-100 dark:border-navy-800 shadow-sm">
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

                  <div className="flex items-center space-x-3 mt-2 px-1">
                    <input 
                      type="checkbox" 
                      id="send-email-check"
                      checked={formData.send_email} 
                      onChange={e => setFormData({...formData, send_email: e.target.checked})} 
                      className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer" 
                    />
                    <label htmlFor="send-email-check" className="cursor-pointer select-none">
                      <p className="text-sm font-bold text-gray-900 dark:text-white">Send Welcome Email</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">Email login credentials to the user.</p>
                    </label>
                  </div>
                  
                  <div className="flex items-start space-x-3 mt-4 pt-2 group cursor-pointer" onClick={() => setFormData({...formData, consent_checked: !formData.consent_checked})}>
                    <div className="pt-0.5 shrink-0">
                      <input 
                        type="checkbox" 
                        id="consent-check"
                        checked={formData.consent_checked} 
                        onChange={e => setFormData({...formData, consent_checked: e.target.checked})} 
                        className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer pointer-events-none" 
                      />
                    </div>
                    <div className="select-none flex-1">
                      <p className="text-sm font-bold text-gray-900 dark:text-white">Consent & Compliance Acknowledgment *</p>
                      <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">I verify that this staff member is authorized to access student academic records and agree to adhere strictly to the institution's data privacy & security policies.</p>
                      {formErrors.consent && <p className="text-[10px] text-red-500 mt-1 font-bold">{formErrors.consent}</p>}
                    </div>
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
            disabled={isSubmitting || !isFormValid}
            className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 dark:disabled:bg-navy-700 disabled:text-slate-500 dark:disabled:text-navy-400 transition-all shadow-md flex items-center cursor-pointer active:scale-95"
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
