import React, { useState, useRef, useEffect } from 'react';
import { Search, Inbox, PenSquare, Users, Trash2, MoreVertical, AlertTriangle, ShieldOff, Archive, Lock, Pin, Mail, Heart, MinusCircle } from 'lucide-react';
import { clsx } from 'clsx';

export interface Conversation {
  conversationId: string;
  otherUser: {
    id: string;
    name: string;
    role: string;
    department?: string;
    type?: 'STAFF' | 'STUDENT' | 'UNKNOWN';
    isOnline?: boolean;
    profileUrl?: string;
  };
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  isTyping?: boolean;
  isPinned?: boolean;
  isArchived?: boolean;
}

interface Props {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewMessage?: () => void;
  onSmartGroup?: () => void;
  onDeleteConversation?: (id: string) => void;
  onPinConversation?: (id: string) => Promise<any>;
  onArchiveConversation?: (id: string) => Promise<any>;
  onClearConversation?: (id: string) => Promise<any>;
  onBlockUser?: (id: string) => Promise<any>;
  onMarkUnread?: (id: string) => Promise<any>;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  isLoading?: boolean;
}

export const ConversationList: React.FC<Props> = ({
  conversations, activeId, onSelect, onNewMessage, onSmartGroup, 
  onDeleteConversation, onPinConversation, onArchiveConversation, 
  onClearConversation, onBlockUser, onMarkUnread,
  searchQuery, onSearchChange, isLoading
}) => {
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdownId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = conversations.filter(c => {
    const q = searchQuery.toLowerCase();
    return (
      (c.otherUser.name || '').toLowerCase().includes(q) ||
      (c.otherUser.role || '').toLowerCase().includes(q) ||
      (c.otherUser.department || '').toLowerCase().includes(q)
    );
  });

  const parseSafeDate = (dateStr: string) => {
    if (!dateStr) return new Date();
    if (typeof dateStr === 'string' && !dateStr.endsWith('Z') && !dateStr.includes('+')) {
      return new Date(dateStr + 'Z');
    }
    return new Date(dateStr);
  };

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return '';
    const date = parseSafeDate(dateStr);
    const now = new Date();
    const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 3600 * 24));
    if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const getInitials = (name: string) => {
    if (!name) return '?';
    return name.substring(0, 2).toUpperCase();
  };
  
  const getAvatarColor = (name: string) => {
    if (!name) return 'bg-slate-300';
    const hash = name.split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
    const colors = ['bg-indigo-500', 'bg-blue-500', 'bg-purple-500', 'bg-emerald-500', 'bg-rose-500', 'bg-orange-500'];
    return colors[Math.abs(hash) % colors.length];
  };

  const sortedConversations = [...filtered].sort((a, b) => {
    const timeA = a.lastMessageAt ? parseSafeDate(a.lastMessageAt).getTime() : 0;
    const timeB = b.lastMessageAt ? parseSafeDate(b.lastMessageAt).getTime() : 0;
    return timeB - timeA;
  });

  return (
    <div className="flex flex-col h-full bg-slate-50 border-r border-slate-200 w-80 shrink-0 relative">
      {/* Custom Delete Confirmation Modal */}
      {confirmDeleteId && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 p-5 w-full max-w-[280px] animate-in zoom-in-95 duration-200">
                <div className="w-12 h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4 mx-auto">
                    <AlertTriangle className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-black text-slate-800 text-center mb-2 tracking-tight">Delete Chat?</h3>
                <p className="text-sm text-slate-500 text-center mb-6 leading-relaxed font-medium">
                    This action cannot be undone. Are you sure you want to permanently delete this conversation?
                </p>
                <div className="flex space-x-3 w-full">
                    <button 
                        onClick={() => setConfirmDeleteId(null)}
                        className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={() => {
                            onDeleteConversation && onDeleteConversation(confirmDeleteId);
                            setConfirmDeleteId(null);
                        }}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold transition-colors shadow-sm shadow-red-500/20"
                    >
                        Delete
                    </button>
                </div>
            </div>
        </div>
      )}

      <div className="p-4 bg-white dark:bg-[#0B1120] border-b border-slate-200 dark:border-slate-800/50 shrink-0 z-10 sticky top-0">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight flex items-baseline">
            Chats
            <span className="ml-2 px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-md text-[11px] font-bold leading-none align-middle">
              {conversations.length}
            </span>
          </h2>
          <div className="flex items-center space-x-1">
            {onSmartGroup && (
              <button 
                onClick={onSmartGroup}
                className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors tooltip-trigger relative group"
                aria-label="Smart Group Broadcast"
              >
                <Users className="w-5 h-5" />
                <span className="absolute top-full mt-2 right-0 bg-slate-800 text-white text-[11px] font-bold px-2.5 py-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                  Smart Groups
                </span>
              </button>
            )}
            <button 
              onClick={onNewMessage}
              className="p-2 text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all tooltip-trigger relative group"
              aria-label="New Message"
            >
              <PenSquare className="w-4 h-4" />
              <span className="absolute top-full mt-2 right-0 bg-slate-800 text-white text-[11px] font-bold px-2.5 py-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                New Message
              </span>
            </button>
          </div>
        </div>
        
        <div className="relative group">
          <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
          <input 
            type="text" 
            placeholder="Search messages..." 
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full h-10 bg-slate-100 dark:bg-slate-900 border-transparent hover:bg-slate-200/60 dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-[#060B14] focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-[14px] rounded-xl pl-9 pr-4 transition-all outline-none font-medium text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scroll-smooth pb-4 relative z-0">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-40 text-slate-400 space-y-3">
            <div className="w-8 h-8 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin"></div>
            <p className="text-[13px] font-medium">Loading conversations...</p>
          </div>
        ) : sortedConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6 text-slate-500 opacity-80 py-10">
            <div className="w-16 h-16 mb-4 rounded-2xl bg-slate-100 flex items-center justify-center">
              <Inbox className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-[14px] font-bold text-slate-600 mb-1">No conversations yet</p>
            <p className="text-[13px]">Start chatting with students or staff to see them here.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100/60 dark:divide-slate-800/50 relative">
            {sortedConversations.map(conv => {
              const isUnread = conv.unreadCount > 0;
              const isDropdownOpen = openDropdownId === conv.conversationId;
              
              return (
              <li key={conv.conversationId} className={clsx("relative", isDropdownOpen ? "z-50" : "z-0")}>
                <button
                  onClick={() => onSelect(conv.conversationId)}
                  className={clsx(
                    "w-full text-left p-4 hover:bg-indigo-50/40 dark:hover:bg-indigo-500/10 transition-all group/item relative flex items-center gap-3",
                    activeId === conv.conversationId ? "bg-white dark:bg-slate-900 border-l-4 border-indigo-600 shadow-sm" : "border-l-4 border-transparent"
                  )}
                >
                  <div className="relative shrink-0">
                    <div className={clsx("w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-inner", getAvatarColor(conv.otherUser.name))}>
                      <span className="opacity-90 tracking-wider">
                        {getInitials(conv.otherUser.name)}
                      </span>
                    </div>
                    {/* Online status indicator */}
                    {conv.otherUser.isOnline && (
                      <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full shadow-sm" title="Online now"></div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0 pr-6">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <h3 className={clsx(
                        "text-[14.5px] truncate pr-2 tracking-tight flex items-center gap-1.5",
                        isUnread ? "font-black text-slate-900 dark:text-white" : "font-bold text-slate-700 dark:text-slate-300",
                        activeId === conv.conversationId && "text-indigo-900 dark:text-indigo-400"
                      )}>
                        <span>{conv.otherUser.name}</span>
                      </h3>
                      <span className={clsx(
                          "text-[11px] whitespace-nowrap shrink-0",
                          isUnread ? "font-bold text-indigo-600 dark:text-indigo-400" : "font-medium text-slate-400 dark:text-slate-500"
                      )}>
                        {formatTime(conv.lastMessageAt)}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center mt-0.5">
                      {conv.isTyping ? (
                        <p className="text-[13px] text-emerald-500 font-extrabold italic animate-pulse">
                          typing...
                        </p>
                      ) : (
                        <p className={clsx(
                          "text-[13.5px] truncate pr-2 leading-snug",
                          isUnread ? "text-slate-900 dark:text-slate-200 font-bold" : "text-slate-500 dark:text-slate-400 font-medium"
                        )}>
                          {conv.lastMessagePreview || "No messages yet"}
                        </p>
                      )}
                      
                      {isUnread && (
                        <span className="shrink-0 bg-brand-500 text-white text-[10px] font-black px-1.5 min-w-[20px] h-[20px] leading-[20px] text-center rounded-full shadow-sm shadow-brand-500/20">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 3-Dot Options Menu */}
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover/item:opacity-100 transition-opacity" ref={isDropdownOpen ? dropdownRef : null}>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setOpenDropdownId(isDropdownOpen ? null : conv.conversationId);
                        }}
                        className={clsx(
                            "p-1.5 rounded-lg transition-colors focus:opacity-100",
                            isDropdownOpen ? "bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 opacity-100" : "text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300"
                        )}
                        title="Options"
                    >
                        <MoreVertical className="w-4 h-4" />
                    </button>

                    {/* Dropdown Menu */}
                    {isDropdownOpen && (
                        <div className="absolute right-0 top-10 w-[200px] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)] z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-100">
                            <div className="p-1.5 space-y-0.5">
                                <button
                                    onClick={async (e) => {
                                        e.stopPropagation();
                                        setOpenDropdownId(null);
                                        if (onArchiveConversation) {
                                            try {
                                                const res = await onArchiveConversation(conv.conversationId);
                                                showToast(res.is_archived ? 'Chat archived' : 'Chat unarchived');
                                            } catch (err) {
                                                showToast('Failed to archive chat');
                                            }
                                        }
                                    }}
                                    className="w-full text-left px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg flex items-center space-x-3 transition-colors"
                                >
                                    <Archive className="w-4 h-4 text-slate-500" />
                                    <span>{conv.isArchived ? 'Unarchive chat' : 'Archive chat'}</span>
                                </button>
                                <button
                                    onClick={async (e) => {
                                        e.stopPropagation();
                                        setOpenDropdownId(null);
                                        if (onPinConversation) {
                                            try {
                                                const res = await onPinConversation(conv.conversationId);
                                                showToast(res.is_pinned ? 'Chat pinned' : 'Chat unpinned');
                                            } catch (err) {
                                                showToast('Failed to pin chat');
                                            }
                                        }
                                    }}
                                    className="w-full text-left px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg flex items-center space-x-3 transition-colors"
                                >
                                    <Pin className="w-4 h-4 text-slate-500" />
                                    <span>{conv.isPinned ? 'Unpin chat' : 'Pin chat'}</span>
                                </button>
                                <button
                                    onClick={async (e) => {
                                        e.stopPropagation();
                                        setOpenDropdownId(null);
                                        if (onMarkUnread) {
                                            try {
                                                await onMarkUnread(conv.conversationId);
                                                showToast('Chat marked as unread');
                                            } catch (err) {
                                                showToast('Failed to mark unread');
                                            }
                                        }
                                    }}
                                    className="w-full text-left px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg flex items-center space-x-3 transition-colors"
                                >
                                    <Mail className="w-4 h-4 text-slate-500" />
                                    <span>Mark as unread</span>
                                </button>
                                
                                <div className="h-px bg-slate-100 dark:bg-slate-800 my-1 mx-2"></div>
                                
                                <button
                                    onClick={async (e) => {
                                        e.stopPropagation();
                                        setOpenDropdownId(null);
                                        if (onBlockUser) {
                                            try {
                                                const res = await onBlockUser(conv.otherUser.id);
                                                showToast(res.is_blocked ? 'User blocked' : 'User unblocked');
                                            } catch (err) {
                                                showToast('Failed to block user');
                                            }
                                        }
                                    }}
                                    className="w-full text-left px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg flex items-center space-x-3 transition-colors"
                                >
                                    <ShieldOff className="w-4 h-4 text-slate-500" />
                                    <span>Block User</span>
                                </button>
                                <button
                                    onClick={async (e) => {
                                        e.stopPropagation();
                                        setOpenDropdownId(null);
                                        if (onClearConversation) {
                                            try {
                                                await onClearConversation(conv.conversationId);
                                                showToast('Chat cleared');
                                            } catch (err) {
                                                showToast('Failed to clear chat');
                                            }
                                        }
                                    }}
                                    className="w-full text-left px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg flex items-center space-x-3 transition-colors"
                                >
                                    <MinusCircle className="w-4 h-4 text-slate-500" />
                                    <span>Clear chat</span>
                                </button>
                                {onDeleteConversation && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setOpenDropdownId(null);
                                            setConfirmDeleteId(conv.conversationId);
                                        }}
                                        className="w-full text-left px-4 py-2.5 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg flex items-center space-x-3 transition-colors group/del"
                                    >
                                        <Trash2 className="w-4 h-4 text-red-500 group-hover/del:text-red-600" />
                                        <span>Delete chat</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                  </div>
                </button>
              </li>
            )})}
          </ul>
        )}
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-[200] animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-slate-800 text-white px-6 py-3 rounded-full shadow-lg font-medium text-sm flex items-center space-x-2">
            <span>{toastMessage}</span>
          </div>
        </div>
      )}
    </div>
  );
};
