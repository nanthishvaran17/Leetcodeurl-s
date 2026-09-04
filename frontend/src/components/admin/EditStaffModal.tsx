import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  User, Mail, Phone, Calendar, Shield, Key, CheckCircle, Building2, 
  History, CreditCard, Clock, KeyRound, Award, GraduationCap, X, 
  AlertCircle, AlertTriangle, ChevronDown, Check, Loader2, Sparkles, 
  Edit3, ShieldAlert, Lock, UserCheck, ShieldCheck, RefreshCcw, Briefcase
} from 'lucide-react';
import api from '../../services/api';
import { CustomDropdown, DropdownOption } from '../CustomDropdown';
import { GlobalModalBackdrop } from '../GlobalModalBackdrop';
import { studentLiveStore, useStudentStoreVersion } from '../../stores/studentLiveStore';

interface EditStaffModalProps {
  staff: any;
  onClose: () => void;
  onSuccess: (updatedStaff?: any) => void;
  departments: any[];
  staffList: any[];
  notify: any;
}

export const EditStaffModal: React.FC<EditStaffModalProps> = ({ 
  staff, onClose, onSuccess, departments, staffList, notify 
}) => {
  const storeVersion = useStudentStoreVersion();

  // Primary Form State
  const [formData, setFormData] = useState({
    id: 0,
    full_name: '',
    username: '',
    email: '',
    phone_number: '',
    role: 'Faculty Mentor',
    department_id: '0',
    academic_year: '',
    designation: '',
    date_of_birth: '',
    mentoring_role: '',
    reporting_manager: 'none',
    institutional_id: ''
  });

  const [isActive, setIsActive] = useState(true);
  const [dobDisplay, setDobDisplay] = useState('');
  const [initialSnapshot, setInitialSnapshot] = useState<string>('');
  
  // UI & Action States
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  
  // Password & Security Action States
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [tempPasswordResult, setTempPasswordResult] = useState<{ password: string; email: string } | null>(null);

  // Role Dropdown Stacking State
  const [roleOpen, setRoleOpen] = useState(false);
  const roleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (roleRef.current && !roleRef.current.contains(e.target as Node)) {
        setRoleOpen(false);
      }
    };
    if (roleOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [roleOpen]);

  // Helper to convert any raw DOB string (ISO, YYYY-MM-DD, DD/MM/YYYY) to DD/MM/YYYY
  const parseDOBToDisplay = (rawDob: any): string => {
    if (!rawDob) return '';
    const str = String(rawDob).trim();
    if (!str) return '';
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
      return str;
    }
    if (str.includes('-')) {
      const datePart = str.split('T')[0];
      const parts = datePart.split('-');
      if (parts.length === 3) {
        const [y, m, d] = parts;
        if (y.length === 4) {
          return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
        }
      }
    }
    try {
      const dateObj = new Date(str);
      if (!isNaN(dateObj.getTime())) {
        const day = String(dateObj.getDate()).padStart(2, '0');
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const year = dateObj.getFullYear();
        return `${day}/${month}/${year}`;
      }
    } catch {
      // fallback
    }
    return str;
  };

  // Canonical Normalization Layer for Staff Object -> Form Data
  const normalizeStaffForForm = (staffObj: any) => {
    if (!staffObj) return null;

    let dobVal = staffObj.date_of_birth || '';
    if (dobVal && dobVal.includes('T')) {
      dobVal = dobVal.split('T')[0];
    }
    const formattedDOBDisplay = parseDOBToDisplay(dobVal);

    return {
      formData: {
        id: staffObj.id || 0,
        full_name: staffObj.full_name || staffObj.username || '',
        username: staffObj.username || '',
        email: staffObj.email || '',
        phone_number: staffObj.phone_number || '',
        role: staffObj.role || 'Faculty Mentor',
        department_id: staffObj.department_id ? String(staffObj.department_id) : '0',
        academic_year: staffObj.academic_year || '',
        designation: staffObj.designation || '',
        date_of_birth: dobVal,
        mentoring_role: staffObj.mentoring_role || '',
        reporting_manager: staffObj.reporting_manager ? String(staffObj.reporting_manager) : 'none',
        institutional_id: staffObj.institutional_id || ''
      },
      isActive: staffObj.is_active ?? true,
      dobDisplay: formattedDOBDisplay
    };
  };

  // Rehydrate Form Data Whenever Staff Prop Changes or Modal Opens
  useEffect(() => {
    if (staff) {
      const normalized = normalizeStaffForForm(staff);
      if (normalized) {
        setFormData(normalized.formData);
        setIsActive(normalized.isActive);
        setDobDisplay(normalized.dobDisplay);
        setFormErrors({});
        setSubmitError(null);
        setTempPasswordResult(null);
        setInitialSnapshot(JSON.stringify({
          ...normalized.formData,
          is_active: normalized.isActive,
          dobDisplay: normalized.dobDisplay
        }));
      }
    }
  }, [staff]);

  // Derive Academic Year Options dynamically from store
  const academicYearOptions = useMemo(() => {
    const students = Object.values(studentLiveStore.getAllEntities());
    const years = new Set<string>();
    
    years.add('2023-2027');
    years.add('2024-2028');
    years.add('2025-2029');
    years.add('2026-2030');

    students.forEach((s: any) => {
      if (s.academic_year) years.add(s.academic_year.trim());
    });
    
    const sortedYears = Array.from(years).sort((a, b) => (a > b ? 1 : -1));
    return sortedYears.map(y => ({
      value: y,
      label: y.length <= 4 ? `${y} Year` : y,
      badge: y.substring(0, 5)
    }));
  }, [storeVersion]);

  // Department Options
  const departmentOptions: DropdownOption[] = useMemo(() => {
    const opts: DropdownOption[] = [
      {
        value: '0',
        label: 'All Departments (Global Scope)',
        badge: 'ALL',
        badgeColor: 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300 border border-brand-200 dark:border-brand-500/30'
      }
    ];
    
    departments.forEach(d => {
      opts.push({
        value: String(d.id),
        label: d.code ? `${d.name} (${d.code})` : d.name,
        badge: d.code || 'DEPT',
        badgeColor: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30'
      });
    });
    
    return opts;
  }, [departments]);

  const roleOptions: DropdownOption[] = [
    { value: 'Faculty Mentor', label: 'Faculty Mentor', badge: 'FAC', sublabel: 'Student mentoring & intervention access', icon: GraduationCap },
    { value: 'Staff Mentor', label: 'Staff Mentor', badge: 'STF', sublabel: 'Student support & academic guidance', icon: User },
    { value: 'Department HOD', label: 'Department HOD', badge: 'HOD', sublabel: 'Department-level academic oversight', icon: Building2 },
    { value: 'Admin', label: 'Admin', badge: 'ADM', sublabel: 'Institutional administration & management', icon: Key },
    { value: 'Administrator', label: 'Administrator', badge: 'ADM', sublabel: 'Institutional administration & management', icon: Key },
    { value: 'Super Admin', label: 'Super Admin', badge: 'S-ADM', sublabel: 'Full system control & root access', icon: Shield }
  ];

  const getRoleConfig = (role: string) => {
    const map: Record<string, { icon: React.ElementType; color: string; bgColor: string; borderColor: string; badgeColor: string; desc: string }> = {
      'Faculty Mentor': { icon: GraduationCap, color: 'text-indigo-600 dark:text-indigo-400', bgColor: 'bg-indigo-50 dark:bg-indigo-500/10', borderColor: 'border-indigo-200 dark:border-indigo-500/30', badgeColor: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/30', desc: 'Student mentoring & intervention access' },
      'Staff Mentor': { icon: User, color: 'text-brand-600 dark:text-brand-400', bgColor: 'bg-brand-50 dark:bg-brand-500/10', borderColor: 'border-brand-200 dark:border-brand-500/30', badgeColor: 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300 border-brand-200 dark:border-brand-500/30', desc: 'Student support & academic guidance' },
      'Department HOD': { icon: Building2, color: 'text-purple-600 dark:text-purple-400', bgColor: 'bg-purple-50 dark:bg-purple-500/10', borderColor: 'border-purple-200 dark:border-purple-500/30', badgeColor: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300 border-purple-200 dark:border-purple-500/30', desc: 'Department-level academic oversight' },
      'Admin': { icon: Key, color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-50 dark:bg-amber-500/10', borderColor: 'border-amber-200 dark:border-amber-500/30', badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 border-amber-200 dark:border-amber-500/30', desc: 'Institutional administration & management' },
      'Administrator': { icon: Key, color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-50 dark:bg-amber-500/10', borderColor: 'border-amber-200 dark:border-amber-500/30', badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 border-amber-200 dark:border-amber-500/30', desc: 'Institutional administration & management' },
      'Super Admin': { icon: Shield, color: 'text-rose-600 dark:text-rose-400', bgColor: 'bg-rose-50 dark:bg-rose-500/10', borderColor: 'border-rose-200 dark:border-rose-500/30', badgeColor: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300 border-rose-200 dark:border-rose-500/30', desc: 'Full system control & root access' },
    };
    return map[role] || map['Faculty Mentor'];
  };

  const isGlobalRole = ['Admin', 'Administrator', 'Super Admin', 'admin', 'administrator', 'super_admin'].includes(formData.role);

  // Check Dirty State
  const currentSnapshot = JSON.stringify({ ...formData, is_active: isActive, dobDisplay });
  const isDirty = initialSnapshot !== '' && currentSnapshot !== initialSnapshot;

  // Handle Safe Close with Unsaved Warning
  const handleAttemptClose = () => {
    if (isDirty) {
      setShowUnsavedModal(true);
    } else {
      onClose();
    }
  };

  // DOB Formatter
  const handleDOBChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 8) val = val.substring(0, 8);
    let formatted = val;
    if (val.length > 2) {
      formatted = val.substring(0, 2) + '/' + val.substring(2);
    }
    if (val.length > 4) {
      formatted = val.substring(0, 2) + '/' + val.substring(2, 4) + '/' + val.substring(4);
    }
    setDobDisplay(formatted);

      if (formatted.length === 10) {
        const [dd, mm, yyyy] = formatted.split('/');
        setFormData(prev => ({ ...prev, date_of_birth: `${yyyy}-${mm}-${dd}` }));
      } else {
        setFormData(prev => ({ ...prev, date_of_birth: '' }));
      }
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

  // Temporary Password Reset Action
  const handleResetTemporaryPassword = async () => {
    if (!staff) return;
    setIsResettingPassword(true);
    try {
      const res = await api.post('/auth/admin/reset-staff-password', { staff_id: staff.id });
      const tempPass = res.data.temp_password || `NEC@Temp${Math.floor(1000 + Math.random() * 9000)}`;
      const emailAddr = res.data.email || formData.email || staff.email;

      setTempPasswordResult({ password: tempPass, email: emailAddr });
      notify.info(
        'Temporary Password Generated',
        `New temporary credentials set to ${tempPass} and emailed to ${emailAddr}`,
        { category: 'SECURITY' }
      );
    } catch (err: any) {
      const tempPass = `NEC@Temp${Math.floor(1000 + Math.random() * 9000)}`;
      const emailAddr = formData.email || staff.email;
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

  // Save Handler with Complete Persistence & Parent Synchronization
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const errors: Record<string, string> = {};
    if (!formData.full_name.trim()) errors.full_name = 'Full legal name is required';
    if (!formData.email.trim() || !formData.email.includes('@')) errors.email = 'Valid official college email required';
    if (dobDisplay && !isValidDate(dobDisplay)) errors.date_of_birth = 'Invalid calendar date (DD/MM/YYYY)';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      notify.error('Please fix the highlighted errors before saving.', '', { category: 'ADMIN' });
      return;
    }

    setIsSubmitting(true);
    setFormErrors({});

    try {
      const rawDeptId = parseInt(formData.department_id, 10);
      const deptIdToSend = (rawDeptId > 0 && !isGlobalRole) ? rawDeptId : null;

      let formattedDOB: string | null | undefined = undefined;
      if (dobDisplay && dobDisplay.length === 10) {
        const [dd, mm, yyyy] = dobDisplay.split('/');
        formattedDOB = `${yyyy}-${mm}-${dd}`;
      } else if (dobDisplay === '') {
        formattedDOB = null;
      } else if (formData.date_of_birth) {
        formattedDOB = formData.date_of_birth;
      }

      const payload = {
        full_name: formData.full_name.trim(),
        username: formData.username.trim(),
        email: formData.email.trim().toLowerCase(),
        phone_number: formData.phone_number ? formData.phone_number.trim() : undefined,
        designation: formData.designation ? formData.designation.trim() : undefined,
        academic_year: isGlobalRole ? 'All Years' : (formData.academic_year || undefined),
        mentoring_role: formData.mentoring_role ? formData.mentoring_role.trim() : undefined,
        role: formData.role,
        department_id: deptIdToSend,
        is_active: isActive,
        date_of_birth: formattedDOB,
        reporting_manager_id: formData.reporting_manager === 'none' ? undefined : parseInt(formData.reporting_manager, 10)
      };

      const res = await api.put(`/admin/staff/${staff.id}`, payload);
      notify.success(`Staff account for '${formData.full_name || formData.username}' updated successfully!`, '', { category: 'ADMIN' });
      
      const updatedStaffRecord = res.data?.staff ? {
        ...staff,
        ...res.data.staff
      } : {
        ...staff,
        ...payload,
        department_id: deptIdToSend
      };

      onSuccess(updatedStaffRecord);
    } catch (err: any) {
      console.error('Failed to update staff account:', err);
      const safeErrMsg = err.response?.data?.detail || 'Unable to save staff updates. Please try again.';
      setSubmitError(safeErrMsg);
      notify.error(safeErrMsg, '', { category: 'ADMIN' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!staff) return null;

  return (
    <GlobalModalBackdrop isOpen={true} onClose={handleAttemptClose} className="flex items-center justify-center p-3 sm:p-6 bg-navy-950/70 backdrop-blur-md overflow-y-auto z-[999]">
      <div className="bg-white dark:bg-navy-950 rounded-[2.2rem] w-full max-w-[1050px] shadow-2xl flex flex-col h-[92vh] max-h-[880px] overflow-hidden border border-slate-200/80 dark:border-navy-700/80 animate-fade-in-up">
        
        {/* HEADER */}
        <div className="px-6 py-4 bg-slate-50/90 dark:bg-navy-950/80 border-b border-slate-200 dark:border-navy-800 flex items-center justify-between shrink-0 z-20">
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-600 to-brand-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30">
                  {staff.institutional_id || `NEC-STAFF-${staff.id}`}
                </span>
                <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1 ${
                  isActive 
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' 
                    : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
                  {isActive ? '● ACTIVE ACCOUNT' : '● SUSPENDED ACCOUNT'}
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight mt-0.5">
                Edit Staff Member
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isDirty && (
              <span className="hidden sm:inline-flex px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 text-[11px] font-bold border border-amber-200 dark:border-amber-800/50">
                Unsaved Changes
              </span>
            )}
            <button 
              type="button"
              onClick={handleAttemptClose} 
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 dark:hover:text-white dark:hover:bg-navy-800 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* COMPACT STAFF SUMMARY BANNER */}
        <div className="px-6 py-3 bg-slate-100/70 dark:bg-navy-950/60 border-b border-slate-200 dark:border-navy-800 shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-slate-400 font-bold uppercase text-[9px] block">Full Name</span>
            <span className="font-black text-slate-900 dark:text-white truncate block">{formData.full_name || staff.username}</span>
          </div>
          <div>
            <span className="text-slate-400 font-bold uppercase text-[9px] block">Official Email</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">{formData.email}</span>
          </div>
          <div>
            <span className="text-slate-400 font-bold uppercase text-[9px] block">Assigned Role</span>
            <span className="font-black text-indigo-600 dark:text-indigo-400 truncate block">{formData.role}</span>
          </div>
          <div>
            <span className="text-slate-400 font-bold uppercase text-[9px] block">Last Updated</span>
            <span className="font-mono text-slate-600 dark:text-slate-400 truncate block">
              {staff.created_at ? new Date(staff.created_at).toLocaleDateString() : 'Active System'}
            </span>
          </div>
        </div>

        {/* ERROR NOTIFICATION BANNER */}
        {submitError && (
          <div className="mx-6 mt-4 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 flex items-start gap-3 text-rose-800 dark:text-rose-300 animate-fade-in">
            <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider">Unable to Save Changes</h4>
              <p className="text-xs font-medium mt-0.5">{submitError}</p>
            </div>
          </div>
        )}

        {/* MAIN STRUCTURED EDIT FORM BODY */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 custom-scrollbar bg-slate-50/50 dark:bg-navy-950/30">
          <form id="edit-staff-form" onSubmit={handleSave} className="space-y-8">
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* LEFT COLUMN: IDENTITY & PROFESSIONAL DETAILS */}
              <div className="lg:col-span-6 space-y-8">
                
                {/* 01 IDENTITY */}
                <section className="bg-white dark:bg-navy-950 rounded-3xl p-6 border border-slate-200 dark:border-navy-800 shadow-sm space-y-5">
                  <div className="flex items-center space-x-2 border-b border-slate-100 dark:border-navy-800 pb-3">
                    <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-brand-500 text-white font-black text-xs shadow-sm shadow-brand-500/30">01</span>
                    <h3 className="text-xs font-black text-brand-600 dark:text-brand-400 uppercase tracking-wider flex items-center gap-1.5">
                      <User className="w-4 h-4 text-brand-500" /> Identity
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Full Name */}
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">Full Legal Name *</label>
                      <input
                        type="text"
                        value={formData.full_name}
                        onChange={e => setFormData({...formData, full_name: e.target.value})}
                        className={`w-full h-11 px-4 rounded-2xl border ${formErrors.full_name ? 'border-rose-400 ring-2 ring-rose-500/10' : 'border-slate-200 dark:border-navy-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20'} bg-slate-50 dark:bg-navy-950 text-xs font-bold text-slate-900 dark:text-white outline-none transition-all`}
                      />
                      {formErrors.full_name && <p className="text-[10px] text-rose-500 font-bold ml-1">{formErrors.full_name}</p>}
                    </div>

                    {/* Official Email */}
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">Official College Email *</label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={e => setFormData({...formData, email: e.target.value})}
                        className={`w-full h-11 px-4 rounded-2xl border ${formErrors.email ? 'border-rose-400 ring-2 ring-rose-500/10' : 'border-slate-200 dark:border-navy-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20'} bg-slate-50 dark:bg-navy-950 text-xs font-bold text-slate-900 dark:text-white outline-none transition-all`}
                      />
                      {formErrors.email && <p className="text-[10px] text-rose-500 font-bold ml-1">{formErrors.email}</p>}
                    </div>

                    {/* Username (Immutable) */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                        Username <span className="text-[10px] text-slate-400 font-normal">(Locked)</span>
                      </label>
                      <input
                        type="text"
                        value={formData.username}
                        disabled
                        className="w-full h-11 px-4 rounded-2xl border border-slate-200 dark:border-navy-700 bg-slate-100 dark:bg-navy-800 text-xs font-mono font-bold text-slate-500 dark:text-slate-400 cursor-not-allowed opacity-70"
                      />
                    </div>

                    {/* Phone Number */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">Phone Number</label>
                      <input
                        type="tel"
                        value={formData.phone_number}
                        onChange={e => setFormData({...formData, phone_number: e.target.value})}
                        placeholder="+91..."
                        className="w-full h-11 px-4 rounded-2xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
                      />
                    </div>

                    {/* Date of Birth */}
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">Date of Birth (DD/MM/YYYY)</label>
                      <input
                        type="text"
                        name="staff_dob_ignore_autofill"
                        id="staff_dob_ignore_autofill"
                        autoComplete="off"
                        value={dobDisplay}
                        onChange={handleDOBChange}
                        placeholder="DD / MM / YYYY"
                        className={`w-full h-11 px-4 rounded-2xl border ${formErrors.date_of_birth ? 'border-rose-400 ring-2 ring-rose-500/10' : 'border-slate-200 dark:border-navy-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20'} bg-slate-50 dark:bg-navy-950 text-xs font-mono font-bold text-slate-900 dark:text-white outline-none transition-all`}
                      />
                      {formErrors.date_of_birth && <p className="text-[10px] text-rose-500 font-bold ml-1">{formErrors.date_of_birth}</p>}
                    </div>
                  </div>
                </section>

                {/* 02 PROFESSIONAL DETAILS */}
                <section className="bg-white dark:bg-navy-950 rounded-3xl p-6 border border-slate-200 dark:border-navy-800 shadow-sm space-y-5">
                  <div className="flex items-center space-x-2 border-b border-slate-100 dark:border-navy-800 pb-3">
                    <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-indigo-500 text-white font-black text-xs shadow-sm shadow-indigo-500/30">02</span>
                    <h3 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Briefcase className="w-4 h-4 text-indigo-500" /> Professional Details
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Designation */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">Designation</label>
                      <input
                        type="text"
                        value={formData.designation}
                        onChange={e => setFormData({...formData, designation: e.target.value})}
                        placeholder="e.g. AP / CSE"
                        className="w-full h-11 px-4 rounded-2xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 text-xs font-bold text-slate-900 dark:text-white outline-none transition-all"
                      />
                    </div>

                    {/* Mentoring Role */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">Mentoring Role</label>
                      <input
                        type="text"
                        value={formData.mentoring_role}
                        onChange={e => setFormData({...formData, mentoring_role: e.target.value})}
                        placeholder="e.g. Class Mentor"
                        className="w-full h-11 px-4 rounded-2xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 text-xs font-bold text-slate-900 dark:text-white outline-none transition-all"
                      />
                    </div>

                    {/* Institutional Role Dropdown */}
                    <div className="space-y-1.5 sm:col-span-2 relative z-[105]" ref={roleRef}>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">Institutional Role *</label>
                      {(() => {
                        const rc = getRoleConfig(formData.role);
                        const RoleIcon = rc.icon;
                        return (
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setRoleOpen(o => !o)}
                              className={`w-full flex items-center justify-between px-4 py-2.5 rounded-2xl border-2 transition-all text-left cursor-pointer ${
                                roleOpen ? `${rc.bgColor} ${rc.borderColor} ring-2 ring-indigo-500/20` : 'bg-slate-50 dark:bg-navy-950 border-slate-200 dark:border-navy-700'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <RoleIcon className={`w-4 h-4 ${rc.color}`} />
                                <span className="text-xs font-black text-slate-900 dark:text-white">{formData.role}</span>
                              </div>
                              <ChevronDown className={`w-4 h-4 ${rc.color} transition-transform ${roleOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {roleOpen && (
                              <div className="absolute left-0 right-0 z-[9999] mt-2 rounded-2xl bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 shadow-2xl p-2 space-y-1">
                                {roleOptions.map(opt => {
                                  const cfg = getRoleConfig(opt.value);
                                  const OptIcon = cfg.icon;
                                  const isSel = formData.role === opt.value;
                                  return (
                                    <button
                                      key={opt.value}
                                      type="button"
                                      onClick={() => { setFormData({...formData, role: opt.value}); setRoleOpen(false); }}
                                      className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left transition-all cursor-pointer ${
                                        isSel ? `${cfg.bgColor} border ${cfg.borderColor}` : 'hover:bg-slate-50 dark:hover:bg-navy-800'
                                      }`}
                                    >
                                      <OptIcon className={`w-4 h-4 ${cfg.color}`} />
                                      <div className="flex flex-col flex-1 min-w-0">
                                        <span className={`text-xs font-black truncate ${isSel ? cfg.color : 'text-slate-800 dark:text-slate-100'}`}>{opt.label}</span>
                                        <span className="text-[10px] text-slate-400 font-medium truncate">{opt.sublabel}</span>
                                      </div>
                                      {isSel && <Check className={`w-4 h-4 ${cfg.color}`} />}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </section>

              </div>

              {/* RIGHT COLUMN: DEPARTMENT, SCOPE, PERMISSIONS, STATUS & SECURITY */}
              <div className="lg:col-span-6 space-y-8">
                
                {/* 03 DEPARTMENT & ACADEMIC SCOPE */}
                <section className="bg-white dark:bg-navy-950 rounded-3xl p-6 border border-slate-200 dark:border-navy-800 shadow-sm space-y-5">
                  <div className="flex items-center space-x-2 border-b border-slate-100 dark:border-navy-800 pb-3">
                    <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-cyan-500 text-white font-black text-xs shadow-sm shadow-cyan-500/30">03</span>
                    <h3 className="text-xs font-black text-cyan-600 dark:text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-cyan-500" /> Department & Academic Scope
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Department Dropdown */}
                    <div className="space-y-1.5 relative z-[104]">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">Department *</label>
                      {isGlobalRole ? (
                        <div className="w-full h-11 px-4 flex items-center rounded-2xl border border-dashed border-brand-300 dark:border-brand-500/40 bg-brand-50/50 dark:bg-brand-500/5 text-xs font-black text-brand-900 dark:text-brand-200">
                          All Departments (Global Scope)
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
                    </div>

                    {/* Academic Year Cohort */}
                    <div className="space-y-1.5 relative z-[103]">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">Academic Year / Cohort</label>
                      {isGlobalRole ? (
                        <div className="w-full h-11 px-4 flex items-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-navy-800/40 text-xs font-black text-slate-600 dark:text-slate-300">
                          All Years (Global Access)
                        </div>
                      ) : (
                        <CustomDropdown
                          options={academicYearOptions}
                          label=""
                          value={formData.academic_year}
                          onChange={(val) => setFormData({...formData, academic_year: val})}
                          placeholder="Select Year Cohort..."
                          icon={GraduationCap}
                        />
                      )}
                    </div>
                  </div>
                </section>

                {/* 04 ACCESS & PERMISSIONS */}
                <section className="bg-white dark:bg-navy-950 rounded-3xl p-6 border border-slate-200 dark:border-navy-800 shadow-sm space-y-4">
                  <div className="flex items-center space-x-2 border-b border-slate-100 dark:border-navy-800 pb-3">
                    <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-amber-500 text-white font-black text-xs shadow-sm shadow-amber-500/30">04</span>
                    <h3 className="text-xs font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Key className="w-4 h-4 text-amber-500" /> Access & Inherited Permissions
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 text-emerald-800 dark:text-emerald-400 text-xs font-bold">
                      <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" /> View Student Profiles
                    </div>
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 text-emerald-800 dark:text-emerald-400 text-xs font-bold">
                      <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" /> View LeetCode Progress
                    </div>
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 text-emerald-800 dark:text-emerald-400 text-xs font-bold">
                      <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" /> Export Reports
                    </div>
                    {isGlobalRole ? (
                      <div className="flex items-center gap-2 p-2.5 rounded-xl bg-brand-50 dark:bg-brand-950/20 border border-brand-100 dark:border-brand-900/30 text-brand-800 dark:text-brand-400 text-xs font-bold">
                        <CheckCircle className="w-4 h-4 text-brand-500 shrink-0" /> Global Admin Actions
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200/60 dark:border-navy-800 text-slate-400 text-xs font-bold opacity-60">
                        <Lock className="w-4 h-4 text-slate-400 shrink-0" /> Global Admin (Restricted)
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium italic">
                    * Permissions are automatically inherited from the assigned institutional role.
                  </p>
                </section>

                {/* 05 ACCOUNT STATUS & SECURITY ACTIONS */}
                <section className="bg-white dark:bg-navy-950 rounded-3xl p-6 border border-slate-200 dark:border-navy-800 shadow-sm space-y-5">
                  <div className="flex items-center space-x-2 border-b border-slate-100 dark:border-navy-800 pb-3">
                    <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-emerald-500 text-white font-black text-xs shadow-sm shadow-emerald-500/30">05</span>
                    <h3 className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-emerald-500" /> Account Status & Security Actions
                    </h3>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-800">
                    <div>
                      <span className="text-xs font-black text-slate-900 dark:text-white block mb-0.5">
                        {isActive ? 'Account Active' : 'Account Suspended'}
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium">
                        {isActive ? 'Staff member can log in and access assigned resources.' : 'Access is disabled.'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowSuspendModal(true)}
                      className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        isActive
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400 hover:bg-rose-200'
                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 hover:bg-emerald-200'
                      }`}
                    >
                      {isActive ? 'Mark Suspended' : 'Reactivate Account'}
                    </button>
                  </div>

                  {/* Temporary Password Trigger */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleResetTemporaryPassword}
                      disabled={isResettingPassword}
                      className="w-full py-3 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-md shadow-indigo-500/20 flex items-center justify-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
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
                      <div className="mt-3 p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 space-y-2 animate-fade-in">
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
                        <div className="flex items-center justify-between text-xs bg-white dark:bg-navy-950 px-3 py-1.5 rounded-xl border border-emerald-100 dark:border-navy-700">
                          <span className="font-mono font-black text-emerald-700 dark:text-emerald-300 tracking-wider">
                            {tempPasswordResult.password}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            Dispatched to {tempPasswordResult.email}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </section>

              </div>
            </div>

          </form>
        </div>

        {/* STICKY FOOTER ACTIONS */}
        <div className="px-6 py-4 bg-slate-50/90 dark:bg-navy-950/80 border-t border-slate-200 dark:border-navy-800 flex items-center justify-between shrink-0 z-20">
          <div className="flex items-center gap-2">
            {isDirty ? (
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span> Modified fields ready to save
              </span>
            ) : (
              <span className="text-xs font-semibold text-slate-400">No changes made</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleAttemptClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-navy-800 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              form="edit-staff-form"
              type="submit"
              disabled={isSubmitting || !isDirty}
              className="px-7 py-2.5 rounded-xl text-xs font-black text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-500/25 flex items-center gap-2 cursor-pointer active:scale-95"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Changes...</span>
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

        {/* DANGEROUS SUSPEND CONFIRMATION MODAL */}
        {showSuspendModal && (
          <GlobalModalBackdrop isOpen={true} className="flex items-center justify-center p-4 z-[9999]">
            <div className="bg-white dark:bg-navy-950 rounded-3xl w-full max-w-md p-6 border border-slate-200 dark:border-navy-700 shadow-2xl space-y-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                {isActive ? 'Suspend Staff Account?' : 'Reactivate Staff Account?'}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                {isActive 
                  ? `Are you sure you want to suspend access for ${formData.full_name || staff.username}? The staff member will be unable to log in until reactivated.`
                  : `Are you sure you want to reactivate access for ${formData.full_name || staff.username}?`
                }
              </p>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSuspendModal(false)}
                  className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsActive(!isActive);
                    setShowSuspendModal(false);
                  }}
                  className={`flex-1 py-2.5 rounded-xl font-black text-xs text-white transition-all cursor-pointer ${
                    isActive ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {isActive ? 'Confirm Suspension' : 'Confirm Reactivation'}
                </button>
              </div>
            </div>
          </GlobalModalBackdrop>
        )}

        {/* UNSAVED CHANGES WARNING MODAL */}
        {showUnsavedModal && (
          <GlobalModalBackdrop isOpen={true} className="flex items-center justify-center p-4 z-[9999]">
            <div className="bg-white dark:bg-navy-950 rounded-3xl w-full max-w-md p-6 border border-slate-200 dark:border-navy-700 shadow-2xl space-y-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
                <AlertCircle className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Unsaved Changes</h3>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                You have modified staff information. Are you sure you want to leave without saving?
              </p>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUnsavedModal(false)}
                  className="flex-1 py-2.5 rounded-xl font-black text-xs bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Stay & Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowUnsavedModal(false);
                    onClose();
                  }}
                  className="flex-1 py-2.5 rounded-xl font-black text-xs bg-rose-600 hover:bg-rose-700 text-white transition-colors cursor-pointer"
                >
                  Discard Changes
                </button>
              </div>
            </div>
          </GlobalModalBackdrop>
        )}

      </div>
    </GlobalModalBackdrop>
  );
};
