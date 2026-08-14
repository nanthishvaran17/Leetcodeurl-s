import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Sparkles, ShieldCheck, Database, Loader2, Bot, User, CheckCircle2, AlertCircle } from 'lucide-react';
import api from '../services/api';

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  source?: string;
  dataStatus?: string;
  timestamp: string;
}

export const AIAssistantWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome_1',
      sender: 'ai',
      text: 'Hello! I am the NEC Institutional AI Assistant. Ask me anything about this platform, weekly contest results, performance analytics, or system architecture.',
      source: 'Verified System Context',
      dataStatus: 'VERIFIED',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const quickActions = [
    'How does this system work?',
    'Latest Contest',
    'My Performance',
    'Compare Weeks',
    'Data Quality',
    'Explain an Error'
  ];

  const handleSend = async (textToSend?: string) => {
    const queryText = (textToSend || input).trim();
    if (!queryText || loading) return;

    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      text: queryText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setLoading(true);

    try {
      const res = await api.post('/ai/assistant', {
        message: queryText,
        context: { page: window.location.pathname }
      }, { timeout: 15000 });

      const aiMsg: ChatMessage = {
        id: res.data.requestId || `ai_${Date.now()}`,
        sender: 'ai',
        text: res.data.answer || 'No response details received.',
        source: res.data.source || 'Institutional System Context',
        dataStatus: res.data.dataStatus || 'VERIFIED',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, aiMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err_${Date.now()}`,
        sender: 'ai',
        text: err.response?.data?.detail || 'Unable to connect to AI Knowledge Service. Please verify system status.',
        source: 'System Warning',
        dataStatus: 'DATA_UNAVAILABLE',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans">
      
      {/* Floating Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center space-x-2.5 px-4 py-3 rounded-full bg-brand-600 hover:bg-brand-700 text-white font-extrabold text-xs shadow-2xl shadow-brand-600/40 hover:scale-105 active:scale-95 transition-all group"
        >
          <div className="relative">
            <MessageSquare className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping"></span>
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full"></span>
          </div>
          <span>💬 NEC Institutional AI</span>
        </button>
      )}

      {/* Slide-Up Chat Panel */}
      {isOpen && (
        <div className="w-96 max-w-[calc(100vw-2rem)] h-[540px] glass-card rounded-3xl border border-gray-200 dark:border-navy-800 shadow-2xl flex flex-col overflow-hidden animate-fadeIn">
          
          {/* Header */}
          <div className="p-4 bg-gradient-to-r from-brand-600 to-indigo-600 text-white flex items-center justify-between shrink-0 shadow-md">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center font-black">
                <Sparkles className="w-5 h-5 text-amber-300" />
              </div>
              <div>
                <h3 className="text-sm font-black tracking-tight leading-tight">
                  NEC Institutional AI
                </h3>
                <p className="text-[10px] text-brand-100 font-bold flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span>
                  <span>Ask anything about this platform</span>
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-xl hover:bg-white/20 text-white/80 hover:text-white transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Actions Bar */}
          <div className="p-2.5 bg-gray-50 dark:bg-navy-950 border-b border-gray-200 dark:border-navy-800 flex items-center space-x-1.5 overflow-x-auto scrollbar-none shrink-0">
            {quickActions.map((act, i) => (
              <button
                key={i}
                onClick={() => handleSend(act)}
                disabled={loading}
                className="px-2.5 py-1 rounded-lg bg-white dark:bg-navy-900 hover:bg-brand-50 dark:hover:bg-navy-800 text-gray-700 dark:text-gray-300 hover:text-brand-600 text-[10px] font-extrabold border border-gray-200 dark:border-navy-800 shrink-0 transition-all shadow-xs"
              >
                {act}
              </button>
            ))}
          </div>

          {/* Message History Thread */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-gray-50/50 dark:bg-navy-950/50">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[85%] rounded-2xl p-3.5 space-y-1.5 shadow-sm ${
                  m.sender === 'user'
                    ? 'bg-brand-600 text-white rounded-br-none'
                    : 'bg-white dark:bg-navy-900 border border-gray-200 dark:border-navy-800 text-gray-800 dark:text-gray-100 rounded-bl-none'
                }`}>
                  <div className="flex items-center justify-between text-[9px] opacity-70 font-bold mb-1 space-x-2">
                    <span className="flex items-center space-x-1">
                      {m.sender === 'user' ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                      <span>{m.sender === 'user' ? 'You' : 'NEC Copilot'}</span>
                    </span>
                    <span>{m.timestamp}</span>
                  </div>

                  <p className="text-xs leading-relaxed font-sans whitespace-pre-wrap">
                    {m.text}
                  </p>

                  {m.sender === 'ai' && (m.source || m.dataStatus) && (
                    <div className="pt-2 mt-2 border-t border-gray-100 dark:border-navy-800 flex items-center justify-between text-[9px]">
                      <span className="font-extrabold text-gray-400 dark:text-gray-500 truncate max-w-[170px]" title={m.source}>
                        📍 {m.source}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded-full font-black text-[9px] uppercase tracking-wider flex items-center space-x-1 ${
                        m.dataStatus === 'VERIFIED'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      }`}>
                        {m.dataStatus === 'VERIFIED' ? (
                          <>
                            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
                            <span>VERIFIED</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-2.5 h-2.5 text-amber-500" />
                            <span>UNAVAILABLE</span>
                          </>
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-white dark:bg-navy-900 border border-gray-200 dark:border-navy-800 rounded-2xl p-3 shadow-sm flex items-center space-x-2">
                  <Loader2 className="w-4 h-4 animate-spin text-brand-600" />
                  <span className="text-xs font-bold text-gray-500 dark:text-gray-400">Consulting institutional context...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <form
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            className="p-3 bg-white dark:bg-navy-900 border-t border-gray-200 dark:border-navy-800 flex items-center space-x-2 shrink-0"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything about this platform..."
              disabled={loading}
              className="flex-1 px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-navy-700 bg-gray-50 dark:bg-navy-950 text-xs font-medium focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="p-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-40 transition-all shadow-sm shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

        </div>
      )}

    </div>
  );
};
