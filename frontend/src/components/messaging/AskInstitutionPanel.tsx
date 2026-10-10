import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import api from '../../services/api';
import { Sparkles, CheckCircle2, ShieldAlert, ArrowRight, RefreshCw, Send, AlertTriangle, Bot, User, ArrowLeft, History, Plus, Trash2, X, Maximize2, Minimize2 } from 'lucide-react';
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

  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const presetQueries = [
    'Yesterday vs Today Daily Solves',
    'Sunday 9:35 AM Contest Report',
    'Who is inactive this week?',
    'Which students improved most?'
  ];

  useEffect(() => {
    if (messages.length > 0) {
      endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [messages, loading]);

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

  useEffect(() => {
    textareaRef.current?.focus({ preventScroll: true });
  }, []);

  const handleSearch = async (queryText?: string) => {
    const targetQuery = typeof queryText === 'string' ? queryText : query;
    if (!targetQuery || !targetQuery.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: targetQuery
    };

    const currentHistory = [...messages].slice(-10);
    setMessages(prev => [...prev, userMessage]);
    setQuery('');
    setLoading(true);
    setError(null);

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus({ preventScroll: true });
        textareaRef.current.style.height = '44px';
      }
    }, 30);

    try {
      const res = await api.post(
        '/messaging/ask-institution',
        { 
          query: targetQuery,
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
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

  const panelContent = (
    <div 
      className={`bg-white dark:bg-[#0B1120] text-slate-800 dark:text-slate-200 flex flex-col overflow-hidden ${
        isFullscreen 
          ? 'fixed inset-0 z-[99999] w-screen h-screen' 
          : 'w-full h-full relative'
      }`}
      style={isFullscreen ? { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999 } : undefined}
    >
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

          <div className="flex items-center space-x-1 shrink-0 ml-2">
            <button
              type="button"
              onClick={() => setIsFullscreen(previous => !previous)}
              aria-label={isFullscreen ? "Exit Fullscreen" : "Fullscreen mode"}
              className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 rounded-xl cursor-pointer transition-colors"
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen mode"}
            >
              {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Chat Messages / Container */}
      <div className="relative flex-1 min-h-0 flex overflow-hidden bg-slate-50/50 dark:bg-[#060B14]">
        {/* Mobile Backdrop Overlay */}
        <div
          onClick={() => setIsHistoryOpen(false)}
          className={`md:hidden absolute inset-0 bg-slate-950/40 backdrop-blur-xs z-30 transition-opacity duration-300 ${
            isHistoryOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
          aria-hidden="true"
        />

        {/* Responsive Sidebar — CSS transition toggle via isHistoryOpen */}
        <aside className={`absolute md:relative inset-y-0 left-0 z-50 md:z-20 shrink-0 flex flex-col bg-white dark:bg-[#0B1120] transition-all duration-300 ease-in-out ${
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
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {storedChats.length === 0 ? (
                <p className="px-2 py-4 text-xs text-slate-500 dark:text-slate-400">Your recent chats will appear here.</p>
              ) : (
                storedChats.map(chat => (
                  <div
                    key={chat.id}
                    className={`group flex items-start gap-1 rounded-lg ${activeChatId === chat.id ? 'bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800' : 'hover:bg-slate-50 dark:hover:bg-slate-900 border border-transparent'}`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        openStoredChat(chat);
                        if (window.innerWidth < 768) setIsHistoryOpen(false);
                      }}
                      className="min-w-0 flex-1 px-2.5 py-2 text-left cursor-pointer"
                    >
                      <span className="block truncate text-xs font-semibold text-slate-700 dark:text-slate-200">{chat.title}</span>
                      <span className="block mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">
                        {new Date(chat.updatedAt).toLocaleDateString()}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingChatId(chat.id);
                      }}
                      className="p-2 mt-1 mr-1 text-slate-400 opacity-0 group-hover:opacity-100 hover:text-rose-500 cursor-pointer transition-opacity"
                      aria-label={`Delete ${chat.title}`}
                      title="Delete chat"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
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

        <div className="flex-1 overflow-y-auto pt-4 sm:pt-6 pb-4 px-3 sm:px-6 flex flex-col">
          <div className="max-w-5xl mx-auto w-full flex-1 flex flex-col justify-center space-y-4">
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
                                    const downloadUrl = `${api.defaults.baseURL || '/api'}/reports/export-pdf?${reportParams.toString()}`;
                                    window.open(downloadUrl, '_blank');
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
      </div>

      {/* Input Footer */}
      <div className="px-3 sm:px-6 py-2.5 sm:py-3.5 bg-white dark:bg-[#0B1120] border-t border-slate-200/80 dark:border-slate-800/60 shrink-0 w-full">
        <div className="max-w-5xl mx-auto w-full flex items-end gap-2.5 bg-slate-50 dark:bg-[#060B14] border border-slate-300 dark:border-slate-700/80 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 rounded-2xl px-4 py-2 shadow-xs transition-all">
          <textarea
            ref={textareaRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            placeholder="Ask anything about students, performance, or reports..."
            aria-label="Ask institution intelligence"
            className="flex-1 bg-transparent text-slate-800 dark:text-slate-200 text-xs sm:text-sm font-medium min-h-[32px] max-h-24 focus:outline-none resize-none placeholder-slate-400 dark:placeholder-slate-500 py-1"
            rows={1}
            style={{
              height: query ? 'auto' : '32px',
              overflowY: query.split('\n').length > 3 ? 'auto' : 'hidden'
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = '32px';
              if (target.value) {
                target.style.height = `${Math.min(target.scrollHeight, 96)}px`;
              }
            }}
          />
          <button
            type="button"
            onClick={() => handleSearch()}
            disabled={!query.trim() || loading}
            aria-label="Send message"
            className="shrink-0 mb-0.5 w-8 h-8 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-600 text-white rounded-xl transition-all flex items-center justify-center shadow-sm cursor-pointer disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
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
