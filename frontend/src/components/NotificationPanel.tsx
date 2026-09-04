import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { resolveNotificationDestination } from '../utils/notificationNavigation';
import { Bell, Check, Trash2, CheckCircle2, AlertTriangle, AlertCircle, Calendar, FileText, Download, Eye, X, Settings, ChevronRight, ArrowLeft } from 'lucide-react';
import { useGlobalNotifications, Notification } from '../context/GlobalNotificationContext';
import { useAuth } from '../context/AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '';

const timeAgo = (rawDate: any) => {
  if (!rawDate) return "Just now";
  let date: Date;
  if (typeof rawDate.toDate === 'function') {
    date = rawDate.toDate();
  } else if (rawDate instanceof Date) {
    date = rawDate;
  } else if (typeof rawDate === 'number') {
    date = new Date(rawDate);
  } else if (typeof rawDate === 'string') {
    date = new Date(rawDate);
  } else {
    return "Just now";
  }

  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  if (seconds < 10) return "Just now";
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + "y ago";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + "mo ago";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + "d ago";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + "h ago";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + "m ago";
  return Math.floor(seconds) + "s ago";
};

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab?: (tab: string) => void;
}

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'assignments', label: 'Assignments' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'exams', label: 'Exams' },
  { id: 'reports', label: 'Reports' },
  { id: 'contests', label: 'Contests' },
  { id: 'announcements', label: 'Announcements' },
];
export const NotificationPanel: React.FC<NotificationPanelProps> = ({ isOpen, onClose, onNavigateTab }) => {
  const {
    notifications,
    unreadCount,
    isLoading,
    error,
    selectedCategory,
    setSelectedCategory,
    markAsRead,
    markAllAsRead,
    deleteNotification
  } = useGlobalNotifications();

  const { token } = useAuth();
  const panelRef = useRef<HTMLDivElement>(null);
  const [activeFileModal, setActiveFileModal] = useState<{ fileId: string; title: string; filename?: string } | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (window.innerWidth >= 640 && panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  const getIcon = (type: string, priority: string) => {
    if (priority === 'high' || priority === 'critical') return <AlertTriangle className="text-rose-500" size={18} />;
    const t = (type || '').toLowerCase();
    if (t.includes('assignment')) return <Calendar className="text-emerald-500" size={18} />;
    if (t.includes('report') || t.includes('file')) return <FileText className="text-cyan-500" size={18} />;
    if (t.includes('alert')) return <AlertCircle className="text-amber-500" size={18} />;
    return <Bell className="text-brand-500" size={18} />;
  };

  const handleNotificationClick = (n: Notification) => {
    if (!n.isRead) markAsRead(n.id);
    
    const target = resolveNotificationDestination(n);
    
    if (target.modalType === 'FILE_PREVIEW' && target.entityId) {
      setActiveFileModal({ fileId: target.entityId, title: n.title });
      return;
    }

    if (target.path) {
      if (onNavigateTab) {
        onNavigateTab(target.path);
      } else {
        window.location.hash = `#${target.path}`;
      }
      onClose();
    }
  };

  const handleFileDownload = (fileId: string) => {
    window.open(`${API_BASE_URL}/api/notifications/files/${fileId}/download?token=${token}`, '_blank');
  };

  const handleFilePreview = (fileId: string) => {
    window.open(`${API_BASE_URL}/api/notifications/files/${fileId}/preview?token=${token}`, '_blank');
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="fixed inset-0 sm:inset-auto sm:absolute sm:right-0 sm:top-12 sm:mt-2 w-full sm:w-96 max-w-[100vw] sm:max-w-sm bg-white dark:bg-navy-900 sm:rounded-2xl shadow-2xl border-0 sm:border border-slate-200 dark:border-navy-800 z-[100050] overflow-hidden flex flex-col h-dvh sm:h-auto sm:max-h-[580px] pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,12px)]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 sm:px-4 py-3 border-b border-slate-100 dark:border-navy-800 bg-slate-50/90 dark:bg-navy-950/90 shrink-0">
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 -ml-1 text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-navy-800 rounded-xl transition-colors cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0"
                  title="Back to previous screen"
                  aria-label="Back"
                >
                  <ArrowLeft size={20} />
                </button>
                <h3 className="font-black text-base sm:text-sm text-slate-900 dark:text-white truncate">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20 text-[10px] font-black px-2 py-0.5 rounded-full shrink-0">
                    {unreadCount} new
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 font-bold flex items-center gap-1 transition-colors cursor-pointer min-h-[44px] px-2.5 rounded-xl hover:bg-brand-50 dark:hover:bg-navy-800 shrink-0"
                >
                  <Check size={15} />
                  <span className="hidden xs:inline">Mark all read</span>
                </button>
              )}
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 dark:border-navy-800 overflow-x-auto scrollbar-none shrink-0 bg-white dark:bg-navy-900 touch-pan-x">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`text-[11px] font-extrabold h-8 px-3.5 rounded-xl transition-all shrink-0 cursor-pointer whitespace-nowrap flex items-center justify-center ${
                    selectedCategory === cat.id
                      ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-navy-800 dark:text-slate-300 dark:hover:bg-navy-700'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Body List */}
            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-navy-700 flex flex-col">
              {isLoading ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-start space-x-3 animate-pulse p-2 rounded-xl">
                      <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-navy-800 shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3.5 bg-slate-200 dark:bg-navy-800 rounded w-3/4" />
                        <div className="h-3 bg-slate-200 dark:bg-navy-800 rounded w-full" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : error ? (
                <div className="flex-1 flex flex-col items-center justify-center py-10 px-4 text-center space-y-3 my-auto">
                  <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center">
                    <AlertCircle size={22} />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Unable to load notifications</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{error}</p>
                  </div>
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-10 px-6 text-center my-auto min-h-[260px] animate-fade-in">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-navy-800/80 border border-slate-200/60 dark:border-navy-700/60 flex items-center justify-center mb-4 text-slate-400 dark:text-slate-500 shadow-sm">
                    <Bell size={28} />
                  </div>
                  <h4 className="text-sm font-extrabold text-slate-800 dark:text-slate-200 mb-1.5">No notifications</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[240px] leading-relaxed">
                    Notifications for your selected category will appear here.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-navy-800/60">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleNotificationClick(n)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleNotificationClick(n);
                        }
                      }}
                      className={`group relative flex items-start gap-3 p-3.5 sm:p-4 transition-all duration-200 cursor-pointer min-h-[64px] min-w-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 focus-visible:bg-slate-50 dark:focus-visible:bg-navy-800/60 hover:bg-slate-50 dark:hover:bg-navy-800/60 active:bg-slate-100 dark:active:bg-navy-800 ${
                        !n.isRead ? 'bg-brand-500/5 dark:bg-brand-500/10 font-medium' : 'opacity-80'
                      }`}
                    >
                      {!n.isRead && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-10 bg-brand-500 rounded-r-full" />
                      )}

                      <div className="mt-0.5 shrink-0 p-2 rounded-xl bg-slate-100 dark:bg-navy-800 group-hover:shadow-sm transition-shadow">
                        {getIcon(n.type, n.priority)}
                      </div>

                      <div className="flex-1 min-w-0 pr-8">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <h4 className={`text-xs sm:text-sm font-bold truncate ${!n.isRead ? 'text-slate-900 dark:text-white font-extrabold' : 'text-slate-700 dark:text-slate-300'}`}>
                            {n.title}
                          </h4>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0 font-semibold group-hover:text-slate-500 transition-colors">
                            {timeAgo(n.createdAt)}
                          </span>
                        </div>

                        <p className={`text-xs leading-relaxed line-clamp-2 ${!n.isRead ? 'text-slate-700 dark:text-slate-200 font-medium' : 'text-slate-500 dark:text-slate-400'}`}>
                          {n.message}
                        </p>

                        {n.fileId && (
                          <div className="mt-2 flex items-center gap-2">
                            <button
                              type="button"
                              tabIndex={-1}
                              className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400 flex items-center gap-1 bg-cyan-50 dark:bg-cyan-950/40 px-2 py-1 rounded-md"
                            >
                              <Eye size={12} /> Preview
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 text-slate-400">
                        <ChevronRight size={18} />
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(n.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-all absolute right-2 top-2 cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center z-10"
                        title="Delete notification"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Document Detail Modal */}
      <AnimatePresence>
        {activeFileModal && (
          <div className="fixed inset-0 z-[100090] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-navy-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-navy-800 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400 font-extrabold">
                  <FileText size={20} />
                  <span>Document Details</span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveFileModal(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-1">
                <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">{activeFileModal.title}</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">Institutional document attachment ready for preview or download.</p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleFilePreview(activeFileModal.fileId)}
                  className="px-4 py-2 bg-slate-100 dark:bg-navy-800 hover:bg-slate-200 dark:hover:bg-navy-700 text-slate-800 dark:text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Eye size={14} /> Preview
                </button>
                <button
                  type="button"
                  onClick={() => handleFileDownload(activeFileModal.fileId)}
                  className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-brand-500/20"
                >
                  <Download size={14} /> Download
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
