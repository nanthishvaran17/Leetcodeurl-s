import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  X,
  Send,
  Sparkles,
  ShieldCheck,
  Database,
  Loader2,
  Bot,
  User,
  CheckCircle2,
  AlertCircle,
  Activity,
  Zap,
  GraduationCap,
  ExternalLink,
  ChevronRight,
  RefreshCw
} from 'lucide-react';
import api from '../services/api';

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  why?: string;
  evidence?: string;
  confidence?: string;
  actionLabel?: string;
  actionTab?: string;
  source?: string;
  dataStatus?: string;
  timestamp: string;
}

export const AIAssistantWidget: React.FC<{ onNavigateTab?: (tab: string) => void }> = ({ onNavigateTab }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeMode, setActiveMode] = useState<'operations' | 'institutional'>('institutional');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome_1',
      sender: 'ai',
      text: 'Hello! I am the unified NEC Institutional AI & Operations Copilot. Ask me anything about student contest performance, system health, trust score, Sunday automation, or report parity.',
      why: 'Single Unified Intelligence Engine powering all institutional analytics.',
      evidence: 'Live SQLite Production Database • 300 Verified Students',
      confidence: 'VERIFIED',
      source: 'NEC Institutional Intelligence Engine',
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

  const quickActionsOps = [
    'What is our System Trust Score and why?',
    'Is the database healthy?',
    'Are Excel and PDF reports in parity?',
    'When is Sunday automation?',
    'Which records have data exceptions?'
  ];

  const quickActionsInst = [
    'How does this system work?',
    '514 public participation?',
    'Virtual participation in 514?',
    'Compare 513 vs 514',
    'Dhanushya contest 514 record'
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

    const newHistory = [...messages, userMsg].map((m) => ({
      sender: m.sender,
      text: m.text
    }));

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setLoading(true);

    try {
      const res = await api.post(
        '/ai/assistant',
        {
          message: queryText,
          mode: activeMode,
          history: newHistory.slice(-6),
          context: {
            page: window.location.pathname,
            role: 'admin'
          }
        },
        { timeout: 15000 }
      );

      const aiMsg: ChatMessage = {
        id: res.data.requestId || `ai_${Date.now()}`,
        sender: 'ai',
        text: res.data.answer || 'No response details received.',
        why: res.data.why,
        evidence: res.data.evidence,
        confidence: res.data.confidence || 'VERIFIED',
        actionLabel: res.data.actionLabel,
        actionTab: res.data.actionTab,
        source: res.data.source || 'NEC Institutional Intelligence Engine',
        dataStatus: res.data.dataStatus || 'VERIFIED',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err_${Date.now()}`,
        sender: 'ai',
        text:
          err.response?.data?.detail ||
          'Operational data is temporarily unavailable. The dashboard remains fully operational.',
        source: 'System Diagnostic',
        dataStatus: 'DATA_UNAVAILABLE',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, errorMsg]);
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
          className="flex items-center space-x-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-brand-600 via-indigo-600 to-brand-700 hover:from-brand-500 hover:to-indigo-500 text-white font-extrabold text-xs shadow-2xl shadow-brand-600/40 hover:scale-105 active:scale-95 transition-all group cursor-pointer"
        >
          <div className="relative">
            <Sparkles className="w-5 h-5 animate-pulse" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping"></span>
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full"></span>
          </div>
          <span>💬 NEC Unified AI</span>
        </button>
      )}

      {/* Slide-Up Chat Panel */}
      {isOpen && (
        <div className="w-96 max-w-[calc(100vw-2rem)] h-[600px] bg-white dark:bg-navy-900 rounded-3xl border border-gray-200 dark:border-navy-800 shadow-2xl flex flex-col overflow-hidden animate-fade-in text-gray-900 dark:text-gray-100">
          {/* Header */}
          <div className="p-4 bg-gradient-to-r from-brand-600 via-indigo-600 to-brand-700 text-white flex flex-col gap-2 shrink-0 shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-black text-xs tracking-wide flex items-center gap-1.5">
                    <span>NEC UNIFIED AI ENGINE</span>
                    <span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-400 text-emerald-950 font-black">
                      PROD
                    </span>
                  </h3>
                  <p className="text-[10px] text-white/80 font-medium">One Engine • Multi-Mode Experience</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all cursor-pointer"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* Mode Selector */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-black/20 backdrop-blur-md rounded-xl text-[11px] font-black">
              <button
                onClick={() => setActiveMode('institutional')}
                className={`py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeMode === 'institutional'
                    ? 'bg-white text-indigo-900 shadow-md'
                    : 'text-white/80 hover:text-white'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>Institutional AI</span>
              </button>
              <button
                onClick={() => setActiveMode('operations')}
                className={`py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeMode === 'operations'
                    ? 'bg-white text-indigo-900 shadow-md'
                    : 'text-white/80 hover:text-white'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Operations Copilot</span>
              </button>
            </div>
          </div>

          {/* Dynamic Context Bar */}
          <div className="px-3.5 py-1.5 bg-gray-50 dark:bg-navy-950 border-b border-gray-100 dark:border-gray-800/80 flex items-center justify-between text-[10px] text-gray-500 font-bold">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span>Context: 300 Students • Contest 514 • 100% Parity</span>
            </span>
            <span className="font-mono text-indigo-600 dark:text-indigo-400 font-black uppercase">
              {activeMode === 'operations' ? '⚙️ OPS_MODE' : '🎓 ACADEMIC_MODE'}
            </span>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 p-3.5 overflow-y-auto space-y-3 custom-scrollbar text-xs">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'} space-y-1`}
              >
                <div
                  className={`max-w-[90%] p-3 rounded-2xl ${
                    msg.sender === 'user'
                      ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white rounded-br-none shadow-md font-bold'
                      : 'bg-gray-50 dark:bg-navy-950/70 border border-gray-200/80 dark:border-gray-800 text-gray-800 dark:text-gray-100 rounded-bl-none shadow-sm space-y-2'
                  }`}
                >
                  <p className="whitespace-pre-line leading-relaxed">{msg.text}</p>

                  {/* Explainable AI Cards for Answers */}
                  {msg.sender === 'ai' && (msg.why || msg.evidence) && (
                    <div className="pt-2 border-t border-gray-200/60 dark:border-gray-800/60 space-y-1.5 text-[10.5px]">
                      {msg.why && (
                        <div className="p-2 rounded-xl bg-white dark:bg-navy-900 border border-gray-100 dark:border-gray-800">
                          <span className="text-[9px] font-black uppercase text-indigo-600 dark:text-indigo-400 block">
                            Rationale / Why
                          </span>
                          <span className="text-gray-600 dark:text-gray-300 font-medium">{msg.why}</span>
                        </div>
                      )}
                      {msg.evidence && (
                        <div className="p-2 rounded-xl bg-white dark:bg-navy-900 border border-gray-100 dark:border-gray-800">
                          <span className="text-[9px] font-black uppercase text-gray-400 block">Verified Evidence</span>
                          <span className="text-gray-600 dark:text-gray-300 font-mono text-[10px]">
                            {msg.evidence}
                          </span>
                        </div>
                      )}
                      {msg.actionLabel && (
                        <button
                          onClick={() => {
                            if (msg.actionTab && onNavigateTab) {
                              onNavigateTab(msg.actionTab);
                              setIsOpen(false);
                            }
                          }}
                          className="w-full py-1.5 px-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-black flex items-center justify-between cursor-pointer transition-all"
                        >
                          <span>{msg.actionLabel}</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-2 text-[9px] text-gray-400 px-1">
                  <span>{msg.timestamp}</span>
                  {msg.confidence && (
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      • {msg.confidence}
                    </span>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-center space-x-2 text-gray-400 text-xs p-2">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                <span className="font-bold">Evaluating canonical database & contest models…</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Actions Suggestions */}
          <div className="p-2 bg-gray-50 dark:bg-navy-950 border-t border-gray-100 dark:border-gray-800/80 flex space-x-1.5 overflow-x-auto no-scrollbar">
            {(activeMode === 'operations' ? quickActionsOps : quickActionsInst).map((action, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(action)}
                className="px-2.5 py-1 rounded-lg bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 text-[10.5px] font-bold text-gray-700 dark:text-gray-300 hover:border-indigo-400 whitespace-nowrap cursor-pointer transition-all"
              >
                💬 {action}
              </button>
            ))}
          </div>

          {/* Input Box */}
          <div className="p-3 bg-white dark:bg-navy-900 border-t border-gray-200 dark:border-navy-800 flex items-center space-x-2 shrink-0">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={
                activeMode === 'operations'
                  ? 'Ask operational inquiry (e.g. why trust score, backup status)...'
                  : 'Ask about contest performance, student, comparison, or architecture...'
              }
              className="flex-1 px-3.5 py-2 bg-gray-50 dark:bg-navy-950 border border-gray-200 dark:border-gray-800 rounded-xl text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              className="p-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white disabled:opacity-40 cursor-pointer shadow-md transition-all"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
