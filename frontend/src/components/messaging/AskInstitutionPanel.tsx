import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { getApiUrl, getAuthHeaders } from '../../services/api';
import { Sparkles, CheckCircle2, ShieldAlert, ArrowRight, RefreshCw, Send, AlertTriangle, Bot, User } from 'lucide-react';
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

export const AskInstitutionPanel: React.FC<{
  onActionTrigger?: (action: ActionTrigger) => void;
}> = ({ onActionTrigger }) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  const presetQueries = [
    'Who is inactive this week?',
    'Who missed the last contest?',
    'Which students improved most?',
    'Which topics are difficult?'
  ];

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSearch = async (queryText: string) => {
    if (!queryText.trim()) return;
    
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: queryText
    };
    
    // Maintain max history (last 10 messages)
    const currentHistory = [...messages].slice(-10);
    setMessages(prev => [...prev, userMessage]);
    setQuery('');
    setLoading(true);
    setError(null);

    try {
      const res = await axios.post(
        getApiUrl('/messaging/ask-institution'),
        { 
          query: queryText,
          history: currentHistory.map(m => ({ role: m.role, text: m.content })) 
        },
        { headers: getAuthHeaders() }
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
      {/* Premium Header */}
      <div className="flex items-center p-4 md:p-6 bg-white dark:bg-[#0B1120] border-b border-slate-100 dark:border-slate-800/50 shrink-0 relative z-10 w-full">
        <div className="max-w-4xl mx-auto w-full flex items-center space-x-4">
            <div className="p-3 bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-xl flex items-center justify-center relative overflow-hidden shrink-0">
                <Sparkles className="w-6 h-6 relative z-10" />
            </div>
            <div>
              <h2 className="text-2xl md:text-[28px] font-bold text-slate-800 dark:text-slate-100 tracking-tight leading-none">Institution Intelligence Assistant</h2>
              <p className="text-sm font-medium mt-1.5 text-slate-500 flex items-center">
                <ShieldAlert className="w-4 h-4 mr-1.5 text-emerald-500 shrink-0" />
                <span>RBAC-enforced AI assistant grounded strictly in verified institutional database records.</span>
              </p>
            </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scroll-smooth bg-slate-50/50 dark:bg-[#060B14]">
        <div className="max-w-4xl mx-auto w-full space-y-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-10 animate-in fade-in zoom-in duration-500">
            <div className="relative w-14 h-14 bg-white dark:bg-slate-800 border border-indigo-100 dark:border-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center shadow-sm mb-4">
                <Bot className="w-7 h-7" />
            </div>
            <h3 className="text-[28px] md:text-[32px] font-bold text-slate-800 dark:text-slate-100 tracking-tight mb-2">How can I help you today?</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed font-medium mb-6">Ask me to generate reports, find inactive students, or analyze performance. All answers are verified against live DB records.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-2xl">
              {presetQueries.map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSearch(preset)}
                  className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-700 dark:hover:text-indigo-300 text-slate-700 dark:text-slate-300 text-sm font-semibold px-4 py-3 min-h-[56px] rounded-xl transition-colors cursor-pointer text-left flex justify-between items-center group shadow-sm"
                >
                  <span>{preset}</span>
                  <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowRight className="w-3.5 h-3.5 text-indigo-600" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} w-full animate-in fade-in slide-in-from-bottom-3 duration-300`}>
              <div className={`flex max-w-[90%] sm:max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''} space-x-4`}>
                
                {/* Avatar */}
                <div className="shrink-0 flex items-start pt-1">
                    {msg.role === 'user' ? (
                        <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-white shadow-md ring-2 ring-slate-100">
                            <User className="w-4 h-4" />
                        </div>
                    ) : (
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg ring-2 ring-indigo-50">
                            <Sparkles className="w-4 h-4" />
                        </div>
                    )}
                </div>

                {/* Message Bubble */}
                <div className={`flex flex-col space-y-3 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`px-6 py-4 rounded-3xl text-[14.5px] leading-relaxed shadow-sm ${
                        msg.role === 'user' 
                        ? 'bg-slate-800 text-white rounded-tr-sm font-medium' 
                        : 'bg-white border border-slate-200/70 text-slate-800 rounded-tl-sm w-full'
                    }`}>
                        {msg.role === 'assistant' ? (
                            <div className="prose prose-sm prose-slate max-w-none prose-tables:border prose-tables:rounded-xl prose-th:bg-slate-50 prose-th:text-slate-600 prose-td:border-t prose-p:my-2 prose-ul:my-2 font-medium">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {msg.content}
                                </ReactMarkdown>
                            </div>
                        ) : (
                            <span>{msg.content}</span>
                        )}
                    </div>
                    
                    {/* Assistant Metadata (Evidence & Actions) */}
                    {msg.role === 'assistant' && (
                        <div className="w-full flex flex-col space-y-3 pl-1 pr-4">
                            {/* Confidence Badge */}
                            {msg.dataConfidence && (
                                <div className="flex items-center space-x-1.5 self-start px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm">
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span>{msg.dataConfidence}</span>
                                </div>
                            )}

                            {/* Evidence Trace */}
                            {msg.evidence && msg.evidence.length > 0 && (
                                <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 text-[12.5px] space-y-2 max-w-xl shadow-inner">
                                <div className="font-bold text-slate-700 flex items-center space-x-1.5 mb-1.5">
                                    <ShieldAlert className="w-4 h-4 text-slate-500" />
                                    <span>Verified Provenance</span>
                                </div>
                                <ul className="space-y-1.5 text-slate-500 font-medium list-disc list-inside">
                                    {msg.evidence.map((ev, i) => (
                                    <li key={i}>{ev}</li>
                                    ))}
                                </ul>
                                </div>
                            )}

                            {/* Actions */}
                            {msg.actions && msg.actions.length > 0 && (
                                <div className="flex flex-wrap gap-2.5 pt-1">
                                    {msg.actions.map((act, i) => (
                                    <button
                                        key={i}
                                        onClick={() => {
                                            if (act.action === 'RUN_QUERY') {
                                                handleSearch(act.params.query);
                                            } else {
                                                onActionTrigger && onActionTrigger(act);
                                            }
                                        }}
                                        className="bg-white hover:bg-indigo-600 text-indigo-600 hover:text-white border border-indigo-200 hover:border-transparent px-4 py-2 rounded-xl text-[13px] font-bold flex items-center space-x-2 transition-all duration-300 shadow-sm hover:shadow-indigo-500/25 cursor-pointer group"
                                    >
                                        <span>{act.label}</span>
                                        <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
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
                <div className="flex space-x-4 items-center">
                    <div className="w-9 h-9 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-inner border border-indigo-100">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                    </div>
                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-6 py-4 rounded-3xl rounded-tl-sm shadow-sm flex items-center space-x-2.5">
                        <div className="w-2.5 h-2.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2.5 h-2.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2.5 h-2.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        <span className="text-sm font-semibold text-slate-500 ml-3">Analyzing verified records...</span>
                    </div>
                </div>
            </div>
        )}

        {/* Error state */}
        {error && (
            <div className="flex justify-center my-4 w-full animate-in fade-in slide-in-from-top-2">
                <div className="px-5 py-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-sm flex items-center space-x-3 shadow-sm max-w-lg">
                    <AlertTriangle className="w-5 h-5 shrink-0 text-rose-500" />
                    <span className="font-semibold">{error}</span>
                </div>
            </div>
        )}

        </div>
        <div ref={endOfMessagesRef} />
      </div>

      {/* Modern Input Area */}
      <div className="p-4 md:p-6 bg-white dark:bg-[#0B1120] border-t border-slate-100 dark:border-slate-800/50 shrink-0 w-full">
        <div className="relative max-w-4xl mx-auto w-full group">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            placeholder="Ask anything (e.g. Who missed the last contest?)..."
            className="w-full bg-slate-50 dark:bg-[#060B14] border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-[15px] font-medium rounded-xl pl-4 pr-14 py-3 min-h-[64px] max-h-32 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 resize-none transition-all placeholder-slate-400 dark:placeholder-slate-600"
            rows={1}
            style={{
                height: query ? 'auto' : '64px',
                overflowY: query.split('\n').length > 3 ? 'auto' : 'hidden'
            }}
            onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = '64px';
                if (target.value) {
                    target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
                }
            }}
          />
          <button
            onClick={() => handleSearch()}
            disabled={!query.trim() || loading}
            className="absolute right-2.5 bottom-2.5 w-10 h-10 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-600 text-white rounded-[10px] transition-colors flex items-center justify-center shadow-sm"
          >
            <Send className="w-4 h-4 relative right-[-1px]" />
          </button>
        </div>
        <div className="text-center mt-2 max-w-4xl mx-auto">
            <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                Institution Intelligence verifies all records. Shift+Enter for new line.
            </span>
        </div>
      </div>
    </div>
  );
};
