import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import api from '../../services/api';
import { downloadManager } from '../../services/download/downloadManager';
import { CheckCircle2, ShieldAlert, ArrowRight, RefreshCw, Send, AlertTriangle, Bot, User, ArrowLeft, History, Plus, Trash2, X, Maximize2, Minimize2, MoreVertical, Share2, Archive, MessageSquare, Check, Copy, ChevronDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ActionTrigger {
  label: string;
  action: string;
  params: Record<string, any>;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  evidence?: string[];
  actions?: ActionTrigger[];
  dataConfidence?: string;
}

interface StoredChat {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: string;
  archived?: boolean;
}

const chatHistoryKey = 'institution-intelligence-chat-conversations';
const legacyChatHistoryKey = 'institution-intelligence-chat-history';

function loadStoredChats(): StoredChat[] {
  try {
    const savedChats = localStorage.getItem(chatHistoryKey);
    const parsedChats = savedChats ? JSON.parse(savedChats) : [];
    if (Array.isArray(parsedChats) && parsedChats.length > 0) return parsedChats;

    const legacyMessages = JSON.parse(localStorage.getItem(legacyChatHistoryKey) || '[]');
    if (Array.isArray(legacyMessages) && legacyMessages.length > 0) {
      return [{
        id: `chat_${Date.now()}`,
        title: legacyMessages.find((message: ChatMessage) => message.role === 'user')?.content || 'Previous conversation',
        messages: legacyMessages,
        updatedAt: new Date().toISOString()
      }];
    }
  } catch {
    return [];
  }
  return [];
}

interface AskInstitutionPanelProps {
  onActionTrigger?: (action: ActionTrigger) => void;
  onBack?: () => void;
}

export const AskInstitutionPanel: React.FC<AskInstitutionPanelProps> = ({ 
  onActionTrigger,
  onBack
}) => {
  const [storedChats, setStoredChats] = useState<StoredChat[]>(loadStoredChats);
  const [activeChatId, setActiveChatId] = useState<string | null>(() => loadStoredChats()[0]?.id || null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    return loadStoredChats()[0]?.messages || [];
  });
  const [error, setError] = useState<string | null>(null);
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null);
  const [openMenuChatId, setOpenMenuChatId] = useState<string | null>(null);
  const [showArchivedView, setShowArchivedView] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const presetQueries = [
    'Yesterday vs Today Daily Solves',
    'Sunday 9:35 AM Contest Report',
    'Who is inactive this week?',
    'Which students improved most?'
  ];

function encodeChatToShareUrl(chat: StoredChat): string {
  try {
    const payload = {
      t: chat.title,
      m: chat.messages.map(m => ({ r: m.role, c: m.content, e: m.evidence, a: m.actions, d: m.dataConfidence }))
    };
    const jsonStr = JSON.stringify(payload);
    const base64 = btoa(encodeURIComponent(jsonStr));
    const url = new URL(window.location.href);
    url.searchParams.set('ai_chat', chat.id);
    url.searchParams.set('shareData', base64);
    return url.toString();
  } catch (e) {
    const url = new URL(window.location.href);
    url.searchParams.set('ai_chat', chat.id);
    return url.toString();
  }
}

