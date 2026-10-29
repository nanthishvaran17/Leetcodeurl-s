import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MessageCircle, X, Send, Copy, Check, Edit3, Globe } from 'lucide-react';
import { FacultyActionItem } from '../services/intelligenceService';

export interface WhatsAppTemplate {
  id: string;
  title: string;
  titleTa?: string;
  category: string;
  categoryColor: string;
  text: string;
  textTa: string;
}

export const WHATSAPP_TEMPLATES: WhatsAppTemplate[] = [
  {
    id: 'practice_nudge',
    title: 'Low Solve & Practice Nudge',
    titleTa: 'பயிற்சி ஊக்கவிப்பு (Gentle)',
    category: 'Gentle',
    categoryColor: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    text: "Dear {name}, this is a gentle reminder from your Faculty Mentor at Nandha Engineering College. Your current LeetCode problem solve count is {solved}. Please practice today's recommended problems and attend upcoming weekly coding contests. Feel free to reach out if you need guidance!",
    textTa: "வணக்கம் {name}, Nandha Engineering College Faculty Mentor பேசுகிறேன். உங்கள் LeetCode solve count தற்போது {solved}. இன்றைய பயிற்சி கணக்குகளை முடித்து, வரவிருக்கும் கோடிங் போட்டிகளில் கலந்துகொள்ளுங்கள். ஏதேனும் சந்தேகம் இருந்தால் என்னை தொடர்பு கொள்ளலாம்!"
  },
  {
    id: 'urgent_review',
    title: 'Urgent Faculty Review Notice',
    titleTa: 'அவசர நேரில் சந்திப்பு (Strict)',
    category: 'Strict',
    categoryColor: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800',
    text: "Dear {name}, your LeetCode problem solving activity has fallen significantly behind the departmental benchmark. Please report to your assigned Faculty Mentor immediately today or submit your coding practice log.",
    textTa: "வணக்கம் {name}, உங்கள் LeetCode பயிற்சி துறை அளவீட்டை விட மிகவும் குறைவாக உள்ளது. உடனடியாக இன்று உங்கள் Faculty Mentor-ஐ நேரில் சந்திக்கவும் அல்லது உங்கள் பயிற்சி பதிவை சமர்ப்பிக்கவும்."
  },
  {
    id: 'contest_reminder',
    title: 'Weekly Contest Attendance Alert (8:00 AM)',
    titleTa: 'ஞாயிறு போட்டி நினைவூட்டல் (8:00 AM)',
    category: 'Contest',
    categoryColor: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
    text: "Dear {name}, participation in this Sunday's LeetCode Weekly Contest (08:00 AM - 09:30 AM IST) is strictly mandatory for academic assessment. Please verify your contest login in advance and submit solutions on time. Best wishes!",
    textTa: "வணக்கம் {name}, இந்த ஞாயிறு காலை நடைபெறும் LeetCode Weekly Contest (08:00 AM - 09:30 AM IST) வருகை கல்வி மதிப்பீட்டிற்கு கட்டாயமாகும். முன்னதாகவே லாகின் செய்து சரியான நேரத்தில் சமர்ப்பிக்கவும். வாழ்த்துகள்!"
  },
  {
    id: 'zero_solves_alert',
    title: 'Zero Solves Critical Alert',
    titleTa: 'பூஜ்ஜிய தீர்வு எச்சரிக்கை (Critical)',
    category: 'Critical',
    categoryColor: 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300 border-red-200 dark:border-red-800',
    text: "Dear {name}, our institutional tracking ledger indicates 0 problems solved on your LeetCode profile. Consistent hands-on coding is compulsory at Nandha Engineering College. Please solve at least 2 Easy problems today.",
    textTa: "கவனத்திற்கு {name}, உங்கள் LeetCode கணக்கில் இதுவரை 0 கணக்குகளே தீர்க்கப்பட்டுள்ளன. நந்தா பொறியியல் கல்லூரியில் தொடர் கோடிங் பயிற்சி கட்டாயம். இன்றே குறைந்தது 2 Easy கணக்குகளையாவது தீர்க்கவும்."
  },
  {
    id: 'mentorship_session',
    title: '1-on-1 Mentorship Discussion Invite',
    titleTa: '1-on-1 வழிகாட்டுதல் சந்திப்பு',
    category: 'Mentoring',
    categoryColor: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    text: "Hello {name}, I have scheduled a 1-on-1 mentoring discussion to help you with Data Structures and problem-solving bottlenecks. Please meet me in the department during mentor hour today.",
    textTa: "வணக்கம் {name}, டேட்டா ஸ்ட்ரக்சர்ஸ் மற்றும் கோடிங் சந்தேகங்களைத் தீர்க்க உங்களுடன் 1-on-1 கலந்தாய்வு திட்டமிடப்பட்டுள்ளது. இன்று Mentor Hour-ல் என்னை துறையில் நேரில் சந்திக்கவும்."
  },
  {
    id: 'placement_prep',
    title: 'Campus Placement Readiness Warning',
    titleTa: 'கேம்பஸ் பிளேஸ்மென்ட் தயார்நிலை',
    category: 'Placements',
    categoryColor: 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800',
    text: "Dear {name}, Tier-1 tech recruiters require a minimum threshold of verified problem solves for placement shortlisting. Your current count is {solved}. Please intensify your daily coding practice to ensure eligibility.",
    textTa: "முக்கிய அறிவிப்பு {name}, கேம்பஸ் பிளேஸ்மென்ட் தேர்வுக்கு லீட்கோட் பயிற்சி மிகவும் அவசியம். உங்கள் தற்போதைய எண்ணிக்கை {solved}. தகுதி பெற தினசரி கோடிங் பயிற்சியை அதிகப்படுத்துங்கள்."
  },
  {
    id: 'daily_streak',
    title: 'Daily 1-Problem Streak Challenge',
    titleTa: 'தினசரி 1 கணக்கு சவால் (Streak)',
    category: 'Streak',
    categoryColor: 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200 dark:border-sky-800',
    text: "Hi {name}! Take up the 1-Problem Daily Challenge today. Spend just 20 minutes solving one Easy or Medium problem on LeetCode. Small daily efforts compound into strong technical skills!",
    textTa: "ஹாய் {name}! இன்றைய Daily 1-Problem Challenge-ஐ எடுங்கள். வெறும் 20 நிமிடங்கள் ஒதுக்கி 1 கணக்கை லீட்கோடில் தீருங்கள். தினமும் செய்யும் சிறு முயற்சி பெரிய வெற்றியைத் தரும்!"
  },
  {
    id: 'appreciation_milestone',
    title: 'Good Effort & Next Milestone Nudge',
    titleTa: 'அடுத்த மைல்கல் இலக்கு (Milestone)',
    category: 'Milestone',
    categoryColor: 'bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border-teal-200 dark:border-teal-800',
    text: "Good progress {name}! You have solved {solved} problems so far. Let us target reaching your next milestone of {next_milestone} problems by this weekend. Keep pushing forward!",
    textTa: "சிறப்பான முன்னேற்றம் {name}! இதுவரை {solved} கணக்குகளை முடித்துள்ளீர்கள். இந்த வார இறுதிக்குள் அடுத்த மைல்கல்லான {next_milestone} கணக்குகளை எட்ட முயற்சி செய்யுங்கள். தொடருங்கள்!"
  },
  {
    id: 'tamil_tanglish',
    title: 'Tamil / Tanglish Friendly Nudge (தமிழ்)',
    titleTa: 'தமிழ் நட்பு நினைவூட்டல்',
    category: 'Tamil',
    categoryColor: 'bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 border-orange-200 dark:border-orange-800',
    text: "வணக்கம் {name}, Nandha Engineering College Faculty Mentor பேசுகிறேன். உங்கள் LeetCode solve count தற்போது {solved}. தினமும் குறைந்தது 1 கணக்காவது solve பண்ணுங்க. ஏதேனும் சந்தேகம் இருந்தால் என்னை தொடர்பு கொள்ளலாம்!",
    textTa: "வணக்கம் {name}, Nandha Engineering College Faculty Mentor பேசுகிறேன். உங்கள் LeetCode solve count தற்போது {solved}. தினமும் குறைந்தது 1 கணக்காவது solve பண்ணுங்க. ஏதேனும் சந்தேகம் இருந்தால் என்னை தொடர்பு கொள்ளலாம்!"
  },
  {
    id: 'custom',
    title: 'Custom Message (Edit Free-text)',
    titleTa: 'சுய உரை (Custom Text)',
    category: 'Custom',
    categoryColor: 'bg-slate-100 text-slate-700 dark:bg-navy-800 dark:text-slate-300 border-slate-300 dark:border-navy-700',
    text: "Dear {name}, your current LeetCode problem solve count is {solved}. Please stay dedicated to your coding practice at Nandha Engineering College.",
    textTa: "அன்புள்ள {name}, உங்கள் தற்போதைய LeetCode பயிற்சி எண்ணிக்கை {solved}. நந்தா பொறியியல் கல்லூரியில் உங்கள் கோடிங் பயிற்சியைத் தொடருங்கள்."
  }
];

