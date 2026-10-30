import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, MessageCircle, Copy, Check, ExternalLink, ArrowRight, ArrowLeft, 
  Download, Users, Sparkles, Smartphone, CheckCircle2, RotateCcw, Edit3,
  Phone, Send, AlertTriangle, CheckCircle, Search, Mail
} from 'lucide-react';
import { FacultyActionItem } from '../services/intelligenceService';
import { triggerHaptic } from '../utils/haptics';
import { WHATSAPP_TEMPLATES } from './StudentWhatsAppModal';
import { useEscapeKey } from '../hooks/useEscapeKey';

interface BulkWhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedStudents: FacultyActionItem[];
}

export const BulkWhatsAppModal: React.FC<BulkWhatsAppModalProps> = ({
  isOpen,
  onClose,
  selectedStudents
}) => {
  const [activeTab, setActiveTab] = useState<'queue' | 'broadcast'>('queue');
  useEscapeKey(onClose, isOpen);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('practice_nudge');
  const [lang, setLang] = useState<'en' | 'ta'>('en');
  const [customText, setCustomText] = useState<string>(WHATSAPP_TEMPLATES[WHATSAPP_TEMPLATES.length - 1].text);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [sentStudentIds, setSentStudentIds] = useState<Set<number>>(new Set());
  const [isEditingMessage, setIsEditingMessage] = useState<boolean>(false);
  const [editedCustomMessage, setEditedCustomMessage] = useState<string>('');
  const [copiedNumbers, setCopiedNumbers] = useState<boolean>(false);
  const [copiedMessage, setCopiedMessage] = useState<boolean>(false);
  const [copiedEmails, setCopiedEmails] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Auto-hide MobileBottomNav while modal is open
  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;
    document.body.classList.add('hide-mobile-bottom-nav');
    window.dispatchEvent(new CustomEvent('hide_mobile_bottom_nav'));

    return () => {
      document.body.classList.remove('hide-mobile-bottom-nav');
      window.dispatchEvent(new CustomEvent('show_mobile_bottom_nav'));
    };
  }, [isOpen]);

  const totalStudents = selectedStudents.length;
  const currentStudent = selectedStudents[currentIndex] || selectedStudents[0];

  // Active template text based on language
  const activeTemplateText = useMemo(() => {
    if (selectedTemplateId === 'custom') {
      return customText;
    }
    const tpl = WHATSAPP_TEMPLATES.find(t => t.id === selectedTemplateId) || WHATSAPP_TEMPLATES[0];
    return lang === 'ta' ? (tpl.textTa || tpl.text) : tpl.text;
  }, [selectedTemplateId, customText, lang]);

  // Formatter for individual student
  const formatMessageForStudent = (student: FacultyActionItem) => {
    if (!student) return '';
    const name = student.student_name || 'Student';
    const solved = String(student.total_solved || 0);
    const nextMilestone = String(Math.ceil(((student.total_solved || 0) + 10) / 10) * 10);
    return activeTemplateText
      .replace(/{name}/g, name)
      .replace(/{student_name}/g, name)
      .replace(/{solved}/g, solved)
      .replace(/{next_milestone}/g, nextMilestone);
  };

  // Formatter for broadcast (group/channel context)
  const formatBroadcastMessage = () => {
    const defaultName = lang === 'ta' ? 'மாணவர்களே' : 'Students';
    return activeTemplateText
      .replace(/{name}/g, defaultName)
      .replace(/{student_name}/g, defaultName)
      .replace(/{solved}/g, 'your current')
      .replace(/{next_milestone}/g, 'your next target');
  };

  // Sync edited message when student, template, or language changes
  useEffect(() => {
    if (currentStudent) {
      setEditedCustomMessage(formatMessageForStudent(currentStudent));
    }
  }, [currentStudent, selectedTemplateId, lang, customText]);

  // Clean phone numbers
  // Clean student email list for BCC
  const allStudentEmails = useMemo(() => {
    return selectedStudents
      .map(s => (s as any).email || (s as any).student_email || (s.reg_no ? `${s.reg_no.toLowerCase().trim()}@nandhaengg.org` : ''))
      .filter(Boolean) as string[];
  }, [selectedStudents]);

  const allPhoneNumbersFormatted = useMemo(() => {
    return selectedStudents
      .map(s => {
        const raw = (s.phone_number || '').replace(/\D/g, '');
        if (raw.length === 10) return `91${raw}`;
        if (raw.length > 10) return raw;
        return null;
      })
      .filter(Boolean) as string[];
  }, [selectedStudents]);

  // Filtered students for broadcast roster
  const filteredStudents = useMemo(() => {
    if (!searchTerm.trim()) return selectedStudents;
    const q = searchTerm.toLowerCase();
    return selectedStudents.filter(s => 
      (s.student_name || '').toLowerCase().includes(q) ||
      (s.reg_no || '').toLowerCase().includes(q) ||
      (s.department_code || '').toLowerCase().includes(q)
    );
  }, [selectedStudents, searchTerm]);

  if (!isOpen || typeof document === 'undefined') return null;

  const handleSendCurrentAndNext = () => {
    if (!currentStudent) return;
    triggerHaptic('success');
    const rawPhone = (currentStudent.phone_number || '').replace(/\D/g, '');
    const cleanPhone = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone;
    const finalMsg = isEditingMessage && editedCustomMessage ? editedCustomMessage : formatMessageForStudent(currentStudent);
    const encoded = encodeURIComponent(finalMsg);

    // Mark current as sent
    setSentStudentIds(prev => new Set(prev).add(currentStudent.id));

    // Open WhatsApp
    if (cleanPhone && cleanPhone.length >= 10) {
      window.open(`https://wa.me/${cleanPhone}?text=${encoded}`, '_blank');
    } else {
      window.open(`https://wa.me/?text=${encoded}`, '_blank');
    }

    // Auto-advance
    if (currentIndex < totalStudents - 1) {
      setCurrentIndex(prev => prev + 1);
      setIsEditingMessage(false);
    }
  };

  const handleSendIndividualStudent = (student: FacultyActionItem) => {
    triggerHaptic('success');
    const rawPhone = (student.phone_number || '').replace(/\D/g, '');
    const cleanPhone = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone;
    const finalMsg = formatMessageForStudent(student);
    const encoded = encodeURIComponent(finalMsg);

    setSentStudentIds(prev => new Set(prev).add(student.id));

    if (cleanPhone && cleanPhone.length >= 10) {
      window.open(`https://wa.me/${cleanPhone}?text=${encoded}`, '_blank');
    } else {
      window.open(`https://wa.me/?text=${encoded}`, '_blank');
    }
  };

  const handleSendEmailCurrent = () => {
    if (!currentStudent) return;
    triggerHaptic('success');
    const tpl = WHATSAPP_TEMPLATES.find(t => t.id === selectedTemplateId) || WHATSAPP_TEMPLATES[0];
    const subject = encodeURIComponent(`[Nandha Engineering College] LeetCode Mentoring: ${lang === 'ta' && tpl.titleTa ? tpl.titleTa : tpl.title}`);
    const finalMsg = isEditingMessage && editedCustomMessage ? editedCustomMessage : formatMessageForStudent(currentStudent);
    const body = encodeURIComponent(finalMsg);
    const email = (currentStudent as any).email || (currentStudent as any).student_email || (currentStudent.reg_no ? `${currentStudent.reg_no.toLowerCase().trim()}@nandhaengg.org` : '');
    
    setSentStudentIds(prev => new Set(prev).add(currentStudent.id));
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank');

    if (currentIndex < totalStudents - 1) {
      setCurrentIndex(prev => prev + 1);
      setIsEditingMessage(false);
    }
  };

  const handleCopyEmails = () => {
    if (allStudentEmails.length === 0) return;
    triggerHaptic('selection');
    navigator.clipboard.writeText(allStudentEmails.join(', '));
    setCopiedEmails(true);
    setTimeout(() => setCopiedEmails(false), 2500);
  };

  const handleOpenBccMailClient = () => {
    if (allStudentEmails.length === 0) return;
    triggerHaptic('selection');
    const tpl = WHATSAPP_TEMPLATES.find(t => t.id === selectedTemplateId) || WHATSAPP_TEMPLATES[0];
    const subject = encodeURIComponent(`[Nandha Engineering College] LeetCode Mentoring Announcement: ${lang === 'ta' && tpl.titleTa ? tpl.titleTa : tpl.title}`);
    const body = encodeURIComponent(formatBroadcastMessage());
    const bccList = allStudentEmails.join(',');
    window.open(`mailto:?bcc=${encodeURIComponent(bccList)}&subject=${subject}&body=${body}`, '_blank');
  };

  const handleCopyNumbers = () => {
    if (allPhoneNumbersFormatted.length === 0) return;
    triggerHaptic('selection');
    navigator.clipboard.writeText(allPhoneNumbersFormatted.join(', '));
    setCopiedNumbers(true);
    setTimeout(() => setCopiedNumbers(false), 2500);
  };

  const handleCopyMessage = () => {
    triggerHaptic('selection');
    navigator.clipboard.writeText(formatBroadcastMessage());
    setCopiedMessage(true);
    setTimeout(() => setCopiedMessage(false), 2500);
  };

  const handleExportCSV = () => {
    triggerHaptic('selection');
    const headers = ['Register Number', 'Student Name', 'Department', 'Year', 'Problems Solved', 'Phone Number', 'Assigned Mentor', 'Outreach Status'];
    const rows = selectedStudents.map(s => [
      `"${s.reg_no || ''}"`,
      `"${s.student_name || ''}"`,
      `"${s.department_code || ''}"`,
      `"${s.year_level || ''}"`,
      s.total_solved || 0,
      `"${s.phone_number || ''}"`,
      `"${s.assigned_faculty_name || 'Unassigned'}"`,
      sentStudentIds.has(s.id) ? '"Sent"' : '"Pending"'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `whatsapp_mentoring_dispatch_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const activeMessageText = isEditingMessage && editedCustomMessage
    ? editedCustomMessage
    : formatMessageForStudent(currentStudent);

  const rawCurrentPhone = (currentStudent?.phone_number || '').replace(/\D/g, '');
  const cleanCurrentPhone = rawCurrentPhone.length === 10 ? `91${rawCurrentPhone}` : rawCurrentPhone;
  const hasValidPhone = cleanCurrentPhone && cleanCurrentPhone.length >= 10;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      data-modal-active="true"
      style={{ zIndex: 99999999 }}
      className="fixed inset-0 z-[99999999] flex items-stretch sm:items-center justify-center p-0 sm:p-4 bg-slate-950/90 dark:bg-black/95 backdrop-blur-xl animate-fade-in"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full h-[100dvh] sm:h-auto max-w-2xl sm:max-h-[92vh] bg-white dark:bg-navy-950 rounded-none sm:rounded-3xl border-0 sm:border border-slate-200 dark:border-navy-800 shadow-2xl overflow-hidden flex flex-col">
        
        {/* Mobile Pull Handle */}
        <div className="w-10 h-1.5 bg-slate-300 dark:bg-navy-700 rounded-full mx-auto my-2 sm:hidden shrink-0" />

        {/* Modal Top Header */}
        <div className="p-3.5 sm:p-5 border-b border-slate-100 dark:border-navy-800 flex items-center justify-between shrink-0 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/30 shrink-0">
              <MessageCircle size={22} className="stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-display font-black text-base sm:text-lg text-slate-900 dark:text-white truncate">
                  Bulk WhatsApp Mentoring Dispatch
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                  {totalStudents} Selected
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">
                Send mentoring reminders and weekly contest nudges to {totalStudents} students
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-800 transition cursor-pointer"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher & Bilingual Toggle Bar */}
        <div className="p-2 bg-slate-100 dark:bg-navy-900 border-b border-slate-200 dark:border-navy-800 shrink-0 flex items-center justify-between gap-2 flex-wrap">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 flex-1 min-w-[240px]">
            <button
              type="button"
              onClick={() => { triggerHaptic('selection'); setActiveTab('queue'); }}
              className={`flex-1 py-1.5 sm:py-2 px-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer touch-manipulation ${
                activeTab === 'queue'
                  ? 'bg-white dark:bg-navy-800 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Smartphone size={14} />
              <span>1-Tap Queue ({sentStudentIds.size}/{totalStudents})</span>
            </button>
            <button
              type="button"
              onClick={() => { triggerHaptic('selection'); setActiveTab('broadcast'); }}
              className={`flex-1 py-1.5 sm:py-2 px-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer touch-manipulation ${
                activeTab === 'broadcast'
                  ? 'bg-white dark:bg-navy-800 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Users size={14} />
              <span>Broadcast ({allPhoneNumbersFormatted.length})</span>
            </button>
          </div>

          {/* Bilingual Toggle Pill [ EN | தமிழ் (T) ] */}
          <div className="inline-flex items-center bg-white dark:bg-navy-800 p-0.5 rounded-xl border border-slate-200 dark:border-navy-700 shrink-0 shadow-2xs">
            <button
              type="button"
              onClick={() => { triggerHaptic('selection'); setLang('en'); }}
              className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                lang === 'en'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => { triggerHaptic('selection'); setLang('ta'); }}
              className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                lang === 'ta'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              தமிழ் (T)
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-3.5 sm:p-5 overflow-y-auto space-y-4 flex-1 custom-scrollbar">

          {/* TAB 1: ONE-TAP STEP-BY-STEP QUEUE */}
          {activeTab === 'queue' && (
            <div className="space-y-4 animate-fade-in">
              {currentStudent ? (
                /* ACTIVE STUDENT CARD IS FIRST AND PROMINENT */
                <div className="p-4 rounded-2xl border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-50/60 via-white to-teal-50/30 dark:from-navy-900 dark:via-navy-950 dark:to-emerald-950/20 space-y-3.5 shadow-sm">
                  
                  {/* Queue Counter & Progress Header */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                      <span className="text-xs font-black text-emerald-800 dark:text-emerald-300 font-mono tracking-tight">
                        QUEUE POSITION: {currentIndex + 1} OF {totalStudents}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {sentStudentIds.has(currentStudent.id) ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 flex items-center gap-1">
                          <CheckCircle2 size={11} /> Sent
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-navy-800">
                          Pending
                        </span>
                      )}
                      <span className="text-[11px] font-mono font-bold text-slate-400">
                        ({sentStudentIds.size}/{totalStudents} completed)
                      </span>
                    </div>
                  </div>

                  {/* Interactive Queue Stepper Pills */}
                  {totalStudents > 1 && totalStudents <= 25 && (
                    <div className="flex items-center gap-1.5 overflow-x-auto py-1 custom-scrollbar">
                      {selectedStudents.map((s, idx) => {
                        const isCurrent = idx === currentIndex;
                        const isSent = sentStudentIds.has(s.id);
                        return (
                          <button
                            key={s.id || idx}
                            type="button"
                            onClick={() => { triggerHaptic('selection'); setCurrentIndex(idx); }}
                            className={`min-w-[28px] h-7 px-1.5 rounded-lg text-xs font-mono font-black transition-all flex items-center justify-center gap-0.5 cursor-pointer touch-manipulation ${
                              isCurrent
                                ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-500/40 scale-105'
                                : isSent
                                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                                : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                            }`}
                            title={`Jump to ${s.student_name || 'Student'}`}
                          >
                            {isSent ? <Check size={11} className="stroke-[3]" /> : idx + 1}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Progress Line */}
                  <div className="w-full bg-slate-200 dark:bg-navy-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${((currentIndex + 1) / Math.max(1, totalStudents)) * 100}%` }}
                    />
                  </div>

                  {/* Current Student Profile Box */}
                  <div className="flex items-start justify-between gap-3 bg-white/90 dark:bg-navy-900/90 p-3.5 rounded-xl border border-slate-200/80 dark:border-navy-700 shadow-2xs">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-black text-xs flex items-center justify-center shrink-0">
                          {(currentStudent.student_name || 'S').charAt(0).toUpperCase()}
                        </span>
                        <h4 className="font-display font-black text-sm sm:text-base text-slate-900 dark:text-white truncate">
                          {currentStudent.student_name}
                        </h4>
                      </div>
                      <p className="text-xs font-mono font-bold text-slate-500 truncate">
                        {currentStudent.reg_no} &bull; {currentStudent.department_code} &bull; {currentStudent.year_level}
                      </p>
                      <div className="mt-1 space-y-0.5">
                        <p className="text-[11.5px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5 flex-wrap">
                          <span>Phone:</span>
                          <strong className="font-mono text-emerald-600 dark:text-emerald-400">
                            {hasValidPhone ? `+${cleanCurrentPhone}` : (currentStudent.phone_number || 'No Phone on Record')}
                          </strong>
                          {!hasValidPhone && (
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-200 font-medium">
                              Share Sheet Fallback
                            </span>
                          )}
                        </p>
                        <p className="text-[11.5px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                          <span>Email:</span>
                          <span className="font-mono text-indigo-600 dark:text-indigo-400 text-xs">
                            {(currentStudent as any).email || (currentStudent.reg_no ? `${currentStudent.reg_no.toLowerCase().trim()}@nandhaengg.org` : 'N/A')}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-[10px] font-bold uppercase text-slate-400">Total Solved</div>
                      <div className="font-mono font-black text-lg text-emerald-600 dark:text-emerald-400">
                        {currentStudent.total_solved || 0}
                      </div>
                      <div className="text-[10px] text-slate-500 font-bold">
                        Rating: {currentStudent.current_rating || 0}
                      </div>
                    </div>
                  </div>

                  {/* Message Preview Box */}
                  <div className="p-3.5 rounded-xl bg-emerald-50/80 dark:bg-navy-900/90 border border-emerald-200/80 dark:border-emerald-900/50 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                        Personalized Message ({lang === 'ta' ? 'தமிழ்' : 'English'}):
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsEditingMessage(!isEditingMessage)}
                        className="text-[11px] font-bold text-slate-500 hover:text-emerald-600 transition flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 size={11} />
                        <span>{isEditingMessage ? 'Done Editing' : 'Edit Text'}</span>
                      </button>
                    </div>

                    {isEditingMessage ? (
                      <textarea
                        value={editedCustomMessage}
                        onChange={(e) => setEditedCustomMessage(e.target.value)}
                        rows={3}
                        className="w-full p-2.5 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-white dark:bg-navy-950 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    ) : (
                      <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-sans italic">
                        &ldquo;{activeMessageText}&rdquo;
                      </p>
                    )}
                  </div>

                  {/* Primary 1-Tap Action Buttons (WhatsApp + Email) */}
                  <div className="pt-1 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSendEmailCurrent}
                      className="min-h-[48px] px-3.5 sm:px-4 rounded-xl border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 active:scale-95 text-indigo-700 dark:text-indigo-300 font-black text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                      title="Send via Email and advance to next student"
                    >
                      <Mail size={16} />
                      <span className="hidden sm:inline">Send</span> Email &rarr;
                    </button>

                    <button
                      type="button"
                      onClick={handleSendCurrentAndNext}
                      className="flex-1 min-h-[48px] py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-xs sm:text-sm shadow-md shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer touch-manipulation"
                    >
                      <MessageCircle size={18} className="stroke-[2.5]" />
                      <span>Send WhatsApp &amp; Next Student &rarr;</span>
                    </button>
                  </div>

                  {/* Stepper Controls */}
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500 pt-1">
                    <button
                      type="button"
                      onClick={() => { triggerHaptic('selection'); setCurrentIndex(prev => Math.max(0, prev - 1)); }}
                      disabled={currentIndex === 0}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-navy-700 hover:bg-slate-100 dark:hover:bg-navy-800 disabled:opacity-40 transition cursor-pointer flex items-center gap-1"
                    >
                      <ArrowLeft size={13} /> Prev
                    </button>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono">
                        Student {currentIndex + 1} of {totalStudents}
                      </span>
                      <button
                        type="button"
                        onClick={() => { triggerHaptic('selection'); setCurrentIndex(0); setSentStudentIds(new Set()); }}
                        className="text-[10px] text-slate-400 hover:text-slate-700 dark:hover:text-white flex items-center gap-0.5 cursor-pointer"
                        title="Restart Queue from beginning"
                      >
                        <RotateCcw size={10} /> Reset
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => { triggerHaptic('selection'); setCurrentIndex(prev => Math.min(totalStudents - 1, prev + 1)); }}
                      disabled={currentIndex >= totalStudents - 1}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-navy-700 hover:bg-slate-100 dark:hover:bg-navy-800 disabled:opacity-40 transition cursor-pointer flex items-center gap-1"
                    >
                      Skip / Next <ArrowRight size={13} />
                    </button>
                  </div>

                </div>
              ) : (
                <div className="p-8 text-center text-slate-500 text-xs font-bold">
                  No students available in the queue.
                </div>
              )}

              {/* TEMPLATE SELECTOR BELOW THE ACTIVE STUDENT */}
              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-navy-800">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Switch Message Template (10 Available)
                  </label>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                    Language: {lang === 'ta' ? 'தமிழ்' : 'English'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {WHATSAPP_TEMPLATES.map(tpl => {
                    const isSelected = selectedTemplateId === tpl.id;
                    const title = lang === 'ta' && tpl.titleTa ? tpl.titleTa : tpl.title;
                    const snippet = lang === 'ta' && tpl.textTa ? tpl.textTa : tpl.text;

                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => { triggerHaptic('selection'); setSelectedTemplateId(tpl.id); }}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer text-xs flex flex-col justify-between touch-manipulation ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-200 ring-2 ring-emerald-500/20 font-bold'
                            : 'border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 text-slate-700 dark:text-slate-300 hover:border-slate-300 font-medium'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1 gap-1">
                          <span className="font-black truncate">{title}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase shrink-0 border ${tpl.categoryColor}`}>
                            {tpl.category}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                          {snippet}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {/* Custom text box if custom template selected */}
                {selectedTemplateId === 'custom' && (
                  <div className="space-y-1 pt-1">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 flex items-center justify-between">
                      <span>Custom Template Text:</span>
                      <span className="text-[10px] text-slate-400 font-mono">Use {'{name}'} and {'{solved}'}</span>
                    </label>
                    <textarea
                      value={customText}
                      onChange={(e) => setCustomText(e.target.value)}
                      rows={3}
                      className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: BROADCAST LIST MODE (ALL AT ONCE) */}
          {activeTab === 'broadcast' && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-800 space-y-3.5">
                
                {/* Broadcast Header */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h4 className="font-display font-black text-sm sm:text-base text-slate-900 dark:text-white">
                      WhatsApp Broadcast Dispatch Center
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Dispatch simultaneously to all {totalStudents} students or copy their contacts in 1-click
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-mono font-black bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    {allPhoneNumbersFormatted.length} / {totalStudents} Phones Ready
                  </span>
                </div>

                {/* Broadcast Message Preview & Selector */}
                <div className="p-3.5 rounded-xl bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10.5px] font-black uppercase tracking-wider text-slate-500">
                      Broadcast Template ({lang === 'ta' ? 'தமிழ்' : 'English'}):
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedTemplateId}
                        onChange={(e) => setSelectedTemplateId(e.target.value)}
                        className="text-xs font-bold bg-slate-100 dark:bg-navy-800 border border-slate-300 dark:border-navy-600 rounded-lg px-2 py-1 text-slate-800 dark:text-white"
                      >
                        {WHATSAPP_TEMPLATES.map(tpl => (
                          <option key={tpl.id} value={tpl.id}>
                            {lang === 'ta' && tpl.titleTa ? tpl.titleTa : tpl.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <p className="text-xs text-slate-700 dark:text-slate-300 italic bg-slate-50 dark:bg-navy-900 p-2.5 rounded-lg border border-slate-100 dark:border-navy-800 leading-relaxed font-sans">
                    &ldquo;{formatBroadcastMessage()}&rdquo;
                  </p>
                </div>

                {/* Primary Action Buttons Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={handleCopyNumbers}
                    disabled={allPhoneNumbersFormatted.length === 0}
                    className="min-h-[46px] py-2.5 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-black text-xs shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 touch-manipulation"
                  >
                    {copiedNumbers ? <Check size={16} /> : <Copy size={16} />}
                    <span>{copiedNumbers ? 'Copied Phone Numbers!' : `1. Copy All ${allPhoneNumbersFormatted.length} Numbers`}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyMessage}
                    className="min-h-[46px] py-2.5 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer touch-manipulation"
                  >
                    {copiedMessage ? <Check size={16} /> : <Copy size={16} />}
                    <span>{copiedMessage ? 'Announcement Copied!' : `2. Copy Message (${lang === 'ta' ? 'தமிழ்' : 'EN'})`}</span>
                  </button>
                </div>



                {/* Comma-separated Phone Numbers Box */}
                <div className="space-y-1 pt-1">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                    Comma-separated Phone Numbers ({allPhoneNumbersFormatted.length}):
                  </label>
                  <div className="p-3 rounded-xl bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 max-h-24 overflow-y-auto font-mono text-xs text-slate-700 dark:text-slate-300 select-all custom-scrollbar break-all">
                    {allPhoneNumbersFormatted.length > 0 ? (
                      allPhoneNumbersFormatted.join(', ')
                    ) : (
                      <span className="text-slate-400 italic">No phone numbers found for the selected students.</span>
                    )}
                  </div>
                </div>

                {/* Student Recipient Roster Table */}
                <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-navy-800">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Selected Recipient Roster ({totalStudents})
                    </span>
                    
                    {/* Quick Search */}
                    <div className="relative min-w-[160px]">
                      <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search student..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-7 pr-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-slate-800 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="max-h-44 overflow-y-auto border border-slate-200 dark:border-navy-700 rounded-xl divide-y divide-slate-100 dark:divide-navy-800 custom-scrollbar">
                    {filteredStudents.map((s, idx) => {
                      const rawPhone = (s.phone_number || '').replace(/\D/g, '');
                      const cleanPhone = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone;
                      const hasPhone = cleanPhone && cleanPhone.length >= 10;
                      const isSent = sentStudentIds.has(s.id);

                      return (
                        <div key={s.id || idx} className="p-2.5 flex items-center justify-between gap-2 bg-white dark:bg-navy-950 hover:bg-slate-50 dark:hover:bg-navy-900 transition">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                                {s.student_name}
                              </span>
                              {isSent && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                  SENT
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] font-mono text-slate-400">
                              {s.reg_no} &bull; {s.department_code} &bull; Solved: {s.total_solved || 0}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono text-xs text-slate-600 dark:text-slate-300">
                              {hasPhone ? `+${cleanPhone}` : <em className="text-slate-400">No phone</em>}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleSendIndividualStudent(s)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white dark:bg-emerald-950 dark:text-emerald-300 dark:hover:bg-emerald-600 dark:hover:text-white text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                              title="Direct 1-click WhatsApp"
                            >
                              <Send size={11} /> Send
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Step-by-Step Instructions */}
                <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-200 text-xs space-y-1.5">
                  <div className="font-black flex items-center gap-1.5">
                    <Sparkles size={14} className="text-amber-600" />
                    <span>How to Broadcast to {totalStudents} Students in 60 seconds:</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-[11.5px] text-slate-700 dark:text-slate-300 font-medium">
                    <li>Click <strong>&ldquo;1. Copy All Numbers&rdquo;</strong> to copy phone numbers.</li>
                    <li>Open WhatsApp on mobile &rarr; Menu &rarr; <strong>&ldquo;New Broadcast&rdquo;</strong> (or create a temporary mentoring announcement group).</li>
                    <li>Paste the copied announcement message and hit send.</li>
                    <li>Each student gets the mentoring alert privately on their personal WhatsApp.</li>
                  </ol>
                </div>

              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-3.5 sm:p-4 pb-[max(1.25rem,env(safe-area-inset-bottom,1.25rem))] border-t border-slate-100 dark:border-navy-800 bg-slate-50/80 dark:bg-navy-950/80 flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-navy-700 hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="Download CSV for records"
          >
            <Download size={14} />
            <span>Export Contacts CSV</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-900 text-xs font-black transition cursor-pointer active:scale-95 shadow-sm"
          >
            Done
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
};
