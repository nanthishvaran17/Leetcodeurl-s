import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Copy, Check, X, ExternalLink, Sparkles, KeyRound, Lock, HelpCircle, ShieldCheck } from 'lucide-react';

export interface SupportContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCategory?: 'otp' | 'credentials' | 'general';
  userIdentifier?: string;
  supportEmail?: string;
}

export const SupportContactModal: React.FC<SupportContactModalProps> = ({
  isOpen,
  onClose,
  initialCategory = 'otp',
  userIdentifier = '',
  supportEmail = 'nanthishvaran17@gmail.com'
}) => {
  const [category, setCategory] = useState<'otp' | 'credentials' | 'general'>(initialCategory);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [copiedDraft, setCopiedDraft] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  // Generate templates based on category and userIdentifier
  const getTemplate = (cat: 'otp' | 'credentials' | 'general', ident: string) => {
    const cleanIdent = ident.trim() || '[Your Staff ID / Registered Email]';
    const nowStr = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true });

    switch (cat) {
      case 'otp':
        return {
          subject: '[Help Desk] OTP Delivery Issue - Nandha LeetCode Platform',
          body: `Hello Institution Support Team,\n\nI am unable to receive the 6-digit OTP verification code to sign into my staff workspace on the Nandha LeetCode platform.\n\nAccount Details:\n• Staff ID / Institutional Email: ${cleanIdent}\n• Issue Type: OTP Not Received (Checked Inbox & Spam)\n• Reported At: ${nowStr} IST\n\nPlease check my account status and verify if OTP emails are enabled for my profile.\n\nThank you,\n${cleanIdent}`
        };
      case 'credentials':
        return {
          subject: '[Help Desk] Staff Login / Credential Assistance Request',
          body: `Hello Institution Support Team,\n\nI need assistance authenticating my staff credentials on the Nandha LeetCode Intelligence platform.\n\nAccount Details:\n• Staff ID / Username: ${cleanIdent}\n• Issue Description: [Please state issue, e.g. Invalid password / Account locked / HOD handle change]\n• Reported At: ${nowStr} IST\n\nKindly assist me in verifying and resetting my institutional credentials.\n\nThank you,\n${cleanIdent}`
        };
      case 'general':
      default:
        return {
          subject: '[Help Desk] Technical Support Request - Nandha LeetCode Platform',
          body: `Hello Institution Support Team,\n\nI have an inquiry regarding the Nandha LeetCode Intelligence platform.\n\nStaff Identifier: ${cleanIdent}\nDetails of Request:\n[Please describe your request or question here]\n\nReported At: ${nowStr} IST\n\nThank you.`
        };
    }
  };

  // Sync state whenever modal opens or category changes
  useEffect(() => {
    if (isOpen) {
      const template = getTemplate(category, userIdentifier);
      setSubject(template.subject);
      setMessage(template.body);
    }
  }, [isOpen, category, userIdentifier]);

  // Sync category if initialCategory changes when opening
  useEffect(() => {
    if (isOpen && initialCategory) {
      setCategory(initialCategory);
    }
  }, [isOpen, initialCategory]);

  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (typeof document === 'undefined') return null;

  const handleCategorySwitch = (newCat: 'otp' | 'credentials' | 'general') => {
    setCategory(newCat);
    const template = getTemplate(newCat, userIdentifier);
    setSubject(template.subject);
    setMessage(template.body);
  };

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(supportEmail);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleCopyDraft = async () => {
    const fullText = `To: ${supportEmail}\nSubject: ${subject}\n\n${message}`;
    try {
      await navigator.clipboard.writeText(fullText);
      setCopiedDraft(true);
      setTimeout(() => setCopiedDraft(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleOpenEmailClient = () => {
    const mailtoUrl = `mailto:${encodeURIComponent(supportEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
    window.open(mailtoUrl, '_blank') || (window.location.href = mailtoUrl);
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto">
          {/* Backdrop with frosted blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-md transition-opacity"
            aria-hidden="true"
          />

          {/* Modal Card Surface */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-5 text-slate-800 dark:text-slate-100 z-10 my-auto flex flex-col max-h-[90vh]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="support-modal-title"
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <Mail size={18} />
                </div>
                <div>
                  <h3 id="support-modal-title" className="text-base font-black text-slate-900 dark:text-white leading-tight">
                    Institution Support Desk
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Nandha Engineering College (Autonomous)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <div className="overflow-y-auto space-y-3.5 py-3 pr-1 text-left custom-scrollbar">
              {/* Recipient Notice Box */}
              <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/50">
                <div className="flex items-center gap-2 min-w-0">
                  <ShieldCheck size={15} className="text-blue-600 dark:text-blue-400 shrink-0" />
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">To:</span>
                  <span className="text-xs font-mono font-bold text-blue-700 dark:text-blue-300 truncate">
                    {supportEmail}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyEmail}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-blue-700 dark:text-blue-300 bg-white dark:bg-slate-800 rounded-lg border border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/50 transition-colors shadow-2xs cursor-pointer shrink-0"
                  title="Copy support email address"
                >
                  {copiedEmail ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                  <span>{copiedEmail ? 'Copied' : 'Copy Email'}</span>
                </button>
              </div>

              {/* Template Category Selector Tabs */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Select Issue Template
                </label>
                <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                  <button
                    type="button"
                    onClick={() => handleCategorySwitch('otp')}
                    className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      category === 'otp'
                        ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <KeyRound size={13} />
                    <span className="truncate">OTP Issue</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCategorySwitch('credentials')}
                    className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      category === 'credentials'
                        ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <Lock size={13} />
                    <span className="truncate">Login / Access</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCategorySwitch('general')}
                    className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      category === 'general'
                        ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <HelpCircle size={13} />
                    <span className="truncate">General</span>
                  </button>
                </div>
              </div>

              {/* Editable Subject Field */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="supportSubject" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Subject Line (Editable)
                  </label>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">You can customize this</span>
                </div>
                <input
                  id="supportSubject"
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Subject of your inquiry..."
                  className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all text-slate-800 dark:text-slate-100"
                />
              </div>

              {/* Editable Message Content Area */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="supportMessage" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Message Content (Editable)
                  </label>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Pre-filled with your details</span>
                </div>
                <textarea
                  id="supportMessage"
                  rows={6}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type your message to support..."
                  className="w-full px-3 py-2 text-xs font-mono font-medium leading-relaxed rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all text-slate-800 dark:text-slate-100 resize-y"
                />
              </div>
            </div>

            {/* Modal Actions Footer - Balanced, desktop-grade layout */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2.5 mt-auto">
              <button
                type="button"
                onClick={handleCopyDraft}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 bg-white dark:bg-slate-800/80 text-xs font-bold text-slate-700 dark:text-slate-300 transition active:scale-95 cursor-pointer shadow-2xs shrink-0"
              >
                {copiedDraft ? (
                  <>
                    <Check size={13} className="text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy size={13} className="text-slate-400" />
                    <span>Copy Full Message</span>
                  </>
                )}
              </button>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-95 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleOpenEmailClient}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-sm shadow-blue-500/25 active:scale-95 transition cursor-pointer"
                >
                  <ExternalLink size={13} />
                  <span>Open in Email App</span>
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default SupportContactModal;
