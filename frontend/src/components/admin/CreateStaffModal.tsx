import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  User, Shield, CheckCircle, Building2, Key, Check, Loader2, FileCheck, 
  X, Briefcase, ChevronRight, ChevronLeft, Hash, Mail, Phone, Calendar, 
  Search, Sparkles, Eye, EyeOff, AlertCircle, GraduationCap, ChevronDown,
  Lock, AlertTriangle, ArrowRight, UploadCloud, FileText, CheckCircle2, ShieldCheck
} from 'lucide-react';
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

export const CreateStaffModal: React.FC<CreateStaffModalProps> = ({ 
  onClose, onSuccess, departments, staffList, notify 
}) => {
  const storeVersion = useStudentStoreVersion();
  const [activeStep, setActiveStep] = useState<number>(1);
  const [createdStaffSummary, setCreatedStaffSummary] = useState<any | null>(null);

  // Helper map for Academic Years -> Year designation & styling
  const getAcademicYearMeta = (y: string) => {
    const str = y.trim();
    if (str.includes('2023') || str.includes('2027') || /\b(4|iv)\b/i.test(str)) {
      return {
        badge: 'IV Year',
        label: str,
        sublabel: 'Final Year Mentorship Roster',
        badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30'
      };
    }
    if (str.includes('2024') || str.includes('2028') || /\b(3|iii)\b/i.test(str)) {
      return {
        badge: 'III Year',
        label: str,
        sublabel: 'Pre-Final Year Mentorship Roster',
        badgeColor: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30'
      };
    }
    if (str.includes('2025') || str.includes('2029') || /\b(2|ii)\b/i.test(str)) {
      return {
        badge: 'II Year',
        label: str,
        sublabel: 'Second Year Mentorship Roster',
        badgeColor: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300 border border-sky-200 dark:border-sky-500/30'
      };
    }
    if (str.includes('2026') || str.includes('2030') || /\b(1|i)\b/i.test(str)) {
      return {
        badge: 'I Year',
        label: str,
        sublabel: 'First Year Mentorship Roster',
        badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30'
      };
    }
    return {
      badge: str.length <= 4 ? `${str} Yr` : str.split('-')[0],
      label: str,
      sublabel: `Academic Batch (${str})`,
      badgeColor: 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300 border border-brand-200 dark:border-brand-500/30'
    };
  };

  // Derive dynamic Academic Year options from live students, with fallback
  const academicYearOptions = useMemo(() => {
    const students = Object.values(studentLiveStore.getAllEntities());
    const years = new Set<string>();
    
    years.add('2023-2027');
    years.add('2024-2028');
    years.add('2025-2029');
    years.add('2026-2030');

    students.forEach((s: any) => {
      if (s.academic_year && s.academic_year.trim()) {
        years.add(s.academic_year.trim());
      }
    });
    
    const sortedYears = Array.from(years).sort((a, b) => (a > b ? 1 : -1));

    const options: DropdownOption[] = sortedYears.map(y => {
      const meta = getAcademicYearMeta(y);
      return {
        value: y,
        label: meta.label,
        badge: meta.badge,
        badgeColor: meta.badgeColor,
        sublabel: meta.sublabel,
      };
    });

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
    { value: 'Principal', label: 'Principal', badge: 'PRN', sublabel: 'Head of Institution', icon: Building2 },
    { value: 'Management', label: 'Management', badge: 'MGT', sublabel: 'Institution Trust & Management', icon: Briefcase },
    { value: 'Faculty Mentor', label: 'Faculty Mentor', badge: 'FAC', sublabel: 'Student mentoring & intervention access', icon: GraduationCap },
    { value: 'Staff Mentor', label: 'Staff Mentor', badge: 'STF', sublabel: 'Student support & academic guidance', icon: User },
    { value: 'Department HOD', label: 'Department HOD', badge: 'HOD', sublabel: 'Department-level academic oversight', icon: Building2 },
    { value: 'Administrator', label: 'Administrator', badge: 'ADM', sublabel: 'Institutional administration & management', icon: Key },
    { value: 'Super Admin', label: 'Super Admin', badge: 'S-ADM', sublabel: 'Full system control & root access', icon: Shield }
  ];

  const getRoleConfig = (role: string) => {
    const map: Record<string, { icon: React.ElementType; color: string; bgColor: string; borderColor: string; badgeColor: string; desc: string }> = {
      'Principal': { icon: Building2, color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-50 dark:bg-blue-500/10', borderColor: 'border-blue-200 dark:border-blue-500/30', badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 border-blue-200 dark:border-blue-500/30', desc: 'Head of Institution' },
      'Management': { icon: Briefcase, color: 'text-slate-700 dark:text-slate-300', bgColor: 'bg-slate-100 dark:bg-slate-800', borderColor: 'border-slate-300 dark:border-slate-600', badgeColor: 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600', desc: 'Institution Trust & Management' },
      'Faculty Mentor': { icon: GraduationCap, color: 'text-indigo-600 dark:text-indigo-400', bgColor: 'bg-indigo-50 dark:bg-indigo-500/10', borderColor: 'border-indigo-200 dark:border-indigo-500/30', badgeColor: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/30', desc: 'Student mentoring & intervention access' },
      'Staff Mentor': { icon: User, color: 'text-brand-600 dark:text-brand-400', bgColor: 'bg-brand-50 dark:bg-brand-500/10', borderColor: 'border-brand-200 dark:border-brand-500/30', badgeColor: 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300 border-brand-200 dark:border-brand-500/30', desc: 'Student support & academic guidance' },
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
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [idProofFile, setIdProofFile] = useState<File | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const roleRef = useRef<HTMLDivElement>(null);
  const formContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (roleRef.current && !roleRef.current.contains(e.target as Node)) {
        setRoleOpen(false);
      }
    };
    if (roleOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [roleOpen]);

  // Unique Username Generator (with dynamic candidate cycling on repeated clicks)
  const generateUniqueUsername = () => {
    const existing = new Set((staffList || []).map((s: any) => (s.username || '').toLowerCase().trim()));
    
    let raw = (formData.full_name || '').trim().toLowerCase();
    // Strip common honorifics: Dr., Prof., Mr., Mrs., Ms., Er.
    raw = raw.replace(/^(dr|prof|mr|mrs|ms|er)\.?\s+/i, '');
    let clean = raw.replace(/[^a-z0-9\s.]/g, '').trim();
    if (!clean) clean = 'staff';
    
    const parts = clean.split(/[\s.]+/).filter(Boolean);
    const firstName = parts[0] || 'staff';
    const lastName = parts.length > 1 ? parts[parts.length - 1] : '';
    
    const deptObj = departments.find(d => String(d.id) === String(formData.department_id));
    const deptCode = (deptObj?.code || deptObj?.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    
    const isMentor = ['Faculty Mentor', 'Staff Mentor'].includes(formData.role);
    const roleTag = isMentor ? 'fac' : ['Department HOD'].includes(formData.role) ? 'hod' : 'adm';

    const rawCandidates: string[] = [];
    
    if (firstName) rawCandidates.push(firstName);
    if (firstName && lastName) rawCandidates.push(`${firstName}.${lastName}`);
    if (firstName && deptCode) rawCandidates.push(`${firstName}.${deptCode}`);
    if (firstName && roleTag) rawCandidates.push(`${firstName}.${roleTag}`);
    if (firstName && lastName && deptCode) rawCandidates.push(`${firstName}.${lastName}.${deptCode}`);
    if (firstName) rawCandidates.push(`${firstName}.nec`);
    if (firstName) rawCandidates.push(`${firstName}01`);
    if (firstName) rawCandidates.push(`${firstName}02`);
    if (firstName) rawCandidates.push(`${firstName}03`);
    if (firstName) rawCandidates.push(`${firstName}.staff`);

    // Deduplicate candidates preserving order & filter out already taken usernames in DB/staffList
    const validCandidates: string[] = [];
    const seen = new Set<string>();
    
    for (const c of rawCandidates) {
      const lower = c.toLowerCase();
      if (!seen.has(lower) && !existing.has(lower)) {
        seen.add(lower);
        validCandidates.push(c);
      }
    }

    if (validCandidates.length === 0) {
      let suffix = 1;
      while (existing.has(`${firstName}${suffix.toString().padStart(2, '0')}`)) {
        suffix++;
      }
      validCandidates.push(`${firstName}${suffix.toString().padStart(2, '0')}`);
    }

    const currentVal = (formData.username || '').trim().toLowerCase();
    const currentIndex = validCandidates.findIndex(c => c.toLowerCase() === currentVal);

    let nextIndex = 0;
    if (currentIndex !== -1) {
      nextIndex = (currentIndex + 1) % validCandidates.length;
    }

    const chosen = validCandidates[nextIndex];
    setFormData(prev => ({ ...prev, username: chosen }));
    if (formErrors.username) setFormErrors(prev => ({ ...prev, username: '' }));
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
    if (formatted.length === 10) {
      setFormData(prev => ({ ...prev, date_of_birth: formatted }));
    } else {
      setFormData(prev => ({ ...prev, date_of_birth: formatted }));
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
  const strengthStr = strengthScore <= 2 ? 'Weak' : strengthScore <= 4 ? 'Fair' : 'Strong';
  const passwordsMatch = formData.password && formData.password === formData.confirm_password;

  const isGlobalRole = ['Principal', 'Management', 'Administrator', 'Super Admin'].includes(formData.role);

  // Validate step completion
  const validateCurrentStep = (step: number): boolean => {
    const errors: Record<string, string> = {};
    if (step === 1) {
      if (['Faculty Mentor', 'Staff Mentor'].includes(formData.role) && !formData.academic_year) {
        errors.academic_year = 'Academic Year is required for Mentors';
      }
    } else if (step === 2) {
      if (!formData.full_name.trim()) errors.full_name = 'Full legal name is required';
      if (!formData.username.trim()) {
        errors.username = 'Username is required';
      } else {
        const uLower = formData.username.trim().toLowerCase();
        const exists = (staffList || []).some((s: any) => (s.username || '').toLowerCase().trim() === uLower);
        if (exists) {
          errors.username = `Username '@${formData.username.trim()}' is already used by another staff member. Please click 'Suggest Username' or choose another handle.`;
        }
      }
      if (!formData.password) errors.password = 'Initial password is required';
      else if (!allReqsMet) errors.password = 'Password does not meet institutional requirements';
      if (formData.password && !passwordsMatch) errors.confirm_password = 'Passwords do not match';
    } else if (step === 3) {
      if (!formData.email.trim() || !formData.email.includes('@') || !formData.email.includes('.')) errors.email = 'Valid email address required (official or personal)';
      if (!formData.phone_number.trim()) errors.phone_number = 'Phone number is required';
      if (!formData.institutional_id.trim()) errors.institutional_id = 'Institutional Staff ID is required';
      if (!formData.date_of_birth.trim()) errors.date_of_birth = 'Date of birth is required';
      else if (!isValidDate(formData.date_of_birth)) errors.date_of_birth = 'Invalid calendar date (DD/MM/YYYY)';
    } else if (step === 5) {
      if (!formData.consent_checked) errors.consent = 'Please acknowledge the Institutional Compliance & Authorization statement.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNextStep = () => {
    if (validateCurrentStep(activeStep)) {
      if (activeStep < 5) setActiveStep(prev => prev + 1);
    }
  };

  const handlePrevStep = () => {
    if (activeStep > 1) setActiveStep(prev => prev - 1);
  };

  const handleStepClick = (stepIndex: number) => {
    setFormErrors({});
    setActiveStep(stepIndex);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    // Validate all required steps before submit
    const errors: Record<string, string> = {};
    if (!formData.full_name.trim()) errors.full_name = 'Required';
    if (!formData.username.trim()) {
      errors.username = 'Required';
    } else {
      const uLower = formData.username.trim().toLowerCase();
      const exists = (staffList || []).some((s: any) => (s.username || '').toLowerCase().trim() === uLower);
      if (exists) {
        errors.username = `Username '@${formData.username.trim()}' is already taken by another staff member.`;
      }
    }
    if (!formData.email.trim() || !formData.email.includes('@') || !formData.email.includes('.')) errors.email = 'Valid email address required';
    if (!formData.phone_number.trim()) errors.phone_number = 'Required';
    if (!formData.institutional_id.trim()) errors.institutional_id = 'Required';
    if (!formData.date_of_birth.trim()) errors.date_of_birth = 'Required';
    else if (!isValidDate(formData.date_of_birth)) errors.date_of_birth = 'Invalid calendar date';
    if (['Faculty Mentor', 'Staff Mentor'].includes(formData.role) && !formData.academic_year) {
      errors.academic_year = 'Required for Mentors';
    }
    if (!allReqsMet) errors.password = 'Password does not meet requirements';
    if (formData.password && !passwordsMatch) errors.confirm_password = 'Passwords do not match';
    if (!formData.consent_checked) errors.consent = 'Please acknowledge the Institutional Compliance & Authorization statement.';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      // Auto-jump to earliest step containing an unfulfilled error
      if (errors.academic_year) setActiveStep(1);
      else if (errors.full_name || errors.username || errors.password || errors.confirm_password) setActiveStep(2);
      else if (errors.email || errors.phone_number || errors.institutional_id || errors.date_of_birth) setActiveStep(3);
      else if (errors.consent) setActiveStep(5);

      formContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      notify.error('Please fix the highlighted errors before submitting.', '', { category: 'ADMIN' });
      return;
    }

    setIsSubmitting(true);
    setFormErrors({});

    try {
      const isGlobalAdmin = ['Administrator', 'Super Admin'].includes(formData.role);
      const rawDeptId = formData.department_id ? parseInt(formData.department_id, 10) : 0;
      const deptIdToSend = (rawDeptId > 0 && !isGlobalAdmin) ? rawDeptId : null;

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
        department_id: deptIdToSend,
        academic_year: isGlobalRole ? 'All Years' : (formData.academic_year || undefined),
        designation: formData.designation || undefined,
        date_of_birth: formattedDOB,
        is_active: formData.account_status === 'Active',
        require_password_change: true,
        reporting_manager_id: formData.reporting_manager === 'none' ? undefined : parseInt(formData.reporting_manager, 10),
        send_email: formData.send_email
      };

      const res = await api.post('/admin/staff', payload);
      const createdStaff = res.data?.staff || payload;

      setCreatedStaffSummary(createdStaff);
      notify.success(`Staff account '${formData.username}' created successfully!`, '', { category: 'ADMIN' });
      onSuccess();
    } catch (err: any) {
      console.error('Failed to create staff account:', err);
      const safeErrMsg = err.response?.data?.detail || 'Unable to complete staff account provisioning. Please try again.';
      setSubmitError(safeErrMsg);
      notify.error(safeErrMsg, '', { category: 'ADMIN' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepsList = [
    { num: 1, id: '01', title: 'Role & Academic Scope', icon: Building2, desc: 'Institutional role & scope' },
    { num: 2, id: '02', title: 'Identity & Credentials', icon: User, desc: 'Name, login & password (Mandatory)' },
    { num: 3, id: '03', title: 'Contact Information', icon: Mail, desc: 'Email, phone & DOB' },
    { num: 4, id: '04', title: 'Staff Verification', icon: FileCheck, desc: 'ID proof & reporting line' },
    { num: 5, id: '05', title: 'Permissions & Agreement', icon: Shield, desc: 'Permissions & authorization' },
  ];

  const progressPercent = Math.round((activeStep / 5) * 100);

  return (
    <GlobalModalBackdrop isOpen={true} onClose={onClose} zIndex={100000} className="flex items-end sm:items-center justify-center p-0 sm:p-6 bg-navy-950/70 backdrop-blur-md overflow-hidden">
      <div className="bg-white dark:bg-navy-950 rounded-t-[2rem] sm:rounded-[2rem] w-full max-w-[1050px] shadow-2xl flex flex-col h-[95dvh] sm:h-[92vh] sm:max-h-[850px] overflow-hidden border-t sm:border border-slate-200/80 dark:border-navy-700/80 animate-fade-in-up">
        
        {/* HEADER */}
        <div className="px-6 py-4 bg-slate-50/90 dark:bg-navy-950/80 border-b border-slate-200 dark:border-navy-800 flex items-center justify-between shrink-0 z-20">
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-brand-500/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300 border border-brand-200 dark:border-brand-500/30">
                  Nandha Engineering College
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Secure Provisioning
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight mt-0.5">
                Create Institutional Account
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-200/60 dark:bg-navy-800 text-slate-600 dark:text-slate-300 text-xs font-mono font-bold">
              <Lock className="w-3.5 h-3.5 text-indigo-500" /> SECURE ADMINISTRATION
            </div>
            <button 
              onClick={onClose} 
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 dark:hover:text-white dark:hover:bg-navy-800 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* SUCCESS CONFIRMATION STATE OVERLAY */}
        {createdStaffSummary ? (
          <div className="flex-1 p-8 sm:p-12 overflow-y-auto flex flex-col items-center justify-center text-center space-y-6 bg-slate-50/50 dark:bg-navy-950/40">
            <div className="w-20 h-20 rounded-3xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-xl shadow-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 animate-bounce-short">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            
            <div className="max-w-md space-y-2">
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">Account Created Successfully</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                The institutional staff account has been provisioned and added to the official Nandha Engineering College registry.
              </p>
            </div>

            {/* Non-sensitive details card */}
            <div className="w-full max-w-lg bg-white dark:bg-navy-950 rounded-2xl p-5 border border-slate-200 dark:border-navy-700 text-left space-y-3 shadow-md">
              <div className="flex justify-between items-center pb-2.5 border-b border-slate-100 dark:border-navy-800 text-xs">
                <span className="text-slate-500 font-bold">Staff Member Name:</span>
                <span className="font-black text-slate-900 dark:text-white">{createdStaffSummary.full_name || createdStaffSummary.username}</span>
              </div>
              <div className="flex justify-between items-center pb-2.5 border-b border-slate-100 dark:border-navy-800 text-xs">
                <span className="text-slate-500 font-bold">Username:</span>
                <span className="font-mono font-bold text-brand-600 dark:text-brand-400">{createdStaffSummary.username}</span>
              </div>
              <div className="flex justify-between items-center pb-2.5 border-b border-slate-100 dark:border-navy-800 text-xs">
                <span className="text-slate-500 font-bold">Official Email:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{createdStaffSummary.email}</span>
              </div>
              <div className="flex justify-between items-center pb-2.5 border-b border-slate-100 dark:border-navy-800 text-xs">
                <span className="text-slate-500 font-bold">Institutional Role:</span>
                <span className="px-2 py-0.5 rounded font-black text-[10px] bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
                  {createdStaffSummary.role}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-bold">Academic Scope:</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  {createdStaffSummary.academic_year || 'All Years'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-2 rounded-lg border border-emerald-200 dark:border-emerald-500/30">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span className="text-xs font-bold">✓ Account setup email sent</span>
            </div>

            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-8 py-3 rounded-xl font-black text-xs text-white bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 shadow-lg shadow-brand-500/25 transition-all cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* MAIN TWO-COLUMN BODY */
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-slate-50/50 dark:bg-navy-950/30">
            
            {/* LEFT STEPPER SIDEBAR */}
            <div className="w-full md:w-72 bg-white dark:bg-navy-950 border-r border-slate-200/80 dark:border-navy-800 p-4 sm:p-6 shrink-0 overflow-x-auto md:overflow-y-auto custom-scrollbar">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 mb-4 hidden md:block">
                Provisioning Steps
              </div>
              
              <div className="flex md:flex-col gap-2 min-w-max md:min-w-0">
                {stepsList.map(s => {
                  const isCurrent = activeStep === s.num;
                  const isCompleted = activeStep > s.num;
                  const Icon = s.icon;
                  return (
                    <button
                      key={s.num}
                      type="button"
                      onClick={() => handleStepClick(s.num)}
                      className={`flex items-center gap-3.5 p-3 rounded-2xl transition-all duration-200 text-left cursor-pointer w-full ${
                        isCurrent
                          ? 'bg-brand-50 dark:bg-brand-500/10 border-2 border-brand-500 dark:border-brand-400 shadow-sm ring-2 ring-brand-500/20'
                          : isCompleted
                          ? 'bg-emerald-50/80 dark:bg-emerald-950/30 hover:bg-emerald-100/70 border border-emerald-200 dark:border-emerald-800/60'
                          : 'bg-slate-100/80 dark:bg-navy-900/60 hover:bg-slate-200/80 dark:hover:bg-navy-800 border border-slate-200 dark:border-navy-700'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-mono text-xs font-black transition-all ${
                        isCurrent
                          ? 'bg-brand-600 text-white shadow-md shadow-brand-500/30'
                          : isCompleted
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-200 dark:bg-navy-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-navy-600'
                      }`}>
                        {isCompleted ? <Check className="w-4 h-4 stroke-[3]" /> : s.id}
                      </div>

                      <div className="hidden md:flex flex-col min-w-0">
                        <span className={`text-xs truncate ${
                          isCurrent
                            ? 'text-brand-950 dark:text-brand-100 font-black'
                            : isCompleted
                            ? 'text-slate-900 dark:text-slate-100 font-bold'
                            : 'text-slate-800 dark:text-slate-200 font-bold'
                        }`}>
                          {s.title}
                        </span>
                        <span className={`text-[10px] font-medium truncate ${
                          isCurrent
                            ? 'text-brand-700 dark:text-brand-300 font-bold'
                            : isCompleted
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}>
                          {s.desc}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* SECURITY SUMMARY PANEL */}
              <div className="mt-8 hidden md:block p-4 rounded-2xl bg-indigo-50/80 dark:bg-navy-950/50 border border-indigo-200/80 dark:border-navy-800 space-y-2">
                <div className="flex items-center gap-2 text-xs font-black text-indigo-950 dark:text-indigo-300">
                  <Lock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Institutional Security
                </div>
                <p className="text-[10px] text-indigo-900 dark:text-indigo-300/80 leading-relaxed font-semibold">
                  This account will be protected by the college authentication system:
                </p>
                <ul className="text-[10px] font-bold text-slate-700 dark:text-slate-300 space-y-1 pt-1">
                  <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400 stroke-[3]" /> Secure authentication</li>
                  <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400 stroke-[3]" /> Role-based access</li>
                  <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400 stroke-[3]" /> Activity auditing</li>
                  <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400 stroke-[3]" /> Institutional controls</li>
                </ul>
              </div>
            </div>

            {/* RIGHT FORM CONTENT PANEL */}
            <div ref={formContainerRef} className="flex-1 overflow-y-auto p-6 sm:p-8 pb-12 custom-scrollbar">
              
              {Object.keys(formErrors).length > 0 && (
                <div className="mb-6 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-400 dark:border-rose-700 flex items-start gap-3 text-rose-900 dark:text-rose-100 shadow-md animate-shake">
                  <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-black uppercase tracking-wider text-rose-950 dark:text-rose-100">
                      Action Required: Please Fix Highlighted Errors
                    </h4>
                    <ul className="text-xs font-bold mt-2 space-y-1.5 text-rose-800 dark:text-rose-300">
                      {Object.entries(formErrors).map(([key, msg]) => (
                        <li key={key} className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                          <span>{msg}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {submitError && (
                <div className="mb-6 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 flex items-start gap-3 text-rose-800 dark:text-rose-300 animate-fade-in">
                  <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider">Unable to Create Account</h4>
                    <p className="text-xs font-medium mt-0.5">{submitError}</p>
                  </div>
                </div>
              )}

              <form id="create-staff-form" onSubmit={handleCreate} className="space-y-6 max-w-3xl" autoComplete="off">
                
                {/* STEP 1: ROLE & ACADEMIC SCOPE */}
                {activeStep === 1 && (
                  <section className="space-y-6 animate-fade-in">
                    <div>
                      <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-brand-500" /> 1. Role & Academic Scope
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                        Define the staff member's institutional role and academic responsibility within Nandha Engineering College.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      
                      {/* Staff Role Trigger */}
                      {(() => {
                        const rc = getRoleConfig(formData.role);
                        const RoleIcon = rc.icon;
                        return (
                          <div className="space-y-1.5 relative col-span-1 sm:col-span-2" ref={roleRef}>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                              Institutional Role *
                            </label>
                            <button
                              type="button"
                              onClick={() => setRoleOpen(o => !o)}
                              className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border-2 transition-all duration-200 text-left cursor-pointer group shadow-sm ${
                                roleOpen
                                  ? `${rc.bgColor} ${rc.borderColor} ring-2 ring-brand-500/20`
                                  : `bg-white dark:bg-navy-950 border-slate-200 dark:border-navy-700 hover:${rc.borderColor}`
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${rc.bgColor} border ${rc.borderColor}`}>
                                  <RoleIcon className={`w-5 h-5 ${rc.color}`} />
                                </div>
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-2">
                                    <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border ${rc.badgeColor}`}>
                                      {roleOptions.find(r => r.value === formData.role)?.badge}
                                    </span>
                                    <span className="text-sm font-black text-slate-900 dark:text-white">{formData.role}</span>
                                  </div>
                                  <span className="text-xs text-slate-400 font-medium mt-0.5">{rc.desc}</span>
                                </div>
                              </div>
                              <ChevronDown className={`w-4 h-4 shrink-0 ${rc.color} transition-transform duration-200 ${roleOpen ? 'rotate-180' : ''}`} />
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
                                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${cfg.bgColor} border ${cfg.borderColor}`}>
                                        <OptIcon className={`w-4 h-4 ${cfg.color}`} />
                                      </div>
                                      <div className="flex flex-col flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border ${cfg.badgeColor}`}>{opt.badge}</span>
                                          <span className={`text-xs font-black truncate ${isSel ? cfg.color : 'text-slate-800 dark:text-slate-100'}`}>{opt.label}</span>
                                        </div>
                                        <span className="text-[10px] text-slate-400 font-medium truncate mt-0.5">{opt.sublabel}</span>
                                      </div>
                                      {isSel && <Check className={`w-4 h-4 ${cfg.color} stroke-[2.5]`} />}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Department */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">Department / Academic Scope *</label>
                        {isGlobalRole ? (
                          <div className="w-full min-h-[48px] flex items-center px-4 py-2.5 rounded-2xl border-2 border-dashed border-brand-300 dark:border-brand-500/40 bg-brand-50/50 dark:bg-brand-500/5">
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">ALL</span>
                              <span className="text-xs font-black text-brand-900 dark:text-brand-200">All Departments (Global Scope)</span>
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
                      </div>

                      {/* Academic Year */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">Academic Year *</label>
                        {isGlobalRole ? (
                          <div className="w-full min-h-[48px] flex items-center px-4 py-2.5 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-navy-800/40">
                            <span className="text-xs font-black text-slate-600 dark:text-slate-300">All Years (Global Access)</span>
                          </div>
                        ) : (
                          <CustomDropdown
                            options={academicYearOptions}
                            label=""
                            value={formData.academic_year}
                            onChange={(val) => setFormData({...formData, academic_year: val})}
                            placeholder="Select Academic Year..."
                            icon={GraduationCap}
                          />
                        )}
                        {formErrors.academic_year && <p className="text-[10px] text-rose-500 font-bold ml-1">{formErrors.academic_year}</p>}
                      </div>

                      {/* Mentoring Designation */}
                      <div className="space-y-1.5 col-span-1 sm:col-span-2">
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">Mentoring Designation (Optional)</label>
                        <input
                          type="text"
                          value={formData.designation}
                          onChange={e => setFormData({...formData, designation: e.target.value})}
                          placeholder="e.g. Assistant Professor / DEPT"
                          className="w-full h-12 px-4 rounded-2xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
                        />
                      </div>
                    </div>
                  </section>
                )}

                {/* STEP 2: IDENTITY & CREDENTIALS */}
                {activeStep === 2 && (
                  <section className="space-y-6 animate-fade-in">
                    <div>
                      <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                        <User className="w-5 h-5 text-indigo-500" /> 2. Identity & Credentials
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                        Enter the official identity and login credentials for the institutional staff member.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      
                      {/* Full Legal Name */}
                      <div className="space-y-1.5 col-span-1 sm:col-span-2">
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">Full Legal Name *</label>
                        <input
                          type="text"
                          value={formData.full_name}
                          onChange={e => {
                            const val = e.target.value;
                            setFormData(prev => ({
                              ...prev,
                              full_name: val,
                              username: prev.username || val.toLowerCase().trim().replace(/\s+/g, '.')
                            }));
                          }}
                          placeholder="e.g. Dr. A. Ramanathan"
                          className={`w-full h-12 px-4 rounded-2xl border ${formErrors.full_name ? 'border-rose-400 ring-2 ring-rose-500/10' : 'border-slate-200 dark:border-navy-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20'} bg-slate-50 dark:bg-navy-950 text-xs font-bold text-slate-900 dark:text-white outline-none transition-all`}
                        />
                        {formErrors.full_name && <p className="text-[10px] text-rose-500 font-bold ml-1">{formErrors.full_name}</p>}
                      </div>

                      {/* Username */}
                      <div className="space-y-1.5 col-span-1 sm:col-span-2">
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">Username *</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={formData.username}
                            onChange={e => {
                              const val = e.target.value;
                              setFormData(prev => ({ ...prev, username: val }));
                              if (formErrors.username) setFormErrors(prev => ({ ...prev, username: '' }));
                            }}
                            placeholder="e.g. ramanathan.dept"
                            className={`flex-1 h-12 px-4 rounded-2xl border ${formErrors.username ? 'border-rose-400 ring-2 ring-rose-500/10' : 'border-slate-200 dark:border-navy-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20'} bg-slate-50 dark:bg-navy-950 text-xs font-bold text-slate-900 dark:text-white outline-none transition-all`}
                          />
                          <button
                            type="button"
                            onClick={generateUniqueUsername}
                            className="h-12 px-4 rounded-2xl bg-brand-100 dark:bg-brand-500/20 text-brand-700 dark:text-brand-300 text-xs font-bold hover:bg-brand-200 transition-all flex items-center shrink-0 cursor-pointer"
                            title="Auto-suggest unique username"
                          >
                            <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Suggest Username
                          </button>
                        </div>
                        {formErrors.username ? (
                          <p className="text-[10px] text-rose-500 font-bold ml-1 flex items-center gap-1">
                            <AlertCircle size={12} className="shrink-0" />
                            <span>{formErrors.username}</span>
                          </p>
                        ) : (
                          <p className="text-[10px] text-slate-400 font-semibold ml-1">
                            Unique staff login handle. Click "Suggest Username" to generate a unique handle.
                          </p>
                        )}
                      </div>

                      {/* Password */}
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">Initial Password *</label>
                          <div className="relative">
                            <input
                              type={showPassword ? "text" : "password"}
                              value={formData.password}
                              onChange={e => setFormData({...formData, password: e.target.value})}
                              placeholder="••••••••"
                              className={`w-full h-12 pl-4 pr-10 rounded-2xl border ${formErrors.password ? 'border-rose-400 ring-2 ring-rose-500/10' : 'border-slate-200 dark:border-navy-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20'} bg-slate-50 dark:bg-navy-950 text-xs font-bold text-slate-900 dark:text-white outline-none transition-all`}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-brand-500 p-1 cursor-pointer"
                            >
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          {formErrors.password && <p className="text-[10px] text-rose-500 font-bold ml-1">{formErrors.password}</p>}
                        </div>

                        {/* Password Checklist & Strength */}
                        <div className="p-3.5 rounded-2xl bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-800 space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black uppercase text-slate-400">Password Strength</span>
                            <span className={`text-xs font-black ${strengthStr === 'Strong' ? 'text-emerald-500' : strengthStr === 'Fair' ? 'text-amber-500' : 'text-rose-500'}`}>
                              {formData.password ? strengthStr : 'None'}
                            </span>
                          </div>

                          <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-navy-800 overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 ${
                                strengthScore <= 2 ? 'bg-rose-500 w-1/3' : strengthScore <= 4 ? 'bg-amber-500 w-2/3' : 'bg-emerald-500 w-full'
                              }`}
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-1.5 pt-1 text-[11px] font-bold">
                            <div className={`flex items-center gap-1.5 ${pwReqs.length ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                              {pwReqs.length ? <Check className="w-3.5 h-3.5" /> : <div className="w-3 h-3 rounded-full border border-slate-300" />} Min 8 chars
                            </div>
                            <div className={`flex items-center gap-1.5 ${pwReqs.upper ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                              {pwReqs.upper ? <Check className="w-3.5 h-3.5" /> : <div className="w-3 h-3 rounded-full border border-slate-300" />} Uppercase
                            </div>
                            <div className={`flex items-center gap-1.5 ${pwReqs.lower ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                              {pwReqs.lower ? <Check className="w-3.5 h-3.5" /> : <div className="w-3 h-3 rounded-full border border-slate-300" />} Lowercase
                            </div>
                            <div className={`flex items-center gap-1.5 ${pwReqs.number ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                              {pwReqs.number ? <Check className="w-3.5 h-3.5" /> : <div className="w-3 h-3 rounded-full border border-slate-300" />} Number
                            </div>
                            <div className={`flex items-center gap-1.5 col-span-2 ${pwReqs.special ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                              {pwReqs.special ? <Check className="w-3.5 h-3.5" /> : <div className="w-3 h-3 rounded-full border border-slate-300" />} Special character (@#$%)
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Confirm Password */}
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">Confirm Password *</label>
                          <div className="relative">
                            <input
                              type={showConfirmPassword ? "text" : "password"}
                              value={formData.confirm_password}
                              onChange={e => setFormData({...formData, confirm_password: e.target.value})}
                              placeholder="••••••••"
                              className={`w-full h-12 pl-4 pr-10 rounded-2xl border ${formData.confirm_password && !passwordsMatch ? 'border-rose-400 ring-2 ring-rose-500/10' : 'border-slate-200 dark:border-navy-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20'} bg-slate-50 dark:bg-navy-950 text-xs font-bold text-slate-900 dark:text-white outline-none transition-all`}
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-brand-500 p-1 cursor-pointer"
                            >
                              {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          {formErrors.confirm_password && <p className="text-[10px] text-rose-500 font-bold ml-1">{formErrors.confirm_password}</p>}
                        </div>

                        {formData.confirm_password && (
                          <div className="p-3.5 rounded-2xl bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-800 flex items-center gap-2">
                            {passwordsMatch ? (
                              <><CheckCircle className="w-4 h-4 text-emerald-500" /><span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Passwords match</span></>
                            ) : (
                              <><AlertCircle className="w-4 h-4 text-rose-500" /><span className="text-xs font-bold text-rose-500">Passwords do not match</span></>
                            )}
                          </div>
                        )}
                      </div>

                    </div>
                  </section>
                )}

                {/* STEP 3: CONTACT INFORMATION */}
                {activeStep === 3 && (
                  <section className="space-y-6 animate-fade-in">
                    <div>
                      <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                        <Mail className="w-5 h-5 text-brand-500" /> 3. Contact Information
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                        Provide official contact details and institutional identity numbers.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      
                      {/* Email Address */}
                      <div className="space-y-1.5 col-span-1 sm:col-span-2">
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">Email Address (Official / Primary) *</label>
                        <input
                          type="email"
                          value={formData.email}
                          onChange={e => setFormData({...formData, email: e.target.value})}
                          placeholder="faculty@nandhaengg.org or name@gmail.com"
                          className={`w-full h-12 px-4 rounded-2xl border ${formErrors.email ? 'border-rose-400 ring-2 ring-rose-500/10' : 'border-slate-200 dark:border-navy-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20'} bg-slate-50 dark:bg-navy-950 text-xs font-bold text-slate-900 dark:text-white outline-none transition-all`}
                        />
                        {formErrors.email && <p className="text-[10px] text-rose-500 font-bold ml-1">{formErrors.email}</p>}
                      </div>

                      {/* Phone Number */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">Phone Number *</label>
                        <input
                          type="tel"
                          value={formData.phone_number}
                          onChange={e => setFormData({...formData, phone_number: e.target.value})}
                          placeholder="+91 98765 43210"
                          className={`w-full h-12 px-4 rounded-2xl border ${formErrors.phone_number ? 'border-rose-400 ring-2 ring-rose-500/10' : 'border-slate-200 dark:border-navy-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20'} bg-slate-50 dark:bg-navy-950 text-xs font-bold text-slate-900 dark:text-white outline-none transition-all`}
                        />
                        {formErrors.phone_number && <p className="text-[10px] text-rose-500 font-bold ml-1">{formErrors.phone_number}</p>}
                      </div>

                      {/* Date of Birth */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">Date of Birth *</label>
                        <input
                          type="text"
                          name="staff_dob_ignore_autofill"
                          id="staff_dob_ignore_autofill"
                          autoComplete="off"
                          value={formData.date_of_birth}
                          onChange={handleDOBChange}
                          placeholder="DD / MM / YYYY"
                          className={`w-full h-12 px-4 rounded-2xl border ${formErrors.date_of_birth ? 'border-rose-400 ring-2 ring-rose-500/10' : 'border-slate-200 dark:border-navy-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20'} bg-slate-50 dark:bg-navy-950 text-xs font-bold text-slate-900 dark:text-white outline-none transition-all`}
                        />
                        {formErrors.date_of_birth && <p className="text-[10px] text-rose-500 font-bold ml-1">{formErrors.date_of_birth}</p>}
                      </div>

                      {/* Institutional ID */}
                      <div className="space-y-1.5 col-span-1 sm:col-span-2">
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">Institutional Staff ID *</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={formData.institutional_id}
                            onChange={e => setFormData({...formData, institutional_id: e.target.value})}
                            placeholder="e.g. NEC-STAFF-FAC-098"
                            className={`flex-1 h-12 px-4 rounded-2xl border ${formErrors.institutional_id ? 'border-rose-400 ring-2 ring-rose-500/10' : 'border-slate-200 dark:border-navy-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20'} bg-slate-50 dark:bg-navy-950 text-xs font-bold text-slate-900 dark:text-white outline-none transition-all`}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const randomHex = Math.floor(Math.random() * 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
                              const rolePrefix = isGlobalRole ? 'ADM' : 'FAC';
                              setFormData(prev => ({ ...prev, institutional_id: `NEC-STAFF-${rolePrefix}-${randomHex}` }));
                            }}
                            className="h-12 px-4 rounded-2xl bg-brand-100 dark:bg-brand-500/20 text-brand-700 dark:text-brand-300 text-xs font-bold hover:bg-brand-200 transition-all flex items-center shrink-0 cursor-pointer"
                          >
                            <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Generate ID
                          </button>
                        </div>
                        {formErrors.institutional_id && <p className="text-[10px] text-rose-500 font-bold ml-1">{formErrors.institutional_id}</p>}
                      </div>

                    </div>
                  </section>
                )}

                {/* STEP 4: STAFF VERIFICATION */}
                {activeStep === 4 && (
                  <section className="space-y-6 animate-fade-in">
                    <div>
                      <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                        <FileCheck className="w-5 h-5 text-emerald-500" /> 4. Staff Verification
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                        Upload employee verification credentials and specify institutional reporting hierarchy.
                      </p>
                    </div>

                    <div className="space-y-5">
                      
                      {/* Document Upload Card */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                          Employee ID Proof / Document (Optional)
                        </label>
                        <label className="relative flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-slate-300 dark:border-navy-700 rounded-3xl bg-white dark:bg-navy-950 hover:bg-slate-50 dark:hover:bg-navy-900 transition-all group overflow-hidden">
                          <div className="flex flex-col items-center justify-center text-center p-4">
                            <UploadCloud className="w-8 h-8 text-slate-400 group-hover:text-brand-500 transition-colors mb-2" />
                            {idProofFile ? (
                              <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs">
                                <CheckCircle className="w-4 h-4" /> {idProofFile.name} ({(idProofFile.size / (1024 * 1024)).toFixed(2)} MB)
                              </div>
                            ) : (
                              <>
                                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                                  <span className="text-brand-600 dark:text-brand-400 underline">Upload Verification Document</span> or drag and drop
                                </p>
                                <p className="text-[10px] text-slate-400 mt-1 font-semibold">PDF, JPG, PNG • Max 5 MB</p>
                              </>
                            )}
                          </div>
                          <input
                            type="file"
                            className="hidden"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={e => setIdProofFile(e.target.files?.[0] || null)}
                          />
                        </label>
                      </div>

                      {/* Reporting Manager */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">Reporting Manager / HOD (Optional)</label>
                        <CustomDropdown
                          options={staffOptions}
                          label=""
                          value={formData.reporting_manager}
                          onChange={(val) => setFormData({...formData, reporting_manager: val})}
                          placeholder="Select Reporting Manager..."
                          icon={User}
                        />
                      </div>

                    </div>
                  </section>
                )}

                {/* STEP 5: PERMISSIONS & AGREEMENT */}
                {activeStep === 5 && (
                  <section className="space-y-6 animate-fade-in">
                    <div>
                      <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                        <Shield className="w-5 h-5 text-indigo-500" /> 5. Permissions & Agreement
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                        Review automatically assigned institutional permissions and accept compliance terms.
                      </p>
                    </div>

                    <div className="space-y-5">
                      
                      {/* Permissions List */}
                      <div className="bg-white dark:bg-navy-950 rounded-2xl p-5 border border-slate-200 dark:border-navy-800 space-y-3">
                        <h4 className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                          Inherited Role Permissions
                        </h4>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 text-emerald-800 dark:text-emerald-400 text-xs font-bold">
                            <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" /> View Student Profiles
                          </div>
                          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 text-emerald-800 dark:text-emerald-400 text-xs font-bold">
                            <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" /> View LeetCode Progress
                          </div>
                          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 text-emerald-800 dark:text-emerald-400 text-xs font-bold">
                            <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" /> View Analytics & Reports
                          </div>

                          {isGlobalRole ? (
                            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-brand-50 dark:bg-brand-950/20 border border-brand-100 dark:border-brand-900/30 text-brand-800 dark:text-brand-400 text-xs font-bold">
                              <CheckCircle className="w-4 h-4 text-brand-500 shrink-0" /> Global Administrative Actions
                            </div>
                          ) : (
                            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200/60 dark:border-navy-800 text-slate-400 text-xs font-bold opacity-60">
                              <X className="w-4 h-4 text-slate-400 shrink-0" /> Global Admin Actions (Restricted)
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Options Checkboxes */}
                      <div className="space-y-3">
                        <label className="flex items-center gap-3 p-3.5 rounded-2xl bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-navy-850 transition-colors min-h-[48px]">
                          <input
                            type="checkbox"
                            checked={formData.send_email}
                            onChange={e => setFormData({...formData, send_email: e.target.checked})}
                            className="w-5 h-5 min-w-[20px] min-h-[20px] accent-brand-600 rounded cursor-pointer shrink-0"
                          />
                          <div>
                            <span className="text-xs font-bold text-slate-900 dark:text-white block">Send Welcome Credentials Email</span>
                            <span className="text-[10px] text-slate-400">Dispatch login setup instructions to official email.</span>
                          </div>
                        </label>

                        <label className={`flex items-start gap-3 p-4 rounded-2xl border transition-all cursor-pointer min-h-[56px] ${
                          formErrors.consent 
                            ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800/60 ring-2 ring-rose-500/20'
                            : formData.consent_checked
                            ? 'bg-brand-50/40 dark:bg-brand-950/20 border-brand-200 dark:border-brand-800/60'
                            : 'bg-slate-50 dark:bg-navy-950 border-slate-200 dark:border-navy-800'
                        }`}>
                          <div className="relative flex items-center justify-center shrink-0 mt-0.5">
                            <input
                              type="checkbox"
                              checked={formData.consent_checked}
                              onChange={e => {
                                setFormData({...formData, consent_checked: e.target.checked});
                                if (formErrors.consent) setFormErrors({...formErrors, consent: ''});
                              }}
                              className="peer absolute w-full h-full opacity-0 cursor-pointer z-10"
                            />
                            <div className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors ${
                              formData.consent_checked
                                ? 'bg-brand-600 border-brand-600'
                                : 'bg-white dark:bg-navy-950 border-slate-300 dark:border-navy-600 peer-hover:border-brand-400'
                            }`}>
                              {formData.consent_checked && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-extrabold text-slate-900 dark:text-white block">
                              Institutional Compliance & Authorization Acknowledgment *
                            </span>
                            <span className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed block mt-1">
                              I verify that this staff member is authorized to access student academic records for Nandha Engineering College and agree to strictly enforce institutional data privacy regulations.
                            </span>
                            {formErrors.consent && (
                              <p className="text-xs text-rose-600 dark:text-rose-400 font-bold mt-2 flex items-center gap-1.5 animate-shake">
                                <AlertCircle size={14} className="shrink-0 text-rose-500" />
                                <span>{formErrors.consent}</span>
                              </p>
                            )}
                          </div>
                        </label>


                      </div>

                    </div>
                  </section>
                )}

              </form>
            </div>
          </div>
        )}

        {/* FOOTER ACTIONS */}
        {!createdStaffSummary && (
          <div className="flex flex-col shrink-0">
            {Object.keys(formErrors).length > 0 && (
              <div className="px-6 py-2.5 bg-rose-100/90 dark:bg-rose-950/70 border-t border-rose-300 dark:border-rose-800 text-xs font-extrabold text-rose-900 dark:text-rose-200 flex items-center justify-between gap-2 animate-shake z-30">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                  <span>Form incomplete: Please fix highlighted error(s) above before submitting.</span>
                </div>
                {formErrors.consent && (
                  <span className="text-[11px] font-black uppercase bg-rose-200 dark:bg-rose-900/80 text-rose-800 dark:text-rose-200 px-2 py-0.5 rounded">
                    Check box on Step 5 required
                  </span>
                )}
              </div>
            )}
            <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-slate-50/95 dark:bg-navy-950/95 border-t border-slate-200 dark:border-navy-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 z-20 pb-[calc(0.85rem+env(safe-area-inset-bottom,0px))]">
              <div className="flex items-center justify-between sm:justify-start gap-3 w-full sm:w-auto">
                <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                  Step {activeStep} of 5
                </span>
                <div className="flex-1 sm:w-36 h-2 rounded-full bg-slate-200 dark:bg-navy-800 overflow-hidden">
                  <div className="h-full bg-brand-600 transition-all duration-300" style={{ width: `${progressPercent}%` }} />
                </div>
                <span className="text-xs font-mono font-bold text-brand-600 dark:text-brand-400 whitespace-nowrap">
                  {progressPercent}%
                </span>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-navy-800 transition-all cursor-pointer min-h-[44px] flex items-center justify-center"
                >
                  Cancel
                </button>

                <div className="flex items-center gap-2">
                  {activeStep > 1 && (
                    <button
                      type="button"
                      onClick={handlePrevStep}
                      disabled={isSubmitting}
                      className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 hover:bg-slate-50 transition-all flex items-center gap-1 cursor-pointer min-h-[44px]"
                    >
                      <ChevronLeft className="w-4 h-4" /> Back
                    </button>
                  )}

                  {activeStep < 5 ? (
                    <button
                      type="button"
                      onClick={handleNextStep}
                      className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 transition-all shadow-md shadow-brand-500/20 flex items-center gap-1.5 cursor-pointer min-h-[44px]"
                    >
                      Continue <ChevronRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      form="create-staff-form"
                      type="submit"
                      disabled={isSubmitting}
                      className="px-5 py-2.5 rounded-xl text-xs font-black text-white bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 transition-all shadow-lg shadow-brand-500/25 flex items-center gap-2 cursor-pointer min-h-[44px]"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-4 h-4" />
                          Create Institutional Account
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </GlobalModalBackdrop>
  );
};
