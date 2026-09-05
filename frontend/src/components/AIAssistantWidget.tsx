import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Send,
  Sparkles,
  Database,
  Loader2,
  User,
  CheckCircle2,
  AlertCircle,
  Activity,
  GraduationCap,
  ChevronRight,
  RefreshCw,
  AlertTriangle,
  Mail,
  Maximize2,
  Minimize2,
  Check,
  Sliders,
  Users,
  Trophy,
  AlertOctagon,
  FileText,
  ArrowRight,
  Cpu,
  Trash2,
  ShieldAlert,
  BarChart2,
  BookOpen,
  Code2,
  ChevronDown,
} from 'lucide-react';
import api from '../services/api';

// --- Interfaces ---

interface TaskPlan {
  intent: string;
  subtasks: string[];
  status: string;
}

interface PendingAction {
  action_id: string;
  action_type: string;
  title: string;
  description: string;
  affected_records: number;
  target_details?: string[];
  email_subject?: string;
  email_preview?: string;
  prompt?: string;
}

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
  checked?: string[];
  task_plan?: TaskPlan;
  pending_action?: PendingAction;
  action_executed?: boolean;
  action_result?: any;
  timestamp: string;
  isError?: boolean;
}

// --- Rich Text Renderer ---

const RichMessageText: React.FC<{ text: string; isUser?: boolean }> = ({ text, isUser }) => {
  if (!text) return null;

  if (isUser) {
    return (
      <p className="text-[12.5px] leading-relaxed font-medium break-words whitespace-pre-wrap">
        {text}
      </p>
    );
  }

  const cleaned = text
    .replace(/I analyzed your inquiry regarding[^\n]*/gi, '')
    .replace(/Current Active Context:[^\n]*/gi, '')
    .replace(/Database State:[^\n]*/gi, '')
    .replace(/Report Parity:[^\n]*/gi, '')
    .replace(/Rationale \/ Why[^\n]*/gi, '')
    .replace(/Verified Evidence[^\n]*/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const blocks = cleaned.split(/\n\n+/);

  const renderInline = (line: string, key: number) => {
    const parts = line.split(/(\*\*[^*]+\*\*|__[^_]+__)/g);
    return (
      <React.Fragment key={key}>
        {parts.map((part, i) => {
          if (/^\*\*[^*]+\*\*$/.test(part) || /^__[^_]+__$/.test(part)) {
            const inner = part.replace(/^\*\*|^\s*__/, '').replace(/\*\*$|__$/, '');
            return <strong key={i} className="font-semibold text-slate-900 dark:text-white">{inner}</strong>;
          }
          const codeParts = part.split(/(`[^`]+`)/g);
          return (
            <React.Fragment key={i}>
              {codeParts.map((cp, ci) => {
                if (/^`[^`]+`$/.test(cp)) {
                  return (
                    <code key={ci} className="px-1 py-0.5 rounded bg-slate-200 dark:bg-navy-800 text-[10.5px] font-mono text-brand-700 dark:text-brand-300">
                      {cp.slice(1, -1)}
                    </code>
                  );
                }
                return <span key={ci}>{cp}</span>;
              })}
            </React.Fragment>
          );
        })}
      </React.Fragment>
    );
  };

  const renderedBlocks = blocks.map((block, bIdx) => {
    const trimmed = block.trim();
    if (!trimmed) return null;

    if (trimmed.startsWith('```')) {
      const codeContent = trimmed.replace(/^```[\w]*\n?/, '').replace(/```$/, '').trim();
      return (
        <div key={bIdx} className="my-2 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
          <div className="px-3 py-1.5 bg-slate-100 dark:bg-navy-800 border-b border-slate-200 dark:border-slate-700 flex items-center gap-1.5">
            <Code2 className="w-3 h-3 text-slate-400" />
            <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">Code</span>
          </div>
          <pre className="px-3 py-2.5 bg-slate-50 dark:bg-navy-900 text-[11px] font-mono text-slate-700 dark:text-slate-200 overflow-x-auto leading-relaxed">
            {codeContent}
          </pre>
        </div>
      );
    }

    const lines = trimmed.split('\n');
    const isBulletList = lines.length > 1 && lines.every(l => /^[-\u2022*]\s+/.test(l.trim()) || l.trim() === '');
    const isNumberedList = lines.length > 1 && lines.every(l => /^\d+[.)]\s+/.test(l.trim()) || l.trim() === '');

    if (isBulletList) {
      return (
        <ul key={bIdx} className="space-y-1 my-1 pl-0">
          {lines.filter(l => l.trim()).map((l, li) => (
            <li key={li} className="flex items-start gap-2 text-[12px] leading-relaxed text-slate-700 dark:text-slate-200">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-brand-500 dark:bg-brand-400 shrink-0" />
              <span>{renderInline(l.replace(/^[-\u2022*]\s+/, '').trim(), li)}</span>
            </li>
          ))}
        </ul>
      );
    }

    if (isNumberedList) {
      return (
        <ol key={bIdx} className="space-y-1 my-1 pl-0">
          {lines.filter(l => l.trim()).map((l, li) => {
            const match = l.match(/^(\d+)[.)]\s+(.*)/);
            const num = match ? match[1] : String(li + 1);
            const content = match ? match[2] : l;
            return (
              <li key={li} className="flex items-start gap-2 text-[12px] leading-relaxed text-slate-700 dark:text-slate-200">
                <span className="shrink-0 w-5 h-5 rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 text-[10px] font-bold flex items-center justify-center mt-0.5">
                  {num}
                </span>
                <span>{renderInline(content.trim(), li)}</span>
              </li>
            );
          })}
        </ol>
      );
    }

    return (
      <p key={bIdx} className="text-[12px] leading-relaxed text-slate-700 dark:text-slate-200 whitespace-pre-wrap break-words">
        {lines.map((l, li) => (
          <React.Fragment key={li}>
            {renderInline(l, li)}
            {li < lines.length - 1 && '\n'}
          </React.Fragment>
        ))}
      </p>
    );
  });

  return <div className="space-y-2">{renderedBlocks}</div>;
};

