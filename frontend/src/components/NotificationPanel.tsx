import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Check, Trash2, CheckCircle2, AlertTriangle, AlertCircle, Calendar } from 'lucide-react';
import { useNotifications, Notification } from '../hooks/useNotifications';

const timeAgo = (date: Date) => {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + " years ago";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + " months ago";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + " days ago";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + " hours ago";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + " mins ago";
  return Math.floor(seconds) + " seconds ago";
};

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({ isOpen, onClose }) => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  const getIcon = (type: string, priority: string) => {
    if (priority === 'high') return <AlertTriangle className="text-red-500" size={20} />;
    switch (type) {
      case 'announcement': return <Bell className="text-blue-500" size={20} />;
      case 'alert': return <AlertCircle className="text-orange-500" size={20} />;
      case 'assignment': return <Calendar className="text-emerald-500" size={20} />;
      default: return <CheckCircle2 className="text-slate-500 dark:text-slate-400" size={20} />;
    }
  };

  const handleNotificationClick = (n: Notification) => {
    if (!n.isRead) markAsRead(n.id);
    if (n.actionRoute) {
      window.location.hash = n.actionRoute;
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={panelRef}
          initial={{ opacity: 0, y: -10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="absolute right-0 top-12 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 z-50 overflow-hidden flex flex-col max-h-[85vh] sm:max-h-[600px]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200">Notifications</h3>
              {unreadCount > 0 && (
                <span className="bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-bold px-2 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Check size={14} />
                Mark all read
              </button>
            )}
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                  <Bell className="text-slate-400 dark:text-slate-500" size={24} />
                </div>
                <h4 className="text-slate-700 dark:text-slate-300 font-medium mb-1">No notifications yet</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400">We'll let you know when something arrives.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`relative flex items-start gap-3 p-4 transition-colors cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                      !n.isRead ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''
                    }`}
                  >
                    {!n.isRead && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-12 bg-blue-500 rounded-r-full" />
                    )}
                    
                    <div className="mt-1 shrink-0 p-2 rounded-full bg-slate-100 dark:bg-slate-800">
                      {getIcon(n.type, n.priority)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className={`text-sm font-semibold truncate ${!n.isRead ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                          {n.title}
                        </h4>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 whitespace-nowrap shrink-0 mt-0.5">
                          {n.createdAt ? timeAgo(n.createdAt.toDate()) : 'Just now'}
                        </span>
                      </div>
                      
                      <p className={`text-sm line-clamp-2 ${!n.isRead ? 'text-slate-700 dark:text-slate-300' : 'text-slate-500 dark:text-slate-400'}`}>
                        {n.message}
                      </p>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(n.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md transition-all absolute right-2 top-2 cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
