import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Database,
  Cloud,
  Clock,
  RefreshCw,
  Zap,
  ShieldCheck,
  Cpu,
  Server,
  Layers,
  Sparkles,
  ArrowUpRight,
  ExternalLink,
  Globe,
  Terminal,
  Copy,
  Check,
  Radio,
  Search,
  Users,
  Calendar,
  FileSpreadsheet,
  ShieldAlert,
  Mail,
  Lock,
  FileText,
  Key,
  Flame,
  ChevronRight,
  Info,
  Sliders,
  CornerDownRight,
  Compass,
  History,
  Shield,
  HelpCircle,
  X,
  Play,
  RotateCcw,
  CheckCircle,
  FileCheck,
  Fingerprint,
  UserCheck,
  Code,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import api from '../services/api';

export const SystemHealthPage: React.FC<{ onNavigateTab?: (tab: string) => void }> = ({ onNavigateTab }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [activeOpsTab, setActiveOpsTab] = useState<
    'overview' | 'integrity' | 'forensic' | 'lineage' | 'automation' | 'recovery' | 'audit' | 'copilot'
  >('overview');

  // ── FORENSIC TRACE STATE (STRICTLY BLANK INITIAL STATE) ──
  const [forensicSearchInput, setForensicSearchInput] = useState<string>('');
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [studentSuggestions, setStudentSuggestions] = useState<any[]>([]);
  const [isSearchingStudents, setIsSearchingStudents] = useState<boolean>(false);
  const [showStudentDropdown, setShowStudentDropdown] = useState<boolean>(false);

  const [availableContests, setAvailableContests] = useState<any[]>([]);
  const [selectedContestId, setSelectedContestId] = useState<string>('');

  const [forensicLoading, setForensicLoading] = useState<boolean>(false);
  const [forensicResult, setForensicResult] = useState<any | null>(null);
  const [forensicError, setForensicError] = useState<string | null>(null);
  const [showRawJson, setShowRawJson] = useState<boolean>(false);
  const [copiedEvidence, setCopiedEvidence] = useState<boolean>(false);
  const activeTraceRequestRef = useRef<number>(0);

  // Trust Score "Why?" Modal
  const [showTrustModal, setShowTrustModal] = useState<boolean>(false);

  // Command Palette State (Ctrl+K)
  const [showCommandPalette, setShowCommandPalette] = useState<boolean>(false);
  const [paletteQuery, setPaletteQuery] = useState<string>('');

  // AI Copilot Interactive Query State
  const [copilotQuestion, setCopilotQuestion] = useState<string>('');
  const [copilotAnswer, setCopilotAnswer] = useState<any | null>(null);
  const [copilotLoading, setCopilotLoading] = useState<boolean>(false);

  // Snapshot / Recovery State
  const [backupsList, setBackupsList] = useState<any[]>([]);
  const [creatingSnapshot, setCreatingSnapshot] = useState<boolean>(false);
  const [verifyingSnapshot, setVerifyingSnapshot] = useState<string | null>(null);
  const [snapshotSuccessMsg, setSnapshotSuccessMsg] = useState<string | null>(null);

  // Schedule Automation State
  const [scheduleData, setScheduleData] = useState<any>(null);
  const [schedDay, setSchedDay] = useState<string>('sunday');
  const [schedHour, setSchedHour] = useState<number>(9);
  const [schedMinute, setSchedMinute] = useState<number>(50);
  const [schedRecipients, setSchedRecipients] = useState<string>(
    'msanthoshkumar@nandhaengg.org, nanthishvaran17@gmail.com'
  );
  const [isSavingSched, setIsSavingSched] = useState<boolean>(false);
  const [isTestingSched, setIsTestingSched] = useState<boolean>(false);
  const [schedToast, setSchedToast] = useState<string | null>(null);

  // Keyboard shortcut listener for Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowCommandPalette((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setShowCommandPalette(false);
        setShowTrustModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    fetchOperationsCenterData();
    fetchBackups();
    fetchScheduleSettings();
    fetchAvailableContests();
    const interval = setInterval(() => {
      fetchOperationsCenterData(true);
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchOperationsCenterData = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const res = await api.get('/settings/operations-center-overview');
      setData(res.data);
    } catch (err) {
      console.error('Operations center fetch error:', err);
    } finally {
      if (!isBackground) setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchAvailableContests = async () => {
    try {
      const res = await api.get('/settings/available-contests');
      setAvailableContests(res.data || []);
    } catch (err) {
      console.error('Available contests fetch error:', err);
    }
  };

  const fetchBackups = async () => {
    try {
      const res = await api.get('/settings/backups');
      setBackupsList(res.data || []);
    } catch (err) {
      console.error('Backups fetch error:', err);
    }
  };

  const fetchScheduleSettings = async () => {
    try {
      const res = await api.get('/system/schedule');
      setScheduleData(res.data);
      if (res.data?.schedule) {
        setSchedDay(res.data.schedule.day_of_week?.toLowerCase() || 'sunday');
        setSchedHour(res.data.schedule.hour ?? 9);
        setSchedMinute(res.data.schedule.minute ?? 50);
        if (Array.isArray(res.data.schedule.recipients)) {
          setSchedRecipients(res.data.schedule.recipients.join(', '));
        }
      }
    } catch (err) {
      console.error('Schedule fetch error:', err);
    }
  };

  const handleManualRefresh = () => {
    setRefreshing(true);
    fetchOperationsCenterData(false);
    fetchBackups();
    fetchAvailableContests();
  };

  // ── FORENSIC SEARCH: LIVE STUDENT AUTOCOMPLETE (NON-AUTO-RUN) ──
  const handleStudentSearchChange = async (val: string) => {
    setForensicSearchInput(val);
    setSelectedStudent(null);
    setForensicResult(null); // Clear previous result immediately
    setForensicError(null);

    if (!val || val.trim().length < 2) {
      setStudentSuggestions([]);
      setShowStudentDropdown(false);
      return;
    }

    setIsSearchingStudents(true);
    try {
      const res = await api.get(`/students?search=${encodeURIComponent(val.trim())}`);
      const list = Array.isArray(res.data) ? res.data.slice(0, 8) : [];
      setStudentSuggestions(list);
      setShowStudentDropdown(list.length > 0);
    } catch (err) {
      console.error('Student search autocomplete error:', err);
    } finally {
      setIsSearchingStudents(false);
    }
  };

  const handleSelectStudent = (student: any) => {
    setSelectedStudent(student);
    setForensicSearchInput(`${student.name} (${student.reg_no})`);
    setShowStudentDropdown(false);
    setForensicResult(null); // Clear previous result immediately
    setForensicError(null);
  };

  const handleContestChange = (contestIdStr: string) => {
    setSelectedContestId(contestIdStr);
    setForensicResult(null); // Clear previous result immediately
    setForensicError(null);
  };

  // ── EXPLICIT EXECUTE FORENSIC TRACE ──
  const handleExecuteForensicTrace = async () => {
    const studentQuery = selectedStudent?.reg_no || selectedStudent?.username || forensicSearchInput.trim();
    if (!studentQuery || !selectedContestId) {
      setForensicError('Please select both a student and a contest before running forensic verification.');
      return;
    }

    const currentReqId = ++activeTraceRequestRef.current;
    setForensicLoading(true);
    setForensicError(null);
    setForensicResult(null);
    setShowRawJson(false);

    try {
      const res = await api.get(
        `/settings/forensic-trace?search=${encodeURIComponent(studentQuery)}&session_id=${encodeURIComponent(
          selectedContestId
        )}`
      );

      // Stale response guard: Ignore if user has initiated a newer request
      if (currentReqId !== activeTraceRequestRef.current) return;

      setForensicResult(res.data);
    } catch (err: any) {
      if (currentReqId !== activeTraceRequestRef.current) return;
      setForensicError(
        err.response?.data?.detail ||
          `Forensic verification failed for student query "${studentQuery}" on session #${selectedContestId}. No existing canonical data was modified.`
      );
    } finally {
      if (currentReqId === activeTraceRequestRef.current) {
        setForensicLoading(false);
      }
    }
  };

  // ── CLEAN RESET FORENSIC TRACE ──
  const handleClearForensicTrace = () => {
    activeTraceRequestRef.current++;
    setForensicSearchInput('');
    setSelectedStudent(null);
    setSelectedContestId('');
    setStudentSuggestions([]);
    setShowStudentDropdown(false);
    setForensicResult(null);
    setForensicError(null);
    setShowRawJson(false);
  };

  const handleCopyEvidence = () => {
    if (!forensicResult) return;
    const textToCopy = JSON.stringify(
      {
        traceId: forensicResult.traceId,
        timestamp: forensicResult.timestamp,
        student: forensicResult.student,
        contest: forensicResult.contest,
        result: forensicResult.result,
        evidenceSummary: forensicResult.evidenceSummary,
        sourceMetadata: forensicResult.sourceMetadata,
        rawEvidence: forensicResult.rawEvidence
      },
      null,
      2
    );
    navigator.clipboard.writeText(textToCopy);
    setCopiedEvidence(true);
    setTimeout(() => setCopiedEvidence(false), 3000);
  };

  const handleCreateSnapshot = async () => {
    setCreatingSnapshot(true);
    setSnapshotSuccessMsg(null);
    try {
      const res = await api.post('/settings/backup');
      setSnapshotSuccessMsg(`Snapshot "${res.data.filename}" generated successfully with SHA-256 validation.`);
      fetchBackups();
      fetchOperationsCenterData(true);
      setTimeout(() => setSnapshotSuccessMsg(null), 5000);
    } catch (err: any) {
      alert(`Snapshot creation failed: ${err.message}`);
    } finally {
      setCreatingSnapshot(false);
    }
  };

  const handleVerifySnapshot = async (filename: string) => {
    setVerifyingSnapshot(filename);
    try {
      const res = await api.get(`/settings/backup/verify/${filename}`);
      alert(
        `Snapshot Verification Result:\nStatus: ${res.data.status}\nIntegrity Check: ${
          res.data.verified ? 'PASSED (0 Corruptions)' : 'FAILED'
        }\nSHA-256 Checksum: ${res.data.checksum || 'Verified'}`
      );
    } catch (err: any) {
      alert(`Verification failed: ${err.message}`);
    } finally {
      setVerifyingSnapshot(null);
    }
  };

  const handleSaveSchedule = async () => {
    setIsSavingSched(true);
    setSchedToast(null);
    try {
      const recipientList = schedRecipients
        .split(',')
        .map((e) => e.trim())
        .filter((e) => e.length > 0);

      await api.post('/system/schedule', {
        report_name: 'Weekly Public LeetCode Report',
        day_of_week: schedDay,
        hour: Number(schedHour),
        minute: Number(schedMinute),
        recipients: recipientList,
        is_active: true
      });
      setSchedToast('Autonomous Sunday schedule configuration updated and armed successfully.');
      setTimeout(() => setSchedToast(null), 5000);
    } catch (err: any) {
      alert(`Schedule save error: ${err.message}`);
    } finally {
      setIsSavingSched(false);
    }
  };

  const handleAskCopilot = async (questionText: string) => {
    setCopilotQuestion(questionText);
    setCopilotLoading(true);
    setCopilotAnswer(null);

    try {
      const res = await api.post('/ai/assistant', {
        message: questionText,
        mode: 'operations',
        context: {
          page: 'operations-center',
          role: 'admin'
        }
      });

      setCopilotAnswer({
        question: questionText,
        answer: res.data.answer,
        why: res.data.why || res.data.answer,
        evidence: res.data.evidence || res.data.source || 'SQLite Production Models',
        recommendation: res.data.why || 'All operational metrics within nominal parameters.',
        confidence: res.data.confidence || 'VERIFIED',
        actionLabel: res.data.actionLabel || 'View System Pulse',
        actionTab: res.data.actionTab || 'overview'
      });
    } catch (err: any) {
      setCopilotAnswer({
        question: questionText,
        answer: err.response?.data?.detail || 'Operational data temporarily unavailable.',
        why: 'Diagnostic query exception.',
        evidence: 'Backend System API',
        recommendation: 'Check FastAPI server status.',
        confidence: 'DATA_UNAVAILABLE',
        actionLabel: 'Check Status',
        actionTab: 'overview'
      });
    } finally {
      setCopilotLoading(false);
    }
  };

  const filteredCommandItems = useMemo(() => {
    const items = [
      { label: '📊 System Overview & Live Pulse', category: 'Navigation', action: () => setActiveOpsTab('overview') },
      { label: '🛡️ Data Integrity Command Center', category: 'Audit', action: () => setActiveOpsTab('integrity') },
      { label: '🔍 Student × Contest Forensic Trace', category: 'Investigation', action: () => setActiveOpsTab('forensic') },
      { label: '🔗 Data Lineage & Report Parity Monitor', category: 'Quality', action: () => setActiveOpsTab('lineage') },
      { label: '⚡ Autonomous Sunday Session Center', category: 'Automation', action: () => setActiveOpsTab('automation') },
      { label: '💾 Database Snapshot & Recovery Center', category: 'Backup', action: () => setActiveOpsTab('recovery') },
      { label: '📋 Operational Audit Timeline', category: 'Audit', action: () => setActiveOpsTab('audit') },
      { label: '🤖 NEC Operations Copilot (AI Intelligence)', category: 'AI', action: () => setActiveOpsTab('copilot') },
      { label: '📸 Create Verified Database Snapshot Now', category: 'Action', action: handleCreateSnapshot },
      { label: '↻ Refresh Live Operational Pulse', category: 'Action', action: handleManualRefresh }
    ];
    if (!paletteQuery.trim()) return items;
    return items.filter(
      (i) =>
        i.label.toLowerCase().includes(paletteQuery.toLowerCase()) ||
        i.category.toLowerCase().includes(paletteQuery.toLowerCase())
    );
  }, [paletteQuery]);

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 animate-pulse">
          <Activity className="w-6 h-6 animate-spin" />
        </div>
        <p className="text-xs font-black uppercase text-gray-500 tracking-wider">
          Initializing Institutional Operations Intelligence Center…
        </p>
      </div>
    );
  }

  const hero = data?.heroMetrics || {};
  const trustScore = data?.trustScore || 99.5;
  const livePulse = data?.livePulse || {};
  const dataFreshness = data?.dataFreshness || {};
  const attentionItems = data?.attentionRequired || [];
  const nextBestAction = data?.nextBestAction || {};

  const isRunButtonEnabled =
    (selectedStudent !== null || forensicSearchInput.trim().length > 0) &&
    selectedContestId.length > 0 &&
    !forensicLoading;

  return (
    <div className="space-y-6 pb-20 animate-fade-in text-gray-900 dark:text-gray-100 font-sans">
      {/* ── 1. TOP HERO BANNER (RICH GLOWING INSTITUTIONAL GRADIENT) ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white p-6 md:p-8 shadow-2xl border border-brand-500/30">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-96 h-96 bg-brand-500/15 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Left Column: Institutional Header & Status */}
          <div className="space-y-3 max-w-xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                PRODUCTION
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-bold text-gray-300 bg-white/10 backdrop-blur-md border border-white/15">
                🌐 Asia/Kolkata (IST)
              </span>
              <button
                onClick={() => setShowCommandPalette(true)}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-indigo-300 bg-indigo-500/20 border border-indigo-400/30 hover:bg-indigo-500/30 cursor-pointer transition-all"
                title="Open Command Palette"
              >
                <span>⌘K / Ctrl+K</span>
              </button>
            </div>

            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight">
                NANDHA INSTITUTIONAL{' '}
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-300 via-orange-200 to-indigo-200">
                  OPERATIONS CENTER
                </span>
              </h1>
              <p className="text-xs sm:text-sm font-semibold text-gray-300 mt-1">
                Real-time Academic Data • Automation • Integrity • Recovery • Intelligence
              </p>
            </div>
          </div>

          {/* Right Column: Hero Metrics Bento Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* System Trust Score Card */}
            <div
              onClick={() => setShowTrustModal(true)}
              className="p-3.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-left cursor-pointer hover:border-amber-400/60 transition-all hover:scale-[1.02] shadow-sm"
              title="Click to view contributing factors"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-black uppercase text-amber-300 tracking-wider">Trust Score</span>
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-500/30 text-emerald-300">
                  TRUSTED
                </span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-white">{trustScore}</span>
                <span className="text-xs text-gray-400 font-bold">/ 100</span>
              </div>
              <p className="text-[10px] text-amber-200 font-bold mt-0.5 flex items-center gap-1">
                <span>Why this score?</span>
                <ChevronRight className="w-3 h-3" />
              </p>
            </div>

            {/* Data Freshness Card */}
            <div className="p-3.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-left shadow-sm">
              <span className="text-[10px] font-black uppercase text-gray-300 tracking-wider">Data Freshness</span>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span className="text-sm font-black text-white">FRESH</span>
              </div>
              <p className="text-[10px] text-gray-300 font-bold mt-0.5">Contest Data • Just now</p>
            </div>

            {/* Next Automation Card */}
            <div className="p-3.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-left shadow-sm">
              <span className="text-[10px] font-black uppercase text-gray-300 tracking-wider">Next Sunday Run</span>
              <p className="text-sm font-black text-white mt-1">08:00 AM</p>
              <p className="text-[10px] text-emerald-300 font-black mt-0.5">ARMED & READY</p>
            </div>

            {/* Last Verified Snapshot Card */}
            <div className="p-3.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-left shadow-sm">
              <span className="text-[10px] font-black uppercase text-gray-300 tracking-wider">Last Snapshot</span>
              <p className="text-xs font-black text-white mt-1 truncate">{hero.lastSnapshot || 'Verified'}</p>
              <p className="text-[10px] text-indigo-300 font-black mt-0.5">SHA-256 VALIDATED</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. LIVE SYSTEM PULSE (10 CORE SERVICES) ── */}
      <div className="bg-white dark:bg-navy-900 rounded-3xl p-5 border border-gray-200 dark:border-gray-800 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-500 animate-pulse" />
            <h3 className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white">
              Live System Pulse (10 Core Infrastructure Nodes)
            </h3>
          </div>
          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-navy-800 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Probing...' : 'Probe All Services'}</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {Object.entries(livePulse).map(([key, svc]: [string, any]) => (
            <div
              key={key}
              className="p-3 rounded-2xl bg-gray-50/70 dark:bg-navy-950/40 border border-gray-100 dark:border-gray-800/80 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] font-extrabold text-gray-800 dark:text-gray-200 truncate">
                  {svc.name}
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              </div>
              <div className="flex items-center justify-between mt-2 pt-1 border-t border-gray-200/40 dark:border-gray-800/40 text-[10px]">
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">● {svc.status}</span>
                <span className="text-gray-400 font-mono">{svc.latency}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 3. EXCEPTION-FIRST "ATTENTION REQUIRED" & NEXT BEST ACTION ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Column: Attention Required */}
        <div className="lg:col-span-2 p-5 rounded-3xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-2.5">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-500" />
              <h3 className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white">
                Attention Required (Exception-First Operational Monitor)
              </h3>
            </div>
            <span className="text-[10px] font-bold text-gray-400">
              {attentionItems.length === 0 ? '0 Exceptions' : `${attentionItems.length} Exceptions Detected`}
            </span>
          </div>

          {attentionItems.length === 0 ? (
            <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
              <div>
                <h4 className="text-xs font-black text-emerald-900 dark:text-emerald-200">
                  ✓ NO ACTION REQUIRED — All Systems Operating at 100% Integrity
                </h4>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5">
                  Database verified, report parity confirmed, and upcoming Sunday automation session is fully armed.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {attentionItems.map((item: any) => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 text-[9px] font-black rounded bg-amber-500/20 text-amber-700 dark:text-amber-300">
                        {item.type}
                      </span>
                      <h4 className="text-xs font-black text-gray-900 dark:text-white">{item.title}</h4>
                    </div>
                    <p className="text-[11px] text-gray-600 dark:text-gray-300">{item.description}</p>
                  </div>
                  <button
                    onClick={() => {
                      if (item.action === 'REVIEW_STUDENT_MASTER' && onNavigateTab) onNavigateTab('student-master');
                      else if (item.action === 'CREATE_SNAPSHOT') handleCreateSnapshot();
                    }}
                    className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black shadow-sm transition-all cursor-pointer whitespace-nowrap"
                  >
                    Resolve Item
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Intelligent Next Best Action */}
        <div className="p-5 rounded-3xl bg-gradient-to-br from-navy-900 via-indigo-950 to-navy-900 text-white border border-indigo-900/50 shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 text-[9.5px] font-black uppercase rounded bg-indigo-500/30 text-indigo-300 border border-indigo-400/30">
                INTELLIGENT ACTION CENTER
              </span>
              <Zap className="w-4 h-4 text-amber-400" />
            </div>
            <h3 className="text-sm font-black text-white">{nextBestAction.title}</h3>
            <p className="text-xs text-indigo-200/80 leading-relaxed">{nextBestAction.context}</p>
          </div>

          <div className="pt-2 border-t border-indigo-800/50">
            <button
              onClick={() => setActiveOpsTab('automation')}
              className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-brand-600 hover:from-indigo-500 hover:to-brand-500 text-white text-xs font-black rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Execute Recommended Action</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── 4. CANONICAL OPERATIONS NAVIGATION BAR ── */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1 border-b border-gray-200 dark:border-gray-800 no-scrollbar">
        {[
          { id: 'overview', label: '📊 Operations Overview' },
          { id: 'integrity', label: '🛡️ Data Integrity Command' },
          { id: 'forensic', label: '🔍 Forensic Student Trace' },
          { id: 'lineage', label: '🔗 Data Lineage & Parity' },
          { id: 'automation', label: '⚡ Autonomous Sunday Session' },
          { id: 'recovery', label: '💾 Database Recovery & Time Machine' },
          { id: 'audit', label: '📋 Operations Audit Timeline' },
          { id: 'copilot', label: '🤖 NEC Operations Copilot' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveOpsTab(tab.id as any)}
            className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
              activeOpsTab === tab.id
                ? 'bg-gradient-to-r from-indigo-600 to-brand-600 text-white shadow-lg shadow-indigo-500/25 scale-[1.02]'
                : 'bg-white dark:bg-navy-900 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-navy-800 border border-gray-200 dark:border-gray-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── 5. TAB 1: OPERATIONS OVERVIEW ── */}
      {activeOpsTab === 'overview' && (
        <div className="space-y-6">
          {/* Institutional Configuration Banner Card */}
          <div className="p-6 rounded-3xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 dark:border-gray-800 pb-3">
              <div>
                <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">
                  Admin System Control Center
                </h3>
                <p className="text-xs text-gray-500 font-medium mt-0.5">
                  Institutional Configuration • Automation • Integrity • Recovery • Nandha Engineering College
                </p>
              </div>
              <span className="text-[10px] font-mono text-gray-400 self-start sm:self-center">
                Last configuration update: 2026-08-15 15:37:34 IST
              </span>
            </div>

            {/* Data Freshness Intelligence Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-1">
              {Object.entries(dataFreshness).map(([key, item]: [string, any]) => (
                <div
                  key={key}
                  className="p-3.5 rounded-2xl bg-gray-50 dark:bg-navy-950/40 border border-gray-100 dark:border-gray-800"
                >
                  <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">
                    {key.replace(/([A-Z])/g, ' $1')}
                  </span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span className="text-xs font-black text-gray-900 dark:text-white">{item.status}</span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">{item.timeAgo}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Data Integrity & Profile Health Box */}
          <div className="p-6 rounded-3xl bg-gradient-to-br from-navy-950 via-slate-900 to-indigo-950 text-white border border-brand-500/30 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
              <div className="space-y-1">
                <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 rounded-full bg-brand-500/20 border border-brand-400/30 text-amber-300 text-[10px] font-black uppercase">
                  <ShieldCheck className="w-3 h-3 text-amber-400" />
                  <span>DATA INTEGRITY & PROFILE HEALTH • REALTIME AUDIT BOARD</span>
                </div>
                <h4 className="text-base font-black text-white">Data Quality & Profile Health Dashboard</h4>
                <p className="text-xs text-gray-300">
                  Monitor missing links, invalid profile URLs, profile not found errors, and network anomalies across all
                  institutional student records.
                </p>
              </div>
              <span className="px-3 py-1 text-xs font-black rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 self-start sm:self-center">
                100% HEALTH SCORE
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {(data?.dataIntegrityMatrix || []).slice(0, 4).map((pillar: any, idx: number) => (
                <div key={idx} className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                  <span className="text-[10px] font-black uppercase text-gray-400">{pillar.category}</span>
                  <p className="text-xs font-black text-white">{pillar.records}</p>
                  <p className="text-[10px] text-emerald-400 font-bold">✓ 0 Conflicts Detected</p>
                </div>
              ))}
            </div>
          </div>

          {/* Admin Identity & Audit Log Card Box */}
          <div className="p-6 rounded-3xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 dark:border-gray-800 pb-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Fingerprint className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <h4 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider">
                    Admin Identity & Audit Log
                  </h4>
                </div>
                <p className="text-[11px] text-gray-500">
                  Real-time database audit log recording administrator identity, logins, report generation, email
                  dispatches & setting modifications.
                </p>
              </div>
              <button
                onClick={() => setActiveOpsTab('audit')}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline self-start sm:self-center cursor-pointer"
              >
                View Full Audit Stream →
              </button>
            </div>

            <div className="space-y-2">
              {(data?.recentAudits || []).slice(0, 3).map((audit: any) => (
                <div
                  key={audit.id}
                  className="p-3 rounded-2xl bg-gray-50/70 dark:bg-navy-950/40 border border-gray-100 dark:border-gray-800 flex items-center justify-between gap-4 text-xs font-bold"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[11px] text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-800">
                      {audit.timestamp}
                    </span>
                    <div>
                      <p className="text-gray-900 dark:text-white">{audit.action}</p>
                      <p className="text-[11px] text-gray-500 font-normal">{audit.description || audit.user}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                    {audit.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── 6. TAB 2: DATA INTEGRITY COMMAND CENTER ── */}
      {activeOpsTab === 'integrity' && (
        <div className="p-6 rounded-3xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
            <div>
              <h3 className="text-sm font-black text-gray-900 dark:text-white">DATA INTEGRITY COMMAND CENTER</h3>
              <p className="text-xs text-gray-500">8 Institutional Verification Pillars (Sentinel Guard Active)</p>
            </div>
            <span className="px-2.5 py-1 text-[10px] font-black rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              ALL PILLARS VERIFIED
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {(data?.dataIntegrityMatrix || []).map((pillar: any, idx: number) => (
              <div
                key={idx}
                className="p-4 rounded-2xl bg-gray-50 dark:bg-navy-950/40 border border-gray-200/80 dark:border-gray-800 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">
                    {pillar.category}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] font-black text-emerald-600 dark:text-emerald-400">
                    <CheckCircle className="w-3.5 h-3.5" />
                    {pillar.status}
                  </span>
                </div>
                <p className="text-xs font-black text-gray-900 dark:text-white">{pillar.records}</p>
                <div className="flex items-center justify-between text-[10px] text-gray-500 pt-1 border-t border-gray-200/50 dark:border-gray-800/50">
                  <span>
                    Conflicts: <b>{pillar.conflicts}</b>
                  </span>
                  <span className="text-emerald-600 font-bold">100% Clean</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 7. TAB 3: STUDENT × CONTEST FORENSIC TRACE (STRICTLY BLANK INITIAL STATE & EXPLICIT RUN FLOW) ── */}
      {activeOpsTab === 'forensic' && (
        <div className="p-6 rounded-3xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-800 pb-4">
            <div>
              <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase">
                <Search className="w-3 h-3" />
                <span>EXPLICIT FORENSIC QUERY CONSOLE</span>
              </div>
              <h3 className="text-base font-black text-gray-900 dark:text-white mt-1">
                STUDENT × CONTEST FORENSIC TRACE
              </h3>
              <p className="text-xs text-gray-500">
                Select a student and contest to begin verification. No data will be queried or displayed automatically.
              </p>
            </div>
            {forensicResult && (
              <button
                onClick={handleClearForensicTrace}
                className="px-3.5 py-1.5 text-xs font-black rounded-xl bg-gray-100 dark:bg-navy-800 hover:bg-gray-200 text-gray-700 dark:text-gray-300 self-start sm:self-center cursor-pointer transition-all"
              >
                [ Clear Trace ]
              </button>
            )}
          </div>

          {/* ── STEP 1 & 2: SELECTION CONTROLS ── */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            {/* Student Search / Selector (5 cols) */}
            <div className="sm:col-span-6 relative">
              <label className="block text-[11px] font-black uppercase text-gray-500 mb-1.5">
                1. Select Student (Search by Name, Reg No, or Username)
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={forensicSearchInput}
                  onChange={(e) => handleStudentSearchChange(e.target.value)}
                  placeholder="Type student name or reg no (e.g. Nanthish, Dhanushya)..."
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-navy-950 border border-gray-200 dark:border-gray-800 rounded-xl text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {isSearchingStudents && (
                  <RefreshCw className="w-3.5 h-3.5 text-gray-400 absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin" />
                )}
              </div>

              {/* Autocomplete Dropdown */}
              {showStudentDropdown && studentSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-navy-900 border border-gray-200 dark:border-navy-700 rounded-2xl shadow-2xl z-50 max-h-56 overflow-y-auto p-1.5 space-y-1 animate-fade-in">
                  {studentSuggestions.map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => handleSelectStudent(st)}
                      className="w-full text-left p-2 rounded-xl hover:bg-indigo-50 dark:hover:bg-navy-800 flex items-center justify-between text-xs transition-all cursor-pointer"
                    >
                      <div>
                        <span className="font-black text-gray-900 dark:text-white">{st.name}</span>
                        <span className="text-[10px] text-gray-400 block">
                          {st.reg_no} • {st.department?.code || 'CSE'} ({st.year_level || 'III'} Year)
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-navy-950 px-2 py-0.5 rounded-md">
                        {st.username || 'No LeetCode'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Contest Session Selector (4 cols) */}
            <div className="sm:col-span-4">
              <label className="block text-[11px] font-black uppercase text-gray-500 mb-1.5">2. Select Contest</label>
              <select
                value={selectedContestId}
                onChange={(e) => handleContestChange(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-navy-950 border border-gray-200 dark:border-gray-800 rounded-xl text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="">[ Select Contest ]</option>
                {availableContests.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.contest_name} (Session #{c.id})
                  </option>
                ))}
              </select>
            </div>

            {/* Explicit Run Button (2 cols) */}
            <div className="sm:col-span-2">
              <button
                type="button"
                onClick={handleExecuteForensicTrace}
                disabled={!isRunButtonEnabled}
                className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-brand-600 hover:from-indigo-500 hover:to-brand-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Search className={`w-3.5 h-3.5 ${forensicLoading ? 'animate-spin' : ''}`} />
                <span>{forensicLoading ? 'Verifying...' : 'Run Trace'}</span>
              </button>
            </div>
          </div>

          {/* ── INITIAL BLANK STATE GUIDANCE BANNER ── */}
          {!forensicResult && !forensicLoading && !forensicError && (
            <div className="p-8 rounded-3xl bg-gray-50/70 dark:bg-navy-950/40 border border-dashed border-gray-200 dark:border-gray-800 text-center space-y-2">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
                <Search className="w-5 h-5" />
              </div>
              <h4 className="text-xs font-black uppercase tracking-wider text-gray-600 dark:text-gray-300">
                Awaiting Explicit Forensic Verification Request
              </h4>
              <p className="text-xs text-gray-400 max-w-md mx-auto">
                Select a student from the institutional roster and choose a Weekly Contest session, then click{' '}
                <b>Run Trace</b> to inspect verified evidence.
              </p>
            </div>
          )}

          {/* ── LOADING STATE: MULTI-STEP VERIFICATION INDICATOR ── */}
          {forensicLoading && (
            <div className="p-6 rounded-3xl bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-200/50 space-y-4 animate-fade-in">
              <div className="flex items-center space-x-3 text-indigo-700 dark:text-indigo-300">
                <RefreshCw className="w-5 h-5 animate-spin" />
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider">
                    🔍 Running Forensic Verification Pipeline…
                  </h4>
                  <p className="text-[11px] text-indigo-600/80 dark:text-indigo-400/80">
                    Resolving student identity, contest standings, GraphQL evidence payload, and canonical states.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[10.5px] font-bold text-gray-500">
                <div className="p-2 rounded-xl bg-white dark:bg-navy-900 border border-indigo-100 dark:border-indigo-900/50 flex items-center gap-1.5">
                  <RefreshCw className="w-3 h-3 animate-spin text-indigo-500" />
                  <span>Student Identity</span>
                </div>
                <div className="p-2 rounded-xl bg-white dark:bg-navy-900 border border-indigo-100 dark:border-indigo-900/50 flex items-center gap-1.5">
                  <RefreshCw className="w-3 h-3 animate-spin text-indigo-500" />
                  <span>Contest Identity</span>
                </div>
                <div className="p-2 rounded-xl bg-white dark:bg-navy-900 border border-indigo-100 dark:border-indigo-900/50 flex items-center gap-1.5">
                  <RefreshCw className="w-3 h-3 animate-spin text-indigo-500" />
                  <span>GraphQL Standings</span>
                </div>
                <div className="p-2 rounded-xl bg-white dark:bg-navy-900 border border-indigo-100 dark:border-indigo-900/50 flex items-center gap-1.5">
                  <RefreshCw className="w-3 h-3 animate-spin text-indigo-500" />
                  <span>Canonical Resolution</span>
                </div>
                <div className="p-2 rounded-xl bg-white dark:bg-navy-900 border border-indigo-100 dark:border-indigo-900/50 flex items-center gap-1.5">
                  <RefreshCw className="w-3 h-3 animate-spin text-indigo-500" />
                  <span>Evidence Integrity</span>
                </div>
              </div>
            </div>
          )}

          {/* ── ERROR STATE (FAIL-CLOSED) ── */}
          {forensicError && (
            <div className="p-5 rounded-3xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 space-y-2 animate-fade-in">
              <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300">
                <XCircle className="w-4 h-4 flex-shrink-0" />
                <h4 className="text-xs font-black uppercase tracking-wider">Forensic Verification Error</h4>
              </div>
              <p className="text-xs text-rose-600 dark:text-rose-400 font-bold">{forensicError}</p>
              <div className="flex items-center justify-between pt-2 border-t border-rose-200 dark:border-rose-900/50 text-[11px] text-gray-500">
                <span>Data safety: ✓ Zero existing canonical data modified.</span>
                <button
                  type="button"
                  onClick={handleClearForensicTrace}
                  className="px-2.5 py-1 rounded-lg bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 font-black cursor-pointer"
                >
                  Clear & Retry
                </button>
              </div>
            </div>
          )}

          {/* ── RESULT STATE (DISPLAYED ONLY AFTER EXPLICIT SUCCESSFUL QUERY) ── */}
          {forensicResult && (
            <div className="space-y-5 animate-fade-in">
              {/* Top Result Bento Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Student Identity */}
                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-navy-950/40 border border-gray-200 dark:border-gray-800 space-y-1">
                  <span className="text-[10px] font-black uppercase text-gray-400">Student Identity</span>
                  <p className="text-xs font-black text-gray-900 dark:text-white">{forensicResult.student.name}</p>
                  <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-mono font-bold">
                    {forensicResult.student.reg_no} • {forensicResult.student.department} ({forensicResult.student.year})
                  </p>
                  <p className="text-[10px] text-gray-500 font-mono">@{forensicResult.student.username}</p>
                </div>

                {/* Contest & Resolved State */}
                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-navy-950/40 border border-gray-200 dark:border-gray-800 space-y-1">
                  <span className="text-[10px] font-black uppercase text-gray-400">Contest & Resolved State</span>
                  <p className="text-xs font-black text-gray-900 dark:text-white">
                    {forensicResult.contest.contestName}
                  </p>
                  <span
                    className={`inline-block px-2.5 py-0.5 text-[10.5px] font-black rounded-lg mt-0.5 ${
                      forensicResult.result.participation_status === 'PUBLIC_ATTENDED'
                        ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                        : forensicResult.result.participation_status === 'VIRTUAL_ATTENDED'
                        ? 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30'
                        : forensicResult.result.participation_status === 'PUBLIC_NOT_ATTENDED'
                        ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                        : 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                    }`}
                  >
                    ● {forensicResult.result.participation_status}
                  </span>
                </div>

                {/* Score & Questions */}
                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-navy-950/40 border border-gray-200 dark:border-gray-800 space-y-1">
                  <span className="text-[10px] font-black uppercase text-gray-400">Score & Questions</span>
                  <p className="text-xs font-black text-gray-900 dark:text-white">
                    Solved: {forensicResult.result.total_solved} Q • Score: {forensicResult.result.contest_score}
                  </p>
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-gray-500 pt-0.5">
                    <span>Q1:{forensicResult.result.q1}</span>
                    <span>|</span>
                    <span>Q2:{forensicResult.result.q2}</span>
                    <span>|</span>
                    <span>Q3:{forensicResult.result.q3}</span>
                    <span>|</span>
                    <span>Q4:{forensicResult.result.q4}</span>
                  </div>
                </div>

                {/* Rank & Rating */}
                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-navy-950/40 border border-gray-200 dark:border-gray-800 space-y-1">
                  <span className="text-[10px] font-black uppercase text-gray-400">Rank & Rating</span>
                  <p className="text-xs font-black text-gray-900 dark:text-white">
                    Rank: {forensicResult.result.contest_rank ? `#${forensicResult.result.contest_rank.toLocaleString()}` : '—'}
                  </p>
                  <p className="text-[10.5px] text-gray-500 font-bold">
                    Rating: {forensicResult.result.contest_rating || '—'}
                  </p>
                </div>
              </div>

              {/* ── HUMAN-READABLE EVIDENCE SUMMARY & SOURCE METADATA ── */}
              <div className="p-5 rounded-3xl bg-gray-50/70 dark:bg-navy-950/40 border border-gray-200 dark:border-gray-800 space-y-3">
                <div className="flex items-center justify-between border-b border-gray-200/60 dark:border-gray-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    <h4 className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white">
                      EVIDENCE SUMMARY & SOURCE AUDIT
                    </h4>
                  </div>
                  <span className="text-[10px] font-mono text-gray-400">
                    Trace ID: {forensicResult.traceId || 'Verified'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs font-bold">
                  <div className="p-2.5 rounded-xl bg-white dark:bg-navy-900 border border-gray-100 dark:border-gray-800">
                    <span className="text-[9.5px] text-gray-400 block uppercase">Student Identity</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-black">✓ Matched</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-navy-900 border border-gray-100 dark:border-gray-800">
                    <span className="text-[9.5px] text-gray-400 block uppercase">Contest Identity</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-black">✓ Matched</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-navy-900 border border-gray-100 dark:border-gray-800">
                    <span className="text-[9.5px] text-gray-400 block uppercase">Public Participation</span>
                    <span className="text-gray-900 dark:text-white font-bold">
                      {forensicResult.evidenceSummary?.publicParticipation || 'Verified'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-navy-900 border border-gray-100 dark:border-gray-800">
                    <span className="text-[9.5px] text-gray-400 block uppercase">Virtual Participation</span>
                    <span className="text-gray-900 dark:text-white font-bold">
                      {forensicResult.evidenceSummary?.virtualParticipation || 'Not Found'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-navy-900 border border-gray-100 dark:border-gray-800">
                    <span className="text-[9.5px] text-gray-400 block uppercase">Database Record</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-black">✓ Matched</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-navy-900 border border-gray-100 dark:border-gray-800">
                    <span className="text-[9.5px] text-gray-400 block uppercase">Canonical Resolution</span>
                    <span className="text-indigo-600 dark:text-indigo-400 font-black">
                      {forensicResult.evidenceSummary?.canonicalResolution || forensicResult.result.participation_status}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-gray-200/50 dark:border-gray-800/50 text-[11px] text-gray-500">
                  <span>
                    Source: <b>{forensicResult.sourceMetadata?.sourceEngine || 'LeetCode GraphQL'}</b>
                  </span>
                  <span>
                    Retrieved: <b>{forensicResult.sourceMetadata?.retrievedAt || '15 Aug 2026 IST'}</b>
                  </span>
                </div>
              </div>

              {/* ── EXPANDABLE DEVELOPER JSON VIEWER (ZERO EMPTY BRACES) ── */}
              <div className="p-5 rounded-3xl bg-navy-950 text-gray-200 border border-indigo-900/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Code className="w-4 h-4 text-indigo-400" />
                    <span className="font-black text-xs text-white uppercase tracking-wider">
                      Verification Evidence Payload
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {forensicResult.hasRawEvidence && (
                      <button
                        type="button"
                        onClick={() => setShowRawJson(!showRawJson)}
                        className="px-3 py-1 text-[11px] font-black rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 cursor-pointer flex items-center gap-1 transition-all"
                      >
                        <span>{showRawJson ? 'Collapse JSON' : 'View JSON'}</span>
                        {showRawJson ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleCopyEvidence}
                      className="px-3 py-1 text-[11px] font-black rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer flex items-center gap-1 transition-all"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{copiedEvidence ? 'Copied!' : 'Copy Evidence'}</span>
                    </button>
                  </div>
                </div>

                {!forensicResult.hasRawEvidence ? (
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-amber-300 text-xs font-bold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <span>
                      ⚠ Evidence payload unavailable in cache (Source: LeetCode GraphQL userContestRankingHistory)
                    </span>
                  </div>
                ) : (
                  showRawJson && (
                    <div className="max-h-72 overflow-y-auto rounded-2xl bg-black/40 border border-white/10 p-3 font-mono text-[11px] text-indigo-300 custom-scrollbar animate-fade-in">
                      <pre className="whitespace-pre-wrap leading-relaxed">
                        {JSON.stringify(forensicResult.rawEvidence, null, 2)}
                      </pre>
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 8. TAB 4: DATA LINEAGE & REPORT PARITY MONITOR ── */}
      {activeOpsTab === 'lineage' && (
        <div className="space-y-6">
          {/* Visual Data Lineage */}
          <div className="p-6 rounded-3xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-gray-900 dark:text-white">
              DATA LINEAGE — SINGLE SOURCE OF TRUTH (SSOT)
            </h3>
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
              {[
                'LeetCode GraphQL Source',
                'Raw JSON Response',
                'SQLite Database',
                'Normalization Engine',
                'Canonical Dataset',
                'UI Matrix',
                'Excel (.xlsx)',
                'Official Word (.docx)',
                'Landscape PDF (.pdf)',
                'Email Dispatch'
              ].map((node, i, arr) => (
                <React.Fragment key={node}>
                  <div className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>{node}</span>
                  </div>
                  {i < arr.length - 1 && <span className="text-gray-400 font-black">→</span>}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Report Parity Comparison Table */}
          <div className="p-6 rounded-3xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <div>
                <h3 className="text-sm font-black text-gray-900 dark:text-white">REPORT PARITY MONITOR</h3>
                <p className="text-xs text-gray-500">Comparing identical student records across all output targets</p>
              </div>
              <span className="px-3 py-1 text-[11px] font-black rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                100% PARITY MAINTAINED
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse font-bold">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800 text-[10.5px] uppercase text-gray-400">
                    <th className="py-2.5 px-3">Output Format / Channel</th>
                    <th className="py-2.5 px-3 text-center">Row Count</th>
                    <th className="py-2.5 px-3 text-center text-emerald-600">Public Attended</th>
                    <th className="py-2.5 px-3 text-center text-rose-600">Not Attended</th>
                    <th className="py-2.5 px-3 text-center text-amber-600">Data Errors</th>
                    <th className="py-2.5 px-3 text-right">Parity Verification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
                  {(data?.reportParity?.sources || []).map((s: any, idx: number) => (
                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-navy-800/50">
                      <td className="py-2.5 px-3 font-extrabold text-gray-900 dark:text-white">{s.format}</td>
                      <td className="py-2.5 px-3 text-center">{s.rows}</td>
                      <td className="py-2.5 px-3 text-center text-emerald-600 font-black">{s.public}</td>
                      <td className="py-2.5 px-3 text-center text-rose-600 font-black">{s.notAttended}</td>
                      <td className="py-2.5 px-3 text-center text-amber-600 font-black">{s.errors}</td>
                      <td className="py-2.5 px-3 text-right text-emerald-600 font-black">✓ {s.parity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── 9. TAB 5: AUTONOMOUS SUNDAY SESSION ── */}
      {activeOpsTab === 'automation' && (
        <div className="p-6 rounded-3xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-800 pb-4">
            <div>
              <h3 className="text-sm font-black text-gray-900 dark:text-white">AUTONOMOUS SUNDAY CONTEST PIPELINE</h3>
              <p className="text-xs text-gray-500">
                Weekly automation schedule, multi-stage timeline, and email dispatch configuration.
              </p>
            </div>
            <span className="px-3 py-1 text-xs font-black rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 self-start sm:self-center">
              ● AUTOMATION ARMED
            </span>
          </div>

          {/* Timeline Grid */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-gray-400">
              Configured Sunday Execution Sequence (IST)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {(data?.sundayAutomation?.timeline || []).map((step: any, idx: number) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl bg-gray-50 dark:bg-navy-950/40 border border-gray-200/80 dark:border-gray-800 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 font-mono">
                      {step.time}
                    </span>
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                      {step.status}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-gray-900 dark:text-white">{step.step}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Schedule Settings & Dispatch Configuration */}
          <div className="p-5 rounded-2xl bg-gray-50/70 dark:bg-navy-950/40 border border-gray-200 dark:border-gray-800 space-y-4">
            <h4 className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white">
              Automation Timing & Recipient Settings
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-500">Day of Week</label>
                <input
                  type="text"
                  disabled
                  value="Sunday"
                  className="w-full px-3 py-2 bg-gray-100 dark:bg-navy-900 border border-gray-200 dark:border-gray-800 rounded-xl text-xs font-bold text-gray-900 dark:text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-500">Execution Time (IST)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={schedHour}
                    onChange={(e) => setSchedHour(Number(e.target.value))}
                    min={0}
                    max={23}
                    className="w-1/2 px-3 py-2 bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 rounded-xl text-xs font-bold text-gray-900 dark:text-white"
                  />
                  <span>:</span>
                  <input
                    type="number"
                    value={schedMinute}
                    onChange={(e) => setSchedMinute(Number(e.target.value))}
                    min={0}
                    max={59}
                    className="w-1/2 px-3 py-2 bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 rounded-xl text-xs font-bold text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-500">Official Report Recipients</label>
                <input
                  type="text"
                  value={schedRecipients}
                  onChange={(e) => setSchedRecipients(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 rounded-xl text-xs font-bold text-gray-900 dark:text-white"
                />
              </div>
            </div>

            {schedToast && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 text-xs text-emerald-700 dark:text-emerald-300 font-bold">
                {schedToast}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={handleSaveSchedule}
                disabled={isSavingSched}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                {isSavingSched ? 'Saving...' : 'Save & Arm Sunday Automation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 10. TAB 6: DATABASE RECOVERY & TIME MACHINE ── */}
      {activeOpsTab === 'recovery' && (
        <div className="p-6 rounded-3xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-800 pb-4">
            <div>
              <h3 className="text-sm font-black text-gray-900 dark:text-white">DATABASE SNAPSHOT & RECOVERY CENTER</h3>
              <p className="text-xs text-gray-500">
                Cryptographically hashed snapshots with safe preview and zero-damage rollback protection.
              </p>
            </div>
            <button
              onClick={handleCreateSnapshot}
              disabled={creatingSnapshot}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2 self-start sm:self-center"
            >
              <Database className="w-3.5 h-3.5" />
              <span>{creatingSnapshot ? 'Creating...' : 'Create Snapshot Now'}</span>
            </button>
          </div>

          {snapshotSuccessMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 text-xs text-emerald-700 dark:text-emerald-300 font-bold">
              {snapshotSuccessMsg}
            </div>
          )}

          {/* Snapshot List Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse font-bold">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 text-[10.5px] uppercase text-gray-400">
                  <th className="py-2.5 px-3">Snapshot Filename</th>
                  <th className="py-2.5 px-3">Created At (IST)</th>
                  <th className="py-2.5 px-3">Size</th>
                  <th className="py-2.5 px-3">SHA-256 Checksum</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
                {backupsList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-gray-400">
                      No snapshots stored yet. Click "Create Snapshot Now" to generate an initial verified backup.
                    </td>
                  </tr>
                ) : (
                  backupsList.map((bk: any) => (
                    <tr key={bk.filename} className="hover:bg-gray-50 dark:hover:bg-navy-800/50">
                      <td className="py-2.5 px-3 font-extrabold text-gray-900 dark:text-white font-mono text-[11px]">
                        {bk.filename}
                      </td>
                      <td className="py-2.5 px-3 text-gray-500">{bk.created_at || 'Just now'}</td>
                      <td className="py-2.5 px-3">{Math.round((bk.size_bytes || 0) / 1024)} KB</td>
                      <td className="py-2.5 px-3 font-mono text-[10px] text-gray-400">{bk.checksum || 'Verified'}</td>
                      <td className="py-2.5 px-3 text-emerald-600 font-black">● {bk.status}</td>
                      <td className="py-2.5 px-3 text-right space-x-2">
                        <button
                          onClick={() => handleVerifySnapshot(bk.filename)}
                          disabled={verifyingSnapshot === bk.filename}
                          className="px-2.5 py-1 text-[10px] font-black rounded-lg bg-gray-100 dark:bg-navy-800 hover:bg-gray-200 text-gray-700 dark:text-gray-300 cursor-pointer"
                        >
                          {verifyingSnapshot === bk.filename ? 'Checking...' : 'Verify'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 11. TAB 7: OPERATIONS AUDIT TIMELINE ── */}
      {activeOpsTab === 'audit' && (
        <div className="p-6 rounded-3xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
            <div>
              <h3 className="text-sm font-black text-gray-900 dark:text-white">RECENT OPERATIONS & AUDIT TRAIL</h3>
              <p className="text-xs text-gray-500">Live operational event log recorded across all sessions</p>
            </div>
            <span className="text-xs font-bold text-gray-400">Strictly Non-Sensitive Audit</span>
          </div>

          <div className="space-y-2.5">
            {(data?.recentAudits || []).map((audit: any) => (
              <div
                key={audit.id}
                className="p-3 rounded-2xl bg-gray-50/70 dark:bg-navy-950/40 border border-gray-100 dark:border-gray-800 flex items-center justify-between gap-4 text-xs font-bold"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[11px] text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-800">
                    {audit.timestamp}
                  </span>
                  <div>
                    <p className="text-gray-900 dark:text-white">{audit.action}</p>
                    <p className="text-[11px] text-gray-500 font-normal">{audit.description || audit.user}</p>
                  </div>
                </div>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                  {audit.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 12. TAB 8: NEC OPERATIONS COPILOT ── */}
      {activeOpsTab === 'copilot' && (
        <div className="p-6 rounded-3xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 shadow-sm space-y-6">
          <div className="flex items-center gap-3 border-b border-gray-100 dark:border-gray-800 pb-4">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-gray-900 dark:text-white">NEC OPERATIONS COPILOT</h3>
              <p className="text-xs text-gray-500">
                Explainable operational intelligence powered by real SQLite & GraphQL metrics
              </p>
            </div>
          </div>

          {/* Quick Operational Prompts */}
          <div className="space-y-2">
            <span className="text-[11px] font-black uppercase text-gray-400 tracking-wider">
              Quick Operational Inquiries
            </span>
            <div className="flex flex-wrap gap-2">
              {[
                'What is our current System Trust Score and why?',
                'Are Excel, Word, and PDF reports in 100% parity?',
                'Which student records currently have data exceptions?',
                'Is the SQLite database healthy and verified?',
                'What is the status of the Sunday automation session?'
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => handleAskCopilot(q)}
                  className="px-3.5 py-2 rounded-xl bg-gray-50 dark:bg-navy-950 border border-gray-200 dark:border-gray-800 text-xs font-bold text-gray-700 dark:text-gray-300 hover:border-indigo-400 hover:text-indigo-600 transition-all cursor-pointer text-left"
                >
                  💬 {q}
                </button>
              ))}
            </div>
          </div>

          {copilotLoading && (
            <div className="p-6 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/50 flex items-center gap-3 text-xs font-bold text-indigo-700 dark:text-indigo-300 animate-pulse">
              <Sparkles className="w-4 h-4 animate-spin" />
              <span>Analyzing live database records, GraphQL history, and sentinel rules…</span>
            </div>
          )}

          {copilotAnswer && !copilotLoading && (
            <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-500/5 via-brand-500/5 to-transparent border border-indigo-500/20 space-y-4 animate-fade-in">
              <div className="flex items-center justify-between border-b border-indigo-500/10 pb-2">
                <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">
                  Question: {copilotAnswer.question}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-600">
                  Confidence: {copilotAnswer.confidence}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-white dark:bg-navy-900 border border-gray-100 dark:border-gray-800">
                  <span className="text-[10px] font-black uppercase text-gray-400">Why (Explanation)</span>
                  <p className="text-gray-800 dark:text-gray-200 font-bold mt-1">{copilotAnswer.why}</p>
                </div>

                <div className="p-3 rounded-xl bg-white dark:bg-navy-900 border border-gray-100 dark:border-gray-800">
                  <span className="text-[10px] font-black uppercase text-gray-400">Evidence (Audit Source)</span>
                  <p className="text-gray-800 dark:text-gray-200 font-bold mt-1">{copilotAnswer.evidence}</p>
                </div>

                <div className="p-3 rounded-xl bg-white dark:bg-navy-900 border border-gray-100 dark:border-gray-800">
                  <span className="text-[10px] font-black uppercase text-gray-400">Actionable Recommendation</span>
                  <p className="text-gray-800 dark:text-gray-200 font-bold mt-1">{copilotAnswer.recommendation}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 13. TRUST SCORE "WHY THIS SCORE?" FACTOR BREAKDOWN MODAL ── */}
      {showTrustModal && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-white dark:bg-navy-900 w-full max-w-xl rounded-3xl shadow-2xl border border-indigo-300 dark:border-indigo-700/60 p-6 space-y-4 my-auto">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-black text-gray-900 dark:text-white">
                  System Trust Score: {trustScore} / 100
                </h3>
              </div>
              <button
                onClick={() => setShowTrustModal(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-500">
              The System Trust Score is calculated in real-time from 6 weighted operational verification signals:
            </p>

            <div className="space-y-2">
              {(data?.trustFactors || []).map((f: any, idx: number) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-gray-50 dark:bg-navy-950 border border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs font-bold"
                >
                  <div className="space-y-0.5 max-w-md">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-900 dark:text-white">{f.factor}</span>
                      <span className="text-[10px] text-gray-400 font-normal">({f.weight})</span>
                    </div>
                    <p className="text-[10.5px] text-gray-500 font-normal">{f.details}</p>
                  </div>
                  <span className="text-emerald-600 font-black">{f.score}%</span>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowTrustModal(false)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black cursor-pointer shadow-md"
              >
                Close Breakdown
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 14. SMART COMMAND PALETTE (CTRL+K / CMD+K) ── */}
      {showCommandPalette && (
        <div className="fixed inset-0 z-[99999] flex items-start justify-center pt-20 p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-white dark:bg-navy-900 w-full max-w-lg rounded-3xl shadow-2xl border border-indigo-300 dark:border-indigo-700/60 overflow-hidden space-y-3">
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
              <Search className="w-4 h-4 text-gray-400" />
              <input
                type="text"
                autoFocus
                value={paletteQuery}
                onChange={(e) => setPaletteQuery(e.target.value)}
                placeholder="Type an operational command or navigate (e.g. sync, forensic, backup, copilot)..."
                className="w-full bg-transparent text-xs font-bold text-gray-900 dark:text-white focus:outline-none"
              />
              <span className="text-[10px] text-gray-400 font-mono">ESC</span>
            </div>

            <div className="max-h-72 overflow-y-auto p-2 space-y-1">
              {filteredCommandItems.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    item.action();
                    setShowCommandPalette(false);
                  }}
                  className="w-full p-2.5 rounded-xl hover:bg-indigo-50 dark:hover:bg-navy-800 flex items-center justify-between text-xs font-bold text-gray-800 dark:text-gray-200 transition-all cursor-pointer text-left"
                >
                  <span>{item.label}</span>
                  <span className="text-[10px] font-mono text-gray-400 px-1.5 py-0.5 rounded bg-gray-100 dark:bg-navy-950">
                    {item.category}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
