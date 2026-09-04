import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { User, Mail, Phone, ShieldCheck, Building2, ExternalLink, Loader2, Link2, Image as ImageIcon, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ProfileData {
  id: string;
  name: string;
  role: string;
  department: string;
  email?: string;
  phone?: string;
  type: string;
  status: string;
  verified: boolean;
  leetcode_url?: string;
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

  if (!userId) return null;

  return (
    <div className="w-full h-full flex flex-col bg-white dark:bg-[#0d1117] border-l border-gray-200 dark:border-gray-800/60 overflow-y-auto">
      {/* Header */}
      <div className="flex-none flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800/60 sticky top-0 bg-white/95 dark:bg-[#0d1117]/95 backdrop-blur-sm z-10">
        <h2 className="text-sm font-bold text-gray-800 dark:text-gray-200 tracking-wide">
          Institutional Profile
        </h2>
        <button 
          onClick={onClose}
          className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
          title="Close profile"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <div className="flex-1 p-6 space-y-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center space-y-4 py-12">
            <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
            <p className="text-sm font-medium text-gray-500">Loading secure profile...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center space-y-3 py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-red-500" />
            </div>
            <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>
            <button 
              onClick={() => { setLoading(true); setError(null); /* would normally refetch */ }}
              className="text-xs font-bold text-brand-600 hover:text-brand-700 underline"
            >
              Retry
            </button>
          </div>
        ) : profile ? (
          <AnimatePresence>
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center text-center space-y-4"
            >
              {/* Avatar */}
              <div className="relative">
                <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-brand-600 via-indigo-600 to-navy-800 text-white font-black text-4xl flex items-center justify-center shadow-xl shadow-brand-500/20">
                  {profile.name.substring(0, 2).toUpperCase()}
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 border-4 border-white dark:border-[#0d1117] rounded-full shadow-sm" title="Online" />
              </div>

              {/* Identity */}
              <div className="space-y-1">
                <h3 className="text-lg font-black text-gray-900 dark:text-white tracking-tight">
                  {profile.name}
                </h3>
                <p className="text-sm font-bold text-brand-600 dark:text-brand-400">
                  {profile.role}
                </p>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Nandha Engineering College
                </p>
              </div>

              {/* Status Pills */}
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                {profile.verified && (
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold tracking-wider uppercase border border-emerald-200 dark:border-emerald-800/50">
                    <ShieldCheck className="w-3 h-3" />
                    Verified
                  </span>
                )}
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 text-[10px] font-bold tracking-wider uppercase border border-blue-200 dark:border-blue-800/50">
                  <User className="w-3 h-3" />
                  {profile.status}
                </span>
              </div>
            </motion.div>

            {/* Department */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="space-y-3"
            >
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Department</h4>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800/60">
                <Building2 className="w-5 h-5 text-gray-400" />
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {profile.department}
                </span>
              </div>
            </motion.div>

            {/* Contact */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="space-y-3"
            >
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Contact Information</h4>
              <div className="space-y-2">
                {profile.email && (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800/60 group hover:bg-brand-50 dark:hover:bg-brand-900/10 transition-colors">
                    <Mail className="w-5 h-5 text-gray-400 group-hover:text-brand-500 transition-colors" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                      {profile.email}
                    </span>
                  </div>
                )}
                {profile.phone ? (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800/60 group hover:bg-brand-50 dark:hover:bg-brand-900/10 transition-colors">
                    <Phone className="w-5 h-5 text-gray-400 group-hover:text-brand-500 transition-colors" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {profile.phone}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800/60">
                    <Phone className="w-5 h-5 text-gray-300 dark:text-gray-600" />
                    <span className="text-sm font-medium text-gray-400 dark:text-gray-500 italic">
                      Phone not provided
                    </span>
                  </div>
                )}
                {profile.leetcode_url && (
                  <a href={profile.leetcode_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800/60 group hover:bg-[#ffa116]/10 hover:border-[#ffa116]/30 transition-colors cursor-pointer">
                    <ExternalLink className="w-5 h-5 text-gray-400 group-hover:text-[#ffa116] transition-colors" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-[#ffa116] transition-colors">
                      LeetCode Profile
                    </span>
                  </a>
                )}
              </div>
            </motion.div>

            {/* Shared Content Stub */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="space-y-3"
            >
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between">
                <span>Shared Content</span>
                <span className="text-brand-500 font-medium">({messageCount} messages)</span>
              </h4>
              <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800/60">
                  <ImageIcon className="w-5 h-5 text-gray-400" />
                  <span className="text-xs font-bold text-gray-600 dark:text-gray-400">0</span>
                </div>
                <div className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800/60">
                  <FileText className="w-5 h-5 text-gray-400" />
                  <span className="text-xs font-bold text-gray-600 dark:text-gray-400">0</span>
                </div>
                <div className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800/60">
                  <Link2 className="w-5 h-5 text-gray-400" />
                  <span className="text-xs font-bold text-gray-600 dark:text-gray-400">0</span>
                </div>
              </div>
            </motion.div>

          </AnimatePresence>
        ) : null}
      </div>
    </div>
  );
};
