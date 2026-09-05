import React, { useState, useRef, useEffect } from 'react';
import { Search, Inbox, PenSquare, Users, Trash2, MoreVertical, AlertTriangle, ShieldOff, Archive, Pin, PinOff, Mail, MailOpen, MinusCircle, Sparkles, ShieldCheck, CheckCircle2, Loader2 } from 'lucide-react';
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
  onDeleteConversation?: (id: string) => Promise<any> | void;
  onPinConversation?: (id: string) => Promise<any>;
  onArchiveConversation?: (id: string) => Promise<any>;
  onClearConversation?: (id: string) => Promise<any>;
  onBlockUser?: (id: string) => Promise<any>;
  onMarkUnread?: (id: string) => Promise<any>;
  onMarkRead?: (id: string) => Promise<any>;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  isLoading?: boolean;
}

type TabType = 'ACTIVE' | 'UNREAD' | 'ARCHIVED';

export const ConversationList: React.FC<Props> = ({
  conversations,
  activeId,
  onSelect,
  onNewMessage,
  onSmartGroup,
  onDeleteConversation,
  onPinConversation,
  onArchiveConversation,
  onClearConversation,
  onBlockUser,
  onMarkUnread,
  onMarkRead,
  searchQuery,
  onSearchChange,
  isLoading
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('ACTIVE');
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmClearId, setConfirmClearId] = useState<string | null>(null);
  const [processingIds, setProcessingIds] = useState<Record<string, boolean>>({});
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

  const setBusy = (id: string, busy: boolean) => {
    setProcessingIds(prev => ({ ...prev, [id]: busy }));
  };

  // Filter based on search and tab
  const filtered = conversations.filter(c => {
    // 1. Tab filter
    if (activeTab === 'ACTIVE' && c.isArchived) return false;
    if (activeTab === 'UNREAD' && (c.isArchived || (c.unreadCount || 0) === 0)) return false;
    if (activeTab === 'ARCHIVED' && !c.isArchived) return false;

    // 2. Search filter
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const nameMatch = c.otherUser.name.toLowerCase().includes(q);
    const msgMatch = c.lastMessagePreview?.toLowerCase().includes(q);
    const deptMatch = c.otherUser.department?.toLowerCase().includes(q);
    return Boolean(nameMatch || msgMatch || deptMatch);
  });

  const parseSafeDate = (dStr: string | null) => {
    if (!dStr) return new Date(0);
    const d = new Date(dStr);
    return isNaN(d.getTime()) ? new Date(0) : d;
  };

  const formatTime = (isoString: string | null) => {
    if (!isoString) return '';
    const date = parseSafeDate(isoString);
    if (date.getTime() === 0) return '';
    
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const getInitials = (name: string) => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };
  
  const getAvatarGradient = (conv: Conversation) => {
    const id = conv.otherUser.id || '';
    const name = conv.otherUser.name || '';
    if (id === 'system-ai-agent' || name.includes('Intelligence') || name.includes('AI')) {
      return 'bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 text-white shadow-md shadow-indigo-500/20';
    }
    if (id === 'system-transparency-agent' || name.includes('Transparency') || name.includes('Standing')) {
      return 'bg-gradient-to-tr from-emerald-600 via-teal-600 to-cyan-500 text-white shadow-md shadow-emerald-500/20';
    }
    const hash = name.split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
    const gradients = [
      'bg-gradient-to-tr from-blue-600 to-indigo-600',
      'bg-gradient-to-tr from-purple-600 to-pink-600',
      'bg-gradient-to-tr from-emerald-600 to-teal-600',
      'bg-gradient-to-tr from-amber-600 to-orange-600',
      'bg-gradient-to-tr from-rose-600 to-pink-600',
      'bg-gradient-to-tr from-cyan-600 to-blue-600'
    ];
    return gradients[Math.abs(hash) % gradients.length] + ' text-white shadow-sm';
  };

  // Deterministic sorting: Pinned chats first, then sorted by latest lastMessageAt
  const sortedConversations = [...filtered].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    const timeA = a.lastMessageAt ? parseSafeDate(a.lastMessageAt).getTime() : 0;
    const timeB = b.lastMessageAt ? parseSafeDate(b.lastMessageAt).getTime() : 0;
    return timeB - timeA;
  });

  const activeCount = conversations.filter(c => !c.isArchived).length;
  const unreadCount = conversations.filter(c => !c.isArchived && (c.unreadCount || 0) > 0).length;
  const archivedCount = conversations.filter(c => c.isArchived).length;

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-navy-950 w-full shrink-0 relative select-none">
      
      {/* Custom Clear Confirmation Modal */}
      {confirmClearId && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-white dark:bg-navy-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-navy-700 p-5 w-full max-w-[320px] animate-in zoom-in-95 duration-200">
                <div className="w-12 h-12 bg-amber-50 dark:bg-amber-950/50 text-amber-500 rounded-full flex items-center justify-center mb-4 mx-auto">
                    <MinusCircle className="w-6 h-6" />
                </div>
                <h3 className="text-base font-black text-slate-800 dark:text-white text-center mb-1 tracking-tight">Clear Chat History?</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 text-center mb-5 leading-relaxed font-medium">
                    This will clear all messages in this conversation for you. The conversation will remain active and usable.
                </p>
                <div className="flex space-x-2.5 w-full">
                    <button 
                        onClick={() => setConfirmClearId(null)}
                        className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-navy-700 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 font-bold transition-colors cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={async () => {
                            const targetId = confirmClearId;
                            setConfirmClearId(null);
                            if (onClearConversation) {
                              setBusy(targetId, true);
                              try {
                                await onClearConversation(targetId);
                                showToast('Chat messages cleared');
                              } catch (err) {
                                showToast('Failed to clear chat');
                              } finally {
                                setBusy(targetId, false);
                              }
                            }
                        }}
                        className="flex-1 px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-colors shadow-sm shadow-amber-500/20 cursor-pointer"
                    >
                        Clear Messages
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {confirmDeleteId && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-white dark:bg-navy-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-navy-700 p-5 w-full max-w-[320px] animate-in zoom-in-95 duration-200">
                <div className="w-12 h-12 bg-red-50 dark:bg-rose-950/50 text-red-500 rounded-full flex items-center justify-center mb-4 mx-auto">
                    <AlertTriangle className="w-6 h-6" />
                </div>
                <h3 className="text-base font-black text-slate-800 dark:text-white text-center mb-1 tracking-tight">Delete Conversation?</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 text-center mb-5 leading-relaxed font-medium">
                    This action cannot be undone. Are you sure you want to permanently delete this conversation and all its messages?
                </p>
                <div className="flex space-x-2.5 w-full">
                    <button 
                        onClick={() => setConfirmDeleteId(null)}
                        className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-navy-700 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 font-bold transition-colors cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={async () => {
                            const targetId = confirmDeleteId;
                            setConfirmDeleteId(null);
                            if (onDeleteConversation) {
                              setBusy(targetId, true);
                              try {
                                await onDeleteConversation(targetId);
                                showToast('Chat deleted');
                              } catch (err) {
                                showToast('Failed to delete chat');
                              } finally {
                                setBusy(targetId, false);
                              }
                            }
                        }}
                        className="flex-1 px-3.5 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-colors shadow-sm shadow-red-500/20 cursor-pointer"
                    >
                        Delete
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Header Bar with Action Buttons */}
      <div className="p-3.5 bg-white dark:bg-navy-900 border-b border-slate-200 dark:border-navy-800 shrink-0 z-10 sticky top-0 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <span>Chats</span>
            <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/40 rounded-lg text-xs font-black leading-none">
              {activeTab === 'ACTIVE' ? activeCount : activeTab === 'UNREAD' ? unreadCount : archivedCount}
            </span>
          </h2>
          <div className="flex items-center space-x-1.5">
            {onSmartGroup && (
              <button 
                onClick={onSmartGroup}
                className="p-2 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-navy-800 rounded-xl transition-all cursor-pointer"
                title="Smart Groups"
                aria-label="Smart Group Broadcast"
              >
                <Users className="w-4 h-4" />
              </button>
            )}
            <button 
              onClick={onNewMessage}
              className="p-2 text-white bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer"
              title="New Conversation"
              aria-label="New Message"
            >
              <PenSquare className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {/* Search Bar */}
        <div className="relative group mb-2.5">
          <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
          <input 
            type="text" 
            placeholder="Search messages, users, depts..." 
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full h-9 bg-slate-100 dark:bg-navy-950 border border-transparent dark:border-navy-800 focus:bg-white dark:focus:bg-navy-950 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-xs rounded-xl pl-9 pr-4 transition-all outline-none font-medium text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 shadow-xs"
          />
        </div>

        {/* Tab Filters: All / Unread / Archived */}
        <div className="flex items-center p-1 bg-slate-100/90 dark:bg-navy-950 rounded-xl border border-slate-200/60 dark:border-navy-800 text-xs font-bold text-slate-500 dark:text-slate-400">
          <button
            onClick={() => setActiveTab('ACTIVE')}
            className={clsx(
              "flex-1 py-1 rounded-lg transition-all text-center cursor-pointer flex items-center justify-center gap-1",
              activeTab === 'ACTIVE' ? "bg-white dark:bg-navy-800 text-indigo-600 dark:text-indigo-400 shadow-xs font-black" : "hover:text-slate-800 dark:hover:text-slate-200"
            )}
          >
            <span>All</span>
            <span className="text-[10px] opacity-75 font-semibold">({activeCount})</span>
          </button>
          <button
            onClick={() => setActiveTab('UNREAD')}
            className={clsx(
              "flex-1 py-1 rounded-lg transition-all text-center cursor-pointer flex items-center justify-center gap-1",
              activeTab === 'UNREAD' ? "bg-white dark:bg-navy-800 text-indigo-600 dark:text-indigo-400 shadow-xs font-black" : "hover:text-slate-800 dark:hover:text-slate-200"
            )}
          >
            <span>Unread</span>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.2 bg-indigo-600 text-white rounded-full text-[9px] font-black leading-tight">
                {unreadCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('ARCHIVED')}
            className={clsx(
              "flex-1 py-1 rounded-lg transition-all text-center cursor-pointer flex items-center justify-center gap-1",
              activeTab === 'ARCHIVED' ? "bg-white dark:bg-navy-800 text-indigo-600 dark:text-indigo-400 shadow-xs font-black" : "hover:text-slate-800 dark:hover:text-slate-200"
            )}
          >
            <span>Archived</span>
            <span className="text-[10px] opacity-75 font-semibold">({archivedCount})</span>
          </button>
        </div>
      </div>

      {/* Conversation Cards List */}
      <div className="flex-1 overflow-y-auto scroll-smooth py-2 px-1 relative z-0 custom-scrollbar">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-40 text-slate-400 space-y-3">
            <div className="w-8 h-8 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin"></div>
            <p className="text-xs font-semibold">Loading conversations...</p>
          </div>
        ) : sortedConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6 text-slate-500 opacity-80 py-10">
            <div className="w-14 h-14 mb-3 rounded-2xl bg-slate-100 dark:bg-navy-900 flex items-center justify-center">
              {activeTab === 'ARCHIVED' ? <Archive className="w-7 h-7 text-slate-400" /> : <Inbox className="w-7 h-7 text-slate-400" />}
            </div>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
              {activeTab === 'ARCHIVED' ? 'No archived chats' : activeTab === 'UNREAD' ? 'No unread messages' : 'No conversations found'}
            </p>
            <p className="text-xs text-slate-500">
              {activeTab === 'ARCHIVED' ? 'Archived conversations will appear here.' : 'Start chatting with students or mentors.'}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {sortedConversations.map(conv => {
              const isUnread = (conv.unreadCount || 0) > 0;
              const isDropdownOpen = openDropdownId === conv.conversationId;
              const isAi = conv.otherUser.id === 'system-ai-agent' || conv.otherUser.name.includes('Intelligence');
              const isTransparency = conv.otherUser.id === 'system-transparency-agent' || conv.otherUser.name.includes('Transparency');
              const isBusy = Boolean(processingIds[conv.conversationId]);

              return (
              <div key={conv.conversationId} className={clsx("relative px-1.5", isDropdownOpen ? "z-50" : "z-0")}>
                <button
                  onClick={() => onSelect(conv.conversationId)}
                  className={clsx(
                    "w-full text-left p-2.5 sm:p-3 rounded-2xl transition-all group/item relative flex items-center gap-3 cursor-pointer",
                    activeId === conv.conversationId
                      ? "bg-indigo-50/90 dark:bg-navy-900 border border-indigo-300/80 dark:border-indigo-600/50 shadow-sm"
                      : "hover:bg-slate-100/80 dark:hover:bg-navy-900/40 border border-transparent"
                  )}
                >
                  {/* Avatar with Status Badge */}
                  <div className="relative shrink-0">
                    <div className={clsx("w-11 h-11 rounded-2xl flex items-center justify-center font-black text-xs sm:text-sm", getAvatarGradient(conv))}>
                      {isAi ? (
                        <Sparkles className="w-5 h-5 text-amber-300" />
                      ) : isTransparency ? (
                        <ShieldCheck className="w-5 h-5 text-emerald-200" />
                      ) : (
                        <span className="tracking-wider">
                          {getInitials(conv.otherUser.name)}
                        </span>
                      )}
                    </div>
                    {/* Online status indicator */}
                    {conv.otherUser.isOnline && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-navy-950 rounded-full shadow-xs" title="Online now"></div>
                    )}
                  </div>
                  
                  {/* Middle Column: Title, Pinned Indicator & Last Message */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h3 className={clsx(
                        "text-xs sm:text-sm truncate tracking-tight flex items-center gap-1.5 min-w-0",
                        isUnread ? "font-black text-slate-900 dark:text-white" : "font-bold text-slate-800 dark:text-slate-200",
                        activeId === conv.conversationId && "text-indigo-700 dark:text-indigo-400 font-extrabold"
                      )}>
                        {conv.isPinned && (
                          <span title="Pinned chat" className="inline-flex shrink-0">
                            <Pin className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 fill-indigo-500/20" />
                          </span>
                        )}
                        <span className="truncate">{conv.otherUser.name}</span>
                        {isAi && (
                          <span className="px-1.5 py-0.2 bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 text-[9px] font-black rounded-md shrink-0">
                            AI
                          </span>
                        )}
                        {isTransparency && (
                          <span className="px-1.5 py-0.2 bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 text-[9px] font-black rounded-md shrink-0">
                            OFFICIAL
                          </span>
                        )}
                      </h3>
                      <span className={clsx(
                        "text-[10px] sm:text-[11px] font-semibold whitespace-nowrap shrink-0 ml-auto tabular-nums",
                        isUnread ? "text-indigo-600 dark:text-indigo-400 font-bold" : "text-slate-400 dark:text-slate-500"
                      )}>
                        {formatTime(conv.lastMessageAt)}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between gap-2">
                      {conv.isTyping ? (
                        <p className="text-xs text-emerald-500 font-extrabold italic animate-pulse">
                          typing...
                        </p>
                      ) : (
                        <p className={clsx(
                          "text-xs truncate leading-relaxed",
                          isUnread ? "text-slate-900 dark:text-slate-100 font-bold" : "text-slate-500 dark:text-slate-400 font-medium"
                        )}>
                          {conv.lastMessagePreview || "No messages yet"}
                        </p>
                      )}
                      
                      {isUnread && (
                        <span className="shrink-0 bg-indigo-600 text-white text-[10px] font-black px-1.5 min-w-[18px] h-[18px] leading-[18px] text-center rounded-full shadow-xs">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 3-Dot Options Menu */}
                  <div className="shrink-0 opacity-0 group-hover/item:opacity-100 transition-opacity ml-1" ref={isDropdownOpen ? dropdownRef : null}>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setOpenDropdownId(isDropdownOpen ? null : conv.conversationId);
                        }}
                        disabled={isBusy}
                        className={clsx(
                            "p-1.5 rounded-lg transition-colors focus:opacity-100 cursor-pointer",
                            isDropdownOpen ? "bg-slate-200 dark:bg-navy-800 text-slate-800 dark:text-slate-200 opacity-100" : "text-slate-400 hover:bg-slate-200 dark:hover:bg-navy-800 hover:text-slate-700 dark:hover:text-slate-300"
                        )}
                        title="Chat Options"
                        aria-label="Options"
                    >
                        {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" /> : <MoreVertical className="w-3.5 h-3.5" />}
                    </button>

                    {/* Dropdown Menu */}
                    {isDropdownOpen && (
                        <div className="absolute right-0 top-10 w-[210px] bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-2xl shadow-[0_10px_35px_rgba(0,0,0,0.15)] dark:shadow-[0_10px_35px_rgba(0,0,0,0.6)] z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-100">
                            <div className="p-1.5 space-y-0.5">
                                
                                {/* 1. PIN / UNPIN */}
                                <button
                                    disabled={isBusy}
                                    onClick={async (e) => {
                                        e.stopPropagation();
                                        setOpenDropdownId(null);
                                        if (onPinConversation) {
                                            setBusy(conv.conversationId, true);
                                            try {
                                                const res = await onPinConversation(conv.conversationId);
                                                showToast(res.is_pinned ? 'Chat pinned to top' : 'Chat unpinned');
                                            } catch (err) {
                                                showToast('Failed to pin chat');
                                            } finally {
                                                setBusy(conv.conversationId, false);
                                            }
                                        }
                                    }}
                                    className="w-full text-left px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-navy-700/60 rounded-xl flex items-center space-x-2.5 transition-colors cursor-pointer"
                                >
                                    {conv.isPinned ? <PinOff className="w-4 h-4 text-indigo-500" /> : <Pin className="w-4 h-4 text-slate-500" />}
                                    <span>{conv.isPinned ? 'Unpin chat' : 'Pin chat'}</span>
                                </button>

                                {/* 2. ARCHIVE / UNARCHIVE */}
                                <button
                                    disabled={isBusy}
                                    onClick={async (e) => {
                                        e.stopPropagation();
                                        setOpenDropdownId(null);
                                        if (onArchiveConversation) {
                                            setBusy(conv.conversationId, true);
                                            try {
                                                const res = await onArchiveConversation(conv.conversationId);
                                                showToast(res.is_archived ? 'Chat archived' : 'Chat unarchived');
                                            } catch (err) {
                                                showToast('Failed to archive chat');
                                            } finally {
                                                setBusy(conv.conversationId, false);
                                            }
                                        }
                                    }}
                                    className="w-full text-left px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-navy-700/60 rounded-xl flex items-center space-x-2.5 transition-colors cursor-pointer"
                                >
                                    <Archive className="w-4 h-4 text-slate-500" />
                                    <span>{conv.isArchived ? 'Unarchive chat' : 'Archive chat'}</span>
                                </button>

                                {/* 3. MARK AS READ / UNREAD */}
                                {isUnread ? (
                                  <button
                                      disabled={isBusy}
                                      onClick={async (e) => {
                                          e.stopPropagation();
                                          setOpenDropdownId(null);
                                          if (onMarkRead) {
                                              setBusy(conv.conversationId, true);
                                              try {
                                                  await onMarkRead(conv.conversationId);
                                                  showToast('Chat marked as read');
                                              } catch (err) {
                                                  showToast('Failed to mark as read');
                                              } finally {
                                                  setBusy(conv.conversationId, false);
                                              }
                                          }
                                      }}
                                      className="w-full text-left px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-navy-700/60 rounded-xl flex items-center space-x-2.5 transition-colors cursor-pointer"
                                  >
                                      <MailOpen className="w-4 h-4 text-slate-500" />
                                      <span>Mark as read</span>
                                  </button>
                                ) : (
                                  <button
                                      disabled={isBusy}
                                      onClick={async (e) => {
                                          e.stopPropagation();
                                          setOpenDropdownId(null);
                                          if (onMarkUnread) {
                                              setBusy(conv.conversationId, true);
                                              try {
                                                  await onMarkUnread(conv.conversationId);
                                                  showToast('Chat marked as unread');
                                              } catch (err) {
                                                  showToast('Failed to mark as unread');
                                              } finally {
                                                  setBusy(conv.conversationId, false);
                                              }
                                          }
                                      }}
                                      className="w-full text-left px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-navy-700/60 rounded-xl flex items-center space-x-2.5 transition-colors cursor-pointer"
                                  >
                                      <Mail className="w-4 h-4 text-slate-500" />
                                      <span>Mark as unread</span>
                                  </button>
                                )}
                                
                                <div className="h-px bg-slate-100 dark:bg-navy-700 my-1 mx-2"></div>
                                
                                {/* 4. BLOCK USER */}
                                <button
                                    disabled={isBusy}
                                    onClick={async (e) => {
                                        e.stopPropagation();
                                        setOpenDropdownId(null);
                                        if (onBlockUser) {
                                            setBusy(conv.conversationId, true);
                                            try {
                                                const res = await onBlockUser(conv.otherUser.id);
                                                showToast(res.is_blocked ? 'User blocked' : 'User unblocked');
                                            } catch (err) {
                                                showToast('Failed to block user');
                                            } finally {
                                                setBusy(conv.conversationId, false);
                                            }
                                        }
                                    }}
                                    className="w-full text-left px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-700/60 rounded-xl flex items-center space-x-2.5 transition-colors cursor-pointer"
                                >
                                    <ShieldOff className="w-4 h-4 text-slate-500" />
                                    <span>Block User</span>
                                </button>

                                {/* 5. CLEAR CHAT (WITH CONFIRMATION) */}
                                <button
                                    disabled={isBusy}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setOpenDropdownId(null);
                                        setConfirmClearId(conv.conversationId);
                                    }}
                                    className="w-full text-left px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-xl flex items-center space-x-2.5 transition-colors cursor-pointer"
                                >
                                    <MinusCircle className="w-4 h-4 text-amber-500" />
                                    <span>Clear chat</span>
                                </button>

                                {/* 6. DELETE CHAT (WITH CONFIRMATION) */}
                                {onDeleteConversation && (
                                    <button
                                        disabled={isBusy}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setOpenDropdownId(null);
                                            setConfirmDeleteId(conv.conversationId);
                                        }}
                                        className="w-full text-left px-3.5 py-2 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl flex items-center space-x-2.5 transition-colors group/del cursor-pointer"
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
              </div>
            )})}
          </div>
        )}
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-[200] animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-slate-900/95 text-white px-5 py-2.5 rounded-full shadow-2xl font-bold text-xs flex items-center space-x-2 border border-slate-700/60 backdrop-blur-md">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}
    </div>
  );
};
