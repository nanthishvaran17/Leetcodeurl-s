import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, MessageCircle, Copy, Check, ExternalLink, ArrowRight, ArrowLeft, 
  Download, Users, Sparkles, Smartphone, CheckCircle2, AlertCircle, RefreshCw
} from 'lucide-react';
import { FacultyActionItem } from '../services/intelligenceService';
import { SwipeHandle } from './SwipeHandle';
import { WHATSAPP_TEMPLATES } from './StudentWhatsAppModal';

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
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('practice_nudge');
  const [customText, setCustomText] = useState<string>(WHATSAPP_TEMPLATES[WHATSAPP_TEMPLATES.length - 1].text);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [sentStudentIds, setSentStudentIds] = useState<Set<number>>(new Set());
  const [copiedNumbers, setCopiedNumbers] = useState<boolean>(false);
  const [copiedMessage, setCopiedMessage] = useState<boolean>(false);

  const activeTemplate = useMemo(() => {
    if (selectedTemplateId === 'custom') {
      return customText;
    }
    return WHATSAPP_TEMPLATES.find(t => t.id === selectedTemplateId)?.text || WHATSAPP_TEMPLATES[0].text;
  }, [selectedTemplateId, customText]);

  // Clean phone numbers list
  const validStudentsWithPhone = useMemo(() => {
    return selectedStudents.filter(s => {
      const raw = (s.phone_number || '').replace(/\D/g, '');
      return raw.length >= 10;
    });
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

    // Auto-hide MobileBottomNav on mobile while Bulk WhatsApp modal is open
  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;
    document.body.classList.add('hide-mobile-bottom-nav');
    window.dispatchEvent(new CustomEvent('hide_mobile_bottom_nav'));

    return () => {
      document.body.classList.remove('hide-mobile-bottom-nav');
      window.dispatchEvent(new CustomEvent('show_mobile_bottom_nav'));
    };
  }, [isOpen]);

  if (!isOpen || typeof document === 'undefined') return null;


  const currentStudent = selectedStudents[currentIndex] || selectedStudents[0];
  const totalStudents = selectedStudents.length;

  const formatMessageForStudent = (student: FacultyActionItem) => {
    const name = student.student_name || 'Student';
    const solved = String(student.total_solved || 0);
    return activeTemplate
      .replace(/{name}/g, name)
      .replace(/{student_name}/g, name)
      .replace(/{solved}/g, solved);
  };

  const handleSendCurrentAndNext = () => {
    if (!currentStudent) return;
    const rawPhone = (currentStudent.phone_number || '').replace(/\D/g, '');
    const cleanPhone = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone;
    const msg = formatMessageForStudent(currentStudent);
    const encoded = encodeURIComponent(msg);

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
    }
  };

  const handleCopyNumbers = () => {
    if (allPhoneNumbersFormatted.length === 0) return;
    navigator.clipboard.writeText(allPhoneNumbersFormatted.join(', '));
    setCopiedNumbers(true);
    setTimeout(() => setCopiedNumbers(false), 2500);
  };

  const handleCopyMessage = () => {
    const sampleMsg = activeTemplate
      .replace(/{name}/g, '[Student Name]')
      .replace(/{student_name}/g, '[Student Name]')
      .replace(/{solved}/g, '[Solves]');
    navigator.clipboard.writeText(sampleMsg);
    setCopiedMessage(true);
    setTimeout(() => setCopiedMessage(false), 2500);
  };

  const handleExportCSV = () => {
    const headers = ['Register Number', 'Student Name', 'Department', 'Year', 'Problems Solved', 'Phone Number', 'Assigned Mentor'];
    const rows = selectedStudents.map(s => [
      `"${s.reg_no || ''}"`,
      `"${s.student_name || ''}"`,
      `"${s.department_code || ''}"`,
      `"${s.year_level || ''}"`,
      s.total_solved || 0,
      `"${s.phone_number || ''}"`,
      `"${s.assigned_faculty_name || 'Unassigned'}"`
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

  return createPortal(
    <div
      className="fixed inset-0 z-[999999] flex items-stretch sm:items-center justify-center p-0 sm:p-4 bg-slate-950/90 dark:bg-black/95 backdrop-blur-xl animate-fade-in"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full h-[100dvh] sm:h-auto max-w-2xl sm:max-h-[92vh] bg-white dark:bg-navy-950 rounded-none sm:rounded-3xl border-0 sm:border border-slate-200 dark:border-navy-800 shadow-2xl overflow-hidden flex flex-col">
        
        {/* Mobile Pull Indicator */}
        <div className="w-10 h-1.5 bg-slate-300 dark:bg-navy-700 rounded-full mx-auto my-2.5 sm:hidden shrink-0" />

        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-navy-800 flex items-center justify-between shrink-0 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/30 shrink-0">
              <MessageCircle size={22} className="stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-display font-black text-base sm:text-lg text-slate-900 dark:text-white truncate">
                  Bulk WhatsApp Mentoring Dispatch
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                  {totalStudents} Selected
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">
                Send mentoring reminders and weekly contest nudges to 50+ students
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

        {/* Mode Switcher Tabs */}
        <div className="flex items-center p-2 bg-slate-100 dark:bg-navy-900 border-b border-slate-200 dark:border-navy-800 shrink-0 gap-2">
          <button
            onClick={() => setActiveTab('queue')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'queue'
                ? 'bg-white dark:bg-navy-800 text-emerald-600 dark:text-emerald-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Smartphone size={14} />
            <span>1-Tap WhatsApp Queue ({sentStudentIds.size}/{totalStudents})</span>
          </button>
          <button
            onClick={() => setActiveTab('broadcast')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'broadcast'
                ? 'bg-white dark:bg-navy-800 text-emerald-600 dark:text-emerald-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Users size={14} />
            <span>Broadcast List (All 50+ at Once)</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 custom-scrollbar">

          {/* Template Selection Pills */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              Choose Mentoring Message Template
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {WHATSAPP_TEMPLATES.map(tpl => (
                <button
                  key={tpl.id}
                  onClick={() => setSelectedTemplateId(tpl.id)}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer text-xs flex flex-col justify-between ${
                    selectedTemplateId === tpl.id
                      ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-200 ring-2 ring-emerald-500/20 font-bold'
                      : 'border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 text-slate-700 dark:text-slate-300 hover:border-slate-300 font-medium'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1 gap-1">
                    <span className="font-black truncate">{tpl.title}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase shrink-0 border ${tpl.categoryColor}`}>
                      {tpl.category}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                    {tpl.text}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Message Editor if selected */}
          {selectedTemplateId === 'custom' && (
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 flex items-center justify-between">
                <span>Custom Message Text:</span>
                <span className="text-[10px] text-slate-400 font-mono">Use {'{name}'} and {'{solved}'}</span>
              </label>
              <textarea
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                rows={3}
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          )}

          {/* TAB 1: ONE-TAP STEP-BY-STEP QUEUE */}
          {activeTab === 'queue' && (
            <div className="space-y-4 animate-fade-in">
              {currentStudent ? (
                <div className="p-4 rounded-2xl border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-50/60 via-white to-teal-50/40 dark:from-navy-900 dark:via-navy-950 dark:to-emerald-950/20 space-y-3.5 shadow-sm">
                  
                  {/* Queue Counter & Step Progress */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                      <span className="text-xs font-black text-emerald-800 dark:text-emerald-300 font-mono">
                        QUEUE POSITION: {currentIndex + 1} OF {totalStudents}
                      </span>
                    </div>
                    {sentStudentIds.has(currentStudent.id) && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 flex items-center gap-1">
                        <CheckCircle2 size={11} /> Sent
                      </span>
                    )}
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-200 dark:bg-navy-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${((currentIndex + 1) / Math.max(1, totalStudents)) * 100}%` }}
                    />
                  </div>

                  {/* Current Student Profile Box */}
                  <div className="flex items-start justify-between gap-3 bg-white/80 dark:bg-navy-900/80 p-3 rounded-xl border border-slate-200/80 dark:border-navy-700">
                    <div>
                      <h4 className="font-display font-black text-sm sm:text-base text-slate-900 dark:text-white">
                        {currentStudent.student_name}
                      </h4>
                      <p className="text-xs font-mono font-bold text-slate-500 mt-0.5">
                        {currentStudent.reg_no} &bull; {currentStudent.department_code} &bull; {currentStudent.year_level}
                      </p>
                      <p className="text-[11.5px] font-bold text-slate-600 dark:text-slate-300 mt-1">
                        Phone: <strong className="font-mono text-emerald-600 dark:text-emerald-400">{currentStudent.phone_number || 'Default / Mentor Phone'}</strong>
                      </p>
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
                  <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-navy-900 border border-emerald-200/80 dark:border-emerald-900/50 text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-sans">
                    <span className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400 block mb-1">
                      Personalized Message to be Sent:
                    </span>
                    &ldquo;{formatMessageForStudent(currentStudent)}&rdquo;
                  </div>

                  {/* Action Buttons Row */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={handleSendCurrentAndNext}
                      className="flex-1 min-h-[46px] py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-xs sm:text-sm shadow-md shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <MessageCircle size={17} className="stroke-[2.5]" />
                      <span>Send WhatsApp &amp; Next Student &rarr;</span>
                    </button>
                  </div>

                  {/* Pagination / Stepper Controls */}
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500 pt-1">
                    <button
                      onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                      disabled={currentIndex === 0}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-navy-700 hover:bg-slate-100 dark:hover:bg-navy-800 disabled:opacity-40 transition cursor-pointer flex items-center gap-1"
                    >
                      <ArrowLeft size={13} /> Prev
                    </button>

                    <span>Student {currentIndex + 1} of {totalStudents}</span>

                    <button
                      onClick={() => setCurrentIndex(prev => Math.min(totalStudents - 1, prev + 1))}
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
            </div>
          )}

          {/* TAB 2: BROADCAST LIST MODE (50+ AT ONCE) */}
          {activeTab === 'broadcast' && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-800 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h4 className="font-display font-black text-sm text-slate-900 dark:text-white">
                      WhatsApp Broadcast List Dispatch (50+ Students)
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Copy all phone numbers to paste into WhatsApp New Broadcast or College SMS Portal
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-mono font-black bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                    {allPhoneNumbersFormatted.length} Numbers Extracted
                  </span>
                </div>

                {/* Comma-separated Phone Numbers Box */}
                <div className="p-3 rounded-xl bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 max-h-28 overflow-y-auto font-mono text-xs text-slate-700 dark:text-slate-300 select-all custom-scrollbar break-all">
                  {allPhoneNumbersFormatted.length > 0 ? (
                    allPhoneNumbersFormatted.join(', ')
                  ) : (
                    <span className="text-slate-400 italic">No phone numbers found for the selected students.</span>
                  )}
                </div>

                {/* Quick Copy Buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={handleCopyNumbers}
                    disabled={allPhoneNumbersFormatted.length === 0}
                    className="flex-1 min-h-[42px] py-2 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-black text-xs shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {copiedNumbers ? <Check size={15} /> : <Copy size={15} />}
                    <span>{copiedNumbers ? 'Copied 50+ Phone Numbers!' : `Copy All ${allPhoneNumbersFormatted.length} Numbers`}</span>
                  </button>

                  <button
                    onClick={handleCopyMessage}
                    className="flex-1 min-h-[42px] py-2 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {copiedMessage ? <Check size={15} /> : <Copy size={15} />}
                    <span>{copiedMessage ? 'Message Copied!' : 'Copy Announcement Text'}</span>
                  </button>
                </div>
              </div>

              {/* Step-by-Step Instructions for WhatsApp Broadcast */}
              <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-200 text-xs space-y-1.5">
                <div className="font-black flex items-center gap-1.5">
                  <Sparkles size={14} className="text-amber-600" />
                  <span>How to send to all 50+ students in 1 minute:</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-[11.5px] text-slate-700 dark:text-slate-300 font-medium">
                  <li>Click <strong>&ldquo;Copy All Numbers&rdquo;</strong> above.</li>
                  <li>Open WhatsApp on mobile &rarr; Tap the 3 dots &rarr; Select <strong>&ldquo;New Broadcast&rdquo;</strong>.</li>
                  <li>Select the student contacts and paste the copied announcement message.</li>
                  <li>Tap Send &mdash; every student receives the message privately in their individual chat!</li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 sm:p-4 pb-[max(1rem,env(safe-area-inset-bottom,1rem))] border-t border-slate-100 dark:border-navy-800 bg-slate-50/80 dark:bg-navy-950/80 flex items-center justify-between gap-2 shrink-0">
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