interface StudentWhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: FacultyActionItem | null;
}

export const StudentWhatsAppModal: React.FC<StudentWhatsAppModalProps> = ({
  isOpen,
  onClose,
  student
}) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('practice_nudge');
  const [lang, setLang] = useState<'en' | 'ta'>('en');
  const [editableMessage, setEditableMessage] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  // When student, template, or language changes, update message
  useEffect(() => {
    if (!student) return;
    const tpl = WHATSAPP_TEMPLATES.find(t => t.id === selectedTemplateId) || WHATSAPP_TEMPLATES[0];
    const name = student.student_name || 'Student';
    const solved = String(student.total_solved || 0);
    const nextMilestone = String(Math.ceil(((student.total_solved || 0) + 10) / 10) * 10);

    const baseText = lang === 'ta' ? (tpl.textTa || tpl.text) : tpl.text;

    const populated = baseText
      .replace(/{name}/g, name)
      .replace(/{student_name}/g, name)
      .replace(/{solved}/g, solved)
      .replace(/{next_milestone}/g, nextMilestone);

    setEditableMessage(populated);
  }, [student, selectedTemplateId, lang]);

  // Auto-hide MobileBottomNav on mobile while WhatsApp modal is open
  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;
    document.body.classList.add('hide-mobile-bottom-nav');
    window.dispatchEvent(new CustomEvent('hide_mobile_bottom_nav'));

    return () => {
      document.body.classList.remove('hide-mobile-bottom-nav');
      window.dispatchEvent(new CustomEvent('show_mobile_bottom_nav'));
    };
  }, [isOpen]);

  if (!isOpen || !student || typeof document === 'undefined') return null;

  const rawPhone = (student.phone_number || '').replace(/\D/g, '');
  const cleanPhone = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone;
  const hasValidPhone = cleanPhone && cleanPhone.length >= 10;

  const handleSendWhatsApp = () => {
    const encoded = encodeURIComponent(editableMessage);
    if (hasValidPhone) {
      window.open(`https://wa.me/${cleanPhone}?text=${encoded}`, '_blank');
    } else {
      window.open(`https://wa.me/?text=${encoded}`, '_blank');
    }
  };

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(editableMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      data-modal-active="true"
      style={{ zIndex: 99999999 }}
      className="fixed inset-0 z-[99999999] flex items-stretch sm:items-center justify-center p-0 sm:p-4 bg-slate-950/90 dark:bg-black/95 backdrop-blur-xl animate-fade-in"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full h-[100dvh] sm:h-auto max-w-xl sm:max-h-[92vh] bg-white dark:bg-navy-950 rounded-none sm:rounded-3xl border-0 sm:border border-slate-200 dark:border-navy-800 shadow-2xl overflow-hidden flex flex-col">
        
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
                  Send WhatsApp Mentoring Nudge
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                  10 Templates
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">
                Choose a pre-built message or customize before dispatch
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

        {/* Student Quick Pill */}
        <div className="p-3 sm:p-4 bg-slate-50 dark:bg-navy-900 border-b border-slate-100 dark:border-navy-800 flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h4 className="font-black text-sm text-slate-900 dark:text-white truncate">
              {student.student_name}
            </h4>
            <p className="text-[11.5px] font-bold text-slate-500 dark:text-slate-400 font-mono mt-0.5 truncate">
              {student.reg_no} &bull; {student.department_code} &bull; {student.year_level}
            </p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[10px] font-bold uppercase text-slate-400">Total Solved</div>
            <div className="font-mono font-black text-sm sm:text-base text-emerald-600 dark:text-emerald-400">
              {student.total_solved || 0}
            </div>
          </div>
        </div>

        {/* Scrollable Template List & Editor */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 custom-scrollbar">
          {/* Template Selection Pills + Language Switcher */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                10 Message Templates
              </label>

              {/* Bilingual Language Pill Toggle */}
              <div className="inline-flex items-center bg-slate-100 dark:bg-navy-900 p-0.5 rounded-xl border border-slate-200 dark:border-navy-700 shrink-0">
                <button
                  type="button"
                  onClick={() => setLang('en')}
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
                  onClick={() => setLang('ta')}
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {WHATSAPP_TEMPLATES.map(tpl => {
                const isSelected = selectedTemplateId === tpl.id;
                const title = lang === 'ta' && tpl.titleTa ? tpl.titleTa : tpl.title;
                const snippet = lang === 'ta' && tpl.textTa ? tpl.textTa : tpl.text;

                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => setSelectedTemplateId(tpl.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer text-xs flex flex-col justify-between touch-manipulation ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-200 ring-2 ring-emerald-500/20 font-bold shadow-xs'
                        : 'border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 text-slate-700 dark:text-slate-300 hover:border-slate-300 font-medium'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="font-black truncate text-xs">{title}</span>
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
          </div>

          {/* Editable Textarea with live customization */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Edit3 size={12} className="text-emerald-600" />
                <span>Customize Message ({lang === 'ta' ? 'தமிழ்' : 'English'})</span>
              </label>
              <button
                type="button"
                onClick={handleCopyMessage}
                className="text-[11px] font-bold text-slate-500 hover:text-emerald-600 transition flex items-center gap-1 cursor-pointer"
              >
                {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>

            <textarea
              value={editableMessage}
              onChange={(e) => setEditableMessage(e.target.value)}
              rows={4}
              className="w-full p-3 rounded-2xl border border-slate-300 dark:border-navy-700 bg-slate-50 dark:bg-navy-900 text-xs sm:text-sm text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 leading-relaxed shadow-2xs"
              placeholder="Type your custom WhatsApp message here..."
            />
            <p className="text-[10.5px] text-slate-400">
              You can edit any word or add staff details before sending.
            </p>
          </div>
        </div>

        {/* Modal Footer with Actions */}
        <div className="p-3.5 sm:p-4 pb-[max(1.25rem,env(safe-area-inset-bottom,1.25rem))] border-t border-slate-100 dark:border-navy-800 bg-slate-50/80 dark:bg-navy-950/80 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-navy-700 hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSendWhatsApp}
            className="flex-1 sm:flex-initial min-h-[46px] px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-xs sm:text-sm shadow-md shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer touch-manipulation"
          >
            <MessageCircle size={18} className="stroke-[2.5]" />
            <span>Send via WhatsApp</span>
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
};
