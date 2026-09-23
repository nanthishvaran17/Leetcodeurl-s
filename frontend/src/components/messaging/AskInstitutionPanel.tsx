import React, { useState, useRef, useEffect } from 'react';
import api from '../../services/api';
import { Sparkles, CheckCircle2, ShieldAlert, ArrowRight, RefreshCw, Send, AlertTriangle, Bot, User, ArrowLeft } from 'lucide-react';
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

interface AskInstitutionPanelProps {
  onActionTrigger?: (action: ActionTrigger) => void;
  onBack?: () => void;
}

export const AskInstitutionPanel: React.FC<AskInstitutionPanelProps> = ({ 
  onActionTrigger,
  onBack
}) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="bg-white dark:bg-[#0B1120] text-slate-800 dark:text-slate-200 w-full flex flex-col h-full overflow-hidden relative">
      {/* Streamlined Responsive Header */}
      <div className="flex items-center px-4 py-3 sm:px-5 sm:py-3.5 bg-white dark:bg-[#0B1120] border-b border-slate-200/80 dark:border-slate-800/60 shrink-0 relative z-10 w-full shadow-xs">
        <div className="max-w-5xl mx-auto w-full flex items-center space-x-3">
          {onBack && (
            <button
              onClick={onBack}
              aria-label="Back to messages"
              className="p-2 -ml-1 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded-xl transition-colors shrink-0 cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="p-2 sm:p-2.5 bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-xl flex items-center justify-center relative overflow-hidden shrink-0 shadow-xs">
            <Sparkles className="w-5 h-5 relative z-10" />
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
      </div>

      {/* Chat Messages / Container */}
      <div className="flex-1 overflow-y-auto p-2.5 sm:p-4 space-y-3 bg-slate-50/50 dark:bg-[#060B14]">
        <div className="max-w-5xl mx-auto w-full space-y-3">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-start text-center py-3 sm:py-5 animate-in fade-in zoom-in duration-300 max-w-xl mx-auto px-2 my-auto">
              <div className="w-10 h-10 sm:w-11 sm:h-11 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center shadow-xs mb-2">
                <Bot className="w-5 h-5" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight mb-1">
                How can I help you today?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed font-medium mb-3">
                Ask me to generate reports, find inactive students, or analyze performance. All answers are verified against live DB records.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
                {presetQueries.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      handleSearch(preset);
                    }}
                    className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:bg-indigo-50/50 dark:hover:bg-indigo-500/10 hover:text-indigo-700 dark:hover:text-indigo-300 text-slate-700 dark:text-slate-300 text-xs font-semibold px-3 py-2.5 rounded-xl transition-colors cursor-pointer text-left flex justify-between items-center group shadow-xs"
                  >
                    <span className="truncate">{preset}</span>
                    <div className="w-4 h-4 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1.5">
                      <ArrowRight className="w-3 h-3 text-indigo-600 dark:text-indigo-300" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} w-full animate-in fade-in slide-in-from-bottom-2 duration-200`}>
                <div className={`flex max-w-[94%] sm:max-w-[88%] ${msg.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''} space-x-3 sm:space-x-4`}>
                  
                  {/* Avatar */}
                  <div className="shrink-0 flex items-start pt-1">
                    {msg.role === 'user' ? (
                      <div className="w-8 h-8 rounded-full bg-slate-800 dark:bg-slate-700 flex items-center justify-center text-white shadow-xs">
                        <User className="w-4 h-4" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-xs">
                        <Sparkles className="w-4 h-4" />
                      </div>
                    )}
                  </div>

                  {/* Message Bubble */}
                  <div className={`flex flex-col space-y-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`px-4 py-3 sm:px-5 sm:py-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-xs ${
                      msg.role === 'user' 
                        ? 'bg-slate-800 text-white dark:bg-indigo-600 rounded-tr-xs font-medium' 
                        : 'bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-xs w-full'
                    }`}>
                      {msg.role === 'assistant' ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none prose-tables:border prose-tables:rounded-xl prose-th:bg-slate-50 dark:prose-th:bg-slate-800/60 prose-th:text-slate-700 dark:prose-th:text-slate-300 prose-td:border-t prose-p:my-1.5 prose-ul:my-1.5 font-medium">
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
                          <div className="flex flex-wrap gap-2 pt-0.5">
                            {msg.actions.map((act, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => {
                                  if (act.action === 'RUN_QUERY') {
                                    handleSearch(act.params.query);
                                  } else if (['DOWNLOAD_PDF', 'EXPORT_PDF', 'EXPORT_STUDENT_PDF'].includes(act.action)) {
                                    const token = localStorage.getItem('token') || '';
                                    const downloadUrl = `${api.defaults.baseURL || '/api'}/reports/export-pdf?token=${token}`;
                                    window.open(downloadUrl, '_blank');
                                  } else {
                                    onActionTrigger && onActionTrigger(act);
                                  }
                                }}
                                className="bg-white dark:bg-slate-900 hover:bg-indigo-600 dark:hover:bg-indigo-600 text-indigo-600 dark:text-indigo-400 hover:text-white dark:hover:text-white border border-indigo-200 dark:border-indigo-800 hover:border-transparent px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all duration-200 shadow-xs cursor-pointer group"
                              >
                                <span>{act.label}</span>
                                <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform" />
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

      {/* Input Footer */}
      <div className="p-2 sm:p-2.5 bg-white dark:bg-[#0B1120] border-t border-slate-200/80 dark:border-slate-800/60 shrink-0 w-full">
        <div className="relative max-w-5xl mx-auto w-full group">
          <textarea
            ref={textareaRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            placeholder="Ask anything (e.g. Who missed the last contest?)..."
            aria-label="Ask institution intelligence"
            className="w-full bg-slate-50 dark:bg-[#060B14] border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-xs sm:text-sm font-medium rounded-xl pl-3.5 pr-12 py-2 min-h-[40px] max-h-24 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none transition-all placeholder-slate-400 dark:placeholder-slate-600 shadow-xs"
            rows={1}
            style={{
              height: query ? 'auto' : '40px',
              overflowY: query.split('\n').length > 3 ? 'auto' : 'hidden'
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = '40px';
              if (target.value) {
                target.style.height = `${Math.min(target.scrollHeight, 100)}px`;
              }
            }}
          />
          <button
            type="button"
            onClick={() => handleSearch()}
            disabled={!query.trim() || loading}
            aria-label="Send message"
            className="absolute right-1.5 bottom-1.5 w-7 h-7 sm:w-8 sm:h-8 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-600 text-white rounded-lg transition-all flex items-center justify-center shadow-xs cursor-pointer disabled:cursor-not-allowed"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