function decodeShareUrlPayload(base64Payload: string): StoredChat | null {
  try {
    let b64 = base64Payload.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const jsonStr = decodeURIComponent(atob(b64));
    const payload = JSON.parse(jsonStr);
    if (payload && payload.t && Array.isArray(payload.m)) {
      return {
        id: `shared_${Date.now()}`,
        title: payload.t,
        messages: payload.m.map((m: any, i: number) => ({
          id: `shared_msg_${i}`,
          role: m.r,
          content: m.c,
          evidence: m.e,
          actions: m.a,
          dataConfidence: m.d
        })),
        updatedAt: new Date().toISOString()
      };
    }
  } catch (e) {
    return null;
  }
  return null;
}

  useEffect(() => {
    const handleClickOutside = () => setOpenMenuChatId(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  // ChatGPT-Style Share Link Auto-Load Listener
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const targetChatId = params.get('ai_chat') || params.get('chat');
      const shareData = params.get('shareData');

      if (shareData) {
        const decoded = decodeShareUrlPayload(shareData);
        if (decoded) {
          setStoredChats(prev => {
            const next = [decoded, ...prev.filter(c => c.id !== decoded.id)];
            try { localStorage.setItem(chatHistoryKey, JSON.stringify(next)); } catch {}
            return next;
          });
          setActiveChatId(decoded.id);
          setMessages(decoded.messages);
          setToastMessage('Shared conversation loaded!');
          setTimeout(() => setToastMessage(null), 3000);
          return;
        }
      }

      if (targetChatId) {
        const allChats = loadStoredChats();
        const matched = allChats.find(c => c.id === targetChatId);
        if (matched) {
          setActiveChatId(matched.id);
          setMessages(matched.messages);
        }
      }
    } catch (e) {
      console.warn('Error loading shared chat link:', e);
    }
  }, []);

  const toggleArchiveChat = (chatId: string) => {
    setStoredChats(previousChats => {
      const nextChats = previousChats.map(c => c.id === chatId ? { ...c, archived: !c.archived } : c);
      try {
        localStorage.setItem(chatHistoryKey, JSON.stringify(nextChats));
      } catch {
        // Fallback
      }
      return nextChats;
    });
    setToastMessage('Chat status updated');
    setTimeout(() => setToastMessage(null), 2500);
  };

  const shareChat = async (chat: StoredChat) => {
    const shareUrl = encodeChatToShareUrl(chat);
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Institutional AI Chat - ${chat.title}`,
          text: `Explore this Institutional AI Conversation: "${chat.title}"`,
          url: shareUrl,
        });
        setToastMessage('Share link sent!');
        setTimeout(() => setToastMessage(null), 2500);
        return;
      } catch (err) {
        // User cancelled or share API unsupported, fallback to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setToastMessage('Shareable link copied to clipboard!');
    } catch {
      setToastMessage('Unable to copy share link.');
    }
    setTimeout(() => setToastMessage(null), 2500);
  };

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const isNearBottomRef = useRef(true);

  const handleMessagesScroll = () => {
    if (!messagesContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 120;
    isNearBottomRef.current = isNearBottom;
    setShowScrollBottom(!isNearBottom);
  };

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior
      });
      isNearBottomRef.current = true;
      setShowScrollBottom(false);
    }
  }, []);

  // Auto-scroll when messages or loading state changes
  useEffect(() => {
    if (messages.length === 0) return;
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === 'user') {
      scrollToBottom('smooth');
    } else if (isNearBottomRef.current) {
      scrollToBottom('smooth');
    }
  }, [messages, loading, scrollToBottom]);

  // Keep bottom anchored if user was already following and content resizes (e.g. markdown rendering, tables)
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => {
      if (isNearBottomRef.current) {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: 'auto'
        });
      }
    });
    if (container.firstElementChild) {
      observer.observe(container.firstElementChild);
    }
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!messages.length) return;

    const firstUserMessage = messages.find(message => message.role === 'user');
    const updatedChat: StoredChat = {
      id: activeChatId || `chat_${Date.now()}`,
      title: firstUserMessage?.content || 'New conversation',
      messages: messages.slice(-100),
      updatedAt: new Date().toISOString()
    };

    setActiveChatId(currentId => currentId || updatedChat.id);
    setStoredChats(previousChats => {
      const nextChats = [updatedChat, ...previousChats.filter(chat => chat.id !== updatedChat.id)].slice(0, 20);
      try {
        localStorage.setItem(chatHistoryKey, JSON.stringify(nextChats));
      } catch {
        // Keep the chat usable when browser storage is unavailable or full.
      }
      return nextChats;
    });
  }, [messages, activeChatId]);

  const startNewChat = () => {
    setActiveChatId(null);
    setMessages([]);
    setError(null);
  };

  useEffect(() => {
    if (isHistoryOpen) {
      const diskChats = loadStoredChats();
      setStoredChats(existing => {
        const map = new Map<string, StoredChat>();
        existing.forEach(c => map.set(c.id, c));
        diskChats.forEach(c => map.set(c.id, c));
        return Array.from(map.values()).sort((a, b) => 
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      });
    }
  }, [isHistoryOpen]);

  const toggleHistory = () => {
    setIsHistoryOpen(prev => !prev);
  };

  const openStoredChat = (chat: StoredChat) => {
    setActiveChatId(chat.id);
    setMessages(chat.messages);
    setError(null);
  };

  const deleteStoredChat = (chatId: string) => {
    setStoredChats(previousChats => {
      const nextChats = previousChats.filter(chat => chat.id !== chatId);
      localStorage.setItem(chatHistoryKey, JSON.stringify(nextChats));
      return nextChats;
    });
    if (activeChatId === chatId) startNewChat();
  };

  const adjustTextareaHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const newHeight = Math.min(Math.max(el.scrollHeight, 38), 120);
    el.style.height = `${newHeight}px`;
    el.style.overflowY = el.scrollHeight > 120 ? 'auto' : 'hidden';
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [query, adjustTextareaHeight]);

  useEffect(() => {
    textareaRef.current?.focus({ preventScroll: true });
  }, []);

  const handleSearch = async (queryText?: string) => {
    const targetQuery = typeof queryText === 'string' ? queryText : query;
    if (!targetQuery || !targetQuery.trim() || loading) return;

    const trimmed = targetQuery.trim();
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: trimmed
    };

    const currentHistory = [...messages].slice(-10);
    setMessages(prev => [...prev, userMessage]);
    setQuery('');
    setLoading(true);
    setError(null);
    isNearBottomRef.current = true;

    // Smooth scroll to latest user message
    setTimeout(() => scrollToBottom('smooth'), 40);

    try {
      const res = await api.post(
        '/messaging/ask-institution',
        { 
          query: trimmed,
          history: currentHistory.map(m => ({ role: m.role, text: m.content })) 
        }
      );

      if (res.data?.success && res.data?.result) {
        const result = res.data.result;
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: result.answer,
          evidence: result.evidence,
          actions: result.actions,
          dataConfidence: result.dataConfidence
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        setError('Failed to retrieve verified institutional response.');
      }
    } catch (err: any) {
      console.error('Ask Institution query error:', err);
      setError(err.response?.data?.detail || 'Error executing query against institutional database.');
    } finally {
      setLoading(false);
      setTimeout(() => {
        textareaRef.current?.focus({ preventScroll: true });
      }, 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    }
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isFullscreen]);

  const activeChatsList = storedChats.filter(c => !c.archived);
  const archivedChatsList = storedChats.filter(c => c.archived);
  const displayChatsList = showArchivedView ? archivedChatsList : activeChatsList;

  const panelContent = (
    <div 
      className={`bg-white dark:bg-[#0B1120] text-slate-800 dark:text-slate-200 flex flex-col overflow-hidden ${
        isFullscreen 
          ? 'fixed inset-0 z-[99999] w-screen h-screen' 
          : 'w-full h-full min-h-0 flex-1 relative'
      }`}
      style={isFullscreen ? { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999 } : undefined}
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 right-6 z-[999999] px-4 py-2.5 bg-slate-900/95 dark:bg-slate-800/95 text-white text-xs font-bold rounded-xl shadow-2xl border border-slate-700/80 flex items-center space-x-2 animate-in fade-in slide-in-from-top-2 backdrop-blur-md">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Streamlined Responsive Header */}
      <div className="flex items-center px-4 py-3 sm:px-6 sm:py-3.5 bg-white dark:bg-[#0B1120] border-b border-slate-200/80 dark:border-slate-800/60 shrink-0 relative z-10 w-full shadow-xs">
        <div className="w-full flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {onBack && (
              <button
                onClick={() => {
                  if (isFullscreen) setIsFullscreen(false);
                  onBack();
                }}
                aria-label="Back to messages"
                className="p-2 -ml-1 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded-xl transition-colors shrink-0 cursor-pointer"
                title="Back to Inbox"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}

            {/* Toggle Recent Chats Sidebar Button */}
            <button
              type="button"
              onClick={() => setIsHistoryOpen(prev => !prev)}
              aria-label={isHistoryOpen ? "Hide Recent Chats Sidebar" : "Show Recent Chats Sidebar"}
              className={`p-2 rounded-xl transition-all cursor-pointer shrink-0 flex items-center justify-center ${
                isHistoryOpen
                  ? 'bg-indigo-600 text-white dark:bg-indigo-600 shadow-md ring-2 ring-indigo-500/30 scale-105'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 shadow-xs'
              }`}
              title={isHistoryOpen ? "Hide Recent Chats Sidebar" : "Show Recent Chats Sidebar"}
            >
              <History className="w-5 h-5" />
            </button>

            <div className="p-2 sm:p-2.5 bg-indigo-600 dark:bg-indigo-600 text-white rounded-xl flex items-center justify-center relative overflow-hidden shrink-0 shadow-xs">
              <Bot className="w-5 h-5 relative z-10" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base sm:text-lg md:text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-tight truncate">
                Institution Intelligence Assistant
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5 flex items-center truncate">
                <ShieldAlert className="w-3.5 h-3.5 mr-1 text-emerald-500 shrink-0" />
                <span className="truncate">RBAC-enforced AI assistant grounded in verified DB records.</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0 ml-2">
            <button
              type="button"
              onClick={() => setIsFullscreen(previous => !previous)}
              aria-label={isFullscreen ? "Exit Fullscreen" : "Fullscreen mode"}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded-xl cursor-pointer transition-all border border-slate-200 dark:border-slate-700 shadow-2xs"
              title={isFullscreen ? "Exit Fullscreen" : "Expand to Full Screen"}
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-4 h-4 text-indigo-500 shrink-0" />
                  <span className="hidden sm:inline">Exit Fullscreen</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-4 h-4 text-indigo-500 shrink-0" />
                  <span className="hidden sm:inline">Full Screen</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Chat Messages / Container */}
      <div className="relative flex-1 min-h-0 h-full w-full flex overflow-hidden bg-slate-50/50 dark:bg-[#060B14]">
        {/* Mobile Backdrop Overlay */}
        <div
          onClick={() => setIsHistoryOpen(false)}
          className={`md:hidden absolute inset-0 bg-slate-950/40 backdrop-blur-xs z-30 transition-opacity duration-300 ${
            isHistoryOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
          aria-hidden="true"
        />

        {/* Responsive Sidebar — CSS transition toggle via isHistoryOpen */}
        <aside className={`absolute md:relative inset-y-0 left-0 z-50 md:z-20 shrink-0 flex flex-col h-full bg-white dark:bg-[#0B1120] transition-all duration-300 ease-in-out ${
          isHistoryOpen 
            ? 'w-72 md:w-64 border-r border-slate-200 dark:border-slate-800 shadow-2xl md:shadow-none opacity-100 translate-x-0 pointer-events-auto' 
            : 'w-0 md:w-0 border-0 shadow-none opacity-0 -translate-x-full md:translate-x-0 overflow-hidden pointer-events-none'
        }`}>
          <div className="w-72 md:w-64 flex flex-col h-full shrink-0">
            <div className="flex items-center justify-between px-3 py-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
                <History className="w-4 h-4 text-indigo-500" />
                <span>Recent chats</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIsHistoryOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  aria-label="Close sidebar"
                  title="Close recent chats sidebar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Active / Archived Filter Bar */}
            <div className="flex items-center gap-1 border-b border-slate-200/80 dark:border-slate-800/80 px-2 py-1.5 bg-slate-50/50 dark:bg-slate-900/40">
              <button
                type="button"
                onClick={() => setShowArchivedView(false)}
                className={`flex-1 py-1 px-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer text-center ${
                  !showArchivedView 
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs border border-slate-200/80 dark:border-slate-700' 
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                Chats ({activeChatsList.length})
              </button>
              <button
                type="button"
                onClick={() => setShowArchivedView(true)}
                className={`flex-1 py-1 px-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer text-center ${
                  showArchivedView 
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs border border-slate-200/80 dark:border-slate-700' 
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                Archived ({archivedChatsList.length})
              </button>
            </div>

            {/* Chats List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {displayChatsList.length === 0 ? (
                <div className="px-3 py-6 text-center">
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                    {showArchivedView ? 'No archived chats.' : 'Your recent chats will appear here.'}
                  </p>
                </div>
              ) : (
                displayChatsList.map(chat => (
                  <div
                    key={chat.id}
                    className={`group relative flex items-center justify-between rounded-xl px-2.5 py-2 transition-all ${
                      activeChatId === chat.id 
                        ? 'bg-indigo-50/90 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800/80 shadow-2xs' 
                        : 'hover:bg-slate-100/80 dark:hover:bg-slate-900 border border-transparent'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        openStoredChat(chat);
                        if (window.innerWidth < 768) setIsHistoryOpen(false);
                      }}
                      className="min-w-0 flex-1 text-left cursor-pointer pr-1"
                    >
                      <span className="block truncate text-xs font-bold text-slate-800 dark:text-slate-200">
                        {chat.title}
                      </span>
                      <span className="block mt-0.5 text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                        {new Date(chat.updatedAt).toLocaleDateString()}
                      </span>
                    </button>

                    {/* 3-Dots Action Menu */}
                    <div className="relative shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuChatId(openMenuChatId === chat.id ? null : chat.id);
                        }}
                        className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        aria-label={`Options for ${chat.title}`}
                        title="More options"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>

                      {/* Dropdown Menu Popup */}
                      {openMenuChatId === chat.id && (
                        <div 
                          className="absolute right-0 top-7 z-[100] w-44 bg-white dark:bg-[#0E1726] border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl py-1 text-xs animate-in fade-in zoom-in-95"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              openStoredChat(chat);
                              setOpenMenuChatId(null);
                              if (window.innerWidth < 768) setIsHistoryOpen(false);
                            }}
                            className="w-full px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 flex items-center gap-2 cursor-pointer"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-indigo-500" />
                            Open chat
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              shareChat(chat);
                              setOpenMenuChatId(null);
                            }}
                            className="w-full px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 flex items-center gap-2 cursor-pointer"
                          >
                            <Share2 className="w-3.5 h-3.5 text-emerald-500" />
                            Share chat
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              toggleArchiveChat(chat.id);
                              setOpenMenuChatId(null);
                            }}
                            className="w-full px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 flex items-center gap-2 cursor-pointer"
                          >
                            <Archive className="w-3.5 h-3.5 text-amber-500" />
                            {chat.archived ? 'Unarchive' : 'Archive chat'}
                          </button>

                          <div className="my-1 border-t border-slate-100 dark:border-slate-800/80" />

                          <button
                            type="button"
                            onClick={() => {
                              setDeletingChatId(chat.id);
                              setOpenMenuChatId(null);
                            }}
                            className="w-full px-3 py-2 text-left font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete chat
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-2.5 border-t border-slate-200 dark:border-slate-800 shrink-0 bg-white dark:bg-[#0B1120]">
              <button
                type="button"
                onClick={() => {
                  startNewChat();
                  if (window.innerWidth < 768) setIsHistoryOpen(false);
                }}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-indigo-200 dark:border-indigo-800 px-3 py-2.5 text-xs font-bold text-indigo-600 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer transition-colors shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                New chat
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content Area (Scrollable Messages + Fixed Bottom Input Container) */}
        <div className="flex-1 min-w-0 min-h-0 h-full flex flex-col overflow-hidden relative">
          {/* Scrollable Messages Container */}
          <div 
            ref={messagesContainerRef}
            onScroll={handleMessagesScroll}
            className="flex-1 min-h-0 w-full overflow-y-auto pt-4 sm:pt-6 pb-4 sm:pb-6 px-3 sm:px-6 flex flex-col"
          >
            <div className={`max-w-5xl mx-auto w-full flex-1 flex flex-col space-y-4 ${
              messages.length === 0 ? 'justify-center' : 'justify-start'
            }`}>
              {messages.length === 0 ? (
                <div className="my-auto py-6 sm:py-10 px-2 w-full flex justify-center items-center animate-in fade-in zoom-in-95 duration-300">
                  <div className="bg-white/95 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-6 sm:p-8 max-w-md sm:max-w-lg w-full text-center shadow-lg hover:shadow-xl transition-all duration-300 space-y-5">
                    <div className="w-12 h-12 mx-auto bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 text-white rounded-2xl flex items-center justify-center shadow-md ring-4 ring-indigo-50 dark:ring-indigo-950/50 animate-pulse">
                      <Bot className="w-6 h-6" />
                    </div>
                    <div className="space-y-1.5">
                      <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                        How can I help you today?
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                        Ask me to generate reports, find inactive students, or analyze performance. All answers are verified against live DB records.
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left pt-2">
                      {presetQueries.map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            handleSearch(preset);
                          }}
                          className="bg-slate-50 dark:bg-slate-800/60 hover:bg-indigo-50/80 dark:hover:bg-indigo-950/70 border border-slate-200/80 dark:border-slate-700/60 hover:border-indigo-400 dark:hover:border-indigo-600 text-slate-700 dark:text-slate-200 text-xs font-semibold p-3 rounded-2xl transition-all duration-200 cursor-pointer flex justify-between items-center group hover:-translate-y-0.5 hover:shadow-sm"
                        >
                          <span className="truncate pr-1">{preset}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 shrink-0 transition-transform group-hover:translate-x-1" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} w-full animate-in fade-in slide-in-from-bottom-2 duration-200`}>
                    <div className={`flex max-w-[96%] sm:max-w-[90%] gap-3 sm:gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                      
                      {/* Avatar */}
                      <div className="shrink-0 flex items-start pt-1">
                        {msg.role === 'user' ? (
                          <div className="w-8 h-8 rounded-full bg-slate-800 dark:bg-slate-700 flex items-center justify-center text-white shadow-xs">
                            <User className="w-4 h-4" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-indigo-600 dark:bg-indigo-600 flex items-center justify-center text-white shadow-xs">
                            <Bot className="w-4 h-4" />
                          </div>
                        )}
                      </div>

                      {/* Message Bubble */}
                      <div className={`flex flex-col space-y-2 min-w-0 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                        <div className={`px-4 py-3 sm:px-5 sm:py-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-xs ${
                          msg.role === 'user' 
                            ? 'bg-slate-800 text-white dark:bg-indigo-600 rounded-tr-xs font-medium' 
                            : 'bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-xs w-full'
                        }`}>
                          {msg.role === 'assistant' ? (
                            <div className="prose prose-sm dark:prose-invert max-w-none overflow-x-auto prose-tables:border prose-tables:rounded-xl prose-th:bg-slate-50 dark:prose-th:bg-slate-800/60 prose-th:text-slate-700 dark:prose-th:text-slate-300 prose-td:border-t prose-p:my-1.5 prose-ul:my-1.5 font-medium">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {msg.content}
                              </ReactMarkdown>
                            </div>
                          ) : (
                            <span>{msg.content}</span>
                          )}
                        </div>
                        
                        {/* Metadata & Actions */}
                        {msg.role === 'assistant' && (
                          <div className="w-full flex flex-col space-y-2.5 pt-1">
                            {msg.dataConfidence && (
                              <div className="flex items-center space-x-1.5 self-start px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 shadow-xs">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>{msg.dataConfidence}</span>
                              </div>
                            )}

                            {msg.evidence && msg.evidence.length > 0 && (
                              <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs space-y-1.5 max-w-xl">
                                <div className="font-bold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5 mb-1">
                                  <ShieldAlert className="w-3.5 h-3.5 text-slate-500" />
                                  <span>Verified Provenance</span>
                                </div>
                                <ul className="space-y-1 text-slate-500 dark:text-slate-400 font-medium list-disc list-inside">
                                  {msg.evidence.map((ev, i) => (
                                    <li key={i}>{ev}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {msg.actions && msg.actions.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 pt-0.5">
                                {msg.actions.map((act, i) => (
                                  <button
                                    key={i}
                                    type="button"
                                    onClick={async () => {
                                      if (act.action === 'RUN_QUERY') {
                                        handleSearch(act.params.query);
                                      } else if (act.action === 'EXPORT_STUDENT_PDF') {
                                        const studentId = act.params?.student_id;
                                        if (!studentId) {
                                          setError('Student report could not be identified. Please run the student lookup again.');
                                          return;
                                        }

                                        try {
                                          const response = await api.post(
                                            '/student-reports/generate-direct',
                                            { student_id: studentId, report_type: 'STUDENT', format: 'pdf' },
                                            { responseType: 'blob' }
                                          );
                                          const blobUrl = URL.createObjectURL(response.data);
                                          const link = document.createElement('a');
                                          link.href = blobUrl;
                                          link.download = `student-report-${studentId}.pdf`;
                                          document.body.appendChild(link);
                                          link.click();
                                          link.remove();
                                          URL.revokeObjectURL(blobUrl);
                                        } catch (err: any) {
                                          console.error('Student PDF export error:', err);
                                          setError(err.response?.data?.detail || 'Unable to generate the student PDF report.');
                                        }
                                      } else if (['DOWNLOAD_PDF', 'EXPORT_PDF'].includes(act.action)) {
                                        const token = localStorage.getItem('token') || '';
                                        const reportParams = new URLSearchParams({ token });
                                        Object.entries(act.params || {}).forEach(([key, value]) => {
                                          if (value !== undefined && value !== null && value !== '') {
                                            reportParams.set(key, String(value));
                                          }
                                        });
                                        downloadManager.download({
                                          endpoint: '/reports/export-pdf',
                                          filename: `Institution_Report_${Date.now()}.pdf`,
                                          params: act.params || {},
                                          mimeType: 'application/pdf',
                                        });
                                      } else {
                                        onActionTrigger && onActionTrigger(act);
                                      }
                                    }}
                                    className="bg-white dark:bg-slate-900 hover:bg-indigo-600 dark:hover:bg-indigo-600 text-indigo-600 dark:text-indigo-400 hover:text-white dark:hover:text-white border border-indigo-200 dark:border-indigo-800 hover:border-transparent px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center space-x-1 transition-all duration-200 shadow-xs cursor-pointer group whitespace-nowrap"
                                  >
                                    <span>{act.label}</span>
                                    <ArrowRight className="w-3 h-3 transform group-hover:translate-x-0.5 transition-transform shrink-0" />
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}

              {/* Loading Indicator */}
              {loading && (
                <div className="flex justify-start w-full animate-pulse">
                  <div className="flex space-x-3 items-center">
                    <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    </div>
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-3 rounded-2xl rounded-tl-xs shadow-xs flex items-center space-x-2">
                      <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 ml-2">Analyzing verified records...</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Error state */}
              {error && (
                <div className="flex justify-center my-3 w-full animate-in fade-in slide-in-from-top-2">
                  <div className="px-4 py-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center space-x-2.5 shadow-xs max-w-lg">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                    <span>{error}</span>
                  </div>
                </div>
              )}
            </div>
            <div ref={endOfMessagesRef} />
          </div>

          {/* Floating Scroll to Bottom Button */}
          {showScrollBottom && (
            <button
              type="button"
              onClick={() => scrollToBottom('smooth')}
              aria-label="Scroll to latest messages"
              className="absolute bottom-20 sm:bottom-24 right-5 sm:right-8 z-20 p-2 sm:p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-1.5 text-xs font-bold border border-indigo-500/50 group"
              title="Scroll to latest messages"
            >
              <ChevronDown className="w-4 h-4 transition-transform group-hover:translate-y-0.5" />
              <span className="hidden sm:inline text-[11px]">Latest</span>
            </button>
          )}

          {/* Static Bottom Search Input Area / Composer */}
          <div className="px-3 sm:px-6 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-white/95 dark:bg-[#0B1120]/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800/80 shrink-0 w-full z-10">
            <div className="max-w-5xl mx-auto w-full flex items-end gap-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700/80 focus-within:border-indigo-500 dark:focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 rounded-2xl px-3.5 sm:px-4 py-2 shadow-xs transition-all">
              <textarea
                ref={textareaRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
                placeholder="Ask anything about students, performance, or reports... (Enter to send, Shift+Enter for newline)"
                aria-label="Ask institution intelligence"
                className="flex-1 bg-transparent text-slate-800 dark:text-slate-200 text-xs sm:text-sm font-medium min-h-[38px] max-h-[120px] focus:outline-none resize-none placeholder-slate-400 dark:placeholder-slate-500 py-2 leading-relaxed"
                rows={1}
              />
              <button
                type="button"
                onClick={() => handleSearch()}
                disabled={!query.trim() || loading}
                aria-label="Send message"
                className="shrink-0 mb-1 w-9 h-9 sm:w-10 sm:h-10 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-600 text-white rounded-xl transition-all flex items-center justify-center shadow-xs cursor-pointer disabled:cursor-not-allowed hover:scale-105 active:scale-95"
                title={loading ? "Generating response..." : "Send message"}
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deletingChatId && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-navy-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-rose-600 dark:text-rose-400">
              <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Delete Chat History?</h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Are you sure you want to delete this conversation? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingChatId(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteStoredChat(deletingChatId);
                  setDeletingChatId(null);
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-sm cursor-pointer"
              >
                Delete Chat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (isFullscreen) {
    return createPortal(panelContent, document.body);
  }

  return panelContent;
};
