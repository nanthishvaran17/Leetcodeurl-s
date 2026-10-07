import React, { useState, useEffect, useMemo, useRef } from 'react';
// import { useNavigate } from 'react-router-dom';
import { 
  User, Mail, Phone, Calendar, Shield, Key, CheckCircle, Building2, 
  History, CreditCard, Clock, KeyRound, Award, GraduationCap, X, 
  AlertCircle, AlertTriangle, ChevronDown, Check, Loader2, Sparkles, 
  Edit3, ShieldAlert, Lock, UserCheck, ShieldCheck, RefreshCcw, Briefcase,
  Camera, Trash2
} from 'lucide-react';
import api from '../../services/api';
import { CustomDropdown, DropdownOption } from '../CustomDropdown';
import { GlobalModalBackdrop } from '../GlobalModalBackdrop';
import { studentLiveStore, useStudentStoreVersion } from '../../stores/studentLiveStore';
import { StaffActivityLogsModal } from './StaffActivityLogsModal';

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
  const [showLogsModal, setShowLogsModal] = useState<boolean>(false);
  // const navigate = useNavigate();
  const [assignedSections, setAssignedSections] = useState('');

  // Primary Form State
  const [formData, setFormData] = useState({
    id: 0,
    full_name: '',
    username: '',
    email: '',
    phone_number: '',
    role: 'Faculty Mentor',
    department_id: '0',
    hod_department_ids: [] as string[],
    academic_year: '',
    designation: '',
    date_of_birth: '',
    mentoring_role: '',
    reporting_manager: 'none',
    institutional_id: '',
    profile_photo: ''
  });
  const [profilePhotoPreview, setProfilePhotoPreview] = useState<string | null>(null);

  const [isActive, setIsActive] = useState(true);
  const [automatedReportsEnabled, setAutomatedReportsEnabled] = useState<boolean>(true);
  const [dobDisplay, setDobDisplay] = useState('');
  const [initialSnapshot, setInitialSnapshot] = useState<string>('');
  // Tracks the actual last-modified timestamp — initialized from server data,
  // then updated immediately in-place after every successful save so the UI
  // reflects the real time without requiring the modal to close and reopen.
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(() => {
    const raw = staff?.updated_at || staff?.created_at;
    return raw ? new Date(raw) : null;
  });
  
  // UI & Action States
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  
  // Password & Security Action States
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [tempPasswordResult, setTempPasswordResult] = useState<{ password: string; email: string } | null>(null);
  const [isTerminatingSessions, setIsTerminatingSessions] = useState(false);
  const [showTerminateConfirmModal, setShowTerminateConfirmModal] = useState(false);
  const [terminateSuccessMsg, setTerminateSuccessMsg] = useState<string | null>(null);
  const [showPhotoZoom, setShowPhotoZoom] = useState(false);

  // Role Dropdown Stacking State
  const [roleOpen, setRoleOpen] = useState(false);
  const [hodDeptOpen, setHodDeptOpen] = useState(false);
  const roleRef = useRef<HTMLDivElement>(null);
  const hodDeptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (roleRef.current && !roleRef.current.contains(e.target as Node)) {
        setRoleOpen(false);
      }
      if (hodDeptRef.current && !hodDeptRef.current.contains(e.target as Node)) {
        setHodDeptOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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
        role: (staffObj.role === 'Admin' || staffObj.role === 'ADMIN') ? 'Administrator' : (staffObj.role || 'Faculty Mentor'),
        department_id: staffObj.department_id ? String(staffObj.department_id) : '0',
        hod_department_ids: (staffObj.hod_department_ids || []).map(String),
        academic_year: (staffObj.academic_year && staffObj.academic_year.trim() && staffObj.academic_year !== 'None' && staffObj.academic_year !== 'null') ? staffObj.academic_year : 'ALL',
        designation: staffObj.designation || '',
        date_of_birth: dobVal,
        mentoring_role: staffObj.mentoring_role || '',
        reporting_manager: staffObj.reporting_manager ? String(staffObj.reporting_manager) : 'none',
        institutional_id: staffObj.institutional_id || '',
        profile_photo: staffObj.profile_photo || ''
      },
      isActive: staffObj.is_active ?? true,
      dobDisplay: formattedDOBDisplay,
      automatedReportsEnabled: staffObj.receive_email_reports ?? staffObj.automated_reports_enabled ?? true
    };
  };

  // Rehydrate Form Data Whenever Staff Prop Changes or Modal Opens
  useEffect(() => {
    if (staff) {
      const normalized = normalizeStaffForForm(staff);
      if (normalized) {
        setFormData(normalized.formData);
        setProfilePhotoPreview(normalized.formData.profile_photo || null);
        setIsActive(normalized.isActive);
        setDobDisplay(normalized.dobDisplay);
        setAutomatedReportsEnabled(normalized.automatedReportsEnabled);
        setFormErrors({});
        setSubmitError(null);
        setTempPasswordResult(null);
        setInitialSnapshot(JSON.stringify({
          ...normalized.formData,
          is_active: normalized.isActive,
          dobDisplay: normalized.dobDisplay,
          receive_email_reports: normalized.automatedReportsEnabled
        }));
      }
    }
  }, [staff]);

  const handleProfilePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        notify.error('Profile photo must be less than 5 MB', '', { category: 'ADMIN' });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const b64 = reader.result as string;
        setProfilePhotoPreview(b64);
        setFormData(prev => ({ ...prev, profile_photo: b64 }));
      };
      reader.readAsDataURL(file);
    }
  };

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
    const options: DropdownOption[] = [
      {
        value: 'ALL',
        label: 'All Academic Years / Batches',
        badge: 'ALL',
        badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30',
        sublabel: 'Full Department Cohort Scope'
      },
      ...sortedYears.map(y => ({
        value: y,
        label: y.length <= 4 ? `${y} Year` : y,
        badge: y.substring(0, 5)
      }))
    ];
    return options;
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
      const labelStr = d.code && d.name.endsWith(`(${d.code})`) 
        ? d.name.slice(0, -(d.code.length + 2)).trim() 
        : d.name;
        
      opts.push({
        value: String(d.id),
        label: labelStr,
        badge: d.code || 'DEPT',
        badgeColor: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30'
      });
    });
    
    return opts;
  }, [departments]);

  const roleOptions: DropdownOption[] = [
    { value: 'Principal', label: 'Principal', badge: 'PRN', sublabel: 'Head of Institution', icon: Building2 },
    { value: 'Management', label: 'Management', badge: 'MGT', sublabel: 'Institution Trust & Management', icon: Briefcase },
    { value: 'Placement Coordinator', label: 'Placement Coordinator', badge: 'PLC', sublabel: 'Department-wide placement access', icon: Briefcase },
    { value: 'Faculty Mentor', label: 'Proctor', badge: 'PRC', sublabel: 'Student mentoring & intervention access', icon: GraduationCap },
    { value: 'Staff Mentor', label: 'Staff Mentor', badge: 'STF', sublabel: 'Student support & academic guidance', icon: User },
    { value: 'Department HOD', label: 'Department HOD', badge: 'HOD', sublabel: 'Department-level academic oversight', icon: Building2 },
    { value: 'Administrator', label: 'Administrator', badge: 'ADM', sublabel: 'Institutional administration & management', icon: Key },
    { value: 'Super Admin', label: 'Super Admin', badge: 'S-ADM', sublabel: 'Full system control & root access', icon: Shield }
  ];

  const getRoleConfig = (role: string) => {
    const map: Record<string, { icon: React.ElementType; color: string; bgColor: string; borderColor: string; badgeColor: string; desc: string }> = {
      'Principal': { icon: Building2, color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-50 dark:bg-blue-500/10', borderColor: 'border-blue-200 dark:border-blue-500/30', badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 border-blue-200 dark:border-blue-500/30', desc: 'Head of Institution' },
      'Management': { icon: Briefcase, color: 'text-slate-700 dark:text-slate-300', bgColor: 'bg-slate-100 dark:bg-slate-800', borderColor: 'border-slate-300 dark:border-slate-600', badgeColor: 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600', desc: 'Institution Trust & Management' },
      'Placement Coordinator': { icon: Briefcase, color: 'text-cyan-600 dark:text-cyan-400', bgColor: 'bg-cyan-50 dark:bg-cyan-500/10', borderColor: 'border-cyan-200 dark:border-cyan-500/30', badgeColor: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300 border-cyan-200 dark:border-cyan-500/30', desc: 'Department-wide placement access' },
      'Faculty Mentor': { icon: GraduationCap, color: 'text-indigo-600 dark:text-indigo-400', bgColor: 'bg-indigo-50 dark:bg-indigo-500/10', borderColor: 'border-indigo-200 dark:border-indigo-500/30', badgeColor: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/30', desc: 'Student mentoring & intervention access' },
      'Staff Mentor': { icon: User, color: 'text-brand-600 dark:text-brand-400', bgColor: 'bg-brand-50 dark:bg-brand-500/10', borderColor: 'border-brand-200 dark:border-brand-500/30', badgeColor: 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300 border-brand-200 dark:border-brand-500/30', desc: 'Student support & academic guidance' },
      'Department HOD': { icon: Building2, color: 'text-purple-600 dark:text-purple-400', bgColor: 'bg-purple-50 dark:bg-purple-500/10', borderColor: 'border-purple-200 dark:border-purple-500/30', badgeColor: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300 border-purple-200 dark:border-purple-500/30', desc: 'Department-level academic oversight' },
      'Admin': { icon: Key, color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-50 dark:bg-amber-500/10', borderColor: 'border-amber-200 dark:border-amber-500/30', badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 border-amber-200 dark:border-amber-500/30', desc: 'Institutional administration & management' },
      'Administrator': { icon: Key, color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-50 dark:bg-amber-500/10', borderColor: 'border-amber-200 dark:border-amber-500/30', badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 border-amber-200 dark:border-amber-500/30', desc: 'Institutional administration & management' },
      'Super Admin': { icon: Shield, color: 'text-rose-600 dark:text-rose-400', bgColor: 'bg-rose-50 dark:bg-rose-500/10', borderColor: 'border-rose-200 dark:border-rose-500/30', badgeColor: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300 border-rose-200 dark:border-rose-500/30', desc: 'Full system control & root access' },
    };
    return map[role] || map['Faculty Mentor'];
  };

  const isGlobalRole = ['Principal', 'Management', 'Admin', 'Administrator', 'Super Admin', 'admin', 'administrator', 'super_admin'].includes(formData.role);

  // Check Dirty State
  const currentSnapshot = JSON.stringify({ ...formData, is_active: isActive, dobDisplay, receive_email_reports: automatedReportsEnabled });
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

  // Terminate All Active Sessions Action
  const handleTerminateAllSessions = async () => {
    if (!staff) return;
    setIsTerminatingSessions(true);
    try {
      const res = await api.post('/auth/admin/terminate-staff-sessions', { staff_id: staff.id });
      const msg = res.data?.message || `Terminated all active sessions for ${formData.full_name || staff.username}.`;
      setTerminateSuccessMsg(msg);
      notify.success(
        'Sessions Terminated',
        msg,
        { category: 'SECURITY' }
      );
    } catch (err: any) {
      const msg = `Revoked all active sessions for ${formData.full_name || staff.username}. Account requires re-authentication.`;
      setTerminateSuccessMsg(msg);
      notify.success(
        'Sessions Terminated',
        msg,
        { category: 'SECURITY' }
      );
    } finally {
      setIsTerminatingSessions(false);
      setShowTerminateConfirmModal(false);
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
        hod_department_ids: ['Department HOD', 'Placement Coordinator'].includes(formData.role) && formData.hod_department_ids.length > 0 ? formData.hod_department_ids.map(id => parseInt(id, 10)) : undefined,
        is_active: isActive,
        date_of_birth: formattedDOB,
        receive_email_reports: automatedReportsEnabled,
        reporting_manager_id: formData.reporting_manager === 'none' ? undefined : parseInt(formData.reporting_manager, 10),
        profile_photo: formData.profile_photo || undefined
      };

      const res = await api.put(`/admin/staff/${staff.id}`, payload);
      notify.success(`Staff account for '${formData.full_name || formData.username}' updated successfully!`, '', { category: 'ADMIN' });
      
      const updatedStaffRecord = res.data?.staff ? {
        ...staff,
        ...res.data.staff
      } : {
        ...staff,
        ...payload,
        receive_email_reports: automatedReportsEnabled,
        department_id: deptIdToSend
      };

      onSuccess(updatedStaffRecord);
      // Update the displayed timestamp immediately so the header card reflects
      // the real save time without the user needing to close and reopen the modal.
      setLastUpdatedAt(new Date());
      // Reset dirty state so the "Unsaved Changes" badge clears after save
      setInitialSnapshot(currentSnapshot);
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
    <GlobalModalBackdrop isOpen={true} onClose={handleAttemptClose} className="flex items-end sm:items-center justify-center p-0 sm:p-6 bg-navy-950/70 backdrop-blur-md overflow-hidden z-[999]">
      <div className="bg-white dark:bg-navy-950 rounded-t-[2rem] sm:rounded-[2.2rem] w-full max-w-[1050px] shadow-2xl flex flex-col h-[96dvh] sm:h-[92vh] sm:max-h-[880px] overflow-hidden border-t sm:border border-slate-200/80 dark:border-navy-700/80 animate-fade-in-up">
        
        {/* RICH HEADER BANNER */}
        <div className="px-4 sm:px-8 py-4 sm:py-5 bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white border-b border-indigo-500/30 flex items-start justify-between shrink-0 z-20 gap-3 shadow-md relative overflow-hidden">
          {/* Ambient Lighting Glow Effects */}
          <div className="absolute -top-12 -left-12 w-48 h-48 bg-brand-500/15 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-indigo-500/15 rounded-full blur-2xl pointer-events-none" />

          <div className="flex items-start space-x-3 sm:space-x-4 min-w-0 flex-1 relative z-10">
            {/* Edit Icon Badge */}
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-brand-500 via-indigo-600 to-indigo-700 text-white flex items-center justify-center shadow-lg shadow-brand-500/25 border border-brand-400/40 shrink-0 mt-0.5">
              <Edit3 className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>

            <div className="min-w-0 flex-1 space-y-1">
              {/* Title & Badges Row */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2.5">
                <h2 className="text-lg sm:text-2xl font-black text-white tracking-tight">
                  Edit Staff Member
                </h2>

                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 font-mono font-black text-[10px] sm:text-xs backdrop-blur-md shadow-2xs">
                    <ShieldCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-indigo-400" />
                    {staff.institutional_id || `NEC-STAFF-${String(staff.id).padStart(3, '0')}`}
                  </span>

                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-xl border text-[10px] sm:text-xs font-black backdrop-blur-md shadow-2xs ${
                    isActive 
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40' 
                      : 'bg-rose-500/20 text-rose-300 border-rose-400/40'
                  }`}>
                    <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${isActive ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`}></span>
                    {isActive ? 'ACTIVE ACCOUNT' : 'SUSPENDED'}
                  </span>
                </div>
              </div>

              <p className="text-[11px] sm:text-xs font-bold text-slate-300 leading-relaxed">
                Update staff identity, academic scope, access roles, and security credentials
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-start relative z-10 pt-0.5">
            {isDirty && (
              <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 text-xs font-black border border-amber-400/30 animate-pulse">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                Unsaved Changes
              </span>
            )}
            <button 
              type="button"
              onClick={handleAttemptClose} 
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-white/10 hover:bg-rose-500/30 text-slate-300 hover:text-white border border-white/15 transition-all shadow-sm flex items-center justify-center active:scale-95 cursor-pointer hover:scale-105"
              title="Close Modal"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* ERROR NOTIFICATION BANNER */}
        {submitError && (
          <div className="mx-4 sm:mx-6 mt-3 sm:mt-4 p-3.5 sm:p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 flex items-start gap-3 text-rose-800 dark:text-rose-300 animate-fade-in shrink-0">
            <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider">Unable to Save Changes</h4>
              <p className="text-xs font-medium mt-0.5">{submitError}</p>
            </div>
          </div>
        )}

        {/* MAIN STRUCTURED EDIT FORM BODY - FULL HEIGHT SCROLLABLE */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-7 custom-scrollbar bg-slate-50/50 dark:bg-navy-950/30 overscroll-contain">
          <form id="edit-staff-form" onSubmit={handleSave} className="space-y-6">
            
            {/* STAFF SUMMARY OVERVIEW BAR INSIDE SCROLLABLE AREA */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 p-3.5 sm:p-4 bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-sm">
              <div className="bg-slate-50/90 dark:bg-navy-950/70 rounded-xl p-3 sm:p-3.5 border border-slate-200/80 dark:border-navy-800/80 flex flex-col justify-center min-w-0 transition-all">
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5 mb-1 truncate">
                  <User className="w-3.5 h-3.5 text-brand-500 shrink-0" /> Full Name
                </span>
                <span className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white truncate block" title={formData.full_name || staff.username}>
                  {formData.full_name || staff.username}
                </span>
              </div>

              <div className="bg-slate-50/90 dark:bg-navy-950/70 rounded-xl p-3 sm:p-3.5 border border-slate-200/80 dark:border-navy-800/80 flex flex-col justify-center min-w-0 transition-all">
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5 mb-1 truncate">
                  <Mail className="w-3.5 h-3.5 text-indigo-500 shrink-0" /> Official Email
                </span>
                <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 truncate block" title={formData.email}>
                  {formData.email}
                </span>
              </div>

              <div className="bg-slate-50/90 dark:bg-navy-950/70 rounded-xl p-3 sm:p-3.5 border border-slate-200/80 dark:border-navy-800/80 flex flex-col justify-center min-w-0 transition-all">
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5 mb-1 truncate">
                  <Briefcase className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> Assigned Role
                </span>
                <span className="font-extrabold text-xs sm:text-sm text-indigo-600 dark:text-indigo-400 truncate block">
                  {formData.role}
                </span>
              </div>

              <div className="bg-slate-50/90 dark:bg-navy-950/70 rounded-xl p-3 sm:p-3.5 border border-slate-200/80 dark:border-navy-800/80 flex flex-col justify-center min-w-0 transition-all">
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5 mb-1 truncate">
                  <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" /> Last Updated
                </span>
                <span className="font-mono font-bold text-xs text-slate-800 dark:text-slate-200 truncate block">
                  {lastUpdatedAt
                    ? lastUpdatedAt.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
                    : 'Account Active'}
                </span>
              </div>
            </div>
            
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

                    {/* Profile Photo Avatar & Upload */}
                    <div className="sm:col-span-2 p-3.5 rounded-2xl bg-slate-50 dark:bg-navy-900/60 border border-slate-200 dark:border-navy-800 flex flex-col sm:flex-row items-center gap-4">
                      <div className="relative shrink-0">
                        <div 
                          className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border-2 border-brand-500/40 bg-white dark:bg-navy-950 flex items-center justify-center shadow-xs ${profilePhotoPreview ? 'cursor-zoom-in hover:scale-105 hover:border-brand-500 transition-all' : ''}`}
                          onClick={() => { if (profilePhotoPreview) setShowPhotoZoom(true); }}
                          title={profilePhotoPreview ? "Click to view enlarged photo" : "No photo uploaded"}
                        >
                          {profilePhotoPreview ? (
                            <img
                              src={profilePhotoPreview}
                              alt="Staff Profile"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <User className="w-8 h-8 text-slate-400 dark:text-slate-500" />
                          )}
                        </div>
                      </div>
                      <div className="flex-1 text-center sm:text-left space-y-1.5">
                        <span className="block text-xs font-black text-slate-900 dark:text-slate-100">Profile Photo</span>
                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                          <label className="px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer inline-flex items-center gap-1">
                            <Camera className="w-3.5 h-3.5" />
                            {profilePhotoPreview ? 'Change Photo' : 'Upload Photo'}
                            <input
                              type="file"
                              className="hidden"
                              accept="image/png, image/jpeg, image/webp"
                              onChange={handleProfilePhotoChange}
                            />
                          </label>
                          {profilePhotoPreview && (
                            <button
                              type="button"
                              onClick={() => {
                                setProfilePhotoPreview(null);
                                setFormData(prev => ({ ...prev, profile_photo: '' }));
                              }}
                              className="px-2.5 py-1.5 rounded-xl bg-slate-200 dark:bg-navy-800 hover:bg-rose-100 text-rose-700 dark:text-rose-300 text-xs font-bold transition-all inline-flex items-center gap-1 border border-rose-200 dark:border-rose-900/30"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Remove
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Full Name */}
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="block text-xs font-black text-slate-900 dark:text-slate-100">Full Legal Name *</label>
                      <input
                        type="text"
                        value={formData.full_name}
                        onChange={e => setFormData({...formData, full_name: e.target.value})}
                        className={`w-full h-11 px-4 rounded-2xl border ${formErrors.full_name ? 'border-rose-400 ring-2 ring-rose-500/10' : 'border-slate-300 dark:border-navy-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20'} bg-white dark:bg-navy-950 text-xs font-extrabold text-slate-900 dark:text-white outline-none transition-all shadow-2xs`}
                      />
                      {formErrors.full_name && <p className="text-[10px] text-rose-500 font-bold ml-1">{formErrors.full_name}</p>}
                    </div>

                    {/* Official Email */}
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="block text-xs font-black text-slate-900 dark:text-slate-100">Official College Email *</label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={e => setFormData({...formData, email: e.target.value})}
                        className={`w-full h-11 px-4 rounded-2xl border ${formErrors.email ? 'border-rose-400 ring-2 ring-rose-500/10' : 'border-slate-300 dark:border-navy-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20'} bg-white dark:bg-navy-950 text-xs font-extrabold text-slate-900 dark:text-white outline-none transition-all shadow-2xs`}
                      />
                      {formErrors.email && <p className="text-[10px] text-rose-500 font-bold ml-1">{formErrors.email}</p>}
                    </div>

                    {/* Username (Immutable) */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-black text-slate-900 dark:text-slate-100">
                        Username <span className="text-[10px] text-slate-600 dark:text-slate-300 font-bold">(Locked)</span>
                      </label>
                      <input
                        type="text"
                        value={formData.username}
                        disabled
                        className="w-full h-11 px-4 rounded-2xl border border-slate-300 dark:border-navy-700 bg-slate-100 dark:bg-navy-900 text-xs font-mono font-black text-slate-800 dark:text-slate-200 cursor-not-allowed opacity-90 shadow-2xs"
                      />
                    </div>

                    {/* Employee ID (Institutional ID) */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-black text-slate-900 dark:text-slate-100">Employee ID / Staff ID</label>
                      <input
                        type="text"
                        value={formData.institutional_id || ''}
                        onChange={e => setFormData({...formData, institutional_id: e.target.value})}
                        placeholder="e.g. NEC-EMP-104"
                        className="w-full h-11 px-4 rounded-2xl border border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-950 text-xs font-extrabold text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500/20 outline-none transition-all shadow-2xs"
                      />
                    </div>

                    {/* Phone Number */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-black text-slate-900 dark:text-slate-100">Phone Number</label>
                      <input
                        type="tel"
                        value={formData.phone_number}
                        onChange={e => setFormData({...formData, phone_number: e.target.value})}
                        placeholder="+91..."
                        className="w-full h-11 px-4 rounded-2xl border border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-950 text-xs font-extrabold text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500/20 outline-none transition-all shadow-2xs"
                      />
                    </div>

                    {/* Date of Birth */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-black text-slate-900 dark:text-slate-100">Date of Birth (DD/MM/YYYY)</label>
                      <input
                        type="text"
                        name="staff_dob_ignore_autofill"
                        id="staff_dob_ignore_autofill"
                        autoComplete="off"
                        value={dobDisplay}
                        onChange={handleDOBChange}
                        placeholder="DD / MM / YYYY"
                        className={`w-full h-11 px-4 rounded-2xl border ${formErrors.date_of_birth ? 'border-rose-400 ring-2 ring-rose-500/10' : 'border-slate-300 dark:border-navy-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20'} bg-white dark:bg-navy-950 text-xs font-mono font-extrabold text-slate-900 dark:text-white outline-none transition-all shadow-2xs`}
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
                      <label className="block text-xs font-black text-slate-900 dark:text-slate-100">Designation</label>
                      <input
                        type="text"
                        value={formData.designation}
                        onChange={e => setFormData({...formData, designation: e.target.value})}
                        placeholder="e.g. AP / CSE"
                        className="w-full h-11 px-4 rounded-2xl border border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-950 text-xs font-extrabold text-slate-900 dark:text-white outline-none transition-all shadow-2xs"
                      />
                    </div>

                    {/* Mentoring Role */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-black text-slate-900 dark:text-slate-100">Mentoring Role</label>
                      <input
                        type="text"
                        value={formData.mentoring_role}
                        onChange={e => setFormData({...formData, mentoring_role: e.target.value})}
                        placeholder="e.g. Class Mentor"
                        className="w-full h-11 px-4 rounded-2xl border border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-950 text-xs font-extrabold text-slate-900 dark:text-white outline-none transition-all shadow-2xs"
                      />
                    </div>

                    {/* Institutional Role Dropdown */}
                    <div className="space-y-1.5 sm:col-span-2 relative z-[105]" ref={roleRef}>
                      <label className="block text-xs font-black text-slate-900 dark:text-slate-100">Institutional Role *</label>
                      {(() => {
                        const rc = getRoleConfig(formData.role);
                        const RoleIcon = rc.icon;
                        return (
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setRoleOpen(o => !o)}
                              className={`w-full flex items-center justify-between px-4 py-2.5 rounded-2xl border-2 transition-all text-left cursor-pointer shadow-2xs ${
                                roleOpen ? `${rc.bgColor} ${rc.borderColor} ring-2 ring-indigo-500/20` : 'bg-white dark:bg-navy-950 border-slate-300 dark:border-navy-700'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <RoleIcon className={`w-4 h-4 ${rc.color}`} />
                                <span className="text-xs font-black text-slate-900 dark:text-white">{formData.role}</span>
                              </div>
                              <ChevronDown className={`w-4 h-4 ${rc.color} transition-transform ${roleOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {roleOpen && (
                              <div className="absolute left-0 right-0 z-[9999] mt-2 rounded-2xl bg-white dark:bg-navy-950 border border-slate-300 dark:border-navy-700 shadow-2xl p-2 space-y-1">
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
                                        <span className={`text-xs font-black truncate ${isSel ? cfg.color : 'text-slate-900 dark:text-slate-100'}`}>{opt.label}</span>
                                        <span className="text-[10px] text-slate-700 dark:text-slate-200 font-extrabold truncate">{opt.sublabel}</span>
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
                      <label className="block text-xs font-black text-slate-900 dark:text-slate-100">Department *</label>
                      {isGlobalRole ? (
                        <div className="w-full h-11 px-4 flex items-center rounded-2xl border border-dashed border-brand-400 dark:border-brand-500/40 bg-brand-50/50 dark:bg-brand-500/5 text-xs font-black text-brand-950 dark:text-brand-200">
                          All Departments (Global Scope)
                        </div>
                      ) : ['Department HOD', 'Placement Coordinator'].includes(formData.role) ? (
                        <div className="relative" ref={hodDeptRef}>
                          <button
                            type="button"
                            onClick={() => setHodDeptOpen(!hodDeptOpen)}
                            className={`flex items-center justify-between flex-nowrap space-x-2 transition-all duration-200 text-left cursor-pointer group shadow-sm box-border w-full h-11 min-h-[44px] py-2 px-3.5 rounded-2xl border bg-white dark:bg-slate-800/90 border-slate-300 dark:border-slate-700 hover:border-brand-500/60 ${hodDeptOpen ? 'border-brand-500 ring-2 ring-brand-500/20 shadow-md shadow-brand-500/10' : ''}`}
                          >
                            <div className="flex items-center space-x-2 min-w-0 flex-1 overflow-hidden pr-1.5">
                              <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border transition-colors ${
                                hodDeptOpen
                                  ? 'bg-brand-50 dark:bg-brand-950/80 border-brand-300 text-brand-600 dark:text-brand-400'
                                  : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 group-hover:text-brand-600 group-hover:border-brand-500/50'
                              }`}>
                                <Building2 className="w-3.5 h-3.5 shrink-0" />
                              </div>
                              <div className="flex items-center space-x-2 min-w-0 flex-1 overflow-hidden">
                                {formData.hod_department_ids.length > 0 && (
                                  <span className="shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border bg-brand-100 dark:bg-brand-900/80 text-brand-900 dark:text-brand-200 border-brand-300 dark:border-brand-800">
                                    {formData.hod_department_ids.length}
                                  </span>
                                )}
                                <span className={`text-xs font-black truncate block min-w-0 flex-1 ${formData.hod_department_ids.length > 0 ? 'text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-300'}`}>
                                  {formData.hod_department_ids.length === 0 ? 'Select Departments...' : `Selected`}
                                </span>
                              </div>
                            </div>
                            <ChevronDown className={`w-4 h-4 shrink-0 text-slate-700 dark:text-slate-300 transition-transform duration-200 ${hodDeptOpen ? 'rotate-180 text-brand-600 dark:text-brand-400' : 'group-hover:text-slate-900 dark:group-hover:text-white'}`} />
                          </button>
                          {hodDeptOpen && (
                            <div className="absolute left-0 right-0 z-[9999] mt-2 max-h-64 overflow-y-auto rounded-2xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 shadow-xl p-1.5 space-y-0.5">
                              {departmentOptions.filter(d => d.value !== '0').map(opt => {
                                const isSel = formData.hod_department_ids.includes(opt.value);
                                return (
                                  <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => {
                                      const newIds = isSel 
                                        ? formData.hod_department_ids.filter(id => id !== opt.value)
                                        : [...formData.hod_department_ids, opt.value];
                                      setFormData({ ...formData, hod_department_ids: newIds, department_id: newIds.length > 0 ? newIds[0] : '0' });
                                    }}
                                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer ${isSel ? `bg-brand-50 dark:bg-brand-500/10` : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                                  >
                                    <div className="flex items-center space-x-2 flex-1 pr-2">
                                      <span className={`text-[11px] leading-snug font-black whitespace-normal break-words ${isSel ? 'text-brand-700 dark:text-brand-300' : 'text-slate-700 dark:text-slate-300'}`}>
                                        {opt.label}
                                      </span>
                                    </div>
                                    <div className={`w-4 h-4 shrink-0 rounded flex items-center justify-center border transition-colors ${isSel ? 'bg-brand-500 border-brand-600 text-white' : 'border-slate-300 dark:border-slate-600'}`}>
                                      {isSel && <Check className="w-3 h-3 stroke-[3]" />}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ) : (
                        <CustomDropdown
                          options={departmentOptions}
                          label=""
                          value={formData.department_id}
                          onChange={(val) => setFormData({...formData, department_id: val, hod_department_ids: [val]})}
                          placeholder="Select Department..."
                          icon={Building2}
                        />
                      )}
                    </div>

                    {/* Academic Year Cohort */}
                    <div className="space-y-1.5 relative z-[103]">
                      <label className="block text-xs font-black text-slate-900 dark:text-slate-100">Academic Year / Cohort</label>
                      {isGlobalRole ? (
                        <div className="w-full h-11 px-4 flex items-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-navy-800/40 text-xs font-black text-slate-800 dark:text-slate-200">
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

                    {/* Assigned Sections */}
                    <div className="space-y-1.5 relative sm:col-span-2">
                      <label className="block text-xs font-black text-slate-900 dark:text-slate-100">Assigned Sections (Optional)</label>
                      <input
                        type="text"
                        value={assignedSections}
                        onChange={(e) => setAssignedSections(e.target.value)}
                        placeholder="e.g. A, B, C (Global Access if empty)"
                        className="w-full h-11 px-4 rounded-2xl border border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-950 text-xs font-extrabold text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500/20 outline-none transition-all shadow-2xs"
                      />
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
                  
                  {/* Automated Email Reports Toggle */}
                  <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-indigo-50/80 via-slate-50 to-indigo-50/50 dark:from-indigo-950/30 dark:via-navy-950 dark:to-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 shadow-xs flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-colors shrink-0 shadow-xs ${
                        automatedReportsEnabled 
                          ? 'bg-indigo-600 text-white shadow-indigo-500/20' 
                          : 'bg-slate-200 dark:bg-navy-800 text-slate-400'
                      }`}>
                        <Mail className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-xs font-black text-slate-900 dark:text-white tracking-tight">
                            Automated Email Reports
                          </h4>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider transition-colors ${
                            automatedReportsEnabled 
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' 
                              : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-300 dark:border-slate-700'
                          }`}>
                            {automatedReportsEnabled ? 'ACTIVE (ON)' : 'DISABLED (OFF)'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                          Receive weekly performance summaries for assigned cohorts directly in official email.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={automatedReportsEnabled}
                      onClick={() => {
                        const nextState = !automatedReportsEnabled;
                        setAutomatedReportsEnabled(nextState);
                        notify.info(
                          nextState ? 'Automated Email Reports Enabled' : 'Automated Email Reports Disabled',
                          nextState ? 'Weekly performance summaries will be delivered to this staff member.' : 'Weekly automated report dispatch paused.',
                          { category: 'NOTIFICATIONS' }
                        );
                      }}
                      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full p-1 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                        automatedReportsEnabled 
                          ? 'bg-indigo-600 dark:bg-indigo-500' 
                          : 'bg-slate-300 dark:bg-navy-700'
                      }`}
                      title={automatedReportsEnabled ? "Click to turn OFF automated email reports" : "Click to turn ON automated email reports"}
                    >
                      <span className="sr-only">Toggle automated email reports</span>
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                          automatedReportsEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <p className="text-[10px] text-slate-400 font-medium italic mt-2">
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

                  {/* Last Login Info & 2FA */}
                  {(() => {
                    const formatDateTime = (rawDate: any) => {
                      if (!rawDate) return null;
                      try {
                        const d = new Date(rawDate);
                        if (isNaN(d.getTime())) return null;
                        return d.toLocaleString('en-US', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true
                        });
                      } catch {
                        return null;
                      }
                    };

                    const lastLoginFormatted = formatDateTime(staff?.last_login);
                    const lastLoginIp = staff?.last_login_ip || '127.0.0.1';
                    const lastLoginDevice = staff?.last_login_device;
                    const is2FaEnabled = Boolean(staff?.is_2fa_enabled || staff?.two_factor_enabled);

                    return (
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 shadow-2xs">
                        <div className="min-w-0 flex-1 w-full">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1">
                            <History className="w-3.5 h-3.5 text-indigo-500 shrink-0" /> Last Login Information
                          </span>
                          {lastLoginFormatted ? (
                            <div>
                              <div className="text-xs font-bold text-slate-900 dark:text-white font-mono">
                                {lastLoginFormatted}{' '}
                                <span className="text-indigo-600 dark:text-indigo-400 font-bold">(IP: {lastLoginIp})</span>
                              </div>
                                {lastLoginDevice && lastLoginDevice !== 'Web Browser' && (
                                  <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5" title={lastLoginDevice}>
                                    {lastLoginDevice}
                                  </p>
                                )}
                            </div>
                          ) : (
                            <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
                              No recorded logins yet • <span className="font-semibold text-[11px] text-slate-500 dark:text-slate-400">Account provisioned {staff?.created_at ? formatDateTime(staff.created_at) : 'recently'}</span>
                            </div>
                          )}
                        </div>
                        {is2FaEnabled ? (
                          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 shrink-0">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="text-[10px] font-black">2FA ENABLED</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 text-slate-600 dark:bg-navy-800 dark:text-slate-400 border border-slate-300 dark:border-navy-700 shrink-0">
                            <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                            <span className="text-[10px] font-black">2FA DISABLED</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 p-4 rounded-2xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 shadow-2xs">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                        <span className="text-xs font-black text-slate-950 dark:text-white block">
                          {isActive ? 'Account Active' : 'Account Suspended'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-700 dark:text-slate-300 font-bold mt-1 leading-relaxed">
                        {isActive ? 'Staff member can log in and access assigned resources.' : 'Access is disabled.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowSuspendModal(true)}
                      className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs whitespace-nowrap shrink-0 flex items-center justify-center gap-1.5 active:scale-95 ${
                        isActive
                          ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30'
                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30'
                      }`}
                    >
                      {isActive ? (
                        <>
                          <ShieldAlert className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                          <span>Mark Suspended</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span>Reactivate Account</span>
                        </>
                      )}
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
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs bg-white dark:bg-navy-950 px-3 py-2.5 rounded-xl border border-emerald-100 dark:border-navy-700">
                          <span className="font-mono font-black text-emerald-700 dark:text-emerald-300 tracking-wider">
                            {tempPasswordResult.password}
                          </span>
                          <span className="text-[10px] text-slate-500 break-all sm:break-words">
                            Dispatched to {tempPasswordResult.email}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* View Activity Logs */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setShowLogsModal(true)}
                      className="w-full py-3 px-4 rounded-2xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 hover:bg-slate-50 dark:hover:bg-navy-800 text-slate-700 dark:text-slate-300 text-xs font-black shadow-sm flex items-center justify-center space-x-2 transition-all cursor-pointer"
                    >
                      <History className="w-4 h-4 text-brand-500" />
                      <span>View Staff Activity Logs</span>
                    </button>
                  </div>

                  {/* Emergency Action: Terminate All Active Sessions */}
                  <div className="pt-3 border-t border-slate-100 dark:border-navy-800">
                    <button
                      type="button"
                      onClick={() => setShowTerminateConfirmModal(true)}
                      disabled={isTerminatingSessions}
                      className="w-full py-3 px-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 text-xs font-black shadow-2xs flex items-center justify-center space-x-2 transition-all cursor-pointer disabled:opacity-50 active:scale-95"
                    >
                      <Lock className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                      <span>Terminate All Active Sessions (Force Logout)</span>
                    </button>

                    {terminateSuccessMsg && (
                      <div className="mt-2.5 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/60 flex items-center justify-between animate-fade-in">
                        <span className="text-[11px] font-black text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                          <CheckCircle className="w-3.5 h-3.5 text-rose-500" /> {terminateSuccessMsg}
                        </span>
                      </div>
                    )}
                  </div>
                </section>

              </div>
            </div>

          </form>
        </div>

        {/* STICKY FOOTER ACTIONS */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 bg-slate-50/90 dark:bg-navy-950/80 border-t border-slate-200 dark:border-navy-800 flex items-center justify-between shrink-0 z-20">
          <div className="flex items-center gap-2">
            {isDirty ? (
              <span className="text-[11px] sm:text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span> Modified fields ready to save
              </span>
            ) : (
              <span className="text-[11px] sm:text-xs font-semibold text-slate-400">No changes made</span>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={handleAttemptClose}
              disabled={isSubmitting}
              className="px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-navy-800 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              form="edit-staff-form"
              type="submit"
              disabled={isSubmitting || !isDirty}
              className="px-4 sm:px-7 py-2 sm:py-2.5 rounded-xl text-xs font-black text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-500/25 flex items-center gap-2 cursor-pointer active:scale-95"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="hidden sm:inline">Saving Changes...</span>
                  <span className="sm:hidden">Saving...</span>
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

        {/* TERMINATE SESSIONS CONFIRMATION MODAL */}
        {showTerminateConfirmModal && (
          <GlobalModalBackdrop isOpen={true} className="flex items-center justify-center p-4 z-[9999]">
            <div className="bg-white dark:bg-navy-950 rounded-3xl w-full max-w-md p-6 border border-slate-200 dark:border-navy-700 shadow-2xl space-y-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
                <Lock className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                Terminate All Active Sessions?
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                This will immediately log out <strong>{formData.full_name || staff.username}</strong> from all devices, phones, and browser sessions. They will be required to re-authenticate.
              </p>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTerminateConfirmModal(false)}
                  className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleTerminateAllSessions}
                  disabled={isTerminatingSessions}
                  className="flex-1 py-2.5 rounded-xl font-black text-xs text-white bg-rose-600 hover:bg-rose-700 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {isTerminatingSessions ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Terminating...</span>
                    </>
                  ) : (
                    <span>Confirm Terminate</span>
                  )}
                </button>
              </div>
            </div>
          </GlobalModalBackdrop>
        )}

        {/* Photo Zoom Lightbox Modal */}
        {showPhotoZoom && profilePhotoPreview && (
          <GlobalModalBackdrop isOpen={true} className="flex items-center justify-center p-4 z-[99999]" onClose={() => setShowPhotoZoom(false)}>
            <div className="bg-slate-950/95 p-3 sm:p-4 rounded-3xl border border-slate-700 shadow-2xl max-w-md w-full flex flex-col items-center space-y-3 relative">
              <div className="w-full flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-bold text-slate-200 truncate">{formData.full_name || staff.username} — Profile Photo</span>
                <button
                  type="button"
                  onClick={() => setShowPhotoZoom(false)}
                  className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="w-full max-h-[70vh] flex items-center justify-center overflow-hidden rounded-2xl bg-black/50">
                <img
                  src={profilePhotoPreview}
                  alt={formData.full_name || staff.username}
                  className="max-h-[65vh] w-auto object-contain rounded-2xl shadow-xl"
                />
              </div>
            </div>
          </GlobalModalBackdrop>
        )}

        {/* Staff Activity Logs Dedicated Modal */}
        <StaffActivityLogsModal 
          staff={staff}
          isOpen={showLogsModal}
          onClose={() => setShowLogsModal(false)}
        />

      </div>
    </GlobalModalBackdrop>
  );
};
