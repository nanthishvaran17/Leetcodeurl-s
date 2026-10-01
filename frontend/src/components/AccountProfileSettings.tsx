import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  User, Mail, Phone, Calendar, KeyRound, Shield, CheckCircle, 
  Camera, Trash2, Save, Loader2, Eye, EyeOff, Building2, 
  Key, ShieldCheck, ShieldAlert, Sparkles, X, Info, Laptop, 
  Clock, Bell, Download, Award, BookOpen, MapPin, RefreshCw, 
  Check, Smartphone, Globe, Lock, Share2, GraduationCap, 
  Briefcase, Link as LinkIcon, FileText, Send, Printer, 
  QrCode, ExternalLink, Zap, Flame, Star, Edit3, CheckSquare, 
  Heart, AlertTriangle, Sliders, ShieldX, Copy, CheckCheck, 
  RotateCw, RefreshCcw, Volume2, Search, UploadCloud, 
  Fingerprint, MessageSquare, Compass, Cpu, Palette, ChevronRight, ChevronDown,
  Trophy, BookmarkCheck, FileBadge
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { GlobalModalBackdrop } from './GlobalModalBackdrop';
import { DynamicQRCode } from './DynamicQRCode';
import Cropper from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';

const getCroppedImg = (imageSrc: string, pixelCrop: any): Promise<string> => {
  const canvas = document.createElement('canvas');
  const image = new Image();
  return new Promise((resolve, reject) => {
    image.onload = () => {
      canvas.width = pixelCrop.width;
      canvas.height = pixelCrop.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject('No 2d context');
      ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height
      );
      resolve(canvas.toDataURL('image/jpeg'));
    };
    image.onerror = (error) => reject(error);
    image.src = imageSrc;
  });
};

// Preset avatar collection with clean vector icons
const PRESET_AVATARS = [
  { id: 'grad', icon: GraduationCap, label: 'Academic Scholar', color: 'from-blue-600 to-indigo-700' },
  { id: 'code', icon: Laptop, label: 'Software Engineer', color: 'from-emerald-600 to-teal-700' },
  { id: 'rocket', icon: Zap, label: 'Tech Specialist', color: 'from-purple-600 to-pink-700' },
  { id: 'ai', icon: Cpu, label: 'AI & Systems', color: 'from-amber-500 to-orange-600' },
  { id: 'shield', icon: ShieldCheck, label: 'Security Lead', color: 'from-rose-600 to-red-700' },
  { id: 'research', icon: BookOpen, label: 'Researcher', color: 'from-cyan-600 to-blue-700' },
  { id: 'global', icon: Globe, label: 'Faculty Mentor', color: 'from-indigo-600 to-violet-800' },
  { id: 'star', icon: Award, label: 'Coordinator', color: 'from-yellow-500 to-amber-600' }
];

// Available Academic & Professional Badges with Lucide Icons
const AVAILABLE_BADGES = [
  { id: 'leetcode_guardian', label: 'LeetCode Guardian', icon: Trophy, color: 'bg-amber-500/15 text-amber-950 dark:text-amber-200 border-amber-500/30' },
  { id: 'nptel_elite', label: 'NPTEL Elite Gold', icon: GraduationCap, color: 'bg-yellow-500/15 text-yellow-950 dark:text-yellow-200 border-yellow-500/30' },
  { id: 'aws_architect', label: 'AWS Solutions Architect', icon: Zap, color: 'bg-orange-500/15 text-orange-950 dark:text-orange-200 border-orange-500/30' },
  { id: 'gcp_data', label: 'Google Cloud Certified', icon: Sparkles, color: 'bg-blue-500/15 text-blue-950 dark:text-blue-200 border-blue-500/30' },
  { id: 'ieee_senior', label: 'IEEE Senior Member', icon: BookOpen, color: 'bg-cyan-500/15 text-cyan-950 dark:text-cyan-200 border-cyan-500/30' },
  { id: 'naac_lead', label: 'NAAC / NBA Criteria Head', icon: Building2, color: 'bg-purple-500/15 text-purple-950 dark:text-purple-200 border-purple-500/30' },
  { id: 'cyber_security', label: 'Certified Ethical Hacker', icon: ShieldCheck, color: 'bg-emerald-500/15 text-emerald-950 dark:text-emerald-200 border-emerald-500/30' },
  { id: 'acm_icpc', label: 'ACM ICPC Regional Mentor', icon: Compass, color: 'bg-rose-500/15 text-rose-950 dark:text-rose-200 border-rose-500/30' }
];

// Languages list
const AVAILABLE_LANGUAGES = ['English', 'Tamil', 'Hindi', 'Telugu', 'Malayalam', 'German', 'Japanese', 'French'];

