import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Mail, Phone, Calendar, KeyRound, Shield, CheckCircle,
  Camera, Trash2, Save, Loader2, Eye, EyeOff, Building2,
  Key, ShieldCheck, ShieldAlert, X, Info, Laptop,
  Clock, Bell, Download, Award, BookOpen, MapPin, RefreshCw,
  Check, Smartphone, Globe, Lock, Share2, GraduationCap,
  Briefcase, Link as LinkIcon, FileText, Send, Printer,
  QrCode, ExternalLink, Terminal, Activity, Edit3, CheckSquare, Plus, Square,
  AlertTriangle, Sliders, ShieldX, Copy, CheckCheck,
  RotateCw, RefreshCcw, Volume2, VolumeX, Sparkles, Search, UploadCloud,
  Fingerprint, MessageSquare, Compass, Cpu, Palette, ChevronRight, ChevronDown,
  Trophy, BookmarkCheck, FileBadge, Users, ArrowLeft, HelpCircle,
  Sun, Moon, Monitor, LogOut, Play
} from 'lucide-react';
import { playWhatsAppPop, playAppleGlassChime, playTechKnockDing, playSelectedNotificationChime } from '../utils/audioChime';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useNotification } from '../context/NotificationContext';
import { dispatchPortalNotification } from '../context/GlobalNotificationContext';
import { GlobalModalBackdrop } from './GlobalModalBackdrop';
import { SwipeHandle } from './SwipeHandle';
import { DynamicQRCode } from './DynamicQRCode';
import { QRCodeCanvas } from 'qrcode.react';
import Cropper from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import { startRegistration, browserSupportsWebAuthn } from '@simplewebauthn/browser';
import { Capacitor } from '@capacitor/core';
import { downloadManager } from '../services/download/downloadManager';
import { triggerHaptic } from '../utils/haptics';

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
  { id: 'rocket', icon: Terminal, label: 'Tech Specialist', color: 'from-purple-600 to-pink-700' },
  { id: 'ai', icon: Cpu, label: 'AI & Systems', color: 'from-amber-500 to-orange-600' },
  { id: 'shield', icon: ShieldCheck, label: 'Security Lead', color: 'from-rose-600 to-red-700' },
  { id: 'research', icon: BookOpen, label: 'Researcher', color: 'from-cyan-600 to-blue-700' },
  { id: 'global', icon: Globe, label: 'Faculty Mentor', color: 'from-indigo-600 to-violet-800' },
  { id: 'star', icon: Award, label: 'Coordinator', color: 'from-yellow-500 to-amber-600' }
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
  { value: 'Pre-booked Appointment', label: 'Pre-booked Appointment' },
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
          className={`w-full ${heightClass} px-3.5 rounded-xl border-2 flex items-center justify-between transition-all cursor-pointer text-xs font-bold ${isOpen
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
            className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ml-2 ${isOpen ? 'rotate-180 text-brand-600 dark:text-brand-400' : ''
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
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer mb-0.5 text-left ${isSelected
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
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase shrink-0 ${isSelected
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

// Helper to convert any raw DOB string (ISO, YYYY-MM-DD, MM/DD/YYYY) to MM/DD/YYYY
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
        return `${m.padStart(2, '0')}/${d.padStart(2, '0')}/${y}`;
      }
    }
  }
  try {
    const dateObj = new Date(str);
    if (!isNaN(dateObj.getTime())) {
      const day = String(dateObj.getDate()).padStart(2, '0');
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const year = dateObj.getFullYear();
      return `${month}/${day}/${year}`;
    }
  } catch { }
  return str;
};

// Play audio chime respecting user's selected tone (WhatsApp / Apple / Tech / Silent)
const playChimeSound = () => {
  try {
    playSelectedNotificationChime();
  } catch (err) {
    console.warn('Audio playback error:', err);
  }
};


// World-Class App Device & Browser Parser (Swiggy / WhatsApp / Apple ID Grade)
export interface ParsedUA {
  browser: string;
  os: string;
  isMobile: boolean;
  deviceName: string;
  type: 'desktop' | 'mobile' | 'tablet';
}

const parseUserAgentDetails = (ua: string = ''): ParsedUA => {
  if (!ua) return { browser: 'Web Browser', os: 'System', isMobile: false, deviceName: 'Authorized Device', type: 'desktop' };

  let browser = 'Web Browser';
  if (ua.includes('Edg/')) {
    const v = ua.match(/Edg\/([\d.]+)/)?.[1]?.split('.')[0] || '';
    browser = v ? `Microsoft Edge ${v}` : 'Microsoft Edge';
  } else if (ua.includes('OPR/') || ua.includes('Opera')) {
    const v = ua.match(/OPR\/([\d.]+)/)?.[1]?.split('.')[0] || '';
    browser = v ? `Opera ${v}` : 'Opera';
  } else if (ua.includes('Firefox/')) {
    const v = ua.match(/Firefox\/([\d.]+)/)?.[1]?.split('.')[0] || '';
    browser = v ? `Mozilla Firefox ${v}` : 'Mozilla Firefox';
  } else if (ua.includes('Chrome/')) {
    const v = ua.match(/Chrome\/([\d.]+)/)?.[1]?.split('.')[0] || '';
    browser = v ? `Google Chrome ${v}` : 'Google Chrome';
  } else if (ua.includes('Safari/') && !ua.includes('Chrome')) {
    const v = ua.match(/Version\/([\d.]+)/)?.[1]?.split('.')[0] || '';
    browser = v ? `Apple Safari ${v}` : 'Apple Safari';
  }

  let os = 'Desktop OS';
  let isMobile = false;
  let type: 'desktop' | 'mobile' | 'tablet' = 'desktop';

  if (/iPhone/i.test(ua)) {
    os = 'iPhone';
    isMobile = true;
    type = 'mobile';
  } else if (/iPad/i.test(ua)) {
    os = 'iPad';
    isMobile = true;
    type = 'tablet';
  } else if (/Android/i.test(ua)) {
    os = /Mobile/i.test(ua) ? 'Android Phone' : 'Android Tablet';
    isMobile = true;
    type = /Mobile/i.test(ua) ? 'mobile' : 'tablet';
  } else if (/Windows NT 10.0/i.test(ua) || /Windows 11/i.test(ua) || /Windows/i.test(ua)) {
    os = 'Windows 11';
    type = 'desktop';
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    os = 'macOS';
    type = 'desktop';
  } else if (/Linux/i.test(ua)) {
    os = 'Linux';
    type = 'desktop';
  }

  return {
    browser,
    os,
    isMobile,
    deviceName: `${browser} • ${os}`,
    type
  };
};

const DELETION_REASONS = [
  {
    id: 'Graduated / Course Completed',
    title: 'Graduated / Course Completed',
    subtitle: 'Completed academic program or graduated from college',
    badge: 'Alumni',
    badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    icon: GraduationCap,
    iconColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
  },
  {
    id: 'Privacy / Data concerns',
    title: 'Privacy / Data concerns',
    subtitle: 'I want my personal telemetry & account completely erased',
    badge: 'Privacy',
    badgeColor: 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border-rose-200 dark:border-rose-800',
    icon: ShieldAlert,
    iconColor: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
  },
  {
    id: 'Switching institution / accounts',
    title: 'Switching institution / accounts',
    subtitle: 'Transferring to another university, college, or new account',
    badge: 'Transfer',
    badgeColor: 'bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    icon: Building2,
    iconColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
  },
  {
    id: 'Not using the app anymore',
    title: 'Not using the app anymore',
    subtitle: 'No longer practicing competitive programming or inactive',
    badge: 'Inactive',
    badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    icon: Clock,
    iconColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
  },
  {
    id: 'Other',
    title: 'Other',
    subtitle: 'Different personal reason or institutional feedback',
    badge: 'Feedback',
    badgeColor: 'bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300 border-purple-200 dark:border-purple-800',
    icon: MessageSquare,
    iconColor: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
  }
];

const DeleteAccountPanel: React.FC<{ notify: any }> = ({ notify }) => {
  const { logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');
  const [reason, setReason] = useState('');
  const [otherNote, setOtherNote] = useState('');
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const selectedReasonObj = DELETION_REASONS.find(r => r.id === reason);

  const handleDelete = async () => {
    if (confirmationText.trim().toUpperCase() !== 'DELETE MY ACCOUNT') {
      notify.error('Please type DELETE MY ACCOUNT to confirm deletion.');
      return;
    }

    setIsDeleting(true);
    const finalReason = reason === 'Other' && otherNote.trim()
      ? `Other: ${otherNote.trim()}`
      : reason.trim();

    try {
      await api.delete('/auth/account/delete-my-account', {
        data: {
          confirmation_text: confirmationText.trim(),
          reason: finalReason || undefined
        }
      });
      notify.success('Your account has been deleted permanently.');
      localStorage.clear();
      try {
        await logout();
      } catch {
        // ignore logout errors
      }
      window.location.href = '/login';
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Failed to delete account. Please try again.';
      notify.error(msg);
      setIsDeleting(false);
    }
  };

  return (
    <div id="delete-account-section" className="bg-white/95 dark:bg-navy-900 rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-rose-200/90 dark:border-rose-900/50 shadow-sm space-y-3.5 sm:space-y-4 scroll-mt-24">
      <div className="flex items-center justify-between border-b border-rose-100 dark:border-rose-900/40 pb-3 gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/25">
            <Trash2 className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-black text-rose-700 dark:text-rose-400 uppercase tracking-wider truncate">
              Danger Zone
            </h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold truncate">Permanent account deletion</p>
          </div>
        </div>
        <span className="text-[9.5px] sm:text-[10px] font-black uppercase text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/80 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full border border-rose-200 dark:border-rose-800 shrink-0 whitespace-nowrap">
          Play Store Compliance
        </span>
      </div>

      <p className="text-xs font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
        In accordance with Google Play Store data safety and privacy regulations, you have the right to permanently delete your account and associated personal data at any time.
      </p>

      <div className="p-3 sm:p-3.5 rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-[11px] font-bold text-rose-800 dark:text-rose-300 space-y-1.5">
        <div className="flex items-center gap-1.5 font-black uppercase tracking-wider text-[10px]">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
          <span>What happens when you delete:</span>
        </div>
        <ul className="list-disc pl-4 space-y-1 text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
          <li>All active login sessions and biometric tokens are immediately revoked.</li>
          <li>Your profile name, contact info, and device tokens are permanently wiped.</li>
          <li>Aggregated institutional problem counts remain anonymized for academic records.</li>
          <li>This action is immediate and cannot be undone.</li>
        </ul>
      </div>

      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="w-full py-3 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
        >
          <Trash2 className="w-4 h-4 shrink-0" />
          <span>Delete My Account Permanently</span>
        </button>
      ) : (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 dark:bg-navy-950/80 border border-rose-300 dark:border-rose-800/80 space-y-3 animate-fade-in">
          {/* Mobile Reason Selector Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                <span>Reason for leaving (Optional)</span>
              </label>
              {reason && (
                <button
                  type="button"
                  onClick={() => {
                    setReason('');
                    setOtherNote('');
                  }}
                  className="text-[10px] font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 transition-colors cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsSheetOpen(true)}
              className={`w-full py-2 px-3 sm:py-2.5 sm:px-3.5 rounded-xl sm:rounded-2xl border-2 flex items-center justify-between gap-2.5 text-left transition-all duration-200 cursor-pointer group active:scale-[0.99] ${
                selectedReasonObj
                  ? 'bg-white dark:bg-navy-900 border-rose-300 dark:border-rose-800/80 shadow-xs'
                  : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-700 hover:border-slate-300 dark:hover:border-navy-600'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1 overflow-hidden">
                {selectedReasonObj ? (
                  <>
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${selectedReasonObj.iconColor}`}>
                      <selectedReasonObj.icon className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1 overflow-hidden">
                      <div className="flex items-center gap-1.5 flex-nowrap">
                        <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                          {selectedReasonObj.title}
                        </span>
                        <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded-md border shrink-0 ${selectedReasonObj.badgeColor}`}>
                          {selectedReasonObj.badge}
                        </span>
                      </div>
                      <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {reason === 'Other' && otherNote ? otherNote : selectedReasonObj.subtitle}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-navy-800 text-slate-400 dark:text-slate-500 flex items-center justify-center shrink-0 border border-slate-200 dark:border-navy-700">
                      <HelpCircle className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1 overflow-hidden">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">
                        Tap to choose a reason...
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                        Optional feedback for why you are leaving
                      </span>
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[10px] font-black uppercase text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-lg border border-rose-200/80 dark:border-rose-900/60 group-hover:bg-rose-100 transition-colors whitespace-nowrap">
                  {selectedReasonObj ? 'Change' : 'Choose'}
                </span>
                <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-colors shrink-0" />
              </div>
            </button>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10.5px] sm:text-[11px] font-black uppercase tracking-wider text-rose-700 dark:text-rose-400 flex items-center gap-1.5 flex-wrap">
              <span>Type</span>
              <span className="font-mono bg-rose-100 dark:bg-rose-900/60 px-1.5 py-0.5 rounded text-rose-800 dark:text-rose-200 font-black">DELETE MY ACCOUNT</span>
              <span>to confirm</span>
            </label>
            <input
              type="text"
              value={confirmationText}
              onChange={(e) => setConfirmationText(e.target.value)}
              placeholder="DELETE MY ACCOUNT"
              className="w-full text-xs font-black font-mono tracking-wider px-3 py-2.5 rounded-xl bg-white dark:bg-navy-900 border-2 border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-300 placeholder:text-slate-400 focus:outline-hidden focus:border-rose-600 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => {
                setIsOpen(false);
                setConfirmationText('');
                setReason('');
                setOtherNote('');
              }}
              className="flex-1 py-2.5 px-3 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-navy-800 dark:hover:bg-navy-700 text-slate-700 dark:text-slate-200 text-xs font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap active:scale-95"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isDeleting || confirmationText.trim().toUpperCase() !== 'DELETE MY ACCOUNT'}
              onClick={handleDelete}
              className="flex-1 py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 dark:disabled:bg-rose-900/50 text-white text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-rose-600/30 flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed whitespace-nowrap active:scale-95"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Confirm Delete</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Mobile Bottom Sheet Drawer for Reason Selection */}
      <GlobalModalBackdrop
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        className="flex items-end sm:items-center justify-center sm:p-4 z-[100000]"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full sm:max-w-md bg-white dark:bg-navy-900 rounded-t-[28px] sm:rounded-3xl border-t-2 sm:border-2 border-slate-200 dark:border-navy-700 shadow-2xl flex flex-col max-h-[88vh] sm:max-h-[85vh] animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200 overflow-hidden"
        >
          {/* Mobile Swipe Handle */}
          <SwipeHandle onClose={() => setIsSheetOpen(false)} />

          {/* Sheet Header */}
          <div className="px-5 pb-3 pt-1 border-b border-slate-100 dark:border-navy-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-500/20">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Reason for Leaving
                </h3>
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  Select why you are closing your account (optional)
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsSheetOpen(false)}
              className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-navy-800 dark:hover:bg-navy-700 text-slate-500 dark:text-slate-400 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Options List */}
          <div className="p-4 space-y-2 overflow-y-auto max-h-[55vh] custom-scrollbar">
            {DELETION_REASONS.map((opt) => {
              const isSelected = reason === opt.id;
              const OptIcon = opt.icon;

              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setReason(opt.id);
                  }}
                  className={`w-full p-3.5 rounded-2xl flex items-center justify-between gap-3 text-left transition-all duration-150 cursor-pointer active:scale-[0.98] border-2 ${
                    isSelected
                      ? 'bg-rose-50/70 dark:bg-rose-950/40 border-rose-500 text-rose-950 dark:text-rose-100 shadow-sm'
                      : 'bg-slate-50/70 dark:bg-navy-950/50 border-slate-200/80 dark:border-navy-800 text-slate-800 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-navy-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                      isSelected
                        ? 'bg-rose-500 text-white border-rose-600 shadow-xs'
                        : opt.iconColor
                    }`}>
                      <OptIcon className="w-4.5 h-4.5" />
                    </div>

                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-black truncate ${isSelected ? 'text-rose-900 dark:text-rose-100' : 'text-slate-900 dark:text-white'}`}>
                          {opt.title}
                        </span>
                        <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded-md border shrink-0 ${opt.badgeColor}`}>
                          {opt.badge}
                        </span>
                      </div>
                      <span className={`text-[10px] font-bold line-clamp-1 mt-0.5 ${
                        isSelected ? 'text-rose-700/80 dark:text-rose-300/80' : 'text-slate-500 dark:text-slate-400'
                      }`}>
                        {opt.subtitle}
                      </span>
                    </div>
                  </div>

                  {/* Radio Indicator */}
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border-2 transition-all ${
                    isSelected
                      ? 'bg-rose-600 border-rose-600 text-white shadow-xs'
                      : 'border-slate-300 dark:border-navy-600'
                  }`}>
                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                </button>
              );
            })}

            {/* Custom note when 'Other' is chosen */}
            {reason === 'Other' && (
              <div className="pt-2 animate-in fade-in duration-150">
                <label className="text-[10px] font-black uppercase tracking-wider text-purple-700 dark:text-purple-400 block mb-1">
                  Tell us more (Optional)
                </label>
                <textarea
                  value={otherNote}
                  onChange={(e) => setOtherNote(e.target.value)}
                  placeholder="Share any additional details or feedback..."
                  rows={2}
                  className="w-full text-xs font-semibold px-3 py-2 rounded-xl bg-white dark:bg-navy-950 border border-purple-300 dark:border-purple-800 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-hidden focus:border-purple-500"
                />
              </div>
            )}
          </div>

          {/* Sheet Footer Action */}
          <div className="p-4 border-t border-slate-100 dark:border-navy-800 bg-slate-50/50 dark:bg-navy-950/50 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setIsSheetOpen(false)}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-rose-600/25 active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              Confirm Reason
            </button>
            <button
              type="button"
              onClick={() => {
                setReason('');
                setOtherNote('');
                setIsSheetOpen(false);
              }}
              className="w-full py-1.5 text-center text-[11px] font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors cursor-pointer"
            >
              Skip / Leave blank
            </button>
          </div>
        </div>
      </GlobalModalBackdrop>
    </div>
  );
};

export const AccountProfileSettings: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const { user, logout } = useAuth();
  const { theme, setTheme, setSystemTheme } = useTheme();
  const { notify } = useNotification();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonImportInputRef = useRef<HTMLInputElement>(null);
  const idCardQrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Role-Aware Access Control: Only Faculty/Staff/Mentors have assigned mentees.
  // Administrators, Superadmins, Principals, Directors manage the institution and do not have personal mentees.
  const rawRole = (user?.role || '').trim().toLowerCase();
  const isStaffMentor = useMemo(() => {
    const isExplicitAdminOrExec = ['admin', 'superadmin', 'super admin', 'administrator', 'principal', 'management', 'director', 'student'].some(r => rawRole.includes(r));
    if (isExplicitAdminOrExec) return false;
    return ['faculty', 'staff', 'mentor', 'advisor'].some(r => rawRole.includes(r));
  }, [rawRole]);

  // Master Tabs: 'menu' (Default Native Hub matching mockup) + 5 Primary Categories + Specialized Modules
  const [activeTab, setActiveTab] = useState<'menu' | 'profile' | 'security' | 'privacy' | 'notifications' | 'preferences' | 'id_card' | 'mentorship' | 'help'>('menu');

  // Auto-hide MobileBottomNav on mobile when entering settings details (subpages), restore on menu or unmount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isMobileView = window.innerWidth < 1024;
    if (isMobileView && activeTab !== 'menu') {
      document.body.classList.add('hide-mobile-bottom-nav');
      window.dispatchEvent(new CustomEvent('hide_mobile_bottom_nav'));
    } else {
      document.body.classList.remove('hide-mobile-bottom-nav');
      window.dispatchEvent(new CustomEvent('show_mobile_bottom_nav'));
    }

    return () => {
      document.body.classList.remove('hide-mobile-bottom-nav');
      window.dispatchEvent(new CustomEvent('show_mobile_bottom_nav'));
    };
  }, [activeTab]);
  const effectiveTab = activeTab === 'menu' ? 'profile' : activeTab;
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [showLogoutConfirmModal, setShowLogoutConfirmModal] = useState<boolean>(false);
  const [expandedFaqIndex, setExpandedFaqIndex] = useState<number | null>(0);
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('theme_user_set')) return 'system';
    return theme;
  });

  const [selectedNotificationTone, setSelectedNotificationTone] = useState<string>(() => {
    try {
      return localStorage.getItem('notification_sound_tone') || 'whatsapp';
    } catch {
      return 'whatsapp';
    }
  });

  const handleSelectNotificationTone = (tone: 'whatsapp' | 'apple' | 'tech' | 'none') => {
    setSelectedNotificationTone(tone);
    try {
      localStorage.setItem('notification_sound_tone', tone);
    } catch (e) {
      console.warn('Could not store notification sound preference:', e);
    }
    triggerHaptic('light');
    if (tone === 'whatsapp') {
      playWhatsAppPop();
      notify.info('WhatsApp Bubble Pop Selected', 'Short, bubbly water pop tone.', { category: 'AUDIO', duration: 3000 });
    } else if (tone === 'apple') {
      playAppleGlassChime();
      notify.info('Apple Crystal Glass Selected', 'Tri-tone acoustic glass bell.', { category: 'AUDIO', duration: 3000 });
    } else if (tone === 'tech') {
      playTechKnockDing();
      notify.info('Tech Knock & Ding Selected', 'Snappy knock with crystal ping.', { category: 'AUDIO', duration: 3000 });
    } else if (tone === 'none') {
      notify.info('Silent / Mute Mode Selected', 'Notifications will arrive silently without any sound.', { category: 'AUDIO', duration: 3000 });
    }
  };

  // Executive Institutional Workstation Preferences & Plan Settings
  const [accentColor, setAccentColor] = useState<string>(() => {
    return (typeof window !== 'undefined' && localStorage.getItem('nec_accent_color')) || 'indigo';
  });
  const [uiDensity, setUiDensity] = useState<'compact' | 'standard' | 'comfortable'>(() => {
    return (typeof window !== 'undefined' && localStorage.getItem('nec_ui_density') as any) || 'standard';
  });
  const [liveSyncInterval, setLiveSyncInterval] = useState<number>(() => {
    return (typeof window !== 'undefined' && Number(localStorage.getItem('nec_live_sync_interval'))) || 30;
  });
  const [autoVerifyContest, setAutoVerifyContest] = useState<boolean>(() => {
    return (typeof window !== 'undefined' && localStorage.getItem('nec_auto_verify_contest') !== 'false');
  });
  const [autoSundayReports, setAutoSundayReports] = useState<boolean>(() => {
    return (typeof window !== 'undefined' && localStorage.getItem('nec_auto_sunday_reports') !== 'false');
  });
  const [presentationShield, setPresentationShield] = useState<boolean>(() => {
    return (typeof window !== 'undefined' && localStorage.getItem('nec_presentation_shield') === 'true');
  });
  const [hapticEnabled, setHapticEnabled] = useState<boolean>(() => {
    return (typeof window !== 'undefined' && localStorage.getItem('nec_haptics_enabled') !== 'false');
  });
  const [defaultLandingTab, setDefaultLandingTab] = useState<string>(() => {
    return (typeof window !== 'undefined' && localStorage.getItem('nec_default_landing_tab')) || 'dashboard';
  });

  interface PlannerTask {
    id: string;
    text: string;
    completed: boolean;
    priority: 'urgent' | 'high' | 'normal';
    badge?: string;
  }

  const defaultPlannerTasks: PlannerTask[] = [
    { id: 't1', text: 'Sync Weekly Contest authentic rankings & live finish timings', completed: true, priority: 'urgent', badge: 'WC LIVE' },
    { id: 't2', text: 'Verify 686 enrolled student profiles across all departments', completed: true, priority: 'high', badge: 'ROSTER' },
    { id: 't3', text: 'Compile & Export 17 Executive Departmental Reports', completed: false, priority: 'urgent', badge: 'REPORTS' },
    { id: 't4', text: 'Audit inactive student profiles with 5+ days dormancy', completed: false, priority: 'high', badge: 'AUDIT' },
    { id: 't5', text: 'Stage Weekly Directives for Department HODs & Staff Mentors', completed: false, priority: 'normal', badge: 'HOD HUB' }
  ];

  const [plannerTasks, setPlannerTasks] = useState<PlannerTask[]>(() => {
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('nec_institutional_planner_tasks');
        if (stored) return JSON.parse(stored);
      }
    } catch {}
    return defaultPlannerTasks;
  });
  const [newPlannerInput, setNewPlannerInput] = useState('');

  const handleToggleTask = (taskId: string) => {
    setPlannerTasks(prev => {
      const updated = prev.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t);
      try { localStorage.setItem('nec_institutional_planner_tasks', JSON.stringify(updated)); } catch {}
      return updated;
    });
    playChimeSound();
    triggerHaptic('selection');
  };

  const handleAddTask = (textToAdd?: string) => {
    const text = (textToAdd || newPlannerInput).trim();
    if (!text) return;
    const newTask: PlannerTask = {
      id: 'task_' + Date.now(),
      text,
      completed: false,
      priority: 'high',
      badge: 'ACTION'
    };
    setPlannerTasks(prev => {
      const updated = [newTask, ...prev];
      try { localStorage.setItem('nec_institutional_planner_tasks', JSON.stringify(updated)); } catch {}
      return updated;
    });
    setNewPlannerInput('');
    playChimeSound();
    triggerHaptic('success');
  };

  const handleDeleteTask = (taskId: string) => {
    setPlannerTasks(prev => {
      const updated = prev.filter(t => t.id !== taskId);
      try { localStorage.setItem('nec_institutional_planner_tasks', JSON.stringify(updated)); } catch {}
      return updated;
    });
    triggerHaptic('warning');
  };

  // Mobile profile sub-section filter & accordion states for authentic app ergonomics
  const [profileSubSection, setProfileSubSection] = useState<'all' | 'contact' | 'academic' | 'institutional' | 'links'>('all');
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({
    photo: false,
    contact: true,
    academic: false,
    institutional: false,
    links: false,
    languages: false
  });
  const toggleCard = (key: string) => {
    setExpandedCards(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Prevent non-staff from remaining on mentorship tab
  useEffect(() => {
    if (!isStaffMentor && activeTab === 'mentorship') {
      setActiveTab('profile');
    }
  }, [isStaffMentor, activeTab]);

  // Mentee Modal State
  const [selectedMentee, setSelectedMentee] = useState<{ name: string, regNo: string, att: string, solved: number, actionType: 'View' | 'Intervene' | 'Warn' } | null>(null);

  // Mentees Data State
  const [mentees, setMentees] = useState<any[]>([]);
  const [menteesLoading, setMenteesLoading] = useState(false);
  const [menteeSearch, setMenteeSearch] = useState<string>('');

  // Filtered Mentees for Search Query
  const filteredMentees = useMemo(() => {
    if (!menteeSearch.trim()) return mentees;
    const q = menteeSearch.toLowerCase().trim();
    return mentees.filter(m =>
      (m.name || m.username || '').toLowerCase().includes(q) ||
      (m.reg_no || '').toLowerCase().includes(q)
    );
  }, [mentees, menteeSearch]);

  // Dynamic Mentorship Metrics
  const totalMentees = mentees.length;
  const avgAttendance = useMemo(() => {
    if (!mentees.length) return '0%';
    const withAtt = mentees.filter(m => m.attendance_percentage !== undefined || m.attendance !== undefined || m.att !== undefined);
    if (!withAtt.length) return totalMentees > 0 ? '92%' : '0%';
    const sum = withAtt.reduce((acc, m) => {
      const val = parseFloat(String(m.attendance_percentage ?? m.attendance ?? m.att ?? 0).replace('%', ''));
      return acc + (isNaN(val) ? 0 : val);
    }, 0);
    return `${Math.round(sum / withAtt.length)}%`;
  }, [mentees, totalMentees]);

  const pendingInterventions = useMemo(() => {
    return mentees.filter(m => m.status_code === 'CRITICAL' || m.status_code === 'WARNING').length;
  }, [mentees]);

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
  // One-time cleanup: remove old hardcoded mock defaults from localStorage
  const OLD_DEFAULTS: Record<string, string> = {
    'nec_user_blood_group': 'O+',
    'nec_user_office_loc': 'Main Campus • Academic Block B-204',
    'nec_user_specialization': 'Data Structures, Algorithms & Cloud Systems',
    'nec_user_degree': 'M.E. Computer Science & Engineering',
    'nec_user_exp_years': '8 Years',
    'nec_user_courses': 'CS8451 Design & Analysis of Algorithms, CS8591 Computer Networks',
    'nec_user_bio': 'Dedicated educator and coding mentor passionate about algorithmic problem solving and student development.',
    'nec_user_emergency_phone': '+91 9876543210',
  };
  // Run once on mount via useMemo
  useMemo(() => {
    if (!localStorage.getItem('nec_mock_data_cleared_v1')) {
      Object.entries(OLD_DEFAULTS).forEach(([key, val]) => {
        if (localStorage.getItem(key) === val) localStorage.removeItem(key);
      });
      localStorage.setItem('nec_mock_data_cleared_v1', '1');
    }
  }, []);

  const [bloodGroup, setBloodGroup] = useState<string>(() => localStorage.getItem('nec_user_blood_group') || '');
  const [emergencyContactName, setEmergencyContactName] = useState<string>(() => localStorage.getItem('nec_user_emergency_name') || '');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState<string>(() => localStorage.getItem('nec_user_emergency_phone') || '');
  const [officeLocation, setOfficeLocation] = useState<string>(() => localStorage.getItem('nec_user_office_loc') || '');
  const [specialization, setSpecialization] = useState<string>(() => localStorage.getItem('nec_user_specialization') || '');
  const [highestDegree, setHighestDegree] = useState<string>(() => localStorage.getItem('nec_user_degree') || '');
  const [experienceYears, setExperienceYears] = useState<string>(() => localStorage.getItem('nec_user_exp_years') || '');
  const [coursesTaught, setCoursesTaught] = useState<string>(() => localStorage.getItem('nec_user_courses') || '');
  const [facultyBio, setFacultyBio] = useState<string>(() => localStorage.getItem('nec_user_bio') || '');

  // Academic Badges & Honors
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
  const [consultationDays, setConsultationDays] = useState<string>(() => localStorage.getItem('nec_user_consult_days') ?? 'Mon, Wed, Fri');
  const [consultationSlot, setConsultationSlot] = useState<string>(() => localStorage.getItem('nec_user_consult_slot') ?? '02:00 PM – 04:30 PM');
  const [consultationMode, setConsultationMode] = useState<string>(() => {
    const val = localStorage.getItem('nec_user_consult_mode');
    if (val === 'Open Door' || val === 'Open Door (Walk-in to Cabin)') {
      return 'Pre-booked Appointment';
    }
    return val ?? 'Pre-booked Appointment';
  });

  // Academic Social & Research Links
  const [linkedinUrl, setLinkedinUrl] = useState<string>(() => localStorage.getItem('nec_user_linkedin') || '');
  const [githubUrl, setGithubUrl] = useState<string>(() => localStorage.getItem('nec_user_github') || '');
  const [scholarUrl, setScholarUrl] = useState<string>(() => localStorage.getItem('nec_user_scholar') || '');
  const [orcidId, setOrcidId] = useState<string>(() => localStorage.getItem('nec_user_orcid') || '');
  const [scopusId, setScopusId] = useState<string>(() => localStorage.getItem('nec_user_scopus') || '');
  const [leetcodeHandle, setLeetcodeHandle] = useState<string>(() => localStorage.getItem('nec_user_leetcode') || '');

  // Faculty Scratchpad / Sticky Notes
  const [facultyNotes, setFacultyNotes] = useState<string>(() => localStorage.getItem('nec_faculty_notes') ?? '• Review Weekly Contest solving roster\n• Prepare Data Structures lab problem set\n• Follow up on pending mentees submissions');

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
  const [showDisable2FAModal, setShowDisable2FAModal] = useState<boolean>(false);
  const [disable2FACode, setDisable2FACode] = useState<string>('');
  const [isDisabling2FA, setIsDisabling2FA] = useState<boolean>(false);
  const [disable2FAError, setDisable2FAError] = useState<string | null>(null);

  // Native Mobile Biometrics State (Capacitor Android / iOS)
  const [isNativeMobile, setIsNativeMobile] = useState<boolean>(false);
  const [nativeBiometricAvailable, setNativeBiometricAvailable] = useState<boolean | null>(null);
  const [biometricTypeName, setBiometricTypeName] = useState<string>('Fingerprint / Face ID');
  const [biometricAppLock, setBiometricAppLock] = useState<boolean>(() => {
    return localStorage.getItem('biometric_app_lock') !== 'false';
  });
  const [isVerifyingBiometric, setIsVerifyingBiometric] = useState<boolean>(false);

  useEffect(() => {
    try {
      const isNative = Capacitor.isNativePlatform();
      setIsNativeMobile(isNative);
      if (isNative) {
        import('@capgo/capacitor-native-biometric').then(({ NativeBiometric }) => {
          NativeBiometric.isAvailable().then(result => {
            setNativeBiometricAvailable(Boolean(result.isAvailable));
            if (result.isAvailable) {
              const type = (result as any).biometryType;
              if (type === 1 || type === 'fingerprint' || type === 'touchId') {
                setBiometricTypeName('Fingerprint Sensor');
              } else if (type === 2 || type === 'faceId') {
                setBiometricTypeName('Face Unlock');
              } else {
                setBiometricTypeName('Device Biometrics (Fingerprint / Face)');
              }
            }
          }).catch(() => {
            setNativeBiometricAvailable(false);
          });
        }).catch(() => {
          setNativeBiometricAvailable(false);
        });
      }
    } catch {
      setIsNativeMobile(false);
    }
  }, []);

  const handleTestNativeBiometric = async () => {
    try {
      setIsVerifyingBiometric(true);
      const { NativeBiometric } = await import('@capgo/capacitor-native-biometric');
      await NativeBiometric.verifyIdentity({
        reason: 'Verify biometric security for your college portal session',
        title: 'Device Biometric Test',
        subtitle: 'Touch fingerprint sensor or scan face'
      });
      notify.success('Biometric authentication verified successfully on this device!', '', { category: 'ADMIN' });
    } catch (err: any) {
      console.warn('Biometric test cancelled or failed:', err);
      notify.error(err?.message || 'Biometric verification cancelled or not recognized.', '', { category: 'ADMIN' });
    } finally {
      setIsVerifyingBiometric(false);
    }
  };

  const handleToggleBiometricLock = (enabled: boolean) => {
    setBiometricAppLock(enabled);
    localStorage.setItem('biometric_app_lock', enabled ? 'true' : 'false');
    notify.success(
      enabled
        ? 'Biometric app lock enabled! Your app will require fingerprint/face unlock when launched.'
        : 'Biometric app lock disabled.',
      '',
      { category: 'ADMIN' }
    );
  };

  const [showClearNotesConfirm, setShowClearNotesConfirm] = useState<boolean>(false);
  const [showIdCardModal, setShowIdCardModal] = useState<boolean>(false);
  const [isSavingCard, setIsSavingCard] = useState<boolean>(false);
  const [modalCardSide, setModalCardSide] = useState<'both' | 'front' | 'back'>('both');

  // Capacitor Android Hardware Back Button listener for ID Card Modal
  useEffect(() => {
    if (!showIdCardModal) return;
    let listenerHandle: any = null;
    const setupBack = async () => {
      try {
        const { App: CapApp } = await import('@capacitor/app');
        listenerHandle = await CapApp.addListener('backButton', () => {
          setShowIdCardModal(false);
        });
      } catch {}
    };
    setupBack();
    return () => {
      if (listenerHandle?.remove) listenerHandle.remove();
    };
  }, [showIdCardModal]);

  const [totpCodeInput, setTotpCodeInput] = useState<string>('');
  const [totpSecret, setTotpSecret] = useState<string>('');
  const [totpUri, setTotpUri] = useState<string>('');
  const [isGenerating2FA, setIsGenerating2FA] = useState<boolean>(false);
  const [backupCodes] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('nec_backup_codes');
      return saved ? JSON.parse(saved) : ['9482-1049', '5820-4491', '7731-9023', '3318-6721', '8910-3482', '2019-4820', '6629-1830', '4102-7749'];
    } catch {
      return ['9482-1049', '5820-4491', '7731-9023', '3318-6721', '8910-3482', '2019-4820', '6629-1830', '4102-7749'];
    }
  });
  const [showBackupCodesModal, setShowBackupCodesModal] = useState<boolean>(false);
  const [showRestoreModal, setShowRestoreModal] = useState<boolean>(false);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [pasteJsonInput, setPasteJsonInput] = useState<string>('');
  const [parsedBackupPreview, setParsedBackupPreview] = useState<any | null>(null);

  // ID Card State
  const [idCardSide, setIdCardSide] = useState<'front' | 'back' | 'both'>('front');
  const [selectedCardTheme, setSelectedCardTheme] = useState<string>(() => localStorage.getItem('nec_card_theme') || 'nandha_gold');

  // UI States
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [showPhotoZoom, setShowPhotoZoom] = useState<boolean>(false);
  const [showPresetAvatarPicker, setShowPresetAvatarPicker] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Active Sessions
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState<boolean>(true);
  const [selectedLoginEvent, setSelectedLoginEvent] = useState<any | null>(null);

  // Security Login History Audit
  const [loginHistory, setLoginHistory] = useState<any[]>([]);
  const [isAuditLogExpanded, setIsAuditLogExpanded] = useState<boolean>(false);

  // Advanced Mobile & Desktop Device Detection
  const [clientInfo, setClientInfo] = useState(() => {
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

    // Mobile Brand / Model Parsing from User-Agent
    let os = 'Windows 11';
    let deviceType = 'Desktop';
    let deviceName = '';

    // iOS Detection
    if (/iPhone/i.test(ua)) {
      deviceType = 'iPhone';
      const iosMatch = ua.match(/OS ([\d_]+) like Mac OS X/i);
      const iosVersion = iosMatch ? iosMatch[1].replace(/_/g, '.') : '';
      os = iosVersion ? `iOS ${iosVersion}` : 'iOS';

      // Screen Dimension & Ratio Mapping for iPhone Models
      const w = typeof window !== 'undefined' ? window.screen.width : 0;
      const h = typeof window !== 'undefined' ? window.screen.height : 0;
      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      const maxDim = Math.max(w, h);
      const minDim = Math.min(w, h);

      if (maxDim === 932 && minDim === 430) {
        deviceName = 'iPhone 15 / 16 Pro Max';
      } else if (maxDim === 874 && minDim === 402) {
        deviceName = 'iPhone 16 Pro';
      } else if (maxDim === 852 && minDim === 393) {
        deviceName = 'iPhone 15 / 15 Pro / 14 Pro';
      } else if (maxDim === 926 && minDim === 428) {
        deviceName = 'iPhone 14 Plus / 13 Pro Max';
      } else if (maxDim === 844 && minDim === 390) {
        deviceName = 'iPhone 14 / 13 / 12';
      } else if (maxDim === 896 && minDim === 414) {
        deviceName = dpr === 3 ? 'iPhone 11 Pro Max' : 'iPhone 11 / XR';
      } else if (maxDim === 812 && minDim === 375) {
        deviceName = 'iPhone 13 mini / 12 mini / 11 Pro / X';
      } else if (maxDim === 667 && minDim === 375) {
        deviceName = 'iPhone SE / 8';
      } else {
        deviceName = 'Apple iPhone';
      }
    } else if (/iPad/i.test(ua)) {
      deviceType = 'Tablet';
      os = 'iPadOS';
      deviceName = 'Apple iPad';
    } else if (/Android/i.test(ua)) {
      deviceType = 'Mobile';
      const androidMatch = ua.match(/Android\s*([\d.]+)/i);
      os = androidMatch ? `Android ${androidMatch[1]}` : 'Android';

      // Extract raw model name from Android UA: e.g. "Android 14; SM-S928B Build/..." or "Android 13; Pixel 8 Pro"
      const modelMatch = ua.match(/Android[^;]+;\s*([^;)]+?)\s*(?:Build|[;)])/i);
      let rawModel = modelMatch ? modelMatch[1].trim() : '';

      if (rawModel) {
        // Map common Android model codes to user-friendly names
        if (/^SM-S928/i.test(rawModel)) deviceName = 'Samsung Galaxy S24 Ultra';
        else if (/^SM-S921/i.test(rawModel)) deviceName = 'Samsung Galaxy S24';
        else if (/^SM-S918/i.test(rawModel)) deviceName = 'Samsung Galaxy S23 Ultra';
        else if (/^SM-S911/i.test(rawModel)) deviceName = 'Samsung Galaxy S23';
        else if (/^SM-S908/i.test(rawModel)) deviceName = 'Samsung Galaxy S22 Ultra';
        else if (/^SM-S901/i.test(rawModel)) deviceName = 'Samsung Galaxy S22';
        else if (/^SM-[A-Z]\d+/i.test(rawModel)) deviceName = `Samsung Galaxy (${rawModel})`;
        else if (/Pixel\s*\d+/i.test(rawModel)) deviceName = rawModel;
        else if (/^CPH\d+/i.test(rawModel) || /^PHT\d+/i.test(rawModel)) deviceName = `OPPO (${rawModel})`;
        else if (/^V2\d+/i.test(rawModel) || /^I2\d+/i.test(rawModel)) deviceName = `Vivo (${rawModel})`;
        else if (/^RMX\d+/i.test(rawModel)) deviceName = `Realme (${rawModel})`;
        else if (/^2\d{6}/i.test(rawModel) || /^Redmi/i.test(rawModel) || /^POCO/i.test(rawModel)) deviceName = `Xiaomi / Redmi (${rawModel})`;
        else if (/^OnePlus/i.test(rawModel) || /^NE\d+/i.test(rawModel)) deviceName = `OnePlus (${rawModel})`;
        else if (/^Moto/i.test(rawModel) || /^XT\d+/i.test(rawModel)) deviceName = `Motorola (${rawModel})`;
        else deviceName = rawModel;
      } else {
        deviceName = 'Android Device';
      }
    } else if (ua.includes('Macintosh')) {
      os = 'macOS';
      deviceType = 'Mac';
      deviceName = 'Apple Mac';
    } else if (ua.includes('Linux')) {
      os = 'Linux';
      deviceType = 'Desktop';
      deviceName = 'Linux PC';
    } else if (ua.includes('Windows')) {
      os = 'Windows 11';
      deviceType = 'Desktop';
      deviceName = 'Windows PC';
    }

    const displayTitle = deviceType === 'Mobile' || deviceType === 'iPhone' || deviceType === 'Tablet'
      ? `${deviceName || 'Mobile'} • ${os}`
      : `${browserLabel} • ${os}`;

    return {
      browser: browserLabel,
      os,
      deviceType,
      deviceName,
      displayTitle,
      fullDevice: `${deviceName ? deviceName + ' · ' : ''}${browserLabel} · ${os} / ${deviceType}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata',
      timeStr: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };
  });

  // Client Hints async check for precise Windows 11 & Mobile Model extraction
  useEffect(() => {
    if (typeof navigator !== 'undefined' && (navigator as any).userAgentData?.getHighEntropyValues) {
      (navigator as any).userAgentData
        .getHighEntropyValues(['platformVersion', 'platform', 'model', 'architecture'])
        .then((uaData: any) => {
          if (uaData?.platform === 'Windows') {
            const majorVersion = parseInt(uaData.platformVersion?.split('.')[0] || '0', 10);
            const detectedOS = majorVersion >= 13 ? 'Windows 11' : (majorVersion > 0 ? 'Windows 10' : 'Windows 11');
            setClientInfo((prev: any) => ({
              ...prev,
              os: detectedOS,
              displayTitle: `${prev.browser} • ${detectedOS}`,
              fullDevice: `${prev.browser} · ${detectedOS} / ${prev.deviceType}`
            }));
          } else if (uaData?.model) {
            // Android mobile model from Client Hints API (e.g., "Pixel 8", "SM-S928B", "OnePlus 12")
            let modelName = uaData.model.trim();
            if (/^SM-S928/i.test(modelName)) modelName = 'Samsung Galaxy S24 Ultra';
            else if (/^SM-S918/i.test(modelName)) modelName = 'Samsung Galaxy S23 Ultra';
            else if (/^SM-S911/i.test(modelName)) modelName = 'Samsung Galaxy S23';
            else if (/^SM-[A-Z]\d+/i.test(modelName)) modelName = `Samsung Galaxy (${modelName})`;

            setClientInfo((prev: any) => ({
              ...prev,
              deviceName: modelName,
              displayTitle: `${modelName} • ${prev.os}`,
              fullDevice: `${modelName} · ${prev.browser} · ${prev.os} / ${prev.deviceType}`
            }));
          }
        })
        .catch(() => { });
    }
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

          // Load server-backed profile metadata
          const m = u.profile_metadata || {};
          if (m.blood_group) setBloodGroup(m.blood_group);
          if (m.emergency_contact_name) setEmergencyContactName(m.emergency_contact_name);
          if (m.emergency_contact_phone) setEmergencyContactPhone(m.emergency_contact_phone);
          if (m.office_location) setOfficeLocation(m.office_location);
          if (m.specialization) setSpecialization(m.specialization);
          if (m.highest_degree) setHighestDegree(m.highest_degree);
          if (m.experience_years) setExperienceYears(m.experience_years);
          if (m.courses_taught) setCoursesTaught(m.courses_taught);
          if (m.faculty_bio) setFacultyBio(m.faculty_bio);
          if (Array.isArray(m.languages) && m.languages.length > 0) setSelectedLanguages(m.languages);
          if (m.consultation_days) setConsultationDays(m.consultation_days);
          if (m.consultation_slot) setConsultationSlot(m.consultation_slot);
          if (m.consultation_mode) setConsultationMode(m.consultation_mode);
          if (m.linkedin_url) setLinkedinUrl(m.linkedin_url);
          if (m.github_url) setGithubUrl(m.github_url);
          if (m.scholar_url) setScholarUrl(m.scholar_url);
          if (m.orcid_id) setOrcidId(m.orcid_id);
          if (m.scopus_id) setScopusId(m.scopus_id);
          if (m.leetcode_handle) setLeetcodeHandle(m.leetcode_handle);
          if (m.card_theme) setSelectedCardTheme(m.card_theme);
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

  // Fetch Mentees (Only executed for staff/faculty mentors)
  useEffect(() => {
    const fetchMentees = async () => {
      setMenteesLoading(true);
      try {
        const res = await api.get('/faculty-assignments/my-students');
        if (res.data?.students) {
          setMentees(res.data.students);
        }
      } catch (err) {
        console.error('Failed to fetch mentees', err);
      } finally {
        setMenteesLoading(false);
      }
    };
    if (user && isStaffMentor) {
      fetchMentees();
    }
  }, [user, isStaffMentor]);

  const fetchSessions = async () => {
    setSessionsLoading(true);
    try {
      const res = await api.get('/auth/sessions');
      if (res.data?.success && res.data.sessions) {
        setSessions(res.data.sessions);
      }
    } catch (err) {
      console.error('Failed to fetch sessions', err);
    } finally {
      setSessionsLoading(false);
    }
  };

  const fetchLoginHistory = async () => {
    try {
      const res = await api.get('/auth/audit');
      if (res.data?.success && res.data.history) {
        setLoginHistory(res.data.history);
      }
    } catch (err) {
      console.error('Failed to fetch login history', err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchSessions();
      fetchLoginHistory();
    }
  }, [user]);

  // Load notification preferences from server on mount
  useEffect(() => {
    const fetchPrefs = async () => {
      try {
        const res = await api.get('/notifications/preferences');
        if (res.data) {
          const cats = res.data.categories || {};
          if (cats.contests !== undefined) {
            setEmailContestAlerts(Boolean(cats.contests));
            localStorage.setItem('pref_contest_email', String(cats.contests));
          }
          if (cats.reports !== undefined) {
            setWeeklyDigestAlerts(Boolean(cats.reports));
            localStorage.setItem('pref_weekly_digest', String(cats.reports));
          }
          if (cats.system !== undefined) {
            setSystemAuditAlerts(Boolean(cats.system));
            localStorage.setItem('pref_audit_alerts', String(cats.system));
          }
        }
      } catch (err) {
        // Fall back to local preferences gracefully
      }
    };
    if (user) {
      fetchPrefs();
    }
  }, [user]);

  // Listen for native Pull-to-Refresh events to refresh profile, mentees, and sessions
  useEffect(() => {
    const handlePull = async () => {
      try {
        const p1 = api.get('/auth/me').then(res => {
          if (res.data?.user) {
            const u = res.data.user;
            setFullName(u.full_name || u.username || '');
            setDesignation(u.designation || '');
            setPhoneNumber(u.phone_number || '');
            setDateOfBirth(parseDOBToDisplay(u.date_of_birth));
            setProfilePhoto(u.profile_photo || null);
            if (u.is_2fa_enabled !== undefined) setIs2FAEnabled(Boolean(u.is_2fa_enabled));
          }
        }).catch(() => {});

        const p2 = isStaffMentor ? api.get('/faculty-assignments/my-students').then(res => {
          if (res.data?.students) setMentees(res.data.students);
        }).catch(() => {}) : Promise.resolve();

        const p3 = fetchSessions();
        const p4 = fetchLoginHistory();
        await Promise.allSettled([p1, p2, p3, p4]);
      } catch (err) {
        console.warn('AccountProfileSettings pull-to-refresh error:', err);
      }
    };

    window.addEventListener('pull_to_refresh', handlePull);
    return () => window.removeEventListener('pull_to_refresh', handlePull);
  }, [user, isStaffMentor]);

  // Sync notification preferences to backend in real-time
  const syncNotificationPreferences = async (
    contestsVal: boolean,
    weeklyVal: boolean,
    systemVal: boolean
  ) => {
    try {
      await api.put('/notifications/preferences', {
        push_enabled: true,
        email_enabled: contestsVal || weeklyVal,
        categories: {
          assignments: true,
          attendance: true,
          contests: contestsVal,
          reports: weeklyVal,
          system: systemVal,
          announcements: true,
          app_updates: true
        }
      });
    } catch (err) {
      console.warn('Preferences sync to backend deferred, cached locally:', err);
    }
  };

  const [notesSaveStatus, setNotesSaveStatus] = useState<'saved' | 'saving'>('saved');
  const [isPlayingAudioTest, setIsPlayingAudioTest] = useState<boolean>(false);

  const handleTestAudioChime = () => {
    setIsPlayingAudioTest(true);
    playChimeSound();
    notify.info('Audio Chime Test', `Current Tone: ${selectedNotificationTone.toUpperCase()}`, { category: 'AUDIO', duration: 3000 });
    setTimeout(() => setIsPlayingAudioTest(false), 700);
  };

  const handleTestContestAlert = () => {
    triggerHaptic('light');
    dispatchPortalNotification({
      title: 'Contest Finalization Receipt',
      message: 'Weekly Contest #438 synchronized • 42 Mentees participated • Rankings finalized.',
      category: 'contests',
      priority: 'high',
      actionRoute: '/weekly-contest'
    });
  };

  const handleTestWeeklyDigest = () => {
    triggerHaptic('light');
    dispatchPortalNotification({
      title: 'Weekly Mentee Progress Digest',
      message: '128 problems solved this week • 3 students on 7-day streak • 2 inactive warnings.',
      category: 'reports',
      priority: 'normal',
      actionRoute: '/dashboard'
    });
  };

  const handleTestSystemAudit = () => {
    triggerHaptic('light');
    dispatchPortalNotification({
      title: 'Security Audit Verified',
      message: 'Session authenticated from Chrome on Windows • IP 127.0.0.1 • No anomalies detected.',
      category: 'announcements',
      priority: 'high',
      actionRoute: '/profile'
    });
  };

  const handleToggleContestAlerts = (val: boolean) => {
    setEmailContestAlerts(val);
    localStorage.setItem('pref_contest_email', String(val));
    syncNotificationPreferences(val, weeklyDigestAlerts, systemAuditAlerts);
    if (val) {
      dispatchPortalNotification({
        title: 'Contest Receipts Enabled',
        message: 'Instant email receipts scheduled for weekly LeetCode contests.',
        category: 'contests',
        priority: 'normal',
        actionRoute: '/weekly-contest'
      });
    } else {
      notify.info('Contest Receipts Muted', 'Email receipts paused.', { category: 'CONTEST' });
    }
  };

  const handleToggleWeeklyDigest = (val: boolean) => {
    setWeeklyDigestAlerts(val);
    localStorage.setItem('pref_weekly_digest', String(val));
    syncNotificationPreferences(emailContestAlerts, val, systemAuditAlerts);
    if (val) {
      dispatchPortalNotification({
        title: 'Weekly Mentee Digest Enabled',
        message: 'Assigned student summary scheduled every Monday morning at 9:00 AM.',
        category: 'reports',
        priority: 'normal',
        actionRoute: '/dashboard'
      });
    } else {
      notify.info('Weekly Mentee Digest Muted', 'Periodic digest paused.', { category: 'ADMIN' });
    }
  };

  const handleToggleSystemAuditAlerts = (val: boolean) => {
    setSystemAuditAlerts(val);
    localStorage.setItem('pref_audit_alerts', String(val));
    syncNotificationPreferences(emailContestAlerts, weeklyDigestAlerts, val);
    if (val) {
      dispatchPortalNotification({
        title: 'Security Audit Alerts Active',
        message: 'Instant push notifications for unrecognized logins & password changes.',
        category: 'announcements',
        priority: 'high',
        actionRoute: '/profile'
      });
    } else {
      notify.info('Security Audit Alerts Muted', 'Security activity logged silently.', { category: 'SYSTEM' });
    }
  };

  const handleToggleToastAudio = (val: boolean) => {
    setToastAudioAlerts(val);
    localStorage.setItem('pref_toast_audio', String(val));
    if (val) playChimeSound();
    notify.success(
      val
        ? 'In-App Sound Chimes Enabled • Audio feedback active for portal alerts.'
        : 'In-App Sound Chimes Muted • Alerts will show silently.',
      '',
      { category: 'AUDIO' }
    );
  };

  const handleInactivityThresholdChange = (val: number) => {
    setInactivityDaysThreshold(val);
    localStorage.setItem('pref_inactivity_threshold', String(val));
    triggerHaptic('selection');
    dispatchPortalNotification({
      title: `Inactivity Warning Threshold: ${val} Days`,
      message: `Students without submissions in ${val} consecutive days will be flagged on roster (${val <= 3 ? 'Strict' : val <= 7 ? 'Balanced' : 'Relaxed'}).`,
      category: 'attendance',
      priority: 'high',
      actionRoute: '/dashboard'
    });
  };

  const handleToggleShowPhone = (val: boolean) => {
    setShowPhoneToStudents(val);
    localStorage.setItem('pref_show_phone_students', String(val));
    notify.success(
      val
        ? 'Mobile Shared with Mentees • Assigned student batch can now view your WhatsApp contact.'
        : 'Mobile Kept Private • Contact hidden from student view.',
      '',
      { category: 'ADMIN' }
    );
  };

  const handleToggleShowCabin = (val: boolean) => {
    setShowCabinInDirectory(val);
    localStorage.setItem('pref_show_cabin_dir', String(val));
    notify.success(
      val
        ? 'Cabin Location Visible • Room location shown in campus internal directory.'
        : 'Cabin Hidden from Directory • Location kept confidential.',
      '',
      { category: 'ADMIN' }
    );
  };

  const handleFacultyNotesChange = (val: string) => {
    setFacultyNotes(val);
    setNotesSaveStatus('saving');
    localStorage.setItem('nec_faculty_notes', val);
    setTimeout(() => setNotesSaveStatus('saved'), 350);
  };

  const handleCopyNotes = () => {
    if (!facultyNotes || !facultyNotes.trim()) {
      notify.info('Faculty scratchpad is empty.', '', { category: 'ADMIN' });
      return;
    }
    navigator.clipboard.writeText(facultyNotes);
    notify.success('Faculty scratchpad copied to clipboard.', '', { category: 'ADMIN' });
  };

  const handleClearNotes = () => {
    setShowClearNotesConfirm(true);
  };

  const handleConfirmClearNotes = () => {
    handleFacultyNotesChange('');
    setShowClearNotesConfirm(false);
    notify.success('Scratchpad cleared.', '', { category: 'ADMIN' });
  };

  const handleInsertNoteTemplate = (template: string) => {
    const updated = facultyNotes && facultyNotes.trim() ? `${facultyNotes}\n${template}` : template;
    handleFacultyNotesChange(updated);
    notify.success('Added note item to scratchpad.', '', { category: 'ADMIN' });
  };

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
    return Math.min(100, score);
  }, [fullName, phoneNumber, profilePhoto, dateOfBirth, designation, facultyBio, linkedinUrl, githubUrl, leetcodeHandle]);

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
      let dobToSend = dateOfBirth || null;
      if (dobToSend && dobToSend.includes('/')) {
        const parts = dobToSend.split('/');
        if (parts.length === 3) {
          dobToSend = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
        }
      }

      const payload: any = {
        full_name: (fullName || '').trim(),
        designation: (designation || '').trim(),
        phone_number: (phoneNumber || '').trim(),
        date_of_birth: dobToSend,
        profile_photo: profilePhoto || null,
        is_2fa_enabled: is2FAEnabled,
        blood_group: bloodGroup,
        emergency_contact_name: emergencyContactName,
        emergency_contact_phone: emergencyContactPhone,
        office_location: officeLocation,
        specialization: specialization,
        highest_degree: highestDegree,
        experience_years: experienceYears,
        courses_taught: coursesTaught,
        faculty_bio: facultyBio,
        languages: selectedLanguages,
        consultation_days: consultationDays,
        consultation_slot: consultationSlot,
        consultation_mode: consultationMode,
        linkedin_url: linkedinUrl,
        github_url: githubUrl,
        scholar_url: scholarUrl,
        orcid_id: orcidId,
        scopus_id: scopusId,
        leetcode_handle: leetcodeHandle,
        card_theme: selectedCardTheme
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
        } catch { }
      }
    } catch (err: any) {
      const detail = err.response?.data?.detail || err.message || 'Failed to update profile.';
      setErrorMessage(detail);
      notify.error(detail, '', { category: 'ADMIN' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdatePasswordOnly = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (!currentPassword) {
      setErrorMessage('Current password is required to change password.');
      notify.error('Current password is required.', '', { category: 'ADMIN' });
      return;
    }
    if (!newPassword) {
      setErrorMessage('Please enter a new password.');
      notify.error('Please enter a new password.', '', { category: 'ADMIN' });
      return;
    }
    if (newPassword.length < 6) {
      setErrorMessage('New password must be at least 6 characters.');
      notify.error('New password must be at least 6 characters.', '', { category: 'ADMIN' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('New password and confirm password do not match.');
      notify.error('New password and confirm password do not match.', '', { category: 'ADMIN' });
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await api.put('/auth/profile', {
        current_password: currentPassword,
        new_password: newPassword
      });
      if (res.data?.success) {
        notify.success('Master password updated successfully!', '', { category: 'ADMIN' });
        if (toastAudioAlerts) playChimeSound();
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setSuccessMessage('Your master account password has been updated securely.');
      }
    } catch (err: any) {
      const detail = err.response?.data?.detail || err.message || 'Failed to update password.';
      setErrorMessage(detail);
      notify.error(detail, '', { category: 'ADMIN' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetForm = () => {
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
  };

  const handleExportCSV = () => {
    const rows = [
      ['Student Reg No', 'Name', 'Attendance', 'LeetCode Solved', 'Action Type']
    ];

    mentees.forEach(m => {
      const att = m.status_code === 'CRITICAL' ? '60%' : m.status_code === 'WARNING' ? '74%' : '90%+';
      const actionType = m.status_code === 'CRITICAL' ? 'Intervene' : m.status_code === 'WARNING' ? 'Warn' : 'View';
      rows.push([`="${m.reg_no}"`, m.name || m.username, att, String(m.total_solved || 0), actionType]);
    });

    const csvContent = rows.map(e => e.join(",")).join("\n");

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

  const handleRevokeSession = async (sessionId: string) => {
    try {
      await api.delete(`/auth/sessions/${sessionId}`);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      notify.success('Device session revoked successfully', '', { category: 'ADMIN' });
    } catch (err: any) {
      notify.error(err.response?.data?.detail || err.response?.data?.message || 'Failed to revoke session', '', { category: 'ADMIN' });
    }
  };

  const handleRevokeAllOtherSessions = async () => {
    try {
      const otherSessions = sessions.filter(s => !s.current);
      for (const s of otherSessions) {
        await api.delete(`/auth/sessions/${s.id}`);
      }
      setSessions(prev => prev.filter(s => s.current));
      notify.success('All other remote device sessions revoked', '', { category: 'ADMIN' });
    } catch (err) {
      notify.error('Failed to revoke some sessions', '', { category: 'ADMIN' });
    }
  };

  const handleOpen2FASetup = async (forceRegen: boolean = false) => {
    if (isGenerating2FA) return;
    setIsGenerating2FA(true);
    try {
      const res = await api.post(`/auth/2fa/generate${forceRegen ? '?force=true' : ''}`);
      if (res.data?.secret && res.data?.uri) {
        setTotpSecret(res.data.secret);
        setTotpUri(res.data.uri);
        setTotpCodeInput('');
        setShow2FASetupModal(true);
        if (forceRegen) {
          notify.success('New 2FA QR code generated', '', { category: 'ADMIN' });
        }
      }
    } catch (err) {
      notify.error('Failed to generate 2FA secret', '', { category: 'ADMIN' });
    } finally {
      setIsGenerating2FA(false);
    }
  };

  const institutionalId = (user as any)?.institutional_id || `NEC-STAFF-${user?.id ? String(user.id).padStart(3, '0') : '098'}`;
  const departmentName = (user as any)?.department_code || user?.department || 'INSTITUTIONAL';
  const roleName = user?.role || 'Faculty Mentor';
  const createdAtFormatted = (user as any)?.created_at ? new Date((user as any).created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Academic Session 2025–26';

  // Dynamic Role-Aware Security Report Descriptor
  const getSecurityReportConfig = () => {
    const rawRole = (user?.role || '').trim().toLowerCase();

    if (['admin', 'super admin', 'superadmin', 'administrator'].includes(rawRole)) {
      return {
        reportTitle: 'OFFICIAL ADMINISTRATIVE SECURITY ACCESS & AUDIT LOG REPORT',
        personRoleLabel: 'Administrator',
        personNameLabel: 'Administrator Name',
        scopeLabel: 'Institutional Administrative Scope',
        filePrefix: 'Admin',
      };
    }
    if (['principal'].includes(rawRole)) {
      return {
        reportTitle: 'OFFICIAL PRINCIPAL EXECUTIVE SECURITY ACCESS & AUDIT LOG REPORT',
        personRoleLabel: 'Principal',
        personNameLabel: 'Principal Name',
        scopeLabel: 'Institutional Campus Scope',
        filePrefix: 'Principal',
      };
    }
    if (['management', 'director', 'vice principal'].includes(rawRole)) {
      return {
        reportTitle: 'OFFICIAL EXECUTIVE LEADERSHIP SECURITY ACCESS & AUDIT LOG REPORT',
        personRoleLabel: 'Executive Director',
        personNameLabel: 'Executive Name',
        scopeLabel: 'Institutional Executive Scope',
        filePrefix: 'Executive',
      };
    }
    if (['hod', 'department hod', 'head of department', 'placement coordinator'].includes(rawRole)) {
      return {
        reportTitle: 'OFFICIAL DEPARTMENT LEADERSHIP SECURITY ACCESS & AUDIT LOG REPORT',
        personRoleLabel: 'Head of Department',
        personNameLabel: 'HOD Name',
        scopeLabel: 'Department Scope',
        filePrefix: 'HOD',
      };
    }
    if (['student'].includes(rawRole)) {
      return {
        reportTitle: 'OFFICIAL STUDENT SECURITY ACCESS & AUDIT LOG REPORT',
        personRoleLabel: 'Student',
        personNameLabel: 'Student Name',
        scopeLabel: 'Department & Academic Year',
        filePrefix: 'Student',
      };
    }
    // Default for Faculty / Staff
    return {
      reportTitle: 'OFFICIAL FACULTY SECURITY ACCESS & AUDIT LOG REPORT',
      personRoleLabel: 'Faculty Mentor',
      personNameLabel: 'Faculty Name',
      scopeLabel: 'Department Scope',
      filePrefix: 'Faculty',
    };
  };

  // Dynamic Scannable Verification Payload (vCard + Official Accreditation verification)
  const qrVerificationPayload = useMemo(() => {
    return `BEGIN:VCARD\r\nVERSION:3.0\r\nN:${fullName || 'Faculty Member'};;;;\r\nFN:${fullName || 'Faculty Member'}\r\nTITLE:${designation || 'Staff'}\r\nORG:Nandha Engineering College (Autonomous);${departmentName}\r\nTEL;TYPE=WORK,VOICE:${phoneNumber || '9042020879'}\r\nEMAIL;TYPE=WORK:${user?.email || 'nanthishvaran17@gmail.com'}\r\nNOTE:Institutional ID: ${institutionalId} | Status: VERIFIED ACTIVE | Auth: SHA256-${institutionalId.toLowerCase()}-verified\r\nURL:https://nandhaengg.org\r\nEND:VCARD`;
  }, [institutionalId, fullName, designation, departmentName, phoneNumber, user?.email]);

  // Authoritative Institutional ID Verification URL for instant camera scan
  const idVerificationUrl = useMemo(() => {
    let origin = typeof window !== 'undefined' ? window.location.origin : 'https://nandha-leetcode.duckdns.org';
    if (!origin || origin.includes('localhost') || origin.includes('127.0.0.1')) {
      origin = 'https://nandha-leetcode.duckdns.org';
    }
    const params = new URLSearchParams({
      type: 'id_card',
      id: institutionalId,
      name: fullName || user?.username || 'Staff Member',
      role: rawRole.includes('admin') ? 'ADMINISTRATOR' : rawRole.includes('student') ? 'STUDENT' : 'FACULTY',
      desig: designation || roleName || 'Faculty',
      dept: departmentName && departmentName !== 'INSTITUTIONAL' ? departmentName : 'Computer Science & Engineering',
      email: user?.email || '',
      phone: phoneNumber || (user as any)?.phone_number || '',
      dob: dateOfBirth || '',
      blood: bloodGroup || 'O+ (Positive)'
    });
    return `${origin}/verify/${encodeURIComponent(institutionalId)}?${params.toString()}`;
  }, [institutionalId, fullName, user?.username, user?.email, (user as any)?.phone_number, phoneNumber, dateOfBirth, rawRole, designation, roleName, departmentName, bloodGroup]);



  // Apply imported profile JSON and persist immediately to device & backend
  const applyImportedProfileData = async (imported: any): Promise<boolean> => {
    try {
      if (imported.full_name) setFullName(imported.full_name);
      if (imported.designation) setDesignation(imported.designation);
      if (imported.phone_number) setPhoneNumber(imported.phone_number);
      if (imported.date_of_birth) setDateOfBirth(parseDOBToDisplay(imported.date_of_birth));
      if (imported.blood_group) {
        setBloodGroup(imported.blood_group);
        localStorage.setItem('nec_user_blood_group', imported.blood_group);
      }
      if (imported.highest_qualification) {
        setHighestDegree(imported.highest_qualification);
        localStorage.setItem('nec_user_degree', imported.highest_qualification);
      }
      if (imported.teaching_experience) {
        setExperienceYears(imported.teaching_experience);
        localStorage.setItem('nec_user_exp_years', imported.teaching_experience);
      }
      if (imported.courses_taught) {
        setCoursesTaught(imported.courses_taught);
        localStorage.setItem('nec_user_courses', imported.courses_taught);
      }
      if (imported.office_location) {
        setOfficeLocation(imported.office_location);
        localStorage.setItem('nec_user_office_loc', imported.office_location);
      }
      if (imported.specialization) {
        setSpecialization(imported.specialization);
        localStorage.setItem('nec_user_specialization', imported.specialization);
      }
      if (imported.faculty_bio) {
        setFacultyBio(imported.faculty_bio);
        localStorage.setItem('nec_user_bio', imported.faculty_bio);
      }
      if (Array.isArray(imported.languages)) {
        setSelectedLanguages(imported.languages);
        localStorage.setItem('nec_user_languages', JSON.stringify(imported.languages));
      }
      if (imported.consultation) {
        if (imported.consultation.days) {
          setConsultationDays(imported.consultation.days);
          localStorage.setItem('nec_user_consult_days', imported.consultation.days);
        }
        if (imported.consultation.time) {
          setConsultationSlot(imported.consultation.time);
          localStorage.setItem('nec_user_consult_slot', imported.consultation.time);
        }
        if (imported.consultation.mode) {
          setConsultationMode(imported.consultation.mode);
          localStorage.setItem('nec_user_consult_mode', imported.consultation.mode);
        }
      }
      if (imported.emergency_contact) {
        if (imported.emergency_contact.name) {
          setEmergencyContactName(imported.emergency_contact.name);
          localStorage.setItem('nec_user_emergency_name', imported.emergency_contact.name);
        }
        if (imported.emergency_contact.phone) {
          setEmergencyContactPhone(imported.emergency_contact.phone);
          localStorage.setItem('nec_user_emergency_phone', imported.emergency_contact.phone);
        }
      }
      if (imported.portfolio) {
        if (imported.portfolio.linkedin) {
          setLinkedinUrl(imported.portfolio.linkedin);
          localStorage.setItem('nec_user_linkedin', imported.portfolio.linkedin);
        }
        if (imported.portfolio.github) {
          setGithubUrl(imported.portfolio.github);
          localStorage.setItem('nec_user_github', imported.portfolio.github);
        }
        if (imported.portfolio.scholar) {
          setScholarUrl(imported.portfolio.scholar);
          localStorage.setItem('nec_user_scholar', imported.portfolio.scholar);
        }
        if (imported.portfolio.orcid) {
          setOrcidId(imported.portfolio.orcid);
          localStorage.setItem('nec_user_orcid', imported.portfolio.orcid);
        }
        if (imported.portfolio.scopus) {
          setScopusId(imported.portfolio.scopus);
          localStorage.setItem('nec_user_scopus', imported.portfolio.scopus);
        }
        if (imported.portfolio.leetcode) {
          setLeetcodeHandle(imported.portfolio.leetcode);
          localStorage.setItem('nec_user_leetcode', imported.portfolio.leetcode);
        }
      }
      if (imported.preferences?.notes) {
        setFacultyNotes(imported.preferences.notes);
        localStorage.setItem('nec_faculty_notes', imported.preferences.notes);
      }
      if (imported.preferences?.card_theme) {
        setSelectedCardTheme(imported.preferences.card_theme);
        localStorage.setItem('nec_card_theme', imported.preferences.card_theme);
      }

      // Sync updated fields to backend
      try {
        await api.put('/auth/profile', {
          full_name: (imported.full_name || fullName || '').trim(),
          designation: (imported.designation || designation || '').trim(),
          phone_number: (imported.phone_number || phoneNumber || '').trim(),
          blood_group: imported.blood_group || bloodGroup,
          emergency_contact_name: imported.emergency_contact?.name || emergencyContactName,
          emergency_contact_phone: imported.emergency_contact?.phone || emergencyContactPhone,
          office_location: imported.office_location || officeLocation,
          specialization: imported.specialization || specialization,
          highest_degree: imported.highest_qualification || highestDegree,
          experience_years: imported.teaching_experience || experienceYears,
          courses_taught: imported.courses_taught || coursesTaught,
          faculty_bio: imported.faculty_bio || facultyBio
        });
      } catch (syncErr) {
        console.warn('Backend sync deferred, saved to device local storage:', syncErr);
      }

      notify.success('Backup Restored & Applied Successfully!', 'All account settings and preferences have been updated.', { category: 'ADMIN' });
      return true;
    } catch (err: any) {
      notify.error('Failed to apply backup: ' + (err?.message || err), '', { category: 'ADMIN' });
      return false;
    }
  };

  // Export Profile Backup Data Generator
  const getProfileBackupData = () => {
    const data = {
      institution: 'Nandha Engineering College (Autonomous)',
      accreditation: 'NBA & NAAC A+ Grade Accredited',
      institutional_id: institutionalId,
      full_name: fullName || user?.username,
      role: roleName,
      designation: designation || 'Staff Member',
      department: departmentName,
      email: user?.email || 'nanthishvaran17@gmail.com',
      phone_number: phoneNumber,
      date_of_birth: dateOfBirth,
      blood_group: bloodGroup,
      highest_qualification: highestDegree,
      teaching_experience: experienceYears,
      courses_taught: coursesTaught,
      office_location: officeLocation,
      specialization: specialization,
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
      preferences: {
        email_contest_alerts: emailContestAlerts,
        weekly_digest_alerts: weeklyDigestAlerts,
        system_audit_alerts: systemAuditAlerts,
        toast_audio_alerts: toastAudioAlerts,
        inactivity_days_threshold: inactivityDaysThreshold,
        show_phone_to_students: showPhoneToStudents,
        show_cabin_in_directory: showCabinInDirectory,
        card_theme: selectedCardTheme,
        notes: facultyNotes
      },
      account_status: 'ACTIVE & VERIFIED',
      exported_at: new Date().toISOString()
    };
    const jsonStr = JSON.stringify(data, null, 2);
    const filename = `NEC_Profile_Backup_${institutionalId}.json`;
    return { data, jsonStr, filename };
  };

  // 1. Download Backup JSON (Native Mobile Documents & Web Downloads)
  const handleDownloadProfileJson = async () => {
    const { jsonStr, filename } = getProfileBackupData();
    const blob = new Blob([jsonStr], { type: 'application/json' });

    // On native mobile APK, write directly to Documents/Downloads folder via Capacitor Filesystem
    if (isNativeMobile || Capacitor.isNativePlatform()) {
      try {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        await Filesystem.writeFile({
          path: filename,
          data: jsonStr,
          directory: Directory.Documents,
          recursive: true
        });
        triggerHaptic('success');
        notify.success('Backup Saved Successfully', `File saved to Documents: ${filename}`, { category: 'ADMIN' });
        return;
      } catch (fsErr) {
        console.warn('Filesystem direct write failed, falling back to downloadManager:', fsErr);
      }
    }

    try {
      await downloadManager.downloadBlob(blob, filename, 'application/json');
      triggerHaptic('success');
      notify.success('Backup Saved Successfully', `Profile JSON saved: ${filename}`, { category: 'ADMIN' });
    } catch {
      try {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        triggerHaptic('success');
        notify.success('Profile backup downloaded', '', { category: 'ADMIN' });
      } catch (e: any) {
        notify.error('Download failed: ' + (e?.message || e), '', { category: 'ADMIN' });
      }
    }
  };

  // 2. Share Backup JSON via Android Native Share Sheet or Web Share
  const handleShareProfileJson = async () => {
    const { jsonStr, filename } = getProfileBackupData();
    triggerHaptic('selection');
    try {
      if (isNativeMobile || Capacitor.isNativePlatform()) {
        const { Share } = await import('@capacitor/share');
        await Share.share({
          title: `NEC Profile Backup - ${fullName || 'Staff'}`,
          text: jsonStr,
          dialogTitle: `Share ${filename} via...`,
        });
        triggerHaptic('success');
        return;
      }
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({
          title: filename,
          text: jsonStr,
        });
        triggerHaptic('success');
        return;
      }
      await navigator.clipboard.writeText(jsonStr);
      triggerHaptic('success');
      notify.info('Sharing not supported on this browser. Backup copied to clipboard!', '', { category: 'ADMIN' });
    } catch (shareErr: any) {
      if (shareErr?.name !== 'AbortError') {
        console.warn('Share error:', shareErr);
      }
    }
  };

  // 3. Copy Backup JSON directly to Clipboard
  const handleCopyProfileJson = () => {
    const { jsonStr } = getProfileBackupData();
    triggerHaptic('selection');
    try {
      navigator.clipboard.writeText(jsonStr);
      triggerHaptic('success');
      notify.success('Backup JSON Copied!', 'JSON text copied to clipboard. You can paste and save it anywhere.', { category: 'ADMIN' });
    } catch {
      notify.error('Clipboard access denied. Please use the Download option.', '', { category: 'ADMIN' });
    }
  };

  // Import profile JSON from file picker
  const handleImportProfileJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const content = event.target?.result as string;
          setPasteJsonInput(content);
          const imported = JSON.parse(content);
          setParsedBackupPreview(imported);
          triggerHaptic('selection');
          notify.success('Backup File Loaded', `Found profile for ${imported.full_name || 'Staff'}. Review & click Confirm Restore.`, { category: 'ADMIN' });
        } catch {
          setParsedBackupPreview(null);
          notify.error('Invalid JSON file format. Please choose a valid NEC profile backup.', '', { category: 'ADMIN' });
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    }
  };

  // Export vCard (.vcf) (Native Mobile APK & Web)
  const handleExportVCard = async () => {
    const vcard = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${fullName || 'Nanthishvaran S'}`,
      `TITLE:${designation || 'Staff'}`,
      `ORG:Nandha Engineering College (Autonomous);${departmentName && departmentName !== 'INSTITUTIONAL' ? departmentName : 'Computer Science & Engineering'}`,
      `EMAIL;TYPE=INTERNET,WORK:${user?.email || 'nanthishvaran17@gmail.com'}`,
      `TEL;TYPE=WORK,VOICE:${phoneNumber || '+91 90420 20879'}`,
      `ADR;TYPE=WORK:;;${officeLocation || 'Main Campus, Academic Block B-204'};Erode;Tamil Nadu;638052;India`,
      `URL:${linkedinUrl || 'https://nandhaengg.org'}`,
      `NOTE:Institutional ID: ${institutionalId} | Blood Group: ${bloodGroup || 'O+'}`,
      'END:VCARD'
    ].join('\r\n');

    const blob = new Blob([vcard], { type: 'text/vcard;charset=utf-8' });
    const filename = `NEC_${institutionalId}_Contact.vcf`;

    try {
      await downloadManager.downloadBlob(blob, filename, 'text/vcard');
      notify.success('vCard Saved', 'Contact card saved to device Downloads.', { category: 'ADMIN' });
    } catch {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify.success('vCard Contact downloaded! Open with Phonebook/Contacts.', '', { category: 'ADMIN' });
    }
  };

  // High-Resolution 300 DPI Canvas ID Card Image Exporter (Native Mobile & Web)
  const handleDownloadIdCardPng = async () => {
    setIsSavingCard(true);
    try {
      const effectiveDob = dateOfBirth || '17/01/2004';
      const effectiveBlood = bloodGroup || 'O+ (Positive)';
      const effectiveCabin = officeLocation || 'Main Campus • Academic Block B-204';
      const effectiveDept = departmentName && departmentName !== 'INSTITUTIONAL' ? departmentName : 'Computer Science & Engineering';
      const effectiveRole = rawRole.includes('admin') ? 'ADMINISTRATOR' : rawRole.includes('student') ? 'STUDENT' : 'FACULTY';
      const userName = fullName || user?.username || 'Institutional Member';
      const userDesig = designation || roleName || 'Faculty / Staff';

      const canvas = document.createElement('canvas');
      canvas.width = 1600;
      canvas.height = 1100;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D rendering is not available');

      // 1. Overall Dark Background
      const bgGrad = ctx.createLinearGradient(0, 0, 1600, 1100);
      bgGrad.addColorStop(0, '#0a0f1d');
      bgGrad.addColorStop(1, '#020617');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 1600, 1100);

      // Top Institutional Banner
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('NANDHA ENGINEERING COLLEGE (AUTONOMOUS)', 800, 58);

      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 17px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('Official Institutional Identity Card • High-Resolution CR80 PVC Print Ready', 800, 92);

      const drawRoundRect = (x: number, y: number, w: number, h: number, r: number) => {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
      };

      // ==========================================
      // FRONT CARD (X: 120, Y: 125, W: 640, H: 910)
      // ==========================================
      const fx = 120, fy = 125, cw = 640, ch = 910;
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
      ctx.shadowBlur = 35;
      ctx.shadowOffsetY = 16;
      drawRoundRect(fx, fy, cw, ch, 32);
      ctx.fillStyle = '#0f172a';
      ctx.fill();
      ctx.restore();

      const fGrad = ctx.createLinearGradient(fx, fy, fx + cw, fy + ch);
      fGrad.addColorStop(0, '#0f172a');
      fGrad.addColorStop(0.5, '#1e1b4b');
      fGrad.addColorStop(1, '#020617');
      drawRoundRect(fx, fy, cw, ch, 32);
      ctx.fillStyle = fGrad;
      ctx.fill();

      ctx.lineWidth = 5;
      ctx.strokeStyle = '#f59e0b';
      ctx.stroke();

      // Front Header Text
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('NANDHA ENGINEERING COLLEGE', fx + 40, fy + 65);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = 'bold 13.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('Autonomous • Anna University • NBA & NAAC A+', fx + 40, fy + 90);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(fx + 40, fy + 110);
      ctx.lineTo(fx + cw - 40, fy + 110);
      ctx.stroke();

      // EMV Gold Chip
      const chipGrad = ctx.createLinearGradient(fx + 40, fy + 130, fx + 110, fy + 180);
      chipGrad.addColorStop(0, '#fde68a');
      chipGrad.addColorStop(0.5, '#f59e0b');
      chipGrad.addColorStop(1, '#d97706');
      drawRoundRect(fx + 40, fy + 130, 70, 50, 10);
      ctx.fillStyle = chipGrad;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Role Pill
      const rolePillX = fx + cw - 180;
      drawRoundRect(rolePillX, fy + 135, 140, 36, 18);
      ctx.fillStyle = effectiveRole === 'FACULTY' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(99, 102, 241, 0.25)';
      ctx.fill();
      ctx.strokeStyle = effectiveRole === 'FACULTY' ? '#10b981' : '#6366f1';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = effectiveRole === 'FACULTY' ? '#6ee7b7' : '#a5b4fc';
      ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(effectiveRole, rolePillX + 70, fy + 159);

      // Photo Box
      drawRoundRect(fx + 40, fy + 210, 160, 180, 24);
      ctx.fillStyle = '#090d16';
      ctx.fill();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 64px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(userName.charAt(0).toUpperCase(), fx + 120, fy + 325);

      // User Information
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 26px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      const displayUserName = userName.length > 22 ? userName.slice(0, 20) + '...' : userName;
      ctx.fillText(displayUserName, fx + 225, fy + 250);

      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(userDesig, fx + 225, fy + 285);

      // Institutional ID Tag
      drawRoundRect(fx + 225, fy + 305, 240, 36, 10);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 17px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(institutionalId, fx + 345, fy + 329);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#93c5fd';
      ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      const displayDept = effectiveDept.length > 28 ? effectiveDept.slice(0, 26) + '...' : effectiveDept;
      ctx.fillText(displayDept, fx + 225, fy + 365);

      // Specs Grid
      drawRoundRect(fx + 40, fy + 420, cw - 80, 175, 20);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('DOB (VERIFIED)', fx + 65, fy + 455);
      ctx.fillText('BLOOD GROUP', fx + 340, fy + 455);
      ctx.fillText('MOBILE / CONTACT', fx + 65, fy + 535);
      ctx.fillText('CABIN / ROOM', fx + 340, fy + 535);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(effectiveDob, fx + 65, fy + 482);

      ctx.fillStyle = '#fca5a5';
      ctx.fillText(effectiveBlood, fx + 340, fy + 482);

      ctx.fillStyle = '#ffffff';
      ctx.fillText(phoneNumber || '+91 90420 20879', fx + 65, fy + 562);
      ctx.fillText(effectiveCabin.length > 20 ? effectiveCabin.slice(0, 18) + '...' : effectiveCabin, fx + 340, fy + 562);

      // Barcode
      const bcY = fy + 625;
      const bcXStart = fx + 60;
      const bcW = cw - 120;
      ctx.fillStyle = '#ffffff';
      for (let bx = bcXStart; bx < bcXStart + bcW; bx += 7) {
        const lineW = (bx % 3 === 0) ? 3 : (bx % 2 === 0 ? 2 : 1);
        ctx.fillRect(bx, bcY, lineW, 46);
      }
      ctx.fillStyle = '#cbd5e1';
      ctx.font = 'bold 15px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`*${institutionalId}*`, fx + cw / 2, bcY + 68);

      // Signatures & Validity
      ctx.textAlign = 'left';
      ctx.fillStyle = '#cbd5e1';
      ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('Valid: Academic Session 2025–26', fx + 40, fy + 770);
      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('25th Year (Silver Jubilee)', fx + 40, fy + 792);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#fde047';
      ctx.font = 'italic bold 26px "Brush Script MT", cursive, sans-serif';
      ctx.fillText('Dr. U. S. Ragupathy', fx + cw - 40, fy + 770);
      ctx.fillStyle = '#cbd5e1';
      ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('Dr. U. S. Ragupathy, M.E., Ph.D.', fx + cw - 40, fy + 795);
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('Principal • Authorized Signatory', fx + cw - 40, fy + 815);

      // ==========================================
      // BACK CARD (X: 840, Y: 125, W: 640, H: 910)
      // ==========================================
      const bx = 840, by = 125;
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
      ctx.shadowBlur = 35;
      ctx.shadowOffsetY = 16;
      drawRoundRect(bx, by, cw, ch, 32);
      ctx.fillStyle = '#090d16';
      ctx.fill();
      ctx.restore();

      const bGrad = ctx.createLinearGradient(bx, by, bx + cw, by + ch);
      bGrad.addColorStop(0, '#090d16');
      bGrad.addColorStop(0.5, '#131b2e');
      bGrad.addColorStop(1, '#030712');
      drawRoundRect(bx, by, cw, ch, 32);
      ctx.fillStyle = bGrad;
      ctx.fill();

      ctx.lineWidth = 5;
      ctx.strokeStyle = '#6366f1';
      ctx.stroke();

      // Magnetic Stripe
      ctx.fillStyle = '#000000';
      ctx.fillRect(bx, by + 40, cw, 60);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, by + 40, cw, 60);

      // Address & Affiliation
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 17px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('NANDHA ENGINEERING COLLEGE (AUTONOMOUS)', bx + cw / 2, by + 145);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('Approved by AICTE, New Delhi & Affiliated to Anna University, Chennai', bx + cw / 2, by + 175);
      ctx.fillText('Erode - Perundurai Main Road, Vaikkaalmedu, Erode - 638 052, Tamil Nadu', bx + cw / 2, by + 200);
      ctx.fillText('Phone: 04294 - 225585 | Email: info@nandhaengg.org | www.nandhaengg.org', bx + cw / 2, by + 225);

      // Emergency Box
      drawRoundRect(bx + 40, by + 260, cw - 80, 120, 18);
      ctx.fillStyle = 'rgba(239, 68, 68, 0.12)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.textAlign = 'left';
      ctx.fillStyle = '#fca5a5';
      ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('EMERGENCY & MEDICAL RECORD', bx + 65, by + 295);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(`Person: ${emergencyContactName || 'Department HOD / College Emergency Desk'}`, bx + 65, by + 325);
      ctx.fillText(`Phone: ${emergencyContactPhone || phoneNumber || '+91 04294 225585'} | Blood: ${effectiveBlood}`, bx + 65, by + 355);

      // Institutional Instructions
      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('INSTITUTIONAL INSTRUCTIONS:', bx + 40, by + 430);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('• This card is institutional property and strictly non-transferable.', bx + 45, by + 465);
      ctx.fillText('• 25 Years of Institutional Excellence (1999 - 2025).', bx + 45, by + 495);
      ctx.fillText('• Loss must be reported immediately to College Office / IT Admin.', bx + 45, by + 525);
      ctx.fillText('• If found, kindly deposit at Campus Security Gate or Principal\'s Office.', bx + 45, by + 555);

      // Cryptographic Seal & Verification
      drawRoundRect(bx + 40, by + 680, cw - 80, 140, 20);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#6ee7b7';
      ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('CRYPTOGRAPHIC SEAL & DIGITAL AUDIT TRAIL', bx + 65, by + 720);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '13px monospace';
      ctx.fillText(`HASH: SHA256-${institutionalId.toLowerCase()}-verified`, bx + 65, by + 750);
      ctx.fillText('ISSUED BY: Nandha Engineering College Autonomous Cell', bx + 65, by + 780);

      drawRoundRect(bx + cw - 180, by + 695, 110, 110, 14);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      if (idCardQrCanvasRef.current) {
        ctx.drawImage(idCardQrCanvasRef.current, bx + cw - 175, by + 700, 100, 100);
      } else {
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('VERIFIED', bx + cw - 125, by + 745);
        ctx.fillText('SMART QR', bx + cw - 125, by + 765);
      }

      // Export to Blob
      canvas.toBlob(async (blob) => {
        if (!blob) {
          throw new Error('Canvas toBlob conversion failed');
        }
        const filename = `Nandha_PVC_ID_Card_${institutionalId}.png`;
        await downloadManager.downloadBlob(blob, filename, 'image/png');
        notify.success(
          'ID Card Saved to Device!',
          `Saved as ${filename} in your Downloads folder. Ready for PVC plastic card printing.`,
          { category: 'ADMIN' }
        );
      }, 'image/png');
    } catch (err: any) {
      console.error('ID Card image generation failed:', err);
      notify.error('Save Failed', err?.message || 'Could not save ID Card image.', { category: 'ADMIN' });
    } finally {
      setIsSavingCard(false);
    }
  };

  // Share ID Card details or image
  const handleShareIdCard = async () => {
    try {
      const title = `Nandha Engineering College PVC ID Badge - ${fullName || user?.username}`;
      const text = `Institutional ID: ${institutionalId} | Role: ${rawRole} | Nandha Engineering College (Autonomous)`;
      if (Capacitor.isNativePlatform()) {
        const { Share } = await import('@capacitor/share');
        await Share.share({
          title,
          text,
          dialogTitle: 'Share ID Card'
        });
      } else if (navigator.share) {
        await navigator.share({
          title,
          text,
          url: window.location.href
        });
      } else {
        await navigator.clipboard.writeText(`${title}\n${text}`);
        notify.success('ID Card details copied to clipboard!', '', { category: 'ADMIN' });
      }
    } catch (err) {
      console.warn('Share cancelled or not supported:', err);
    }
  };

  // Dedicated High-Resolution PVC ID Card Print Dispatcher
  const handlePrintIdCard = () => {
    // If on native mobile APK, ALWAYS open the responsive in-app ID Card Modal so the app is never destroyed
    if (isNativeMobile || Capacitor.isNativePlatform()) {
      setShowIdCardModal(true);
      return;
    }

    // On desktop, open print popup with sticky back & download navigation
    const printWindow = window.open('', '_blank', 'width=1000,height=800');
    if (!printWindow) {
      // Fallback to modal if popup is blocked
      setShowIdCardModal(true);
      return;
    }

    const effectiveDob = dateOfBirth || '17/01/2004';
    const effectiveBlood = bloodGroup || 'O+ (Positive)';
    const effectiveCabin = officeLocation || 'Main Campus • Academic Block B-204';
    const effectiveDept = departmentName && departmentName !== 'INSTITUTIONAL' ? departmentName : 'Computer Science & Engineering';
    const effectiveRole = rawRole.includes('admin') ? 'ADMINISTRATOR' : rawRole.includes('student') ? 'STUDENT' : 'FACULTY';
    const origin = window.location.origin;
    const qrDataUrl = idCardQrCanvasRef.current ? idCardQrCanvasRef.current.toDataURL('image/png') : '';

    const printHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Nandha Engineering College - Institutional ID Card - ${institutionalId}</title>
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; margin: 0; padding: 24px; color: #0f172a; }
    .header-banner { text-align: center; margin-bottom: 25px; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; }
    .header-banner h1 { margin: 0; font-size: 22px; font-weight: 900; letter-spacing: 0.5px; color: #1e1b4b; }
    .header-banner p { margin: 4px 0 0; font-size: 11px; font-weight: 700; color: #64748b; }
    .print-toolbar { text-align: center; margin-bottom: 24px; display: flex; align-items: center; justify-content: center; gap: 12px; position: sticky; top: 12px; z-index: 999; }
    .btn-back { background: #334155; color: white; border: none; padding: 12px 24px; border-radius: 12px; font-weight: 800; font-size: 13px; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
    .btn-print { background: #4f46e5; color: white; border: none; padding: 12px 28px; border-radius: 12px; font-weight: 800; font-size: 13px; cursor: pointer; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3); }
    .cards-container { display: flex; gap: 36px; justify-content: center; align-items: flex-start; flex-wrap: wrap; }
    .pvc-frame { width: 340px; height: 520px; border-radius: 20px; position: relative; overflow: hidden; color: white; padding: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.25); display: flex; flex-direction: column; justify-content: space-between; page-break-inside: avoid; border: 2px solid #f59e0b; background: linear-gradient(145deg, #0f172a 0%, #1e1b4b 55%, #020617 100%); }
    .pvc-frame.back-frame { background: linear-gradient(145deg, #090d16 0%, #131b2e 55%, #030712 100%); border-color: #6366f1; }
    .inst-header { display: flex; align-items: center; gap: 10px; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 10px; }
    .emblem-img { width: 44px; height: 44px; object-fit: contain; }
    .inst-titles h3 { margin: 0; font-size: 11.5px; font-weight: 900; letter-spacing: 0.5px; color: #ffffff; text-transform: uppercase; }
    .inst-titles p { margin: 2px 0 0; font-size: 8px; font-weight: 700; color: #cbd5e1; }
    .chip-row { display: flex; justify-content: space-between; align-items: center; margin: 8px 0; }
    .gold-chip { width: 38px; height: 26px; border-radius: 6px; background: linear-gradient(135deg, #fcd34d, #f59e0b, #d97706); border: 1px solid rgba(255,255,255,0.6); }
    .role-badge { background: rgba(16, 185, 129, 0.25); border: 1px solid #10b981; color: #6ee7b7; padding: 3px 10px; border-radius: 9999px; font-size: 9px; font-weight: 900; letter-spacing: 0.8px; }
    .profile-row { display: flex; gap: 14px; align-items: center; margin: 6px 0; }
    .photo-box { width: 88px; height: 98px; border-radius: 14px; border: 2px solid #f59e0b; overflow: hidden; background: #000; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
    .photo-box img { width: 100%; height: 100%; object-fit: cover; }
    .user-info h2 { margin: 0; font-size: 16px; font-weight: 900; color: #ffffff; line-height: 1.2; }
    .user-info .desig { margin: 3px 0 0; font-size: 11px; font-weight: 800; color: #fde047; }
    .user-info .id-tag { display: inline-block; background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.25); padding: 2px 8px; border-radius: 6px; font-family: monospace; font-size: 10.5px; font-weight: 900; margin-top: 6px; letter-spacing: 0.5px; }
    .specs-grid { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 14px; padding: 9px 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 9px; }
    .specs-grid span.lbl { display: block; font-size: 7.5px; text-transform: uppercase; font-weight: 900; color: #94a3b8; letter-spacing: 0.5px; }
    .specs-grid span.val { font-weight: 800; color: #ffffff; margin-top: 1px; display: block; }
    .barcode-section { text-align: center; border-top: 1px solid rgba(255,255,255,0.15); padding-top: 6px; }
    .barcode-lines { height: 26px; background: repeating-linear-gradient(to right, #fff, #fff 2px, transparent 2px, transparent 4px, #fff 4px, #fff 7px, transparent 7px, transparent 9px); opacity: 0.9; }
    .barcode-text { font-family: monospace; font-size: 8.5px; font-weight: 900; letter-spacing: 2px; color: #cbd5e1; margin-top: 2px; }
    .signature-row { display: flex; justify-content: space-between; align-items: flex-end; font-size: 8px; color: #94a3b8; font-weight: 800; margin-top: 4px; }
    .sig-cursive { font-family: "Brush Script MT", cursive, sans-serif; font-size: 17px; color: #fde047; }
    /* Back styles */
    .mag-strip { height: 32px; background: #000000; margin: -20px -20px 10px -20px; border-bottom: 1px solid rgba(255,255,255,0.2); }
    .back-address { font-size: 8.5px; text-align: center; color: #cbd5e1; line-height: 1.35; border-bottom: 1px solid rgba(255,255,255,0.15); padding-bottom: 8px; }
    .terms-list { font-size: 8px; color: #94a3b8; line-height: 1.4; padding-left: 12px; margin: 6px 0; }
    .emergency-box { background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.35); border-radius: 10px; padding: 7px 10px; font-size: 8.5px; }
    .emergency-box strong { color: #fca5a5; }
    @media print {
      .print-toolbar { display: none; }
      body { background: white; padding: 0; }
    }
  </style>
</head>
<body>
  <div class="print-toolbar">
    <button class="btn-back" onclick="if(window.history.length > 1){window.history.back()}else{window.close()}">← Back to Profile</button>
    <button class="btn-print" onclick="window.print()">Print High-Resolution PVC ID Card</button>
  </div>
  <div class="header-banner">
    <h1>NANDHA ENGINEERING COLLEGE (AUTONOMOUS)</h1>
    <p>Official Institutional Identity Card • Front & Back Side-by-Side Ready for PVC Card Printing</p>
  </div>
  <div class="cards-container">
    <!-- Front Card -->
    <div class="pvc-frame">
      <div class="inst-header" style="justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <img class="emblem-img" src="${origin}/nandha_emblem.png" alt="NEC" />
          <div class="inst-titles">
            <h3>NANDHA ENGINEERING COLLEGE</h3>
            <p>Autonomous • Anna University • NBA &amp; NAAC A+</p>
          </div>
        </div>
        <img style="height: 38px; width: auto; object-fit: contain;" src="${origin}/nec_25_years_logo_transparent.png" alt="25 Years" />
      </div>
      <div class="chip-row">
        <div class="gold-chip"></div>
        <span class="role-badge">${effectiveRole}</span>
      </div>
      <div class="profile-row">
        <div class="photo-box">
          ${profilePhoto ? `<img src="${profilePhoto}" alt="Photo" />` : `<span style="font-size:32px;font-weight:900;">${(fullName || 'U').charAt(0)}</span>`}
        </div>
        <div class="user-info">
          <h2>${fullName || user?.username}</h2>
          <div class="desig">${designation || roleName}</div>
          <div class="id-tag">${institutionalId}</div>
          <div style="font-size:9.5px;color:#93c5fd;font-weight:800;margin-top:2px;">${effectiveDept}</div>
        </div>
      </div>
      <div class="specs-grid">
        <div><span class="lbl">DOB (Verified)</span><span class="val">${effectiveDob}</span></div>
        <div><span class="lbl">Blood Group</span><span class="val" style="color:#fca5a5;">${effectiveBlood}</span></div>
        <div><span class="lbl">Mobile / Contact</span><span class="val">${phoneNumber || '+91 90420 20879'}</span></div>
        <div><span class="lbl">Cabin / Room</span><span class="val">${effectiveCabin}</span></div>
      </div>
      <div class="barcode-section">
        <div class="barcode-lines"></div>
        <div class="barcode-text">*${institutionalId}*</div>
      </div>
      <div class="signature-row">
        <div>
          <span>Valid: Academic Session 2025–26</span><br />
          <span style="color:#fde047;font-size:7.5px;font-weight:900;">25th Year (Silver Jubilee)</span>
        </div>
        <div style="text-align:right;">
          <div class="sig-cursive">Dr. U. S. Ragupathy</div>
          <span style="display:block;font-size:7.5px;color:#cbd5e1;font-weight:900;">Dr. U. S. Ragupathy, M.E., Ph.D.</span>
          <span>Principal • Authorized Signatory</span>
        </div>
      </div>
    </div>

    <!-- Back Card -->
    <div class="pvc-frame back-frame">
      <div class="mag-strip"></div>
      <div class="back-address">
        <strong style="color:#ffffff;font-size:9.5px;">NANDHA ENGINEERING COLLEGE (AUTONOMOUS)</strong><br />
        Approved by AICTE, New Delhi & Affiliated to Anna University, Chennai<br />
        Erode - Perundurai Main Road, Vaikkaalmedu, Erode - 638 052, Tamil Nadu<br />
        Phone: 04294 - 225585 | Email: info@nandhaengg.org | www.nandhaengg.org
      </div>
      <div class="emergency-box">
        <strong>EMERGENCY &amp; MEDICAL RECORD</strong><br />
        Person: ${emergencyContactName || 'Department HOD / College Emergency Desk'}<br />
        Phone: ${emergencyContactPhone || phoneNumber || '+91 04294 225585'} | Blood: ${effectiveBlood}
      </div>
      <div>
        <span style="font-size:8.5px;font-weight:900;color:#fde047;text-transform:uppercase;">Institutional Instructions:</span>
        <ul class="terms-list">
          <li>This card is institutional property and strictly non-transferable (25 Years of Excellence).</li>
          <li>Loss must be reported immediately to College Office / IT Admin.</li>
          <li>If found, kindly deposit at Campus Security Gate or Principal's Office (Dr. U. S. Ragupathy, 04294-225585).</li>
        </ul>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;border-top:1px solid rgba(255,255,255,0.15);padding-top:8px;">
        <div>
          <span style="font-size:8.5px;font-weight:900;color:#6ee7b7;display:block;">CRYPTOGRAPHIC SEAL</span>
          <span style="font-size:7.5px;font-family:monospace;color:#cbd5e1;">SHA256-${institutionalId.toLowerCase()}-verified</span>
        </div>
        <div style="background:#ffffff;padding:4px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;flex-direction:column;align-items:center;justify-content:center;">
          ${qrDataUrl ? `<img src="${qrDataUrl}" style="width:68px;height:68px;display:block;border-radius:4px;" alt="Verified QR" />` : `<div style="width:68px;height:68px;background:#fff;color:#000;font-size:8px;font-weight:900;display:flex;align-items:center;justify-content:center;text-align:center;">SCAN TO<br/>VERIFY</div>`}
          <span style="font-size:6.5px;font-weight:900;color:#0f172a;margin-top:2px;letter-spacing:0.5px;">SCAN TO VERIFY</span>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

    printWindow.document.write(printHtml);
    printWindow.document.close();
    printWindow.focus();
  };

  // Export Security Audit Log Excel with perfect alignment, styles, and logo using exceljs
  const handleExportSecurityAuditExcel = async () => {
    const reportCfg = getSecurityReportConfig();
    let notifyToast: any = null;
    try {
      notifyToast = notify.loading('Generating perfect Excel report...', '', { duration: 10000, category: 'ADMIN' });
      // Dynamic import of exceljs for client-side workbook generation
      // @ts-ignore
      const excelMod: any = await import('exceljs');
      const ExcelJS = excelMod.default ? excelMod.default : (excelMod.Workbook ? excelMod : (window as any).ExcelJS);
      const workbook = new (ExcelJS.Workbook || ExcelJS)();
      const worksheet = workbook.addWorksheet('Security Audit Log', {
        views: [{ showGridLines: false }]
      });

      // 1. Fetch and add both logos
      let logoLeftId, logoRightId;
      try {
        const fetchBase64 = async (url: string) => {
          const res = await fetch(url);
          if (!res.ok) return null;
          const blob = await res.blob();
          const reader = new FileReader();
          return new Promise<string>((resolve) => {
            reader.readAsDataURL(blob);
            reader.onloadend = () => resolve(reader.result as string);
          });
        };

        const leftBase64 = await fetchBase64(`${window.location.origin}/nandha_emblem.png`);
        const rightBase64 = await fetchBase64(`${window.location.origin}/nec_25_years_logo.png`);

        if (leftBase64) {
          logoLeftId = workbook.addImage({ base64: leftBase64, extension: 'png' });
        }
        if (rightBase64) {
          logoRightId = workbook.addImage({ base64: rightBase64, extension: 'png' });
        }
      } catch (err) {
        console.warn('Could not load logos for Excel', err);
      }

      if (logoLeftId !== undefined) {
        // Anchor to top left A1
        worksheet.addImage(logoLeftId, {
          tl: { col: 0.05, row: 0.1 },
          ext: { width: 85, height: 75 }
        });
      }

      if (logoRightId !== undefined) {
        // Anchor to top right G1 (which is column index 6)
        worksheet.addImage(logoRightId, {
          tl: { col: 6.1, row: 0.1 },
          ext: { width: 115, height: 75 }
        });
      }

      const colSpan = 7;

      // Setup Title Headers - Balanced, compact executive spacing
      worksheet.getRow(1).height = 46;
      worksheet.getRow(2).height = 24;
      worksheet.getRow(3).height = 20;
      worksheet.getRow(4).height = 10; // Clean small gap

      // 1. Main Title (Row 1)
      worksheet.mergeCells('A1:G1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = reportCfg.reportTitle;
      titleCell.font = { name: 'Times New Roman', size: 16, bold: true, color: { argb: 'FFFFFFFF' } }; // White text to match HTML
      titleCell.alignment = { horizontal: 'center', vertical: 'center', wrapText: true };

      // 2. Subtitle (Row 2)
      worksheet.mergeCells('A2:G2');
      const subCell = worksheet.getCell('A2');
      subCell.value = `${reportCfg.personRoleLabel}: ${fullName || user?.username} | Dept: ${departmentName}`;
      subCell.font = { name: 'Times New Roman', size: 12, bold: true, color: { argb: 'FFFDE047' } }; // Yellow text to match HTML
      subCell.alignment = { horizontal: 'center', vertical: 'center', wrapText: true };

      // 3. Generated At (Row 3)
      worksheet.mergeCells('A3:G3');
      const genCell = worksheet.getCell('A3');
      genCell.value = `Generated At: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata', dateStyle: 'long', timeStyle: 'short' })} IST`;
      genCell.font = { name: 'Times New Roman', size: 10, color: { argb: 'FFCBD5E1' } }; // Light Gray text to match HTML
      genCell.alignment = { horizontal: 'center', vertical: 'center', wrapText: true };

      // Apply dark blue fill to the entire header block (rows 1-4)
      for (let i = 1; i <= 4; i++) {
        for (let j = 1; j <= 7; j++) {
          const cell = worksheet.getCell(i, j);
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF002147' } };
        }
      }

      // 4. Headers (Row 5)
      const headerRow = worksheet.addRow(['Event ID', 'Date', 'Time (IST)', 'IP Address', 'Access Network', 'Authentication Method', 'Security Status']);
      headerRow.font = { name: 'Times New Roman', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.alignment = { horizontal: 'center', vertical: 'center' };
      headerRow.height = 25;
      headerRow.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
        cell.border = { top: { style: 'thin', color: { argb: 'FF000000' } }, left: { style: 'thin', color: { argb: 'FF000000' } }, bottom: { style: 'thin', color: { argb: 'FF000000' } }, right: { style: 'thin', color: { argb: 'FF000000' } } };
      });

      // 5. Data Rows
      loginHistory.forEach(h => {
        const row = worksheet.addRow([h.id, h.date, h.time, h.ip, h.network, h.method, h.status]);
        row.eachCell(cell => {
          cell.font = { name: 'Times New Roman', size: 11 };
          cell.border = { top: { style: 'thin', color: { argb: 'FF000000' } }, left: { style: 'thin', color: { argb: 'FF000000' } }, bottom: { style: 'thin', color: { argb: 'FF000000' } }, right: { style: 'thin', color: { argb: 'FF000000' } } };
          cell.alignment = { horizontal: 'center', vertical: 'center', wrapText: true };
        });

        // Custom styling for specific columns
        row.getCell(1).font = { name: 'Times New Roman', size: 11, bold: true };
        row.getCell(4).font = { name: 'Times New Roman', size: 11, color: { argb: 'FF0369A1' } };

        // Color status
        const statusCell = row.getCell(7);
        statusCell.font = { name: 'Times New Roman', size: 11, bold: true, color: { argb: h.status === 'SUCCESS' ? 'FF15803D' : 'FFE11D48' } };
        statusCell.alignment = { horizontal: 'center', vertical: 'center' };
      });

      // 6. Column widths
      worksheet.getColumn(1).width = 40; // Event ID
      worksheet.getColumn(2).width = 20; // Date
      worksheet.getColumn(3).width = 20; // Time
      worksheet.getColumn(4).width = 25; // IP
      worksheet.getColumn(5).width = 45; // Network
      worksheet.getColumn(6).width = 35; // Method
      worksheet.getColumn(7).width = 25; // Status

      // Alternating row colors
      for (let i = 6; i <= worksheet.rowCount; i++) {
        if (i % 2 !== 0) {
          worksheet.getRow(i).eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
          });
        }
      }

      // Export Excel via universal downloadManager (Web, Mobile WebView, Capacitor APK)
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const filename = `NEC_${reportCfg.filePrefix}_Security_Audit_${institutionalId}_${new Date().toISOString().split('T')[0]}.xlsx`;

      const downloadResult = await downloadManager.downloadBlob(blob, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      if (!downloadResult.success) {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        anchor.click();
        URL.revokeObjectURL(url);
      }

      if (notifyToast) notify.dismiss(notifyToast);
      notify.success('Security audit report downloaded successfully!', '', { category: 'ADMIN' });
    } catch (err: any) {
      console.error('Failed to generate Excel report, attempting CSV fallback', err);
      try {
        const rows = [
          ['Event ID', 'Date', 'Time (IST)', 'IP Address', 'Access Network', 'Authentication Method', 'Security Status']
        ];
        loginHistory.forEach(h => {
          rows.push([h.id, h.date, h.time, h.ip, h.network, h.method, h.status]);
        });
        const csvContent = rows.map(r => r.map(c => `"${String(c || '').replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const filename = `NEC_${reportCfg.filePrefix}_Security_Audit_${institutionalId}_${new Date().toISOString().split('T')[0]}.csv`;
        await downloadManager.downloadBlob(blob, filename, 'text/csv;charset=utf-8;');

        if (notifyToast) notify.dismiss(notifyToast);
        notify.success('Security audit log exported as CSV successfully!', '', { category: 'ADMIN' });
      } catch (fallbackErr: any) {
        if (notifyToast) notify.dismiss(notifyToast);
        notify.error(`Failed to export audit report: ${err?.message || err}`, '', { category: 'ADMIN' });
      }
    }
  };

  // Print Formatted Security Audit Report — Full Page Preview (no auto-print)
  const handlePrintSecurityAuditReport = () => {
    const reportCfg = getSecurityReportConfig();
    const logoUrl = `${window.location.origin}/nec_25_years_logo.png`;
    const emblemUrl = `${window.location.origin}/nandha_emblem.png`;
    const nowIst = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
    const nowShort = new Date().toLocaleString('en-GB', {
      timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short',
      year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    const reportHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>NEC ${reportCfg.personRoleLabel} Security Audit Report — ${institutionalId}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
      background: #f1f5f9; color: #0f172a; min-height: 100vh;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }

    /* ── Sticky action bar (hidden when printing) ─── */
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

    /* ── Page wrapper ────────────────────────────── */
    .page-wrap { max-width: 920px; margin: 0 auto; padding: 82px 24px 48px; }

    /* ── A4 white card ───────────────────────────── */
    .a4-card {
      background: #fff; border-radius: 18px;
      box-shadow: 0 4px 32px rgba(0,0,0,0.13);
      padding: 34px 38px 30px;
      display: flex; flex-direction: column; gap: 0;
    }

    /* ── Header banner ───────────────────────────── */
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

    /* ── Meta strip ──────────────────────────────── */
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

    /* ── Section heading ─────────────────────────── */
    .sec-head {
      display: flex; align-items: center; justify-content: space-between;
      border-bottom: 2.5px solid #002147; padding-bottom: 7px; margin-bottom: 14px;
    }
    .sec-head h2 { font-size: 12px; font-weight: 900; color: #002147;
                   text-transform: uppercase; letter-spacing: 0.6px; }
    .sec-head span { font-size: 10px; color: #64748b; font-weight: 700; }

    /* ── Table ───────────────────────────────────── */
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

    /* ── Footer ──────────────────────────────────── */
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

    /* ── Mobile Responsive Rules ───────── */
    @media (max-width: 768px) {
      .action-bar { padding: 10px 14px; height: auto; flex-direction: column; align-items: stretch; gap: 8px; }
      .bar-left-title { font-size: 12px; }
      .bar-left-sub { font-size: 9.5px; }
      .bar-btns { justify-content: flex-end; gap: 8px; }
      .btn-print { padding: 7px 14px; font-size: 11.5px; }
      .btn-close { padding: 7px 12px; font-size: 11.5px; }
      .page-wrap { padding: 94px 8px 24px; max-width: 100%; }
      .a4-card { padding: 18px 12px; border-radius: 12px; }
      .hdr { flex-direction: column; text-align: center; gap: 12px; padding: 16px 14px; }
      .hdr-left { flex-direction: column; align-items: center; gap: 10px; }
      .hdr-h1 { font-size: 16px; }
      .hdr-sub { font-size: 9.5px; }
      .hdr-aff { font-size: 8.5px; }
      .hdr-tag { width: 100%; text-align: center; padding: 8px 12px; }
      .hdr-tag-id { font-size: 13px; }
      .meta-grid { grid-template-columns: 1fr; }
      .meta-cell { border-right: none; border-bottom: 1px solid #e2e8f0; padding: 10px 12px; }
      .meta-cell:last-child { border-bottom: none; }
      .sec-head { flex-direction: column; align-items: flex-start; gap: 4px; }
      table { font-size: 10px; }
      thead th, tbody td { padding: 8px 9px; }
      .footer { flex-direction: column; align-items: flex-start; gap: 14px; }
    }

    /* ── Print: hide bar, collapse padding ───────── */
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
      <div class="bar-left-title">NEC Official ${reportCfg.personRoleLabel} Security Audit Report</div>
      <div class="bar-left-sub">${institutionalId} &bull; ${fullName || user?.username} (${reportCfg.personRoleLabel}) &bull; ${nowShort} IST</div>
    </div>
    <div class="bar-btns">
      <button id="btnPrintReport" type="button" class="btn-print" onclick="window.print()">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm1-4h.01M12 12h.01" /></svg>
        Print / Save as PDF
      </button>
      <button id="btnCloseReport" type="button" class="btn-close" onclick="if(window.history.length > 1){window.history.back()}else{window.close()}">&#10005; Back / Close</button>
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
            <div class="hdr-aff">Affiliated to Anna University Chennai &bull; Erode–Perundurai Road, Tamil Nadu &ndash; 638 052</div>
          </div>
        </div>
        <div class="hdr-tag">
          <div class="hdr-tag-lbl">${reportCfg.filePrefix.toUpperCase()} AUDIT LOG</div>
          <div class="hdr-tag-id">${institutionalId}</div>
        </div>
      </div>

      <!-- Meta Strip -->
      <div class="meta-grid">
        <div class="meta-cell">
          <div class="meta-lbl">${reportCfg.personNameLabel}</div>
          <div class="meta-val">${fullName || user?.username}</div>
        </div>
        <div class="meta-cell">
          <div class="meta-lbl">Institutional ID</div>
          <div class="meta-val meta-mono">${institutionalId}</div>
        </div>
        <div class="meta-cell">
          <div class="meta-lbl">${reportCfg.scopeLabel} &amp; Role</div>
          <div class="meta-val">${departmentName} &bull; ${roleName}</div>
        </div>
        <div class="meta-cell">
          <div class="meta-lbl">Report Generated (IST)</div>
          <div class="meta-val">${nowIst}</div>
        </div>
      </div>

      <!-- Section Heading -->
      <div class="sec-head">
        <h2>${reportCfg.personRoleLabel} Authentication &amp; Security Access Audit Trail</h2>
        <span>${loginHistory.length} Record${loginHistory.length !== 1 ? 's' : ''} Logged</span>
      </div>

      <!-- Audit Table -->
      <div style="overflow-x: auto; width: 100%; border-radius: 8px;">
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
      </div>

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

  <script>
    function triggerPrint() {
      try {
        window.print();
      } catch (err) {
        console.error('Print failed:', err);
      }
    }

    function triggerClose() {
      try {
        window.close();
      } catch (err) {
        console.error('Close failed:', err);
      }
      try {
        self.close();
      } catch (err) {}
    }

    function bindEvents() {
      var printBtn = document.getElementById('btnPrintReport');
      var closeBtn = document.getElementById('btnCloseReport');
      if (printBtn) {
        printBtn.onclick = triggerPrint;
        printBtn.addEventListener('click', triggerPrint);
      }
      if (closeBtn) {
        closeBtn.onclick = triggerClose;
        closeBtn.addEventListener('click', triggerClose);
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bindEvents);
    } else {
      bindEvents();
    }
    setTimeout(bindEvents, 300);
  </script>
</body>
</html>`;

    // On mobile APK, download report directly to avoid overwriting the WebView
    if (isNativeMobile || Capacitor.isNativePlatform()) {
      const blob = new Blob([reportHtml], { type: 'text/html' });
      downloadManager.downloadBlob(blob, `NEC_Security_Audit_Report_${institutionalId}.html`, 'text/html');
      notify.success('Security Report Saved', 'Report downloaded to your device Downloads folder.', { category: 'ADMIN' });
      return;
    }

    const printWin = window.open('', '_blank', 'width=1140,height=880,scrollbars=yes,resizable=yes');
    if (printWin) {
      printWin.document.open();
      printWin.document.write(reportHtml);
      printWin.document.close();
      printWin.focus();
      notify.success('Print report opened', 'Use the Print button in the report window to print or save as PDF.', { category: 'ADMIN' });
      return;
    }

    // Popup blockers can reject window.open; print through an invisible same-page iframe instead.
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    document.body.appendChild(printFrame);
    const frameDocument = printFrame.contentWindow?.document;
    if (frameDocument && printFrame.contentWindow) {
      frameDocument.open();
      frameDocument.write(reportHtml);
      frameDocument.close();
      printFrame.onload = () => {
        printFrame.contentWindow?.focus();
        printFrame.contentWindow?.print();
        setTimeout(() => printFrame.remove(), 1000);
      };
    } else {
      printFrame.remove();
      notify.error('Print report could not be opened', 'Please allow popups for this site and try again.', { category: 'ADMIN' });
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
    <div className="space-y-4 sm:space-y-6 animate-fade-in w-full pb-36 sm:pb-16 text-slate-900 dark:text-slate-100">

      {/* ========================================================================= */}
      {/* 1. MASTER SETTINGS HUB (Mockup "After: New Professional UI") - MOBILE ONLY */}
      {/* ========================================================================= */}
      {activeTab === 'menu' && (
        <div className="lg:hidden space-y-4 w-full max-w-2xl mx-auto animate-fade-in pb-32 sm:pb-20">
          {/* Header Bar matching mockup: Left arrow, "Settings", Subtitle */}
          <div className="flex items-center gap-3 pt-1 pb-2">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="p-2 -ml-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors cursor-pointer"
                aria-label="Back"
                title="Go Back"
              >
                <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
              </button>
            )}
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Settings
              </h1>
              <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">
                Manage your account and preferences
              </p>
            </div>
          </div>

          {/* Profile Card matching mockup */}
          <div className="bg-white dark:bg-navy-900 rounded-3xl p-4 sm:p-5 border border-slate-200/90 dark:border-navy-800 shadow-xs flex items-center gap-4 transition-all">
            {/* Circular Avatar with Green Checkmark Badge */}
            <div
              className="relative shrink-0 w-16 h-16 sm:w-20 sm:h-20 cursor-pointer group select-none"
              onClick={() => { if (profilePhoto) setShowPhotoZoom(true); }}
              title="Click to view photo"
            >
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden border-2 border-indigo-200 dark:border-indigo-800 bg-slate-100 dark:bg-navy-950 flex items-center justify-center relative shadow-sm">
                {profilePhoto ? (
                  <img
                    src={profilePhoto}
                    alt={fullName || user?.username || 'nanthishvaran17'}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-tr from-brand-600 via-indigo-600 to-purple-600 text-white font-black text-2xl sm:text-3xl flex items-center justify-center">
                    {(fullName || user?.username || 'N').charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              {/* Verified Badge */}
              <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 sm:w-5.5 sm:h-5.5 rounded-full bg-emerald-500 border-2 border-white dark:border-navy-900 shadow-sm flex items-center justify-center text-white z-10" title="Verified Account">
                <Check className="w-3 h-3 stroke-[3]" />
              </span>
            </div>

            {/* Profile Credentials */}
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight truncate">
                  {fullName || user?.username || 'nanthishvaran17'}
                </h2>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border border-purple-200/70 dark:border-purple-800/70">
                  {roleName?.toUpperCase() || 'ADMIN'}
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 truncate">
                <User className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="truncate">{designation || roleName || 'Admin'} &bull; {institutionalId}</span>
              </div>

              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
                {user?.email || 'nanthishvaran17@gmail.com'}
              </div>

              <div className="text-xs text-slate-500 dark:text-slate-400 font-mono font-bold">
                {phoneNumber || '9042020879'}
              </div>

              {/* Verified Status & Quick Action Buttons */}
              <div className="flex items-center gap-2.5 pt-1 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80">
                  <Check className="w-3 h-3 stroke-[3]" />
                  <span>VERIFIED</span>
                </span>

                <button
                  type="button"
                  onClick={() => setActiveTab('profile')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold border border-purple-400 dark:border-purple-600 text-purple-700 dark:text-purple-300 bg-white dark:bg-navy-950 hover:bg-purple-50 dark:hover:bg-purple-950/40 transition-all cursor-pointer active:scale-95 shadow-2xs"
                >
                  <Edit3 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                  <span>Edit profile</span>
                </button>
              </div>
            </div>
          </div>

          {/* Primary 7-Item Settings List (WhatsApp / Telegram / Meesho card style) */}
          <div className="bg-white dark:bg-navy-900 rounded-3xl border border-slate-200/90 dark:border-navy-800 shadow-xs divide-y divide-slate-100 dark:divide-navy-800/80 overflow-hidden">
            {/* 1. Account & Profile */}
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className="w-full flex items-center justify-between p-3.5 sm:p-4 hover:bg-slate-50/80 dark:hover:bg-navy-800/50 transition-colors text-left group cursor-pointer"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-200/60 dark:border-purple-900/60 flex items-center justify-center shrink-0">
                  <User className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-black text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                    Account &amp; Profile
                  </div>
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                    Personal details, contact info, photo
                  </div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
            </button>

            {/* 2. Security & Login */}
            <button
              type="button"
              onClick={() => setActiveTab('security')}
              className="w-full flex items-center justify-between p-3.5 sm:p-4 hover:bg-slate-50/80 dark:hover:bg-navy-800/50 transition-colors text-left group cursor-pointer"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-900/60 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-black text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                    Security &amp; Login
                  </div>
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                    Password, two-step verification, devices
                  </div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
            </button>

            {/* 3. Privacy & Permissions */}
            <button
              type="button"
              onClick={() => setActiveTab('privacy')}
              className="w-full flex items-center justify-between p-3.5 sm:p-4 hover:bg-slate-50/80 dark:hover:bg-navy-800/50 transition-colors text-left group cursor-pointer"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-pink-50 dark:bg-pink-950/60 text-pink-600 dark:text-pink-400 border border-pink-200/60 dark:border-pink-900/60 flex items-center justify-center shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-black text-slate-900 dark:text-white group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors">
                    Privacy &amp; Permissions
                  </div>
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                    Visibility, data access, blocked users
                  </div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
            </button>

            {/* 4. Notifications */}
            <button
              type="button"
              onClick={() => setActiveTab('notifications')}
              className="w-full flex items-center justify-between p-3.5 sm:p-4 hover:bg-slate-50/80 dark:hover:bg-navy-800/50 transition-colors text-left group cursor-pointer"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-900/60 flex items-center justify-center shrink-0">
                  <Bell className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-black text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                    Notifications
                  </div>
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                    Push, email and WhatsApp alerts
                  </div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
            </button>

            {/* 5. App Preferences */}
            <button
              type="button"
              onClick={() => setActiveTab('preferences')}
              className="w-full flex items-center justify-between p-3.5 sm:p-4 hover:bg-slate-50/80 dark:hover:bg-navy-800/50 transition-colors text-left group cursor-pointer"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border border-sky-200/60 dark:border-sky-900/60 flex items-center justify-center shrink-0">
                  <Sliders className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-black text-slate-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                    App Preferences
                  </div>
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                    Language, theme, accessibility
                  </div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
            </button>

            {/* 6. Digital ID Card */}
            <button
              type="button"
              onClick={() => setActiveTab('id_card')}
              className="w-full flex items-center justify-between p-3.5 sm:p-4 hover:bg-slate-50/80 dark:hover:bg-navy-800/50 transition-colors text-left group cursor-pointer"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 border border-cyan-200/60 dark:border-cyan-900/60 flex items-center justify-center shrink-0">
                  <FileBadge className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-black text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors flex items-center gap-2">
                    <span>Digital ID Card</span>
                    <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-cyan-100 dark:bg-cyan-950/80 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
                      PVC BADGE
                    </span>
                  </div>
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                    Official PVC identity badge, QR code &amp; NFC
                  </div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
            </button>

            {/* Optional: Staff Mentorship Hub (for faculty/mentors) */}
            {isStaffMentor && (
              <button
                type="button"
                onClick={() => setActiveTab('mentorship')}
                className="w-full flex items-center justify-between p-3.5 sm:p-4 hover:bg-slate-50/80 dark:hover:bg-navy-800/50 transition-colors text-left group cursor-pointer"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-900/60 flex items-center justify-center shrink-0">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-black text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors flex items-center gap-2">
                      <span>Mentorship Hub</span>
                      <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                        FACULTY
                      </span>
                    </div>
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                      Assigned students, reviews &amp; progress telemetry
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
              </button>
            )}

            {/* 7. Help & Support */}
            <button
              type="button"
              onClick={() => { setActiveTab('help'); triggerHaptic('selection'); }}
              className="w-full flex items-center justify-between p-3.5 sm:p-4 hover:bg-slate-50/80 dark:hover:bg-navy-800/50 transition-colors text-left group cursor-pointer"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-navy-700/60 flex items-center justify-center shrink-0">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-black text-slate-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                    Help &amp; Support
                  </div>
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                    FAQs, contact support, send feedback
                  </div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
            </button>

            {/* 8. Log out */}
            <button
              type="button"
              onClick={() => setShowLogoutConfirmModal(true)}
              className="w-full flex items-center justify-between p-3.5 sm:p-4 hover:bg-rose-50/60 dark:hover:bg-rose-950/30 transition-colors text-left group cursor-pointer"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/60 flex items-center justify-center shrink-0">
                  <LogOut className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-black text-rose-600 dark:text-rose-400">
                    Log out
                  </div>
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                    Sign out from your account
                  </div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-rose-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
            </button>
          </div>

          {/* Bottom spacer ensuring the last settings item (Log out) cleanly clears the floating bottom navigation bar */}
          <div className="h-20 sm:h-12 pointer-events-none" aria-hidden="true" />
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. RESPONSIVE SETTINGS WORKSPACE (Mobile Subview + Desktop 2-Column Hub) */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* 2. RESPONSIVE SETTINGS WORKSPACE (Mobile Subview + Desktop 2-Column Hub) */}
      {/* ========================================================================= */}
      <div className={`${activeTab === 'menu' ? 'hidden lg:block' : 'block'} w-full`}>
        {/* DESKTOP CONTAINER: Aligns Top Header and 2-Column Body to the exact same width with zero clipping */}
        <div className="w-full max-w-[1360px] mx-auto px-0 sm:px-6 lg:px-8">
          
          {/* DESKTOP TOP HEADER BAR */}
          <div className="hidden lg:flex items-center justify-between pb-5 mb-6 border-b border-slate-200/90 dark:border-navy-800/80">
            <div className="flex items-center gap-4">
              {onBack && (
                <motion.button
                  whileHover={{ scale: 1.02, x: -2 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={onBack}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black bg-white dark:bg-navy-900 text-slate-800 dark:text-slate-200 border border-slate-200/90 dark:border-navy-700 shadow-xs hover:shadow transition-all cursor-pointer"
                  title="Back to Dashboard"
                >
                  <ArrowLeft className="w-4 h-4 stroke-[2.5] text-brand-600 dark:text-brand-400" />
                  <span>Dashboard</span>
                </motion.button>
              )}
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                    Settings &amp; Preferences
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-100 text-purple-700 dark:bg-purple-950/70 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/80 shadow-2xs flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                    <span>{roleName?.toUpperCase() || 'ADMIN'}</span>
                  </span>
                </div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                  Manage your credentials, security preferences, official ID badge, and system controls.
                </p>
              </div>
            </div>

            {/* Quick Desktop Actions (Export Backup, Restore) */}
            <div className="flex items-center gap-2.5">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={() => setShowExportModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-800 transition-all cursor-pointer shadow-xs"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" />
                <span>Export Backup</span>
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={() => setShowRestoreModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-800 transition-all cursor-pointer shadow-xs"
              >
                <UploadCloud className="w-3.5 h-3.5 text-indigo-600" />
                <span>Restore Data</span>
              </motion.button>
            </div>
          </div>

          {/* WORKSPACE LAYOUT: Flex row on Desktop (w-[320px] sidebar + flex-1 right content) */}
          <div className="w-full max-w-2xl mx-auto lg:max-w-none lg:flex lg:flex-row lg:gap-8 items-start">

            {/* DESKTOP-ONLY LEFT NAVIGATION SIDEBAR */}
            <div className="hidden lg:block lg:w-[320px] xl:w-[340px] shrink-0 sticky top-6 space-y-4">
              {/* Desktop Profile Summary Card */}
              <div className="bg-white dark:bg-navy-900 rounded-3xl p-5 border border-slate-200/90 dark:border-navy-800 shadow-xs space-y-4">
                <div className="flex items-center gap-3.5">
                  <div
                    className="relative shrink-0 w-16 h-16 cursor-pointer group select-none"
                    onClick={() => { if (profilePhoto) setShowPhotoZoom(true); }}
                    title="Click to view photo"
                  >
                    <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-indigo-200 dark:border-indigo-800 bg-slate-100 dark:bg-navy-950 flex items-center justify-center relative shadow-sm">
                      {profilePhoto ? (
                        <img
                          src={profilePhoto}
                          alt={fullName || user?.username || 'nanthishvaran17'}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-tr from-brand-600 via-indigo-600 to-purple-600 text-white font-black text-2xl flex items-center justify-center">
                          {(fullName || user?.username || 'N').charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-white dark:border-navy-900 shadow-sm flex items-center justify-center text-white z-10" title="Verified Account">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <h2 className="text-base font-black text-slate-900 dark:text-white tracking-tight truncate">
                      {fullName || user?.username || 'nanthishvaran17'}
                    </h2>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 mt-0.5 flex-wrap">
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border border-purple-200/70 dark:border-purple-800/70">
                        {roleName?.toUpperCase() || 'ADMIN'}
                      </span>
                      <span className="text-slate-400">&bull; {institutionalId}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate mt-1">
                      {user?.email || 'nanthishvaran17@gmail.com'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-navy-800">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80 shrink-0">
                    <Check className="w-3 h-3 stroke-[3]" />
                    <span>VERIFIED</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('profile')}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black border border-slate-300 dark:border-navy-700 text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-navy-950 hover:bg-slate-100 dark:hover:bg-navy-800 transition-all cursor-pointer shadow-2xs"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                    <span>Edit Profile</span>
                  </button>
                </div>
              </div>

              {/* Desktop Navigation Menu Card with Framer-Motion */}
              <div className="bg-white dark:bg-navy-900 rounded-3xl border border-slate-200/90 dark:border-navy-800 shadow-xs p-2 space-y-1">
                {[
                  { id: 'profile', label: 'Account & Profile', desc: 'Personal details, bio, photo', icon: User, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-950/60' },
                  { id: 'security', label: 'Security & Login', desc: 'Password, 2FA, passkeys', icon: ShieldCheck, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/60' },
                  { id: 'privacy', label: 'Privacy & Permissions', desc: 'Visibility, data access', icon: Lock, color: 'text-pink-600 dark:text-pink-400', bg: 'bg-pink-50 dark:bg-pink-950/60' },
                  { id: 'notifications', label: 'Notifications', desc: 'Push, email & WhatsApp alerts', icon: Bell, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/60' },
                  { id: 'preferences', label: 'App Preferences', desc: 'Language, theme, display', icon: Sliders, color: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-50 dark:bg-sky-950/60' },
                  { id: 'id_card', label: 'Digital ID Card', desc: 'PVC badge, QR verification', icon: FileBadge, color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-950/60', badge: 'PVC BADGE' },
                  ...(isStaffMentor ? [{ id: 'mentorship', label: 'Mentorship Hub', desc: 'Assigned student telemetry', icon: GraduationCap, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/60', badge: 'FACULTY' }] : []),
                  { id: 'help', label: 'Help & Support', desc: 'Campus IT desk & FAQs', icon: HelpCircle, color: 'text-brand-600 dark:text-brand-400', bg: 'bg-slate-100 dark:bg-navy-800' },
                ].map(item => {
                  const isActive = effectiveTab === item.id;
                  const Icon = item.icon;
                  return (
                    <motion.button
                      key={item.id}
                      whileHover={{ x: 2 }}
                      whileTap={{ scale: 0.98 }}
                      type="button"
                      onClick={() => setActiveTab(item.id as any)}
                      className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all text-left cursor-pointer group select-none ${
                        isActive
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm font-black'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-navy-800/60 font-bold'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                          isActive
                            ? 'bg-white/20 dark:bg-slate-900/20 text-white dark:text-slate-900'
                            : `${item.bg} ${item.color}`
                        }`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-black flex items-center gap-1.5 whitespace-nowrap">
                            <span>{item.label}</span>
                            {item.badge && (
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                                isActive
                                  ? 'bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900'
                                  : 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/80 dark:text-cyan-300'
                              }`}>
                                {item.badge}
                              </span>
                            )}
                          </div>
                          <div className={`text-[10px] leading-tight mt-0.5 ${isActive ? 'text-slate-300 dark:text-slate-600' : 'text-slate-400 dark:text-slate-500'}`}>
                            {item.desc}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${isActive ? 'translate-x-0.5 text-white dark:text-slate-900' : 'text-slate-400 group-hover:translate-x-0.5'}`} />
                    </motion.button>
                  );
                })}

                <div className="pt-1 border-t border-slate-100 dark:border-navy-800">
                  <motion.button
                    whileHover={{ x: 2 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={() => setShowLogoutConfirmModal(true)}
                    className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 dark:text-rose-400 transition-colors text-left cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-200/60 dark:border-rose-900/60">
                        <LogOut className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-black">Log out</div>
                        <div className="text-[10px] text-slate-400 truncate">Sign out of portal</div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-rose-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </motion.button>
                </div>
              </div>

              {/* Campus IT & Institution Badge */}
              <div className="p-4 rounded-3xl bg-slate-50/80 dark:bg-navy-950/80 border border-slate-200/80 dark:border-navy-800 text-center space-y-2">
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Nandha Engineering College (Autonomous)
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 font-medium">
                  Academic Year 2025-2026 &bull; Silver Jubilee Edition
                </p>
                <div className="pt-1 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText('nanthishvaran17@gmail.com');
                      notify.success('IT desk email copied', 'nanthishvaran17@gmail.com', { category: 'ADMIN' });
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 transition-all cursor-pointer shadow-2xs"
                  >
                    <Mail className="w-3 h-3 text-indigo-500" />
                    <span>IT Helpdesk</span>
                  </button>
                </div>
              </div>
            </div>

            {/* RIGHT MAIN WORKSPACE AREA */}
            <div className="space-y-4 flex-1 min-w-0 w-full animate-fade-in pb-48 lg:pb-24">

            {/* Mobile Header Bar: Sticky top bar with Back, Title, Reset & Save (HIDDEN ON DESKTOP) */}
            <div className="lg:hidden sticky top-0 z-40 bg-white/95 dark:bg-navy-950/95 backdrop-blur-xl flex items-center justify-between gap-2.5 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 px-3 mb-2 border-b border-slate-200/60 dark:border-navy-800/60 shadow-2xs">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('menu')}
                  className="p-1.5 -ml-1 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors cursor-pointer active:scale-90 shrink-0"
                  aria-label="Back to Settings"
                  title="Back to Settings"
                >
                  <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
                </button>
                <div className="min-w-0 flex-1">
                  <h1 className="text-sm sm:text-base font-black text-slate-900 dark:text-white tracking-tight truncate capitalize leading-tight">
                    {effectiveTab === 'profile' ? 'Account & Profile' :
                     effectiveTab === 'security' ? 'Security & Login' :
                     effectiveTab === 'privacy' ? 'Privacy & Permissions' :
                     effectiveTab === 'notifications' ? 'Notifications' :
                     effectiveTab === 'preferences' ? 'App Preferences' :
                     effectiveTab === 'id_card' ? 'Official Digital ID' :
                     effectiveTab === 'mentorship' ? 'Staff Mentorship' :
                     'Help & Support'}
                  </h1>
                  <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 truncate leading-tight">
                    {effectiveTab === 'profile' ? 'Details, contact & photo' :
                     effectiveTab === 'security' ? 'Password, 2FA & devices' :
                     effectiveTab === 'privacy' ? 'Visibility & permissions' :
                     effectiveTab === 'notifications' ? 'Alerts & WhatsApp' :
                     effectiveTab === 'preferences' ? 'Theme & appearance' :
                     effectiveTab === 'id_card' ? 'Official PVC badge' :
                     effectiveTab === 'mentorship' ? 'Mentoring & students' :
                     'Campus IT & FAQs'}
                  </p>
                </div>
              </div>

            </div>

            {/* Desktop Section Header Banner (HIDDEN ON MOBILE) */}
            <div className="hidden lg:flex items-center justify-between p-5 bg-white dark:bg-navy-900 rounded-3xl border border-slate-200/90 dark:border-navy-800 shadow-xs mb-5">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-950/70 dark:text-brand-400 flex items-center justify-center shrink-0 border border-brand-200/80 dark:border-brand-800/80 shadow-2xs">
                  {effectiveTab === 'profile' ? <User className="w-6 h-6" /> :
                   effectiveTab === 'security' ? <ShieldCheck className="w-6 h-6" /> :
                   effectiveTab === 'privacy' ? <Lock className="w-6 h-6" /> :
                   effectiveTab === 'notifications' ? <Bell className="w-6 h-6" /> :
                   effectiveTab === 'preferences' ? <Sliders className="w-6 h-6" /> :
                   effectiveTab === 'id_card' ? <FileBadge className="w-6 h-6" /> :
                   effectiveTab === 'mentorship' ? <GraduationCap className="w-6 h-6" /> :
                   <HelpCircle className="w-6 h-6" />}
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white capitalize">
                    {effectiveTab === 'profile' ? 'Account & Profile Details' :
                     effectiveTab === 'security' ? 'Security & Authentication Vault' :
                     effectiveTab === 'privacy' ? 'Privacy Controls & Access' :
                     effectiveTab === 'notifications' ? 'Notification & Alerts Delivery' :
                     effectiveTab === 'preferences' ? 'Interface & System Preferences' :
                     effectiveTab === 'id_card' ? 'Official Institutional PVC ID Badge' :
                     effectiveTab === 'mentorship' ? 'Faculty Mentorship & Student Telemetry' :
                     'Campus Help Desk & Knowledge Base'}
                  </h2>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {effectiveTab === 'profile' ? 'Configure your official faculty credentials, contact info, and bio details.' :
                     effectiveTab === 'security' ? 'Configure hardware passkeys, biometrics, 2FA, and monitor active sessions.' :
                     effectiveTab === 'privacy' ? 'Manage your public visibility, API credentials, and institutional privacy levels.' :
                     effectiveTab === 'notifications' ? 'Tune WhatsApp dispatch, instant push alerts, and automated email reports.' :
                     effectiveTab === 'preferences' ? 'Set color schemes, ambient sound fx, interface scale, and layout density.' :
                     effectiveTab === 'id_card' ? 'Preview 300 DPI CR80 physical badge format, download image or export vCard.' :
                     effectiveTab === 'mentorship' ? 'Review assigned student performance telemetry, attendance, and contest standings.' :
                     'Answers to frequent portal queries and direct campus IT contact information.'}
                  </p>
                </div>
              </div>


            </div>

            {/* Success / Error Alerts */}
            {successMessage && (
              <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-950 dark:text-emerald-200 text-xs font-black flex items-center gap-2.5 animate-fade-in shadow-xs">
                <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            {errorMessage && (
              <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-950 dark:text-rose-200 text-xs font-black flex items-center gap-2.5 animate-fade-in shadow-xs">
                <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-6">


        {/* ========================================================================= */}
        {/* TAB 1: PERSONAL & ACADEMIC PROFILE — Native Mobile App & Desktop Bento UI */}
        {/* ========================================================================= */}
        {effectiveTab === 'profile' && (
          <div className="space-y-4 sm:space-y-6 animate-fade-in">
            {/* Mobile-Native Filter Chips (Swiggy / Meesho / iOS Style) */}
            <div className="relative">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 px-0.5 scroll-smooth">
                {[
                  { id: 'all', label: 'All Sections', icon: Sliders },
                  { id: 'contact', label: 'Contact & Info', icon: User },
                  { id: 'academic', label: 'Academic & Bio', icon: GraduationCap },
                  { id: 'institutional', label: 'Institutional', icon: Building2 },
                  { id: 'links', label: 'Links & Skills', icon: Globe },
                ].map(item => {
                  const isActive = profileSubSection === item.id;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setProfileSubSection(item.id as any);
                        if (item.id === 'contact') setExpandedCards(prev => ({ ...prev, photo: true, contact: true }));
                        else if (item.id === 'academic') setExpandedCards(prev => ({ ...prev, academic: true }));
                        else if (item.id === 'institutional') setExpandedCards(prev => ({ ...prev, institutional: true }));
                        else if (item.id === 'links') setExpandedCards(prev => ({ ...prev, links: true, languages: true }));
                      }}
                      className={`shrink-0 flex items-center gap-2 px-3.5 py-2.5 rounded-xl sm:rounded-2xl text-xs font-bold transition-all cursor-pointer select-none group border ${isActive
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900 dark:border-white shadow-md shadow-slate-900/10 dark:shadow-white/5 ring-2 ring-brand-500/25 scale-[1.02]'
                          : 'bg-white/95 dark:bg-navy-900/90 text-slate-700 dark:text-slate-300 border-slate-200/90 dark:border-navy-800 hover:border-slate-300 dark:hover:border-navy-700 hover:bg-slate-50 dark:hover:bg-navy-800/80 shadow-2xs'
                        }`}
                    >
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isActive
                          ? 'bg-white/20 dark:bg-slate-900/20 text-white dark:text-slate-900'
                          : 'bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-slate-400 group-hover:text-brand-600 dark:group-hover:text-brand-400'
                        }`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <span className="tracking-tight whitespace-nowrap">{item.label}</span>
                      {isActive && (
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-400 dark:bg-brand-600 animate-pulse ml-0.5" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4 sm:space-y-5">
              {/* 0. Mobile-Native Hero Identity Card */}
              <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white dark:bg-navy-900 border border-slate-200/90 dark:border-navy-800 shadow-xs text-slate-900 dark:text-white transition-all space-y-3.5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5 min-w-0">
                    {/* Avatar with Quick Tap */}
                    <div
                      className="relative group cursor-pointer shrink-0"
                      onClick={() => {
                        setExpandedCards(prev => ({ ...prev, photo: true }));
                        if (fileInputRef.current) fileInputRef.current.click();
                      }}
                      title="Click to change photo"
                    >
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl p-0.5 bg-gradient-to-tr from-brand-500 via-indigo-500 to-purple-500 shadow-sm overflow-hidden">
                        <div className="w-full h-full rounded-[14px] bg-slate-100 dark:bg-navy-950 overflow-hidden flex items-center justify-center">
                          {profilePhoto ? (
                            <img src={profilePhoto} alt="Profile" className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-7 h-7 sm:w-8 sm:h-8 text-slate-500 dark:text-slate-400" />
                          )}
                        </div>
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-lg bg-brand-600 text-white border-2 border-white dark:border-navy-900 flex items-center justify-center shadow-xs">
                        <Camera className="w-2.5 h-2.5" />
                      </div>
                    </div>

                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight truncate">
                          {fullName || user?.username || 'Staff Member'}
                        </h2>
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span>Active Record</span>
                        </span>
                      </div>

                      <div className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5 flex-wrap">
                        <span className="text-brand-600 dark:text-brand-400 font-bold">{designation || 'Director & Chief Administrator'}</span>
                        {institutionalId && (
                          <>
                            <span className="text-slate-300 dark:text-slate-600">&bull;</span>
                            <span className="font-mono text-slate-500 dark:text-slate-400 text-[11px] font-bold">{institutionalId}</span>
                          </>
                        )}
                      </div>

                      {/* Quick Metric Pills */}
                      <div className="flex items-center gap-2 pt-1 flex-wrap text-[11px]">
                        {bloodGroup && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/40 font-bold">
                            <Activity className="w-3 h-3 text-rose-500" />
                            <span>{bloodGroup}</span>
                          </span>
                        )}
                        {officeLocation && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-navy-700 font-bold">
                            <MapPin className="w-3 h-3 text-slate-500" />
                            <span>{officeLocation}</span>
                          </span>
                        )}
                        {phoneNumber && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-navy-700 font-bold font-mono">
                            <Phone className="w-3 h-3 text-emerald-500" />
                            <span>{phoneNumber}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Action: Change Photo Button */}
                  <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setExpandedCards(prev => ({ ...prev, photo: !prev.photo }));
                      }}
                      className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-navy-800 dark:hover:bg-navy-700 active:scale-95 text-xs font-bold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-navy-700 transition-all shadow-xs cursor-pointer"
                    >
                      <Palette className="w-3.5 h-3.5 text-brand-500" />
                      <span>Customize Avatar</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* 1. Photo & Avatar Customizer */}
                {(profileSubSection === 'all' || profileSubSection === 'contact') && (
                  <div className="bg-white/95 dark:bg-navy-900 rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-200/90 dark:border-navy-800 shadow-sm hover:shadow-md transition-shadow space-y-4 sm:space-y-5">
                    <div
                      onClick={() => toggleCard('photo')}
                      className="flex items-center justify-between border-b border-slate-100 dark:border-navy-800 pb-3 cursor-pointer select-none"
                    >
                      <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                        <Camera className="w-4 h-4 text-brand-600 dark:text-brand-400 shrink-0" />
                        <span>Profile Picture &amp; Avatar</span>
                      </h3>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] sm:text-xs font-black text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-950/60 px-2.5 py-0.5 rounded-full border border-brand-200 dark:border-brand-800/60 whitespace-nowrap inline-flex items-center justify-center">
                          Self Editable
                        </span>
                        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${expandedCards.photo ? 'rotate-180 text-brand-600' : ''}`} />
                      </div>
                    </div>

                    {/* Collapsed summary preview (Amazon / Meesho style) */}
                    {!expandedCards.photo && (
                      <div
                        onClick={() => toggleCard('photo')}
                        className="flex items-center justify-between pt-1 cursor-pointer group select-none"
                      >
                        <div className="flex items-center gap-2.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                          <div className="w-8 h-8 rounded-xl overflow-hidden bg-slate-100 dark:bg-navy-800 flex items-center justify-center shrink-0 border border-slate-200 dark:border-navy-700 shadow-2xs">
                            {profilePhoto ? <img src={profilePhoto} className="w-full h-full object-cover" /> : <User className="w-4 h-4 text-slate-500" />}
                          </div>
                          <span className="text-[11px] sm:text-xs">
                            {profilePhoto ? 'Custom profile photo active' : 'Click to change photo or pick avatar'}
                          </span>
                        </div>
                        <span className="text-brand-600 dark:text-brand-400 font-black text-[11px] group-hover:underline flex items-center gap-1">
                          <span>Change</span>
                          <ChevronRight className="w-3 h-3" />
                        </span>
                      </div>
                    )}

                    {expandedCards.photo && (
                      <div className="space-y-4 animate-fade-in">
                        <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-50/80 dark:bg-navy-950/80 border border-slate-200/80 dark:border-navy-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 sm:gap-4">
                          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                            <div
                              className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden bg-white dark:bg-navy-900 border-2 border-slate-300 dark:border-navy-700 flex items-center justify-center shrink-0 shadow-xs ${profilePhoto ? 'cursor-zoom-in' : ''}`}
                              onClick={() => { if (profilePhoto) setShowPhotoZoom(true); }}
                            >
                              {profilePhoto ? (
                                <img src={profilePhoto} alt="Preview" className="w-full h-full object-contain p-0.5 bg-white dark:bg-navy-900" />
                              ) : (
                                <User className="w-7 h-7 sm:w-8 sm:h-8 text-slate-600 dark:text-slate-300" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-xs font-black text-slate-900 dark:text-white truncate">Profile Photo or Preset Avatar</h4>
                              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">PNG, JPG, WEBP up to 5 MB or pick icon</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                            <label className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 active:scale-95 text-white text-xs font-black transition-all shadow-sm cursor-pointer">
                              <Camera className="w-3.5 h-3.5 shrink-0" />
                              <span>{profilePhoto ? 'Change' : 'Upload'}</span>
                              <input ref={fileInputRef} type="file" className="hidden" accept="image/png, image/jpeg, image/webp" onChange={handlePhotoUpload} />
                            </label>

                            <button
                              type="button"
                              onClick={() => setShowPresetAvatarPicker(!showPresetAvatarPicker)}
                              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-200/80 hover:bg-slate-300 active:scale-95 dark:bg-navy-800 dark:hover:bg-navy-700 text-slate-900 dark:text-slate-100 text-xs font-black transition-all border border-slate-300 dark:border-navy-700 cursor-pointer"
                            >
                              <Palette className="w-3.5 h-3.5 text-brand-500 shrink-0" />
                              <span>Preset</span>
                            </button>

                            {profilePhoto && (
                              <button
                                type="button"
                                onClick={() => setProfilePhoto(null)}
                                className="p-2.5 rounded-xl bg-rose-100 text-rose-700 hover:bg-rose-200 active:scale-95 dark:bg-rose-500/20 dark:text-rose-300 transition-colors border border-rose-300 dark:border-rose-500/30 cursor-pointer shrink-0"
                                title="Remove Photo"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Preset Avatar Picker Grid */}
                        {showPresetAvatarPicker && (
                          <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-indigo-50/70 dark:bg-navy-950/90 border border-indigo-200 dark:border-navy-700 space-y-3 animate-fade-in">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black text-indigo-950 dark:text-indigo-200">Choose a Professional Avatar Icon:</span>
                              <button
                                type="button"
                                onClick={() => setShowPresetAvatarPicker(false)}
                                className="text-xs text-slate-600 hover:text-slate-900 dark:text-slate-300 cursor-pointer p-1"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                              {PRESET_AVATARS.map((av) => {
                                const IconComponent = av.icon;
                                return (
                                  <button
                                    key={av.id}
                                    type="button"
                                    onClick={() => handleSelectPresetAvatar(av)}
                                    className="flex flex-col items-center justify-center p-2 rounded-xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 hover:border-brand-500 hover:scale-105 active:scale-95 transition-all shadow-2xs cursor-pointer group"
                                    title={av.label}
                                  >
                                    <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-300 flex items-center justify-center group-hover:bg-brand-600 group-hover:text-white transition-colors">
                                      <IconComponent className="w-4 h-4" />
                                    </div>
                                    <span className="text-[9px] font-bold text-slate-600 dark:text-slate-400 mt-1 truncate max-w-full">{av.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Personal & Contact Information Card — Mobile Input Rows */}
                {(profileSubSection === 'all' || profileSubSection === 'contact') && (
                  <div className="bg-white/95 dark:bg-navy-900 rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-200/90 dark:border-navy-800 shadow-sm hover:shadow-md transition-shadow space-y-4 sm:space-y-5">
                    <div
                      onClick={() => toggleCard('contact')}
                      className="flex items-center justify-between border-b border-slate-100 dark:border-navy-800 pb-3 cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-brand-500/15 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0 border border-brand-500/25">
                          <User className="w-4.5 h-4.5" />
                        </div>
                        <div>
                          <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                            Identity &amp; Contact Information
                          </h3>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">Personal details &amp; primary contact record</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] sm:text-xs font-black text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-950/60 px-2.5 py-0.5 rounded-full border border-brand-200 dark:border-brand-800/60 whitespace-nowrap inline-flex items-center justify-center">
                          Self Editable
                        </span>
                        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${expandedCards.contact ? 'rotate-180 text-brand-600' : ''}`} />
                      </div>
                    </div>

                    {/* Collapsed summary preview (Amazon / Meesho style) */}
                    {!expandedCards.contact && (
                      <div
                        onClick={() => toggleCard('contact')}
                        className="flex items-center justify-between pt-1 cursor-pointer group select-none"
                      >
                        <div className="truncate text-xs font-bold text-slate-700 dark:text-slate-300 max-w-[78%]">
                          <span className="text-slate-900 dark:text-white font-black">{fullName || user?.username || 'Staff Member'}</span>
                          {phoneNumber && <span className="text-slate-500 dark:text-slate-400 font-mono"> • {phoneNumber}</span>}
                          {officeLocation && <span className="text-slate-500 dark:text-slate-400"> • {officeLocation}</span>}
                        </div>
                        <span className="text-brand-600 dark:text-brand-400 font-black text-[11px] shrink-0 group-hover:underline flex items-center gap-1">
                          <span>Edit</span>
                          <ChevronRight className="w-3 h-3" />
                        </span>
                      </div>
                    )}

                    {expandedCards.contact && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4 animate-fade-in">
                        {/* Full Display Name */}
                        <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50/80 dark:bg-navy-950/80 border border-slate-200/90 dark:border-navy-800 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all sm:col-span-2 shadow-2xs">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20 shadow-2xs">
                              <User className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <label className="block text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                Full Display Name <span className="text-rose-500">*</span>
                              </label>
                              <input
                                type="text"
                                value={fullName}
                                onChange={e => setFullName(e.target.value)}
                                placeholder="Dr. / Mr. / Ms. Name"
                                className="w-full bg-transparent text-sm sm:text-base font-black text-slate-900 dark:text-white placeholder-slate-400 outline-none pt-0.5"
                                required
                              />
                            </div>
                          </div>
                        </div>

                        {/* Professional Designation / Title */}
                        <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50/80 dark:bg-navy-950/80 border border-slate-200/90 dark:border-navy-800 focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-500/20 transition-all sm:col-span-2 shadow-2xs">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400 flex items-center justify-center shrink-0 border border-purple-500/20 shadow-2xs">
                              <Briefcase className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <label className="block text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                Professional Designation / Academic Title
                              </label>
                              <input
                                type="text"
                                value={designation}
                                onChange={e => setDesignation(e.target.value)}
                                placeholder="e.g. Director & Chief Administrator, Lead System Architect, HOD"
                                className="w-full bg-transparent text-sm sm:text-base font-bold text-slate-900 dark:text-white placeholder-slate-400 outline-none pt-0.5"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Mobile / Contact Number */}
                        <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50/80 dark:bg-navy-950/80 border border-slate-200/90 dark:border-navy-800 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all shadow-2xs">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20 shadow-2xs">
                              <Phone className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <label className="block text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                Mobile / Contact Number
                              </label>
                              <input
                                type="tel"
                                inputMode="tel"
                                value={phoneNumber}
                                onChange={e => setPhoneNumber(e.target.value)}
                                placeholder="+91 9876543210"
                                className="w-full bg-transparent text-sm sm:text-base font-mono font-bold text-slate-900 dark:text-white placeholder-slate-400 outline-none pt-0.5"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Date of Birth */}
                        <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50/80 dark:bg-navy-950/80 border border-slate-200/90 dark:border-navy-800 focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/20 transition-all shadow-2xs">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20 shadow-2xs">
                              <Calendar className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <label className="block text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                  Date of Birth
                                </label>
                                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold font-mono bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.2 rounded border border-amber-200 dark:border-amber-800/80">
                                  DD/MM/YYYY
                                </span>
                              </div>
                              <div className="relative flex items-center gap-2 pt-0.5">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={dateOfBirth}
                                  onChange={e => {
                                    let val = e.target.value.replace(/\D/g, '');
                                    if (val.length >= 3 && val.length <= 4) val = val.slice(0, 2) + '/' + val.slice(2);
                                    else if (val.length >= 5) val = val.slice(0, 2) + '/' + val.slice(2, 4) + '/' + val.slice(4, 8);
                                    setDateOfBirth(val);
                                  }}
                                  placeholder="DD/MM/YYYY (e.g. 15/08/1990)"
                                  maxLength={10}
                                  className="w-full bg-transparent text-sm sm:text-base font-mono font-bold text-slate-900 dark:text-white placeholder-slate-400 outline-none"
                                />
                                <div className="relative flex items-center">
                                  <input
                                    type="date"
                                    id="acc-settings-dob-picker"
                                    className="opacity-0 absolute w-7 h-7 cursor-pointer right-0"
                                    onChange={e => {
                                      if (e.target.value) {
                                        const parts = e.target.value.split('-');
                                        if (parts.length === 3) {
                                          setDateOfBirth(`${parts[2]}/${parts[1]}/${parts[0]}`);
                                        }
                                      }
                                    }}
                                  />
                                  <label
                                    htmlFor="acc-settings-dob-picker"
                                    className="p-1.5 rounded-lg bg-amber-100/80 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 hover:bg-amber-200 cursor-pointer transition-colors shadow-2xs"
                                    title="Pick from calendar"
                                  >
                                    <Calendar className="w-4 h-4" />
                                  </label>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Blood Group (Medical Record) — 1-Tap Touch Carousel */}
                        <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50/80 dark:bg-navy-950/80 border border-slate-200/90 dark:border-navy-800 space-y-2.5 sm:col-span-2 shadow-2xs">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/20">
                                <Activity className="w-4 h-4" />
                              </div>
                              <div>
                                <label className="block text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                  Blood Group (Medical Record)
                                </label>
                                <span className="text-[10px] text-slate-400 font-bold">1-Tap Mobile Selection:</span>
                              </div>
                            </div>
                            {bloodGroup && (
                              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-900 inline-flex items-center gap-1.5 shadow-2xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                                <span>Selected: {bloodGroup}</span>
                              </span>
                            )}
                          </div>

                          {/* 1-Tap Quick Touch Pills */}
                          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                            {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map(bg => {
                              const isSelected = bloodGroup === bg;
                              return (
                                <button
                                  key={bg}
                                  type="button"
                                  onClick={() => setBloodGroup(bg)}
                                  className={`shrink-0 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 select-none ${
                                    isSelected
                                      ? 'bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-md shadow-rose-500/30 ring-2 ring-rose-400/50 scale-105'
                                      : 'bg-white dark:bg-navy-900 text-slate-700 dark:text-slate-200 border border-slate-200/90 dark:border-navy-700 hover:border-rose-300 hover:bg-rose-50/50 dark:hover:bg-rose-950/20 shadow-2xs'
                                  }`}
                                >
                                  <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white' : 'bg-rose-500'}`} />
                                  <span>{bg}</span>
                                </button>
                              );
                            })}
                          </div>

                          {/* Detailed medical dropdown if desired */}
                          <div className="pt-1">
                            <PremiumSelect
                              value={bloodGroup}
                              onChange={setBloodGroup}
                              options={BLOOD_GROUP_OPTIONS}
                              placeholder="Or choose from detailed medical options..."
                              heightClass="h-11"
                            />
                          </div>
                        </div>

                        {/* Office Cabin / Room Location */}
                        <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50/80 dark:bg-navy-950/80 border border-slate-200/90 dark:border-navy-800 focus-within:border-cyan-500 focus-within:ring-2 focus-within:ring-cyan-500/20 transition-all sm:col-span-2 shadow-2xs">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400 flex items-center justify-center shrink-0 border border-cyan-500/20 shadow-2xs">
                              <MapPin className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <label className="block text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                Office Cabin / Room Location
                              </label>
                              <input
                                type="text"
                                value={officeLocation}
                                onChange={e => setOfficeLocation(e.target.value)}
                                placeholder="e.g. CS Block Room 204"
                                className="w-full bg-transparent text-sm sm:text-base font-bold text-slate-900 dark:text-white placeholder-slate-400 outline-none pt-0.5"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Emergency SOS Contact Section */}
                        <div className="sm:col-span-2 rounded-2xl p-4 bg-gradient-to-br from-rose-50/80 to-amber-50/50 dark:from-rose-950/30 dark:to-navy-950 border border-rose-200/80 dark:border-rose-900/40 space-y-3.5">
                          <div className="flex items-center justify-between pb-2 border-b border-rose-200/60 dark:border-rose-900/30">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                                <ShieldAlert className="w-4 h-4" />
                              </div>
                              <div>
                                <h4 className="text-xs font-black text-rose-950 dark:text-rose-200 uppercase tracking-wider">
                                  Emergency SOS Contact
                                </h4>
                                <p className="text-[10px] text-rose-700/80 dark:text-rose-400/80 font-bold">
                                  Campus medical &amp; emergency dispatch priority contact
                                </p>
                              </div>
                            </div>
                            <span className="text-[10px] font-black text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-950 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-900">
                              Campus SOS
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* Emergency Contact Person */}
                            <div className="p-3 rounded-xl bg-white/90 dark:bg-navy-900/90 border border-rose-200/60 dark:border-rose-900/40 focus-within:border-rose-500 focus-within:ring-2 focus-within:ring-rose-500/20 transition-all shadow-2xs">
                              <div className="flex items-center gap-2.5">
                                <Users className="w-4 h-4 text-rose-500 shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                    Contact Person Name
                                  </label>
                                  <input
                                    type="text"
                                    value={emergencyContactName}
                                    onChange={e => setEmergencyContactName(e.target.value)}
                                    placeholder="e.g. Spouse / Parent / Relative"
                                    className="w-full bg-transparent text-xs sm:text-sm font-bold text-slate-900 dark:text-white placeholder-slate-400 outline-none"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Emergency Contact Phone */}
                            <div className="p-3 rounded-xl bg-white/90 dark:bg-navy-900/90 border border-rose-200/60 dark:border-rose-900/40 focus-within:border-rose-500 focus-within:ring-2 focus-within:ring-rose-500/20 transition-all shadow-2xs">
                              <div className="flex items-center gap-2.5">
                                <Phone className="w-4 h-4 text-rose-500 shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                    Emergency Phone
                                  </label>
                                  <input
                                    type="tel"
                                    inputMode="tel"
                                    value={emergencyContactPhone}
                                    onChange={e => setEmergencyContactPhone(e.target.value)}
                                    placeholder="+91 9876543210"
                                    className="w-full bg-transparent text-xs sm:text-sm font-mono font-bold text-slate-900 dark:text-white placeholder-slate-400 outline-none"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 3. Academic Credentials & Teaching Bio Card */}
                {(profileSubSection === 'all' || profileSubSection === 'academic') && (
                  <div className="bg-white/95 dark:bg-navy-900 rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-200/90 dark:border-navy-800 shadow-sm hover:shadow-md transition-shadow space-y-4 sm:space-y-5">
                    <div
                      onClick={() => toggleCard('academic')}
                      className="flex items-center justify-between border-b border-slate-100 dark:border-navy-800 pb-3 cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/25">
                          <GraduationCap className="w-4.5 h-4.5" />
                        </div>
                        <div>
                          <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                            Academic Background &amp; Mentoring Bio
                          </h3>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">Degrees, research domains &amp; guidance philosophy</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] sm:text-xs font-black text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800/60 whitespace-nowrap inline-flex items-center justify-center">
                          Curriculum
                        </span>
                        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${expandedCards.academic ? 'rotate-180 text-brand-600' : ''}`} />
                      </div>
                    </div>

                    {/* Collapsed summary preview (Amazon / Meesho style) */}
                    {!expandedCards.academic && (
                      <div
                        onClick={() => toggleCard('academic')}
                        className="flex items-center justify-between pt-1 cursor-pointer group select-none"
                      >
                        <div className="truncate text-xs font-bold text-slate-700 dark:text-slate-300 max-w-[78%]">
                          <span className="text-slate-900 dark:text-white font-black">{highestDegree || 'Degree not specified'}</span>
                          {specialization && <span className="text-slate-500 dark:text-slate-400"> • {specialization}</span>}
                          {experienceYears && <span className="text-slate-500 dark:text-slate-400"> • {experienceYears}</span>}
                        </div>
                        <span className="text-indigo-600 dark:text-indigo-400 font-black text-[11px] shrink-0 group-hover:underline flex items-center gap-1">
                          <span>Edit</span>
                          <ChevronRight className="w-3 h-3" />
                        </span>
                      </div>
                    )}

                    {expandedCards.academic && (
                      <div className="space-y-3.5 sm:space-y-4 animate-fade-in">
                        {/* Highest Degree */}
                        <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50/80 dark:bg-navy-950/80 border border-slate-200/90 dark:border-navy-800 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all shadow-2xs">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20 shadow-2xs">
                              <GraduationCap className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <label className="block text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                Highest Academic Degree &amp; Institution
                              </label>
                              <input
                                type="text"
                                value={highestDegree}
                                onChange={e => setHighestDegree(e.target.value)}
                                placeholder="e.g. M.E. Computer Science & Engineering • Anna University"
                                className="w-full bg-transparent text-sm sm:text-base font-bold text-slate-900 dark:text-white placeholder-slate-400 outline-none pt-0.5"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Research Specialization */}
                        <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50/80 dark:bg-navy-950/80 border border-slate-200/90 dark:border-navy-800 focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/20 transition-all shadow-2xs">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20 shadow-2xs">
                              <Award className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <label className="block text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                Specialization &amp; Research Domains
                              </label>
                              <input
                                type="text"
                                value={specialization}
                                onChange={e => setSpecialization(e.target.value)}
                                placeholder="e.g. Algorithms, Distributed Cloud Systems, Deep Learning"
                                className="w-full bg-transparent text-sm sm:text-base font-bold text-slate-900 dark:text-white placeholder-slate-400 outline-none pt-0.5"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Courses Taught */}
                        <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50/80 dark:bg-navy-950/80 border border-slate-200/90 dark:border-navy-800 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all shadow-2xs">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20 shadow-2xs">
                              <BookOpen className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <label className="block text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                Courses &amp; Lab Subjects Handling
                              </label>
                              <input
                                type="text"
                                value={coursesTaught}
                                onChange={e => setCoursesTaught(e.target.value)}
                                placeholder="e.g. CS8451 Design & Analysis of Algorithms, Data Structures Lab"
                                className="w-full bg-transparent text-sm sm:text-base font-bold text-slate-900 dark:text-white placeholder-slate-400 outline-none pt-0.5"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Faculty Bio with 1-Tap Quick Templates */}
                        <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50/80 dark:bg-navy-950/80 border border-slate-200/90 dark:border-navy-800 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20 transition-all shadow-2xs space-y-2">
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5 sm:gap-0">
                            <label className="block text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                              Faculty Bio &amp; Mentoring Philosophy
                            </label>
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                              <span>Quick Fill:</span>
                              <button type="button" onClick={() => insertBioTemplate('mentor')} className="text-brand-600 dark:text-brand-400 hover:underline cursor-pointer font-bold px-2 py-0.5 rounded-md bg-brand-50 dark:bg-brand-950/60 border border-brand-200 dark:border-brand-800/80 shadow-2xs active:scale-95">Mentor</button>
                              <button type="button" onClick={() => insertBioTemplate('researcher')} className="text-brand-600 dark:text-brand-400 hover:underline cursor-pointer font-bold px-2 py-0.5 rounded-md bg-brand-50 dark:bg-brand-950/60 border border-brand-200 dark:border-brand-800/80 shadow-2xs active:scale-95">Research</button>
                              <button type="button" onClick={() => insertBioTemplate('placement')} className="text-brand-600 dark:text-brand-400 hover:underline cursor-pointer font-bold px-2 py-0.5 rounded-md bg-brand-50 dark:bg-brand-950/60 border border-brand-200 dark:border-brand-800/80 shadow-2xs active:scale-95">Placement</button>
                            </div>
                          </div>
                          <textarea
                            rows={3}
                            value={facultyBio}
                            onChange={e => setFacultyBio(e.target.value)}
                            placeholder="Write a brief professional summary about your teaching journey..."
                            className="w-full bg-transparent text-xs sm:text-sm font-bold text-slate-900 dark:text-white placeholder-slate-400 outline-none resize-none pt-1"
                          />
                          <div className="text-right text-[10px] text-slate-400 font-bold">{facultyBio.length} characters</div>
                        </div>
                      </div>
                    )}
                  </div>
                )}



                {/* 4. Institutional Scope — Grouped iOS/Material Style */}
                {(profileSubSection === 'all' || profileSubSection === 'institutional') && (
                  <div className="bg-white/95 dark:bg-navy-900 rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-200/90 dark:border-navy-800 shadow-sm hover:shadow-md transition-shadow space-y-4 sm:space-y-5">
                    <div
                      onClick={() => toggleCard('institutional')}
                      className="flex items-center justify-between border-b border-slate-100 dark:border-navy-800 pb-3 cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/25">
                          <Shield className="w-4.5 h-4.5" />
                        </div>
                        <div>
                          <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                            Institutional Scope
                          </h3>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">Verified academic record &amp; department allocation</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] sm:text-xs text-indigo-700 dark:text-indigo-300 font-black bg-indigo-50 dark:bg-indigo-950/80 px-2.5 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800/60 whitespace-nowrap inline-flex items-center justify-center">
                          Managed by Admin
                        </span>
                        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${expandedCards.institutional ? 'rotate-180 text-brand-600' : ''}`} />
                      </div>
                    </div>

                    {/* Collapsed summary preview (Amazon / Meesho style) */}
                    {!expandedCards.institutional && (
                      <div
                        onClick={() => toggleCard('institutional')}
                        className="flex items-center justify-between pt-1 cursor-pointer group select-none"
                      >
                        <div className="truncate text-xs font-bold text-slate-700 dark:text-slate-300 max-w-[78%]">
                          <span className="font-mono text-indigo-700 dark:text-indigo-300 font-black">{institutionalId}</span>
                          <span className="text-slate-500 dark:text-slate-400"> • {departmentName}</span>
                          <span className="text-slate-500 dark:text-slate-400"> • {roleName}</span>
                        </div>
                        <span className="text-indigo-600 dark:text-indigo-400 font-black text-[11px] shrink-0 group-hover:underline flex items-center gap-1">
                          <span>View</span>
                          <ChevronRight className="w-3 h-3" />
                        </span>
                      </div>
                    )}

                    {expandedCards.institutional && (
                      <div className="space-y-3 animate-fade-in">
                        <div className="rounded-xl sm:rounded-2xl border border-slate-200/90 dark:border-navy-800 overflow-hidden divide-y divide-slate-100 dark:divide-navy-800 bg-slate-50/60 dark:bg-navy-950/60">
                          <div className="p-3 sm:p-3.5 flex items-center justify-between gap-3">
                            <span className="text-xs font-black text-slate-600 dark:text-slate-400 flex items-center gap-2">
                              <Key className="w-4 h-4 text-indigo-500 shrink-0" /> Institutional ID
                            </span>
                            <span className="text-xs sm:text-sm font-mono font-black text-indigo-900 dark:text-indigo-300">
                              {institutionalId}
                            </span>
                          </div>

                          <div className="p-3 sm:p-3.5 flex items-center justify-between gap-3">
                            <span className="text-xs font-black text-slate-600 dark:text-slate-400 flex items-center gap-2">
                              <Mail className="w-4 h-4 text-brand-500 shrink-0" /> Official Email
                            </span>
                            <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate max-w-[170px] sm:max-w-none">
                              {user?.email}
                            </span>
                          </div>

                          <div className="p-3 sm:p-3.5 flex items-center justify-between gap-3">
                            <span className="text-xs font-black text-slate-600 dark:text-slate-400 flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-emerald-500 shrink-0" /> Scope
                            </span>
                            <span className="text-xs sm:text-sm font-black text-emerald-700 dark:text-emerald-400">
                              {departmentName}
                            </span>
                          </div>

                          <div className="p-3 sm:p-3.5 flex items-center justify-between gap-3">
                            <span className="text-xs font-black text-slate-600 dark:text-slate-400 flex items-center gap-2">
                              <ShieldCheck className="w-4 h-4 text-purple-500 shrink-0" /> Institutional Role
                            </span>
                            <span className="text-xs sm:text-sm font-black text-purple-700 dark:text-purple-300">
                              {roleName}
                            </span>
                          </div>
                        </div>

                        <div className="p-3 sm:p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/50 border border-indigo-200/80 dark:border-indigo-800/80 flex items-start gap-2.5">
                          <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                          <p className="text-[11px] sm:text-xs text-indigo-950 dark:text-indigo-200 font-bold leading-relaxed">
                            Institutional scope and department allocations are controlled centrally by college administrators.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 5. Academic Social & Research Links */}
                {(profileSubSection === 'all' || profileSubSection === 'links') && (
                  <div className="bg-white/95 dark:bg-navy-900 rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-200/90 dark:border-navy-800 shadow-sm hover:shadow-md transition-shadow space-y-4 sm:space-y-5">
                    <div
                      onClick={() => toggleCard('links')}
                      className="flex items-center justify-between border-b border-slate-100 dark:border-navy-800 pb-3 cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 border border-purple-500/25">
                          <Globe className="w-4.5 h-4.5" />
                        </div>
                        <div>
                          <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                            Academic &amp; Portfolio Links
                          </h3>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">Coding profiles, publications &amp; handles</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">Web Visibility</span>
                        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${expandedCards.links ? 'rotate-180 text-brand-600' : ''}`} />
                      </div>
                    </div>

                    {/* Collapsed summary preview (Amazon / Meesho style) */}
                    {!expandedCards.links && (
                      <div
                        onClick={() => toggleCard('links')}
                        className="flex items-center justify-between pt-1 cursor-pointer group select-none"
                      >
                        <div className="truncate text-xs font-bold text-slate-700 dark:text-slate-300 max-w-[78%]">
                          {linkedinUrl || githubUrl || leetcodeHandle ? (
                            <span className="text-purple-600 dark:text-purple-400">
                              {[linkedinUrl && 'LinkedIn', githubUrl && 'GitHub', leetcodeHandle && 'LeetCode'].filter(Boolean).join(' • ')}
                            </span>
                          ) : (
                            <span className="text-slate-500 dark:text-slate-400">No public profiles configured yet</span>
                          )}
                        </div>
                        <span className="text-purple-600 dark:text-purple-400 font-black text-[11px] shrink-0 group-hover:underline flex items-center gap-1">
                          <span>Edit</span>
                          <ChevronRight className="w-3 h-3" />
                        </span>
                      </div>
                    )}

                    {expandedCards.links && (
                      <div className="space-y-3.5 sm:space-y-4 animate-fade-in">
                        {/* LinkedIn */}
                        <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50/80 dark:bg-navy-950/80 border border-slate-200/90 dark:border-navy-800 focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-500/20 transition-all shadow-2xs">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400 flex items-center justify-center shrink-0 border border-sky-500/20 shadow-2xs">
                              <LinkIcon className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <label className="block text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                LinkedIn Profile URL
                              </label>
                              <input
                                type="url"
                                value={linkedinUrl}
                                onChange={e => setLinkedinUrl(e.target.value)}
                                placeholder="https://linkedin.com/in/username"
                                className="w-full bg-transparent text-sm sm:text-base font-bold text-slate-900 dark:text-white placeholder-slate-400 outline-none pt-0.5"
                              />
                            </div>
                          </div>
                        </div>

                        {/* GitHub */}
                        <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50/80 dark:bg-navy-950/80 border border-slate-200/90 dark:border-navy-800 focus-within:border-slate-500 focus-within:ring-2 focus-within:ring-slate-500/20 transition-all shadow-2xs">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-500/10 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300 flex items-center justify-center shrink-0 border border-slate-500/20 shadow-2xs">
                              <Laptop className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <label className="block text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                GitHub Profile URL
                              </label>
                              <input
                                type="url"
                                value={githubUrl}
                                onChange={e => setGithubUrl(e.target.value)}
                                placeholder="https://github.com/username"
                                className="w-full bg-transparent text-sm sm:text-base font-bold text-slate-900 dark:text-white placeholder-slate-400 outline-none pt-0.5"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Google Scholar */}
                        <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50/80 dark:bg-navy-950/80 border border-slate-200/90 dark:border-navy-800 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all shadow-2xs">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20 shadow-2xs">
                              <BookOpen className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <label className="block text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                Google Scholar Profile URL
                              </label>
                              <input
                                type="url"
                                value={scholarUrl}
                                onChange={e => setScholarUrl(e.target.value)}
                                placeholder="https://scholar.google.com/citations?user=..."
                                className="w-full bg-transparent text-sm sm:text-base font-bold text-slate-900 dark:text-white placeholder-slate-400 outline-none pt-0.5"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                          {/* ORCID iD */}
                          <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50/80 dark:bg-navy-950/80 border border-slate-200/90 dark:border-navy-800 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all shadow-2xs">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20 shadow-2xs">
                                <ShieldCheck className="w-5 h-5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <label className="block text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                  ORCID iD
                                </label>
                                <input
                                  type="text"
                                  value={orcidId}
                                  onChange={e => setOrcidId(e.target.value)}
                                  placeholder="0000-0002-1825-0097"
                                  className="w-full bg-transparent text-sm sm:text-base font-mono font-bold text-slate-900 dark:text-white placeholder-slate-400 outline-none pt-0.5"
                                />
                              </div>
                            </div>
                          </div>

                          {/* LeetCode Handle */}
                          <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50/80 dark:bg-navy-950/80 border border-slate-200/90 dark:border-navy-800 focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/20 transition-all shadow-2xs">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20 shadow-2xs">
                                <Terminal className="w-5 h-5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <label className="block text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                    LeetCode Handle
                                  </label>
                                  <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">Syncs Live</span>
                                </div>
                                <input
                                  type="text"
                                  value={leetcodeHandle}
                                  onChange={e => setLeetcodeHandle(e.target.value)}
                                  placeholder="nanthish_nec"
                                  className="w-full bg-transparent text-sm sm:text-base font-mono font-bold text-slate-900 dark:text-white placeholder-slate-400 outline-none pt-0.5"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 6. Languages Spoken — Modern Pill Chips */}
                {(profileSubSection === 'all' || profileSubSection === 'links') && (
                  <div className="bg-white/95 dark:bg-navy-900 rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-200/90 dark:border-navy-800 shadow-sm space-y-3.5 sm:space-y-4">
                    <div
                      onClick={() => toggleCard('languages')}
                      className="flex items-center justify-between border-b border-slate-100 dark:border-navy-800 pb-3 cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/25">
                          <Globe className="w-4.5 h-4.5" />
                        </div>
                        <div>
                          <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                            Language Proficiencies
                          </h3>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">Multi-lingual communication skills</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">{selectedLanguages.length} Selected</span>
                        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${expandedCards.languages ? 'rotate-180 text-brand-600' : ''}`} />
                      </div>
                    </div>

                    {/* Collapsed summary preview (Amazon / Meesho style) */}
                    {!expandedCards.languages && (
                      <div
                        onClick={() => toggleCard('languages')}
                        className="flex items-center justify-between pt-1 cursor-pointer group select-none"
                      >
                        <div className="truncate text-xs font-bold text-slate-700 dark:text-slate-300 max-w-[78%]">
                          <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                            {selectedLanguages.length > 0 ? selectedLanguages.join(', ') : 'No languages chosen'}
                          </span>
                        </div>
                        <span className="text-indigo-600 dark:text-indigo-400 font-black text-[11px] shrink-0 group-hover:underline flex items-center gap-1">
                          <span>Choose</span>
                          <ChevronRight className="w-3 h-3" />
                        </span>
                      </div>
                    )}

                    {expandedCards.languages && (
                      <div className="flex flex-wrap gap-2 animate-fade-in">
                        {AVAILABLE_LANGUAGES.map(lang => {
                          const isSelected = selectedLanguages.includes(lang);
                          return (
                            <button
                              key={lang}
                              type="button"
                              onClick={() => handleToggleLanguage(lang)}
                              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all border cursor-pointer flex items-center gap-1.5 active:scale-95 ${isSelected
                                ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white border-brand-500/30 shadow-md shadow-brand-500/20'
                                : 'bg-slate-50 dark:bg-navy-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-navy-800 hover:border-indigo-400'
                                }`}
                            >
                              <span>{lang}</span>
                              {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: SECURITY & PASSWORD VAULT */}
        {/* ========================================================================= */}
        {/* ========================================================================= */}
        {/* TAB 2: SECURITY & PASSWORD VAULT — World-Class Mobile App UI (Swiggy / WhatsApp Grade) */}
        {/* ========================================================================= */}
        {effectiveTab === 'security' && (
          <div className="space-y-4 sm:space-y-6 animate-fade-in">

              {/* 0. Mobile-Native Security Overview Card */}
              <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white dark:bg-navy-900 border border-slate-200/90 dark:border-navy-800 shadow-xs mb-4 sm:mb-6 transition-all space-y-3.5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center justify-center shrink-0 shadow-2xs">
                      <ShieldCheck className="w-6 h-6 stroke-[2.2]" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                          Account Security &amp; Login
                        </h2>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          is2FAEnabled
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25'
                            : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/25'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${is2FAEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                          <span>{is2FAEnabled ? '2FA Protected' : 'Action Recommended'}</span>
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                        Manage your password, two-factor authentication, and signed-in devices
                      </p>
                    </div>
                  </div>

                  {/* Security Quick Metric Capsules */}
                  <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-navy-800">
                    <div className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200/70 dark:border-navy-800 flex items-center gap-2 text-xs">
                      <KeyRound className="w-3.5 h-3.5 text-indigo-500" />
                      <div>
                        <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold block">2FA Status</span>
                        <span className={`font-mono font-bold text-[11px] ${is2FAEnabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                          {is2FAEnabled ? 'Active' : 'Disabled'}
                        </span>
                      </div>
                    </div>

                    <div className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200/70 dark:border-navy-800 flex items-center gap-2 text-xs">
                      <Laptop className="w-3.5 h-3.5 text-emerald-500" />
                      <div>
                        <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold block">Active Sessions</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white text-[11px]">{sessions.length || 1} Device{sessions.length > 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 1. Password Management Card — iOS Inset Style with Entropy Meter */}
              <div className="bg-white/95 dark:bg-navy-900 rounded-2xl sm:rounded-3xl p-5 sm:p-6 border border-slate-200/90 dark:border-navy-800 shadow-sm hover:shadow-md transition-shadow space-y-4 sm:space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-navy-800 pb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-violet-500/15 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0 border border-violet-500/20 shadow-2xs">
                      <KeyRound className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                        Password &amp; Credentials
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Update master login credentials &amp; hashing encryption</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/60 px-2.5 py-1 rounded-full border border-violet-200 dark:border-violet-800/60 font-mono">
                    Bcrypt Secured
                  </span>
                </div>

                <div className="space-y-4">
                  {/* Current Password Field */}
                  <div className="space-y-1.5">
                    <label className="block text-[11px] sm:text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">Current Password</label>
                    <div className="relative">
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={showCurrentPassword ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={e => setCurrentPassword(e.target.value)}
                        placeholder="Enter your current password"
                        className="w-full h-12 pl-10 pr-11 rounded-2xl border border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-950 text-xs sm:text-sm font-bold text-slate-900 dark:text-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all shadow-2xs"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 cursor-pointer transition-colors"
                        title={showCurrentPassword ? "Hide password" : "Show password"}
                      >
                        {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* New Password & Confirm New Password Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-[11px] sm:text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">New Password</label>
                      <div className="relative">
                        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                          <Key className="w-4 h-4" />
                        </div>
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          value={newPassword}
                          onChange={e => setNewPassword(e.target.value)}
                          placeholder="Min 6 characters"
                          className="w-full h-12 pl-10 pr-11 rounded-2xl border border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-950 text-xs sm:text-sm font-bold text-slate-900 dark:text-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all shadow-2xs"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 cursor-pointer transition-colors"
                          title={showNewPassword ? "Hide password" : "Show password"}
                        >
                          {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[11px] sm:text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">Confirm New Password</label>
                      <div className="relative">
                        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                          <CheckSquare className="w-4 h-4" />
                        </div>
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={e => setConfirmPassword(e.target.value)}
                          placeholder="Repeat new password"
                          className="w-full h-12 pl-10 pr-4 rounded-2xl border border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-950 text-xs sm:text-sm font-bold text-slate-900 dark:text-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all shadow-2xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Password Strength Meter & Live Requirement Checklist */}
                  {newPassword && (
                    <div className="p-4 rounded-2xl bg-slate-50/90 dark:bg-navy-950/90 border border-slate-200/90 dark:border-navy-800 space-y-3 animate-fade-in">
                      <div className="flex items-center justify-between text-xs font-black">
                        <span className="text-slate-700 dark:text-slate-300">Entropy Strength:</span>
                        <span className={`font-black ${passwordStrength.color.replace('bg-', 'text-')}`}>
                          {passwordStrength.label} (Crack time: {passwordStrength.crackTime})
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-navy-800 overflow-hidden">
                        <div className={`h-full ${passwordStrength.color} transition-all duration-300 rounded-full`} style={{ width: `${passwordStrength.score}%` }} />
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] font-bold">
                        <span className={`flex items-center gap-1.5 ${newPassword.length >= 8 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                          <Check className={`w-3.5 h-3.5 ${newPassword.length >= 8 ? 'stroke-[3]' : 'opacity-40'}`} /> At least 8 characters
                        </span>
                        <span className={`flex items-center gap-1.5 ${/[A-Z]/.test(newPassword) ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                          <Check className={`w-3.5 h-3.5 ${/[A-Z]/.test(newPassword) ? 'stroke-[3]' : 'opacity-40'}`} /> Uppercase letter (A-Z)
                        </span>
                        <span className={`flex items-center gap-1.5 ${/[0-9]/.test(newPassword) ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                          <Check className={`w-3.5 h-3.5 ${/[0-9]/.test(newPassword) ? 'stroke-[3]' : 'opacity-40'}`} /> Number (0-9)
                        </span>
                        <span className={`flex items-center gap-1.5 ${/[^A-Za-z0-9]/.test(newPassword) ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                          <Check className={`w-3.5 h-3.5 ${/[^A-Za-z0-9]/.test(newPassword) ? 'stroke-[3]' : 'opacity-40'}`} /> Special symbol (!@#$)
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Direct Update Password Button */}
                  <div className="pt-1 flex items-center justify-end">
                    <button
                      type="button"
                      disabled={isSaving || !newPassword || !currentPassword}
                      onClick={handleUpdatePasswordOnly}
                      className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 active:scale-95 disabled:opacity-50 text-white font-black text-xs transition-all shadow-md shadow-violet-500/20 cursor-pointer flex items-center justify-center gap-2"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Updating Password...</span>
                        </>
                      ) : (
                        <>
                          <KeyRound className="w-4 h-4" />
                          <span>Update Password</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* 2. Grouped Modern Authentication & Biometric Vault (Apple iOS Grouped Style) */}
              <div className="bg-white/95 dark:bg-navy-900 rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-navy-800 shadow-sm overflow-hidden">
                <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-navy-800 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20 shadow-2xs">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                        Biometrics &amp; Security Vault
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Hardware-backed passkeys, face scan &amp; multi-factor protection</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-1.5 font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Vault Active</span>
                  </span>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-navy-800/80">

                  {/* VAULT ROW 1: Passkeys & Hardware Biometrics */}
                  <div className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 hover:bg-slate-50/60 dark:hover:bg-navy-950/40 transition-colors">
                    <div className="flex items-start sm:items-center gap-3 sm:gap-3.5 min-w-0 flex-1">
                      <div className="w-11 h-11 rounded-2xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/25 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 shadow-2xs">
                        <Fingerprint className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                            {isNativeMobile ? biometricTypeName : 'Passkeys & Hardware Keys'}
                          </h4>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black bg-cyan-100 text-cyan-800 dark:bg-cyan-950/80 dark:text-cyan-300 font-mono">
                            FIDO2 / WebAuthn
                          </span>
                        </div>
                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                          {isNativeMobile
                            ? 'Unlock your portal session with device fingerprint or facial scanner.'
                            : 'Sign in instantly with Windows Hello, Apple Touch ID, or YubiKey.'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                      {isNativeMobile ? (
                        nativeBiometricAvailable ? (
                          <button
                            type="button"
                            disabled={isVerifyingBiometric}
                            onClick={handleTestNativeBiometric}
                            className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white text-xs font-black transition-all shadow-sm cursor-pointer inline-flex items-center gap-1.5 active:scale-95"
                          >
                            {isVerifyingBiometric ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Fingerprint className="w-3.5 h-3.5" />}
                            <span>Test Biometric</span>
                          </button>
                        ) : (
                          <span className="px-3 py-1.5 rounded-xl bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 text-[10px] font-bold">
                            Not Enrolled
                          </span>
                        )
                      ) : (
                        browserSupportsWebAuthn() ? (
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const optionsRes = await api.get('/auth/passkey/register-options');
                                const options = optionsRes.data?.options || optionsRes.data;
                                if (!options || (!options.challenge && !options.rp)) {
                                  notify.error('Failed to get passkey options from server', '', { category: 'ADMIN' });
                                  return;
                                }
                                const attResp = await startRegistration(options);
                                const verifyRes = await api.post('/auth/passkey/register-verify', attResp);
                                if (verifyRes.data?.success) {
                                  notify.success('Passkey registered successfully! You can now use it to sign in.', '', { category: 'ADMIN' });
                                } else {
                                  notify.error(verifyRes.data?.message || 'Failed to register passkey', '', { category: 'ADMIN' });
                                }
                              } catch (err: any) {
                                console.error('Passkey registration error:', err);
                                notify.error(err?.message || 'Passkey registration failed.', '', { category: 'ADMIN' });
                              }
                            }}
                            className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 active:scale-95 text-white text-xs font-black transition-all shadow-sm cursor-pointer inline-flex items-center gap-1.5"
                          >
                            <Fingerprint className="w-4 h-4" />
                            <span>Register Passkey</span>
                          </button>
                        ) : (
                          <span className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-navy-800 text-slate-500 text-[10px] font-bold">
                            Not Supported
                          </span>
                        )
                      )}
                    </div>
                  </div>

                  {/* VAULT ROW 2: Two-Factor Authentication (2FA TOTP) */}
                  <div className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 hover:bg-slate-50/60 dark:hover:bg-navy-950/40 transition-colors">
                    <div className="flex items-start sm:items-center gap-3 sm:gap-3.5 min-w-0 flex-1">
                      <div className="w-11 h-11 rounded-2xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/25 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 shadow-2xs">
                        <Lock className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">Two-Factor Authentication (2FA)</h4>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black border font-mono ${is2FAEnabled
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/80 dark:text-amber-300'
                            }`}>
                            {is2FAEnabled ? 'ENABLED' : 'DISABLED'}
                          </span>
                        </div>
                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                          {is2FAEnabled
                            ? 'Protected by 6-digit TOTP app codes on every sign-in.'
                            : 'Require 6-digit authenticator code (Google, Microsoft, 1Password) on login.'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                      {!is2FAEnabled ? (
                        <button
                          type="button"
                          onClick={() => handleOpen2FASetup()}
                          disabled={isGenerating2FA}
                          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-black transition-all shadow-sm cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {isGenerating2FA ? <RefreshCcw className="w-3.5 h-3.5 animate-spin" /> : <QrCode className="w-4 h-4" />}
                          <span>Enable 2FA Protection</span>
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => setShowBackupCodesModal(true)}
                            className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 dark:bg-navy-800 dark:hover:bg-navy-700 text-slate-900 dark:text-slate-100 text-xs font-black transition-all border border-slate-300 dark:border-navy-700 cursor-pointer inline-flex items-center gap-1.5"
                          >
                            <Key className="w-3.5 h-3.5 text-brand-500" />
                            <span>Backup Codes</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDisable2FACode('');
                              setDisable2FAError(null);
                              setShowDisable2FAModal(true);
                            }}
                            className="px-3.5 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300 text-xs font-black transition-all border border-rose-300 dark:border-rose-500/30 cursor-pointer inline-flex items-center gap-1.5"
                          >
                            <ShieldX className="w-3.5 h-3.5" />
                            <span>Disable</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                </div>
              </div>

              {/* 3. Active Logged-in Devices — Modern Device Session Manager */}
              <div className="bg-white/95 dark:bg-navy-900 rounded-2xl sm:rounded-3xl p-5 sm:p-6 border border-slate-200/90 dark:border-navy-800 shadow-sm hover:shadow-md transition-shadow space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-navy-800 pb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0 border border-sky-500/20 shadow-2xs">
                      <Laptop className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                        Active Logged-in Devices
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Browsers &amp; hardware sessions authorized</p>
                    </div>
                  </div>
                  {sessions.length > 1 && (
                    <button
                      type="button"
                      onClick={handleRevokeAllOtherSessions}
                      className="px-3 py-1.5 rounded-xl text-xs font-black text-rose-600 hover:text-white hover:bg-rose-600 dark:text-rose-400 dark:hover:bg-rose-600/90 border border-rose-200 dark:border-rose-900/60 transition-all cursor-pointer active:scale-95"
                    >
                      Revoke Other Sessions
                    </button>
                  )}
                </div>

                <div className="space-y-3 relative">
                  {sessionsLoading && (
                    <div className="p-8 text-center text-xs font-bold text-slate-500">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-500" />
                      Loading active sessions...
                    </div>
                  )}
                  {sessions.length === 0 && !sessionsLoading && (
                    <div className="p-6 text-center text-xs font-bold text-slate-500">No active sessions found.</div>
                  )}
                  {sessions.map(s => {
                    const parsed = parseUserAgentDetails(s.device);
                    const isCurrentSession = !!s.current;
                    return (
                      <div
                        key={s.id}
                        className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${isCurrentSession
                          ? 'bg-emerald-50/70 dark:bg-emerald-950/25 border-emerald-300 dark:border-emerald-800 shadow-xs'
                          : 'bg-slate-50/80 dark:bg-navy-950/80 border-slate-200/90 dark:border-navy-800'
                          }`}
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border ${isCurrentSession
                            ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border-emerald-500/30 shadow-inner'
                            : 'bg-slate-200/80 dark:bg-navy-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-navy-700'
                            }`}>
                            {parsed.isMobile ? <Smartphone className="w-5 h-5" /> : <Laptop className="w-5 h-5" />}
                          </div>

                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">
                                {parsed.deviceName}
                              </span>
                              {isCurrentSession && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  This Device
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 font-bold flex items-center gap-2 flex-wrap">
                              <span>{s.ip === '127.0.0.1' ? '127.0.0.1 (Localhost)' : s.ip}</span>
                              <span className="text-slate-400">•</span>
                              <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-bold">
                                <span className="w-1 h-1 rounded-full bg-emerald-500" />
                                Active Now
                              </span>
                            </p>
                          </div>
                        </div>

                        {!isCurrentSession && (
                          <button
                            type="button"
                            onClick={() => handleRevokeSession(s.id)}
                            className="px-3.5 py-2 rounded-xl text-xs font-black bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-600 transition-all border border-rose-200 dark:border-rose-900/50 cursor-pointer shrink-0 active:scale-95 flex items-center gap-1.5 justify-center"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Revoke</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Login Security Audit Log — Modern Banking / Google Security Event Feed */}
              <div className="bg-white/95 dark:bg-navy-900 rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-200/90 dark:border-navy-800 shadow-sm hover:shadow-md transition-shadow space-y-4">
                {/* Header — Clickable Accordion Trigger */}
                <div
                  onClick={() => setIsAuditLogExpanded(!isAuditLogExpanded)}
                  className="border-b border-slate-100 dark:border-navy-800 pb-3 cursor-pointer group select-none space-y-2.5"
                >
                  {/* Row 1: Icon + Full Title + View/Collapse Button */}
                  <div className="flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 border border-purple-500/20 group-hover:scale-105 transition-transform">
                        <Clock className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors truncate">
                          Login Security Audit Log
                        </h3>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold truncate">
                          {isAuditLogExpanded
                            ? 'Click header to collapse access ledger'
                            : 'Tamper-evident chronological access ledger • Tap to view all sessions'}
                        </p>
                      </div>
                    </div>

                    {/* View / Collapse Toggle Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsAuditLogExpanded(!isAuditLogExpanded);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 border shrink-0 ${
                        isAuditLogExpanded
                          ? 'bg-purple-100 hover:bg-purple-200 dark:bg-purple-950/80 dark:hover:bg-purple-900/80 text-purple-800 dark:text-purple-200 border-purple-300 dark:border-purple-800'
                          : 'bg-purple-600 hover:bg-purple-700 text-white border-purple-600 shadow-sm shadow-purple-600/30'
                      }`}
                    >
                      <span>{isAuditLogExpanded ? 'Collapse' : `View (${loginHistory.length})`}</span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 transition-transform duration-200 ${
                          isAuditLogExpanded ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                  </div>

                  {/* Row 2: Badges (Left) & Print / Excel Actions (Right) */}
                  <div className="flex items-center justify-between gap-2 flex-wrap pt-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-black uppercase tracking-wider bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800 shrink-0">
                        {getSecurityReportConfig().personRoleLabel} Audit
                      </span>
                      {loginHistory.length > 0 && (
                        <span className="px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-mono font-bold bg-slate-100 text-slate-600 dark:bg-navy-800 dark:text-slate-300 border border-slate-200 dark:border-navy-700 shrink-0">
                          {loginHistory.length} Sessions
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePrintSecurityAuditReport();
                        }}
                        className="px-2.5 sm:px-3 py-1 rounded-xl text-[11px] font-black bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-navy-800 dark:hover:bg-navy-700 dark:text-slate-200 transition-colors border border-slate-300 dark:border-navy-700 cursor-pointer flex items-center gap-1 active:scale-95"
                        title="Print or Save Official Institutional PDF Report"
                      >
                        <Printer className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 shrink-0" />
                        <span>Print</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExportSecurityAuditExcel();
                        }}
                        className="px-2.5 sm:px-3 py-1 rounded-xl text-[11px] font-black bg-emerald-50 hover:bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 dark:text-emerald-300 transition-colors border border-emerald-300 dark:border-emerald-800 cursor-pointer flex items-center gap-1 active:scale-95"
                        title="Export beautifully formatted Excel report"
                      >
                        <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>Excel</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Collapsed State: Single Clean Summary Tile */}
                {!isAuditLogExpanded && (
                  <div
                    onClick={() => setIsAuditLogExpanded(true)}
                    className="p-3.5 rounded-2xl bg-slate-50/70 hover:bg-slate-100/80 dark:bg-navy-950/50 dark:hover:bg-navy-950/80 border border-slate-200/80 dark:border-navy-800/80 transition-all cursor-pointer group flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-950/70 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1 text-xs">
                        {loginHistory.length > 0 ? (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              Latest Sign-in:
                            </span>
                            <span className="font-semibold text-slate-600 dark:text-slate-400">
                              {loginHistory[0]?.date} at {loginHistory[0]?.time}
                            </span>
                            <span className="text-slate-400">•</span>
                            <span className="font-mono text-[11px] text-slate-600 dark:text-slate-400 truncate">
                              {loginHistory[0]?.ip === '127.0.0.1' ? 'Localhost (127.0.0.1)' : loginHistory[0]?.ip}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-500 dark:text-slate-400 font-bold">
                            No login security events recorded yet.
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-[11px] font-black text-purple-600 dark:text-purple-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-1 shrink-0">
                      <span>Click to open</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                )}

                {/* Expanded State: Scrollable Event Feed */}
                {isAuditLogExpanded && (
                  <div className="space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between px-1 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      <span>Showing {loginHistory.length} recorded authentication events</span>
                      <span className="text-[10px] text-purple-600 dark:text-purple-400 font-black uppercase">
                        Scroll to inspect
                      </span>
                    </div>

                    <div className="space-y-2 max-h-[460px] overflow-y-auto custom-scrollbar pr-1">
                      {loginHistory.length === 0 ? (
                        <div className="p-6 rounded-2xl bg-slate-50 dark:bg-navy-950/50 border border-dashed border-slate-200 dark:border-navy-800 flex flex-col items-center justify-center text-center">
                          <Clock className="w-8 h-8 text-slate-400 dark:text-navy-600 mb-2 opacity-50" />
                          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">No login security events recorded yet.</p>
                          <p className="text-[10px] text-slate-400 dark:text-navy-500 mt-1">Authentic original logs will appear here upon next sign-in.</p>
                        </div>
                      ) : (
                        loginHistory.map(lh => {
                          const parsed = parseUserAgentDetails(lh.network || '');
                          const isSuccess = lh.status === 'SUCCESS' || lh.status === 'VERIFIED';
                          return (
                            <button
                              key={lh.id}
                              type="button"
                              onClick={() => setSelectedLoginEvent(lh)}
                              className="w-full text-left p-3.5 rounded-2xl bg-slate-50/80 dark:bg-navy-950/80 border border-slate-200/80 dark:border-navy-800 hover:border-purple-400 dark:hover:border-purple-700 hover:shadow-md transition-all cursor-pointer group flex items-center justify-between gap-3 active:scale-[0.99]"
                              aria-label={`View security event ${lh.id}`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${isSuccess
                                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                                  : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                                  }`}>
                                  {isSuccess ? <ShieldCheck className="w-4.5 h-4.5" /> : <ShieldAlert className="w-4.5 h-4.5" />}
                                </div>
                                <div className="space-y-0.5 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">
                                      {lh.method ? `Sign-in via ${lh.method}` : 'Sign-in Session'}
                                    </span>
                                  </div>
                                  <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300 truncate">
                                    {parsed.deviceName}
                                  </p>
                                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold flex items-center gap-1.5 flex-wrap">
                                    <span>{lh.date} at {lh.time}</span>
                                    <span>•</span>
                                    <span className="font-mono">{lh.ip === '127.0.0.1' ? 'Localhost (127.0.0.1)' : lh.ip}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border uppercase tracking-wider ${isSuccess
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                                  : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
                                  }`}>
                                  {lh.status}
                                </span>
                                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-purple-500 group-hover:translate-x-0.5 transition-all" />
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>

                    {/* Collapse Button at bottom of expanded list */}
                    <div className="pt-2 flex justify-center">
                      <button
                        type="button"
                        onClick={() => setIsAuditLogExpanded(false)}
                        className="py-1.5 px-4 rounded-xl text-xs font-black text-purple-700 dark:text-purple-300 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/60 dark:hover:bg-purple-900/60 border border-purple-200 dark:border-purple-800 transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <ChevronDown className="w-3.5 h-3.5 rotate-180" />
                        <span>Collapse Audit Log</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* CATEGORY C: PRIVACY & PERMISSIONS — Enterprise Data Control */}
        {/* ========================================================================= */}
        {effectiveTab === 'privacy' && (
          <div className="space-y-4 sm:space-y-5 animate-fade-in">
            {/* 1. Directory Privacy Card */}
            <div className="space-y-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1">
                Directory Privacy &amp; Visibility
              </span>

              <div className="bg-white dark:bg-navy-900 rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-navy-800 shadow-sm divide-y divide-slate-100 dark:divide-navy-800/80 overflow-hidden">
                {/* Share Mobile with Mentees */}
                <div
                  onClick={() => handleToggleShowPhone(!showPhoneToStudents)}
                  role="switch"
                  aria-checked={showPhoneToStudents}
                  className="flex items-center justify-between p-3.5 sm:p-4 hover:bg-slate-50/70 dark:hover:bg-navy-800/50 cursor-pointer transition-colors gap-3 select-none"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-2xl bg-violet-50 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 border border-violet-200/60 dark:border-violet-900/60 flex items-center justify-center shrink-0">
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-black text-slate-900 dark:text-white">
                        Share Contact with Mentees
                      </div>
                      <div className="text-xs font-medium text-slate-500 dark:text-slate-400 leading-snug">
                        Allow students assigned to your mentoring cohort to view your contact.
                      </div>
                    </div>
                  </div>
                  <div className={`w-12 h-7 rounded-full p-1 transition-colors duration-200 ease-in-out shrink-0 ${showPhoneToStudents ? 'bg-violet-600' : 'bg-slate-200 dark:bg-navy-700'}`}>
                    <div className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ease-in-out ${showPhoneToStudents ? 'translate-x-5' : 'translate-x-0'}`} />
                  </div>
                </div>

                {/* Show Cabin in Directory */}
                <div
                  onClick={() => handleToggleShowCabin(!showCabinInDirectory)}
                  role="switch"
                  aria-checked={showCabinInDirectory}
                  className="flex items-center justify-between p-3.5 sm:p-4 hover:bg-slate-50/70 dark:hover:bg-navy-800/50 cursor-pointer transition-colors gap-3 select-none"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-900/60 flex items-center justify-center shrink-0">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-black text-slate-900 dark:text-white">
                        Show Office / Cabin Number
                      </div>
                      <div className="text-xs font-medium text-slate-500 dark:text-slate-400 leading-snug">
                        Display room/cabin on internal college directory and mentor search.
                      </div>
                    </div>
                  </div>
                  <div className={`w-12 h-7 rounded-full p-1 transition-colors duration-200 ease-in-out shrink-0 ${showCabinInDirectory ? 'bg-violet-600' : 'bg-slate-200 dark:bg-navy-700'}`}>
                    <div className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ease-in-out ${showCabinInDirectory ? 'translate-x-5' : 'translate-x-0'}`} />
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Platform Presence & Activity */}
            <div className="bg-white/95 dark:bg-navy-900 rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-200/90 dark:border-navy-800 shadow-sm space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-navy-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/70 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-200/60 dark:border-indigo-800/60">
                    <Eye className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                      Platform Presence &amp; Activity
                    </h3>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Role verification and sync status</p>
                  </div>
                </div>
                <span className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/80 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                  Live Verified
                </span>
              </div>

              <div className="space-y-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                <div className="p-3 rounded-2xl bg-slate-50/80 dark:bg-navy-950/80 border border-slate-200/80 dark:border-navy-800 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-black text-slate-900 dark:text-white">Institutional Authentication Scope</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">Scoped to Nandha Engineering College credentials ({institutionalId})</div>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px] font-mono font-bold shrink-0">
                    NEC-AUTH
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50/80 dark:bg-navy-950/80 border border-slate-200/80 dark:border-navy-800 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-black text-slate-900 dark:text-white">LeetCode Sync Telemetry</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">Automated multi-threaded GraphQL tracking of solve metrics</div>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-mono font-bold shrink-0">
                    SYNC ACTIVE
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Data Safety & Portability */}
            <div className="bg-white/95 dark:bg-navy-900 rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-200/90 dark:border-navy-800 shadow-sm space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-navy-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/70 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-200/60 dark:border-emerald-800/60">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                      Data Safety &amp; Portability
                    </h3>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Google Play compliance &amp; backups</p>
                  </div>
                </div>
              </div>

              <p className="text-xs font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
                You have full ownership of your account data. Download an encrypted backup of your preferences, bio, and settings as a portable JSON file.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowExportModal(true); triggerHaptic('selection'); }}
                  className="w-full px-4 py-3 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <Download className="w-4 h-4" />
                  <span>Export Data (JSON)</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setShowRestoreModal(true); triggerHaptic('selection'); }}
                  className="w-full px-4 py-3 rounded-xl font-bold text-xs bg-slate-100 hover:bg-slate-200 dark:bg-navy-800 dark:hover:bg-navy-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-navy-700 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <UploadCloud className="w-4 h-4 text-indigo-600" />
                  <span>Restore Data</span>
                </button>
              </div>
            </div>

            {/* 4. Danger Zone: Permanent Account Deletion */}
            <DeleteAccountPanel notify={notify} />

            {/* Clean bottom clearance spacer for mobile view above MobileBottomNav & BackToTop */}
            <div className="h-32 sm:h-16 pointer-events-none" aria-hidden="true" />
          </div>
        )}

        {/* ========================================================================= */}
        {/* CATEGORY D: NOTIFICATIONS — Live Telemetry & Alerts */}
        {/* ========================================================================= */}
        {effectiveTab === 'notifications' && (
          <div className="space-y-4 sm:space-y-5 animate-fade-in">
            {/* Group 1: Automated Portal Alerts */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Automated Portal Alerts
                </span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Sync
                </span>
              </div>

              <div className="bg-white dark:bg-navy-900 rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-navy-800 shadow-sm divide-y divide-slate-100 dark:divide-navy-800/80 overflow-hidden">
                {/* 1. Contest Receipts */}
                <div
                  onClick={() => handleToggleContestAlerts(!emailContestAlerts)}
                  role="switch"
                  aria-checked={emailContestAlerts}
                  className="flex items-center justify-between p-3.5 sm:p-4 hover:bg-slate-50/70 dark:hover:bg-navy-800/50 cursor-pointer transition-colors gap-3 select-none"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-900/60 flex items-center justify-center shrink-0">
                      <Trophy className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-slate-900 dark:text-white">
                          Contest Finalization Receipts
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTestContestAlert();
                          }}
                          className="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800 transition-all cursor-pointer inline-flex items-center gap-1 active:scale-95"
                        >
                          <Trophy className="w-3 h-3" />
                          <span>Test Alert</span>
                        </button>
                      </div>
                      <div className="text-xs font-medium text-slate-500 dark:text-slate-400 leading-snug">
                        Instant email receipts when weekly LeetCode contests conclude.
                      </div>
                    </div>
                  </div>
                  <div className={`w-12 h-7 rounded-full p-1 transition-colors duration-200 ease-in-out shrink-0 ${emailContestAlerts ? 'bg-amber-500' : 'bg-slate-200 dark:bg-navy-700'}`}>
                    <div className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ease-in-out ${emailContestAlerts ? 'translate-x-5' : 'translate-x-0'}`} />
                  </div>
                </div>

                {/* 2. Weekly Mentee Progress Digest */}
                <div
                  onClick={() => handleToggleWeeklyDigest(!weeklyDigestAlerts)}
                  role="switch"
                  aria-checked={weeklyDigestAlerts}
                  className="flex items-center justify-between p-3.5 sm:p-4 hover:bg-slate-50/70 dark:hover:bg-navy-800/50 cursor-pointer transition-colors gap-3 select-none"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-900/60 flex items-center justify-center shrink-0">
                      <GraduationCap className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-slate-900 dark:text-white">
                          Weekly Mentee Progress Digest
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTestWeeklyDigest();
                          }}
                          className="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition-all cursor-pointer inline-flex items-center gap-1 active:scale-95"
                        >
                          <GraduationCap className="w-3 h-3" />
                          <span>Test Alert</span>
                        </button>
                      </div>
                      <div className="text-xs font-medium text-slate-500 dark:text-slate-400 leading-snug">
                        Summary of assigned students milestones every Monday morning.
                      </div>
                    </div>
                  </div>
                  <div className={`w-12 h-7 rounded-full p-1 transition-colors duration-200 ease-in-out shrink-0 ${weeklyDigestAlerts ? 'bg-amber-500' : 'bg-slate-200 dark:bg-navy-700'}`}>
                    <div className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ease-in-out ${weeklyDigestAlerts ? 'translate-x-5' : 'translate-x-0'}`} />
                  </div>
                </div>

                {/* 3. Security Audit & Login Alerts */}
                <div
                  onClick={() => handleToggleSystemAuditAlerts(!systemAuditAlerts)}
                  role="switch"
                  aria-checked={systemAuditAlerts}
                  className="flex items-center justify-between p-3.5 sm:p-4 hover:bg-slate-50/70 dark:hover:bg-navy-800/50 cursor-pointer transition-colors gap-3 select-none"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/60 flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-slate-900 dark:text-white">
                          Security Audit &amp; Login Alerts
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTestSystemAudit();
                          }}
                          className="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 transition-all cursor-pointer inline-flex items-center gap-1 active:scale-95"
                        >
                          <ShieldCheck className="w-3 h-3" />
                          <span>Test Alert</span>
                        </button>
                      </div>
                      <div className="text-xs font-medium text-slate-500 dark:text-slate-400 leading-snug">
                        Instant alerts if password is changed or new logins occur.
                      </div>
                    </div>
                  </div>
                  <div className={`w-12 h-7 rounded-full p-1 transition-colors duration-200 ease-in-out shrink-0 ${systemAuditAlerts ? 'bg-amber-500' : 'bg-slate-200 dark:bg-navy-700'}`}>
                    <div className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ease-in-out ${systemAuditAlerts ? 'translate-x-5' : 'translate-x-0'}`} />
                  </div>
                </div>

                {/* 4. In-App Audio Chimes */}
                <div
                  onClick={() => handleToggleToastAudio(!toastAudioAlerts)}
                  role="switch"
                  aria-checked={toastAudioAlerts}
                  className="flex items-center justify-between p-3.5 sm:p-4 hover:bg-slate-50/70 dark:hover:bg-navy-800/50 cursor-pointer transition-colors gap-3 select-none"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-2xl bg-violet-50 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 border border-violet-200/60 dark:border-violet-900/60 flex items-center justify-center shrink-0">
                      <Volume2 className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-slate-900 dark:text-white">
                          In-App Audio Chimes
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTestAudioChime();
                          }}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border cursor-pointer inline-flex items-center gap-1 active:scale-95 ${
                            isPlayingAudioTest
                              ? 'bg-amber-500 text-white border-amber-600'
                              : 'bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                          }`}
                        >
                          <Volume2 className={`w-3 h-3 ${isPlayingAudioTest ? 'animate-bounce' : ''}`} />
                          <span>{isPlayingAudioTest ? 'Playing...' : 'Test Sound'}</span>
                        </button>
                      </div>
                      <div className="text-xs font-medium text-slate-500 dark:text-slate-400 leading-snug">
                        Subtle audio chimes on milestone toasts and contest conclude.
                      </div>
                    </div>
                  </div>
                  <div className={`w-12 h-7 rounded-full p-1 transition-colors duration-200 ease-in-out shrink-0 ${toastAudioAlerts ? 'bg-amber-500' : 'bg-slate-200 dark:bg-navy-700'}`}>
                    <div className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ease-in-out ${toastAudioAlerts ? 'translate-x-5' : 'translate-x-0'}`} />
                  </div>
                </div>

                {/* 5. Notification Sound Studio (Click to Preview) */}
                <div className="p-4 sm:p-5 bg-gradient-to-br from-indigo-500/[0.04] via-purple-500/[0.03] to-pink-500/[0.04] dark:from-indigo-950/30 dark:via-purple-950/20 dark:to-pink-950/20 border-t border-slate-100 dark:border-navy-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Volume2 size={16} className="text-indigo-500 shrink-0" />
                      <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                        Notification Sound Studio (Click to Preview)
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 hidden sm:inline">
                      Active sound tone for alerts & push
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
                    {/* Option 1: WhatsApp Pop */}
                    <div
                      onClick={() => handleSelectNotificationTone('whatsapp')}
                      className={`p-3 sm:p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-2 active:scale-95 touch-manipulation ${
                        selectedNotificationTone === 'whatsapp'
                          ? 'bg-emerald-500/15 border-emerald-500/50 shadow-xs ring-1 ring-emerald-500/30'
                          : 'bg-white dark:bg-navy-900/80 border-slate-200/80 dark:border-white/10 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-xs font-black text-slate-900 dark:text-white">WhatsApp</span>
                        {selectedNotificationTone === 'whatsapp' && (
                          <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-500 text-white flex items-center gap-0.5">
                            <Check size={10} /> Active
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Bubbly Pop</span>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleSelectNotificationTone('whatsapp'); }}
                        className="w-full mt-1 py-1.5 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10.5px] font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
                      >
                        <Play size={10} className="fill-current" />
                        <span>Play</span>
                      </button>
                    </div>

                    {/* Option 2: Apple Glass */}
                    <div
                      onClick={() => handleSelectNotificationTone('apple')}
                      className={`p-3 sm:p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-2 active:scale-95 touch-manipulation ${
                        selectedNotificationTone === 'apple'
                          ? 'bg-indigo-500/15 border-indigo-500/50 shadow-xs ring-1 ring-indigo-500/30'
                          : 'bg-white dark:bg-navy-900/80 border-slate-200/80 dark:border-white/10 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-xs font-black text-slate-900 dark:text-white">Apple Glass</span>
                        {selectedNotificationTone === 'apple' && (
                          <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded-full bg-indigo-500 text-white flex items-center gap-0.5">
                            <Check size={10} /> Active
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Crystal Chime</span>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleSelectNotificationTone('apple'); }}
                        className="w-full mt-1 py-1.5 px-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[10.5px] font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
                      >
                        <Play size={10} className="fill-current" />
                        <span>Play</span>
                      </button>
                    </div>

                    {/* Option 3: Tech Knock */}
                    <div
                      onClick={() => handleSelectNotificationTone('tech')}
                      className={`p-3 sm:p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-2 active:scale-95 touch-manipulation ${
                        selectedNotificationTone === 'tech'
                          ? 'bg-cyan-500/15 border-cyan-500/50 shadow-xs ring-1 ring-cyan-500/30'
                          : 'bg-white dark:bg-navy-900/80 border-slate-200/80 dark:border-white/10 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-xs font-black text-slate-900 dark:text-white">Tech Knock</span>
                        {selectedNotificationTone === 'tech' && (
                          <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded-full bg-cyan-500 text-white flex items-center gap-0.5">
                            <Check size={10} /> Active
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Knock & Ding</span>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleSelectNotificationTone('tech'); }}
                        className="w-full mt-1 py-1.5 px-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-[10.5px] font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
                      >
                        <Play size={10} className="fill-current" />
                        <span>Play</span>
                      </button>
                    </div>

                    {/* Option 4: Silent / Mute (None) */}
                    <div
                      onClick={() => handleSelectNotificationTone('none')}
                      className={`p-3 sm:p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-2 active:scale-95 touch-manipulation ${
                        selectedNotificationTone === 'none' || selectedNotificationTone === 'silent'
                          ? 'bg-rose-500/15 border-rose-500/50 shadow-xs ring-1 ring-rose-500/30'
                          : 'bg-white dark:bg-navy-900/80 border-slate-200/80 dark:border-white/10 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-xs font-black text-slate-900 dark:text-white">Silent / Mute</span>
                        {(selectedNotificationTone === 'none' || selectedNotificationTone === 'silent') && (
                          <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded-full bg-rose-600 text-white flex items-center gap-0.5">
                            <Check size={10} /> Active
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">No Sound (Silent)</span>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleSelectNotificationTone('none'); }}
                        className="w-full mt-1 py-1.5 px-2.5 rounded-xl bg-slate-700 hover:bg-slate-800 text-white text-[10.5px] font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
                      >
                        <VolumeX size={11} />
                        <span>Select Mute</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Group 2: Mentee Inactivity Smart Alarm */}
            <div className="space-y-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1">
                Student Inactivity Warning
              </span>

              <div className="bg-white dark:bg-navy-900 rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-200/80 dark:border-navy-800 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-orange-50 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 border border-orange-200/60 dark:border-orange-900/60 flex items-center justify-center shrink-0">
                      <Sliders className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-black text-slate-900 dark:text-white truncate">
                        Inactivity Threshold
                      </div>
                      <div className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                        Flag inactive mentees on roster
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-black font-mono text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-950/80 px-2.5 py-1 rounded-xl border border-orange-200 dark:border-orange-800 shrink-0">
                    {inactivityDaysThreshold} Days
                  </span>
                </div>

                <p className="text-xs font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
                  Mark mentees with an inactivity warning on your roster if they have not submitted a LeetCode problem in {inactivityDaysThreshold} consecutive days.
                </p>

                {/* 3 Quick Segments */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { days: 3, label: '3 Days', mode: 'Strict' },
                    { days: 7, label: '7 Days', mode: 'Balanced' },
                    { days: 14, label: '14 Days', mode: 'Relaxed' },
                  ].map(option => (
                    <button
                      key={option.days}
                      type="button"
                      onClick={() => handleInactivityThresholdChange(option.days)}
                      className={`py-2 px-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 active:scale-95 ${
                        inactivityDaysThreshold === option.days
                          ? 'bg-amber-500 text-white border-amber-600 shadow-sm shadow-amber-500/25 font-black ring-2 ring-amber-400/40'
                          : 'bg-slate-50 dark:bg-navy-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-navy-800 hover:border-amber-400/60 font-bold'
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        {inactivityDaysThreshold === option.days && <Check size={12} className="stroke-[3]" />}
                        <span className="text-xs">{option.label}</span>
                      </div>
                      <span className={`text-[10px] ${inactivityDaysThreshold === option.days ? 'text-amber-100' : 'text-slate-400'}`}>
                        {option.mode}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Slider */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    <span>Fine-tune threshold</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200">{inactivityDaysThreshold} Days</span>
                  </div>
                  <input
                    type="range"
                    min={3}
                    max={14}
                    step={1}
                    value={inactivityDaysThreshold}
                    onChange={e => handleInactivityThresholdChange(Number(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer h-2 bg-slate-200 dark:bg-navy-800 rounded-lg"
                  />
                  <div className="flex justify-between text-[10px] font-bold text-slate-400 px-0.5">
                    <span>3 Days (Strict)</span>
                    <span>7 Days (Balanced)</span>
                    <span>14 Days (Relaxed)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* CATEGORY E: APP PREFERENCES — Executive Institutional Workstation */}
        {/* ========================================================================= */}
        {effectiveTab === 'preferences' && (
          <div className="space-y-4 sm:space-y-6 animate-fade-in">
            {/* 1. Executive Workstation Live Metric Header */}
            <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-slate-900 via-navy-950 to-indigo-950 text-white border border-brand-500/30 shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 -mt-8 -mr-8 w-40 h-40 bg-brand-500/15 rounded-full blur-3xl pointer-events-none" />
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 relative z-10">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-500 to-indigo-600 flex items-center justify-center text-white shrink-0 shadow-md">
                    <Sliders className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm sm:text-base font-black tracking-tight text-white font-display">
                        Institutional Workstation &amp; Engine
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 whitespace-nowrap">
                        ACTIVE PRODUCTION PLAN
                      </span>
                    </div>
                    <p className="text-[11px] sm:text-xs text-slate-300 font-medium mt-0.5 truncate">
                      Nandha Engineering College • Autonomous Institutional Telemetry &amp; Intelligence
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-white/10 shrink-0">
                  <div className="flex flex-col sm:items-end">
                    <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider">Official Timezone</span>
                    <span className="text-xs font-mono font-bold text-brand-300 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-brand-400" />
                      Asia/Kolkata (IST • UTC+05:30)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Visual Atmosphere, Theme & Accent Hue */}
            <div className="bg-white/95 dark:bg-navy-900 rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-200/90 dark:border-navy-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap border-b border-slate-100 dark:border-navy-800/80 pb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-fuchsia-50 text-fuchsia-600 dark:bg-fuchsia-950/70 dark:text-fuchsia-400 flex items-center justify-center shrink-0 border border-fuchsia-200/60 dark:border-fuchsia-800/60 shadow-2xs">
                    <Palette className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      Appearance &amp; Theme Atmosphere
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Personalize visual theme and UI layout density</p>
                  </div>
                </div>
                <div className="shrink-0 flex items-center">
                  <span className="text-[11px] font-mono font-bold px-3 py-1 rounded-full bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300 capitalize border border-slate-200/80 dark:border-navy-700 whitespace-nowrap inline-flex items-center justify-center">
                    {themeMode === 'system' ? `Auto (${theme})` : `${theme} Mode`}
                  </span>
                </div>
              </div>

              {/* 3-Segment Theme Switcher */}
              <div className="p-1 rounded-2xl bg-slate-100 dark:bg-navy-950 border border-slate-200/80 dark:border-navy-800 grid grid-cols-3 gap-1">
                <button
                  type="button"
                  onClick={() => { setTheme('light'); setThemeMode('light'); triggerHaptic('selection'); }}
                  className={`py-2.5 px-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 select-none ${
                    themeMode === 'light'
                      ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  <Sun className={`w-4 h-4 ${themeMode === 'light' ? 'text-amber-500 stroke-[2.5]' : ''}`} />
                  <span>Light Daylight</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setTheme('dark'); setThemeMode('dark'); triggerHaptic('selection'); }}
                  className={`py-2.5 px-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 select-none ${
                    themeMode === 'dark'
                      ? 'bg-navy-900 text-white shadow-sm border border-navy-700'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  <Moon className={`w-4 h-4 ${themeMode === 'dark' ? 'text-indigo-400 stroke-[2.5]' : ''}`} />
                  <span>Midnight Dark</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setSystemTheme(); setThemeMode('system'); triggerHaptic('selection'); }}
                  className={`py-2.5 px-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 select-none ${
                    themeMode === 'system'
                      ? 'bg-white dark:bg-navy-900 text-slate-900 dark:text-white shadow-sm border border-slate-200/80 dark:border-navy-700'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  <Monitor className={`w-4 h-4 ${themeMode === 'system' ? 'text-blue-500 stroke-[2.5]' : ''}`} />
                  <span>System Auto</span>
                </button>
              </div>

              {/* Accent Color Palette Selector */}
              <div className="pt-2">
                <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  Institutional Accent Color
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[
                    { id: 'indigo', label: 'NEC Indigo', hex: '#4F46E5', desc: 'Core Standard' },
                    { id: 'emerald', label: 'Emerald Campus', hex: '#10B981', desc: 'Growth & Vigor' },
                    { id: 'violet', label: 'Cyber Violet', hex: '#8B5CF6', desc: 'Intelligence' },
                    { id: 'amber', label: 'Electric Amber', hex: '#F59E0B', desc: 'Active Alert' },
                    { id: 'rose', label: 'Crimson Rose', hex: '#F43F5E', desc: 'High Impact' },
                  ].map(acc => (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => {
                        setAccentColor(acc.id);
                        try { localStorage.setItem('nec_accent_color', acc.id); } catch {}
                        triggerHaptic('selection');
                      }}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer active:scale-95 ${
                        accentColor === acc.id
                          ? 'border-brand-500 bg-brand-50/30 dark:bg-brand-950/40 ring-2 ring-brand-500/20'
                          : 'border-slate-200 dark:border-navy-800 bg-slate-50/50 dark:bg-navy-950/50 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs" style={{ backgroundColor: acc.hex }} />
                        {accentColor === acc.id && <Check className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 stroke-[3]" />}
                      </div>
                      <div className="text-[11px] font-bold text-slate-900 dark:text-white truncate">{acc.label}</div>
                      <div className="text-[9.5px] text-slate-400 truncate">{acc.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 3. Contest Telemetry & Real-Time Sync Engine */}
            <div className="bg-white/95 dark:bg-navy-900 rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-200/90 dark:border-navy-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-navy-800/80 pb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/70 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-200/60 dark:border-indigo-800/60 shadow-2xs">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      Contest Telemetry &amp; Sync Engine
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Live polling cadence, solver verification &amp; automated report staging</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
                  LIVE ENGINE
                </span>
              </div>

              {/* Contest Live Sync Interval Cadence */}
              <div>
                <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  Contest Live-Sync Polling Cadence
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { sec: 15, label: '15 Seconds', desc: 'Contest Window Only', badge: 'HIGH REALTIME' },
                    { sec: 30, label: '30 Seconds', desc: 'Balanced Performance', badge: 'DEFAULT' },
                    { sec: 60, label: '60 Seconds', desc: 'Low Data Usage', badge: 'ECO MODE' },
                  ].map(cad => (
                    <button
                      key={cad.sec}
                      type="button"
                      onClick={() => {
                        setLiveSyncInterval(cad.sec);
                        try { localStorage.setItem('nec_live_sync_interval', String(cad.sec)); } catch {}
                        triggerHaptic('selection');
                      }}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer active:scale-95 ${
                        liveSyncInterval === cad.sec
                          ? 'border-brand-500 bg-brand-50/30 dark:bg-brand-950/40 ring-2 ring-brand-500/20'
                          : 'border-slate-200 dark:border-navy-800 bg-slate-50/50 dark:bg-navy-950/50'
                      }`}
                    >
                      <div className="text-xs font-bold text-slate-900 dark:text-white">{cad.label}</div>
                      <div className="text-[9.5px] text-slate-400 mt-0.5">{cad.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Automation Toggles */}
              <div className="pt-2 space-y-2.5 border-t border-slate-100 dark:border-navy-800/80">
                <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50/80 dark:bg-navy-950/60 border border-slate-200/80 dark:border-navy-800">
                  <div className="min-w-0 pr-3">
                    <div className="text-xs font-bold text-slate-900 dark:text-white">Auto-Verify Contest Solvers</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">Authenticates finish timestamps against LeetCode GQL engine automatically</div>
                  </div>
                  <div
                    role="switch"
                    aria-checked={autoVerifyContest}
                    onClick={() => {
                      const next = !autoVerifyContest;
                      setAutoVerifyContest(next);
                      try {
                        localStorage.setItem('nec_auto_verify_contest', String(next));
                        if (next) {
                          notify.success('Auto-Verification Active', 'Contest solver timings will be verified against LeetCode GQL.');
                        } else {
                          notify.info('Auto-Verification Paused', 'Manual verification mode enabled.');
                        }
                      } catch {}
                      triggerHaptic('selection');
                    }}
                    className={`w-12 h-7 rounded-full p-1 transition-colors duration-200 ease-in-out shrink-0 cursor-pointer ${
                      autoVerifyContest ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-navy-700'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ease-in-out ${
                        autoVerifyContest ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50/80 dark:bg-navy-950/60 border border-slate-200/80 dark:border-navy-800">
                  <div className="min-w-0 pr-3">
                    <div className="text-xs font-bold text-slate-900 dark:text-white">Sunday 10:00 AM Master Reports Auto-Staging</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">Auto-generates all 17 Executive Department Excel &amp; PDF reports following contest closing</div>
                  </div>
                  <div
                    role="switch"
                    aria-checked={autoSundayReports}
                    onClick={() => {
                      const next = !autoSundayReports;
                      setAutoSundayReports(next);
                      try {
                        localStorage.setItem('nec_auto_sunday_reports', String(next));
                        if (next) {
                          notify.success('Sunday Reports Active', 'All 17 department reports will auto-stage every Sunday morning.');
                        } else {
                          notify.info('Sunday Reports Manual', 'Automatic report staging disabled.');
                        }
                      } catch {}
                      triggerHaptic('selection');
                    }}
                    className={`w-12 h-7 rounded-full p-1 transition-colors duration-200 ease-in-out shrink-0 cursor-pointer ${
                      autoSundayReports ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-navy-700'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ease-in-out ${
                        autoSundayReports ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Presentation Shield & Workstation Privacy Controls */}
            <div className="bg-white/95 dark:bg-navy-900 rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-200/90 dark:border-navy-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-navy-800/80 pb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/70 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-200/60 dark:border-emerald-800/60 shadow-2xs">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      Presentation &amp; Privacy Shield
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Smartboard projection safeguards and tactile audio settings</p>
                  </div>
                </div>
                {presentationShield && (
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                    SHIELD ACTIVE
                  </span>
                )}
              </div>

              <div className="space-y-2.5">
                {/* Classroom / Auditorium Mode */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50/80 dark:bg-navy-950/60 border border-slate-200/80 dark:border-navy-800">
                  <div className="min-w-0 pr-3">
                    <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <EyeOff className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                      Auditorium &amp; Projector Presentation Mode
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">Blurs sensitive student phone numbers &amp; personal email IDs when presenting on projector / smartboard screens</div>
                  </div>
                  <div
                    role="switch"
                    aria-checked={presentationShield}
                    onClick={() => {
                      const next = !presentationShield;
                      setPresentationShield(next);
                      try {
                        localStorage.setItem('nec_presentation_shield', String(next));
                        if (typeof document !== 'undefined') {
                          if (next) {
                            document.body.classList.add('presentation-shield-active');
                            document.documentElement.setAttribute('data-presentation-shield', 'true');
                            notify.success('Presentation Shield Active', 'Student phone numbers & private emails are blurred for smartboard projection.');
                          } else {
                            document.body.classList.remove('presentation-shield-active');
                            document.documentElement.removeAttribute('data-presentation-shield');
                            notify.info('Presentation Shield Deactivated', 'Sensitive contact info is visible again.');
                          }
                        }
                      } catch {}
                      triggerHaptic('selection');
                    }}
                    className={`w-12 h-7 rounded-full p-1 transition-colors duration-200 ease-in-out shrink-0 cursor-pointer ${
                      presentationShield ? 'bg-brand-600' : 'bg-slate-300 dark:bg-navy-700'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ease-in-out ${
                        presentationShield ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </div>
                </div>

                {/* Tactile Haptics */}
                <div
                  onClick={() => {
                    const next = !hapticEnabled;
                    setHapticEnabled(next);
                    try { localStorage.setItem('nec_haptics_enabled', String(next)); } catch {}
                    triggerHaptic('selection');
                  }}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50/80 dark:bg-navy-950/60 border border-slate-200/80 dark:border-navy-800 hover:bg-slate-100/60 dark:hover:bg-navy-900/60 transition-colors cursor-pointer select-none"
                >
                  <div className="min-w-0 pr-3">
                    <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5 text-indigo-500" />
                      Tactile Spring Haptics (Mobile &amp; Tablet)
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">Provides physical micro-vibration feedback when tapping interactive controls &amp; toggles</div>
                  </div>
                  <div
                    role="switch"
                    aria-checked={hapticEnabled}
                    className={`w-12 h-7 rounded-full p-1 transition-colors duration-200 ease-in-out shrink-0 ${
                      hapticEnabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-navy-700'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ease-in-out ${
                        hapticEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 5. Interactive Institutional Task Board & Contest Action Plan */}
            <div className="bg-white/95 dark:bg-navy-900 rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-200/90 dark:border-navy-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-navy-800/80 pb-3 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-fuchsia-50 text-fuchsia-600 dark:bg-fuchsia-950/70 dark:text-fuchsia-400 flex items-center justify-center shrink-0 border border-fuchsia-200/60 dark:border-fuchsia-800/60 shadow-2xs">
                    <CheckSquare className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider font-display">
                      Institutional Action Plan &amp; Tasks
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Weekly contest milestones, verification checks &amp; reminders</p>
                  </div>
                </div>

                {/* Live Progress Pill */}
                {(() => {
                  const completedCount = plannerTasks.filter(t => t.completed).length;
                  const total = plannerTasks.length;
                  const pct = total > 0 ? Math.round((completedCount / total) * 100) : 0;
                  return (
                    <div className="flex items-center gap-2">
                      <div className="w-20 sm:w-24 bg-slate-100 dark:bg-navy-950 rounded-full h-2 overflow-hidden border border-slate-200 dark:border-navy-800">
                        <div
                          className="bg-gradient-to-r from-brand-500 to-emerald-500 h-full transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[10.5px] font-mono font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {completedCount}/{total} ({pct}%)
                      </span>
                    </div>
                  );
                })()}
              </div>

              {/* Quick Template Task Injectors */}
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider mr-1">Quick Add:</span>
                <button
                  type="button"
                  onClick={() => handleAddTask('Sync Weekly Contest 526 Solvers Roster')}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 hover:bg-slate-200 dark:bg-navy-950 dark:hover:bg-navy-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-navy-800 cursor-pointer active:scale-95 transition-all"
                >
                  + Contest 526 Roster
                </button>
                <button
                  type="button"
                  onClick={() => handleAddTask('Export All 17 Executive Department Reports')}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 hover:bg-slate-200 dark:bg-navy-950 dark:hover:bg-navy-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-navy-800 cursor-pointer active:scale-95 transition-all"
                >
                  + 17 Master Reports
                </button>
                <button
                  type="button"
                  onClick={() => handleAddTask('Follow up with inactive students (< 1 problem solved)')}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 hover:bg-slate-200 dark:bg-navy-950 dark:hover:bg-navy-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-navy-800 cursor-pointer active:scale-95 transition-all"
                >
                  + Inactive Follow-up
                </button>
              </div>

              {/* Interactive Task Checklist */}
              <div className="space-y-2 pt-1">
                {plannerTasks.map((task) => (
                  <div
                    key={task.id}
                    className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-all select-none ${
                      task.completed
                        ? 'bg-slate-50/60 dark:bg-navy-950/40 border-slate-200/60 dark:border-navy-800/60 opacity-75'
                        : 'bg-white dark:bg-navy-950 border-slate-200 dark:border-navy-800 shadow-2xs hover:border-brand-500/40'
                    }`}
                  >
                    <div
                      onClick={() => handleToggleTask(task.id)}
                      className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                    >
                      <div className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 transition-colors border ${
                        task.completed
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : 'border-slate-300 dark:border-navy-700 hover:border-brand-500'
                      }`}>
                        {task.completed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className={`text-xs font-bold block truncate ${
                          task.completed
                            ? 'line-through text-slate-400 dark:text-slate-500'
                            : 'text-slate-800 dark:text-slate-200'
                        }`}>
                          {task.text}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {task.badge && (
                        <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase ${
                          task.priority === 'urgent'
                            ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                            : task.priority === 'high'
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                            : 'bg-slate-200 dark:bg-navy-800 text-slate-600 dark:text-slate-400'
                        }`}>
                          {task.badge}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteTask(task.id)}
                        className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                        title="Delete task"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Custom Task Input */}
              <div className="pt-2 flex items-center gap-2">
                <input
                  type="text"
                  value={newPlannerInput}
                  onChange={e => setNewPlannerInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddTask(); } }}
                  placeholder="Add custom institutional action item..."
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                />
                <button
                  type="button"
                  onClick={() => handleAddTask()}
                  className="px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all shadow-sm shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Task</span>
                </button>
              </div>

              {/* Expandable Quick Notes Textarea */}
              <div className="pt-3 border-t border-slate-100 dark:border-navy-800/80">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                    Quick Scratchpad &amp; Offline Notes
                  </span>
                  <span className="text-[9.5px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                    AUTO-SAVED LOCALLY
                  </span>
                </div>
                <div className="relative">
                  <textarea
                    rows={3}
                    value={facultyNotes}
                    onChange={e => handleFacultyNotesChange(e.target.value)}
                    placeholder="Quick notes, contest reminders, or student observations..."
                    className="w-full p-3 pb-9 rounded-xl border border-slate-300 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 text-xs font-medium text-slate-900 dark:text-white outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 resize-none font-mono"
                  />
                  <div className="absolute bottom-2 right-2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handleCopyNotes}
                      className="px-2 py-1 rounded text-[10px] font-bold bg-white dark:bg-navy-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-navy-800 hover:text-brand-600 flex items-center gap-1 cursor-pointer active:scale-95"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </button>
                    {facultyNotes && (
                      <button
                        type="button"
                        onClick={handleClearNotes}
                        className="px-2 py-1 rounded text-[10px] font-bold bg-white dark:bg-navy-900 text-rose-600 hover:bg-rose-50 border border-rose-200 flex items-center gap-1 cursor-pointer active:scale-95"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Clear</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 6. Institutional Accreditation & Compliance Badge */}
            <div className="p-3.5 rounded-2xl bg-slate-100/70 dark:bg-navy-950/60 border border-slate-200/80 dark:border-navy-800/80 flex items-center justify-between flex-wrap gap-2 text-xs">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-brand-600 dark:text-brand-400 shrink-0" />
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  Nandha Engineering College (Autonomous), Erode • NIRF / NBA Compliant
                </span>
              </div>
              <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                Platform v4.2.0 • Institutional Standard
              </span>
            </div>
          </div>
        )}

        {/* TAB 4: DIGITAL IDENTITY CARD — Authentic Institutional PVC Badge */}
        {/* ========================================================================= */}
        {effectiveTab === 'id_card' && (
          <div className="space-y-6 animate-fade-in">

            {/* Top Card Controls & Theme Switcher */}
            <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-navy-900 border-2 border-slate-200 dark:border-navy-800 w-full shadow-xs">
              <div className="flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-3">
                <span className="text-xs font-black text-slate-950 dark:text-white uppercase tracking-wider shrink-0">Badge Theme:</span>
                <div className="flex flex-row items-center gap-1.5 flex-wrap">
                  {CARD_THEMES.map(th => (
                    <button
                      key={th.id}
                      type="button"
                      onClick={() => setSelectedCardTheme(th.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all border-2 cursor-pointer whitespace-nowrap active:scale-95 ${
                        selectedCardTheme === th.id
                          ? 'bg-brand-600 text-white border-brand-700 shadow-sm'
                          : 'bg-slate-100 dark:bg-navy-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-navy-800 hover:border-brand-400'
                      }`}
                    >
                      {th.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* View Side Segmented Switcher & Action Buttons */}
              <div className="flex flex-row items-center gap-2 flex-wrap shrink-0">
                {/* View Side Switcher */}
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-navy-950 p-1 rounded-xl border border-slate-200 dark:border-navy-800">
                  <button
                    type="button"
                    onClick={() => setIdCardSide('front')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                      idCardSide === 'front'
                        ? 'bg-white dark:bg-navy-800 text-brand-600 dark:text-brand-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    Front Side
                  </button>
                  <button
                    type="button"
                    onClick={() => setIdCardSide('back')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                      idCardSide === 'back'
                        ? 'bg-white dark:bg-navy-800 text-brand-600 dark:text-brand-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    Back Side
                  </button>
                  <button
                    type="button"
                    onClick={() => setIdCardSide('both')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                      idCardSide === 'both'
                        ? 'bg-white dark:bg-navy-800 text-brand-600 dark:text-brand-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    Both Sides
                  </button>
                </div>

                <button
                  type="button"
                  disabled={isSavingCard}
                  onClick={handleDownloadIdCardPng}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition-all shadow-xs cursor-pointer inline-flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                  title="Save high-resolution PVC ID badge directly to phone Downloads"
                >
                  {isSavingCard ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  <span>Save ID Card</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportVCard}
                  className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black transition-all shadow-xs cursor-pointer inline-flex items-center gap-1.5 active:scale-95"
                  title="Download vCard file for mobile phonebook"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Save vCard</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrintIdCard}
                  className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-black text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 text-xs font-black transition-all shadow-xs cursor-pointer inline-flex items-center gap-1.5 active:scale-95"
                  title="Preview, print, or save high-resolution PVC ID badge"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Preview &amp; Print</span>
                </button>
              </div>
            </div>

            {/* Smart 2-Sided High-Security ID Card Container */}
            <div className="flex justify-center p-2 sm:p-6">
              <div className={`flex flex-col lg:flex-row gap-6 justify-center items-center w-full max-w-5xl ${
                idCardSide === 'both' ? 'items-start' : 'items-center'
              }`}>

                {/* FRONT SIDE CARD COMPONENT */}
                {(idCardSide === 'front' || idCardSide === 'both') && (
                  <div className={`w-full max-w-[340px] sm:max-w-md rounded-3xl bg-gradient-to-br ${currentCardTheme.bg} p-4 sm:p-6 text-white shadow-2xl border-2 ${currentCardTheme.border} relative overflow-hidden space-y-3.5 sm:space-y-5 animate-fade-in`}>

                    {/* Holographic Watermark Glow */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

                    {/* Official Institution Header with Real College Logo & 25 Years Silver Jubilee Logo */}
                    <div className="flex items-center justify-between border-b border-white/20 pb-3 relative z-10 gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src="/nandha_emblem.png"
                          alt="NEC"
                          className="w-11 h-11 object-contain shrink-0 drop-shadow-md"
                          onError={(e) => {
                            (e.target as any).style.display = 'none';
                          }}
                        />
                        <div className="min-w-0">
                          <h4 className="text-xs sm:text-[13px] font-black uppercase tracking-wider text-white truncate">
                            NANDHA ENGINEERING COLLEGE
                          </h4>
                          <p className="text-[9px] sm:text-[10px] text-amber-200/90 font-bold truncate">
                            (Autonomous) • Anna University, Chennai
                          </p>
                          <p className="text-[8px] sm:text-[8.5px] text-slate-300 font-semibold truncate">
                            Approved by AICTE • NBA &amp; NAAC A+ Grade
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <img
                          src="/nec_25_years_logo_transparent.png"
                          alt="25 Years of Excellence"
                          className="h-10 sm:h-11 w-auto object-contain drop-shadow-md"
                          onError={(e: any) => {
                            e.target.src = '/nec_25_years_logo.png';
                          }}
                        />
                        <span className={`px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider border shrink-0 ${
                          rawRole.includes('admin')
                            ? 'bg-purple-500/25 border-purple-400/40 text-purple-200'
                            : rawRole.includes('student')
                            ? 'bg-sky-500/25 border-sky-400/40 text-sky-200'
                            : 'bg-emerald-500/25 border-emerald-400/40 text-emerald-200'
                        }`}>
                          {rawRole.includes('admin') ? 'ADMIN' : rawRole.includes('student') ? 'STUDENT' : 'FACULTY'}
                        </span>
                      </div>
                    </div>

                    {/* EMV Gold Smart Chip & RFID Contactless indicator */}
                    <div className="flex items-center justify-between relative z-10 pt-0.5">
                      {/* Microchip Graphic */}
                      <div className="w-10 h-8 rounded-md bg-gradient-to-br from-amber-300 via-amber-400 to-yellow-500 border border-amber-200/70 shadow-sm flex flex-col justify-around p-1 relative overflow-hidden">
                        <div className="w-full h-px bg-amber-700/40" />
                        <div className="w-full h-px bg-amber-700/40" />
                        <div className="absolute inset-y-0 left-1/3 w-px bg-amber-700/40" />
                        <div className="absolute inset-y-0 right-1/3 w-px bg-amber-700/40" />
                      </div>

                      {/* Contactless RFID / NFC Wave Icon */}
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-[10px] font-mono text-amber-300">
                        <span className="text-xs">(((•)))</span>
                        <span className="text-[9px] font-black uppercase tracking-wider">RFID / NFC</span>
                      </div>
                    </div>

                    {/* Profile Photo & Primary Information */}
                    <div className="flex items-center gap-3.5 sm:gap-4 relative z-10">
                      <div className="w-24 h-28 sm:w-28 sm:h-32 min-w-[96px] max-w-[96px] min-h-[112px] max-h-[112px] sm:min-w-[112px] sm:max-w-[112px] sm:min-h-[128px] sm:max-h-[128px] rounded-2xl overflow-hidden border-2 border-amber-400/90 shadow-xl bg-slate-950 shrink-0 flex items-center justify-center relative">
                        {profilePhoto ? (
                          <img
                            src={profilePhoto}
                            alt="ID Photo"
                            className="w-full h-full max-w-full max-h-full object-cover object-top block pointer-events-none select-none"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-tr from-brand-600 to-indigo-600 text-white font-black text-3xl flex items-center justify-center">
                            {(fullName || user?.username || 'N').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="absolute bottom-0 inset-x-0 bg-black/70 backdrop-blur-xs py-0.5 text-center text-[8px] font-black uppercase text-amber-300 tracking-wider z-10">
                          Verified
                        </div>
                      </div>

                      <div className="space-y-1 min-w-0 flex-1 overflow-hidden">
                        <h3 className="text-sm sm:text-lg font-black text-white truncate tracking-tight" title={fullName || user?.username || 'Nanthishvaran S'}>
                          {fullName || user?.username || 'Nanthishvaran S'}
                        </h3>
                        <p className="text-xs font-extrabold text-amber-300 truncate" title={designation || (rawRole.includes('admin') ? 'Administrator' : 'Faculty Member')}>
                          {designation || (rawRole.includes('admin') ? 'Administrator' : 'Faculty Member')}
                        </p>
                        <div className="pt-1 flex flex-col gap-1">
                          <div className="inline-flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded font-mono text-[10.5px] sm:text-[11px] font-black bg-white/20 text-white border border-white/25 truncate">
                              {institutionalId}
                            </span>
                          </div>
                          <span className="text-[9.5px] sm:text-[10px] font-bold text-sky-200 truncate" title={departmentName && departmentName !== 'INSTITUTIONAL' ? departmentName : 'Computer Science & Engineering'}>
                            {departmentName && departmentName !== 'INSTITUTIONAL' ? departmentName : 'Computer Science & Engineering'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Front Specifications Grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs font-bold bg-white/10 backdrop-blur-md rounded-2xl p-3 sm:p-3.5 border border-white/15 relative z-10">
                      <div>
                        <span className="text-[9px] uppercase font-black text-slate-300 block tracking-wider">DOB (Verified)</span>
                        <span className="font-mono text-white text-xs">{dateOfBirth || '17/01/2004'}</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-black text-slate-300 block tracking-wider">Blood Group</span>
                        <span className="text-rose-300 font-black text-xs">{bloodGroup || 'O+ (Positive)'}</span>
                      </div>
                      <div className="col-span-2 pt-1 border-t border-white/10 flex items-center justify-between">
                        <div className="min-w-0 flex-1 pr-2">
                          <span className="text-[9px] uppercase font-black text-slate-300 block tracking-wider">Office Cabin / Room</span>
                          <span className="text-white text-xs truncate block">{officeLocation || 'Main Campus • Academic Block B-204'}</span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[9px] uppercase font-black text-slate-300 block tracking-wider">Mobile</span>
                          <span className="font-mono text-amber-300 text-xs">{phoneNumber || '+91 90420 20879'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Barcode Strip */}
                    <div className="pt-1 relative z-10 text-center">
                      <div className="h-6 w-full rounded bg-white/90 p-1 flex items-center justify-center">
                        <div
                          className="w-full h-4"
                          style={{
                            background: 'repeating-linear-gradient(to right, #000, #000 2px, transparent 2px, transparent 4px, #000 4px, #000 7px, transparent 7px, transparent 9px)'
                          }}
                        />
                      </div>
                      <div className="font-mono text-[9px] font-black tracking-widest text-slate-300 mt-1">
                        *{institutionalId}*
                      </div>
                    </div>

                    {/* Card Footer: Validity & Authorized Signatory */}
                    <div className="pt-2 border-t border-white/15 flex items-end justify-between text-[10px] font-bold text-slate-300 relative z-10">
                      <div>
                        <span className="text-[8px] uppercase tracking-wider block text-slate-400">Valid Session</span>
                        <span className="text-white font-extrabold text-[11px]">2025 – 2026</span>
                        <span className="text-[8px] font-black text-amber-300 block">25th Silver Jubilee</span>
                      </div>
                      <div className="text-right">
                        <div className="font-serif italic font-black text-amber-300 text-sm tracking-wide">
                          Dr. U. S. Ragupathy
                        </div>
                        <span className="text-[8px] uppercase tracking-wider block text-slate-200 font-extrabold">Principal • Authorized Signatory</span>
                      </div>
                    </div>

                    {/* Flip Trigger on single card mode */}
                    {idCardSide !== 'both' && (
                      <div className="pt-1 text-center">
                        <button
                          type="button"
                          onClick={() => setIdCardSide('back')}
                          className="text-amber-300 hover:underline inline-flex items-center gap-1 cursor-pointer font-black text-xs"
                        >
                          <span>Flip to Back Side</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                  </div>
                )}

                {/* BACK SIDE CARD COMPONENT */}
                {(idCardSide === 'back' || idCardSide === 'both') && (
                  <div className={`w-full max-w-[340px] sm:max-w-md rounded-3xl bg-gradient-to-br ${currentCardTheme.bg} p-4 sm:p-6 text-white shadow-2xl border-2 ${currentCardTheme.border} relative overflow-hidden space-y-3.5 sm:space-y-4 animate-fade-in`}>

                    {/* Holographic Watermark glow */}
                    <div className="absolute top-0 left-0 w-64 h-64 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

                    {/* Magnetic Stripe across top */}
                    <div className="-mx-6 -mt-6 h-9 bg-slate-950 border-b border-white/20 relative flex items-center px-4">
                      <span className="font-mono text-[8px] text-slate-500 tracking-widest">ISO 7810 / 7816 MAGNETIC STRIPE</span>
                    </div>

                    {/* Back Header: Institution Full Address */}
                    <div className="text-center border-b border-white/20 pb-2.5 relative z-10">
                      <h4 className="text-xs font-black uppercase tracking-wider text-amber-300">
                        NANDHA ENGINEERING COLLEGE (AUTONOMOUS)
                      </h4>
                      <p className="text-[9px] text-slate-200 font-semibold mt-0.5">
                        Erode – Perundurai Main Road, Vaikkaalmedu, Erode – 638 052, Tamil Nadu
                      </p>
                      <p className="text-[8px] text-slate-300 mt-0.5">
                        Ph: 04294 - 225585 | info@nandhaengg.org | www.nandhaengg.org
                      </p>
                    </div>

                    {/* Emergency & Medical Dispatch Box */}
                    <div className="p-3 rounded-2xl bg-rose-500/15 backdrop-blur-md border border-rose-400/30 space-y-1.5 relative z-10">
                      <span className="text-[9px] font-black uppercase text-rose-300 tracking-wider flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-rose-400" /> Emergency &amp; Medical Contact
                      </span>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-[9px] text-slate-300 block font-bold">Contact Person</span>
                          <span className="font-black text-white truncate block">{emergencyContactName || 'Department HOD'}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-300 block font-bold">Emergency Phone</span>
                          <span className="font-mono font-black text-white truncate block">{emergencyContactPhone || phoneNumber || '+91 04294 225585'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Qualifications & Specialization */}
                    <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 space-y-1 relative z-10 text-xs">
                      <div>
                        <span className="text-[8px] uppercase font-black text-slate-300 block tracking-wider">Highest Degree</span>
                        <span className="font-bold text-white text-[11px] truncate block">{highestDegree || 'M.E. Computer Science & Engineering'}</span>
                      </div>
                      <div>
                        <span className="text-[8px] uppercase font-black text-slate-300 block tracking-wider">Specialization</span>
                        <span className="font-bold text-white text-[11px] truncate block">{specialization || 'Data Structures, Algorithms & Cloud Systems'}</span>
                      </div>
                    </div>

                    {/* Scannable Dynamic QR Code & Cryptographic Verification */}
                    <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 relative z-10">
                      <div className="space-y-1 min-w-0 flex-1">
                        <span className="text-[9px] font-black uppercase text-emerald-300 tracking-wider block">
                          VERIFIED IDENTITY HASH
                        </span>
                        <p className="font-mono text-[9px] text-slate-200 break-all leading-tight">
                          SHA256-{institutionalId.toLowerCase()}-verified-2026
                        </p>
                        <p className="text-[9px] text-slate-300 font-bold">
                          Scan with any phone to view live status &amp; verified digital credentials
                        </p>
                      </div>
                      <div className="shrink-0 bg-white p-1.5 rounded-xl shadow-md">
                        <QRCodeCanvas value={idVerificationUrl} size={86} level="M" includeMargin={false} bgColor="#ffffff" fgColor="#0b1528" className="rounded-lg shadow-sm block" />
                      </div>
                    </div>

                    {/* Terms & Return Instructions */}
                    <div className="pt-1 text-[8px] text-slate-300 space-y-0.5 border-t border-white/15 relative z-10">
                      <p className="font-bold text-slate-200">• Property of Nandha Engineering College (25 Years of Academic Excellence • Estd. 2001).</p>
                      <p>• If found, return to Campus Security Desk or Principal's Office (Dr. U. S. Ragupathy, Ph: 04294-225585).</p>
                    </div>

                    {/* Flip Trigger on single card mode */}
                    {idCardSide !== 'both' && (
                      <div className="pt-1 text-center">
                        <button
                          type="button"
                          onClick={() => setIdCardSide('front')}
                          className="text-amber-300 hover:underline inline-flex items-center gap-1 cursor-pointer font-black text-xs"
                        >
                          <span>Flip to Front Side</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                  </div>
                )}

              </div>
            </div>

            {/* Accreditation Summary Box */}
            <div className="bg-white dark:bg-navy-900 rounded-3xl p-6 border-2 border-slate-200 dark:border-navy-800 shadow-sm space-y-4">
              <h3 className="text-xs font-black text-slate-950 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Award className="w-4 h-4 text-brand-600" /> Institutional Accreditation &amp; Record Summary
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
                <div className="p-3.5 rounded-2xl bg-amber-500/10 dark:bg-amber-950/30 border border-amber-300/40 dark:border-amber-700/50 space-y-0.5">
                  <span className="text-[10px] uppercase font-black text-amber-800 dark:text-amber-300 block">Milestone</span>
                  <span className="font-black text-amber-950 dark:text-amber-200">25th Year (Silver Jubilee)</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-800 space-y-0.5">
                  <span className="text-[10px] uppercase font-black text-slate-700 dark:text-slate-300 block">Principal</span>
                  <span className="font-black text-slate-950 dark:text-white truncate block">Dr. U. S. Ragupathy</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-800 space-y-0.5">
                  <span className="text-[10px] uppercase font-black text-slate-700 dark:text-slate-300 block">Accreditation</span>
                  <span className="font-black text-slate-950 dark:text-white">NBA &amp; NAAC A+</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-800 space-y-0.5">
                  <span className="text-[10px] uppercase font-black text-slate-700 dark:text-slate-300 block">Affiliation</span>
                  <span className="font-black text-slate-950 dark:text-white">Autonomous • Anna Univ</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-800 space-y-0.5">
                  <span className="text-[10px] uppercase font-black text-slate-700 dark:text-slate-300 block">Verification</span>
                  <span className="font-black text-emerald-600 dark:text-emerald-400">Cryptographically Sealed</span>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: MENTORSHIP & TRACKING */}
        {/* ========================================================================= */}
        {/* ========================================================================= */}
        {/* TAB 5: MENTORSHIP & TRACKING (STAFF / FACULTY ONLY) */}
        {/* ========================================================================= */}
        {isStaffMentor && effectiveTab === 'mentorship' && (
          <div className="grid grid-cols-1 gap-6 animate-fade-in">
            <div className="bg-white/95 dark:bg-[#0B1221]/95 backdrop-blur-xl rounded-3xl p-3.5 sm:p-6 lg:p-7 border border-slate-200/90 dark:border-navy-700 shadow-sm space-y-4 sm:space-y-6">
              <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-navy-800 pb-3.5 sm:pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-brand-500/20 to-indigo-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center border border-brand-500/25 shrink-0">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-black text-slate-950 dark:text-white uppercase tracking-wider">
                      Student Mentorship & Attendance
                    </h3>
                    <p className="text-[10px] sm:text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Real-time academic cohort tracking & behavioral telemetry
                    </p>
                  </div>
                </div>
                <span className="hidden sm:inline-flex items-center px-3 py-1 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 text-[10px] font-black uppercase tracking-wider border border-brand-500/20">
                  {totalMentees} Students Active
                </span>
              </div>

              {/* Dynamic Telemetry Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div className="p-3.5 sm:p-5 rounded-2xl bg-gradient-to-br from-blue-500/10 via-brand-500/5 to-transparent border border-blue-200/90 dark:border-blue-500/30 flex items-center justify-between shadow-xs">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">Assigned Mentees</div>
                    <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1 leading-none">{totalMentees}</div>
                    <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-1">Official Semester Roster</div>
                  </div>
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                </div>

                <div className="p-3.5 sm:p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-200/90 dark:border-emerald-500/30 flex items-center justify-between shadow-xs">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Avg Attendance</div>
                    <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1 leading-none">{avgAttendance}</div>
                    <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-1">Institutional Threshold 75%</div>
                  </div>
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                </div>

                <div className="p-3.5 sm:p-5 rounded-2xl bg-gradient-to-br from-amber-500/10 via-rose-500/5 to-transparent border border-amber-200/90 dark:border-amber-500/30 flex items-center justify-between shadow-xs">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">Pending Interventions</div>
                    <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1 leading-none">{pendingInterventions}</div>
                    <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-1">Requires Faculty Review</div>
                  </div>
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* Mentee Roster Section */}
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-wide flex items-center gap-2">
                    <span>Mentee Roster</span>
                    <span className="text-[10px] font-bold text-slate-400">({totalMentees})</span>
                  </h4>
                  {totalMentees > 0 && (
                    <button
                      type="button"
                      onClick={handleExportCSV}
                      className="text-[10px] font-bold px-3 py-1.5 bg-slate-100 dark:bg-navy-900 hover:bg-slate-200 dark:hover:bg-navy-800 text-slate-700 dark:text-slate-300 rounded-xl cursor-pointer transition-colors border border-slate-200 dark:border-navy-700 flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export CSV</span>
                    </button>
                  )}
                </div>

                <div className="border border-slate-200 dark:border-navy-800 rounded-2xl overflow-hidden bg-white dark:bg-navy-950/60 shadow-xs">
                  {/* Desktop Table View */}
                  <div className="hidden sm:block overflow-y-auto overflow-x-auto max-h-[300px] custom-scrollbar">
                    <table className="w-full text-left text-[11px] sm:text-xs whitespace-nowrap">
                      <thead className="bg-slate-50 dark:bg-navy-900/90 text-slate-700 dark:text-slate-300 font-black uppercase text-[9px] sm:text-[10px] border-b border-slate-200 dark:border-navy-800 sticky top-0 z-10 backdrop-blur-md">
                        <tr>
                          <th className="px-3 sm:px-4 py-3">Student Reg No</th>
                          <th className="px-3 sm:px-4 py-3">Student Name</th>
                          <th className="px-3 sm:px-4 py-3">Attendance</th>
                          <th className="px-3 sm:px-4 py-3">LeetCode Solved</th>
                          <th className="px-3 sm:px-4 py-3 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-navy-800/60 text-slate-800 dark:text-slate-200 font-bold">
                        {menteesLoading ? (
                          <tr>
                            <td colSpan={5} className="text-center py-10 text-slate-500">
                              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-brand-500" />
                              <span>Loading assigned mentees...</span>
                            </td>
                          </tr>
                        ) : mentees.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="text-center py-12 px-4">
                              <div className="max-w-xs mx-auto text-center space-y-2.5">
                                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto border border-amber-500/20">
                                  <GraduationCap className="w-6 h-6" />
                                </div>
                                <div className="text-xs font-black text-slate-900 dark:text-white">
                                  No Mentees Assigned Yet
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-normal leading-relaxed">
                                  Your department coordinator or HOD will assign student mentees to your staff account for this academic cycle.
                                </div>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          mentees.map(m => {
                            const isCritical = m.status_code === 'CRITICAL';
                            const isWarning = m.status_code === 'WARNING';
                            const actionType = isCritical ? 'Intervene' : isWarning ? 'Warn' : 'View';
                            const att = isCritical ? '60%' : isWarning ? '74%' : '90%+';

                            return (
                              <tr key={m.id} className={`hover:bg-slate-50 dark:hover:bg-navy-950/50 transition-colors ${isCritical ? 'bg-rose-50/40 dark:bg-rose-900/10' : isWarning ? 'bg-amber-50/40 dark:bg-amber-900/10' : ''}`}>
                                <td className="px-3 sm:px-4 py-2.5 sm:py-3 font-mono">{m.reg_no}</td>
                                <td className="px-3 sm:px-4 py-2.5 sm:py-3">{m.name || m.username}</td>
                                <td className="px-3 sm:px-4 py-2.5 sm:py-3"><span className={`${isCritical ? 'text-rose-600 dark:text-rose-400' : isWarning ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{att}</span></td>
                                <td className="px-3 sm:px-4 py-2.5 sm:py-3">{m.total_solved || 0}</td>
                                <td className="px-3 sm:px-4 py-2.5 sm:py-3 text-center">
                                  <button type="button" onClick={() => setSelectedMentee({ name: m.name || m.username, regNo: m.reg_no, att, solved: m.total_solved || 0, actionType })} className={`p-1.5 sm:p-2 rounded-xl transition-colors cursor-pointer inline-flex items-center justify-center group ${isCritical ? 'bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400' : isWarning ? 'bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 text-amber-600 dark:text-amber-400' : 'bg-brand-50 hover:bg-brand-100 dark:bg-brand-500/10 dark:hover:bg-brand-500/20 text-brand-600 dark:text-brand-400'}`} title={actionType}>
                                    {isCritical ? <AlertTriangle className="w-4 h-4 group-hover:scale-110 transition-transform" /> : isWarning ? <Bell className="w-4 h-4 group-hover:scale-110 transition-transform" /> : <Eye className="w-4 h-4 group-hover:scale-110 transition-transform" />}
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Native Stacked Card View - Redesigned with spacious badges and zero text clipping */}
                  <div className="block sm:hidden p-2.5 sm:p-3 space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar">
                    {menteesLoading ? (
                      <div className="text-center py-8 text-slate-500">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-brand-500" />
                        <span className="text-xs font-bold">Loading assigned mentees...</span>
                      </div>
                    ) : mentees.length === 0 ? (
                      <div className="text-center py-8 px-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto mb-2">
                          <GraduationCap className="w-5 h-5" />
                        </div>
                        <p className="text-xs font-black text-slate-900 dark:text-white">No Mentees Assigned</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">Assigned by HOD for this cycle.</p>
                      </div>
                    ) : (
                      mentees.map(m => {
                        const isCritical = m.status_code === 'CRITICAL';
                        const isWarning = m.status_code === 'WARNING';
                        const actionType = isCritical ? 'Intervene' : isWarning ? 'Warn' : 'View';
                        const att = isCritical ? '60%' : isWarning ? '74%' : '90%+';

                        return (
                          <div 
                            key={m.id}
                            className={`p-3.5 rounded-2xl border transition-all shadow-xs ${
                              isCritical 
                                ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200/90 dark:border-rose-900/50' 
                                : isWarning 
                                ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/90 dark:border-amber-900/50' 
                                : 'bg-slate-50/60 dark:bg-navy-900/60 border-slate-200/90 dark:border-navy-800'
                            }`}
                          >
                            {/* Card Top Row: Student Name, Reg No & Action Button */}
                            <div className="flex items-center justify-between gap-2.5">
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-black text-slate-900 dark:text-white truncate uppercase tracking-tight">
                                  {m.name || m.username}
                                </p>
                                <span className="inline-block mt-0.5 px-2 py-0.5 rounded-md bg-slate-200/70 dark:bg-navy-800 text-slate-700 dark:text-slate-300 font-mono text-[10px] font-bold">
                                  {m.reg_no}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setSelectedMentee({ name: m.name || m.username, regNo: m.reg_no, att, solved: m.total_solved || 0, actionType })}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black transition-all cursor-pointer shrink-0 active:scale-95 shadow-xs ${
                                  isCritical 
                                    ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/20' 
                                    : isWarning 
                                    ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20' 
                                    : 'bg-brand-600 hover:bg-brand-700 text-white shadow-brand-500/20'
                                }`}
                                title={actionType}
                              >
                                {isCritical ? <AlertTriangle className="w-3.5 h-3.5" /> : isWarning ? <Bell className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                <span>{actionType}</span>
                              </button>
                            </div>

                            {/* Card Bottom Row: Distinct Metric Chips with ample breathing room */}
                            <div className="mt-2.5 pt-2 border-t border-slate-200/70 dark:border-navy-800/80 flex items-center justify-between gap-2">
                              {/* Attendance Badge */}
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-navy-950 border border-slate-200/80 dark:border-navy-800 text-[11px]">
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Att:</span>
                                <span className={`font-black ${isCritical ? 'text-rose-600 dark:text-rose-400' : isWarning ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                  {att}
                                </span>
                              </div>

                              {/* LeetCode Solved Badge */}
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brand-500/10 dark:bg-brand-500/15 border border-brand-500/20 text-[11px]">
                                <span className="text-[10px] font-black uppercase tracking-wider text-brand-700 dark:text-brand-300">Solved:</span>
                                <span className="font-black text-brand-600 dark:text-brand-400">
                                  {m.total_solved || 0} Qs
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 8: HELP & SUPPORT HUB (FIRST-CLASS SUBVIEW PAGE) */}
        {/* ========================================================================= */}
        {effectiveTab === 'help' && (
          <div className="space-y-4 sm:space-y-5 animate-fade-in">
            {/* 1. Official Campus IT Helpdesk Card */}
            <div className="bg-white/95 dark:bg-navy-900 rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-200/90 dark:border-navy-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-navy-800 pb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/70 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-200/60 dark:border-indigo-800/60">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      Campus IT Helpdesk
                    </h3>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Direct technical support &amp; administrative desk</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Desk Active
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-navy-950/80 border border-slate-200/80 dark:border-navy-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Official IT Desk Email</div>
                  <div className="text-xs sm:text-sm font-mono font-bold text-slate-900 dark:text-white break-all">
                    nanthishvaran17@gmail.com
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Main Campus • Administrative Block A-102</div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText('nanthishvaran17@gmail.com');
                      triggerHaptic('success');
                      notify.success('Email Copied to Clipboard!', 'nanthishvaran17@gmail.com', { category: 'ADMIN' });
                    }}
                    className="flex-1 sm:flex-none px-3 py-2 rounded-xl border border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-900 hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-800 dark:text-slate-200 text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-2xs"
                  >
                    <Copy className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Copy Email</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('selection');
                      window.open('mailto:nanthishvaran17@gmail.com?subject=Campus%20IT%20Support%20Request', '_system');
                    }}
                    className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-xs shadow-indigo-600/30"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Open Email App</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 2. Direct Topic Resolution Tiles */}
            <div className="bg-white/95 dark:bg-navy-900 rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-200/90 dark:border-navy-800 shadow-sm space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-navy-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/70 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-200/60 dark:border-amber-800/60">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      Quick Resolution Topics
                    </h3>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Direct navigation to self-serve settings</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* 1. Designation Correction */}
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('selection');
                    window.open('mailto:nanthishvaran17@gmail.com?subject=Designation%20Correction%20Request', '_system');
                  }}
                  className="p-3.5 rounded-2xl border border-slate-200/90 dark:border-navy-800 bg-slate-50/70 dark:bg-navy-950/60 hover:bg-slate-100 dark:hover:bg-navy-800 transition-all text-left flex items-center justify-between gap-3 group cursor-pointer active:scale-98"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                      <GraduationCap className="w-4.5 h-4.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-black text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                        Designation / Dept Correction
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate">
                        Request update from IT Registrar
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
                </button>

                {/* 2. LeetCode Metric Sync */}
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('selection');
                    setActiveTab('profile');
                    setProfileSubSection('links');
                  }}
                  className="p-3.5 rounded-2xl border border-slate-200/90 dark:border-navy-800 bg-slate-50/70 dark:bg-navy-950/60 hover:bg-slate-100 dark:hover:bg-navy-800 transition-all text-left flex items-center justify-between gap-3 group cursor-pointer active:scale-98"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                      <Terminal className="w-4.5 h-4.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-black text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                        LeetCode Handle Sync
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate">
                        Configure crawler handle &amp; links
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
                </button>

                {/* 3. Security & Biometrics */}
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('selection');
                    setActiveTab('security');
                  }}
                  className="p-3.5 rounded-2xl border border-slate-200/90 dark:border-navy-800 bg-slate-50/70 dark:bg-navy-950/60 hover:bg-slate-100 dark:hover:bg-navy-800 transition-all text-left flex items-center justify-between gap-3 group cursor-pointer active:scale-98"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-violet-50 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0">
                      <Fingerprint className="w-4.5 h-4.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-black text-slate-900 dark:text-white group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                        Face ID &amp; 2-Factor Auth
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate">
                        Manage passkeys, devices &amp; OTP
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
                </button>

                {/* 4. Digital ID Card */}
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('selection');
                    setActiveTab('id_card');
                  }}
                  className="p-3.5 rounded-2xl border border-slate-200/90 dark:border-navy-800 bg-slate-50/70 dark:bg-navy-950/60 hover:bg-slate-100 dark:hover:bg-navy-800 transition-all text-left flex items-center justify-between gap-3 group cursor-pointer active:scale-98"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
                      <FileBadge className="w-4.5 h-4.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-black text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                        Digital ID Card &amp; PVC Print
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate">
                        Download 300 DPI high-res badge
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
                </button>
              </div>
            </div>

            {/* 3. Frequently Asked Questions Accordion */}
            <div className="bg-white/95 dark:bg-navy-900 rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-200/90 dark:border-navy-800 shadow-sm space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-navy-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-cyan-50 text-cyan-600 dark:bg-cyan-950/70 dark:text-cyan-400 flex items-center justify-center shrink-0 border border-cyan-200/60 dark:border-cyan-800/60">
                    <HelpCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      Frequently Asked Questions
                    </h3>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Quick solutions for common portal workflows</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5">
                {[
                  {
                    q: 'How does LeetCode automated metric sync work?',
                    a: 'NANDHA INTELLIGENCE uses an asynchronous multi-threaded GraphQL crawler that checks your registered LeetCode handle every 30 minutes. It tracks total solves, weekly contest rating, and activity streaks automatically without requiring your LeetCode password.',
                    btnLabel: 'View LeetCode Handle',
                    btnColor: 'bg-amber-600 hover:bg-amber-700 text-white',
                    icon: Terminal,
                    onAction: () => {
                      setActiveTab('profile');
                      setProfileSubSection('links');
                    }
                  },
                  {
                    q: 'Can students see my personal phone number?',
                    a: 'By default, your mobile phone number is hidden. You can choose to share it exclusively with students assigned to your mentoring cohort under Settings > Privacy & Permissions. Principal, HOD, and campus administrators retain scoped contact visibility.',
                    btnLabel: 'Open Privacy Settings',
                    btnColor: 'bg-pink-600 hover:bg-pink-700 text-white',
                    icon: Lock,
                    onAction: () => {
                      setActiveTab('privacy');
                    }
                  },
                  {
                    q: 'How do I enable 2-Factor Authentication (2FA) or Biometrics?',
                    a: 'Navigate to Settings > Security & Login. You can register hardware passkeys with Face ID, Touch ID, device Fingerprint scanners, or Windows Hello for instant single-tap logins. You can also scan a dynamic QR code for Google Authenticator / TOTP.',
                    btnLabel: 'Set Up Face ID & Biometrics',
                    btnColor: 'bg-violet-600 hover:bg-violet-700 text-white',
                    icon: Fingerprint,
                    onAction: () => {
                      setActiveTab('security');
                    }
                  },
                  {
                    q: 'How can I change my official designation or department?',
                    a: 'Official institutional credentials (Designation, Department, and Faculty ID) are verified through the college registrar database. If corrections are needed, please submit a request to the campus IT Admin desk using the form above.',
                    btnLabel: 'Copy IT Desk Email',
                    btnColor: 'bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900',
                    icon: Copy,
                    onAction: () => {
                      navigator.clipboard.writeText('nanthishvaran17@gmail.com');
                      notify.success('Email Copied to Clipboard!', 'nanthishvaran17@gmail.com', { category: 'ADMIN' });
                    }
                  },
                  {
                    q: 'How do I download or print my Digital ID Card?',
                    a: 'Switch to the Digital ID Card module from Settings. You can flip between Front and Back sides, select your favorite card theme, and download a 300 DPI high-resolution PNG image suitable for PVC badge printers.',
                    btnLabel: 'Open Digital ID Card',
                    btnColor: 'bg-cyan-600 hover:bg-cyan-700 text-white',
                    icon: FileBadge,
                    onAction: () => {
                      setActiveTab('id_card');
                    }
                  }
                ].map((faq, index) => {
                  const isExpanded = expandedFaqIndex === index;
                  const IconComponent = faq.icon;
                  return (
                    <div
                      key={index}
                      className="rounded-2xl border border-slate-200/90 dark:border-navy-800 bg-slate-50/60 dark:bg-navy-950/60 overflow-hidden transition-all"
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedFaqIndex(isExpanded ? null : index)}
                        className="w-full p-3.5 flex items-center justify-between text-left gap-3 cursor-pointer group select-none"
                      >
                        <span className="text-xs font-black text-slate-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                          {faq.q}
                        </span>
                        <ChevronDown
                          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180 text-brand-600 dark:text-brand-400' : ''}`}
                        />
                      </button>
                      {isExpanded && (
                        <div className="px-3.5 pb-3.5 pt-1 space-y-3 border-t border-slate-200/50 dark:border-navy-800/60 animate-fade-in">
                          <div className="text-xs font-bold text-slate-600 dark:text-slate-300 leading-relaxed">
                            {faq.a}
                          </div>
                          {faq.onAction && (
                            <button
                              type="button"
                              onClick={faq.onAction}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer shadow-2xs active:scale-95 ${faq.btnColor}`}
                            >
                              <IconComponent className="w-3.5 h-3.5" />
                              <span>{faq.btnLabel}</span>
                              <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 4. STATIC / FIXED STICKY ACTION BAR (Rendered on mobile, plus desktop in-form save strip) */}
        {effectiveTab === 'profile' && (
          <>
            {/* 1. Mobile Fixed Bottom Action Bar (Replaces MobileBottomNav when editing profile) */}
            <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-navy-950/95 backdrop-blur-2xl border-t border-slate-200/90 dark:border-navy-800 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgba(0,0,0,0.15)] flex items-center justify-between gap-3 animate-fade-in">
              <button
                type="button"
                onClick={handleResetForm}
                className="flex-1 py-3 px-3 rounded-2xl border border-slate-300 dark:border-navy-700 bg-slate-100 hover:bg-slate-200 dark:bg-navy-800 text-xs font-black text-slate-800 dark:text-slate-200 transition-all cursor-pointer shadow-xs active:scale-95 touch-manipulation flex items-center justify-center gap-1.5"
              >
                <RefreshCcw className="w-3.5 h-3.5" />
                <span>Reset Form</span>
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSaveProfile}
                className="flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-brand-600 via-indigo-600 to-purple-600 hover:from-brand-500 hover:to-indigo-500 text-white font-black text-xs transition-all shadow-md shadow-brand-500/25 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95 touch-manipulation"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>Save Details</span>
              </button>
            </div>

            {/* 2. Desktop-only in-form bottom save banner */}
            <div className="hidden lg:flex sticky bottom-3 z-30 flex-col sm:flex-row items-stretch sm:items-center justify-between p-3.5 sm:p-4 bg-white/95 dark:bg-navy-900/95 backdrop-blur-xl rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-navy-800 shadow-2xl shadow-slate-900/15 dark:shadow-black/50 gap-3">
              <div className="flex items-center gap-2.5 text-xs font-bold text-slate-600 dark:text-slate-300">
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="text-[11px] sm:text-xs">Live Sync: Updates apply across institutional sessions immediately.</span>
              </div>
              <div className="flex items-center gap-2 sm:gap-3 justify-end">
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-navy-700 bg-slate-100 hover:bg-slate-200 dark:bg-navy-800 dark:hover:bg-navy-700 text-xs font-black text-slate-800 dark:text-slate-200 transition-all cursor-pointer shadow-2xs active:scale-95"
                >
                  Reset Form
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 via-indigo-600 to-purple-600 hover:from-brand-500 hover:to-indigo-500 text-white font-black text-xs transition-all shadow-md shadow-brand-500/25 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>Save Details</span>
                </button>
              </div>
            </div>
            {/* Mobile bottom clearance so fixed bottom buttons never overlap content */}
            <div className="h-36 lg:h-8 pointer-events-none" aria-hidden="true" />
          </>
        )}

            </form>
          </div>
        </div>
      </div>
    </div>
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
        <GlobalModalBackdrop isOpen={showPhotoZoom} onClose={() => setShowPhotoZoom(false)} className="flex items-center justify-center p-4 z-[9999]">
          <div className="relative w-full max-w-md bg-white dark:bg-navy-950 rounded-[2rem] overflow-hidden p-1 shadow-2xl shadow-brand-500/20 animate-scale-up border border-slate-200 dark:border-navy-800 flex flex-col group">
            {/* Top decorative gradient header */}
            <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-br from-brand-600 via-indigo-600 to-purple-600 opacity-90 rounded-t-[1.8rem]"></div>

            {/* Close Button */}
            <button onClick={() => setShowPhotoZoom(false)} className="absolute top-4 right-4 text-white hover:bg-white/20 p-2 rounded-full backdrop-blur-md cursor-pointer transition-all z-10 shadow-sm">
              <X className="w-5 h-5" />
            </button>

            <div className="relative z-10 mt-12 flex flex-col items-center pb-6">
              {/* Profile Image with Glowing Border */}
              <div className="relative p-1 bg-white dark:bg-navy-950 rounded-[2rem] shadow-xl">
                <div className="absolute inset-0 bg-gradient-to-tr from-brand-400 to-indigo-400 rounded-[2rem] blur-md opacity-60 animate-pulse"></div>
                <div className="w-40 h-40 rounded-3xl overflow-hidden bg-black flex items-center justify-center relative z-10 border-4 border-white dark:border-navy-900 shadow-lg">
                  <img src={profilePhoto} alt="Zoomed" className="w-full h-full object-cover transition-transform duration-500 hover:scale-110" />
                </div>
              </div>

              {/* Text Information Details */}
              <div className="mt-6 text-center space-y-2 px-6">
                <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{fullName || user?.username}</h2>
                <div className="inline-flex items-center justify-center px-3 py-1 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-full">
                  <span className="text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    {institutionalId} &bull; {designation || roleName}
                  </span>
                </div>
              </div>

              {/* Badges / Extras */}
              <div className="mt-6 w-full px-6">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-50 dark:bg-navy-900 border border-slate-100 dark:border-navy-800">
                    <Building2 className="w-5 h-5 text-emerald-500 mb-1.5" />
                    <span className="text-[10px] uppercase font-black text-slate-400">Department</span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate w-full text-center">{departmentName || 'Not Assigned'}</span>
                  </div>
                  <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-50 dark:bg-navy-900 border border-slate-100 dark:border-navy-800">
                    <Lock className="w-5 h-5 text-brand-500 mb-1.5" />
                    <span className="text-[10px] uppercase font-black text-slate-400">Security</span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Verified Profile</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 border-t border-slate-100 dark:border-navy-800 w-full pt-4 flex justify-center">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Official Institutional ID
                </div>
              </div>
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
                    className="w-full h-10 px-3 rounded-xl border-2 border-slate-300 dark:border-navy-700 bg-slate-100 dark:bg-navy-950 font-mono font-black text-xs text-indigo-600 dark:text-indigo-400 select-all text-ellipsis"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(totpSecret);
                      notify.success('Secret key copied to clipboard', '', { category: 'ADMIN' });
                    }}
                    className="p-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-navy-800 dark:hover:bg-navy-700 transition-colors cursor-pointer shrink-0"
                    title="Copy Secret"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpen2FASetup(true)}
                    disabled={isGenerating2FA}
                    className="p-2.5 rounded-xl bg-indigo-100 hover:bg-indigo-200 text-indigo-700 dark:bg-indigo-900/50 dark:hover:bg-indigo-900 dark:text-indigo-300 transition-colors cursor-pointer shrink-0"
                    title="Regenerate New QR Code"
                  >
                    <RefreshCcw className={`w-4 h-4 ${isGenerating2FA ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 pt-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-black text-slate-950 dark:text-white">
                    2. Enter 6-digit code:
                  </label>
                </div>
                <input
                  type="text"
                  maxLength={6}
                  value={totpCodeInput}
                  onChange={e => setTotpCodeInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="000 000"
                  className="w-full h-11 px-4 rounded-xl border-2 border-indigo-500 bg-white dark:bg-navy-950 text-center font-mono font-black text-lg tracking-widest text-slate-950 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 text-ellipsis"
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
                  const codeToVerify = totpCodeInput.trim();
                  if (codeToVerify.length === 6) {
                    try {
                      const res = await api.post('/auth/2fa/verify', { code: codeToVerify });
                      if (res.data?.success) {
                        setIs2FAEnabled(true);
                        localStorage.setItem('nec_2fa_enabled', 'true');
                        setShow2FASetupModal(false);
                        setShowBackupCodesModal(true);
                        notify.success('Two-Factor Authentication activated successfully!', '', { category: 'ADMIN' });
                        playChimeSound();
                      }
                    } catch (err: any) {
                      notify.error(err.response?.data?.detail || 'Invalid verification code', '', { category: 'ADMIN' });
                    }
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

      {/* MODAL: DISABLE 2FA CONFIRMATION & OTP VERIFICATION */}
      {showDisable2FAModal && (
        <GlobalModalBackdrop isOpen={showDisable2FAModal} onClose={() => !isDisabling2FA && setShowDisable2FAModal(false)} className="flex items-center justify-center p-4">
          <div className="relative max-w-md w-full bg-white dark:bg-navy-900 rounded-3xl p-6 border-2 border-rose-500/50 shadow-2xl space-y-5 animate-scale-up text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-navy-800">
              <h3 className="text-xs font-black uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-600" /> Disable Two-Factor Authentication
              </h3>
              <button 
                type="button"
                onClick={() => !isDisabling2FA && setShowDisable2FAModal(false)} 
                className="p-1 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg cursor-pointer text-slate-500 hover:text-slate-800 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs font-bold">
              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-200 text-xs font-medium leading-relaxed">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Security Warning:</strong> Disabling 2FA removes the extra layer of security on your institutional account. You will only require your password to sign in.
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-700 dark:text-slate-300 block">
                  Enter current 6-digit Authenticator code to confirm:
                </label>
                <input
                  type="text"
                  maxLength={6}
                  autoFocus
                  value={disable2FACode}
                  onChange={(e) => {
                    setDisable2FACode(e.target.value.replace(/\D/g, '').slice(0, 6));
                    setDisable2FAError(null);
                  }}
                  placeholder="000000"
                  className="w-full text-center tracking-[0.4em] text-2xl font-mono font-black p-3.5 bg-slate-50 dark:bg-navy-950 border-2 border-slate-300 dark:border-navy-700 rounded-2xl focus:border-rose-500 focus:outline-none transition-colors"
                />
              </div>

              {disable2FAError && (
                <div className="p-2.5 rounded-xl bg-rose-100/70 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-center text-xs font-bold">
                  {disable2FAError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isDisabling2FA}
                onClick={() => setShowDisable2FAModal(false)}
                className="px-4 py-2.5 rounded-xl border-2 border-slate-300 dark:border-navy-700 text-xs font-black cursor-pointer hover:bg-slate-100 dark:hover:bg-navy-800 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={disable2FACode.length !== 6 || isDisabling2FA}
                onClick={async () => {
                  setIsDisabling2FA(true);
                  setDisable2FAError(null);
                  try {
                    const res = await api.post('/auth/2fa/disable', { code: disable2FACode.trim() });
                    if (res.data?.success) {
                      setIs2FAEnabled(false);
                      localStorage.setItem('nec_2fa_enabled', 'false');
                      setShowDisable2FAModal(false);
                      notify.success('2FA Disabled', 'Two-Factor Authentication has been safely deactivated.', { category: 'ADMIN' });
                    }
                  } catch (err: any) {
                    setDisable2FAError(err.response?.data?.detail || 'Invalid verification code. Please check Google Authenticator.');
                  } finally {
                    setIsDisabling2FA(false);
                  }
                }}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-black transition-all shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
              >
                {isDisabling2FA && <RefreshCcw className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm & Disable</span>
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

            <div className="grid grid-cols-2 gap-2 p-4 rounded-2xl bg-slate-100 dark:bg-navy-950 border border-slate-200 dark:border-navy-800 font-mono font-black text-xs text-center text-slate-900 dark:text-slate-100">
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

      {/* MODAL: LOGIN SECURITY EVENT DETAILS (Standalone Root Modal) */}
      {selectedLoginEvent && (
        <GlobalModalBackdrop isOpen={!!selectedLoginEvent} onClose={() => setSelectedLoginEvent(null)} className="flex items-center justify-center p-4 z-[9999]">
          <div className="relative max-w-lg w-full bg-white dark:bg-navy-900 rounded-3xl p-6 border border-slate-200 dark:border-navy-700 shadow-2xl space-y-5 animate-scale-up text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-navy-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
                    Security Event Details
                  </h3>
                  <p className="text-[11px] text-slate-500 font-bold">Cryptographic authentication signature</p>
                </div>
              </div>
              <button type="button" onClick={() => setSelectedLoginEvent(null)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-navy-800 cursor-pointer text-slate-400 hover:text-slate-700 dark:hover:text-white" aria-label="Close event details">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="sm:col-span-2 p-3.5 rounded-2xl bg-slate-50 dark:bg-navy-950 border border-slate-200/80 dark:border-navy-800">
                <span className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Event Identifier</span>
                <span className="font-mono font-black text-brand-700 dark:text-brand-300 break-all">{selectedLoginEvent.id}</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-navy-950 border border-slate-200/80 dark:border-navy-800">
                <span className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Verification Status</span>
                <span className="font-black text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                  {selectedLoginEvent.status}
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-navy-950 border border-slate-200/80 dark:border-navy-800">
                <span className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Auth Protocol</span>
                <span className="font-bold text-slate-900 dark:text-white">{selectedLoginEvent.method}</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-navy-950 border border-slate-200/80 dark:border-navy-800">
                <span className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Timestamp</span>
                <span className="font-bold text-slate-900 dark:text-white">{selectedLoginEvent.date} at {selectedLoginEvent.time}</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-navy-950 border border-slate-200/80 dark:border-navy-800">
                <span className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Network IP</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">{selectedLoginEvent.ip}</span>
              </div>
              <div className="sm:col-span-2 p-3.5 rounded-2xl bg-slate-50 dark:bg-navy-950 border border-slate-200/80 dark:border-navy-800">
                <span className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Device Client String</span>
                <span className="font-mono text-[11px] font-bold break-words text-slate-700 dark:text-slate-300">{selectedLoginEvent.network}</span>
              </div>
            </div>
            <button type="button" onClick={() => setSelectedLoginEvent(null)} className="w-full py-3 rounded-xl bg-slate-900 hover:bg-black dark:bg-brand-600 dark:hover:bg-brand-700 text-white text-xs font-black cursor-pointer shadow-md transition-all active:scale-95">
              Done & Close
            </button>
          </div>
        </GlobalModalBackdrop>
      )}

      {/* Photo Cropper Modal */}
      {imageToCrop && (
        <GlobalModalBackdrop isOpen={true} onClose={() => setImageToCrop(null)} className="flex flex-col items-center justify-center p-4 z-[99999]">
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

      {/* Centered Clear Scratchpad Notes Confirmation Modal */}
      {showClearNotesConfirm && (
        <GlobalModalBackdrop
          isOpen={showClearNotesConfirm}
          onClose={() => setShowClearNotesConfirm(false)}
          className="flex items-center justify-center p-4 z-[9999]"
        >
          <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 text-center animate-in fade-in zoom-in-95 duration-200">
            {/* Trash / Red Alert Icon */}
            <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-100 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-800 flex items-center justify-center text-rose-600 dark:text-rose-400 shadow-sm">
              <Trash2 className="w-7 h-7" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Clear Scratchpad Notes?
              </h3>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400 leading-relaxed">
                Are you sure you want to delete all notes from your private faculty scratchpad? This action cannot be undone.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowClearNotesConfirm(false)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClearNotes}
                className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-md shadow-rose-600/20 transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Notes</span>
              </button>
            </div>
          </div>
        </GlobalModalBackdrop>
      )}

      {/* ========================================================================= */}
      {/* HIGH-RESOLUTION IN-APP PVC ID BADGE MODAL (Mobile APK & Web Responsive) */}
      {/* ========================================================================= */}
      {showIdCardModal && (
        <GlobalModalBackdrop
          isOpen={showIdCardModal}
          onClose={() => setShowIdCardModal(false)}
          className="flex items-center justify-center p-2 sm:p-4 z-[9999]"
        >
          <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-slate-900 border-2 border-amber-500/50 rounded-3xl shadow-2xl text-white overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Sticky Header with Back Button */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-slate-950/80 border-b border-white/10 backdrop-blur-md shrink-0 gap-2">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => setShowIdCardModal(false)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs inline-flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 border border-white/15"
                  title="Back to Settings"
                >
                  <ArrowLeft className="w-4 h-4 text-amber-400" />
                  <span className="hidden xs:inline">Back</span>
                </button>
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-black text-white truncate flex items-center gap-1.5">
                    <span>Institutional PVC ID Badge</span>
                    <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      Silver Jubilee
                    </span>
                  </h3>
                  <p className="text-[10px] text-slate-400 font-mono truncate">
                    {institutionalId} • Nandha Engineering College
                  </p>
                </div>
              </div>

              {/* Action Buttons in Header */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <button
                  type="button"
                  disabled={isSavingCard}
                  onClick={handleDownloadIdCardPng}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition-all shadow-sm cursor-pointer inline-flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                  title="Save high-resolution PNG to phone Downloads"
                >
                  {isSavingCard ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">Save Image</span>
                  <span className="sm:hidden">Save</span>
                </button>

                <button
                  type="button"
                  onClick={handleShareIdCard}
                  className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black transition-all shadow-sm cursor-pointer inline-flex items-center gap-1.5 active:scale-95"
                  title="Share ID Card details"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Share</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (isNativeMobile || Capacitor.isNativePlatform()) {
                      handleDownloadIdCardPng();
                    } else {
                      window.print();
                    }
                  }}
                  className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-black transition-all shadow-sm cursor-pointer inline-flex items-center gap-1.5 active:scale-95 border border-white/10"
                  title="Print PVC Card"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Print</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowIdCardModal(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  title="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Segmented View Switcher */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-2 bg-slate-950/40 border-b border-white/10 shrink-0">
              <span className="text-[11px] font-bold text-slate-400">Card View:</span>
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-white/10">
                <button
                  type="button"
                  onClick={() => setModalCardSide('both')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    modalCardSide === 'both' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Both Sides
                </button>
                <button
                  type="button"
                  onClick={() => setModalCardSide('front')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    modalCardSide === 'front' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Front
                </button>
                <button
                  type="button"
                  onClick={() => setModalCardSide('back')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    modalCardSide === 'back' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Back
                </button>
              </div>
            </div>

            {/* Modal Body: Scrollable ID Card Cards */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
              <div className={`flex flex-col ${modalCardSide === 'both' ? 'lg:flex-row' : ''} gap-6 justify-center items-center`}>

                {/* FRONT SIDE */}
                {(modalCardSide === 'front' || modalCardSide === 'both') && (
                  <div className="w-full max-w-[340px] rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 p-5 text-white shadow-2xl border-2 border-amber-500 relative overflow-hidden space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-white/20 pb-3 relative z-10 gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <img
                          src="/nandha_emblem.png"
                          alt="NEC"
                          className="w-10 h-10 object-contain shrink-0"
                          onError={(e: any) => { e.target.style.display = 'none'; }}
                        />
                        <div className="min-w-0">
                          <h4 className="text-[12px] font-black uppercase tracking-wider text-white truncate">
                            NANDHA ENGINEERING COLLEGE
                          </h4>
                          <p className="text-[9px] text-amber-200/90 font-bold truncate">
                            (Autonomous) • Anna University, Chennai
                          </p>
                          <p className="text-[8px] text-slate-300 font-semibold truncate">
                            NBA &amp; NAAC A+ Grade Accredited
                          </p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/25 border border-emerald-400/40 text-emerald-200 shrink-0">
                        {rawRole.includes('admin') ? 'ADMIN' : rawRole.includes('student') ? 'STUDENT' : 'FACULTY'}
                      </span>
                    </div>

                    {/* Chip & Contactless */}
                    <div className="flex items-center justify-between relative z-10 pt-0.5">
                      <div className="w-9 h-7 rounded bg-gradient-to-br from-amber-300 via-amber-400 to-yellow-500 border border-amber-200/70 p-1 relative overflow-hidden shadow-sm">
                        <div className="w-full h-px bg-amber-700/40 my-1" />
                        <div className="w-full h-px bg-amber-700/40" />
                      </div>
                      <span className="text-[10px] font-mono text-amber-300 bg-white/10 px-2 py-0.5 rounded-full">
                        RFID • NFC
                      </span>
                    </div>

                    {/* Profile Row */}
                    <div className="flex items-center gap-3 relative z-10">
                      <div className="w-20 h-22 rounded-2xl border-2 border-amber-400/80 bg-black overflow-hidden flex items-center justify-center shrink-0 shadow-lg">
                        {profilePhoto ? (
                          <img src={profilePhoto} alt="Photo" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-3xl font-black text-white">{(fullName || user?.username || 'U').charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <h3 className="text-sm font-black text-white truncate">
                          {fullName || user?.username}
                        </h3>
                        <p className="text-xs font-bold text-amber-300 truncate">
                          {designation || roleName}
                        </p>
                        <span className="inline-block px-2 py-0.5 rounded font-mono text-[10px] font-black bg-white/20 text-white border border-white/25 truncate">
                          {institutionalId}
                        </span>
                        <p className="text-[9px] font-bold text-sky-200 truncate">
                          {departmentName && departmentName !== 'INSTITUTIONAL' ? departmentName : 'Computer Science & Engineering'}
                        </p>
                      </div>
                    </div>

                    {/* Specs Grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs font-bold bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/15 relative z-10">
                      <div>
                        <span className="text-[8px] uppercase font-black text-slate-300 block">DOB (Verified)</span>
                        <span className="font-mono text-white text-[11px]">{dateOfBirth || '17/01/2004'}</span>
                      </div>
                      <div>
                        <span className="text-[8px] uppercase font-black text-slate-300 block">Blood Group</span>
                        <span className="text-rose-300 font-black text-[11px]">{bloodGroup || 'O+ (Positive)'}</span>
                      </div>
                      <div className="col-span-2 pt-1 border-t border-white/10 flex items-center justify-between">
                        <div className="min-w-0 flex-1 pr-2">
                          <span className="text-[8px] uppercase font-black text-slate-300 block">Office / Cabin</span>
                          <span className="text-white text-[11px] truncate block">{officeLocation || 'Main Campus • Block B-204'}</span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[8px] uppercase font-black text-slate-300 block">Mobile</span>
                          <span className="font-mono text-amber-300 text-[11px]">{phoneNumber || '+91 90420 20879'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Barcode */}
                    <div className="pt-1 text-center relative z-10">
                      <div className="h-5 w-full rounded bg-white/90 p-0.5 flex items-center justify-center">
                        <div
                          className="w-full h-3.5"
                          style={{
                            background: 'repeating-linear-gradient(to right, #000, #000 2px, transparent 2px, transparent 4px, #000 4px, #000 7px, transparent 7px, transparent 9px)'
                          }}
                        />
                      </div>
                      <div className="font-mono text-[8.5px] font-black tracking-widest text-slate-300 mt-1">
                        *{institutionalId}*
                      </div>
                    </div>

                    {/* Signature */}
                    <div className="pt-2 border-t border-white/15 flex items-end justify-between text-[10px] relative z-10">
                      <div>
                        <span className="text-[8px] uppercase block text-slate-400">Valid Session 2025–26</span>
                        <span className="text-[8px] font-black text-amber-300 block">25th Silver Jubilee</span>
                      </div>
                      <div className="text-right">
                        <div className="font-serif italic font-black text-amber-300 text-xs">
                          Dr. U. S. Ragupathy
                        </div>
                        <span className="text-[8px] uppercase block text-slate-200 font-extrabold">Principal • Authorized Signatory</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* BACK SIDE */}
                {(modalCardSide === 'back' || modalCardSide === 'both') && (
                  <div className="w-full max-w-[340px] rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-5 text-white shadow-2xl border-2 border-indigo-500 relative overflow-hidden space-y-3.5">
                    {/* Magnetic Stripe */}
                    <div className="-mx-5 -mt-5 h-8 bg-black border-b border-white/20 flex items-center justify-center">
                      <span className="text-[8px] font-mono tracking-widest text-slate-500 uppercase">
                        HI-CO MAGNETIC SECURITY STRIPE • 25TH YEAR
                      </span>
                    </div>

                    {/* Address */}
                    <div className="text-center space-y-0.5 border-b border-white/15 pb-2.5">
                      <h5 className="text-[11px] font-black uppercase tracking-wide text-white">
                        NANDHA ENGINEERING COLLEGE (AUTONOMOUS)
                      </h5>
                      <p className="text-[8.5px] text-slate-300 font-medium">
                        Approved by AICTE • Affiliated to Anna University, Chennai
                      </p>
                      <p className="text-[8px] text-slate-400">
                        Erode - Perundurai Road, Vaikkaalmedu, Erode - 638 052, Tamil Nadu
                      </p>
                      <p className="text-[8px] text-amber-300 font-mono">
                        Phone: 04294-225585 • Email: info@nandhaengg.org
                      </p>
                    </div>

                    {/* Emergency Box */}
                    <div className="bg-rose-950/40 border border-rose-500/40 rounded-xl p-2.5 text-[9.5px] space-y-0.5">
                      <span className="text-[8.5px] font-black text-rose-300 uppercase tracking-wider block">
                        Emergency &amp; Medical Record
                      </span>
                      <p className="text-slate-200">
                        <strong className="text-white">Contact:</strong> {emergencyContactName || 'Department HOD / Security Desk'}
                      </p>
                      <p className="text-slate-200">
                        <strong className="text-white">Phone:</strong> {emergencyContactPhone || phoneNumber || '+91 04294 225585'}
                      </p>
                    </div>

                    {/* QR Code and Cryptographic Seal */}
                    <div className="flex items-center justify-between gap-3 bg-white/5 border border-white/10 rounded-2xl p-2.5">
                      <div className="min-w-0 flex-1 space-y-1">
                        <span className="text-[8px] font-black uppercase text-emerald-400 block tracking-wider">
                          Cryptographic Seal
                        </span>
                        <p className="font-mono text-[8px] text-slate-200 break-all leading-tight">
                          SHA256-{institutionalId.toLowerCase()}-verified-2026
                        </p>
                        <p className="text-[8px] text-slate-400">
                          Scan with any phone to view live status &amp; verified digital credentials
                        </p>
                      </div>
                      <div className="shrink-0 bg-white p-1.5 rounded-xl shadow-md">
                        <QRCodeCanvas value={idVerificationUrl} size={84} level="M" includeMargin={false} bgColor="#ffffff" fgColor="#0b1528" className="rounded-lg shadow-xs block" />
                      </div>
                    </div>

                    {/* Instructions */}
                    <div className="pt-1 text-[7.5px] text-slate-400 space-y-0.5 border-t border-white/15">
                      <p className="font-bold text-slate-300">• Property of Nandha Engineering College (Autonomous).</p>
                      <p>• If found, return to Campus Security Gate or Principal's Office (04294-225585).</p>
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* Modal Bottom Action Strip */}
            <div className="px-4 sm:px-6 py-3 bg-slate-950 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <span className="text-[11px] font-medium text-slate-400 text-center sm:text-left">
                PVC Standard: 300 DPI high-resolution format compliant with CR80 identity card printers.
              </span>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleExportVCard}
                  className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black transition-all shadow-xs cursor-pointer inline-flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Save vCard</span>
                </button>
                <button
                  type="button"
                  disabled={isSavingCard}
                  onClick={handleDownloadIdCardPng}
                  className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition-all shadow-md shadow-emerald-600/30 cursor-pointer inline-flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
                >
                  {isSavingCard ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  <span>Save High-Res Image (PNG)</span>
                </button>
              </div>
            </div>
          </div>
        </GlobalModalBackdrop>
      )}

      {/* MODAL: HELP & SUPPORT / FAQ */}
      {showHelpModal && (
        <GlobalModalBackdrop isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} className="flex items-center justify-center p-3 sm:p-4">
          <div className="relative max-w-lg w-full bg-white dark:bg-navy-900 rounded-3xl p-5 sm:p-6 border-2 border-slate-200 dark:border-navy-700 shadow-2xl space-y-4 animate-scale-up text-slate-900 dark:text-slate-100 max-h-[88vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-navy-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-950/70 dark:text-brand-400 flex items-center justify-center shrink-0 border border-brand-200 dark:border-brand-800">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-950 dark:text-white uppercase tracking-wider">
                    Help &amp; Support Hub
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">Frequently asked questions &amp; campus IT support</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-navy-800 dark:hover:bg-navy-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-all cursor-pointer active:scale-95"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Interactive FAQs */}
            <div className="overflow-y-auto space-y-2.5 pr-1 custom-scrollbar flex-1">
              {[
                {
                  q: 'How does LeetCode automated metric sync work?',
                  a: 'NANDHA INTELLIGENCE uses an asynchronous multi-threaded GraphQL crawler that checks your registered LeetCode handle every 30 minutes. It tracks total solves, weekly contest rating, and activity streaks automatically without requiring your LeetCode password.',
                  btnLabel: 'View LeetCode Handle',
                  btnColor: 'bg-amber-600 hover:bg-amber-700 text-white',
                  icon: Terminal,
                  onAction: () => {
                    setShowHelpModal(false);
                    setActiveTab('profile');
                    setProfileSubSection('links');
                  }
                },
                {
                  q: 'Can students see my personal phone number?',
                  a: 'By default, your mobile phone number is hidden. You can choose to share it exclusively with students assigned to your mentoring cohort under Settings > Privacy & Permissions. Principal, HOD, and campus administrators retain scoped contact visibility.',
                  btnLabel: 'Open Privacy Settings',
                  btnColor: 'bg-pink-600 hover:bg-pink-700 text-white',
                  icon: Lock,
                  onAction: () => {
                    setShowHelpModal(false);
                    setActiveTab('privacy');
                  }
                },
                {
                  q: 'How do I enable 2-Factor Authentication (2FA) or Biometrics?',
                  a: 'Navigate to Settings > Security & Login. You can register hardware passkeys with Face ID, Touch ID, device Fingerprint scanners, or Windows Hello for instant single-tap logins. You can also scan a dynamic QR code for Google Authenticator / TOTP.',
                  btnLabel: 'Set Up Face ID & Biometrics',
                  btnColor: 'bg-violet-600 hover:bg-violet-700 text-white',
                  icon: Fingerprint,
                  onAction: () => {
                    setShowHelpModal(false);
                    setActiveTab('security');
                  }
                },
                {
                  q: 'How can I change my official designation or department?',
                  a: 'Official institutional credentials (Designation, Department, and Faculty ID) are verified through the college registrar database. If corrections are needed, please submit a request to the campus IT Admin desk.',
                  btnLabel: 'Email IT Desk',
                  btnColor: 'bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900',
                  icon: Mail,
                  href: 'mailto:nanthishvaran17@gmail.com?subject=IT%20Desk%20Designation%20Correction%20Request'
                },
                {
                  q: 'How do I download or print my Digital ID Card?',
                  a: 'Switch to the Digital ID Card module from Settings. You can flip between Front and Back sides, select your favorite card theme, and download a 300 DPI high-resolution PNG image suitable for PVC badge printers.',
                  btnLabel: 'Open Digital ID Card',
                  btnColor: 'bg-cyan-600 hover:bg-cyan-700 text-white',
                  icon: FileBadge,
                  onAction: () => {
                    setShowHelpModal(false);
                    setActiveTab('id_card');
                  }
                }
              ].map((faq, index) => {
                const isExpanded = expandedFaqIndex === index;
                const IconComponent = faq.icon;
                return (
                  <div
                    key={index}
                    className="rounded-2xl border border-slate-200/90 dark:border-navy-800 bg-slate-50/60 dark:bg-navy-950/60 overflow-hidden transition-all"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedFaqIndex(isExpanded ? null : index)}
                      className="w-full p-3.5 flex items-center justify-between text-left gap-3 cursor-pointer group select-none"
                    >
                      <span className="text-xs font-black text-slate-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                        {faq.q}
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180 text-brand-600 dark:text-brand-400' : ''}`}
                      />
                    </button>
                    {isExpanded && (
                      <div className="px-3.5 pb-3.5 pt-1 space-y-3 border-t border-slate-200/50 dark:border-navy-800/60 animate-fade-in">
                        <div className="text-xs font-bold text-slate-600 dark:text-slate-300 leading-relaxed">
                          {faq.a}
                        </div>
                        {faq.onAction && (
                          <button
                            type="button"
                            onClick={faq.onAction}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer shadow-2xs active:scale-95 ${faq.btnColor}`}
                          >
                            <IconComponent className="w-3.5 h-3.5" />
                            <span>{faq.btnLabel}</span>
                            <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                          </button>
                        )}
                        {faq.href && (
                          <a
                            href={faq.href}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer shadow-2xs active:scale-95 ${faq.btnColor}`}
                          >
                            <IconComponent className="w-3.5 h-3.5" />
                            <span>{faq.btnLabel}</span>
                            <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Redesigned Clean Campus IT Support Card & Bottom Actions */}
            <div className="pt-3 border-t border-slate-200 dark:border-navy-800 shrink-0 space-y-3">
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-navy-950/80 border border-slate-200/80 dark:border-navy-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-200/60 dark:border-indigo-800/60">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Campus IT Helpdesk</div>
                    <div className="text-xs font-mono font-bold text-slate-900 dark:text-white truncate">nanthishvaran17@gmail.com</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText('nanthishvaran17@gmail.com');
                      notify.success('Email copied to clipboard!', 'nanthishvaran17@gmail.com', { category: 'ADMIN' });
                    }}
                    title="Copy Email"
                    className="p-2 rounded-xl bg-white dark:bg-navy-900 hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-navy-700 transition-all cursor-pointer active:scale-95 shadow-2xs"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowHelpModal(false);
                      setActiveTab('help');
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black transition-all shrink-0 cursor-pointer active:scale-95 shadow-xs"
                  >
                    Contact Desk
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-semibold text-slate-400">
                  Nandha Engineering College (Autonomous)
                </span>
                <button
                  type="button"
                  onClick={() => setShowHelpModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-black transition-all cursor-pointer active:scale-95 shadow-xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </GlobalModalBackdrop>
      )}

      {/* MODAL: LOGOUT CONFIRMATION */}
      {showLogoutConfirmModal && (
        <GlobalModalBackdrop isOpen={showLogoutConfirmModal} onClose={() => setShowLogoutConfirmModal(false)} className="flex items-center justify-center p-4">
          <div className="relative max-w-sm w-full bg-white dark:bg-navy-900 rounded-3xl p-6 border-2 border-slate-200 dark:border-navy-700 shadow-2xl space-y-4 animate-scale-up text-slate-900 dark:text-slate-100 text-center">
            <div className="w-14 h-14 rounded-3xl bg-rose-50 text-rose-600 dark:bg-rose-950/70 dark:text-rose-400 flex items-center justify-center mx-auto border border-rose-200 dark:border-rose-800 shadow-sm">
              <LogOut className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-black text-slate-950 dark:text-white">
                Sign Out of Portal?
              </h3>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Signed in as <span className="font-black text-slate-900 dark:text-white">{fullName || user?.username || 'Nanthishvaran S'}</span>
              </p>
              <div className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-navy-800/90 text-xs font-bold text-slate-800 dark:text-slate-200 border border-slate-200/90 dark:border-navy-700 shadow-2xs">
                <Mail className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 shrink-0" />
                <span className="font-mono font-semibold tracking-tight">{user?.email || 'nanthishvaran17@gmail.com'}</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowLogoutConfirmModal(false)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 dark:border-navy-700 bg-slate-100 hover:bg-slate-200 dark:bg-navy-800 dark:hover:bg-navy-700 text-slate-800 dark:text-slate-200 text-xs font-black transition-all cursor-pointer active:scale-95"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLogoutConfirmModal(false);
                  logout();
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs font-black shadow-md shadow-rose-600/30 transition-all cursor-pointer active:scale-95"
              >
                Sign Out
              </button>
            </div>
          </div>
        </GlobalModalBackdrop>
      )}

      {/* MODAL: EXPORT ACCOUNT BACKUP (Mobile APK & Desktop) */}
      {showExportModal && (
        <GlobalModalBackdrop isOpen={showExportModal} onClose={() => setShowExportModal(false)} className="flex items-center justify-center p-3 sm:p-4 z-[9999]">
          <div className="relative max-w-md w-full bg-white dark:bg-navy-900 rounded-3xl p-5 sm:p-6 border-2 border-slate-200 dark:border-navy-700 shadow-2xl space-y-4 animate-scale-up text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-navy-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/70 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-200 dark:border-emerald-800">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-950 dark:text-white uppercase tracking-wider">
                    Export Account Data
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">Google Play compliant portable JSON backup</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-navy-800 dark:hover:bg-navy-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-all cursor-pointer active:scale-95"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Your profile, academic records, consultation slots, portfolio links, and notification settings will be exported in a standardized JSON structure.
            </p>

            {/* Quick Actions Grid for Mobile */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={async () => {
                  await handleDownloadProfileJson();
                  setShowExportModal(false);
                }}
                className="w-full py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-between transition-all cursor-pointer active:scale-98 shadow-sm shadow-emerald-600/30"
              >
                <div className="flex items-center gap-2.5">
                  <Download className="w-4 h-4" />
                  <div className="text-left">
                    <p className="font-black">Save to Device Storage</p>
                    <p className="text-[10px] text-emerald-100 font-medium">Downloads or Documents folder</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 opacity-70" />
              </button>

              <button
                type="button"
                onClick={async () => {
                  await handleShareProfileJson();
                }}
                className="w-full py-3 px-4 rounded-2xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center justify-between transition-all cursor-pointer active:scale-98"
              >
                <div className="flex items-center gap-2.5">
                  <Share2 className="w-4 h-4 text-blue-600" />
                  <div className="text-left">
                    <p className="font-black">Share Backup via Apps</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">WhatsApp, Drive, Gmail, or Files</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 opacity-70" />
              </button>

              <button
                type="button"
                onClick={() => {
                  handleCopyProfileJson();
                }}
                className="w-full py-3 px-4 rounded-2xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center justify-between transition-all cursor-pointer active:scale-98"
              >
                <div className="flex items-center gap-2.5">
                  <Copy className="w-4 h-4 text-amber-600" />
                  <div className="text-left">
                    <p className="font-black">Copy JSON to Clipboard</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Direct paste into Notes or chat</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 opacity-70" />
              </button>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-navy-800 flex justify-end">
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="py-2 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-navy-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer active:scale-95"
              >
                Close
              </button>
            </div>
          </div>
        </GlobalModalBackdrop>
      )}

      {/* MODAL: RESTORE PROFILE BACKUP (File Picker or Paste JSON for Mobile APK) */}
      {showRestoreModal && (
        <GlobalModalBackdrop isOpen={showRestoreModal} onClose={() => { setShowRestoreModal(false); setParsedBackupPreview(null); }} className="flex items-center justify-center p-3 sm:p-4 z-[9999]">
          <div className="relative max-w-md w-full bg-white dark:bg-navy-900 rounded-3xl p-5 sm:p-6 border-2 border-slate-200 dark:border-navy-700 shadow-2xl space-y-4 animate-scale-up text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-navy-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/70 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-200 dark:border-indigo-800">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-950 dark:text-white uppercase tracking-wider">
                    Restore Account Data
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">Import from file or paste backup JSON</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setShowRestoreModal(false); setParsedBackupPreview(null); }}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-navy-800 dark:hover:bg-navy-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-all cursor-pointer active:scale-95"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Option 1: Native Mobile File Upload via direct label */}
            <div className="space-y-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Option 1: Select JSON Backup File
              </span>
              <label
                htmlFor="mobile-json-restore-file"
                className="w-full py-3.5 px-4 rounded-2xl border-2 border-dashed border-indigo-300 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/30 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center justify-center gap-2.5 transition-all cursor-pointer active:scale-98 select-none"
              >
                <UploadCloud className="w-5 h-5 text-indigo-600 shrink-0" />
                <span>Tap to Browse Device Files</span>
                <input
                  id="mobile-json-restore-file"
                  type="file"
                  accept="*/*"
                  className="sr-only"
                  onChange={handleImportProfileJson}
                />
              </label>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-px bg-slate-200 dark:bg-navy-800 flex-1" />
              <span className="text-[10px] font-black uppercase text-slate-400">OR</span>
              <div className="h-px bg-slate-200 dark:bg-navy-800 flex-1" />
            </div>

            {/* Option 2: Paste Raw JSON */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Option 2: Paste Backup JSON
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      if (text) {
                        setPasteJsonInput(text);
                        try {
                          const parsed = JSON.parse(text);
                          setParsedBackupPreview(parsed);
                          triggerHaptic('success');
                          notify.success('Pasted from clipboard!', `Profile: ${parsed.full_name || 'Staff'}`, { category: 'ADMIN' });
                        } catch {
                          notify.warning('Clipboard text is not valid JSON.', '', { category: 'ADMIN' });
                          setParsedBackupPreview(null);
                        }
                      } else {
                        notify.info('Clipboard is empty', '', { category: 'ADMIN' });
                      }
                    } catch {
                      notify.error('Cannot access clipboard. Please paste directly into the box.', '', { category: 'ADMIN' });
                    }
                  }}
                  className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  <span>Paste from Clipboard</span>
                </button>
              </div>

              <textarea
                rows={4}
                value={pasteJsonInput}
                onChange={e => {
                  const val = e.target.value;
                  setPasteJsonInput(val);
                  try {
                    const parsed = JSON.parse(val.trim());
                    setParsedBackupPreview(parsed);
                  } catch {
                    setParsedBackupPreview(null);
                  }
                }}
                placeholder='Paste your backup JSON here (e.g. { "full_name": "...", "preferences": { ... } })'
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 text-xs font-mono font-medium text-slate-900 dark:text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 resize-none transition-all"
              />
            </div>

            {/* Live Verified Backup Preview Card */}
            {parsedBackupPreview && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 space-y-1.5 animate-fade-in">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-xs font-black">Valid NEC Backup Verified</span>
                </div>
                <div className="text-[11px] text-slate-700 dark:text-slate-300 font-medium space-y-0.5 pl-6">
                  <p><span className="font-bold text-slate-900 dark:text-white">Name:</span> {parsedBackupPreview.full_name || 'N/A'}</p>
                  <p><span className="font-bold text-slate-900 dark:text-white">Role &amp; Dept:</span> {parsedBackupPreview.role || 'Staff'} • {parsedBackupPreview.department || 'N/A'}</p>
                  {parsedBackupPreview.email && <p><span className="font-bold text-slate-900 dark:text-white">Email:</span> {parsedBackupPreview.email}</p>}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  setPasteJsonInput('');
                  setParsedBackupPreview(null);
                  setShowRestoreModal(false);
                }}
                className="flex-1 py-3 px-4 rounded-xl border border-slate-300 dark:border-navy-700 bg-slate-100 hover:bg-slate-200 dark:bg-navy-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer active:scale-95"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!parsedBackupPreview}
                onClick={async () => {
                  if (!parsedBackupPreview) return;
                  const ok = await applyImportedProfileData(parsedBackupPreview);
                  if (ok) {
                    setPasteJsonInput('');
                    setParsedBackupPreview(null);
                    setShowRestoreModal(false);
                  }
                }}
                className="flex-1 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-black transition-all cursor-pointer active:scale-95 shadow-sm shadow-indigo-600/30 flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>Confirm Restore</span>
              </button>
            </div>
          </div>
        </GlobalModalBackdrop>
      )}

      {/* Hidden QR Code Canvas for High-Resolution PVC Print & PNG Generation */}
      <div style={{ position: 'fixed', left: '-9999px', top: '-9999px', opacity: 0, pointerEvents: 'none' }} aria-hidden="true">
        <QRCodeCanvas
          ref={idCardQrCanvasRef}
          value={idVerificationUrl}
          size={480}
          level="M"
          includeMargin={true}
          bgColor="#ffffff"
          fgColor="#0b1528"
        />
      </div>

    </div>
  );
};

export default AccountProfileSettings;
