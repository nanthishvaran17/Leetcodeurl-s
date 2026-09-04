import React from 'react';
import { Search, Inbox, PenSquare } from 'lucide-react';
import { clsx } from 'clsx';

export interface Conversation {
  conversationId: string;
  otherUser: {
    id: string;
    name: string;
    role: string;
    department: string;
    type: 'STAFF' | 'STUDENT' | 'UNKNOWN';
    isOnline?: boolean;
  };
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  isTyping?: boolean;
}

interface Props {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewMessage: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  isLoading?: boolean;
}

export const ConversationList: React.FC<Props> = ({
  conversations, activeId, onSelect, onNewMessage, searchQuery, onSearchChange, isLoading
}) => {
  const filtered = conversations.filter(c => 
    c.otherUser.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.otherUser.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.otherUser.department.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const parseSafeDate = (dateStr: string) => {
    if (!dateStr) return new Date();
    if (typeof dateStr === 'string' && !dateStr.endsWith('Z') && !dateStr.includes('+')) {
      return new Date(dateStr + 'Z');
    }
    return new Date(dateStr);
  };

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return '';
    const d = parseSafeDate(dateStr);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    const diffTime = Math.abs(today.getTime() - d.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    if (diffDays < 7) {
        return d.toLocaleDateString([], { weekday: 'short' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] dark:bg-navy-950 border-r border-slate-200 dark:border-slate-800/60 overflow-hidden">
      {/* Header */}
      <div className="p-3.5 sm:p-4 md:p-5 border-b border-slate-100 dark:border-slate-800/60 bg-white dark:bg-navy-950 sticky top-0 z-10 shrink-0">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">Inbox</h2>
          <button
            onClick={onNewMessage}
            className="p-2 md:px-3 md:py-2 bg-brand-50 hover:bg-brand-100 dark:bg-brand-900/20 dark:hover:bg-brand-900/40 text-brand-600 dark:text-brand-400 rounded-xl transition-colors text-sm font-bold flex items-center gap-2 cursor-pointer active:scale-95 min-w-[36px] min-h-[36px] justify-center"
            title="New Message"
          >
            <PenSquare className="w-4 h-4 md:hidden" />
            <span className="hidden md:inline">Compose</span>
            <PenSquare className="w-4 h-4 hidden md:inline ml-0.5" />
          </button>
        </div>
        
        <div className="relative group w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-brand-500 transition-colors pointer-events-none" />
          <input
            type="text"
            placeholder="Search messages..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-[#151b23] border border-slate-200/50 dark:border-slate-800 rounded-xl text-[13px] text-slate-900 dark:text-slate-100 placeholder-gray-400 focus:outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 transition-all font-medium box-border"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto bg-white dark:bg-navy-950 flex flex-col">
        {isLoading ? (
          <div className="p-4 space-y-3">
             {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl animate-pulse">
                    <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-800 shrink-0"></div>
                    <div className="flex-1 space-y-2">
                        <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/2"></div>
                        <div className="h-3 bg-slate-100 dark:bg-slate-800/50 rounded w-3/4"></div>
                    </div>
                </div>
             ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center min-h-[260px] p-6 text-center text-slate-500 dark:text-slate-400 my-auto">
            <div className="w-14 h-14 bg-slate-50 dark:bg-slate-800/50 rounded-2xl flex items-center justify-center mb-3 shadow-sm">
               <Inbox className="w-7 h-7 text-slate-400" />
            </div>
            <p className="text-[14px] font-bold text-slate-700 dark:text-slate-300">Nothing here</p>
            <p className="text-[12px] mt-1 opacity-80">No conversations found.</p>
          </div>
        ) : (
          <ul className="p-2 space-y-0.5">
            {filtered.map(conv => {
              const isUnread = conv.unreadCount > 0;
              return (
              <li key={conv.conversationId}>
                <button
                  onClick={() => onSelect(conv.conversationId)}
                  className={clsx(
                    "w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-[#151b23] transition-all flex items-start gap-3.5 rounded-xl border cursor-pointer",
                    activeId === conv.conversationId 
                      ? "bg-brand-50 dark:bg-brand-900/10 border-brand-100 dark:border-brand-900/30 shadow-sm shadow-brand-500/5" 
                      : "bg-transparent border-transparent"
                  )}
                >
                  <div className="relative shrink-0 mt-0.5">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-50 to-indigo-50 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center border border-slate-100 dark:border-slate-700">
                      <span className="text-brand-600 dark:text-slate-300 font-bold text-lg">
                        {conv.otherUser.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    {/* Online status indicator */}
                    {conv.otherUser.isOnline && (
                      <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-navy-950 rounded-full" title="Online now"></div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <h3 className={clsx(
                        "text-[14px] truncate pr-2 tracking-tight flex items-center gap-1.5",
                        isUnread ? "font-black text-slate-900 dark:text-white" : "font-bold text-slate-700 dark:text-slate-200",
                        activeId === conv.conversationId && "text-brand-900 dark:text-brand-100"
                      )}>
                        <span>{conv.otherUser.name}</span>
                      </h3>
                      <span className={clsx(
                          "text-[11px] whitespace-nowrap shrink-0",
                          isUnread ? "font-bold text-brand-600 dark:text-brand-400" : "font-medium text-slate-400"
                      )}>
                        {formatTime(conv.lastMessageAt)}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center mt-1">
                      {conv.isTyping ? (
                        <p className="text-[13px] text-emerald-500 font-extrabold italic animate-pulse">
                          typing...
                        </p>
                      ) : (
                        <p className={clsx(
                          "text-[13px] truncate pr-2 leading-snug",
                          isUnread ? "text-slate-900 dark:text-slate-100 font-bold" : "text-slate-500 dark:text-slate-400 font-medium"
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
                </button>
              </li>
            )})}
          </ul>
        )}
      </div>
    </div>
  );
};