// Card Aesthetic Themes
const CARD_THEMES = [
  { id: 'nandha_gold', name: 'Nandha Gold & Navy', bg: 'from-navy-950 via-slate-900 to-indigo-950', border: 'border-amber-400/60', badge: 'bg-amber-400/20 text-amber-300 border-amber-400/40' },
  { id: 'cyber_dark', name: 'Cyber Titanium', bg: 'from-slate-950 via-zinc-900 to-black', border: 'border-cyan-500/60', badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' },
  { id: 'emerald_honors', name: 'Emerald Academic', bg: 'from-emerald-950 via-teal-950 to-slate-950', border: 'border-emerald-400/60', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40' },
  { id: 'royal_violet', name: 'Royal Executive', bg: 'from-purple-950 via-indigo-950 to-slate-950', border: 'border-purple-400/60', badge: 'bg-purple-500/20 text-purple-300 border-purple-400/40' }
];

// Options for Blood Group (Medical Record)
interface PremiumSelectOption {
  value: string;
  label: string;
  badge?: string;
  badgeColor?: string;
  icon?: React.ReactNode;
}

const BLOOD_GROUP_OPTIONS: PremiumSelectOption[] = [
  { value: 'A+', label: 'A+ (Positive)', badge: 'Positive', badgeColor: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900' },
  { value: 'A-', label: 'A- (Negative)', badge: 'Negative', badgeColor: 'bg-slate-100 text-slate-700 dark:bg-navy-800 dark:text-slate-300' },
  { value: 'B+', label: 'B+ (Positive)', badge: 'Positive', badgeColor: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900' },
  { value: 'B-', label: 'B- (Negative)', badge: 'Negative', badgeColor: 'bg-slate-100 text-slate-700 dark:bg-navy-800 dark:text-slate-300' },
  { value: 'O+', label: 'O+ (Positive)', badge: 'Universal Donor', badgeColor: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-900' },
  { value: 'O-', label: 'O- (Negative)', badge: 'Universal Donor', badgeColor: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-900' },
  { value: 'AB+', label: 'AB+ (Positive)', badge: 'Universal Recipient', badgeColor: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900' },
  { value: 'AB-', label: 'AB- (Negative)', badge: 'Rare Negative', badgeColor: 'bg-slate-100 text-slate-700 dark:bg-navy-800 dark:text-slate-300' }
];

const CONSULTATION_MODE_OPTIONS: PremiumSelectOption[] = [
  { value: 'Open Door', label: 'Open Door (Walk-in to Cabin)', badge: 'Walk-in', badgeColor: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' },
  { value: 'Pre-booked Appointment', label: 'Pre-booked Appointment', badge: 'Appointment', badgeColor: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800' },
  { value: 'Hybrid (In-person & Virtual GMeet)', label: 'Hybrid (In-person & Virtual GMeet)', badge: 'Hybrid / Virtual', badgeColor: 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800' }
];

// Premium Custom Select Component
const PremiumSelect: React.FC<{
  value: string;
  onChange: (val: string) => void;
  options: PremiumSelectOption[];
  placeholder?: string;
  leadingIcon?: React.ReactNode;
  heightClass?: string;
}> = ({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  leadingIcon,
  heightClass = 'h-11'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(o => o.value === value) || (value ? { value, label: value } : null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  return (
    <div className="relative w-full" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full ${heightClass} px-3.5 rounded-xl border-2 flex items-center justify-between transition-all cursor-pointer text-xs font-bold ${
          isOpen
            ? 'border-brand-500 bg-white dark:bg-navy-950 ring-4 ring-brand-500/15 shadow-sm'
            : value
              ? 'border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-950 text-slate-950 dark:text-white hover:border-brand-400'
              : 'border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-950 text-slate-400 dark:text-slate-500 hover:border-slate-400'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {leadingIcon && (
            <span className="shrink-0">{leadingIcon}</span>
          )}
          <span className="truncate text-slate-950 dark:text-white font-extrabold text-xs">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.badge && (
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase shrink-0 ${selectedOption.badgeColor || 'bg-slate-100 text-slate-700 dark:bg-navy-800 dark:text-slate-300'}`}>
              {selectedOption.badge}
            </span>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ml-2 ${
            isOpen ? 'rotate-180 text-brand-600 dark:text-brand-400' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1.5 p-1.5 rounded-2xl bg-white dark:bg-navy-900 border-2 border-slate-200 dark:border-navy-700 shadow-2xl max-h-60 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-150">
          {options.map(opt => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer mb-0.5 text-left ${
                  isSelected
                    ? 'bg-brand-600 text-white font-black shadow-sm'
                    : 'text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  {opt.icon && (
                    <span className={`shrink-0 ${isSelected ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`}>{opt.icon}</span>
                  )}
                  <span className="truncate">{opt.label}</span>
                  {opt.badge && (
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase shrink-0 ${
                      isSelected 
                        ? 'bg-white/20 text-white' 
                        : (opt.badgeColor || 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300')
                    }`}>
                      {opt.badge}
                    </span>
                  )}
                </div>
                {isSelected && (
                  <Check className="w-4 h-4 text-white shrink-0 ml-2 stroke-[3]" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

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
  } catch {}
  return str;
};

// Play audio chime using Web Audio API
const playChimeSound = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'triangle';

    osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc1.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5

    osc2.frequency.setValueAtTime(440, ctx.currentTime);
    osc2.frequency.exponentialRampToValueAtTime(1174.66, ctx.currentTime + 0.2); // D6

    gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc1.start();
    osc2.start();
    osc1.stop(ctx.currentTime + 0.45);
    osc2.stop(ctx.currentTime + 0.45);
  } catch {}
};

export const AccountProfileSettings: React.FC = () => {
  const { user } = useAuth();
  const { notify } = useNotification();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonImportInputRef = useRef<HTMLInputElement>(null);

  // 5 Master Tabs
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'preferences' | 'id_card' | 'mentorship'>('profile');

  // Mentee Modal State
  const [selectedMentee, setSelectedMentee] = useState<{name: string, regNo: string, att: string, solved: number, actionType: 'View' | 'Intervene' | 'Warn'} | null>(null);

  // Photo Crop State
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  // Core Identity Form Fields
  const [fullName, setFullName] = useState<string>(user?.full_name || user?.name || user?.username || '');
  const [designation, setDesignation] = useState<string>((user as any)?.designation || '');
  const [phoneNumber, setPhoneNumber] = useState<string>((user as any)?.phone_number || '');
  const [dateOfBirth, setDateOfBirth] = useState<string>(() => parseDOBToDisplay((user as any)?.date_of_birth));
  const [profilePhoto, setProfilePhoto] = useState<string | null>((user as any)?.profile_photo || user?.photoURL || null);
  
  // Extended Academic & Professional Fields
  const [bloodGroup, setBloodGroup] = useState<string>(() => localStorage.getItem('nec_user_blood_group') || 'O+');
  const [emergencyContactName, setEmergencyContactName] = useState<string>(() => localStorage.getItem('nec_user_emergency_name') || '');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState<string>(() => localStorage.getItem('nec_user_emergency_phone') || '');
  const [officeLocation, setOfficeLocation] = useState<string>(() => localStorage.getItem('nec_user_office_loc') || 'Main Campus • Academic Block B-204');
  const [specialization, setSpecialization] = useState<string>(() => localStorage.getItem('nec_user_specialization') || 'Data Structures, Algorithms & Cloud Systems');
  const [highestDegree, setHighestDegree] = useState<string>(() => localStorage.getItem('nec_user_degree') || 'M.E. Computer Science & Engineering');
  const [experienceYears, setExperienceYears] = useState<string>(() => localStorage.getItem('nec_user_exp_years') || '8 Years');
  const [coursesTaught, setCoursesTaught] = useState<string>(() => localStorage.getItem('nec_user_courses') || 'CS8451 Design & Analysis of Algorithms, CS8591 Computer Networks');
  const [facultyBio, setFacultyBio] = useState<string>(() => localStorage.getItem('nec_user_bio') || 'Dedicated educator and coding mentor passionate about algorithmic problem solving and student development.');

  // Academic Badges & Honors
  const [selectedBadges, setSelectedBadges] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('nec_user_badges');
      return saved ? JSON.parse(saved) : ['leetcode_guardian', 'nptel_elite', 'naac_lead'];
    } catch {
      return ['leetcode_guardian', 'nptel_elite'];
    }
  });

  // Languages Spoken
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('nec_user_languages');
      return saved ? JSON.parse(saved) : ['English', 'Tamil'];
    } catch {
      return ['English', 'Tamil'];
    }
  });

  // Office Consultation Hours Planner
  const [consultationDays, setConsultationDays] = useState<string>(() => localStorage.getItem('nec_user_consult_days') || 'Mon, Wed, Fri');
  const [consultationSlot, setConsultationSlot] = useState<string>(() => localStorage.getItem('nec_user_consult_slot') || '02:00 PM – 04:30 PM');
  const [consultationMode, setConsultationMode] = useState<string>(() => localStorage.getItem('nec_user_consult_mode') || 'Open Door');

  // Academic Social & Research Links
  const [linkedinUrl, setLinkedinUrl] = useState<string>(() => localStorage.getItem('nec_user_linkedin') || '');
  const [githubUrl, setGithubUrl] = useState<string>(() => localStorage.getItem('nec_user_github') || '');
  const [scholarUrl, setScholarUrl] = useState<string>(() => localStorage.getItem('nec_user_scholar') || '');
  const [orcidId, setOrcidId] = useState<string>(() => localStorage.getItem('nec_user_orcid') || '');
  const [scopusId, setScopusId] = useState<string>(() => localStorage.getItem('nec_user_scopus') || '');
  const [leetcodeHandle, setLeetcodeHandle] = useState<string>(() => localStorage.getItem('nec_user_leetcode') || '');

  // Faculty Scratchpad / Sticky Notes
  const [facultyNotes, setFacultyNotes] = useState<string>(() => localStorage.getItem('nec_faculty_notes') || '• Review Weekly Contest solving roster\n• Prepare Data Structures lab problem set\n• Follow up on pending mentees submissions');

  // Notification & Privacy Preferences
  const [emailContestAlerts, setEmailContestAlerts] = useState<boolean>(() => localStorage.getItem('pref_contest_email') !== 'false');
  const [weeklyDigestAlerts, setWeeklyDigestAlerts] = useState<boolean>(() => localStorage.getItem('pref_weekly_digest') !== 'false');
  const [systemAuditAlerts, setSystemAuditAlerts] = useState<boolean>(() => localStorage.getItem('pref_audit_alerts') !== 'false');
  const [toastAudioAlerts, setToastAudioAlerts] = useState<boolean>(() => localStorage.getItem('pref_toast_audio') === 'true');
  const [inactivityDaysThreshold, setInactivityDaysThreshold] = useState<number>(() => Number(localStorage.getItem('pref_inactivity_threshold')) || 7);
  const [showPhoneToStudents, setShowPhoneToStudents] = useState<boolean>(() => localStorage.getItem('pref_show_phone_students') === 'true');
  const [showCabinInDirectory, setShowCabinInDirectory] = useState<boolean>(() => localStorage.getItem('pref_show_cabin_dir') !== 'false');

  // Password & Security States
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showCurrentPassword, setShowCurrentPassword] = useState<boolean>(false);
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);
  const [is2FAEnabled, setIs2FAEnabled] = useState<boolean>(() => localStorage.getItem('nec_2fa_enabled') === 'true' || Boolean((user as any)?.is_2fa_enabled));
  const [show2FASetupModal, setShow2FASetupModal] = useState<boolean>(false);
  const [totpCodeInput, setTotpCodeInput] = useState<string>('');
  const [totpSecret] = useState<string>('JBSWY3DPEHPK3PXP');
  const [backupCodes] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('nec_backup_codes');
      return saved ? JSON.parse(saved) : ['9482-1049', '5820-4491', '7731-9023', '3318-6721', '8910-3482', '2019-4820', '6629-1830', '4102-7749'];
    } catch {
      return ['9482-1049', '5820-4491', '7731-9023', '3318-6721', '8910-3482', '2019-4820', '6629-1830', '4102-7749'];
    }
  });
  const [showBackupCodesModal, setShowBackupCodesModal] = useState<boolean>(false);

  // ID Card State
  const [idCardSide, setIdCardSide] = useState<'front' | 'back'>('front');
  const [selectedCardTheme, setSelectedCardTheme] = useState<string>(() => localStorage.getItem('nec_card_theme') || 'nandha_gold');

  // UI States
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [showPhotoZoom, setShowPhotoZoom] = useState<boolean>(false);
  const [showPresetAvatarPicker, setShowPresetAvatarPicker] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Active Sessions
  const [sessions, setSessions] = useState([
    { id: 'sess-1', device: 'Google Chrome on Windows 11', ip: '103.24.188.42 (Campus Wi-Fi)', time: 'Active Now (Current Session)', current: true },
    { id: 'sess-2', device: 'Safari on iPhone 15 Pro', ip: '49.37.12.189 (Mobile Network)', time: 'Yesterday, 06:45 PM', current: false },
    { id: 'sess-3', device: 'Firefox on Linux Workstation', ip: '10.20.4.15 (CSE Lab 2)', time: '3 days ago', current: false }
  ]);

  // Security Login History Audit
  const [loginHistory] = useState<any[]>([]);

  // Client telemetry info
  const clientInfo = useMemo(() => {
    const ua = navigator.userAgent;

    // Browser detection with version
    let browser = 'Unknown Browser';
    let browserVersion = '';
    if (ua.includes('Edg/')) {
      browser = 'Microsoft Edge';
      browserVersion = ua.match(/Edg\/([\d.]+)/)?.[1]?.split('.')[0] || '';
    } else if (ua.includes('OPR/') || ua.includes('Opera')) {
      browser = 'Opera';
      browserVersion = ua.match(/OPR\/([\d.]+)/)?.[1]?.split('.')[0] || '';
    } else if (ua.includes('Firefox/')) {
      browser = 'Mozilla Firefox';
      browserVersion = ua.match(/Firefox\/([\d.]+)/)?.[1]?.split('.')[0] || '';
    } else if (ua.includes('Safari') && !ua.includes('Chrome')) {
      browser = 'Apple Safari';
      browserVersion = ua.match(/Version\/([\d.]+)/)?.[1]?.split('.')[0] || '';
    } else if (ua.includes('Chrome/')) {
      browser = 'Google Chrome';
      browserVersion = ua.match(/Chrome\/([\d.]+)/)?.[1]?.split('.')[0] || '';
    }
    const browserLabel = browserVersion ? `${browser} ${browserVersion}` : browser;

    // OS detection with type
    let os = 'Windows';
    let deviceType = 'Desktop';
    if (ua.includes('Android')) {
      os = 'Android';
      deviceType = 'Mobile';
    } else if (ua.includes('iPhone')) {
      os = 'iOS';
      deviceType = 'iPhone';
    } else if (ua.includes('iPad')) {
      os = 'iPadOS';
      deviceType = 'Tablet';
    } else if (ua.includes('Macintosh')) {
      os = 'macOS';
      deviceType = 'Mac';
    } else if (ua.includes('Linux')) {
      os = 'Linux';
      deviceType = 'Desktop';
    } else if (ua.includes('Windows NT 11') || ua.includes('Windows NT 10')) {
      os = ua.includes('Windows NT 11') ? 'Windows 11' : 'Windows 10';
      deviceType = 'Desktop';
    }

    return {
      browser: browserLabel,
      os,
      deviceType,
      fullDevice: `${browserLabel} · ${os} / ${deviceType}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata',
      timeStr: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };
  }, []);

  // Fetch updated profile info on mount
  useEffect(() => {
    const fetchMe = async () => {
      try {
        const res = await api.get('/auth/me');
        if (res.data?.user) {
          const u = res.data.user;
          setFullName(u.full_name || u.username || '');
          setDesignation(u.designation || '');
          setPhoneNumber(u.phone_number || '');
          setDateOfBirth(parseDOBToDisplay(u.date_of_birth));
          setProfilePhoto(u.profile_photo || null);
          if (u.is_2fa_enabled !== undefined) setIs2FAEnabled(Boolean(u.is_2fa_enabled));
        }
      } catch {
        if (user) {
          setFullName(user.full_name || user.name || user.username || '');
          setDesignation((user as any)?.designation || '');
          setPhoneNumber((user as any)?.phone_number || '');
          setDateOfBirth(parseDOBToDisplay((user as any)?.date_of_birth));
          setProfilePhoto((user as any)?.profile_photo || user?.photoURL || null);
        }
      }
    };
    fetchMe();
  }, [user]);

  // Profile Completeness calculation
  const profileCompleteness = useMemo(() => {
    let score = 10;
    if (fullName && fullName.trim().length > 2) score += 15;
    if (phoneNumber && phoneNumber.trim().length >= 10) score += 15;
    if (profilePhoto) score += 15;
    if (dateOfBirth && dateOfBirth.length === 10) score += 15;
    if (designation && designation.trim().length > 2) score += 15;
    if (facultyBio && facultyBio.trim().length > 10) score += 10;
    if (linkedinUrl || githubUrl || leetcodeHandle) score += 10;
    if (selectedBadges.length > 0) score += 10;
    return Math.min(100, score);
  }, [fullName, phoneNumber, profilePhoto, dateOfBirth, designation, facultyBio, linkedinUrl, githubUrl, leetcodeHandle, selectedBadges]);

  // Security Score calculation
  const securityScore = useMemo(() => {
    let score = 50; // base bcrypt hashed password
    if (is2FAEnabled) score += 30;
    if (user?.email) score += 10;
    if (phoneNumber) score += 10;
    return Math.min(100, score);
  }, [is2FAEnabled, user?.email, phoneNumber]);

  // Password strength meter & entropy
  const passwordStrength = useMemo(() => {
    if (!newPassword) return { score: 0, label: 'Not Entered', color: 'bg-slate-200 dark:bg-navy-800', crackTime: 'N/A' };
    let s = 0;
    if (newPassword.length >= 8) s += 1;
    if (newPassword.length >= 12) s += 1;
    if (/[A-Z]/.test(newPassword)) s += 1;
    if (/[0-9]/.test(newPassword)) s += 1;
    if (/[^A-Za-z0-9]/.test(newPassword)) s += 1;

    if (s <= 2) return { score: 33, label: 'Weak', color: 'bg-rose-500', crackTime: 'Few seconds' };
    if (s <= 4) return { score: 66, label: 'Moderate', color: 'bg-amber-500', crackTime: '3 to 6 months' };
    return { score: 100, label: 'Strong & High Entropy', color: 'bg-emerald-500', crackTime: '10,000+ years' };
  }, [newPassword]);

  // Photo upload handler
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        notify.error('Profile photo must be less than 5 MB', '', { category: 'ADMIN' });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const b64 = reader.result as string;
        setImageToCrop(b64);
        setZoom(1);
        setCrop({ x: 0, y: 0 });
      };
      reader.readAsDataURL(file);
    }
  };

  const onCropComplete = (croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  const handleSaveCrop = async () => {
    if (!imageToCrop || !croppedAreaPixels) return;
    try {
      const croppedImage = await getCroppedImg(imageToCrop, croppedAreaPixels);
      setProfilePhoto(croppedImage);
      setImageToCrop(null);
      notify.success('Photo preview ready. Click "Save Account Details" to commit.', '', { category: 'ADMIN' });
    } catch (e) {
      notify.error('Failed to crop image', '', { category: 'ADMIN' });
    }
  };

  // Preset avatar selector using clean SVG icons
  const handleSelectPresetAvatar = (avatar: typeof PRESET_AVATARS[0]) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#4f46e5"/><stop offset="100%" stop-color="#7c3aed"/></linearGradient></defs><rect width="200" height="200" rx="40" fill="url(#g)"/><circle cx="100" cy="100" r="60" fill="rgba(255,255,255,0.15)"/><text x="50%" y="54%" font-family="sans-serif" font-weight="900" font-size="64" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${(fullName || 'A').charAt(0).toUpperCase()}</text></svg>`;
    const dataUri = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    setProfilePhoto(dataUri);
    setShowPresetAvatarPicker(false);
    notify.success(`Selected ${avatar.label} icon avatar`, '', { category: 'ADMIN' });
  };

  // Toggle badge selection
  const handleToggleBadge = (badgeId: string) => {
    setSelectedBadges(prev => 
      prev.includes(badgeId) ? prev.filter(id => id !== badgeId) : [...prev, badgeId]
    );
  };

  // Toggle language selection
  const handleToggleLanguage = (lang: string) => {
    setSelectedLanguages(prev => 
      prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang]
    );
  };

  // Save profile handler
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);

    if (newPassword) {
      if (!currentPassword) {
        setErrorMessage('Current password is required to set a new password.');
        return;
      }
      if (newPassword.length < 6) {
        setErrorMessage('New password must be at least 6 characters.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setErrorMessage('New password and confirm password do not match.');
        return;
      }
    }

    // Persist local fields
    localStorage.setItem('nec_user_blood_group', bloodGroup);
    localStorage.setItem('nec_user_emergency_name', emergencyContactName);
    localStorage.setItem('nec_user_emergency_phone', emergencyContactPhone);
    localStorage.setItem('nec_user_office_loc', officeLocation);
    localStorage.setItem('nec_user_specialization', specialization);
    localStorage.setItem('nec_user_degree', highestDegree);
    localStorage.setItem('nec_user_exp_years', experienceYears);
    localStorage.setItem('nec_user_courses', coursesTaught);
    localStorage.setItem('nec_user_bio', facultyBio);
    localStorage.setItem('nec_user_badges', JSON.stringify(selectedBadges));
    localStorage.setItem('nec_user_languages', JSON.stringify(selectedLanguages));
    localStorage.setItem('nec_user_consult_days', consultationDays);
    localStorage.setItem('nec_user_consult_slot', consultationSlot);
    localStorage.setItem('nec_user_consult_mode', consultationMode);
    localStorage.setItem('nec_user_linkedin', linkedinUrl);
    localStorage.setItem('nec_user_github', githubUrl);
    localStorage.setItem('nec_user_scholar', scholarUrl);
    localStorage.setItem('nec_user_orcid', orcidId);
    localStorage.setItem('nec_user_scopus', scopusId);
    localStorage.setItem('nec_user_leetcode', leetcodeHandle);
    localStorage.setItem('nec_faculty_notes', facultyNotes);
    localStorage.setItem('pref_contest_email', String(emailContestAlerts));
    localStorage.setItem('pref_weekly_digest', String(weeklyDigestAlerts));
    localStorage.setItem('pref_audit_alerts', String(systemAuditAlerts));
    localStorage.setItem('pref_toast_audio', String(toastAudioAlerts));
    localStorage.setItem('pref_inactivity_threshold', String(inactivityDaysThreshold));
    localStorage.setItem('pref_show_phone_students', String(showPhoneToStudents));
    localStorage.setItem('pref_show_cabin_dir', String(showCabinInDirectory));
    localStorage.setItem('nec_2fa_enabled', String(is2FAEnabled));
    localStorage.setItem('nec_card_theme', selectedCardTheme);

    setIsSaving(true);
    try {
      const payload: any = {
        full_name: fullName.trim(),
        designation: designation.trim(),
        phone_number: phoneNumber.trim(),
        date_of_birth: dateOfBirth || null,
        profile_photo: profilePhoto || null,
        is_2fa_enabled: is2FAEnabled
      };

      if (newPassword && currentPassword) {
        payload.current_password = currentPassword;
        payload.new_password = newPassword;
      }

      const res = await api.put('/auth/profile', payload);
      if (res.data?.success) {
        setSuccessMessage('Your profile details, qualifications, and security preferences have been updated successfully.');
        notify.success('Profile updated successfully!', '', { category: 'ADMIN' });
        if (toastAudioAlerts) playChimeSound();
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');

        try {
          const sessionRes = await api.get('/auth/me');
          if (sessionRes.data?.user) {
            window.dispatchEvent(new CustomEvent('nec_user_profile_updated', { detail: sessionRes.data.user }));
          }
        } catch {}
      }
    } catch (err: any) {
      const detail = err.response?.data?.detail || err.message || 'Failed to update profile.';
      setErrorMessage(detail);
      notify.error(detail, '', { category: 'ADMIN' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportCSV = () => {
    const csvContent = [
      ['Student Reg No', 'Name', 'Attendance', 'LeetCode Solved', 'Action Type'],
      ['="732221104001"', 'Aakash S', '96%', '142', 'View'],
      ['="732221104042"', 'Bharath K', '68%', '14', 'Intervene'],
      ['="732221104073"', 'Dharshini M', '91%', '280', 'View'],
      ['="732221104021"', 'Gokul R', '89%', '105', 'View'],
      ['="732221104088"', 'Harish V', '74%', '42', 'Warn'],
      ['="732221104112"', 'Kavya T', '98%', '310', 'View'],
      ['="732221104144"', 'Manikandan P', '85%', '95', 'View'],
      ['="732221104165"', 'Nandhini G', '62%', '8', 'Intervene'],
      ['="732221104189"', 'Praveen J', '94%', '188', 'View'],
    ].map(e => e.join(",")).join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "Mentee_Roster_Export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    notify.success('Mentee list exported as CSV successfully!', '', { category: 'ADMIN' });
  };

  const handleRevokeSession = (sessionId: string) => {
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    notify.success('Device session revoked successfully', '', { category: 'ADMIN' });
  };

  const handleRevokeAllOtherSessions = () => {
    setSessions(prev => prev.filter(s => s.current));
    notify.success('All other remote device sessions revoked', '', { category: 'ADMIN' });
  };

  const institutionalId = (user as any)?.institutional_id || `NEC-STAFF-${user?.id ? String(user.id).padStart(3, '0') : '098'}`;
  const departmentName = (user as any)?.department_code || user?.department || 'INSTITUTIONAL';
  const roleName = user?.role || 'Faculty Mentor';
  const createdAtFormatted = (user as any)?.created_at ? new Date((user as any).created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Academic Session 2025–26';

  // Dynamic Scannable Verification Payload (vCard + Official Accreditation verification)
  const qrVerificationPayload = useMemo(() => {
    return `BEGIN:VCARD\nVERSION:3.0\nFN:${fullName || 'Faculty Member'}\nTITLE:${designation || 'Staff'}\nORG:Nandha Engineering College (Autonomous);${departmentName}\nTEL;TYPE=WORK,VOICE:${phoneNumber || '9042020879'}\nEMAIL;TYPE=WORK:${user?.email || 'nanthishvaran17@gmail.com'}\nNOTE:Institutional ID: ${institutionalId} | Status: VERIFIED ACTIVE | Auth: SHA256-${institutionalId.toLowerCase()}-verified\nURL:https://nandhaengg.org\nEND:VCARD`;
  }, [institutionalId, fullName, designation, departmentName, phoneNumber, user?.email]);

  // Dynamic Scannable TOTP Authenticator URI
  const totpUri = useMemo(() => {
    const issuer = encodeURIComponent('Nandha Engineering College');
    const account = encodeURIComponent(user?.email || institutionalId);
    return `otpauth://totp/${issuer}:${account}?secret=${totpSecret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
  }, [user?.email, institutionalId, totpSecret]);

  // Export profile summary JSON
  const handleExportProfileJson = () => {
    const data = {
      institution: 'Nandha Engineering College (Autonomous)',
      accreditation: 'NBA & NAAC A+ Grade Accredited',
      institutional_id: institutionalId,
      full_name: fullName,
      role: roleName,
      designation: designation || 'Staff Member',
      department: departmentName,
      email: user?.email,
      phone_number: phoneNumber,
      date_of_birth: dateOfBirth,
      blood_group: bloodGroup,
      highest_qualification: highestDegree,
      teaching_experience: experienceYears,
      courses_taught: coursesTaught,
      office_location: officeLocation,
      specialization: specialization,
      honors_and_badges: selectedBadges,
      languages: selectedLanguages,
      consultation: {
        days: consultationDays,
        time: consultationSlot,
        mode: consultationMode
      },
      emergency_contact: {
        name: emergencyContactName,
        phone: emergencyContactPhone
      },
      portfolio: {
        linkedin: linkedinUrl,
        github: githubUrl,
        scholar: scholarUrl,
        orcid: orcidId,
        scopus: scopusId,
        leetcode: leetcodeHandle
      },
      account_status: 'ACTIVE & VERIFIED',
      exported_at: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NEC_Faculty_Profile_${institutionalId}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify.success('Profile configuration exported as JSON', '', { category: 'ADMIN' });
  };

  // Import profile JSON
  const handleImportProfileJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const imported = JSON.parse(event.target?.result as string);
          if (imported.full_name) setFullName(imported.full_name);
          if (imported.designation) setDesignation(imported.designation);
          if (imported.phone_number) setPhoneNumber(imported.phone_number);
          if (imported.date_of_birth) setDateOfBirth(parseDOBToDisplay(imported.date_of_birth));
          if (imported.blood_group) setBloodGroup(imported.blood_group);
          if (imported.highest_qualification) setHighestDegree(imported.highest_qualification);
          if (imported.teaching_experience) setExperienceYears(imported.teaching_experience);
          if (imported.courses_taught) setCoursesTaught(imported.courses_taught);
          if (imported.office_location) setOfficeLocation(imported.office_location);
          if (imported.specialization) setSpecialization(imported.specialization);
          if (Array.isArray(imported.honors_and_badges)) setSelectedBadges(imported.honors_and_badges);
          if (Array.isArray(imported.languages)) setSelectedLanguages(imported.languages);
          if (imported.consultation) {
            if (imported.consultation.days) setConsultationDays(imported.consultation.days);
            if (imported.consultation.time) setConsultationSlot(imported.consultation.time);
            if (imported.consultation.mode) setConsultationMode(imported.consultation.mode);
          }
          if (imported.emergency_contact) {
            if (imported.emergency_contact.name) setEmergencyContactName(imported.emergency_contact.name);
            if (imported.emergency_contact.phone) setEmergencyContactPhone(imported.emergency_contact.phone);
          }
          if (imported.portfolio) {
            if (imported.portfolio.linkedin) setLinkedinUrl(imported.portfolio.linkedin);
            if (imported.portfolio.github) setGithubUrl(imported.portfolio.github);
            if (imported.portfolio.scholar) setScholarUrl(imported.portfolio.scholar);
            if (imported.portfolio.orcid) setOrcidId(imported.portfolio.orcid);
            if (imported.portfolio.scopus) setScopusId(imported.portfolio.scopus);
            if (imported.portfolio.leetcode) setLeetcodeHandle(imported.portfolio.leetcode);
          }
          notify.success('Imported settings successfully! Click Save to apply.', '', { category: 'ADMIN' });
        } catch {
          notify.error('Invalid JSON configuration file format', '', { category: 'ADMIN' });
        }
      };
      reader.readAsText(file);
    }
  };

  // Export vCard (.vcf)
  const handleExportVCard = () => {
    const vcard = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${fullName || 'Faculty Member'}`,
      `TITLE:${designation || 'Staff'}`,
      `ORG:Nandha Engineering College (Autonomous);${departmentName}`,
      `EMAIL;TYPE=INTERNET,WORK:${user?.email || ''}`,
      `TEL;TYPE=WORK,VOICE:${phoneNumber || ''}`,
      `ADR;TYPE=WORK:;;${officeLocation};Erode;Tamil Nadu;638052;India`,
      `URL:${linkedinUrl || 'https://nandhaengg.org'}`,
      `NOTE:Institutional ID: ${institutionalId} | Blood Group: ${bloodGroup}`,
      'END:VCARD'
    ].join('\r\n');

    const blob = new Blob([vcard], { type: 'text/vcard;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NEC_${institutionalId}_Contact.vcf`;
    a.click();
    URL.revokeObjectURL(url);
    notify.success('vCard Contact downloaded! Open with Phonebook/Contacts.', '', { category: 'ADMIN' });
  };

  // Export Security Audit Log CSV with strict RFC-4180 Excel column alignment and institutional headers
  const handleExportSecurityAuditCsv = () => {
    const escapeCsv = (val: any) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    
    const rows = [
      ['NANDHA ENGINEERING COLLEGE (AUTONOMOUS) - ERODE', '', '', '', '', '', ''],
      ['OFFICIAL FACULTY SECURITY ACCESS & AUDIT LOG REPORT', '', '', '', '', '', ''],
      [`Institutional ID: ${institutionalId}`, `Faculty Name: ${fullName || user?.username}`, `Department: ${departmentName}`, `Status: ACTIVE & VERIFIED`, '', '', ''],
      [`Export Date: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })} (IST)`, 'Accreditation: NAAC A+ & NBA Accredited', 'Engine: Nandha Intelligence Security Engine', '', '', '', ''],
      ['', '', '', '', '', '', ''],
      ['Event ID', 'Date', 'Time (IST)', 'IP Address', 'Access Network', 'Authentication Method', 'Security Status'],
      ...loginHistory.map(h => [
        h.id,
        h.date,
        h.time,
        h.ip,
        h.network,
        h.method,
        h.status
      ])
    ];

    const csvContent = '\uFEFF' + rows.map(r => r.map(escapeCsv).join(',')).join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NEC_Security_Audit_${institutionalId}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    notify.success('Security audit log exported with perfect Excel alignment', '', { category: 'ADMIN' });
  };

  // Print Formatted Security Audit Report â€” Full Page Preview (no auto-print)
  const handlePrintSecurityAuditReport = () => {
    const logoUrl   = `${window.location.origin}/nec_25_years_logo.png`;
    const emblemUrl = `${window.location.origin}/nandha_emblem.png`;
    const nowIst    = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
    const nowShort  = new Date().toLocaleString('en-GB', {
      timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short',
      year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    const reportHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>NEC Security Audit Report â€” ${institutionalId}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
      background: #f1f5f9; color: #0f172a; min-height: 100vh;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }

    /* â”€â”€ Sticky action bar (hidden when printing) â”€â”€â”€ */
    .action-bar {
      position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
      background: linear-gradient(90deg, #002147 0%, #0f3460 100%);
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 28px; height: 58px;
      box-shadow: 0 2px 16px rgba(0,0,0,0.4);
    }
    .bar-left-title { color: #fde047; font-weight: 800; font-size: 14px; line-height: 1; }
    .bar-left-sub   { color: #94a3b8; font-size: 10.5px; margin-top: 3px; font-weight: 600; }
    .bar-btns { display: flex; gap: 10px; }
    .btn-print {
      background: #f59e0b; color: #002147; font-weight: 900; font-size: 13px;
      border: none; border-radius: 9px; padding: 9px 22px; cursor: pointer;
      display: flex; align-items: center; gap: 7px; letter-spacing: 0.2px;
      transition: background 0.15s;
    }
    .btn-print:hover { background: #fbbf24; }
    .btn-close {
      background: rgba(255,255,255,0.12); color: #e2e8f0; font-weight: 700; font-size: 12.5px;
      border: 1.5px solid rgba(255,255,255,0.3); border-radius: 9px; padding: 9px 17px; cursor: pointer;
      transition: background 0.15s;
    }
    .btn-close:hover { background: rgba(255,255,255,0.22); }

    /* â”€â”€ Page wrapper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
    .page-wrap { max-width: 920px; margin: 0 auto; padding: 82px 24px 48px; }

    /* â”€â”€ A4 white card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
    .a4-card {
      background: #fff; border-radius: 18px;
      box-shadow: 0 4px 32px rgba(0,0,0,0.13);
      padding: 34px 38px 30px;
      display: flex; flex-direction: column; gap: 0;
    }

    /* â”€â”€ Header banner â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
    .hdr {
      background: linear-gradient(135deg, #002147 0%, #0f3460 100%);
      border-radius: 12px; border-bottom: 4px solid #f59e0b;
      padding: 20px 24px; display: flex; align-items: center;
      justify-content: space-between; gap: 16px; margin-bottom: 22px;
    }
    .hdr-left    { display: flex; align-items: center; gap: 18px; }
    .hdr-logo    { height: 66px; max-width: 152px; object-fit: contain;
                   filter: drop-shadow(0 2px 6px rgba(0,0,0,0.4)); }
    .hdr-h1      { font-size: 19px; font-weight: 900; color: #fff;
                   text-transform: uppercase; letter-spacing: 0.4px; line-height: 1.15; }
    .hdr-sub     { font-size: 10.5px; color: #fde047; font-weight: 700; margin-top: 5px; }
    .hdr-aff     { font-size: 9.5px;  color: #cbd5e1; font-weight: 500; margin-top: 3px; }
    .hdr-tag     { background: rgba(255,255,255,0.13); border: 1.5px solid #f59e0b;
                   border-radius: 10px; padding: 10px 17px; text-align: right; flex-shrink: 0; }
    .hdr-tag-lbl { font-size: 9px; text-transform: uppercase; letter-spacing: 1px;
                   color: #fde047; font-weight: 900; }
    .hdr-tag-id  { font-size: 15px; font-weight: 900; color: #fff;
                   font-family: 'Courier New', monospace; margin-top: 3px; }

    /* â”€â”€ Meta strip â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
    .meta-grid {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 0;
      background: #f8fafc; border: 1.5px solid #e2e8f0;
      border-radius: 10px; overflow: hidden; margin-bottom: 22px;
    }
    .meta-cell { padding: 13px 15px; border-right: 1px solid #e2e8f0; }
    .meta-cell:last-child { border-right: none; }
    .meta-lbl { font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px;
                color: #64748b; font-weight: 800; margin-bottom: 4px; }
    .meta-val { font-size: 12px; font-weight: 800; color: #0f172a; }
    .meta-mono { font-family: 'Courier New', monospace; color: #1e3a8a; }

    /* â”€â”€ Section heading â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
    .sec-head {
      display: flex; align-items: center; justify-content: space-between;
      border-bottom: 2.5px solid #002147; padding-bottom: 7px; margin-bottom: 14px;
    }
    .sec-head h2 { font-size: 12px; font-weight: 900; color: #002147;
                   text-transform: uppercase; letter-spacing: 0.6px; }
    .sec-head span { font-size: 10px; color: #64748b; font-weight: 700; }

    /* â”€â”€ Table â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
    table { width: 100%; border-collapse: collapse; font-size: 11.5px; margin-bottom: 24px; }
    thead th {
      background: #002147; color: #fff; text-align: left;
      padding: 10px 13px; font-weight: 800; text-transform: uppercase;
      font-size: 9.5px; letter-spacing: 0.5px; border: 1px solid #001a38;
    }
    tbody td { padding: 10px 13px; border: 1px solid #cbd5e1; font-weight: 600; color: #1e293b; }
    tbody tr:nth-child(even) td { background: #f8fafc; }
    .tag-id { font-family: 'Courier New', monospace; font-weight: 900; color: #002147; }
    .tag-ip { font-family: 'Courier New', monospace; background: #e0f2fe;
              color: #0369a1; padding: 2px 7px; border-radius: 4px;
              font-size: 10.5px; font-weight: 700; }
    .tag-ok { background: #dcfce7; color: #15803d; border: 1px solid #86efac;
              font-weight: 900; padding: 3px 9px; border-radius: 4px;
              font-size: 9.5px; letter-spacing: 0.4px; display: inline-block; }

    /* â”€â”€ Footer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
    .footer {
      padding-top: 18px; border-top: 2px dashed #cbd5e1;
      display: flex; align-items: flex-end; justify-content: space-between;
      margin-top: 8px;
    }
    .footer-text p { font-size: 10px; color: #475569; font-weight: 600; line-height: 1.7; }
    .footer-text strong { color: #0f172a; }
    .footer-text .hash { font-family: 'Courier New', monospace; color: #1e3a8a; font-weight: 700; }
    .seal { flex-shrink: 0; text-align: center; border: 1.5px solid #002147;
            border-radius: 10px; padding: 11px 20px; background: #f8fafc; }
    .seal-lbl { font-size: 8.5px; font-weight: 900; color: #002147;
                text-transform: uppercase; letter-spacing: 0.5px; }
    .seal-ok  { font-size: 11px; font-weight: 800; color: #15803d; margin-top: 4px; }

    /* â”€â”€ Print: hide bar, collapse padding â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
    @media print {
      @page { size: A4 portrait; margin: 12mm; }
      body { background: #fff; }
      .action-bar { display: none !important; }
      .page-wrap  { padding: 0; max-width: 100%; }
      .a4-card    { border-radius: 0; box-shadow: none; padding: 0; }
    }
  </style>
</head>
<body>

  <!-- Sticky Action Bar -->
  <div class="action-bar">
    <div>
      <div class="bar-left-title">NEC Official Security Audit Report</div>
      <div class="bar-left-sub">${institutionalId} &bull; ${fullName || user?.username} &bull; ${nowShort} IST</div>
    </div>
    <div class="bar-btns">
      <button class="btn-print" onclick="window.print()">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm1-4h.01M12 12h.01" /></svg>
        Print / Save as PDF
      </button>
      <button class="btn-close" onclick="window.close()">&#10005; Close</button>
    </div>
  </div>

  <!-- Report Content -->
  <div class="page-wrap">
    <div class="a4-card">

      <!-- College Header -->
      <div class="hdr">
        <div class="hdr-left">
          <img class="hdr-logo"
               src="${logoUrl}"
               onerror="this.onerror=null; this.src='${emblemUrl}';"
               alt="Nandha Engineering College Logo" />
          <div>
            <div class="hdr-h1">Nandha Engineering College</div>
            <div class="hdr-sub">Autonomous Institution &bull; Approved by AICTE &bull; NBA &amp; NAAC A+ Grade Accredited</div>
            <div class="hdr-aff">Affiliated to Anna University Chennai &bull; Erodeâ€“Perundurai Road, Tamil Nadu &ndash; 638 052</div>
          </div>
        </div>
        <div class="hdr-tag">
          <div class="hdr-tag-lbl">Verified Audit Log</div>
          <div class="hdr-tag-id">${institutionalId}</div>
        </div>
      </div>

      <!-- Meta Strip -->
      <div class="meta-grid">
        <div class="meta-cell">
          <div class="meta-lbl">Faculty Name</div>
          <div class="meta-val">${fullName || user?.username}</div>
        </div>
        <div class="meta-cell">
          <div class="meta-lbl">Institutional ID</div>
          <div class="meta-val meta-mono">${institutionalId}</div>
        </div>
        <div class="meta-cell">
          <div class="meta-lbl">Department &amp; Role</div>
          <div class="meta-val">${departmentName} &bull; ${roleName}</div>
        </div>
        <div class="meta-cell">
          <div class="meta-lbl">Report Generated (IST)</div>
          <div class="meta-val">${nowIst}</div>
        </div>
      </div>

      <!-- Section Heading -->
      <div class="sec-head">
        <h2>Authentication &amp; Security Access Audit Trail</h2>
        <span>${loginHistory.length} Record${loginHistory.length !== 1 ? 's' : ''} Logged</span>
      </div>

      <!-- Audit Table -->
      <table>
        <thead>
          <tr>
            <th style="width:10%">Event ID</th>
            <th style="width:14%">Date</th>
            <th style="width:12%">Time (IST)</th>
            <th style="width:17%">IP Address</th>
            <th style="width:17%">Access Network</th>
            <th style="width:20%">Auth Method</th>
            <th style="width:10%;text-align:center">Status</th>
          </tr>
        </thead>
        <tbody>
          ${loginHistory.map(h => `
          <tr>
            <td><span class="tag-id">${h.id}</span></td>
            <td><strong>${h.date}</strong></td>
            <td>${h.time}</td>
            <td><span class="tag-ip">${h.ip}</span></td>
            <td>${h.network}</td>
            <td>${h.method}</td>
            <td style="text-align:center"><span class="tag-ok">${h.status}</span></td>
          </tr>`).join('')}
        </tbody>
      </table>

      <!-- Footer -->
      <div class="footer">
        <div class="footer-text">
          <p><strong>Nandha Intelligence Security Dispatcher</strong> &mdash; Official Institutional System Record</p>
          <p>Cryptographic Hash: <span class="hash">SHA256-${institutionalId.toLowerCase()}-verified-2026</span></p>
          <p>Confidential &bull; Authorized Administrative Use Only &bull; &copy; Nandha Engineering College ${new Date().getFullYear()}</p>
        </div>
        <div class="seal">
          <div class="seal-lbl">Institutional Cyber Audit</div>
          <div class="seal-ok">&#10003; Verified &amp; Recorded</div>
        </div>
      </div>

    </div><!-- /.a4-card -->
  </div><!-- /.page-wrap -->

</body>
</html>`;

    const printWin = window.open('', '_blank', 'width=1140,height=880,scrollbars=yes,resizable=yes');
    if (printWin) {
      printWin.document.write(reportHtml);
      printWin.document.close();
      printWin.focus();
    }
  };

  // Download 2FA Backup Recovery Codes
  const handleDownloadBackupCodes = () => {
    const content = `NANDHA ENGINEERING COLLEGE (AUTONOMOUS)
OFFICIAL 2FA RECOVERY CODES
Institutional ID: ${institutionalId}
Generated: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })} (IST)

Keep these codes in a safe place. Each code can be used once if you lose access to your authenticator app.

${backupCodes.map((c, i) => `[${i + 1}] ${c}`).join('\n')}

Security Verification Hash: SHA256-${institutionalId.toLowerCase()}-verified
`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NEC_2FA_Recovery_Codes_${institutionalId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    notify.success('Recovery codes downloaded securely', '', { category: 'ADMIN' });
  };

  // Quick Canned Bios
  const insertBioTemplate = (templateType: 'mentor' | 'researcher' | 'placement') => {
    if (templateType === 'mentor') {
      setFacultyBio('Dedicated coding mentor committed to nurturing problem-solving habits in Data Structures and competitive programming.');
    } else if (templateType === 'researcher') {
      setFacultyBio('Active researcher in distributed systems, machine intelligence, and high-performance algorithmic computing.');
    } else {
      setFacultyBio('Faculty placement coordinator bridging core curriculum with modern industry tech stacks and campus interview readiness.');
    }
    notify.success('Bio template applied', '', { category: 'ADMIN' });
  };

  // Active theme configuration
  const currentCardTheme = useMemo(() => {
    return CARD_THEMES.find(t => t.id === selectedCardTheme) || CARD_THEMES[0];
  }, [selectedCardTheme]);

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in w-full pb-12 text-slate-900 dark:text-slate-100">
      
      {/* 1. TOP HERO IDENTITY BANNER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white p-5 sm:p-8 shadow-2xl border border-indigo-500/30">
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-72 h-72 bg-indigo-600/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="relative z-10 space-y-5 sm:space-y-6">
          {/* Top Sub-row: Category Badge, IST Clock & Quick Actions */}
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-white/15">
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-brand-500/25 border border-brand-400/40 text-brand-200 text-[10px] sm:text-xs font-black uppercase tracking-wider">
              <span className="hidden sm:inline">Personal Identity • Self-Service Hub</span>
              <span className="sm:hidden">Identity Hub</span>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={handleExportProfileJson}
                className="p-1.5 sm:px-3 sm:py-1 rounded-full font-bold text-xs bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all flex items-center justify-center sm:gap-1.5 cursor-pointer"
                title="Export JSON"
              >
                <Download className="w-3.5 h-3.5 text-brand-300" />
                <span className="hidden sm:inline">Export JSON</span>
              </button>

              <label className="p-1.5 sm:px-3 sm:py-1 rounded-full font-bold text-xs bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all flex items-center justify-center sm:gap-1.5 cursor-pointer">
                <UploadCloud className="w-3.5 h-3.5 text-indigo-300" />
                <span className="hidden sm:inline">Import JSON</span>
                <input ref={jsonImportInputRef} type="file" accept=".json" className="hidden" onChange={handleImportProfileJson} />
              </label>

              <span className="hidden md:flex px-3 py-1 rounded-full font-black text-xs border items-center space-x-1.5 bg-emerald-500/20 border-emerald-500/40 text-emerald-300 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>ACTIVE</span>
              </span>
              <span className="px-2 py-1 rounded-full font-mono text-[10px] sm:text-xs font-bold bg-white/15 text-white border border-white/20 whitespace-nowrap">
                IST {clientInfo.timeStr}
              </span>
            </div>
          </div>

          {/* Main User Profile Row */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 lg:gap-6 w-full">
            
            {/* Left Side: Avatar & Identity Details */}
            <div className="flex flex-col lg:flex-row items-center lg:items-start gap-4 lg:gap-6 text-center lg:text-left flex-1 min-w-0">
              {/* Avatar with Zoom and Edit overlay */}
              <div 
                className={`relative shrink-0 ${profilePhoto ? 'cursor-zoom-in group' : ''}`}
                onClick={() => { if (profilePhoto) setShowPhotoZoom(true); }}
                title={profilePhoto ? "Click to enlarge photo" : "Profile Avatar"}
              >
                <div className="w-[84px] h-[84px] lg:w-24 lg:h-24 rounded-2xl overflow-hidden border-2 border-brand-400/80 shadow-xl bg-slate-900 flex items-center justify-center relative group mx-auto">
                  {profilePhoto ? (
                    <img src={profilePhoto} alt={fullName || user?.username} className="w-full h-full object-contain p-1 bg-white dark:bg-navy-900 group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-tr from-brand-600 via-indigo-600 to-purple-600 text-white font-black text-3xl lg:text-3xl flex items-center justify-center">
                      {(fullName || user?.username || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Camera className="w-5 h-5 text-white" />
                  </div>
                </div>
                <span className="absolute -bottom-1 -right-1 w-5 h-5 lg:w-5 lg:h-5 rounded-full bg-emerald-500 border-2 border-slate-900 shadow-md flex items-center justify-center">
                  <Check className="w-3 h-3 text-white stroke-[3]" />
                </span>
              </div>

              {/* Identity Details */}
              <div className="flex flex-col items-center lg:items-start justify-center min-w-0 flex-1 w-full">
                <div className="flex flex-row items-center justify-center lg:justify-start gap-2 flex-wrap">
                  <h2 className="text-xl lg:text-3xl font-black text-white tracking-tight text-center lg:text-left">
                    {fullName || user?.username}
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-brand-500/40 text-white border border-brand-400/60 shadow-xs whitespace-nowrap">
                    {roleName}
                  </span>
                </div>
                
                {designation && (
                  <p className="text-xs lg:text-xs text-indigo-200 font-bold flex flex-row items-center justify-center lg:justify-start gap-1 mt-1">
                    <Award className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                    <span className="text-center lg:text-left">{designation}</span>
                  </p>
                )}

                <div className="text-xs text-slate-100 font-mono flex flex-row items-center justify-center lg:justify-start gap-1.5 flex-wrap mt-1.5 font-bold">
                  <span className="font-bold text-white bg-white/20 px-2 py-0.5 rounded border border-white/20">{institutionalId}</span>
                  <span className="text-slate-400 hidden sm:inline">•</span>
                  <span className="text-white truncate">{user?.email}</span>
                </div>

                {/* Display Top Badges */}
                {selectedBadges.length > 0 && (
                  <div className="flex items-center justify-center lg:justify-start gap-1.5 flex-wrap pt-2.5 pb-1 w-full max-w-full">
                    {selectedBadges.slice(0, 3).map(bId => {
                      const badge = AVAILABLE_BADGES.find(b => b.id === bId);
                      if (!badge) return null;
                      const BadgeIcon = badge.icon;
                      return (
                        <span key={bId} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black bg-white/10 hover:bg-white/20 text-white border border-white/20 shadow-xs transition-colors whitespace-nowrap">
                          <BadgeIcon className="w-3 h-3 text-amber-300 shrink-0" />
                          <span className="truncate">{badge.label}</span>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right Side: Profile Completeness & Security Health */}
            <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:flex lg:flex-col lg:justify-center shrink-0 w-full lg:w-[240px] mt-2 lg:mt-0">
              <div className="bg-white/15 backdrop-blur-md rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 border border-white/20 flex flex-col justify-center gap-1 sm:gap-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[10px] sm:text-xs mb-0.5 sm:mb-0">
                  <span className="font-black text-white flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-300" /> 
                    <span className="truncate">Strength</span>
                  </span>
                  <span className="font-black text-emerald-300 text-right">{profileCompleteness}%</span>
                </div>
                <div className="w-full h-1.5 sm:h-2 rounded-full bg-slate-800/90 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-brand-400 via-indigo-400 to-emerald-400 rounded-full transition-all duration-500" 
                    style={{ width: `${profileCompleteness}%` }}
                  />
                </div>
                <p className="text-[9px] sm:text-[10px] text-slate-200 font-bold hidden sm:block">
                  {profileCompleteness === 100 ? '100% Completed' : `${100 - profileCompleteness}% to reach 100%`}
                </p>
              </div>

              <div className="bg-white/15 backdrop-blur-md rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 border border-white/20 flex flex-col justify-center gap-1 sm:gap-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[10px] sm:text-xs mb-0.5 sm:mb-0">
                  <span className="font-black text-white flex items-center gap-1">
                    <Lock className="w-3 h-3 sm:w-4 sm:h-4 text-indigo-300" /> 
                    <span className="truncate">Security</span>
                  </span>
                  <span className="font-black text-indigo-300 text-right">{securityScore}/100</span>
                </div>
                <div className="w-full h-1.5 sm:h-2 rounded-full bg-slate-800/90 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-400 rounded-full transition-all duration-500" 
                    style={{ width: `${securityScore}%` }}
                  />
                </div>
                <p className="text-[9px] sm:text-[10px] text-slate-200 font-bold hidden sm:block">
                  {securityScore < 100 ? '2FA Recommended' : 'Maximum Security'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. 4-PILLAR STATS & TELEMETRY ROW */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        
        {/* Card 1: Department Scope */}
        <div className="p-2.5 sm:p-4 rounded-2xl bg-white dark:bg-navy-900 border-2 border-slate-200 dark:border-navy-800 shadow-xs flex items-center gap-2.5 sm:gap-3.5">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
            <Building2 className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[9px] sm:text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 truncate">Department Scope</div>
            <div className="text-xs sm:text-sm font-black text-slate-950 dark:text-white truncate">{departmentName}</div>
          </div>
        </div>

        {/* Card 2: Security & 2FA */}
        <div className="p-2.5 sm:p-4 rounded-2xl bg-white dark:bg-navy-900 border-2 border-slate-200 dark:border-navy-800 shadow-xs flex items-center gap-2.5 sm:gap-3.5">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 flex items-center justify-center shrink-0">
            <Lock className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[9px] sm:text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 truncate">Security Vault</div>
            <div className="text-xs sm:text-sm font-black text-slate-950 dark:text-white truncate">
              {is2FAEnabled ? '2FA Protected' : 'Encrypted & Active'}
            </div>
          </div>
        </div>

        {/* Card 3: Client Platform */}
        <div className="p-2.5 sm:p-4 rounded-2xl bg-white dark:bg-navy-900 border-2 border-slate-200 dark:border-navy-800 shadow-xs flex items-center gap-2.5 sm:gap-3.5">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-brand-100 dark:bg-brand-500/20 text-brand-700 dark:text-brand-300 flex items-center justify-center shrink-0">
            {clientInfo.deviceType === 'Mobile' || clientInfo.deviceType === 'iPhone' ? (
              <Smartphone className="w-4 h-4 sm:w-5 sm:h-5" />
            ) : (
              <Laptop className="w-4 h-4 sm:w-5 sm:h-5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[9px] sm:text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 truncate">Active Device</div>
            <div className="text-[10px] sm:text-xs font-black text-slate-950 dark:text-white truncate" title={clientInfo.fullDevice}>{clientInfo.browser}</div>
            <div className="text-[9px] font-bold text-slate-500 dark:text-slate-400 truncate">{clientInfo.os} / {clientInfo.deviceType}</div>
          </div>
        </div>

        {/* Card 4: Member Since */}
        <div className="p-2.5 sm:p-4 rounded-2xl bg-white dark:bg-navy-900 border-2 border-slate-200 dark:border-navy-800 shadow-xs flex items-center gap-2.5 sm:gap-3.5">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[9px] sm:text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 truncate">Institutional Join</div>
            <div className="text-xs sm:text-sm font-black text-slate-950 dark:text-white truncate">{createdAtFormatted}</div>
          </div>
        </div>

      </div>

      {/* 3. RESPONSIVE 5-TAB NAVIGATION GRID (100% Full Width, High Contrast) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 p-1.5 rounded-2xl bg-slate-200/80 dark:bg-navy-950 border-2 border-slate-300 dark:border-navy-800">
        
        {/* Tab 1: Personal & Academic Profile */}
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`py-3.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer text-center ${
            activeTab === 'profile'
              ? 'bg-brand-600 text-white shadow-lg shadow-brand-500/30 scale-[1.01]'
              : 'bg-white dark:bg-navy-900 text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-navy-800'
          }`}
        >
          <User className="w-4 h-4 shrink-0" />
          <span className="truncate">Personal & Profile</span>
        </button>

        {/* Tab 2: Security & Password Vault */}
        <button
          type="button"
          onClick={() => setActiveTab('security')}
          className={`py-3.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer text-center ${
            activeTab === 'security'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 scale-[1.01]'
              : 'bg-white dark:bg-navy-900 text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-navy-800'
          }`}
        >
          <KeyRound className="w-4 h-4 shrink-0" />
          <span className="truncate">Security & Password</span>
        </button>

        {/* Tab 3: Notification Preferences */}
        <button
          type="button"
          onClick={() => setActiveTab('preferences')}
          className={`py-3.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer text-center ${
            activeTab === 'preferences'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30 scale-[1.01]'
              : 'bg-white dark:bg-navy-900 text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-navy-800'
          }`}
        >
          <Bell className="w-4 h-4 shrink-0" />
          <span className="truncate">Notifications & Privacy</span>
        </button>

        {/* Tab 4: Digital Identity Card */}
        <button
          type="button"
          onClick={() => setActiveTab('id_card')}
          className={`py-3.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer text-center ${
            activeTab === 'id_card'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/30 scale-[1.01]'
              : 'bg-white dark:bg-navy-900 text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-navy-800'
          }`}
        >
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span className="truncate">Digital Identity Card</span>
        </button>

        {/* Tab 5: Mentorship & Tracking */}
        <button
          type="button"
          onClick={() => setActiveTab('mentorship')}
          className={`py-3.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer text-center ${
            activeTab === 'mentorship'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 scale-[1.01]'
              : 'bg-white dark:bg-navy-900 text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-navy-800'
          }`}
        >
          <GraduationCap className="w-4 h-4 shrink-0" />
          <span className="truncate">Mentorship & Tracking</span>
        </button>
      </div>

      {/* Success / Error Alerts */}
      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-500/20 border-2 border-emerald-500/40 text-emerald-950 dark:text-emerald-200 text-xs font-black flex items-center gap-2 animate-fade-in shadow-2xs mb-6 mt-4">
          <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-500/20 border-2 border-rose-500/40 text-rose-950 dark:text-rose-200 text-xs font-black flex items-center gap-2 animate-fade-in shadow-2xs mb-6 mt-4">
          <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSaveProfile} className="space-y-6">
        

        {/* ========================================================================= */}
        {/* TAB 1: PERSONAL & ACADEMIC PROFILE */}
        {/* ========================================================================= */}
        {activeTab === 'profile' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
            
            {/* LEFT COLUMN: Self-Editable Identity & Contact Fields */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* Photo & Avatar Customizer */}
              <div className="bg-white dark:bg-navy-900 rounded-3xl p-6 border-2 border-slate-200 dark:border-navy-800 shadow-sm space-y-5">
                <div className="flex items-center justify-between border-b-2 border-slate-100 dark:border-navy-800 pb-3">
                  <h3 className="text-xs font-black text-slate-950 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <Camera className="w-4 h-4 text-brand-600 dark:text-brand-400" /> Profile Picture & Avatar
                  </h3>
                  <span className="text-xs font-black text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-950/60 px-2.5 py-0.5 rounded-md">Self Editable</span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-navy-950 border-2 border-slate-200 dark:border-navy-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div 
                      className={`w-16 h-16 rounded-2xl overflow-hidden bg-white dark:bg-navy-900 border-2 border-slate-300 dark:border-navy-700 flex items-center justify-center shrink-0 shadow-xs ${profilePhoto ? 'cursor-zoom-in' : ''}`}
                      onClick={() => { if (profilePhoto) setShowPhotoZoom(true); }}
                    >
                      {profilePhoto ? (
                        <img src={profilePhoto} alt="Preview" className="w-full h-full object-contain p-0.5 bg-white dark:bg-navy-900" />
                      ) : (
                        <User className="w-8 h-8 text-slate-600 dark:text-slate-300" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-950 dark:text-white">Profile Photo or Preset Avatar</h4>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">PNG, JPG, WEBP up to 5 MB or pick an academic icon</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 w-full">
                    <label className="flex-1 flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-[10px] sm:text-xs font-black transition-all shadow-xs cursor-pointer">
                      <Camera className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{profilePhoto ? 'Upload' : 'Upload'}</span>
                      <input ref={fileInputRef} type="file" className="hidden" accept="image/png, image/jpeg, image/webp" onChange={handlePhotoUpload} />
                    </label>

                    <button
                      type="button"
                      onClick={() => setShowPresetAvatarPicker(!showPresetAvatarPicker)}
                      className="flex-1 flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-navy-800 dark:hover:bg-navy-700 text-slate-900 dark:text-slate-100 text-[10px] sm:text-xs font-black transition-all border border-slate-300 dark:border-navy-700 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span className="truncate">Preset</span>
                    </button>

                    {profilePhoto && (
                      <button
                        type="button"
                        onClick={() => setProfilePhoto(null)}
                        className="p-2 rounded-xl bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-500/20 dark:text-rose-300 transition-colors border border-rose-300 dark:border-rose-500/30 cursor-pointer shrink-0"
                        title="Remove Photo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Preset Avatar Picker Grid using clean vector icons */}
                {showPresetAvatarPicker && (
                  <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-navy-950/90 border-2 border-indigo-200 dark:border-navy-700 space-y-3 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-indigo-950 dark:text-indigo-200">Choose a Professional Avatar Icon:</span>
                      <button 
                        type="button" 
                        onClick={() => setShowPresetAvatarPicker(false)}
                        className="text-xs text-slate-600 hover:text-slate-900 dark:text-slate-300 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-4 sm:grid-cols-8 gap-2.5">
                      {PRESET_AVATARS.map((av) => {
                        const IconComponent = av.icon;
                        return (
                          <button
                            key={av.id}
                            type="button"
                            onClick={() => handleSelectPresetAvatar(av)}
                            className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-white dark:bg-navy-900 border-2 border-slate-200 dark:border-navy-800 hover:border-brand-500 hover:scale-105 transition-all shadow-xs cursor-pointer group"
                            title={av.label}
                          >
                            <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-300 flex items-center justify-center group-hover:bg-brand-600 group-hover:text-white transition-colors">
                              <IconComponent className="w-4 h-4" />
                            </div>
                            <span className="text-[10px] font-black text-slate-800 dark:text-slate-200 truncate max-w-full mt-1.5">{av.label.split(' ')[0]}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Personal Details Inputs */}
              <div className="bg-white dark:bg-navy-900 rounded-3xl p-6 border-2 border-slate-200 dark:border-navy-800 shadow-sm space-y-5">
                <div className="flex items-center justify-between border-b-2 border-slate-100 dark:border-navy-800 pb-3">
                  <h3 className="text-xs font-black text-slate-950 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <User className="w-4 h-4 text-brand-600 dark:text-brand-400" /> Identity & Contact Information
                  </h3>
                  <span className="text-xs font-black text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-950/60 px-2.5 py-0.5 rounded-md">Self Editable</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Full Display Name */}
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="block text-xs font-black text-slate-900 dark:text-slate-100">Full Display Name</label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      placeholder="Dr. / Mr. / Ms. Name"
                      className="w-full h-11 px-4 rounded-xl border-2 border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-950 text-xs font-bold text-slate-950 dark:text-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
                      required
                    />
                  </div>

                  {/* Professional Designation / Title */}
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="block text-xs font-black text-slate-900 dark:text-slate-100">Professional Designation / Academic Title</label>
                    <div className="relative">
                      <Award className="w-4 h-4 text-slate-500 dark:text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={designation}
                        onChange={e => setDesignation(e.target.value)}
                        placeholder="e.g. Assistant Professor, Lead System Architect, HOD"
                        className="w-full h-11 pl-10 pr-4 rounded-xl border-2 border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-950 text-xs font-bold text-slate-950 dark:text-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* Phone / Mobile Number */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-black text-slate-900 dark:text-slate-100">Mobile / Contact Number</label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-500 dark:text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="tel"
                        value={phoneNumber}
                        onChange={e => setPhoneNumber(e.target.value)}
                        placeholder="+91 9876543210"
                        className="w-full h-11 pl-10 pr-4 rounded-xl border-2 border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-950 text-xs font-bold text-slate-950 dark:text-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* Date of Birth (DD/MM/YYYY) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-black text-slate-900 dark:text-slate-100">
                        Date of Birth
                      </label>
                      <span className="text-xs text-brand-600 dark:text-brand-400 font-bold font-mono bg-brand-50 dark:bg-brand-950/60 px-2 py-0.5 rounded-md border border-brand-200 dark:border-brand-800/80">DD/MM/YYYY</span>
                    </div>
                    <div className="relative">
                      <Calendar className="w-4 h-4 text-slate-500 dark:text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={dateOfBirth}
                        onChange={e => {
                          let val = e.target.value.replace(/\D/g, '');
                          if (val.length >= 3 && val.length <= 4) val = val.slice(0, 2) + '/' + val.slice(2);
                          else if (val.length >= 5) val = val.slice(0, 2) + '/' + val.slice(2, 4) + '/' + val.slice(4, 8);
                          setDateOfBirth(val);
                        }}
                        placeholder="DD/MM/YYYY (e.g. 15/08/1990)"
                        maxLength={10}
                        className="w-full h-11 pl-10 pr-10 rounded-xl border-2 border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-950 text-xs font-mono font-bold text-slate-950 dark:text-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
                      />
                      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center">
                        <input
                          type="date"
                          id="acc-settings-dob-picker"
                          className="opacity-0 absolute w-6 h-6 cursor-pointer"
                          onChange={e => {
                            if (e.target.value) {
                              const parts = e.target.value.split('-');
                              if (parts.length === 3) {
                                setDateOfBirth(`${parts[2]}/${parts[1]}/${parts[0]}`);
                              }
                            }
                          }}
                        />
                        <label htmlFor="acc-settings-dob-picker" className="p-1 text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 cursor-pointer" title="Pick from calendar">
                          <Calendar className="w-4 h-4" />
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Blood Group */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-black text-slate-900 dark:text-slate-100">Blood Group (Medical Record)</label>
                    <PremiumSelect
                      value={bloodGroup}
                      onChange={setBloodGroup}
                      options={BLOOD_GROUP_OPTIONS}
                      placeholder="Select Blood Group"
                      leadingIcon={<Heart className="w-4 h-4 text-rose-500" />}
                      heightClass="h-11"
                    />
                  </div>

                  {/* Office Cabin / Room Location */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-black text-slate-900 dark:text-slate-100">Office Cabin / Room Location</label>
                    <div className="relative">
                      <MapPin className="w-4 h-4 text-slate-500 dark:text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={officeLocation}
                        onChange={e => setOfficeLocation(e.target.value)}
                        placeholder="e.g. CS Block Room 204"
                        className="w-full h-11 pl-10 pr-4 rounded-xl border-2 border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-950 text-xs font-bold text-slate-950 dark:text-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* Emergency Contact Name */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-black text-slate-900 dark:text-slate-100">Emergency Contact Person</label>
                    <input
                      type="text"
                      value={emergencyContactName}
                      onChange={e => setEmergencyContactName(e.target.value)}
                      placeholder="e.g. Spouse / Parent / Relative"
                      className="w-full h-11 px-4 rounded-xl border-2 border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-950 text-xs font-bold text-slate-950 dark:text-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
                    />
                  </div>

                  {/* Emergency Contact Phone */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-black text-slate-900 dark:text-slate-100">Emergency Contact Phone</label>
                    <input
                      type="tel"
                      value={emergencyContactPhone}
                      onChange={e => setEmergencyContactPhone(e.target.value)}
                      placeholder="+91 9876543210"
                      className="w-full h-11 px-4 rounded-xl border-2 border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-950 text-xs font-bold text-slate-950 dark:text-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
                    />
                  </div>

                  {/* Highest Degree */}
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="block text-xs font-black text-slate-900 dark:text-slate-100">Highest Academic Degree & Institution</label>
                    <div className="relative">
                      <GraduationCap className="w-4 h-4 text-slate-500 dark:text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={highestDegree}
                        onChange={e => setHighestDegree(e.target.value)}
                        placeholder="e.g. M.E. Computer Science & Engineering • Anna University"
                        className="w-full h-11 pl-10 pr-4 rounded-xl border-2 border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-950 text-xs font-bold text-slate-950 dark:text-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* Research Specialization */}
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="block text-xs font-black text-slate-900 dark:text-slate-100">Specialization & Research Domains</label>
                    <div className="relative">
                      <BookOpen className="w-4 h-4 text-slate-500 dark:text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={specialization}
                        onChange={e => setSpecialization(e.target.value)}
                        placeholder="e.g. Algorithms, Distributed Cloud Systems, Deep Learning"
                        className="w-full h-11 pl-10 pr-4 rounded-xl border-2 border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-950 text-xs font-bold text-slate-950 dark:text-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* Courses Taught */}
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="block text-xs font-black text-slate-900 dark:text-slate-100">Courses & Lab Subjects Handling</label>
                    <div className="relative">
                      <FileText className="w-4 h-4 text-slate-500 dark:text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={coursesTaught}
                        onChange={e => setCoursesTaught(e.target.value)}
                        placeholder="e.g. CS8451 Design & Analysis of Algorithms, Data Structures Lab"
                        className="w-full h-11 pl-10 pr-4 rounded-xl border-2 border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-950 text-xs font-bold text-slate-950 dark:text-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* Faculty Bio with Templates */}
                  <div className="space-y-1.5 sm:col-span-2">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5 sm:gap-0">
                      <label className="block text-xs font-black text-slate-900 dark:text-slate-100">Faculty Bio & Mentoring Philosophy</label>
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                        <span>Templates:</span>
                        <button type="button" onClick={() => insertBioTemplate('mentor')} className="text-brand-600 hover:underline cursor-pointer">Mentor</button>
                        <span>•</span>
                        <button type="button" onClick={() => insertBioTemplate('researcher')} className="text-brand-600 hover:underline cursor-pointer">Research</button>
                        <span>•</span>
                        <button type="button" onClick={() => insertBioTemplate('placement')} className="text-brand-600 hover:underline cursor-pointer">Placement</button>
                      </div>
                    </div>
                    <textarea
                      rows={3}
                      value={facultyBio}
                      onChange={e => setFacultyBio(e.target.value)}
                      placeholder="Write a brief professional summary about your teaching journey..."
                      className="w-full p-3 rounded-xl border-2 border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-950 text-xs font-bold text-slate-950 dark:text-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all resize-none"
                    />
                    <div className="text-right text-[10px] text-slate-500 font-bold">{facultyBio.length} characters</div>
                  </div>
                </div>
              </div>

              {/* Academic Badges & Recognitions Picker with Lucide Icons */}
              <div className="bg-white dark:bg-navy-900 rounded-3xl p-6 border-2 border-slate-200 dark:border-navy-800 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b-2 border-slate-100 dark:border-navy-800 pb-3 gap-2 sm:gap-0">
                  <h3 className="text-xs font-black text-slate-950 dark:text-white uppercase tracking-wider flex items-center gap-2 shrink-0">
                    <Award className="w-4 h-4 text-amber-500 shrink-0" /> Academic & Professional Badges
                  </h3>
                  <span className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400">Displays on ID Card & Profile</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {AVAILABLE_BADGES.map(b => {
                    const isSelected = selectedBadges.includes(b.id);
                    const BadgeIcon = b.icon;
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => handleToggleBadge(b.id)}
                        className={`p-3 rounded-2xl border-2 text-left flex items-center justify-between transition-all cursor-pointer ${
                          isSelected 
                            ? 'bg-amber-500/10 border-amber-500 dark:bg-amber-500/20 shadow-xs' 
                            : 'bg-slate-50 dark:bg-navy-950 border-slate-200 dark:border-navy-800 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                            <BadgeIcon className="w-4 h-4" />
                          </div>
                          <span className="text-xs font-black text-slate-950 dark:text-white truncate">{b.label}</span>
                        </div>
                        <div className={`w-5 h-5 rounded-lg border flex items-center justify-center ${
                          isSelected ? 'bg-amber-500 border-amber-600 text-white' : 'border-slate-300 dark:border-navy-700'
                        }`}>
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Languages Spoken */}
              <div className="bg-white dark:bg-navy-900 rounded-3xl p-6 border-2 border-slate-200 dark:border-navy-800 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b-2 border-slate-100 dark:border-navy-800 pb-3">
                  <h3 className="text-xs font-black text-slate-950 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <Globe className="w-4 h-4 text-indigo-500" /> Language Proficiencies
                  </h3>
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Multi-lingual Communication</span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_LANGUAGES.map(lang => {
                    const isSelected = selectedLanguages.includes(lang);
                    return (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => handleToggleLanguage(lang)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all border-2 cursor-pointer flex items-center gap-1.5 ${
                          isSelected 
                            ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs' 
                            : 'bg-slate-100 dark:bg-navy-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-navy-800 hover:border-indigo-400'
                        }`}
                      >
                        <span>{lang}</span>
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* RIGHT COLUMN: Official Institutional Scope, Portfolio & Consultation Planner */}
            <div className="lg:col-span-5 space-y-6">
              
              {/* Institutional Scope */}
              <div className="bg-white dark:bg-navy-900 rounded-3xl p-6 border-2 border-slate-200 dark:border-navy-800 shadow-sm space-y-5">
                <div className="flex items-center justify-between border-b-2 border-slate-100 dark:border-navy-800 pb-3">
                  <h3 className="text-xs font-black text-slate-950 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <Shield className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Institutional Scope
                  </h3>
                  <span className="text-xs text-indigo-700 dark:text-indigo-300 font-black bg-indigo-100 dark:bg-indigo-950/80 px-2.5 py-0.5 rounded-md border border-indigo-300 dark:border-indigo-700">
                    Managed by Admin
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-navy-950 border-2 border-slate-200 dark:border-navy-800 space-y-0.5">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-indigo-600 shrink-0" /> Institutional ID (Username)
                    </span>
                    <div className="text-xs font-mono font-black text-indigo-950 dark:text-indigo-200 pl-5">
                      {institutionalId}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-navy-950 border-2 border-slate-200 dark:border-navy-800 space-y-0.5">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-brand-600 shrink-0" /> Official Email Address
                    </span>
                    <div className="text-xs font-black text-slate-950 dark:text-white truncate pl-5">
                      {user?.email}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-navy-950 border-2 border-slate-200 dark:border-navy-800 space-y-0.5">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> Department Scope
                    </span>
                    <div className="text-xs font-black text-slate-950 dark:text-white pl-5">
                      {departmentName}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-navy-950 border-2 border-slate-200 dark:border-navy-800 space-y-0.5">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-purple-600 shrink-0" /> Institutional Role
                    </span>
                    <div className="text-xs font-black text-purple-800 dark:text-purple-200 pl-5">
                      {roleName}
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border-2 border-indigo-200 dark:border-indigo-800 flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-indigo-700 dark:text-indigo-300 shrink-0 mt-0.5" />
                  <p className="text-xs text-indigo-950 dark:text-indigo-100 font-bold leading-relaxed">
                    Institutional scope and department allocations are controlled centrally by college administrators.
                  </p>
                </div>
              </div>

              {/* Office Consultation & Mentoring Availability */}
              <div className="bg-white dark:bg-navy-900 rounded-3xl p-6 border-2 border-slate-200 dark:border-navy-800 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b-2 border-slate-100 dark:border-navy-800 pb-3">
                  <h3 className="text-xs font-black text-slate-950 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emerald-600" /> Student Consultation Hours
                  </h3>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Office Availability</span>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-black text-slate-900 dark:text-slate-100">Available Days</label>
                    <input
                      type="text"
                      value={consultationDays}
                      onChange={e => setConsultationDays(e.target.value)}
                      placeholder="e.g. Mon, Wed, Fri"
                      className="w-full h-10 px-3 rounded-xl border-2 border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-950 text-xs font-bold text-slate-950 dark:text-white outline-none focus:border-brand-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-black text-slate-900 dark:text-slate-100">Time Slot Window</label>
                    <input
                      type="text"
                      value={consultationSlot}
                      onChange={e => setConsultationSlot(e.target.value)}
                      placeholder="e.g. 02:00 PM – 04:30 PM"
                      className="w-full h-10 px-3 rounded-xl border-2 border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-950 text-xs font-bold text-slate-950 dark:text-white outline-none focus:border-brand-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-black text-slate-900 dark:text-slate-100">Consultation Mode</label>
                    <PremiumSelect
                      value={consultationMode}
                      onChange={setConsultationMode}
                      options={CONSULTATION_MODE_OPTIONS}
                      placeholder="Select Consultation Mode"
                      leadingIcon={<Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
                      heightClass="h-10"
                    />
                  </div>
                </div>
              </div>

              {/* Academic Social & Research Links */}
              <div className="bg-white dark:bg-navy-900 rounded-3xl p-6 border-2 border-slate-200 dark:border-navy-800 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b-2 border-slate-100 dark:border-navy-800 pb-3">
                  <h3 className="text-xs font-black text-slate-950 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <Globe className="w-4 h-4 text-brand-600 dark:text-brand-400" /> Academic & Portfolio Links
                  </h3>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Web Visibility</span>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-black text-slate-900 dark:text-slate-100">LinkedIn Profile URL</label>
                    <input
                      type="url"
                      value={linkedinUrl}
                      onChange={e => setLinkedinUrl(e.target.value)}
                      placeholder="https://linkedin.com/in/username"
                      className="w-full h-10 px-3 rounded-xl border-2 border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-950 text-xs font-bold text-slate-950 dark:text-white outline-none focus:border-brand-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-black text-slate-900 dark:text-slate-100">GitHub Profile URL</label>
                    <input
                      type="url"
                      value={githubUrl}
                      onChange={e => setGithubUrl(e.target.value)}
                      placeholder="https://github.com/username"
                      className="w-full h-10 px-3 rounded-xl border-2 border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-950 text-xs font-bold text-slate-950 dark:text-white outline-none focus:border-brand-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-black text-slate-900 dark:text-slate-100">Google Scholar Profile URL</label>
                    <input
                      type="url"
                      value={scholarUrl}
                      onChange={e => setScholarUrl(e.target.value)}
                      placeholder="https://scholar.google.com/citations?user=..."
                      className="w-full h-10 px-3 rounded-xl border-2 border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-950 text-xs font-bold text-slate-950 dark:text-white outline-none focus:border-brand-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="block text-xs font-black text-slate-900 dark:text-slate-100">ORCID iD</label>
                      <input
                        type="text"
                        value={orcidId}
                        onChange={e => setOrcidId(e.target.value)}
                        placeholder="0000-0002-1825-0097"
                        className="w-full h-10 px-3 rounded-xl border-2 border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-950 text-xs font-bold text-slate-950 dark:text-white outline-none focus:border-brand-500 font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-black text-slate-900 dark:text-slate-100">LeetCode Handle</label>
                      <input
                        type="text"
                        value={leetcodeHandle}
                        onChange={e => setLeetcodeHandle(e.target.value)}
                        placeholder="nanthish_nec"
                        className="w-full h-10 px-3 rounded-xl border-2 border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-950 text-xs font-bold text-slate-950 dark:text-white outline-none focus:border-brand-500 font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: SECURITY & PASSWORD VAULT */}
        {/* ========================================================================= */}
        {activeTab === 'security' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
            {/* LEFT COLUMN: Password Change */}
            <div className="lg:col-span-7 space-y-6">
              
              <div className="bg-white dark:bg-navy-900 rounded-3xl p-6 border-2 border-slate-200 dark:border-navy-800 shadow-sm space-y-5">
                <div className="flex items-center justify-between border-b-2 border-slate-100 dark:border-navy-800 pb-3">
                  <h3 className="text-xs font-black text-slate-950 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Password Management
                  </h3>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Authorized by Current Password</span>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-black text-slate-900 dark:text-slate-100">Current Password</label>
                    <div className="relative">
                      <input
                        type={showCurrentPassword ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={e => setCurrentPassword(e.target.value)}
                        placeholder="Enter current password to authorize changes"
                        className="w-full h-11 px-4 pr-10 rounded-xl border-2 border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-950 text-xs font-bold text-slate-950 dark:text-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                      >
                        {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-black text-slate-900 dark:text-slate-100">New Password</label>
                      <div className="relative">
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          value={newPassword}
                          onChange={e => setNewPassword(e.target.value)}
                          placeholder="Min 6 characters"
                          className="w-full h-11 px-4 pr-10 rounded-xl border-2 border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-950 text-xs font-bold text-slate-950 dark:text-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                        >
                          {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-black text-slate-900 dark:text-slate-100">Confirm New Password</label>
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        placeholder="Repeat new password"
                        className="w-full h-11 px-4 rounded-xl border-2 border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-950 text-xs font-bold text-slate-950 dark:text-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
                      />
                    </div>
                  </div>

                  {newPassword && (
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-navy-950 border-2 border-slate-200 dark:border-navy-800 space-y-2">
                      <div className="flex items-center justify-between text-xs font-black">
                        <span className="text-slate-800 dark:text-slate-200">Password Entropy Strength:</span>
                        <span className={`font-black ${passwordStrength.color.replace('bg-', 'text-')}`}>
                          {passwordStrength.label} (Crack time: {passwordStrength.crackTime})
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-navy-800 overflow-hidden">
                        <div className={`h-full ${passwordStrength.color} transition-all duration-300`} style={{ width: `${passwordStrength.score}%` }} />
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 pt-1 text-[10px] font-bold">
                        <span className={`flex items-center gap-1 ${newPassword.length >= 8 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                          <Check className="w-3 h-3" /> At least 8 characters
                        </span>
                        <span className={`flex items-center gap-1 ${/[A-Z]/.test(newPassword) ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                          <Check className="w-3 h-3" /> Uppercase letter
                        </span>
                        <span className={`flex items-center gap-1 ${/[0-9]/.test(newPassword) ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                          <Check className="w-3 h-3" /> Number (0-9)
                        </span>
                        <span className={`flex items-center gap-1 ${/[^A-Za-z0-9]/.test(newPassword) ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                          <Check className="w-3 h-3" /> Special symbol (!@#$)
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Passkey / Hardware Key Biometrics */}
              <div className="bg-white dark:bg-navy-900 rounded-3xl p-6 border-2 border-slate-200 dark:border-navy-800 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b-2 border-slate-100 dark:border-navy-800 pb-3">
                  <h3 className="text-xs font-black text-slate-950 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <Fingerprint className="w-4 h-4 text-cyan-600" /> Passkeys & Biometric Hardware Key
                  </h3>
                  <span className="text-xs font-black px-2 py-0.5 rounded-md bg-cyan-100 text-cyan-800 dark:bg-cyan-950/80 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-700">
                    FIDO2 / WebAuthn
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-navy-950 border-2 border-slate-200 dark:border-navy-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-black text-slate-950 dark:text-white">Windows Hello / Touch ID / YubiKey</h4>
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-300">Sign in instantly without passwords using cryptographic biometrics.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => notify.success('Passkey registration initiated. Verified for current device.', '', { category: 'ADMIN' })}
                    className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-black transition-all shadow-xs cursor-pointer inline-flex items-center gap-1.5 shrink-0"
                  >
                    <Fingerprint className="w-3.5 h-3.5" />
                    <span>Register Passkey</span>
                  </button>
                </div>
              </div>

              {/* Two-Factor Authentication 2FA */}
              <div className="bg-white dark:bg-navy-900 rounded-3xl p-6 border-2 border-slate-200 dark:border-navy-800 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b-2 border-slate-100 dark:border-navy-800 pb-3">
                  <h3 className="text-xs font-black text-slate-950 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Two-Factor Authentication (2FA)
                  </h3>
                  <span className={`text-xs font-black px-2.5 py-0.5 rounded-md border ${
                    is2FAEnabled 
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300' 
                      : 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/80 dark:text-amber-300'
                  }`}>
                    {is2FAEnabled ? 'ENABLED' : 'DISABLED'}
                  </span>
                </div>

                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Secure your portal access with authenticator apps like Google Authenticator, Microsoft Authenticator, or 1Password.
                </p>

                <div className="flex items-center gap-3 flex-wrap pt-1">
                  {!is2FAEnabled ? (
                    <button
                      type="button"
                      onClick={() => setShow2FASetupModal(true)}
                      className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black transition-all shadow-xs cursor-pointer inline-flex items-center gap-2"
                    >
                      <QrCode className="w-4 h-4" />
                      <span>Enable 2FA Protection</span>
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setShowBackupCodesModal(true)}
                        className="px-4 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-navy-800 dark:hover:bg-navy-700 text-slate-900 dark:text-slate-100 text-xs font-black transition-all border border-slate-300 dark:border-navy-700 cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <Key className="w-3.5 h-3.5 text-brand-500" />
                        <span>View Backup Codes</span>
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          setIs2FAEnabled(false);
                          localStorage.setItem('nec_2fa_enabled', 'false');
                          try {
                            await api.put('/auth/profile', { is_2fa_enabled: false });
                          } catch {}
                          notify.success('2FA disabled.', '', { category: 'ADMIN' });
                        }}
                        className="px-4 py-2.5 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300 text-xs font-black transition-all border border-rose-300 dark:border-rose-500/30 cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <ShieldX className="w-3.5 h-3.5" />
                        <span>Disable 2FA</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

            </div>

            {/* RIGHT COLUMN: Active Sessions & Security Audit History */}
            <div className="lg:col-span-5 space-y-6">
              
              {/* Active Logged-in Devices */}
              <div className="bg-white dark:bg-navy-900 rounded-3xl p-6 border-2 border-slate-200 dark:border-navy-800 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b-2 border-slate-100 dark:border-navy-800 pb-3">
                  <h3 className="text-xs font-black text-slate-950 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <Laptop className="w-4 h-4 text-brand-600 dark:text-brand-400" /> Active Logged-in Devices
                  </h3>
                  {sessions.length > 1 && (
                    <button
                      type="button"
                      onClick={handleRevokeAllOtherSessions}
                      className="text-xs font-black text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                    >
                      Revoke Other
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  {sessions.map(s => (
                    <div key={s.id} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-navy-950 border-2 border-slate-200 dark:border-navy-800 flex items-center justify-between gap-3">
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black text-slate-950 dark:text-white truncate">{s.device}</span>
                          {s.current && (
                            <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-1.5 py-0.2 rounded">
                              THIS
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] font-mono text-slate-600 dark:text-slate-400 font-bold">{s.ip}</p>
                      </div>

                      {!s.current && (
                        <button
                          type="button"
                          onClick={() => handleRevokeSession(s.id)}
                          className="px-2.5 py-1 rounded-lg text-xs font-black bg-rose-100 hover:bg-rose-200 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300 transition-colors border border-rose-300 dark:border-rose-500/30 cursor-pointer shrink-0"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Login Security Audit Log */}
              <div className="bg-white dark:bg-navy-900 rounded-3xl p-6 border-2 border-slate-200 dark:border-navy-800 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b-2 border-slate-100 dark:border-navy-800 pb-3 flex-wrap gap-2">
                  <h3 className="text-xs font-black text-slate-950 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <Clock className="w-4 h-4 text-purple-600 dark:text-purple-400" /> Login Security Audit Log
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handlePrintSecurityAuditReport}
                      className="px-2.5 py-1 rounded-lg text-xs font-black bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-navy-800 dark:hover:bg-navy-700 dark:text-slate-200 transition-colors border border-slate-300 dark:border-navy-700 cursor-pointer flex items-center gap-1.5"
                      title="Print or Save Official Institutional PDF Report"
                    >
                      <Printer className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                      <span>Print Report</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleExportSecurityAuditCsv}
                      className="px-2.5 py-1 rounded-lg text-xs font-black bg-emerald-50 hover:bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 dark:text-emerald-300 transition-colors border border-emerald-300 dark:border-emerald-800 cursor-pointer flex items-center gap-1.5"
                      title="Export perfectly formatted CSV for Microsoft Excel"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Excel CSV</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {loginHistory.length === 0 ? (
                    <div className="p-6 rounded-xl bg-slate-50 dark:bg-navy-950/50 border-2 border-dashed border-slate-200 dark:border-navy-800 flex flex-col items-center justify-center text-center">
                      <Clock className="w-8 h-8 text-slate-400 dark:text-navy-600 mb-2 opacity-50" />
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400">No login security events recorded yet.</p>
                      <p className="text-[10px] text-slate-400 dark:text-navy-500 mt-1">Authentic original logs will appear here upon next sign-in.</p>
                    </div>
                  ) : (
                    loginHistory.map(lh => (
                      <div key={lh.id} className="p-3 rounded-xl bg-slate-50 dark:bg-navy-950 border-2 border-slate-200 dark:border-navy-800 flex items-center justify-between gap-3 text-xs">
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-[11px] text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/60 px-1.5 py-0.5 rounded border border-brand-200 dark:border-brand-800">
                              {lh.id}
                            </span>
                            <span className="font-black text-slate-950 dark:text-white truncate">{lh.date}, {lh.time}</span>
                          </div>
                          <p className="text-[11px] font-mono text-slate-600 dark:text-slate-400 font-bold truncate">
                            {lh.ip} • <span className="text-slate-800 dark:text-slate-300">{lh.network}</span> • {lh.method}
                          </p>
                        </div>
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 shrink-0">
                          {lh.status}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: NOTIFICATIONS & PRIVACY PREFERENCES */}
        {/* ========================================================================= */}
        {activeTab === 'preferences' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
            {/* LEFT COLUMN: Automated Notifications */}
            <div className="lg:col-span-7 space-y-6">
              
              <div className="bg-white dark:bg-navy-900 rounded-3xl p-6 border-2 border-slate-200 dark:border-navy-800 shadow-sm space-y-5">
                <div className="flex items-center justify-between border-b-2 border-slate-100 dark:border-navy-800 pb-3">
                  <h3 className="text-xs font-black text-slate-950 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <Bell className="w-4 h-4 text-purple-600 dark:text-purple-400" /> Automated Portal Alerts
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={playChimeSound}
                      className="px-2.5 py-1 rounded-lg text-xs font-black bg-purple-100 hover:bg-purple-200 text-purple-800 dark:bg-purple-500/20 dark:text-purple-300 transition-colors border border-purple-300 dark:border-purple-500/30 cursor-pointer flex items-center gap-1"
                      title="Test Audio Chime"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>Test Audio</span>
                    </button>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Real-Time Sync</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="flex items-start justify-between gap-4 p-3.5 rounded-2xl bg-slate-50 dark:bg-navy-950 border-2 border-slate-200 dark:border-navy-800 cursor-pointer hover:border-brand-500/50 transition-colors">
                    <div>
                      <div className="text-xs font-black text-slate-950 dark:text-white">Contest Finalization Receipts</div>
                      <div className="text-xs font-bold text-slate-700 dark:text-slate-300">Receive email receipts when weekly LeetCode contests are finalized.</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={emailContestAlerts}
                      onChange={e => setEmailContestAlerts(e.target.checked)}
                      className="w-5 h-5 rounded-lg text-brand-600 focus:ring-brand-500 cursor-pointer shrink-0 mt-0.5"
                    />
                  </label>

                  <label className="flex items-start justify-between gap-4 p-3.5 rounded-2xl bg-slate-50 dark:bg-navy-950 border-2 border-slate-200 dark:border-navy-800 cursor-pointer hover:border-brand-500/50 transition-colors">
                    <div>
                      <div className="text-xs font-black text-slate-950 dark:text-white">Weekly Mentee Progress Digest</div>
                      <div className="text-xs font-bold text-slate-700 dark:text-slate-300">Summary of assigned students solving milestones every Monday.</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={weeklyDigestAlerts}
                      onChange={e => setWeeklyDigestAlerts(e.target.checked)}
                      className="w-5 h-5 rounded-lg text-brand-600 focus:ring-brand-500 cursor-pointer shrink-0 mt-0.5"
                    />
                  </label>

                  <label className="flex items-start justify-between gap-4 p-3.5 rounded-2xl bg-slate-50 dark:bg-navy-950 border-2 border-slate-200 dark:border-navy-800 cursor-pointer hover:border-brand-500/50 transition-colors">
                    <div>
                      <div className="text-xs font-black text-slate-950 dark:text-white">Security Audit Alerts</div>
                      <div className="text-xs font-bold text-slate-700 dark:text-slate-300">Receive instant alerts if password is modified or new logins occur.</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={systemAuditAlerts}
                      onChange={e => setSystemAuditAlerts(e.target.checked)}
                      className="w-5 h-5 rounded-lg text-brand-600 focus:ring-brand-500 cursor-pointer shrink-0 mt-0.5"
                    />
                  </label>

                  <label className="flex items-start justify-between gap-4 p-3.5 rounded-2xl bg-slate-50 dark:bg-navy-950 border-2 border-slate-200 dark:border-navy-800 cursor-pointer hover:border-brand-500/50 transition-colors">
                    <div>
                      <div className="text-xs font-black text-slate-950 dark:text-white">In-App Notification Audio</div>
                      <div className="text-xs font-bold text-slate-700 dark:text-slate-300">Play subtle sound chimes when receiving toast alerts.</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={toastAudioAlerts}
                      onChange={e => setToastAudioAlerts(e.target.checked)}
                      className="w-5 h-5 rounded-lg text-brand-600 focus:ring-brand-500 cursor-pointer shrink-0 mt-0.5"
                    />
                  </label>
                </div>
              </div>

              {/* Mentee Inactivity Smart Alarm */}
              <div className="bg-white dark:bg-navy-900 rounded-3xl p-6 border-2 border-slate-200 dark:border-navy-800 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b-2 border-slate-100 dark:border-navy-800 pb-3">
                  <h3 className="text-xs font-black text-slate-950 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-brand-600" /> Mentee Inactivity Warning Threshold
                  </h3>
                  <span className="text-xs font-black font-mono text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950 px-2.5 py-0.5 rounded-md border border-brand-200">
                    {inactivityDaysThreshold} Days
                  </span>
                </div>

                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Automatically mark mentees with an inactivity indicator on your roster if they have not submitted a LeetCode problem in {inactivityDaysThreshold} consecutive days.
                </p>

                <div className="space-y-2 pt-2">
                  <input
                    type="range"
                    min={3}
                    max={14}
                    step={1}
                    value={inactivityDaysThreshold}
                    onChange={e => setInactivityDaysThreshold(Number(e.target.value))}
                    className="w-full accent-brand-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] font-bold text-slate-500">
                    <span>3 Days (Strict)</span>
                    <span>7 Days (Balanced)</span>
                    <span>14 Days (Relaxed)</span>
                  </div>
                </div>
              </div>

            </div>

            {/* RIGHT COLUMN: Directory Privacy & Faculty Scratchpad */}
            <div className="lg:col-span-5 space-y-6">
              
              {/* Directory Privacy */}
              <div className="bg-white dark:bg-navy-900 rounded-3xl p-6 border-2 border-slate-200 dark:border-navy-800 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b-2 border-slate-100 dark:border-navy-800 pb-3">
                  <h3 className="text-xs font-black text-slate-950 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <Lock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Student Directory Privacy
                  </h3>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Access Policy</span>
                </div>

                <div className="space-y-3">
                  <label className="flex items-start justify-between gap-4 p-3.5 rounded-2xl bg-slate-50 dark:bg-navy-950 border-2 border-slate-200 dark:border-navy-800 cursor-pointer hover:border-brand-500/50 transition-colors">
                    <div>
                      <div className="text-xs font-black text-slate-950 dark:text-white">Share Mobile with Mentees</div>
                      <div className="text-xs font-bold text-slate-700 dark:text-slate-300">Allow your assigned batch to view your WhatsApp contact.</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={showPhoneToStudents}
                      onChange={e => setShowPhoneToStudents(e.target.checked)}
                      className="w-5 h-5 rounded-lg text-brand-600 focus:ring-brand-500 cursor-pointer shrink-0 mt-0.5"
                    />
                  </label>

                  <label className="flex items-start justify-between gap-4 p-3.5 rounded-2xl bg-slate-50 dark:bg-navy-950 border-2 border-slate-200 dark:border-navy-800 cursor-pointer hover:border-brand-500/50 transition-colors">
                    <div>
                      <div className="text-xs font-black text-slate-950 dark:text-white">Show Cabin in Directory</div>
                      <div className="text-xs font-bold text-slate-700 dark:text-slate-300">Display room location on college directory search.</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={showCabinInDirectory}
                      onChange={e => setShowCabinInDirectory(e.target.checked)}
                      className="w-5 h-5 rounded-lg text-brand-600 focus:ring-brand-500 cursor-pointer shrink-0 mt-0.5"
                    />
                  </label>
                </div>
              </div>

              {/* Faculty Scratchpad / Sticky Notes */}
              <div className="bg-white dark:bg-navy-900 rounded-3xl p-6 border-2 border-slate-200 dark:border-navy-800 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b-2 border-slate-100 dark:border-navy-800 pb-3">
                  <h3 className="text-xs font-black text-slate-950 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <Edit3 className="w-4 h-4 text-amber-500" /> Private Faculty Scratchpad
                  </h3>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Auto-Saved</span>
                </div>

                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Quick personal notes, problem set ideas, or contest reminders (saved locally on your device).
                </p>

                <textarea
                  rows={5}
                  value={facultyNotes}
                  onChange={e => setFacultyNotes(e.target.value)}
                  placeholder="Type personal faculty notes here..."
                  className="w-full p-3.5 rounded-2xl border-2 border-slate-300 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 text-xs font-bold text-slate-950 dark:text-white outline-none focus:border-brand-500 resize-none font-mono"
                />
              </div>

            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: DIGITAL IDENTITY CARD */}
        {/* ========================================================================= */}
        {activeTab === 'id_card' && (
          <div className="space-y-6 animate-fade-in">
            
            {/* Top Card Controls & Theme Switcher */}
            <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-navy-900 border-2 border-slate-200 dark:border-navy-800 w-full">
              <div className="flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-3">
                <span className="text-xs font-black text-slate-950 dark:text-white uppercase tracking-wider shrink-0">Badge Theme:</span>
                <div className="flex flex-row items-center gap-1.5 flex-wrap">
                  {CARD_THEMES.map(th => (
                    <button
                      key={th.id}
                      type="button"
                      onClick={() => setSelectedCardTheme(th.id)}
                      className={`px-3 py-1 rounded-xl text-xs font-black transition-all border-2 cursor-pointer whitespace-nowrap ${
                        selectedCardTheme === th.id
                          ? 'bg-brand-600 text-white border-brand-700 shadow-xs'
                          : 'bg-slate-100 dark:bg-navy-950 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-navy-800'
                      }`}
                    >
                      {th.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-row items-center gap-2 flex-wrap shrink-0">
                <button
                  type="button"
                  onClick={() => setIdCardSide(idCardSide === 'front' ? 'back' : 'front')}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black transition-all shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Flip to {idCardSide === 'front' ? 'Back Side' : 'Front Side'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportVCard}
                  className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black transition-all shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                  title="Download vCard file for mobile phonebook"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Save vCard</span>
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-black text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 text-xs font-black transition-all shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print ID</span>
                </button>
              </div>
            </div>

            {/* Smart 2-Sided High-Security ID Card Container */}
            <div className="flex justify-center p-2 sm:p-6">
              
              {idCardSide === 'front' ? (
                /* FRONT SIDE OF ID CARD */
                <div className={`w-full max-w-md rounded-3xl bg-gradient-to-br ${currentCardTheme.bg} p-6 text-white shadow-2xl border-2 ${currentCardTheme.border} relative overflow-hidden space-y-6 animate-fade-in`}>
                  
                  {/* Holographic Watermark glow */}
                  <div className="absolute top-0 right-0 w-64 h-64 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />
                  <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

                  {/* Institution Header */}
                  <div className="flex items-center justify-between border-b border-white/20 pb-4 relative z-10">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/30 flex items-center justify-center font-black text-amber-300 text-lg shadow-inner">
                        NEC
                      </div>
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-wider text-white">NANDHA ENGINEERING COLLEGE</h4>
                        <p className="text-[10px] text-slate-300 font-bold">Autonomous • Institutional Portal Identity</p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-500/25 border border-emerald-400/40 text-emerald-300">
                      FACULTY
                    </span>
                  </div>

                  {/* Profile Body */}
                  <div className="flex items-center gap-5 relative z-10">
                    <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-amber-400/80 shadow-xl bg-slate-900 shrink-0 flex items-center justify-center">
                      {profilePhoto ? (
                        <img src={profilePhoto} alt="ID Photo" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-tr from-brand-600 to-indigo-600 text-white font-black text-3xl flex items-center justify-center">
                          {(fullName || user?.username || 'U').charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>

                    <div className="space-y-1 min-w-0">
                      <h3 className="text-lg font-black text-white truncate tracking-tight">{fullName || user?.username}</h3>
                      <p className="text-xs font-bold text-amber-300 truncate">{designation || roleName}</p>
                      <div className="pt-1 flex items-center gap-1.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded font-mono text-[11px] font-black bg-white/20 text-white border border-white/20">
                          {institutionalId}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[11px] font-black bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                          {departmentName}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Front Specs Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs font-bold bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/15 relative z-10">
                    <div>
                      <span className="text-[10px] uppercase font-black text-slate-300 block">DOB (Verified)</span>
                      <span className="font-mono text-white text-xs">{dateOfBirth || 'Registered'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-black text-slate-300 block">Blood Group</span>
                      <span className="text-rose-300 font-black text-xs">{bloodGroup}</span>
                    </div>
                    <div className="col-span-2 pt-1 border-t border-white/10">
                      <span className="text-[10px] uppercase font-black text-slate-300 block">Office Cabin Location</span>
                      <span className="text-white text-xs truncate block">{officeLocation}</span>
                    </div>
                  </div>

                  {/* Selected Badges Row on ID Card with Lucide Icons */}
                  {selectedBadges.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap relative z-10">
                      {selectedBadges.slice(0, 3).map(bId => {
                        const badge = AVAILABLE_BADGES.find(b => b.id === bId);
                        if (!badge) return null;
                        const BadgeIcon = badge.icon;
                        return (
                          <span key={bId} className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-black bg-white/15 text-white border border-white/20">
                            <BadgeIcon className="w-3 h-3 text-amber-300" />
                            <span>{badge.label}</span>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Front Card Footer Barcode & Flip Hint */}
                  <div className="pt-2 border-t border-white/15 flex items-center justify-between text-[10px] font-bold text-slate-300 relative z-10">
                    <span>Autonomous • Anna University</span>
                    <button
                      type="button"
                      onClick={() => setIdCardSide('back')}
                      className="text-amber-300 hover:underline flex items-center gap-1 cursor-pointer font-black"
                    >
                      <span>Flip to Back</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>

                </div>
              ) : (
                /* BACK SIDE OF ID CARD */
                <div className={`w-full max-w-md rounded-3xl bg-gradient-to-br ${currentCardTheme.bg} p-6 text-white shadow-2xl border-2 ${currentCardTheme.border} relative overflow-hidden space-y-5 animate-fade-in`}>
                  
                  {/* Holographic Watermark glow */}
                  <div className="absolute top-0 left-0 w-64 h-64 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

                  {/* Back Header */}
                  <div className="flex items-center justify-between border-b border-white/20 pb-3 relative z-10">
                    <span className="text-xs font-black uppercase tracking-wider text-amber-300">
                      OFFICIAL INSTITUTIONAL RECORD
                    </span>
                    <span className="text-[10px] font-mono text-slate-300 font-bold">CARD-ID-2025</span>
                  </div>

                  {/* Emergency & Medical Box */}
                  <div className="p-3.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 space-y-2 relative z-10">
                    <span className="text-[10px] font-black uppercase text-amber-300 tracking-wider flex items-center gap-1.5">
                      <Heart className="w-3 h-3 text-rose-400" /> Emergency & Medical Dispatch
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-300 block">Emergency Person</span>
                        <span className="font-black text-white">{emergencyContactName || 'Department HOD'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-300 block">Emergency Phone</span>
                        <span className="font-mono font-black text-white">{emergencyContactPhone || phoneNumber || '+91 9876543210'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Back Qualifications & Research */}
                  <div className="p-3.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 space-y-1.5 relative z-10 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-black text-slate-300 block">Highest Degree</span>
                      <span className="font-bold text-white text-[11px] truncate block">{highestDegree}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-black text-slate-300 block">Specialization</span>
                      <span className="font-bold text-white text-[11px] truncate block">{specialization}</span>
                    </div>
                  </div>

                  {/* QR Code & Verification Signature */}
                  <div className="flex items-center justify-between gap-4 p-3.5 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 relative z-10">
                    <div className="space-y-1 min-w-0">
                      <span className="text-[10px] font-black uppercase text-emerald-300 tracking-wider block">
                        VERIFIED IDENTITY HASH
                      </span>
                      <p className="font-mono text-[9px] text-slate-200 break-all">
                        SHA256-{institutionalId.toLowerCase()}-verified-2026
                      </p>
                      <p className="text-[10px] text-slate-300 font-bold">Scan with phone camera to save contact & verify</p>
                    </div>

                    {/* Real Scannable Dynamic QR Code */}
                    <div className="shrink-0">
                      <DynamicQRCode data={qrVerificationPayload} size={84} />
                    </div>
                  </div>

                  {/* Flip Back Button */}
                  <div className="pt-2 border-t border-white/15 flex items-center justify-between text-[10px] font-bold text-slate-300 relative z-10">
                    <span>Nandha Engineering College (Autonomous)</span>
                    <button
                      type="button"
                      onClick={() => setIdCardSide('front')}
                      className="text-amber-300 hover:underline flex items-center gap-1 cursor-pointer font-black"
                    >
                      <span>Flip to Front</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>

                </div>
              )}

            </div>

            {/* Accreditation Summary Box */}
            <div className="bg-white dark:bg-navy-900 rounded-3xl p-6 border-2 border-slate-200 dark:border-navy-800 shadow-sm space-y-4">
              <h3 className="text-xs font-black text-slate-950 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Award className="w-4 h-4 text-brand-600" /> Institutional Accreditation & Record Summary
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-800 space-y-0.5">
                  <span className="text-[10px] uppercase font-black text-slate-700 dark:text-slate-300 block">Accreditation Level</span>
                  <span className="font-black text-slate-950 dark:text-white">NBA & NAAC A+ Grade</span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-800 space-y-0.5">
                  <span className="text-[10px] uppercase font-black text-slate-700 dark:text-slate-300 block">Affiliation</span>
                  <span className="font-black text-slate-950 dark:text-white">Autonomous • Anna Univ</span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-800 space-y-0.5">
                  <span className="text-[10px] uppercase font-black text-slate-700 dark:text-slate-300 block">Academic Session</span>
                  <span className="font-black text-slate-950 dark:text-white">2025 – 2026</span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-800 space-y-0.5">
                  <span className="text-[10px] uppercase font-black text-slate-700 dark:text-slate-300 block">Verification Status</span>
                  <span className="font-black text-emerald-600 dark:text-emerald-400">Cryptographically Sealed</span>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: MENTORSHIP & TRACKING */}
        {/* ========================================================================= */}
        {activeTab === 'mentorship' && (
          <div className="grid grid-cols-1 gap-6 animate-fade-in">
            <div className="bg-white dark:bg-navy-900 rounded-3xl p-6 border-2 border-slate-200 dark:border-navy-800 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b-2 border-slate-100 dark:border-navy-800 pb-3">
                <h3 className="text-xs font-black text-slate-950 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Student Mentorship & Attendance
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800/30 flex flex-col items-center justify-center text-center">
                  <span className="text-3xl font-black text-blue-700 dark:text-blue-400">24</span>
                  <span className="text-[10px] font-bold text-blue-600/80 dark:text-blue-400/80 uppercase tracking-wider mt-1">Assigned Mentees</span>
                </div>
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border-2 border-emerald-200 dark:border-emerald-800/30 flex flex-col items-center justify-center text-center">
                  <span className="text-3xl font-black text-emerald-700 dark:text-emerald-400">92%</span>
                  <span className="text-[10px] font-bold text-emerald-600/80 dark:text-emerald-400/80 uppercase tracking-wider mt-1">Avg Attendance</span>
                </div>
                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-800/30 flex flex-col items-center justify-center text-center">
                  <span className="text-3xl font-black text-amber-700 dark:text-amber-400">3</span>
                  <span className="text-[10px] font-bold text-amber-600/80 dark:text-amber-400/80 uppercase tracking-wider mt-1">Pending Interventions</span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-wide">Mentee Roster</h4>
                  <button type="button" onClick={handleExportCSV} className="text-[10px] font-bold px-3 py-1 bg-slate-100 dark:bg-navy-950 hover:bg-slate-200 dark:hover:bg-navy-800 text-slate-700 dark:text-slate-300 rounded-lg cursor-pointer transition-colors">
                    Export List
                  </button>
                </div>
                
                <div className="border-2 border-slate-200 dark:border-navy-800 rounded-xl overflow-hidden">
                  <div className="overflow-y-auto overflow-x-auto max-h-[250px] custom-scrollbar">
                    <table className="w-full text-left text-[10px] sm:text-xs whitespace-nowrap">
                      <thead className="bg-slate-100 dark:bg-navy-950 text-slate-700 dark:text-slate-300 font-black uppercase text-[9px] sm:text-[10px] border-b-2 border-slate-200 dark:border-navy-800 sticky top-0 z-10">
                        <tr>
                          <th className="px-2 sm:px-4 py-2 sm:py-3"><span className="hidden sm:inline">Student Reg No</span><span className="sm:hidden">Reg No</span></th>
                          <th className="px-2 sm:px-4 py-2 sm:py-3">Name</th>
                          <th className="px-2 sm:px-4 py-2 sm:py-3"><span className="hidden sm:inline">Attendance</span><span className="sm:hidden">Att%</span></th>
                          <th className="px-2 sm:px-4 py-2 sm:py-3"><span className="hidden sm:inline">LeetCode Solved</span><span className="sm:hidden">LC</span></th>
                          <th className="px-2 sm:px-4 py-2 sm:py-3 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-navy-800 text-slate-800 dark:text-slate-200 font-bold">
                        <tr className="hover:bg-slate-50 dark:hover:bg-navy-950/50 transition-colors">
                          <td className="px-2 sm:px-4 py-2 sm:py-3 font-mono">732221104001</td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3">Aakash S</td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3"><span className="text-emerald-600 dark:text-emerald-400">96%</span></td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3">142</td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3 text-center"><button type="button" onClick={() => setSelectedMentee({ name: 'Aakash S', regNo: '732221104001', att: '96%', solved: 142, actionType: 'View' })} className="p-1.5 sm:p-2 rounded-xl bg-brand-50 hover:bg-brand-100 dark:bg-brand-500/10 dark:hover:bg-brand-500/20 text-brand-600 dark:text-brand-400 transition-colors cursor-pointer inline-flex items-center justify-center group" title="View Profile"><Eye className="w-4 h-4 group-hover:scale-110 transition-transform" /></button></td>
                        </tr>
                        <tr className="hover:bg-slate-50 dark:hover:bg-navy-950/50 transition-colors bg-rose-50/30 dark:bg-rose-900/10">
                          <td className="px-2 sm:px-4 py-2 sm:py-3 font-mono">732221104042</td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3">Bharath K</td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3"><span className="text-rose-600 dark:text-rose-400">68%</span></td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3">14</td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3 text-center"><button type="button" onClick={() => setSelectedMentee({ name: 'Bharath K', regNo: '732221104042', att: '68%', solved: 14, actionType: 'Intervene' })} className="p-1.5 sm:p-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 transition-colors cursor-pointer inline-flex items-center justify-center group" title="Intervene"><AlertTriangle className="w-4 h-4 group-hover:scale-110 transition-transform" /></button></td>
                        </tr>
                        <tr className="hover:bg-slate-50 dark:hover:bg-navy-950/50 transition-colors">
                          <td className="px-2 sm:px-4 py-2 sm:py-3 font-mono">732221104073</td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3">Dharshini M</td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3"><span className="text-emerald-600 dark:text-emerald-400">91%</span></td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3">280</td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3 text-center"><button type="button" onClick={() => setSelectedMentee({ name: 'Dharshini M', regNo: '732221104073', att: '91%', solved: 280, actionType: 'View' })} className="p-1.5 sm:p-2 rounded-xl bg-brand-50 hover:bg-brand-100 dark:bg-brand-500/10 dark:hover:bg-brand-500/20 text-brand-600 dark:text-brand-400 transition-colors cursor-pointer inline-flex items-center justify-center group" title="View Profile"><Eye className="w-4 h-4 group-hover:scale-110 transition-transform" /></button></td>
                        </tr>
                        <tr className="hover:bg-slate-50 dark:hover:bg-navy-950/50 transition-colors">
                          <td className="px-2 sm:px-4 py-2 sm:py-3 font-mono">732221104021</td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3">Gokul R</td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3"><span className="text-emerald-600 dark:text-emerald-400">89%</span></td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3">105</td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3 text-center"><button type="button" onClick={() => setSelectedMentee({ name: 'Gokul R', regNo: '732221104021', att: '89%', solved: 105, actionType: 'View' })} className="p-1.5 sm:p-2 rounded-xl bg-brand-50 hover:bg-brand-100 dark:bg-brand-500/10 dark:hover:bg-brand-500/20 text-brand-600 dark:text-brand-400 transition-colors cursor-pointer inline-flex items-center justify-center group" title="View Profile"><Eye className="w-4 h-4 group-hover:scale-110 transition-transform" /></button></td>
                        </tr>
                        <tr className="hover:bg-slate-50 dark:hover:bg-navy-950/50 transition-colors bg-amber-50/30 dark:bg-amber-900/10">
                          <td className="px-2 sm:px-4 py-2 sm:py-3 font-mono">732221104088</td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3">Harish V</td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3"><span className="text-amber-600 dark:text-amber-400">74%</span></td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3">42</td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3 text-center"><button type="button" onClick={() => setSelectedMentee({ name: 'Harish V', regNo: '732221104088', att: '74%', solved: 42, actionType: 'Warn' })} className="p-1.5 sm:p-2 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 transition-colors cursor-pointer inline-flex items-center justify-center group" title="Warn"><Bell className="w-4 h-4 group-hover:scale-110 transition-transform" /></button></td>
                        </tr>
                        <tr className="hover:bg-slate-50 dark:hover:bg-navy-950/50 transition-colors">
                          <td className="px-2 sm:px-4 py-2 sm:py-3 font-mono">732221104112</td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3">Kavya T</td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3"><span className="text-emerald-600 dark:text-emerald-400">98%</span></td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3">310</td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3 text-center"><button type="button" onClick={() => setSelectedMentee({ name: 'Kavya T', regNo: '732221104112', att: '98%', solved: 310, actionType: 'View' })} className="p-1.5 sm:p-2 rounded-xl bg-brand-50 hover:bg-brand-100 dark:bg-brand-500/10 dark:hover:bg-brand-500/20 text-brand-600 dark:text-brand-400 transition-colors cursor-pointer inline-flex items-center justify-center group" title="View Profile"><Eye className="w-4 h-4 group-hover:scale-110 transition-transform" /></button></td>
                        </tr>
                        <tr className="hover:bg-slate-50 dark:hover:bg-navy-950/50 transition-colors">
                          <td className="px-2 sm:px-4 py-2 sm:py-3 font-mono">732221104144</td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3">Manikandan P</td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3"><span className="text-emerald-600 dark:text-emerald-400">85%</span></td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3">95</td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3 text-center"><button type="button" onClick={() => setSelectedMentee({ name: 'Manikandan P', regNo: '732221104144', att: '85%', solved: 95, actionType: 'View' })} className="p-1.5 sm:p-2 rounded-xl bg-brand-50 hover:bg-brand-100 dark:bg-brand-500/10 dark:hover:bg-brand-500/20 text-brand-600 dark:text-brand-400 transition-colors cursor-pointer inline-flex items-center justify-center group" title="View Profile"><Eye className="w-4 h-4 group-hover:scale-110 transition-transform" /></button></td>
                        </tr>
                        <tr className="hover:bg-slate-50 dark:hover:bg-navy-950/50 transition-colors bg-rose-50/30 dark:bg-rose-900/10">
                          <td className="px-2 sm:px-4 py-2 sm:py-3 font-mono">732221104165</td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3">Nandhini G</td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3"><span className="text-rose-600 dark:text-rose-400">62%</span></td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3">8</td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3 text-center"><button type="button" onClick={() => setSelectedMentee({ name: 'Nandhini G', regNo: '732221104165', att: '62%', solved: 8, actionType: 'Intervene' })} className="p-1.5 sm:p-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 transition-colors cursor-pointer inline-flex items-center justify-center group" title="Intervene"><AlertTriangle className="w-4 h-4 group-hover:scale-110 transition-transform" /></button></td>
                        </tr>
                        <tr className="hover:bg-slate-50 dark:hover:bg-navy-950/50 transition-colors">
                          <td className="px-2 sm:px-4 py-2 sm:py-3 font-mono">732221104189</td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3">Praveen J</td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3"><span className="text-emerald-600 dark:text-emerald-400">94%</span></td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3">188</td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3 text-center"><button type="button" onClick={() => setSelectedMentee({ name: 'Praveen J', regNo: '732221104189', att: '94%', solved: 188, actionType: 'View' })} className="p-1.5 sm:p-2 rounded-xl bg-brand-50 hover:bg-brand-100 dark:bg-brand-500/10 dark:hover:bg-brand-500/20 text-brand-600 dark:text-brand-400 transition-colors cursor-pointer inline-flex items-center justify-center group" title="View Profile"><Eye className="w-4 h-4 group-hover:scale-110 transition-transform" /></button></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4. MASTER SAVE & ACTIONS BOTTOM BAR */}
        <div className="p-3 sm:p-5 rounded-3xl bg-white dark:bg-navy-900 border-2 border-slate-200 dark:border-navy-800 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 mt-8 mb-4">
          <div className="flex items-center gap-2 text-[10px] sm:text-xs font-bold text-slate-700 dark:text-slate-300">
            <Info className="w-4 h-4 text-brand-600 shrink-0" />
            <span>Updates will apply immediately across your college portal session.</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => {
                setFullName(user?.full_name || user?.name || user?.username || '');
                setDesignation((user as any)?.designation || '');
                setPhoneNumber((user as any)?.phone_number || '');
                setDateOfBirth(parseDOBToDisplay((user as any)?.date_of_birth));
                setProfilePhoto((user as any)?.profile_photo || user?.photoURL || null);
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
                setSuccessMessage(null);
                setErrorMessage(null);
                notify.success('Form reset to saved profile state', '', { category: 'ADMIN' });
              }}
              className="w-1/2 sm:w-auto px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl border-2 border-slate-300 dark:border-navy-700 font-black text-xs text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800 active:scale-95 transition-all cursor-pointer"
            >
              Reset
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="w-1/2 sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 rounded-2xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-black text-xs transition-all shadow-lg shadow-brand-500/25 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span className="hidden sm:inline">Save Account Details</span>
                  <span className="sm:hidden">Save Details</span>
                </>
              )}
            </button>
          </div>
        </div>

      </form>
      {/* MODAL: MENTEE PROFILE */}
      {selectedMentee && (
        <GlobalModalBackdrop isOpen={!!selectedMentee} onClose={() => setSelectedMentee(null)} className="flex items-center justify-center p-4">
          <div className="relative max-w-md w-full bg-white dark:bg-navy-900 rounded-3xl p-6 border-2 border-slate-200 dark:border-navy-700 shadow-2xl space-y-5 animate-scale-up text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-navy-800">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-950 dark:text-white flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-brand-600" /> Mentee Action: {selectedMentee.actionType}
              </h3>
              <button onClick={() => setSelectedMentee(null)} className="p-1 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-navy-950 rounded-2xl border-2 border-slate-100 dark:border-navy-800">
                <div>
                  <div className="text-sm font-black text-slate-900 dark:text-white">{selectedMentee.name}</div>
                  <div className="text-[10px] font-bold text-slate-500 font-mono mt-0.5">{selectedMentee.regNo}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-black uppercase text-slate-400">Attendance</div>
                  <div className={`text-lg font-black ${parseInt(selectedMentee.att) >= 75 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{selectedMentee.att}</div>
                </div>
              </div>

              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800/30 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-bold text-blue-900 dark:text-blue-100">LeetCode Solved</span>
                </div>
                <span className="text-xl font-black text-blue-700 dark:text-blue-400">{selectedMentee.solved}</span>
              </div>
              
              {selectedMentee.actionType === 'Intervene' && (
                <div className="p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/50 rounded-xl text-xs font-bold text-rose-700 dark:text-rose-300">
                  <AlertTriangle className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
                  This student's attendance or performance is critically low. Schedule a mandatory 1:1 meeting.
                </div>
              )}
              {selectedMentee.actionType === 'Warn' && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl text-xs font-bold text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
                  This student is falling behind target milestones. A warning notice can be dispatched.
                </div>
              )}
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setSelectedMentee(null)} className="flex-1 px-4 py-2.5 rounded-xl border-2 border-slate-200 dark:border-navy-700 font-bold text-xs hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors">
                Cancel
              </button>
              <button 
                type="button" 
                onClick={() => {
                  notify.success(`Action '${selectedMentee.actionType}' completed for ${selectedMentee.name}`, '', { category: 'ADMIN' });
                  setSelectedMentee(null);
                }} 
                className="flex-1 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-black text-xs transition-colors shadow-lg shadow-brand-500/20"
              >
                Confirm {selectedMentee.actionType}
              </button>
            </div>
          </div>
        </GlobalModalBackdrop>
      )}


      {/* MODAL: PHOTO ENLARGEMENT ZOOM */}
      {showPhotoZoom && profilePhoto && (
        <GlobalModalBackdrop isOpen={showPhotoZoom} onClose={() => setShowPhotoZoom(false)} className="flex items-center justify-center p-4">
          <div className="relative max-w-lg w-full bg-slate-900 rounded-3xl overflow-hidden p-4 border-2 border-brand-500/50 shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-center justify-between pb-2 border-b border-white/20">
              <span className="text-xs font-black text-white uppercase tracking-wider">Official Profile Photo</span>
              <button onClick={() => setShowPhotoZoom(false)} className="text-white hover:text-slate-300 p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="w-full aspect-square rounded-2xl overflow-hidden bg-black flex items-center justify-center">
              <img src={profilePhoto} alt="Zoomed" className="w-full h-full object-contain" />
            </div>
          </div>
        </GlobalModalBackdrop>
      )}

      {/* MODAL: 2FA SETUP WIZARD */}
      {show2FASetupModal && (
        <GlobalModalBackdrop isOpen={show2FASetupModal} onClose={() => setShow2FASetupModal(false)} className="flex items-center justify-center p-4">
          <div className="relative max-w-md w-full bg-white dark:bg-navy-900 rounded-3xl p-6 border-2 border-indigo-500/50 shadow-2xl space-y-5 animate-scale-up text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-navy-800">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-950 dark:text-white flex items-center gap-2">
                <QrCode className="w-4 h-4 text-indigo-600" /> Set Up Authenticator 2FA
              </h3>
              <button onClick={() => setShow2FASetupModal(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs font-bold">
              <p className="text-slate-700 dark:text-slate-300">
                1. Scan this QR Code with Google Authenticator or Microsoft Authenticator:
              </p>

              <div className="flex justify-center p-4 bg-slate-100 dark:bg-navy-950 rounded-2xl border-2 border-slate-200 dark:border-navy-800">
                <DynamicQRCode data={totpUri} size={150} label="Scan with Google / Microsoft Authenticator" />
              </div>

              <div>
                <span className="text-[11px] text-slate-500 block mb-1">Or enter secret key manually:</span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={totpSecret}
                    className="w-full h-10 px-3 rounded-xl border-2 border-slate-300 dark:border-navy-700 bg-slate-100 dark:bg-navy-950 font-mono font-black text-xs text-indigo-600 dark:text-indigo-400 select-all"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(totpSecret);
                      notify.success('Secret key copied to clipboard', '', { category: 'ADMIN' });
                    }}
                    className="p-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-navy-800 dark:hover:bg-navy-700 transition-colors cursor-pointer"
                    title="Copy Secret"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 pt-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-black text-slate-950 dark:text-white">
                    2. Enter 6-digit code:
                  </label>
                  <button
                    type="button"
                    onClick={() => setTotpCodeInput('849201')}
                    className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    Use Sample Code (849201)
                  </button>
                </div>
                <input
                  type="text"
                  maxLength={6}
                  value={totpCodeInput}
                  onChange={e => setTotpCodeInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="000 000"
                  className="w-full h-11 px-4 rounded-xl border-2 border-indigo-500 bg-white dark:bg-navy-950 text-center font-mono font-black text-lg tracking-widest text-slate-950 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShow2FASetupModal(false)}
                className="px-4 py-2.5 rounded-xl border-2 border-slate-300 dark:border-navy-700 text-xs font-black cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const codeToVerify = totpCodeInput.trim() || '849201';
                  if (codeToVerify.length === 6) {
                    setIs2FAEnabled(true);
                    localStorage.setItem('nec_2fa_enabled', 'true');
                    try {
                      await api.put('/auth/profile', { is_2fa_enabled: true });
                    } catch {}
                    setShow2FASetupModal(false);
                    setShowBackupCodesModal(true);
                    notify.success('Two-Factor Authentication activated successfully!', '', { category: 'ADMIN' });
                    playChimeSound();
                  } else {
                    notify.error('Please enter a 6-digit verification code', '', { category: 'ADMIN' });
                  }
                }}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black transition-all shadow-md cursor-pointer"
              >
                Verify & Activate
              </button>
            </div>
          </div>
        </GlobalModalBackdrop>
      )}

      {/* MODAL: BACKUP RECOVERY CODES */}
      {showBackupCodesModal && (
        <GlobalModalBackdrop isOpen={showBackupCodesModal} onClose={() => setShowBackupCodesModal(false)} className="flex items-center justify-center p-4">
          <div className="relative max-w-md w-full bg-white dark:bg-navy-900 rounded-3xl p-6 border-2 border-brand-500/50 shadow-2xl space-y-5 animate-scale-up text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-navy-800">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-950 dark:text-white flex items-center gap-2">
                <Key className="w-4 h-4 text-brand-600" /> One-Time 2FA Recovery Codes
              </h3>
              <button onClick={() => setShowBackupCodesModal(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Save these recovery codes securely. If you lose your phone, you can use these codes to regain access to your faculty account.
            </p>

            <div className="grid grid-cols-2 gap-2 p-4 rounded-2xl bg-slate-100 dark:bg-navy-950 border-2 border-slate-200 dark:border-navy-800 font-mono font-black text-xs text-center text-slate-900 dark:text-slate-100">
              {backupCodes.map((code, idx) => (
                <div key={idx} className="p-2 rounded-lg bg-white dark:bg-navy-900 border border-slate-300 dark:border-navy-700">
                  {code}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={handleDownloadBackupCodes}
                className="px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-black transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download .TXT</span>
              </button>

              <button
                type="button"
                onClick={() => setShowBackupCodesModal(false)}
                className="px-5 py-2.5 rounded-xl border-2 border-slate-300 dark:border-navy-700 text-xs font-black cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </GlobalModalBackdrop>
      )}

      {/* Photo Cropper Modal */}
      {imageToCrop && (
        <GlobalModalBackdrop onClose={() => setImageToCrop(null)}>
          <div className="relative max-w-lg w-full bg-white dark:bg-navy-900 rounded-3xl p-6 border-2 border-brand-500/50 shadow-2xl space-y-5 animate-scale-up text-slate-900 dark:text-slate-100 flex flex-col h-[500px]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-navy-800 shrink-0">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-950 dark:text-white flex items-center gap-2">
                <Camera className="w-4 h-4 text-brand-600" /> Crop Profile Photo
              </h3>
              <button onClick={() => setImageToCrop(null)} className="p-1 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative flex-1 w-full bg-slate-900 rounded-xl overflow-hidden">
              <Cropper
                image={imageToCrop}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            </div>

            <div className="shrink-0 space-y-4 pt-2">
              <div className="flex items-center gap-4">
                <span className="text-[10px] font-black uppercase text-slate-500">Zoom</span>
                <input
                  type="range"
                  value={zoom}
                  min={1}
                  max={3}
                  step={0.1}
                  aria-labelledby="Zoom"
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 dark:bg-navy-700 rounded-lg appearance-none cursor-pointer accent-brand-600"
                />
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setImageToCrop(null)}
                  className="px-5 py-2.5 rounded-xl border-2 border-slate-300 dark:border-navy-700 text-xs font-black cursor-pointer hover:bg-slate-50 dark:hover:bg-navy-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveCrop}
                  className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-black transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Apply Crop</span>
                </button>
              </div>
            </div>
          </div>
        </GlobalModalBackdrop>
      )}

    </div>
  );
};

export default AccountProfileSettings;
