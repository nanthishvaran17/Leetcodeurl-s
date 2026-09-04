import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  User, Mail, Phone, ShieldCheck, Building2, ExternalLink, Loader2, 
  Copy, Check, MessageSquare, Trophy, Code2, Flame, Award, Sparkles, X,
  GraduationCap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface LeetCodeStatsData {
  total_solved?: number;
  easy_solved?: number;
  medium_solved?: number;
  hard_solved?: number;
  contest_rating?: number;
  global_rank?: number;
}

interface ProfileData {
  id: string;
  name: string;
  role: string;
  designation?: string;
  reg_no?: string;
  institutional_id?: string;
  department: string;
  year?: string;
  section?: string;
  email?: string;
  phone?: string;
  avatar_url?: string;
  type: string;
  status: string;
  verified: boolean;
  leetcode_url?: string;
  leetcode_username?: string;
  stats?: LeetCodeStatsData;
}

interface ConversationInfoPanelProps {
  userId: string | null;
  onClose: () => void;
  messageCount: number;
}

export const ConversationInfoPanel: React.FC<ConversationInfoPanelProps> = ({ userId, onClose, messageCount }) => {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    const fetchProfile = async () => {
      setLoading(true);
      setError(null);
      try {
        const envUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;
        const cleanUrl = envUrl ? envUrl.replace(/\/+$/, '') : '';
        const base = cleanUrl.endsWith('/api') ? cleanUrl : `${cleanUrl}/api`;
        const token = localStorage.getItem('token');
        
        const res = await axios.get(`${base}/messaging/profile/${userId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (res.data?.success) {
          setProfile(res.data.profile);
        }
      } catch (err) {
        console.error('Failed to fetch profile', err);
        setError('Unable to load institutional profile.');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [userId]);

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (!userId) return null;

  const fallbackAvatar = profile 
    ? `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name)}&background=4f46e5&color=fff&size=256&bold=true`
    : '';

  return (
    <div className="w-full h-full flex flex-col bg-slate-50/50 dark:bg-navy-950/80 border-l border-slate-200/80 dark:border-slate-800/60 overflow-y-auto">
      {/* Header */}
      <div className="flex-none flex items-center justify-between px-5 py-4 border-b border-slate-200/60 dark:border-slate-800/60 sticky top-0 bg-white/95 dark:bg-navy-950/95 backdrop-blur-md z-10">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-brand-500" />
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 tracking-tight">
            Institutional Profile
          </h2>
        </div>
        <button 
          onClick={onClose}
          className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          title="Close profile"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 p-5 space-y-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center space-y-4 py-16">
            <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Loading profile details...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center space-y-3 py-16 text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center border border-red-200 dark:border-red-800/40">
              <ShieldCheck className="w-6 h-6 text-red-500" />
            </div>
            <p className="text-xs font-semibold text-red-600 dark:text-red-400">{error}</p>
          </div>
        ) : profile ? (
          <AnimatePresence>
            {/* Identity Card */}
            <motion.div 
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-5 rounded-2xl bg-white dark:bg-navy-900/90 border border-slate-200/60 dark:border-slate-800/60 shadow-sm flex flex-col items-center text-center space-y-3"
            >
              {/* Photo Avatar */}
              <div className="relative">
                <img 
                  src={profile.avatar_url || fallbackAvatar} 
                  alt={profile.name}
                  className="w-24 h-24 rounded-2xl object-cover shadow-lg ring-4 ring-white dark:ring-navy-800 border border-slate-200/50 dark:border-slate-700/50"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = fallbackAvatar;
                  }}
                />
                <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 border-2 border-white dark:border-navy-900 rounded-full shadow-sm" title="Active Account" />
              </div>

              {/* Name & Role */}
              <div className="space-y-1">
                <h3 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
                  {profile.name}
                </h3>
                {profile.reg_no && (
                  <p className="text-xs font-mono font-semibold text-slate-500 dark:text-slate-400">
                    Reg: {profile.reg_no}
                  </p>
                )}
                {profile.institutional_id && (
                  <p className="text-xs font-mono font-semibold text-slate-500 dark:text-slate-400">
                    ID: {profile.institutional_id}
                  </p>
                )}
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500">
                  Nandha Engineering College
                </p>
              </div>

              {/* Badges */}
              <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
                <span className="px-2.5 py-1 rounded-lg bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 text-[11px] font-bold tracking-wide uppercase border border-brand-200/60 dark:border-brand-800/50">
                  {profile.role}
                </span>
                {profile.verified && (
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold tracking-wide uppercase border border-emerald-200/60 dark:border-emerald-800/50">
                    <ShieldCheck className="w-3 h-3" />
                    Verified
                  </span>
                )}
              </div>
            </motion.div>

            {/* Department & Academic Details */}
            <motion.div 
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="p-4 rounded-2xl bg-white dark:bg-navy-900/90 border border-slate-200/60 dark:border-slate-800/60 shadow-sm space-y-3"
            >
              <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Institutional Unit
              </h4>
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/50">
                  <Building2 className="w-4 h-4 text-brand-500 flex-shrink-0" />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    {profile.department || 'Administration'}
                  </span>
                </div>

                {(profile.year || profile.section) && (
                  <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/50">
                    <GraduationCap className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      {profile.year ? `Year ${profile.year}` : ''} {profile.section ? `• Section ${profile.section}` : ''}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>

            {/* LeetCode Performance Matrix (if student / stats available) */}
            {(profile.leetcode_url || profile.stats) && (
              <motion.div 
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="p-4 rounded-2xl bg-white dark:bg-navy-900/90 border border-slate-200/60 dark:border-slate-800/60 shadow-sm space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5 text-[#ffa116]" />
                    LeetCode Analytics
                  </h4>
                  {profile.leetcode_url && (
                    <a 
                      href={profile.leetcode_url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-[11px] font-bold text-[#ffa116] hover:underline flex items-center gap-1"
                    >
                      Profile <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                {profile.stats && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 flex flex-col items-center text-center">
                      <Code2 className="w-4 h-4 text-[#ffa116] mb-1" />
                      <span className="text-base font-black text-slate-900 dark:text-white">
                        {profile.stats.total_solved || 0}
                      </span>
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                        Solved
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/20 flex flex-col items-center text-center">
                      <Trophy className="w-4 h-4 text-indigo-500 mb-1" />
                      <span className="text-base font-black text-slate-900 dark:text-white">
                        {profile.stats.contest_rating || 0}
                      </span>
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                        Contest Rating
                      </span>
                    </div>

                    {profile.stats.easy_solved !== undefined && (
                      <div className="col-span-2 grid grid-cols-3 gap-1.5 pt-1">
                        <div className="p-2 rounded-lg bg-emerald-500/10 text-center">
                          <span className="block text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                            {profile.stats.easy_solved || 0}
                          </span>
                          <span className="text-[9px] font-semibold text-slate-500 dark:text-slate-400">Easy</span>
                        </div>
                        <div className="p-2 rounded-lg bg-amber-500/10 text-center">
                          <span className="block text-xs font-extrabold text-amber-600 dark:text-amber-400">
                            {profile.stats.medium_solved || 0}
                          </span>
                          <span className="text-[9px] font-semibold text-slate-500 dark:text-slate-400">Med</span>
                        </div>
                        <div className="p-2 rounded-lg bg-rose-500/10 text-center">
                          <span className="block text-xs font-extrabold text-rose-600 dark:text-rose-400">
                            {profile.stats.hard_solved || 0}
                          </span>
                          <span className="text-[9px] font-semibold text-slate-500 dark:text-slate-400">Hard</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {/* Contact Information */}
            <motion.div 
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="p-4 rounded-2xl bg-white dark:bg-navy-900/90 border border-slate-200/60 dark:border-slate-800/60 shadow-sm space-y-3"
            >
              <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Contact & Communication
              </h4>
              <div className="space-y-2">
                {profile.email && (
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/50">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Mail className="w-4 h-4 text-brand-500 flex-shrink-0" />
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
                        {profile.email}
                      </span>
                    </div>
                    <button
                      onClick={() => handleCopy(profile.email!, 'email')}
                      className="p-1 text-slate-400 hover:text-brand-600 transition-colors flex-shrink-0"
                      title="Copy email"
                    >
                      {copiedField === 'email' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                )}

                {profile.phone ? (
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/50">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Phone className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
                        {profile.phone}
                      </span>
                    </div>
                    <button
                      onClick={() => handleCopy(profile.phone!, 'phone')}
                      className="p-1 text-slate-400 hover:text-emerald-600 transition-colors flex-shrink-0"
                      title="Copy phone"
                    >
                      {copiedField === 'phone' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/50">
                    <MessageSquare className="w-4 h-4 text-brand-500 flex-shrink-0" />
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Direct Messaging Active
                    </span>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Conversation Stats summary */}
            <motion.div 
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="p-4 rounded-2xl bg-gradient-to-br from-brand-500/10 via-indigo-500/5 to-transparent border border-brand-500/20 shadow-sm flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-500 text-white flex items-center justify-center shadow-md">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <span className="block text-xs font-bold text-slate-800 dark:text-slate-100">
                    Total Messages
                  </span>
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Active Chat Session
                  </span>
                </div>
              </div>
              <span className="text-lg font-black text-brand-600 dark:text-brand-400">
                {messageCount}
              </span>
            </motion.div>
          </AnimatePresence>
        ) : null}
      </div>
    </div>
  );
};

