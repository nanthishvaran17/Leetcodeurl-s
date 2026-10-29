import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useKeyboardContext } from '../context/KeyboardContext';
import {
  X,
  Send,
  Bot,
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
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Plus,
  Sparkles
} from 'lucide-react';
import api from '../services/api';
import { getApiUrl } from '../config/apiConfig';
import { downloadManager } from '../services/download/downloadManager';

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

interface BriefCard {
  type: 'SUCCESS' | 'WARNING' | 'ALERT' | 'INFO';
  icon: string;
  title: string;
  body: string;
  cta_label: string;
  cta_query: string;
  metric?: string;
  trend?: 'UP' | 'DOWN' | 'STABLE' | null;
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
  clarifyingOptions?: string[];
  pdfAvailable?: boolean;
  downloadUrl?: string;
  timestamp: string;
  isError?: boolean;
  isThinking?: boolean;
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

  const renderFormattedText = (textChunk: string, key: number) => {
    const parts = textChunk.split(/(\*\*[^*]+\*\*|__[^_]+__)/g);
    return (
      <React.Fragment key={key}>
        {parts.map((part, i) => {
          if (/^\*\*[^*]+\*\*$/.test(part) || /^__[^_]+__$/.test(part)) {
            const inner = part.replace(/^\*\*|^\s*__/, '').replace(/\*\*$|__$/, '');
            return <strong key={i} className="font-bold text-slate-900 dark:text-white">{inner}</strong>;
          }
          const codeParts = part.split(/(`[^`]+`)/g);
          return (
            <React.Fragment key={i}>
              {codeParts.map((cp, ci) => {
                if (/^`[^`]+`$/.test(cp)) {
                  return (
                    <code key={ci} className="px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-navy-800 text-[11px] font-mono font-bold text-brand-700 dark:text-brand-300">
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

  const renderInline = (line: string, key: number) => {
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    if (linkRegex.test(line)) {
      const segments: React.ReactNode[] = [];
      let lastIndex = 0;
      let match;
      linkRegex.lastIndex = 0;
      while ((match = linkRegex.exec(line)) !== null) {
        if (match.index > lastIndex) {
          segments.push(renderFormattedText(line.slice(lastIndex, match.index), segments.length));
        }
        const linkText = match[1];
        const linkUrl = match[2];
        segments.push(
          <a
            key={segments.length}
            href={linkUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1 my-1 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-bold text-[11px] transition-all no-underline shadow-xs cursor-pointer active:scale-95"
          >
            <FileText className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>{linkText}</span>
            <ChevronRight className="w-3 h-3 text-emerald-400 shrink-0" />
          </a>
        );
        lastIndex = match.index + match[0].length;
      }
      if (lastIndex < line.length) {
        segments.push(renderFormattedText(line.slice(lastIndex), segments.length));
      }
      return <React.Fragment key={key}>{segments}</React.Fragment>;
    }
    return renderFormattedText(line, key);
  };

  const renderedBlocks = blocks.map((block, bIdx) => {
    const trimmed = block.trim();
    if (!trimmed) return null;

    if (trimmed.startsWith('```')) {
      const codeContent = trimmed.replace(/^```[\w]*\n?/, '').replace(/```$/, '').trim();
      return (
        <div key={bIdx} className="my-2 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-xs">
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

    // Heading format
    if (/^#{1,4}\s+/.test(trimmed)) {
      const headingText = trimmed.replace(/^#{1,4}\s+/, '');
      return (
        <div key={bIdx} className="pt-2 pb-1 border-b border-slate-200/70 dark:border-navy-800">
          <h4 className="text-[12.5px] font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span className="w-1.5 h-3.5 rounded-full bg-gradient-to-b from-brand-500 to-indigo-600 shrink-0" />
            <span>{renderInline(headingText, 0)}</span>
          </h4>
        </div>
      );
    }

    const lines = trimmed.split('\n');

    // Markdown Table Detection
    const isTable = lines.length >= 2 && lines.filter(l => l.trim()).every(l => l.trim().startsWith('|') && l.trim().endsWith('|'));
    if (isTable) {
      const nonSeparatorLines = lines.filter(l => l.trim() && !/^[|\s-:]+$/.test(l.trim()));
      const headerLine = nonSeparatorLines[0];
      const dataLines = nonSeparatorLines.slice(1);
      const parseCells = (l: string) => l.split('|').slice(1, -1).map(c => c.trim());
      const headers = headerLine ? parseCells(headerLine) : [];

      return (
        <div key={bIdx} className="my-2.5 rounded-xl border border-slate-200/90 dark:border-navy-700 overflow-hidden shadow-xs bg-white dark:bg-navy-950">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-[11px] border-collapse min-w-[340px]">
              <thead>
                <tr className="bg-slate-100/90 dark:bg-navy-800/90 text-slate-700 dark:text-slate-200 border-b border-slate-200/90 dark:border-navy-700">
                  {headers.map((h, hi) => (
                    <th key={hi} className="px-3 py-2 font-bold whitespace-nowrap text-[10.5px]">
                      {renderInline(h, hi)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-navy-800/60 font-medium">
                {dataLines.map((row, ri) => {
                  const cells = parseCells(row);
                  return (
                    <tr key={ri} className="odd:bg-white dark:odd:bg-navy-950 even:bg-slate-50/70 dark:even:bg-navy-900/30 hover:bg-brand-50/40 dark:hover:bg-brand-950/30 transition-colors">
                      {cells.map((c, ci) => (
                        <td key={ci} className="px-3 py-1.5 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {renderInline(c, ci)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    const isBulletList = lines.length > 1 && lines.every(l => /^[-\u2022*]\s+/.test(l.trim()) || l.trim() === '');
    const isNumberedList = lines.length > 1 && lines.every(l => /^\d+[.)]\s+/.test(l.trim()) || l.trim() === '');

    if (isBulletList) {
      return (
        <ul key={bIdx} className="space-y-1.5 my-1.5 pl-0">
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
        <ol key={bIdx} className="space-y-1.5 my-1.5 pl-0">
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
      <Bot className="w-3 h-3 text-white" />
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
  activeContext?: { type: string; id?: string; title?: string } | null;
}> = ({ onSend, mode, activeContext }) => {
  let suggestions = [];

  if (activeContext?.type === 'CONTEST') {
    const cid = activeContext.id || 'this contest';
    suggestions = [
      { icon: Trophy, label: 'Summarize Contest', desc: `Overview of Contest ${cid}`, query: `Summarize Weekly Contest ${cid} and key takeaways`, color: 'text-amber-500' },
      { icon: Users, label: 'Top Performers', desc: 'Who performed best?', query: `Who performed best in Weekly Contest ${cid}?`, color: 'text-brand-500' },
      { icon: AlertTriangle, label: 'Identify Weak Areas', desc: 'Find lowest scores', query: `Identify weak areas and low scoring problems in Contest ${cid}`, color: 'text-rose-500' },
      { icon: BarChart2, label: 'Compare Contests', desc: 'Compare with previous session', query: `Compare Weekly Contest ${cid} with the previous contest session`, color: 'text-indigo-500' },
    ];
  } else if (activeContext?.type === 'STUDENT') {
    const sName = activeContext.title || activeContext.id || 'this student';
    suggestions = [
      { icon: User, label: 'Analyze Student', desc: `Deep dive into ${sName}`, query: `Analyze student performance and activity for ${sName}`, color: 'text-indigo-500' },
      { icon: GraduationCap, label: 'Placement Readiness', desc: 'Assess coding readiness', query: `Assess placement readiness and skill level for ${sName}`, color: 'text-emerald-500' },
      { icon: TrendingUp, label: 'Strengths & Weaknesses', desc: 'Topic proficiency', query: `Identify topic strengths and weaknesses for ${sName}`, color: 'text-brand-500' },
      { icon: BookOpen, label: 'Practice Plan', desc: 'Recommend next targets', query: `Recommend a targeted 30-day practice plan for ${sName}`, color: 'text-cyan-500' },
    ];
  } else if (activeContext?.type === 'REPORT') {
    suggestions = [
      { icon: FileText, label: 'Summarize Report', desc: 'Executive overview', query: 'Summarize this official weekly report and key findings', color: 'text-cyan-500' },
      { icon: BarChart2, label: 'Key Highlights', desc: 'Extract metrics & counts', query: 'What are the main performance highlights and statistics in this report?', color: 'text-emerald-500' },
      { icon: AlertOctagon, label: 'Identify Risks', desc: 'Flag low solvers & inactive', query: 'Identify risk factors and inactive student groups in this report', color: 'text-rose-500' },
      { icon: Mail, label: 'Draft HOD Summary', desc: 'Executive briefing email', query: 'Draft an executive briefing email for HOD based on this report', color: 'text-purple-500' },
    ];
  } else if (activeContext?.type === 'QUALITY') {
    suggestions = [
      { icon: AlertOctagon, label: 'Quality Audit', desc: 'Explain validation alerts', query: 'Explain the active data quality alerts and profile discrepancies', color: 'text-rose-500' },
      { icon: Users, label: 'Missing Handles', desc: 'Students with no LeetCode handle', query: 'List students missing LeetCode username handles', color: 'text-amber-500' },
      { icon: ShieldAlert, label: 'Unverified Profiles', desc: 'Find failing sync profiles', query: 'Which student profiles failed live synchronization verification?', color: 'text-purple-500' },
      { icon: RefreshCw, label: 'Trigger Fix Scan', desc: 'Scan and repair issues', query: 'Run a deep audit to repair invalid student profiles', color: 'text-cyan-500' },
    ];
  } else {
    suggestions = mode === 'operations'
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
  }

  return (
    <div className="flex flex-col items-center justify-start py-3 px-3 sm:px-4 space-y-3 my-auto">
      <div className="space-y-1 text-center">
        <div className="w-9 h-9 mx-auto rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center shadow-sm">
          <Bot className="w-4.5 h-4.5 text-white" />
        </div>
        <p className="text-[10.5px] font-semibold text-slate-500 dark:text-slate-400 pt-0.5">
          {activeContext ? `Ask AI about ${activeContext.type.toLowerCase()} context ${activeContext.id ? `#${activeContext.id}` : ''}` : 'Ask anything about NEC student data'}
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
              <div className="text-[10px] text-slate-600 dark:text-slate-300 leading-tight mt-0.5">{s.desc}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// --- Main Widget ---

export interface AIAssistantWidgetProps {
  onNavigateTab?: (tab: string) => void;
  onClose?: () => void;
  initialQuery?: string;
  onClearInitialQuery?: () => void;
}

export const AIAssistantWidget: React.FC<AIAssistantWidgetProps> = ({
  onNavigateTab,
  onClose,
  initialQuery,
  onClearInitialQuery,
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showLaunchers, setShowLaunchers] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [activeMode, setActiveMode] = useState<'operations' | 'institutional'>('operations');
  const [scrolledUp, setScrolledUp] = useState(false);

  const handleCloseWidget = () => {
    setIsOpen(false);
    if (onClose) {
      onClose();
    }
  };

  const { pushContext, popContext, registerEscHandler } = useKeyboardContext();

  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener('open_ai_widget', handleOpen);
    window.addEventListener('force_open_ai_widget', handleOpen);
    window.addEventListener('toggle_ai_assistant', handleOpen);
    return () => {
      window.removeEventListener('open_ai_widget', handleOpen);
      window.removeEventListener('force_open_ai_widget', handleOpen);
      window.removeEventListener('toggle_ai_assistant', handleOpen);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      pushContext('DRAWER');
      const unregister = registerEscHandler(() => {
        handleCloseWidget();
      });
      return () => {
        unregister();
        popContext('DRAWER');
      };
    }
  }, [isOpen, pushContext, popContext, registerEscHandler]);

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

  const [briefCards, setBriefCards] = useState<BriefCard[]>([]);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefDismissed, setBriefDismissed] = useState(false);
  const [briefExpanded, setBriefExpanded] = useState(false);

  const makeWelcomeMsg = (): ChatMessage => {
    return {
      id: 'welcome_1',
      sender: 'ai',
      text: `### Institutional Intelligence Assistant\n*RBAC-enforced AI assistant grounded strictly in verified institutional database records.*\n\n**How can I help you today?**\nAsk me to generate reports, find inactive students, or analyze performance. All answers are verified against live DB records.`,
      source: 'NEC Institutional AI Engine',
      dataStatus: 'VERIFIED',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
  };

  const [messages, setMessages] = useState<ChatMessage[]>([makeWelcomeMsg()]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmingActionId, setConfirmingActionId] = useState<string | null>(null);

  const conversationIdRef = useRef<string>(`conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
    }
  };

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

  const fetchProactiveBrief = useCallback(async () => {
    setBriefLoading(true);
    setBriefDismissed(false);
    try {
      const res = await api.get('/ai/proactive-brief');
      setBriefCards(res.data?.cards || []);
    } catch {
      // Silent — widget still works without brief
    } finally {
      setBriefLoading(false);
    }
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior
      });
    }
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

  // Start fresh by default; user can click New Chat anytime to reset
  // useEffect(() => { fetchChatHistory(); }, []);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom('instant');
      fetchTelemetry();
      fetchProactiveBrief();
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && !scrolledUp) scrollToBottom();
  }, [messages, loading]);

  const [activeContext, setActiveContext] = useState<{
    type: string;
    id?: string;
    title?: string;
    aiPrompt?: string;
  } | null>(null);

  useEffect(() => {
    const handleCustomOpen = (e: Event) => {
      const customEvent = e as CustomEvent;
      setIsOpen(true);
      if (customEvent.detail?.mode) setActiveMode(customEvent.detail.mode);
      if (customEvent.detail?.context) setActiveContext(customEvent.detail.context);
      if (customEvent.detail?.query) {
        setTimeout(() => {
          handleSend(customEvent.detail.query, customEvent.detail?.mode || 'operations');
        }, 150);
      } else {
        setTimeout(() => {
          inputRef.current?.focus();
        }, 100);
      }
    };
    const handleToggleOpen = () => {
      setIsOpen(prev => !prev);
    };

    window.addEventListener('open-ai-chat', handleCustomOpen);
    window.addEventListener('openAIChatWithContext', handleCustomOpen);
    window.addEventListener('open_ai_assistant', handleCustomOpen);
    window.addEventListener('toggle_ai_assistant', handleToggleOpen);
    return () => {
      window.removeEventListener('open-ai-chat', handleCustomOpen);
      window.removeEventListener('openAIChatWithContext', handleCustomOpen);
      window.removeEventListener('open_ai_assistant', handleCustomOpen);
      window.removeEventListener('toggle_ai_assistant', handleToggleOpen);
    };
  }, [messages]);

  const quickActionsOps = [
    { label: 'DB Audit', query: 'Check the entire database for bugs, duplicate usernames, and unverified profiles' },
    { label: 'Warning Email', query: 'mail panu low solvers-ukku' },
    { label: '514 vs 515', query: 'Compare Contest 514 and Contest 515 performance' },
    { label: 'Absentees', query: 'Find absent students in the latest Weekly Contest' },
    { label: 'Top 10', query: 'Who are the top 10 college solvers overall?' },
    { label: 'HOD Report', query: 'Generate HOD weekly summary report' },
  ];

  const launcherCategories = [
    {
      title: 'Student Operations', icon: Users, color: 'text-brand-500',
      actions: [
        { label: 'Lookup Student Profile', query: 'Lookup Bharath K profile details' },
        { label: 'Filter Department III Year', query: 'Show III Year students by department' },
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
    if (textToSend === undefined) {
      setInput('');
      if (inputRef.current) {
        inputRef.current.style.height = 'auto';
      }
    }
    setLoading(true);
    setTimeout(() => inputRef.current?.focus(), 50);

    const isOpsQuery =
      currentMode === 'operations' ||
      /audit|mail|email|draft|compare|bug|absent|fetch|health|telemetry/i.test(queryText);

    // Operations queries use the standard JSON endpoint (unchanged)
    if (isOpsQuery) {
      try {
        const payload = {
          message: queryText,
          conversation_id: conversationIdRef.current,
          history: newHistory.slice(-4),
          context: { page: window.location.pathname, role: 'admin', activeContext, conversation_id: conversationIdRef.current }
        };
        const res = await api.post('/ai/control/request', payload, { timeout: 20000 });
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
          source: res.data.source || 'Verified Institutional Database',
          dataStatus: res.data.dataStatus || res.data.data_status || 'VERIFIED',
          clarifyingOptions: res.data.clarifyingOptions,
          pdfAvailable: res.data.pdfAvailable,
          downloadUrl: res.data.downloadUrl,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, aiMsg]);
      } catch (err: any) {
        setMessages((prev) => [...prev, {
          id: `err_${Date.now()}`, sender: 'ai',
          text: err.response?.data?.detail || 'The AI assistant is temporarily unavailable.',
          source: 'System Diagnostic', dataStatus: 'DATA_UNAVAILABLE', isError: true,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }]);
      } finally {
        setLoading(false);
      }
      return;
    }

    // Institutional queries: use SSE streaming for zero-wait "thinking" indicator 
    const thinkingId = `thinking_${Date.now()}`;
    const thinkingMsg: ChatMessage = {
      id: thinkingId,
      sender: 'ai',
      text: '…',
      isThinking: true,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, thinkingMsg]);

    try {
      const payload = {
        message: queryText,
        mode: currentMode,
        conversation_id: conversationIdRef.current,
        history: newHistory.slice(-6),
        context: { page: window.location.pathname, role: 'admin', activeContext, conversation_id: conversationIdRef.current }
      };
      const token = localStorage.getItem('token');
      const streamUrl = getApiUrl('/ai/assistant/stream');

      const response = await fetch(streamUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.body) throw new Error('No stream body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === 'RESULT') {
              const aiMsg: ChatMessage = {
                id: event.requestId || `ai_${Date.now()}`,
                sender: 'ai',
                text: event.answer || 'Processing completed.',
                why: event.why,
                evidence: event.evidence,
                confidence: event.confidence || 'VERIFIED',
                actionLabel: event.actionLabel,
                actionTab: event.actionTab,
                source: event.source || 'NEC Institutional Intelligence Engine',
                dataStatus: event.dataStatus || 'VERIFIED',
                clarifyingOptions: event.clarifyingOptions,
                pdfAvailable: event.pdfAvailable,
                downloadUrl: event.downloadUrl,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              };
              // Replace thinking bubble with real answer
              setMessages((prev) => prev.map((m) => m.id === thinkingId ? aiMsg : m));
            }
          } catch {
            // Malformed chunk — skip
          }
        }
      }
    } catch (err: any) {
      setMessages((prev) => prev.map((m) => m.id === thinkingId ? {
        ...m,
        text: 'The AI assistant is temporarily unavailable. Please try again.',
        isThinking: false,
        isError: true,
        dataStatus: 'DATA_UNAVAILABLE',
      } : m));
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  useEffect(() => {
    if (initialQuery !== undefined && initialQuery !== null) {
      setIsOpen(true);
      const q = initialQuery.trim();
      if (onClearInitialQuery) onClearInitialQuery();
      if (q) {
        const timer = setTimeout(() => {
          handleSend(q);
        }, 150);
        return () => clearTimeout(timer);
      } else {
        setTimeout(() => {
          inputRef.current?.focus();
        }, 100);
      }
    }
  }, [initialQuery]);

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

  const handleNewChat = async () => {
    try { await api.post('/ai/clear-history').catch(() => null); } catch (_err) { }
    conversationIdRef.current = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    setMessages([{ ...makeWelcomeMsg(), id: `welcome_${Date.now()}`, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    setBriefExpanded(false);
    setInput('');
  };

  const handleClearChat = handleNewChat;

  return (
    <div className="ai-floating-widget fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] sm:bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))] right-2 sm:right-6 left-2 sm:left-auto z-[90000] font-sans pointer-events-auto">

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 24 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            role="dialog" aria-label="NEC AI Assistant"
            className={`ai-assistant-dialog bg-white dark:bg-navy-950 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-navy-800 shadow-2xl flex flex-col overflow-hidden text-slate-900 dark:text-slate-100 transition-all duration-300 ${isExpanded
                ? 'w-full sm:w-[840px] max-w-[calc(100vw-1rem)] h-[calc(100dvh-6rem)] sm:h-[800px] max-h-[calc(100dvh-3.5rem)]'
                : 'w-full sm:w-[440px] h-[calc(100dvh-6.25rem)] sm:h-[620px] max-h-[640px]'
              }`}
          >

            {/* HEADER */}
            <div className="px-3.5 py-2.5 bg-gradient-to-r from-brand-600 via-indigo-600 to-brand-700 text-white flex items-center justify-between shrink-0 shadow-sm">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center shrink-0 shadow-inner">
                  <Bot className="w-4 h-4 text-amber-300" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-extrabold text-[13px] tracking-tight truncate leading-tight">NEC AI Copilot</h3>
                    <span className="px-1.5 py-0.2 rounded-full text-[8.5px] font-black bg-emerald-400 text-emerald-950 uppercase tracking-widest shrink-0">PRO</span>
                  </div>
                  <p className="text-[10px] text-white/80 font-medium truncate leading-tight">
                    Institutional Intelligence & Operations
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={handleNewChat}
                  aria-label="New chat session"
                  className="px-2.5 py-1 rounded-xl bg-white/20 hover:bg-white/30 active:scale-95 text-white font-bold text-[10.5px] flex items-center gap-1 transition-all shadow-xs cursor-pointer border border-white/20"
                  title="Start fresh conversation"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Chat</span>
                </button>
                <button type="button" onClick={() => setShowLaunchers(!showLaunchers)} aria-label="Toggle quick tools"
                  className={`p-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${showLaunchers ? 'bg-white text-indigo-700 shadow-sm' : 'bg-white/15 hover:bg-white/25 text-white'}`} title="Tools & Launchers">
                  <Sliders className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline text-[10px]">Tools</span>
                </button>
                <button type="button" onClick={() => setIsExpanded(!isExpanded)} aria-label={isExpanded ? 'Collapse' : 'Expand'}
                  className="hidden sm:flex p-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white transition-all cursor-pointer" title={isExpanded ? 'Collapse' : 'Full-screen mode'}>
                  {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </button>
                <button type="button" onClick={handleCloseWidget} aria-label="Close assistant"
                  className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white transition-all cursor-pointer" title="Close">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* ACTIVE CONTEXT BANNER */}
            {activeContext && (
              <div className="px-3 py-1.5 bg-gradient-to-r from-brand-900 via-indigo-950 to-navy-950 text-white border-b border-brand-800 flex items-center justify-between text-[11px] shrink-0">
                <div className="flex items-center gap-2 min-w-0 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  <span className="font-bold text-emerald-300 uppercase tracking-wider text-[10px]">Context:</span>
                  <span className="truncate font-semibold text-slate-100">
                    {activeContext.type} {activeContext.id ? `#${activeContext.id}` : ''} {activeContext.title ? `— ${activeContext.title}` : ''}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveContext(null)}
                  className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white/80 hover:text-white text-[10px] font-semibold transition-colors cursor-pointer shrink-0 ml-2"
                >
                  Clear Context
                </button>
              </div>
            )}


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
                  className="flex-1 min-h-0 overflow-y-auto custom-scrollbar bg-white dark:bg-navy-950"
                >
                  {isEmptyConversation ? (
                    <div className="h-full flex flex-col items-center justify-center px-4 py-8 text-center my-auto">
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.25 }}
                        className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 via-indigo-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-brand-500/20 text-white mb-3"
                      >
                        <Sparkles className="w-6 h-6 text-amber-300" />
                      </motion.div>
                      <motion.h3
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 }}
                        className="font-extrabold text-[16px] text-slate-800 dark:text-white tracking-tight"
                      >
                        NEC AI Copilot
                      </motion.h3>
                      <motion.p
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-[12px] text-slate-500 dark:text-slate-400 max-w-[320px] text-center mt-1 leading-relaxed"
                      >
                        Institutional Intelligence Assistant. Ask any question or select a starter below to generate verified reports.
                      </motion.p>

                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 }}
                        className="grid grid-cols-2 gap-2.5 w-full max-w-[360px] mt-6"
                      >
                        <button
                          type="button"
                          onClick={() => handleSend("Who are the top 10 college solvers overall?")}
                          className="p-3 rounded-xl bg-slate-50 dark:bg-navy-900 hover:bg-brand-50/60 dark:hover:bg-navy-800 border border-slate-200 dark:border-navy-700 hover:border-brand-300 dark:hover:border-brand-700 transition-all text-left flex flex-col group cursor-pointer shadow-xs active:scale-98"
                        >
                          <Trophy className="w-4 h-4 text-amber-500 mb-1.5 group-hover:scale-110 transition-transform" />
                          <span className="text-[11.5px] font-bold text-slate-800 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400">Top 10 Solvers</span>
                          <span className="text-[10px] text-slate-400">College leaderboard</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSend("Find low solvers with less than 1 problem solved")}
                          className="p-3 rounded-xl bg-slate-50 dark:bg-navy-900 hover:bg-rose-50/60 dark:hover:bg-navy-800 border border-slate-200 dark:border-navy-700 hover:border-rose-300 dark:hover:border-rose-700 transition-all text-left flex flex-col group cursor-pointer shadow-xs active:scale-98"
                        >
                          <AlertTriangle className="w-4 h-4 text-rose-500 mb-1.5 group-hover:scale-110 transition-transform" />
                          <span className="text-[11.5px] font-bold text-slate-800 dark:text-white group-hover:text-rose-600 dark:group-hover:text-rose-400">Zero Solvers</span>
                          <span className="text-[10px] text-slate-400">21 students alert</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSend("mail panu low solvers-ukku")}
                          className="p-3 rounded-xl bg-slate-50 dark:bg-navy-900 hover:bg-purple-50/60 dark:hover:bg-navy-800 border border-slate-200 dark:border-navy-700 hover:border-purple-300 dark:hover:border-purple-700 transition-all text-left flex flex-col group cursor-pointer shadow-xs active:scale-98"
                        >
                          <Mail className="w-4 h-4 text-purple-500 mb-1.5 group-hover:scale-110 transition-transform" />
                          <span className="text-[11.5px] font-bold text-slate-800 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400">Warning Email</span>
                          <span className="text-[10px] text-slate-400">Draft warning notice</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSend("Check the entire database for bugs, duplicate usernames, and unverified profiles")}
                          className="p-3 rounded-xl bg-slate-50 dark:bg-navy-900 hover:bg-emerald-50/60 dark:hover:bg-navy-800 border border-slate-200 dark:border-navy-700 hover:border-emerald-300 dark:hover:border-emerald-700 transition-all text-left flex flex-col group cursor-pointer shadow-xs active:scale-98"
                        >
                          <Activity className="w-4 h-4 text-emerald-500 mb-1.5 group-hover:scale-110 transition-transform" />
                          <span className="text-[11.5px] font-bold text-slate-800 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400">Database Audit</span>
                          <span className="text-[10px] text-slate-400">563 active records</span>
                        </button>
                      </motion.div>
                    </div>
                  ) : (
                    <div className="p-4 space-y-4">
                      <AnimatePresence initial={false}>
                        {messages.filter(m => !m.id.startsWith('welcome_')).map((msg) => (
                          <motion.div key={msg.id}
                            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.18, ease: 'easeOut' }}
                            className={`flex items-end gap-2.5 ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                          >
                            {/* Avatar */}
                            {msg.sender === 'ai' && (
                              <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center shrink-0 mb-5 shadow-sm">
                                <Bot className="w-3 h-3 text-white" />
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
                                  <span className={`px-1.5 py-px rounded text-[9px] font-mono font-bold border ${msg.dataStatus === 'VERIFIED'
                                      ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                                      : msg.dataStatus === 'DATA_UNAVAILABLE' || msg.isError
                                        ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800'
                                        : 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                                    }`}>{msg.dataStatus}</span>
                                )}
                              </div>

                              {/* Bubble */}
                              <div className={`px-3.5 py-3 rounded-2xl shadow-sm ${msg.sender === 'user'
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
                                {msg.isThinking ? (
                                  <div className="flex items-center gap-1 py-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                                  </div>
                                ) : msg.sender === 'user'
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

                                {/* Clarification Choice Chips */}
                                {msg.clarifyingOptions && msg.clarifyingOptions.length > 0 && (
                                  <div className="mt-3 pt-2 border-t border-slate-200 dark:border-navy-800 space-y-1.5">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Select Clarification Metric:</p>
                                    <div className="flex flex-wrap gap-1.5">
                                      {msg.clarifyingOptions.map((opt, i) => (
                                        <button
                                          key={i}
                                          type="button"
                                          onClick={() => handleSend(`Show top students by ${opt}`)}
                                          className="px-2.5 py-1 rounded-lg bg-brand-500/10 hover:bg-brand-500/20 text-brand-600 dark:text-brand-300 font-bold text-[10.5px] border border-brand-500/30 transition-all cursor-pointer shadow-xs"
                                        >
                                          {opt}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* PDF Download Button */}
                                {msg.pdfAvailable && (
                                  <div className="mt-3 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-extrabold text-[11px]">
                                      <FileText className="w-4 h-4 text-emerald-500" />
                                      <span>Official PDF Report</span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        try {
                                          const endpoint = msg.downloadUrl || '/reports/export/summary-pdf';
                                          await downloadManager.download({
                                            endpoint,
                                            filename: 'NEC_Institutional_Summary_Report.pdf',
                                            mimeType: 'application/pdf',
                                          });
                                        } catch (e) {
                                          console.error('Failed to download report PDF:', e);
                                        }
                                      }}
                                      className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-sm transition-all cursor-pointer"
                                    >
                                      Download PDF
                                    </button>
                                  </div>
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

            {/* INPUT AREA / COMPOSER */}
            <div className="px-3 py-2 bg-white dark:bg-navy-950 border-t border-slate-200 dark:border-navy-800 shrink-0 space-y-1">
              <div className={`flex items-end gap-2 px-3 py-1.5 rounded-xl border transition-all duration-150 bg-slate-50 dark:bg-navy-900 ${loading
                  ? 'border-slate-200 dark:border-navy-700 opacity-70'
                  : 'border-slate-200 dark:border-navy-700 focus-within:border-brand-400 dark:focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-500/10'
                }`}>
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={input}
                  onChange={handleTextareaChange}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setIsOpen(false);
                    } else if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (!loading && input.trim()) {
                        handleSend();
                      }
                    }
                  }}
                  disabled={loading}
                  placeholder={activeMode === 'operations' ? 'Ask copilot — audit, email, contest compare…' : 'Ask about contest rankings, student stats…'}
                  aria-label="Ask AI assistant"
                  className="flex-1 bg-transparent text-[12.5px] font-medium text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none min-w-0 resize-none max-h-28 overflow-y-auto leading-relaxed py-1"
                />
                <button
                  type="button"
                  onClick={() => handleSend()}
                  disabled={loading || !input.trim()}
                  aria-label="Send message"
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mb-0.5 transition-all duration-150 ${!input.trim() || loading
                      ? 'bg-slate-100 dark:bg-navy-800 text-slate-300 dark:text-slate-600 cursor-not-allowed'
                      : 'bg-gradient-to-br from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white shadow-sm cursor-pointer active:scale-95'
                    }`}
                >
                  {loading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-400" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