// --- Typing Indicator ---

const TypingIndicator: React.FC = () => (
  <motion.div
    initial={{ opacity: 0, y: 6 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 6 }}
    className="flex items-start gap-2.5"
  >
    <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center shrink-0 shadow-sm mt-0.5">
      <Sparkles className="w-3 h-3 text-white" />
    </div>
    <div className="px-3.5 py-2.5 rounded-2xl rounded-bl-sm bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 shadow-sm flex items-center gap-2.5">
      <div className="flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-brand-400 dark:bg-brand-500"
            animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
            transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18, ease: 'easeInOut' }}
          />
        ))}
      </div>
      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
        Analyzing data…
      </span>
    </div>
  </motion.div>
);

// --- Empty State Suggestions ---

const EmptyStateSuggestions: React.FC<{
  onSend: (q: string) => void;
  mode: 'operations' | 'institutional';
}> = ({ onSend, mode }) => {
  const suggestions = mode === 'operations'
    ? [
        { icon: Activity, label: 'Database Audit', desc: 'Run deep bug & duplicate scan', query: 'Check the entire database for bugs, duplicate usernames, and unverified profiles', color: 'text-rose-500' },
        { icon: Mail, label: 'Draft Warning Email', desc: 'Compose alert for low solvers', query: 'mail panu low solvers-ukku', color: 'text-purple-500' },
        { icon: Trophy, label: 'Top 10 Solvers', desc: 'College-wide leaderboard', query: 'Who are the top 10 college solvers overall?', color: 'text-amber-500' },
        { icon: AlertOctagon, label: 'Absentee Scan', desc: 'Find contest absentees', query: 'Find absent students in the latest Weekly Contest', color: 'text-orange-500' },
      ]
    : [
        { icon: BarChart2, label: 'Contest Matrix', desc: 'Compare two contest sessions', query: 'Compare Contest 514 and Contest 515 performance', color: 'text-brand-500' },
        { icon: Users, label: 'Student Lookup', desc: 'Search any student profile', query: 'Lookup Bharath K profile details', color: 'text-indigo-500' },
        { icon: BookOpen, label: 'HOD Report', desc: 'Weekly summary for HOD', query: 'Generate HOD weekly summary report', color: 'text-emerald-500' },
        { icon: GraduationCap, label: 'Performance Analysis', desc: 'Low solver identification', query: 'Find low solvers with less than 50 problems', color: 'text-cyan-500' },
      ];

  return (
    <div className="flex flex-col items-center justify-center h-full py-6 px-4 space-y-5">
      <div className="space-y-1 text-center">
        <div className="w-10 h-10 mx-auto rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center shadow-md">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 pt-1">
          Ask anything about NEC student data
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
        {suggestions.map((s, i) => {
          const Icon = s.icon;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSend(s.query)}
              className="p-3 rounded-xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 text-left hover:border-brand-400 dark:hover:border-brand-600 hover:shadow-sm transition-all duration-150 cursor-pointer"
            >
              <Icon className={`w-3.5 h-3.5 ${s.color} mb-1.5`} />
              <div className="text-[11px] font-bold text-slate-800 dark:text-white leading-tight">{s.label}</div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight mt-0.5">{s.desc}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// --- Main Widget ---

export const AIAssistantWidget: React.FC<{ onNavigateTab?: (tab: string) => void }> = ({ onNavigateTab }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showLaunchers, setShowLaunchers] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [activeMode, setActiveMode] = useState<'operations' | 'institutional'>('operations');
  const [scrolledUp, setScrolledUp] = useState(false);

  const [telemetry, setTelemetry] = useState<any>({
    total_students: 302,
    verified_students: 237,
    pending_students: 21,
    failed_students: 44,
    database: 'SQLite WAL Production Mode',
    last_successful_fetch: '19 Aug 2026, 11:58 AM IST',
    llm_engine: 'OLLAMA (llama3.2)',
  });
  const [loadingTelemetry, setLoadingTelemetry] = useState(false);

  const makeWelcomeMsg = (): ChatMessage => ({
    id: 'welcome_1',
    sender: 'ai',
    text: 'Hello! I am the official Nandha Engineering College AI & Operations Copilot.\n\nI can analyze student LeetCode performance, execute database integrity audits, draft email alerts, and compare contest rankings in real time.',
    source: 'NEC Institutional AI Engine',
    dataStatus: 'VERIFIED',
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  });

  const [messages, setMessages] = useState<ChatMessage[]>([makeWelcomeMsg()]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmingActionId, setConfirmingActionId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isEmptyConversation = messages.length === 1 && messages[0].id.startsWith('welcome_');

  const fetchTelemetry = useCallback(async () => {
    setLoadingTelemetry(true);
    try {
      const res = await api.get('/ai/control/telemetry');
      setTelemetry(res.data);
    } catch (err) {
      console.warn('Telemetry fetch note:', err);
    } finally {
      setLoadingTelemetry(false);
    }
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  const handleScroll = () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    setScrolledUp(el.scrollHeight - el.scrollTop - el.clientHeight > 60);
  };

  const fetchChatHistory = useCallback(async () => {
    try {
      const res = await api.get('/ai/history');
      if (res.data && res.data.length > 0) {
        const loadedMsgs: ChatMessage[] = [
          { ...makeWelcomeMsg(), source: 'NEC Institutional Intelligence Engine' },
        ];
        res.data.forEach((item: any) => {
          loadedMsgs.push({
            id: `usr_${item.id}`,
            sender: 'user',
            text: item.user_query,
            timestamp: item.created_at || 'Past',
          });
          loadedMsgs.push({
            id: `ai_${item.id}`,
            sender: 'ai',
            text: item.ai_response,
            source: 'NEC SQLite Database Chat Log',
            dataStatus: 'VERIFIED',
            timestamp: item.created_at || 'Past',
          });
        });
        setMessages(loadedMsgs);
      }
    } catch (err) {
      console.warn('History fetch note:', err);
    }
  }, []);

  useEffect(() => { fetchChatHistory(); }, []);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom('instant');
      fetchTelemetry();
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && !scrolledUp) scrollToBottom();
  }, [messages, loading]);

  useEffect(() => {
    const handleCustomOpen = (e: Event) => {
      const customEvent = e as CustomEvent;
      setIsOpen(true);
      if (customEvent.detail?.mode) setActiveMode(customEvent.detail.mode);
      if (customEvent.detail?.query) {
        setTimeout(() => {
          handleSend(customEvent.detail.query, customEvent.detail?.mode || 'operations');
        }, 150);
      }
    };
    window.addEventListener('open-ai-chat', handleCustomOpen);
    return () => window.removeEventListener('open-ai-chat', handleCustomOpen);
  }, [messages]);

  const quickActionsOps = [
    { label: '🔍 DB Audit', query: 'Check the entire database for bugs, duplicate usernames, and unverified profiles' },
    { label: '✉️ Warning Email', query: 'mail panu low solvers-ukku' },
    { label: '📊 514 vs 515', query: 'Compare Contest 514 and Contest 515 performance' },
    { label: '⚠️ Absentees', query: 'Find absent students in the latest Weekly Contest' },
    { label: '🏆 Top 10', query: 'Who are the top 10 college solvers overall?' },
    { label: '📑 HOD Report', query: 'Generate HOD weekly summary report' },
  ];

  const launcherCategories = [
    {
      title: 'Student Operations', icon: Users, color: 'text-brand-500',
      actions: [
        { label: 'Lookup Student Profile', query: 'Lookup Bharath K profile details' },
        { label: 'Filter CSE(CS) III Year', query: 'Show Cyber Security III Year students' },
        { label: 'Compare Top Solvers', query: 'Compare Nanthish S and Bharath K' },
      ],
    },
    {
      title: 'Contest Intelligence', icon: Trophy, color: 'text-amber-500',
      actions: [
        { label: 'Top 10 Latest Contest', query: 'Who are the top 10 students in latest contest?' },
        { label: 'Scan Absentee Roster', query: 'Find absent students in the latest Weekly Contest' },
        { label: 'Compare Contests 514 vs 515', query: 'Compare Contest 514 and Contest 515 performance' },
      ],
    },
    {
      title: 'Performance Analytics', icon: Activity, color: 'text-emerald-500',
      actions: [
        { label: 'Overall College Top Solvers', query: 'Who are the top 10 college solvers overall?' },
        { label: 'Low Solvers (< 50 solved)', query: 'Find low solvers with less than 50 problems' },
        { label: 'Check Last Fetch Time', query: 'last fetch kaatu' },
      ],
    },
    {
      title: 'Database Audit & Bugs', icon: AlertOctagon, color: 'text-rose-500',
      actions: [
        { label: 'Run Deep Database Audit', query: 'Check the entire database for bugs and duplicate URLs' },
        { label: 'Find Duplicate Usernames', query: 'Find duplicate usernames or missing profiles' },
      ],
    },
    {
      title: 'Email Actions & Safety', icon: Mail, color: 'text-purple-500',
      actions: [
        { label: 'Draft Warning Email', query: 'mail panu low solvers-ukku' },
        { label: 'Prepare Absentee Notification', query: 'prepare an email for absent students' },
      ],
    },
    {
      title: 'Report Exporters', icon: FileText, color: 'text-cyan-500',
      actions: [
        { label: 'Generate HOD Summary Report', query: 'Generate HOD weekly summary report' },
        { label: 'Verify Report Parity', query: 'Are PDF and Excel reports in 100% parity?' },
      ],
    },
  ];

  const handleSend = async (textToSend?: string, modeOverride?: 'operations' | 'institutional') => {
    const queryText = (textToSend || input).trim();
    if (!queryText || loading) return;

    const currentMode = modeOverride || activeMode;
    setShowLaunchers(false);

    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      text: queryText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newHistory = [...messages, userMsg].map((m) => ({ sender: m.sender, text: m.text }));
    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setLoading(true);

    try {
      const isOpsQuery =
        currentMode === 'operations' ||
        /audit|mail|email|draft|compare|bug|absent|fetch|health|telemetry/i.test(queryText);

      const endpoint = isOpsQuery ? '/ai/control/request' : '/ai/assistant';
      const payload = isOpsQuery
        ? { message: queryText, history: newHistory.slice(-4), context: { page: window.location.pathname, role: 'admin' } }
        : { message: queryText, mode: currentMode, history: newHistory.slice(-6), context: { page: window.location.pathname, role: 'admin' } };

      const res = await api.post(endpoint, payload, { timeout: 20000 });

      const aiMsg: ChatMessage = {
        id: res.data.requestId || `ai_${Date.now()}`,
        sender: 'ai',
        text: res.data.answer || 'Processing completed.',
        why: res.data.why,
        evidence: res.data.evidence,
        confidence: res.data.confidence || 'VERIFIED',
        actionLabel: res.data.actionLabel,
        actionTab: res.data.actionTab,
        checked: res.data.checked,
        task_plan: res.data.task_plan,
        pending_action: res.data.pending_action,
        source: res.data.source || (isOpsQuery ? 'Verified Institutional Database' : 'NEC Institutional Intelligence Engine'),
        dataStatus: res.data.dataStatus || res.data.data_status || 'VERIFIED',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err_${Date.now()}`,
        sender: 'ai',
        text: err.response?.data?.detail || 'The AI assistant is temporarily unavailable. Please try again in a moment.',
        source: 'System Diagnostic',
        dataStatus: 'DATA_UNAVAILABLE',
        isError: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAction = async (msgId: string, actionId: string) => {
    setConfirmingActionId(actionId);
    try {
      const res = await api.post('/ai/control/confirm', { action_id: actionId });
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === msgId ? { ...msg, action_executed: true, action_result: res.data } : msg
        )
      );
      fetchTelemetry();
    } finally {
      setConfirmingActionId(null);
    }
  };

  const handleClearChat = async () => {
    try { await api.post('/ai/clear-history').catch(() => null); } catch (_err) {}
    setMessages([{ ...makeWelcomeMsg(), id: `welcome_${Date.now()}`, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
  };

  return (
    <div className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))] right-4 sm:right-6 z-[99999] font-sans pointer-events-auto">

      {/* FAB Toggle */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            drag dragMomentum={false}
            onDragStart={() => setIsDragging(true)}
            onDragEnd={() => { setTimeout(() => setIsDragging(false), 150); }}
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.93 }}
            onClick={() => { if (!isDragging) setIsOpen(true); }}
            aria-label="Open AI Assistant"
            className="w-13 h-13 sm:w-14 sm:h-14 flex items-center justify-center rounded-2xl bg-gradient-to-tr from-brand-600 via-indigo-600 to-brand-700 text-white shadow-xl hover:shadow-2xl cursor-grab active:cursor-grabbing border border-white/20 transition-shadow duration-200 group"
            title="Open NEC AI Copilot"
          >
            <div className="relative flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-amber-300 transition-transform group-hover:rotate-12 duration-200" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-slate-900 shadow-sm animate-pulse" />
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 24 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            role="dialog" aria-label="NEC AI Assistant"
            className={`bg-white dark:bg-navy-950 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-navy-800 shadow-2xl flex flex-col overflow-hidden text-slate-900 dark:text-slate-100 transition-all duration-300 ${
              isExpanded
                ? 'w-[840px] max-w-[calc(100vw-1.5rem)] h-[800px] max-h-[calc(100vh-3.5rem)]'
                : 'w-[min(430px,calc(100vw-1.5rem))] h-[min(640px,calc(100dvh-4.5rem))]'
            }`}
          >

            {/* HEADER */}
            <div className="px-4 py-3 bg-gradient-to-r from-brand-600 via-indigo-600 to-brand-700 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0 shadow-inner">
                  <Sparkles className="w-4 h-4 text-amber-300" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm tracking-wide truncate leading-tight">NEC AI Copilot</h3>
                    <span className="px-1.5 py-px rounded text-[9px] font-black bg-emerald-400 text-emerald-950 uppercase tracking-widest shrink-0">LIVE</span>
                  </div>
                  <p className="text-[11px] text-white/70 font-medium truncate leading-tight">
                    Institutional Intelligence & Operations
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button type="button" onClick={() => setShowLaunchers(!showLaunchers)} aria-label="Toggle quick tools"
                  className={`p-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${showLaunchers ? 'bg-white text-indigo-700 shadow-sm' : 'bg-white/15 hover:bg-white/25 text-white'}`}>
                  <Sliders className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline text-[10px]">Tools</span>
                </button>
                <button type="button" onClick={handleClearChat} aria-label="Clear chat"
                  className="p-1.5 rounded-lg bg-white/15 hover:bg-rose-400/80 text-white transition-all cursor-pointer" title="Clear Chat">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={() => setIsExpanded(!isExpanded)} aria-label={isExpanded ? 'Collapse' : 'Expand'}
                  className="hidden sm:flex p-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white transition-all cursor-pointer">
                  {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </button>
                <button type="button" onClick={() => setIsOpen(false)} aria-label="Close assistant"
                  className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white transition-all cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* TELEMETRY STRIP */}
            <div className="px-4 py-1.5 bg-slate-900 dark:bg-[#070d1a] text-white border-b border-slate-800 flex items-center justify-between shrink-0 overflow-x-auto no-scrollbar">
              <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400 whitespace-nowrap">
                <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  SQLITE WAL
                </span>
                <span className="text-slate-700">·</span>
                <span>Total: <b className="text-white">{telemetry?.total_students ?? 302}</b></span>
                <span className="text-slate-700">·</span>
                <span>Verified: <b className="text-emerald-400">{telemetry?.verified_students ?? 237}</b></span>
                <span className="text-slate-700">·</span>
                <span>Pending: <b className="text-amber-400">{telemetry?.pending_students ?? 21}</b></span>
              </div>
              <button type="button" onClick={fetchTelemetry} aria-label="Refresh telemetry"
                className="text-slate-500 hover:text-white cursor-pointer ml-2 transition-colors shrink-0">
                <RefreshCw className={`w-3 h-3 ${loadingTelemetry ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* MODE TOGGLE */}
            <div className="px-3 py-2 bg-slate-50 dark:bg-navy-900/60 border-b border-slate-200 dark:border-navy-800 flex items-center gap-1.5 shrink-0">
              {([
                { id: 'operations', label: 'Operations', Icon: Cpu },
                { id: 'institutional', label: 'Intelligence', Icon: Database },
              ] as const).map(({ id, label, Icon }) => (
                <button key={id} type="button" onClick={() => setActiveMode(id)}
                  className={`flex-1 py-1.5 px-2.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    activeMode === id
                      ? 'bg-white dark:bg-navy-950 text-brand-600 dark:text-brand-400 shadow-sm border border-slate-200 dark:border-navy-700'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}>
                  <Icon className="w-3 h-3" />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {/* LAUNCHERS PANEL */}
            {showLaunchers ? (
              <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-navy-950 p-4 space-y-4 custom-scrollbar">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2 font-bold text-[12px] text-slate-800 dark:text-white">
                    <Sliders className="w-3.5 h-3.5 text-brand-500" />
                    Quick Audit & Intelligence Launchers
                  </div>
                  <button type="button" onClick={() => setShowLaunchers(false)}
                    className="px-2.5 py-1 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold text-[10.5px] transition-all cursor-pointer">
                    ← Back
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {launcherCategories.map((cat, idx) => {
                    const Icon = cat.icon;
                    return (
                      <div key={idx} className="p-3 rounded-xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 shadow-sm space-y-2">
                        <div className="flex items-center gap-2 font-bold text-[11.5px] text-slate-800 dark:text-white">
                          <Icon className={`w-3.5 h-3.5 ${cat.color}`} />
                          {cat.title}
                        </div>
                        <div className="space-y-1">
                          {cat.actions.map((act, aIdx) => (
                            <button key={aIdx} type="button"
                              onClick={() => { setShowLaunchers(false); handleSend(act.query, 'operations'); }}
                              className="w-full p-2 rounded-lg bg-slate-50 dark:bg-navy-950 hover:bg-brand-50 dark:hover:bg-brand-950/40 border border-slate-200 dark:border-slate-800 text-left text-[11px] font-medium text-slate-700 dark:text-slate-300 flex items-center justify-between transition-all cursor-pointer group">
                              <span>{act.label}</span>
                              <ArrowRight className="w-3 h-3 text-slate-300 group-hover:text-brand-500 transition-colors shrink-0" />
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-700 space-y-1">
                  <div className="flex items-center gap-1.5 text-amber-400 font-bold text-[11px]">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Action Safety Guard Active
                  </div>
                  <p className="text-slate-400 text-[10.5px] leading-relaxed">
                    Read-only queries execute instantly. Data modifications and email notifications require explicit two-step confirmation.
                  </p>
                </div>
              </div>

            ) : (
              /* MESSAGES AREA */
              <>
                <div
                  ref={messagesContainerRef}
                  onScroll={handleScroll}
                  className="flex-1 overflow-y-auto custom-scrollbar bg-white dark:bg-navy-950"
                >
                  {isEmptyConversation ? (
                    <div className="h-full flex flex-col">
                      <div className="px-4 pt-4 pb-2">
                        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-2.5">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                            <Sparkles className="w-3 h-3 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] font-bold text-brand-600 dark:text-brand-400">NEC AI COPILOT</span>
                              <span className="text-[9px] font-mono text-slate-400">{messages[0].timestamp}</span>
                            </div>
                            <div className="px-3.5 py-3 rounded-2xl rounded-tl-sm bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 shadow-sm">
                              <RichMessageText text={messages[0].text} />
                            </div>
                          </div>
                        </motion.div>
                      </div>
                      <div className="flex-1">
                        <EmptyStateSuggestions onSend={(q) => handleSend(q)} mode={activeMode} />
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 space-y-4">
                      <AnimatePresence initial={false}>
                        {messages.map((msg) => (
                          <motion.div key={msg.id}
                            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.18, ease: 'easeOut' }}
                            className={`flex items-end gap-2.5 ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                          >
                            {/* Avatar */}
                            {msg.sender === 'ai' && (
                              <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center shrink-0 mb-5 shadow-sm">
                                <Sparkles className="w-3 h-3 text-white" />
                              </div>
                            )}
                            {msg.sender === 'user' && (
                              <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-navy-700 flex items-center justify-center shrink-0 mb-5">
                                <User className="w-3.5 h-3.5 text-slate-500 dark:text-slate-300" />
                              </div>
                            )}

                            <div className={`flex flex-col gap-1 max-w-[85%] ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                              {/* Meta row */}
                              <div className={`flex items-center gap-1.5 px-1 text-[10px] font-mono text-slate-400 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}>
                                {msg.sender === 'ai' && <span className="font-bold text-brand-600 dark:text-brand-400 text-[10px]">NEC AI</span>}
                                <span>{msg.timestamp}</span>
                                {msg.source && msg.sender === 'ai' && (
                                  <><span className="text-slate-300 dark:text-slate-700">·</span><span className="truncate max-w-[100px]">{msg.source}</span></>
                                )}
                                {msg.dataStatus && msg.sender === 'ai' && (
                                  <span className={`px-1.5 py-px rounded text-[9px] font-mono font-bold border ${
                                    msg.dataStatus === 'VERIFIED'
                                      ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                                      : msg.dataStatus === 'DATA_UNAVAILABLE' || msg.isError
                                      ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800'
                                      : 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                                  }`}>{msg.dataStatus}</span>
                                )}
                              </div>

                              {/* Bubble */}
                              <div className={`px-3.5 py-3 rounded-2xl shadow-sm ${
                                msg.sender === 'user'
                                  ? 'bg-gradient-to-br from-brand-600 to-indigo-600 text-white rounded-br-sm'
                                  : msg.isError
                                  ? 'bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-bl-sm'
                                  : 'bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-bl-sm'
                              }`}>
                                {msg.isError && (
                                  <div className="flex items-center gap-1.5 mb-2 text-rose-600 dark:text-rose-400 text-[11px] font-semibold">
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                    <span>Assistant Unavailable</span>
                                  </div>
                                )}
                                {msg.sender === 'user'
                                  ? <RichMessageText text={msg.text} isUser />
                                  : <RichMessageText text={msg.text} />
                                }

                                {/* Task Plan */}
                                {msg.task_plan && (
                                  <div className="mt-3 p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 space-y-1.5">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                                        <Activity className="w-3 h-3 text-indigo-500" />{msg.task_plan.intent}
                                      </span>
                                      <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-indigo-200 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200">{msg.task_plan.status}</span>
                                    </div>
                                    <ul className="space-y-0.5">
                                      {msg.task_plan.subtasks.map((st, idx) => (
                                        <li key={idx} className="flex items-start gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                                          <span className="mt-1.5 w-1 h-1 rounded-full bg-indigo-400 shrink-0" />{st}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {/* Action executed */}
                                {msg.action_executed && (
                                  <div className="mt-3 p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 space-y-1">
                                    <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-bold text-[11px]">
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />Action Executed Successfully
                                    </div>
                                    <div className="text-[11px] text-slate-600 dark:text-slate-300 space-y-0.5">
                                      <div><b className="text-slate-900 dark:text-white">Action:</b> {msg.action_result?.action || 'Email Notification'}</div>
                                      <div><b className="text-slate-900 dark:text-white">Details:</b> {msg.action_result?.result || 'Dispatched via institutional SMTP'}</div>
                                    </div>
                                  </div>
                                )}

                                {/* Pending action */}
                                {msg.pending_action && !msg.action_executed && (
                                  <div className="mt-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 space-y-2">
                                    <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-bold text-[11px]">
                                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />Safety Confirmation Required
                                    </div>
                                    <p className="text-[11.5px] text-slate-800 dark:text-slate-200 font-medium">{msg.pending_action.description}</p>
                                    {msg.pending_action.email_subject && (
                                      <div className="p-2 rounded-md bg-white dark:bg-navy-950 border border-amber-200 dark:border-amber-800/60 space-y-0.5">
                                        <div className="font-bold text-slate-900 dark:text-white text-[11px] flex items-center gap-1">
                                          <Mail className="w-3 h-3 text-amber-500" />Subject: {msg.pending_action.email_subject}
                                        </div>
                                        <p className="text-slate-500 dark:text-slate-400 italic text-[10px]">"{msg.pending_action.email_preview}"</p>
                                      </div>
                                    )}
                                    <button type="button"
                                      onClick={() => handleConfirmAction(msg.id, msg.pending_action!.action_id)}
                                      disabled={confirmingActionId === msg.pending_action.action_id}
                                      className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer transition-all disabled:opacity-50 shadow-sm">
                                      {confirmingActionId === msg.pending_action.action_id
                                        ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /><span>Dispatching…</span></>
                                        : <><Check className="w-3.5 h-3.5" /><span>Confirm & Dispatch Action</span></>
                                      }
                                    </button>
                                  </div>
                                )}

                                {/* Navigation link */}
                                {msg.actionLabel && (
                                  <button type="button"
                                    onClick={() => { if (msg.actionTab && onNavigateTab) { onNavigateTab(msg.actionTab); setIsOpen(false); } }}
                                    className="mt-2.5 w-full py-1.5 px-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-semibold text-[11px] flex items-center justify-between cursor-pointer transition-all border border-indigo-200/60 dark:border-indigo-800/60">
                                    <span>{msg.actionLabel}</span>
                                    <ChevronRight className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>

                      <AnimatePresence>
                        {loading && <TypingIndicator />}
                      </AnimatePresence>
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </div>

                {/* Scroll to bottom */}
                <AnimatePresence>
                  {scrolledUp && !isEmptyConversation && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                      onClick={() => scrollToBottom()}
                      className="absolute bottom-28 right-4 w-7 h-7 rounded-full bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 shadow-md flex items-center justify-center cursor-pointer hover:bg-slate-50 dark:hover:bg-navy-700 transition-all z-10"
                      aria-label="Scroll to latest">
                      <ChevronDown className="w-4 h-4 text-slate-500 dark:text-slate-300" />
                    </motion.button>
                  )}
                </AnimatePresence>
              </>
            )}

            {/* QUICK ACTION CHIPS */}
            {!showLaunchers && (
              <div className="px-3 py-2 bg-slate-50 dark:bg-navy-900/80 border-t border-slate-200 dark:border-navy-800 flex gap-1.5 overflow-x-auto no-scrollbar shrink-0">
                {quickActionsOps.map((action, idx) => (
                  <button key={idx} type="button" onClick={() => handleSend(action.query)}
                    className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 text-[10.5px] font-medium text-slate-600 dark:text-slate-300 hover:border-brand-400 dark:hover:border-brand-600 hover:text-brand-600 dark:hover:text-brand-300 whitespace-nowrap cursor-pointer transition-all shadow-sm shrink-0">
                    {action.label}
                  </button>
                ))}
              </div>
            )}

            {/* INPUT AREA */}
            <div className="px-3 py-3 bg-white dark:bg-navy-950 border-t border-slate-200 dark:border-navy-800 shrink-0">
              <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all duration-150 bg-slate-50 dark:bg-navy-900 ${
                loading
                  ? 'border-slate-200 dark:border-navy-700 opacity-70'
                  : 'border-slate-200 dark:border-navy-700 focus-within:border-brand-400 dark:focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-500/10'
              }`}>
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  disabled={loading}
                  placeholder={activeMode === 'operations' ? 'Ask copilot — audit, email, contest compare…' : 'Ask about contest rankings, student stats…'}
                  aria-label="Message input"
                  className="flex-1 bg-transparent text-[12.5px] font-medium text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none min-w-0"
                />
                <button type="button" onClick={() => handleSend()}
                  disabled={loading || !input.trim()} aria-label="Send message"
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all duration-150 ${
                    !input.trim() || loading
                      ? 'bg-slate-100 dark:bg-navy-800 text-slate-300 dark:text-slate-600 cursor-not-allowed'
                      : 'bg-gradient-to-br from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white shadow-sm cursor-pointer active:scale-95'
                  }`}>
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
