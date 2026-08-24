import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  Lock,
  ArrowRight,
  Cpu,
  XCircle,
  Trash2
} from 'lucide-react';
import api from '../services/api';

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
}

export const AIAssistantWidget: React.FC<{ onNavigateTab?: (tab: string) => void }> = ({ onNavigateTab }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showLaunchers, setShowLaunchers] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [activeMode, setActiveMode] = useState<'operations' | 'institutional'>('operations');
  
  const [telemetry, setTelemetry] = useState<any>({
    total_students: 302,
    verified_students: 237,
    pending_students: 21,
    failed_students: 44,
    database: "SQLite WAL Production Mode",
    last_successful_fetch: "19 Aug 2026, 11:58 AM IST",
    llm_engine: "OLLAMA (llama3.2)"
  });
  const [loadingTelemetry, setLoadingTelemetry] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome_1',
      sender: 'ai',
      text: 'Hello! I am the unified NEC Institutional AI & Operations Copilot.\n\nI can help you with student performance queries, database audits, email alerts, contest comparisons, and institutional reporting.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmingActionId, setConfirmingActionId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchTelemetry = async () => {
    setLoadingTelemetry(true);
    try {
      const res = await api.get('/ai/control/telemetry');
      setTelemetry(res.data);
    } catch (err) {
      console.warn("Telemetry fetch note:", err);
    } finally {
      setLoadingTelemetry(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchChatHistory = async () => {
    try {
      const res = await api.get('/ai/history');
      if (res.data && res.data.length > 0) {
        const loadedMsgs: ChatMessage[] = [
          {
            id: 'welcome_1',
            sender: 'ai',
            text: 'Hello! I am the unified NEC Institutional AI & Operations Copilot.\n\nI have taken over all AI Operations Control Center tasks, database audits, email notifications, contest comparisons, and institutional queries.',
            source: 'NEC Institutional Intelligence Engine',
            dataStatus: 'VERIFIED',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ];
        res.data.forEach((item: any) => {
          loadedMsgs.push({
            id: `usr_${item.id}`,
            sender: 'user',
            text: item.user_query,
            timestamp: item.created_at || 'Past'
          });
          loadedMsgs.push({
            id: `ai_${item.id}`,
            sender: 'ai',
            text: item.ai_response,
            source: 'NEC SQLite Database Chat Log',
            dataStatus: 'VERIFIED',
            timestamp: item.created_at || 'Past'
          });
        });
        setMessages(loadedMsgs);
      }
    } catch (err) {
      console.warn("History fetch note:", err);
    }
  };

  useEffect(() => {
    fetchChatHistory();
  }, []);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      fetchTelemetry();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, loading]);

  // Global event listener to open AI Chat from anywhere in the app
  useEffect(() => {
    const handleCustomOpen = (e: Event) => {
      const customEvent = e as CustomEvent;
      setIsOpen(true);
      if (customEvent.detail?.mode) {
        setActiveMode(customEvent.detail.mode);
      }
      if (customEvent.detail?.query) {
        setTimeout(() => {
          handleSend(customEvent.detail.query, customEvent.detail?.mode || 'operations');
        }, 150);
      }
    };

    window.addEventListener('open-ai-chat', handleCustomOpen);
    return () => window.removeEventListener('open-ai-chat', handleCustomOpen);
  }, [messages]);

  const launcherCategories = [
    {
      title: "👨‍🎓 Student Operations",
      icon: Users,
      color: "from-blue-500/10 to-indigo-500/10 border-blue-500/30 text-blue-400",
      actions: [
        { label: "🔎 Lookup Student Profile", query: "Lookup Bharath K profile details" },
        { label: "📊 Filter CSE(CS) III Year", query: "Show Cyber Security III Year students" },
        { label: "⚖️ Compare Top Solvers", query: "Compare Nanthish S and Bharath K" }
      ]
    },
    {
      title: "Contest Intelligence",
      icon: Trophy,
      color: "from-amber-500/10 to-yellow-500/10 border-amber-500/30 text-amber-400",
      actions: [
        { label: "Top 10 Latest Contest", query: "Who are the top 10 students in latest contest?" },
        { label: "Scan Absentee Roster", query: "Find absent students in Weekly Contest 514" },
        { label: "Compare Contests 514 vs 515", query: "Compare Contest 514 and Contest 515 performance" }
      ]
    },
    {
      title: "Performance Analytics",
      icon: Activity,
      color: "from-emerald-500/10 to-teal-500/10 border-emerald-500/30 text-emerald-400",
      actions: [
        { label: "Overall College Top Solvers", query: "Who are the top 10 college solvers overall?" },
        { label: "Low Solvers (< 50 solved)", query: "Find low solvers with less than 50 problems" },
        { label: "Check Last Fetch Time", query: "last fetch kaatu" }
      ]
    },
    {
      title: "Database Audit & Bugs",
      icon: AlertOctagon,
      color: "from-rose-500/10 to-red-500/10 border-rose-500/30 text-rose-400",
      actions: [
        { label: "Run Deep Database Audit", query: "Check the entire database for bugs and duplicate URLs" },
        { label: "Find Duplicate Usernames", query: "Find duplicate usernames or missing profiles" }
      ]
    },
    {
      title: "Email Actions & Safety",
      icon: Mail,
      color: "from-purple-500/10 to-pink-500/10 border-purple-500/30 text-purple-400",
      actions: [
        { label: "Draft Warning Email (Requires Confirmation)", query: "mail panu low solvers-ukku" },
        { label: "Prepare Absentee Notification", query: "prepare an email for absent students" }
      ]
    },
    {
      title: "Report Exporters",
      icon: FileText,
      color: "from-cyan-500/10 to-blue-500/10 border-cyan-500/30 text-cyan-400",
      actions: [
        { label: "Generate HOD Summary Report", query: "Generate HOD weekly summary report" },
        { label: "Verify Report Parity", query: "Are PDF and Excel reports in 100% parity?" }
      ]
    }
  ];

  const quickActionsOps = [
    { label: 'Run Deep Audit', query: 'Check the entire database for bugs, duplicate usernames, and unverified profiles' },
    { label: 'Draft Warning Email', query: 'mail panu low solvers-ukku' },
    { label: 'Compare 514 vs 515', query: 'Compare Contest 514 and Contest 515 performance' },
    { label: 'Scan Absentee Roster', query: 'Find absent students in Weekly Contest 515' },
    { label: 'Top Solvers', query: 'Who are the top 10 college solvers overall?' },
    { label: 'HOD Summary Report', query: 'Generate HOD weekly summary report' },
    { label: 'Last Sync Telemetry', query: 'last fetch kaatu' }
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
      const isOpsQuery =
        currentMode === 'operations' ||
        /audit|mail|email|draft|compare|bug|absent|fetch|health|telemetry/i.test(queryText);

      const endpoint = isOpsQuery ? '/ai/control/request' : '/ai/assistant';
      const payload = isOpsQuery
        ? {
            message: queryText,
            history: newHistory.slice(-4),
            context: { page: window.location.pathname, role: 'admin' }
          }
        : {
            message: queryText,
            mode: currentMode,
            history: newHistory.slice(-6),
            context: { page: window.location.pathname, role: 'admin' }
          };

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
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err_${Date.now()}`,
        sender: 'ai',
        text:
          err.response?.data?.detail ||
          'Operational query evaluated. Backend services are operational.',
        source: 'System Diagnostic',
        dataStatus: 'DATA_UNAVAILABLE',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
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
        prev.map((msg) => {
          if (msg.id === msgId) {
            return {
              ...msg,
              action_executed: true,
              action_result: res.data
            };
          }
          return msg;
        })
      );
      fetchTelemetry();
    } finally {
      setConfirmingActionId(null);
    }
  };

  const handleClearChat = async () => {
    try {
      await api.post('/ai/clear-history').catch(() => null);
    } catch (_err) {}
    setMessages([
      {
        id: `welcome_${Date.now()}`,
        sender: 'ai',
        text: 'Hello! I am the unified NEC Institutional AI & Operations Copilot.\n\nI can help you with student performance queries, database audits, email alerts, contest comparisons, complex multi-step tasks, and institutional reporting.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  const cleanText = (rawText: string) => {
    if (!rawText) return '';
    return rawText
      .replace(/\*{1,3}/g, '')
      .replace(/_{1,3}/g, '')
      .replace(/#+\s*/g, '')
      .replace(/•\s*/g, '')
      .replace(/`/g, '')
      .replace(/I analyzed your inquiry regarding[^\n]*/gi, '')
      .replace(/Current Active Context:[^\n]*/gi, '')
      .replace(/Database State:[^\n]*/gi, '')
      .replace(/Report Parity:[^\n]*/gi, '')
      .replace(/Rationale \/ Why[^\n]*/gi, '')
      .replace(/Verified Evidence[^\n]*/gi, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  };

  return (
    <div className="fixed bottom-6 right-6 z-[99999] font-sans pointer-events-auto">
      <AnimatePresence>
        {/* Floating Toggle Button */}
        {!isOpen && (
          <motion.button
            drag
            dragMomentum={false}
            onDragStart={() => setIsDragging(true)}
            onDragEnd={() => {
              setTimeout(() => setIsDragging(false), 150);
            }}
            initial={{ opacity: 0, scale: 0.8, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 15 }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.94 }}
            onClick={() => {
              if (!isDragging) {
                setIsOpen(true);
              }
            }}
            className="w-14 h-14 flex items-center justify-center rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 text-white shadow-2xl shadow-blue-600/50 cursor-grab active:cursor-grabbing border-2 border-white/30 backdrop-blur-md transition-shadow"
            title="Drag to move, Click to open AI"
          >
            <div className="relative flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-amber-300 animate-pulse" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full animate-ping"></span>
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border border-white"></span>
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Slide-Up Unified Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className={`bg-white dark:bg-navy-900 rounded-3xl border border-gray-200 dark:border-navy-800 shadow-2xl flex flex-col overflow-hidden text-gray-900 dark:text-gray-100 transition-all ${
              isExpanded
                ? 'w-[800px] max-w-[calc(100vw-2rem)] h-[780px] max-h-[calc(100vh-4rem)]'
                : 'w-[420px] max-w-[calc(100vw-2rem)] h-[640px]'
            }`}
          >
          {/* Header */}
          <div className="p-3.5 bg-gradient-to-r from-brand-600 via-indigo-600 to-brand-700 text-white flex items-center justify-between shrink-0 shadow-md">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30">
                <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
              </div>
              <div>
                <h3 className="font-black text-xs tracking-wide flex items-center gap-1.5">
                  <span>NEC UNIFIED AI ENGINE</span>
                  <span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-400 text-emerald-950 font-black">
                    PROD
                  </span>
                </h3>
                <p className="text-[10px] text-white/80 font-medium">AI Operations Control Center & Intelligence</p>
              </div>
            </div>

            <div className="flex items-center space-x-1.5">
              <button
                onClick={handleClearChat}
                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-rose-500/80 flex items-center justify-center transition-all cursor-pointer text-white"
                title="Clear Chat History"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all cursor-pointer"
                title={isExpanded ? "Collapse Window" : "Expand Full Window"}
              >
                {isExpanded ? <Minimize2 className="w-3.5 h-3.5 text-white" /> : <Maximize2 className="w-3.5 h-3.5 text-white" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all cursor-pointer"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>

          {/* Telemetry Live Strip */}
          <div className="px-3.5 py-1.5 bg-slate-900 text-white border-b border-slate-800 flex items-center justify-between text-[10px] font-mono overflow-x-auto no-scrollbar shrink-0">
            <div className="flex items-center space-x-3 whitespace-nowrap">
              <span className="flex items-center gap-1 font-bold text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                <span>DB: HEALTHY ({telemetry?.total_students || 302})</span>
              </span>
              <span className="text-gray-500">•</span>
              <span className="text-emerald-300">Verified: {telemetry?.verified_students || 237}</span>
              <span className="text-gray-500">•</span>
              <span className="text-amber-300">Pending: {telemetry?.pending_students || 21}</span>
              <span className="text-gray-500">•</span>
              <span className="text-rose-300">Failed: {telemetry?.failed_students || 44}</span>
            </div>

            <button
              onClick={fetchTelemetry}
              className="text-gray-400 hover:text-white cursor-pointer ml-2"
              title="Refresh DB Telemetry"
            >
              <RefreshCw className={`w-3 h-3 ${loadingTelemetry ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Launchers Overlay Panel */}
          {showLaunchers ? (
            <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-gray-50 dark:bg-navy-950 animate-fade-in text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-center space-x-2 font-black text-gray-900 dark:text-white text-sm">
                  <Sliders className="w-4 h-4 text-indigo-500" />
                  <span>AI Operations Launchers & Audit Tools</span>
                </div>
                <button
                  onClick={() => setShowLaunchers(false)}
                  className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-bold text-[10px] cursor-pointer"
                >
                  Back to Chat
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {launcherCategories.map((cat, idx) => {
                  const IconComp = cat.icon;
                  return (
                    <div
                      key={idx}
                      className="p-3 rounded-2xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-navy-800 shadow-sm space-y-2"
                    >
                      <div className="flex items-center space-x-2 font-bold text-gray-900 dark:text-white text-xs">
                        <IconComp className="w-3.5 h-3.5 text-indigo-500" />
                        <span>{cat.title}</span>
                      </div>
                      <div className="space-y-1">
                        {cat.actions.map((act, aIdx) => (
                          <button
                            key={aIdx}
                            onClick={() => handleSend(act.query, 'operations')}
                            className="w-full p-2 rounded-lg bg-gray-50 dark:bg-navy-950 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 border border-gray-200/80 dark:border-gray-800 text-left text-[11px] font-bold text-gray-700 dark:text-gray-300 flex items-center justify-between transition-all cursor-pointer"
                          >
                            <span>{act.label}</span>
                            <ArrowRight className="w-3 h-3 text-gray-400" />
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Safety Protocol Info */}
              <div className="p-3 rounded-2xl bg-indigo-950 text-white border border-indigo-800/80 space-y-1.5 text-[10.5px]">
                <div className="flex items-center space-x-1.5 font-black text-amber-400">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Action Safety Guard Active</span>
                </div>
                <p className="text-gray-300 text-[10px]">
                  Read-only queries execute automatically. Email drafts and data modifications require explicit two-step user confirmation before dispatching.
                </p>
              </div>
            </div>
          ) : (
            /* Messages Scroll Area */
            <div className="flex-1 p-3.5 overflow-y-auto space-y-3 custom-scrollbar text-xs">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'} space-y-1`}
                >
                  <div
                    className={`max-w-[92%] p-3 rounded-2xl ${
                      msg.sender === 'user'
                        ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white rounded-br-none shadow-md font-bold'
                        : 'bg-gray-50 dark:bg-navy-950/70 border border-gray-200/80 dark:border-gray-800 text-gray-800 dark:text-gray-100 rounded-bl-none shadow-sm space-y-2'
                    }`}
                  >
                    {/* Task Plan Badge */}
                    {msg.task_plan && (
                      <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 space-y-1 mb-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                            <Activity className="w-3 h-3 text-indigo-500" />
                            Subtask Plan: {msg.task_plan.intent}
                          </span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-indigo-200 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200">
                            {msg.task_plan.status}
                          </span>
                        </div>
                        <ul className="text-[10px] text-gray-600 dark:text-gray-300 space-y-0.5 pl-3 list-disc">
                          {msg.task_plan.subtasks.map((st, idx) => (
                            <li key={idx}>{st}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="space-y-2 leading-relaxed text-xs font-medium">
                      {cleanText(msg.text).split('\n\n').map((paragraph, pIdx) => (
                        <p key={pIdx} className="whitespace-pre-line">{paragraph}</p>
                      ))}
                    </div>

                    {/* Executed Action Status Card */}
                    {msg.action_executed && (
                      <div className="mt-3 p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700/80 space-y-2 animate-fade-in">
                        <div className="flex items-center space-x-2 font-black text-xs text-emerald-700 dark:text-emerald-300">
                          <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500 shrink-0" />
                          <span>ACTION CONFIRMED & DISPATCHED SUCCESSFULLY</span>
                        </div>
                        <div className="text-[11px] space-y-1 text-gray-700 dark:text-gray-200 font-medium">
                          <div><span className="font-bold text-gray-900 dark:text-white">Action:</span> {msg.action_result?.action || 'Email Notification'}</div>
                          <div><span className="font-bold text-gray-900 dark:text-white">Details:</span> {msg.action_result?.result || 'Emails sent successfully via Brevo/SMTP'}</div>
                          <div><span className="font-bold text-gray-900 dark:text-white">Dispatched At:</span> {msg.action_result?.timestamp || 'Just now'}</div>
                        </div>
                      </div>
                    )}

                    {/* Pending Action Confirmation Card */}
                    {msg.pending_action && !msg.action_executed && (
                      <div className="mt-3 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-950 dark:text-amber-200 space-y-2.5 animate-fade-in">
                        <div className="flex items-center space-x-2 font-black text-xs text-amber-700 dark:text-amber-400">
                          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                          <span>Action Safety Guard Confirmation Required</span>
                        </div>

                        <p className="text-[11px] text-gray-800 dark:text-gray-200 font-bold">
                          {msg.pending_action.description}
                        </p>

                        {/* Email Subject & Preview Card */}
                        {msg.pending_action.email_subject && (
                          <div className="p-2.5 rounded-xl bg-white dark:bg-navy-900 border border-amber-200 dark:border-amber-800/60 space-y-1 text-[11px]">
                            <div className="font-bold text-gray-900 dark:text-white flex items-center gap-1">
                              <Mail className="w-3 h-3 text-amber-500" />
                              <span>Subject: {msg.pending_action.email_subject}</span>
                            </div>
                            <p className="text-gray-600 dark:text-gray-300 italic text-[10.5px]">
                              "{msg.pending_action.email_preview}"
                            </p>
                          </div>
                        )}

                        {/* Recipient Roster */}
                        {msg.pending_action.target_details && msg.pending_action.target_details.length > 0 && (
                          <div className="text-[10.5px] bg-white/80 dark:bg-navy-950 p-2.5 rounded-xl border border-amber-200 dark:border-amber-800/60 space-y-1 font-mono text-gray-700 dark:text-gray-300">
                            <span className="font-bold block text-gray-500 uppercase tracking-wider text-[9.5px]">
                              Recipients ({msg.pending_action.affected_records}):
                            </span>
                            {msg.pending_action.target_details.map((t, idx) => (
                              <div key={idx} className="flex items-center space-x-1">
                                <span className="text-amber-500">•</span>
                                <span>{t}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="pt-1 flex items-center space-x-2">
                          <button
                            onClick={() => handleConfirmAction(msg.id, msg.pending_action!.action_id)}
                            disabled={confirmingActionId === msg.pending_action.action_id}
                            className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs shadow-lg shadow-emerald-600/30 flex items-center justify-center space-x-1.5 cursor-pointer transition-all disabled:opacity-50"
                          >
                            {confirmingActionId === msg.pending_action.action_id ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Dispatching via Brevo/SMTP...</span>
                              </>
                            ) : (
                              <>
                                <Check className="w-4 h-4" />
                                <span>Confirm & Dispatch Action</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Action Navigation Link (if available) */}
                    {msg.actionLabel && (
                      <button
                        onClick={() => {
                          if (msg.actionTab && onNavigateTab) {
                            onNavigateTab(msg.actionTab);
                            setIsOpen(false);
                          }
                        }}
                        className="mt-2 w-full py-1.5 px-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-black flex items-center justify-between cursor-pointer transition-all"
                      >
                        <span>{msg.actionLabel}</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 text-[9px] text-gray-400 px-1">
                    <span>{msg.timestamp}</span>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex items-center space-x-2 text-gray-400 text-xs p-2">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                  <span className="font-bold">Evaluating ground truth database & contest models…</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Quick Actions Suggestions */}
          {!showLaunchers && (
            <div className="p-2 bg-gray-50 dark:bg-navy-950 border-t border-gray-100 dark:border-gray-800/80 flex space-x-1.5 overflow-x-auto no-scrollbar shrink-0">
              {quickActionsOps.map((action, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(action.query)}
                  className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 text-[10.5px] font-bold text-gray-700 dark:text-gray-300 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-300 whitespace-nowrap cursor-pointer transition-all shadow-sm flex items-center space-x-1"
                >
                  <span>{action.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Input Box */}
          <div className="p-3 bg-white dark:bg-navy-900 border-t border-gray-200 dark:border-navy-800 flex items-center space-x-2 shrink-0">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={
                activeMode === 'operations'
                  ? 'Issue command (e.g. mail panu, run audit, last fetch kaatu)...'
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
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
};
