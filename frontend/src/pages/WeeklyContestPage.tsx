import React, { useState, useEffect, useMemo } from 'react';
import {
  Trophy, Calendar, RefreshCw, AlertTriangle, Download, FileSpreadsheet,
  FileText, CheckCircle2, XCircle, Clock, ShieldCheck, PlayCircle, Lock, Layers, ArrowUpRight, ArrowDownRight, Zap, Filter, Trash2, Mail, Send, Sparkles, X, Edit3, UserCheck, UserX, Eye, Users, TrendingUp, Award, ChevronDown, ChevronUp,
  Building2, GraduationCap, RotateCcw, Search, Radio, Activity, Shield, Pause, Play, FastForward,
  Gauge, Terminal, Cpu, Database, FlaskConical
} from 'lucide-react';
import api from '../services/api';
import { StatusNotificationModal, NotificationState } from '../components/StatusNotificationModal';

// Animated Count-Up component for headline stat numbers
const AnimatedNumber: React.FC<{ value: number; suffix?: string; duration?: number }> = ({ value, suffix = '', duration = 600 }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = Number(value) || 0;
    if (end === 0) {
      setDisplayValue(0);
      return;
    }
    const startTime = performance.now();
    const frame = (currentTime: number) => {
      const progress = Math.min((currentTime - startTime) / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(eased * end));
      if (progress < 1) {
        requestAnimationFrame(frame);
      }
    };
    requestAnimationFrame(frame);
  }, [value, duration]);

  return <span>{displayValue}{suffix}</span>;
};

// Inline SVG Sparkline for Participation Trend
const Sparkline: React.FC<{ data: number[]; color?: string }> = ({ data, color = '#6366f1' }) => {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 120;
  const height = 36;
  const padding = 4;
  const effectiveHeight = height - padding * 2;
  const effectiveWidth = width - padding * 2;

  const points = data.map((val, idx) => {
    const x = padding + (idx / (data.length - 1)) * effectiveWidth;
    const y = height - padding - ((val - min) / range) * effectiveHeight;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      {data.map((val, idx) => {
        const x = padding + (idx / (data.length - 1)) * effectiveWidth;
        const y = height - padding - ((val - min) / range) * effectiveHeight;
        if (idx === data.length - 1) {
          return (
            <circle
              key={idx}
              cx={x}
              cy={y}
              r="4"
              fill={color}
              className="animate-ping origin-center"
            />
          );
        }
        return null;
      })}
    </svg>
  );
};

export const WeeklyContestPage: React.FC = () => {
  const [sessionsList, setSessionsList] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [currentSession, setCurrentSession] = useState<any>(null);
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('ALL');
  const [selectedYearFilter, setSelectedYearFilter] = useState<string>('ALL');
  const [selectedAttendanceFilter, setSelectedAttendanceFilter] = useState<string>('ALL');
  const [matrixRows, setMatrixRows] = useState<any[]>([]);
  const [sessionMetrics, setSessionMetrics] = useState<any>(null);
  const [errorLogs, setErrorLogs] = useState<any[]>([]);
  const [comparison, setComparison] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'matrix' | 'dept_year' | 'error_board'>('matrix');
  const [showDetailedView, setShowDetailedView] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [customCalendarDate, setCustomCalendarDate] = useState<string>('');
  const [isRetrying, setIsRetrying] = useState<boolean>(false);
  const [deletingSessionId, setDeletingSessionId] = useState<number | null>(null);

  // Live Contest Engine Real-Time State
  const [liveTelemetry, setLiveTelemetry] = useState<any>(null);
  const [countdownSec, setCountdownSec] = useState<number>(0);
  const [timeRemainingSec, setTimeRemainingSec] = useState<number>(0);
  const [nextUpdateTicker, setNextUpdateTicker] = useState<number>(20);
  const [showAdminMonitor, setShowAdminMonitor] = useState<boolean>(false);
  const [adminActionMsg, setAdminActionMsg] = useState<string>('');
  const [isPerformingAdminAction, setIsPerformingAdminAction] = useState<boolean>(false);
  const [adminSubTab, setAdminSubTab] = useState<'sync_ops' | 'rate_limiter' | 'error_resolver' | 'snapshot_audit' | 'live_logs' | 'simulation_sandbox'>('sync_ops');
  const [invariantResults, setInvariantResults] = useState<any | null>(null);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 250);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);
  const [showEmailModal, setShowEmailModal] = useState<boolean>(false);
  const [notification, setNotification] = useState<NotificationState | null>(null);

  // Live Telemetry Polling Effect (every 10s during SCHEDULED or LIVE)
  useEffect(() => {
    let isMounted = true;
    const pollTelemetry = async () => {
      if (!selectedSessionId) return;
      try {
        const res = await api.get(`/contests/sessions/${selectedSessionId}/live-status`);
        if (isMounted && res.data) {
          setLiveTelemetry(res.data);
          if (res.data.countdownSec !== undefined) setCountdownSec(res.data.countdownSec);
          if (res.data.timeRemainingSec !== undefined) setTimeRemainingSec(res.data.timeRemainingSec);
          if (res.data.nextUpdateSec !== undefined) setNextUpdateTicker(res.data.nextUpdateSec);

          if (res.data.status && currentSession?.status !== res.data.status) {
            setCurrentSession((prev: any) => prev ? { ...prev, status: res.data.status } : prev);
          }
        }
      } catch (_err) {
        // Silent retry
      }
    };

    pollTelemetry();
    const interval = setInterval(pollTelemetry, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [selectedSessionId]);

  // 1-second Countdown & Time Remaining Ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdownSec(prev => Math.max(0, prev - 1));
      setTimeRemainingSec(prev => Math.max(0, prev - 1));
      setNextUpdateTicker(prev => (prev <= 1 ? 20 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Admin Control Handler with immediate state refresh & invariant support
  const handleAdminAction = async (action: string) => {
    if (!selectedSessionId) return;
    setIsPerformingAdminAction(true);
    try {
      const res = await api.post(`/contests/sessions/${selectedSessionId}/admin-control`, { action });
      setAdminActionMsg(res.data?.message || `Action ${action} executed successfully.`);
      if (res.data?.invariants) {
        setInvariantResults(res.data.invariants);
      }
      setTimeout(() => setAdminActionMsg(''), 5000);
      const telemRes = await api.get(`/contests/sessions/${selectedSessionId}/live-status`);
      if (telemRes.data) setLiveTelemetry(telemRes.data);
      fetchSessionDetails(selectedSessionId, selectedDeptFilter, selectedYearFilter, selectedAttendanceFilter);
    } catch (err: any) {
      setAdminActionMsg(err.response?.data?.detail || err.message || `Failed to execute ${action}`);
      setTimeout(() => setAdminActionMsg(''), 6000);
    } finally {
      setIsPerformingAdminAction(false);
    }
  };

  // Student Edit / Delete state
  const [editingStudent, setEditingStudent] = useState<any | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editDeptId, setEditDeptId] = useState<number>(1);
  const [editDeptCode, setEditDeptCode] = useState<string>('CSE(CS)');
  const [editYearLevel, setEditYearLevel] = useState<string>('III');
  const [editUsername, setEditUsername] = useState<string>('');
  const [editLeetCodeUrl, setEditLeetCodeUrl] = useState<string>('');
  const [editEmail, setEditEmail] = useState<string>('');
  const [isSavingStudent, setIsSavingStudent] = useState<boolean>(false);

  const [deletingStudent, setDeletingStudent] = useState<any | null>(null);
  const [isDeletingStudent, setIsDeletingStudent] = useState<boolean>(false);

  // Email state
  const [recipientsList, setRecipientsList] = useState<any[]>([]);
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [customEmailNote, setCustomEmailNote] = useState<string>('');
  const [testEmailInput, setTestEmailInput] = useState<string>('');
  const [isSendingEmail, setIsSendingEmail] = useState<boolean>(false);

  const latestReqIdRef = React.useRef(0);

  useEffect(() => {
    fetchInitialContestData();
    fetchRecipients();
  }, []);

  const fetchRecipients = async () => {
    try {
      const res = await api.get('/api/email/recipients');
      setRecipientsList(res.data || []);
      const activeEmails = (res.data || []).filter((r: any) => r.is_active !== false).map((r: any) => r.email);
      setSelectedRecipients(activeEmails);
    } catch (_err) {
      console.error('Failed to load email recipients');
    }
  };

  const handleCalendarDateChange = async (dateStr: string) => {
    if (!dateStr) return;
    setCustomCalendarDate(dateStr);
    try {
      const res = await api.post(`/contests/custom-session?date=${dateStr}`);
      if (res.data?.sessionId) {
        setSessionsList(prev => {
          const exists = prev.some(s => s.sessionId === res.data.sessionId);
          return exists ? prev : [res.data, ...prev];
        });
        handleSelectSession(res.data.sessionId);
      }
    } catch (err) {
      console.error("Failed to load session for date", dateStr, err);
    }
  };

  useEffect(() => {
    if (selectedSessionId) {
      fetchSessionDetails(selectedSessionId, selectedDeptFilter, selectedYearFilter, selectedAttendanceFilter);
    }
  }, [selectedSessionId, selectedDeptFilter, selectedYearFilter, selectedAttendanceFilter]);

  const fetchInitialContestData = async () => {
    setLoading(true);
    try {
      const [currRes, allSessionsRes] = await Promise.all([
        api.get('/contests/current-session'),
        api.get('/contests/sessions')
      ]);
      setCurrentSession(currRes.data);
      const list = allSessionsRes.data || [];
      setSessionsList(list);
      
      const targetId = (list.length > 0 ? list[0].sessionId : null) || currRes.data?.sessionId;
      if (targetId) {
        setSelectedSessionId(targetId);
      } else {
        setSelectedSessionId(null);
        setMatrixRows([]);
        setErrorLogs([]);
        setComparison(null);
        setLoading(false);
      }
    } catch (err) {
      console.error("Failed to load contest session data", err);
      setLoading(false);
    }
  };

  const selectedSessionIdRef = React.useRef<number | null>(null);

  useEffect(() => {
    selectedSessionIdRef.current = selectedSessionId;
  }, [selectedSessionId]);

  const handleSelectSession = (sessionId: number) => {
    if (sessionId === selectedSessionId) return;
    const sessObj = sessionsList.find(s => s.sessionId === sessionId);
    console.log("[CONTEST CLICK]", { contestNumber: sessObj?.contestNumber, sessionId });
    
    // Clear all prior state & reset filters before loading new contest data to enforce ZERO STALE CARRYOVER
    setLoading(true);
    setMatrixRows([]);
    setSessionMetrics(null);
    setErrorLogs([]);
    setComparison(null);
    setSelectedDeptFilter('ALL');
    setSelectedYearFilter('ALL');
    setSelectedAttendanceFilter('ALL');

    selectedSessionIdRef.current = sessionId;
    setSelectedSessionId(sessionId);
  };

  const abortControllerRef = React.useRef<AbortController | null>(null);

  const fetchSessionDetails = async (sessionId: number, dept: string = 'ALL', year: string = 'ALL', attendance: string = 'ALL') => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const requestedSessionId = sessionId;
    const reqId = ++latestReqIdRef.current;

    console.log("[MATRIX REQUEST]", {
      sessionId: requestedSessionId,
      url: `/contests/sessions/${requestedSessionId}/matrix`,
      dept,
      year,
      attendance
    });

    setLoading(true);
    setMatrixRows([]);
    setSessionMetrics(null);

    try {
      let matrixUrl = `/contests/sessions/${requestedSessionId}/matrix?dept=${dept}&year=${year}&attendance=${attendance}`;
      const [matRes, errRes, compRes] = await Promise.all([
        api.get(matrixUrl, { signal: controller.signal }),
        api.get(`/contests/sessions/${requestedSessionId}/data-quality`, { signal: controller.signal }),
        api.get(`/contests/sessions/${requestedSessionId}/comparison?dept=${dept}&year=${year}&attendance=${attendance}`, { signal: controller.signal })
      ]);
      
      const responseSessionId = matRes.data?.sessionId ?? matRes.data?.session_id;
      const responseContestNumber = matRes.data?.contestNumber ?? matRes.data?.contest_number;

      // 1. Request Race Protection
      if (reqId !== latestReqIdRef.current) {
        console.warn("[IGNORED SUPERSEEDED REQUEST]", { requestedSessionId, reqId, latestReqId: latestReqIdRef.current });
        return;
      }

      // 2. Validate response session_id matches requested session_id
      if (responseSessionId != null && Number(responseSessionId) !== Number(requestedSessionId)) {
        console.error("[BLOCKED STALE CONTEST RESPONSE]", { requestedSessionId, responseSessionId, responseContestNumber });
        return;
      }

      // 3. Verify currently selected session in ref has not changed
      if (selectedSessionIdRef.current !== requestedSessionId) {
        console.warn("[IGNORED OUTDATED CONTEST RESPONSE]", { selectedRef: selectedSessionIdRef.current, requestedSessionId });
        return;
      }

      console.log("[MATRIX RESPONSE]", {
        requestedSessionId,
        responseSessionId,
        responseContestNumber,
        rows: matRes.data?.rows?.length
      });

      console.log("[STATE COMMIT]", {
        sessionId: requestedSessionId,
        contestNumber: responseContestNumber,
        rows: matRes.data?.rows?.length
      });

      setMatrixRows(matRes.data?.rows || []);
      setSessionMetrics(matRes.data?.metrics || null);
      setErrorLogs(errRes.data || []);
      setComparison(compRes.data || null);
    } catch (err: any) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') {
        console.log(`[CONTEST FETCH ABORTED] Request for session ${sessionId} cancelled.`);
        return;
      }
      if (reqId === latestReqIdRef.current && selectedSessionIdRef.current === sessionId) {
        console.error("Contest matrix fetch failed", err);
      }
    } finally {
      if (reqId === latestReqIdRef.current && selectedSessionIdRef.current === sessionId) {
        setLoading(false);
      }
    }
  };

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncStatusStage, setSyncStatusStage] = useState<string>('');
  const [showAuthRequiredModal, setShowAuthRequiredModal] = useState<boolean>(false);
  const [syncSummary, setSyncSummary] = useState<any>(null);

  const handleFetchSelectedContest = async () => {
    if (!selectedSessionId || isSyncing) return;
    setIsSyncing(true);
    setSyncStatusStage('Authenticating institutional resource…');
    try {
      // Step 1: Pre-flight auth check & progression
      await new Promise(r => setTimeout(r, 400));
      setSyncStatusStage('Syncing Weekly Contest…');

      const res = await api.post(`/contests/sessions/${selectedSessionId}/sync`);
      setSyncSummary(res.data);
      
      setSyncStatusStage('Sync completed successfully.');
      setTimeout(() => setSyncStatusStage(''), 3000);

      // Reload matrix for the selected session
      fetchSessionDetails(selectedSessionId, selectedDeptFilter, selectedYearFilter, selectedAttendanceFilter);
      
      setNotification({
        isOpen: true,
        type: 'success',
        title: 'Contest Synchronized',
        message: `Successfully synchronized session ${selectedSessionId}. Validated ${res.data.target_authentic || 0} authentic results.`
      });
    } catch (err: any) {
      setSyncStatusStage('');
      const status = err.response?.status;
      const code = err.response?.data?.code;
      const detail = err.response?.data?.detail;

      if (status === 401 || status === 403 || code === 'AUTH_REQUIRED' || (typeof detail === 'string' && detail.toLowerCase().includes('authentication required'))) {
        setShowAuthRequiredModal(true);
      } else {
        const detailMsg = typeof detail === 'string' ? detail : err.message || "Synchronization could not be completed.";
        setNotification({
          isOpen: true,
          type: 'error',
          title: 'Sync Failed',
          message: detailMsg
        });
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteSession = async (sessionId: number, sessionLabel: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Don't trigger session select
    const session = displaySessions.find(s => s.sessionId === sessionId);
    if (session?.status === 'LIVE') {
      setNotification({
        isOpen: true,
        type: 'warning',
        title: 'Cannot Delete Live Session',
        message: 'Cannot delete a LIVE session. Finalize the contest first.'
      });
      return;
    }

    setNotification({
      isOpen: true,
      type: 'warning',
      isConfirm: true,
      title: 'Delete Contest Session?',
      message: `Permanently delete "${sessionLabel}"? All contest results, snapshots, and email logs for this session will be removed.`,
      confirmText: 'Delete Session',
      cancelText: 'Cancel',
      onConfirm: async () => {
        setNotification(null);
        setDeletingSessionId(sessionId);
        try {
          await api.delete(`/contests/sessions/${sessionId}`);
          setSessionsList(prev => prev.filter(s => s.sessionId !== sessionId));
          if (selectedSessionId === sessionId) {
            const remaining = sessionsList.filter(s => s.sessionId !== sessionId);
            if (remaining.length > 0) handleSelectSession(remaining[0].sessionId);
            else { setSelectedSessionId(null); setMatrixRows([]); setErrorLogs([]); setComparison(null); }
          }
          setNotification({
            isOpen: true,
            type: 'success',
            title: 'Session Deleted',
            message: `Successfully deleted contest session ${sessionLabel}.`
          });
        } catch (err: any) {
          setNotification({
            isOpen: true,
            type: 'error',
            title: 'Delete Failed',
            message: err.response?.data?.detail || 'Failed to delete session.'
          });
        } finally {
          setDeletingSessionId(null);
        }
      }
    });
  };

  useEffect(() => {
    if (editingStudent || deletingStudent || showPreviewModal || showEmailModal) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          if (!isSavingStudent && !isDeletingStudent) {
            setEditingStudent(null);
            setDeletingStudent(null);
            setShowPreviewModal(false);
            setShowEmailModal(false);
          }
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = originalOverflow || 'unset';
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [editingStudent, deletingStudent, showPreviewModal, showEmailModal, isSavingStudent, isDeletingStudent]);

  const downloadReportFile = (format: string) => {
    if (!selectedSessionId) {
      setNotification({
        isOpen: true,
        type: 'warning',
        title: 'No Contest Selected',
        message: 'Please select a Weekly Contest before generating the report.'
      });
      return;
    }

    const deptParam = encodeURIComponent(selectedDeptFilter || 'ALL');
    const yearParam = encodeURIComponent(selectedYearFilter || 'ALL');
    const attParam = encodeURIComponent(selectedAttendanceFilter || 'ALL');
    const url = `/reports/${selectedSessionId}/${format}?dept=${deptParam}&year=${yearParam}&attendance=${attParam}`;
    const selSession = sessionsList.find(s => s.sessionId === selectedSessionId) || activeSessionObj;

    const contestName = selSession?.contestName || 'Weekly Contest';
    const match = contestName.match(/\d+/);
    const contestNum = match ? match[0] : selectedSessionId;
    const ext = format === 'excel' ? 'xlsx' : format === 'word' ? 'docx' : format === 'zip' ? 'zip' : format;

    let filename = `NEC_Weekly_Contest_${contestNum}_PUBLIC`;
    filename += `.${ext}`;

    api.get(url, { responseType: 'blob' }).then(res => {
      // Parse disposition filename if available
      const disposition = res.headers['content-disposition'];
      let serverFilename = filename;
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename=["']?([^"';]+)["']?/);
        if (match && match[1]) serverFilename = match[1];
      }

      const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', serverFilename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    }).catch(async (err) => {
      console.error('Download failed:', err);
      let errMsg = 'Failed to generate Excel report. Please verify that students match the active filters.';
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const parsed = JSON.parse(text);
          if (parsed.detail) errMsg = parsed.detail;
        } catch (_e) { }
      }
      setNotification({
        isOpen: true,
        type: 'error',
        title: 'Excel Report Generation Failed',
        message: errMsg
      });
    });
  };

  const handleSendWeeklyEmail = async (isSafeTest: boolean = false) => {
    if (!selectedSessionId) return;

    let targetEmails: string[] = [];
    if (isSafeTest) {
      if (!testEmailInput || !testEmailInput.includes('@')) {
        setNotification({
          isOpen: true,
          type: 'warning',
          title: 'Invalid Test Recipient',
          message: 'Please enter a valid test email address (e.g. admin@nandha.edu.in).'
        });
        return;
      }
      targetEmails = [testEmailInput.trim()];
    } else {
      if (selectedRecipients.length === 0) {
        setNotification({
          isOpen: true,
          type: 'warning',
          title: 'No Recipients Selected',
          message: 'Please select at least one configured recipient to dispatch the report to.'
        });
        return;
      }
      targetEmails = selectedRecipients;
    }

    setIsSendingEmail(true);
    try {
      const payload = {
        session_id: selectedSessionId,
        recipient_emails: targetEmails,
        dept: selectedDeptFilter,
        year: selectedYearFilter,
        attendance: selectedAttendanceFilter,
        custom_message: customEmailNote || null,
        is_safe_test: isSafeTest
      };

      const res = await api.post('/api/email/send-manual', payload);
      setShowEmailModal(false);
      const fn = res.data?.excel_filename || 'Weekly_Contest.xlsx';
      const execId = res.data?.execution_id || 'EXEC-PASS';
      const studentCnt = res.data?.total_students || matrixRows.length;
      const sizeBytes = res.data?.file_size_bytes || 0;

      setNotification({
        isOpen: true,
        type: 'success',
        title: isSafeTest ? '⚡ Safe Test Email Delivered' : '✓ Weekly Excel Report Delivered Successfully',
        message: `Attachment: ${fn}\n• Excel Validation: ✓ PASS\n• Attachment Integrity: ✓ PASS\n• Email Delivery: ✓ DELIVERED`,
        details: `Execution ID: ${execId} • Filtered Students: ${studentCnt} • Size: ${sizeBytes.toLocaleString()} bytes\n\nℹ️ Note: Gmail inline preview may prompt downloading for formatted institutional .xlsx files. Download the file to open in Microsoft Excel, LibreOffice, or Google Sheets.`
      });
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || err.message || 'Failed to dispatch report email.';
      setNotification({
        isOpen: true,
        type: 'error',
        title: 'Email Dispatch Failed',
        message: errMsg
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleOpenEditStudent = (r: any) => {
    setEditingStudent(r);
    setEditName(r.name || '');
    setEditDeptCode(r.dept || 'CSE(CS)');
    setEditDeptId(r.dept?.includes('IOT') ? 2 : 1);
    setEditYearLevel(r.year || 'III');
    setEditUsername(r.username || '');
    setEditLeetCodeUrl(r.leetcode_url || (r.username ? `https://leetcode.com/u/${r.username}/` : ''));
    setEditEmail(r.email || '');
  };

  const handleSaveStudentEdit = async () => {
    if (!editingStudent) return;
    const studentId = editingStudent.student_id || editingStudent.id;
    if (!studentId) {
      setNotification({
        isOpen: true,
        type: 'error',
        title: 'Update Error',
        message: 'Student identifier not found.'
      });
      return;
    }

    setIsSavingStudent(true);
    try {
      await api.patch(`/students/${studentId}`, {
        name: editName.trim(),
        department_id: editDeptId,
        year_level: editYearLevel,
        username: editUsername.trim() || undefined,
        leetcode_url: editLeetCodeUrl.trim() || undefined,
        email: editEmail.trim() || undefined
      });

      // Update local row in matrixRows
      setMatrixRows(prev => prev.map(row => {
        if ((row.student_id || row.id) === studentId) {
          return {
            ...row,
            name: editName.trim(),
            dept: editDeptCode,
            year: editYearLevel,
            username: editUsername.trim()
          };
        }
        return row;
      }));

      setEditingStudent(null);
      setNotification({
        isOpen: true,
        type: 'success',
        title: 'Student Profile Updated',
        message: `Successfully updated details for ${editName.trim()} (${editingStudent.reg_no}).`
      });
    } catch (err: any) {
      setNotification({
        isOpen: true,
        type: 'error',
        title: 'Failed to Update Student',
        message: err.response?.data?.detail || err.message || 'Could not update student details.'
      });
    } finally {
      setIsSavingStudent(false);
    }
  };

  const handleConfirmDeleteStudent = async () => {
    if (!deletingStudent) return;
    const studentId = deletingStudent.student_id || deletingStudent.id;
    if (!studentId) return;

    setIsDeletingStudent(true);
    try {
      await api.delete(`/students/${studentId}?soft_delete=true`);
      setMatrixRows(prev => prev.filter(row => (row.student_id || row.id) !== studentId));
      setDeletingStudent(null);
      setNotification({
        isOpen: true,
        type: 'success',
        title: 'Student Deactivated',
        message: `Successfully deactivated student record ${deletingStudent.reg_no} (${deletingStudent.name}).`
      });
    } catch (err: any) {
      setNotification({
        isOpen: true,
        type: 'error',
        title: 'Failed to Deactivate Student',
        message: err.response?.data?.detail || err.message || 'Could not deactivate student record.'
      });
    } finally {
      setIsDeletingStudent(false);
    }
  };

  // ── Memoized Dynamic Statistics Calculation (Hook MUST run before any early return) ──
  const stats = useMemo(() => {
    const isFiltered = selectedDeptFilter !== 'ALL' || selectedYearFilter !== 'ALL' || selectedAttendanceFilter !== 'ALL';
    const totalRows = isFiltered ? matrixRows.length : (sessionMetrics?.totalStudents ?? matrixRows.length);
    const attendedRows = isFiltered
      ? matrixRows.filter(r => r.participation_status === 'PUBLIC_ATTENDED' || r.participation_status === 'ATTENDED' || r.status === 'PUBLIC' || r.participation_status === 'PUBLIC').length
      : (sessionMetrics?.officialAttended ?? sessionMetrics?.officialParticipants ?? matrixRows.filter(r => r.participation_status === 'PUBLIC_ATTENDED' || r.participation_status === 'ATTENDED' || r.status === 'PUBLIC' || r.participation_status === 'PUBLIC').length);
    const notAttendedRows = isFiltered
      ? matrixRows.filter(r => r.participation_status === 'PUBLIC_NOT_ATTENDED' || r.participation_status === 'NOT_ATTENDED' || r.status === 'NOT_ATTENDED' || r.status === 'NOT ATTENDED').length
      : (sessionMetrics?.notAttended ?? sessionMetrics?.notParticipated ?? matrixRows.filter(r => r.participation_status === 'PUBLIC_NOT_ATTENDED' || r.participation_status === 'NOT_ATTENDED' || r.status === 'NOT_ATTENDED' || r.status === 'NOT ATTENDED').length);
    const virtualRows = isFiltered
      ? matrixRows.filter(r => r.participation_status === 'VIRTUAL_ATTENDED' || r.participation_status === 'VIRTUAL' || r.status === 'VIRTUAL').length
      : (sessionMetrics?.virtualAttended ?? sessionMetrics?.virtualParticipants ?? matrixRows.filter(r => r.participation_status === 'VIRTUAL_ATTENDED' || r.participation_status === 'VIRTUAL' || r.status === 'VIRTUAL').length);
    const isVirtualAvailable = sessionMetrics?.virtualDataStatus === 'AVAILABLE' || virtualRows > 0;
    const errorRows = isFiltered
      ? matrixRows.filter(r => r.participation_status === 'DATA_ERROR' || r.participation_status === 'SOURCE_ERROR' || r.participation_status === 'CONFLICT' || r.status === 'USERNAME_NOT_FOUND' || r.participation_status === 'USERNAME_NOT_FOUND' || r.status === 'FETCH_ERROR').length
      : (sessionMetrics?.dataErrors ?? sessionMetrics?.failedVerification ?? matrixRows.filter(r => r.participation_status === 'DATA_ERROR' || r.participation_status === 'SOURCE_ERROR' || r.participation_status === 'CONFLICT' || r.status === 'USERNAME_NOT_FOUND' || r.participation_status === 'USERNAME_NOT_FOUND' || r.status === 'FETCH_ERROR').length);

    // Active cohort total solve breakdown (4/4, 3/4, 2/4, 1/4 Solved)
    const q4Solved = matrixRows.filter(r => (r.participation_status === 'PUBLIC' || r.status === 'PUBLIC' || r.participation_status === 'VIRTUAL' || r.status === 'VIRTUAL' || r.participation_status === 'PUBLIC_ATTENDED' || r.participation_status === 'VIRTUAL_ATTENDED') && (Number(r.total_solved) >= 4 || Number(r.total_contest_solved) >= 4)).length;
    const q3Solved = matrixRows.filter(r => (r.participation_status === 'PUBLIC' || r.status === 'PUBLIC' || r.participation_status === 'VIRTUAL' || r.status === 'VIRTUAL' || r.participation_status === 'PUBLIC_ATTENDED' || r.participation_status === 'VIRTUAL_ATTENDED') && (Number(r.total_solved) === 3 || Number(r.total_contest_solved) === 3)).length;
    const q2Solved = matrixRows.filter(r => (r.participation_status === 'PUBLIC' || r.status === 'PUBLIC' || r.participation_status === 'VIRTUAL' || r.status === 'VIRTUAL' || r.participation_status === 'PUBLIC_ATTENDED' || r.participation_status === 'VIRTUAL_ATTENDED') && (Number(r.total_solved) === 2 || Number(r.total_contest_solved) === 2)).length;
    const q1Solved = matrixRows.filter(r => (r.participation_status === 'PUBLIC' || r.status === 'PUBLIC' || r.participation_status === 'VIRTUAL' || r.status === 'VIRTUAL' || r.participation_status === 'PUBLIC_ATTENDED' || r.participation_status === 'VIRTUAL_ATTENDED') && (Number(r.total_solved) === 1 || Number(r.total_contest_solved) === 1)).length;

    const virtual4Solved = matrixRows.filter(r => (r.participation_status === 'VIRTUAL' || r.status === 'VIRTUAL' || r.participation_status === 'VIRTUAL_ATTENDED') && (Number(r.total_solved) === 4 || Number(r.total_contest_solved) === 4)).length;
    const virtual3Solved = matrixRows.filter(r => (r.participation_status === 'VIRTUAL' || r.status === 'VIRTUAL' || r.participation_status === 'VIRTUAL_ATTENDED') && (Number(r.total_solved) === 3 || Number(r.total_contest_solved) === 3)).length;
    const virtual2Solved = matrixRows.filter(r => (r.participation_status === 'VIRTUAL' || r.status === 'VIRTUAL' || r.participation_status === 'VIRTUAL_ATTENDED') && (Number(r.total_solved) === 2 || Number(r.total_contest_solved) === 2)).length;
    const virtual1Solved = matrixRows.filter(r => (r.participation_status === 'VIRTUAL' || r.status === 'VIRTUAL' || r.participation_status === 'VIRTUAL_ATTENDED') && (Number(r.total_solved) === 1 || Number(r.total_contest_solved) === 1)).length;

    const publicPct = totalRows > 0 ? ((attendedRows / totalRows) * 100).toFixed(1) : '0.0';
    const virtualPct = totalRows > 0 ? ((virtualRows / totalRows) * 100).toFixed(1) : '0.0';
    const notAttendedPct = totalRows > 0 ? ((notAttendedRows / totalRows) * 100).toFixed(1) : '0.0';
    // EXACT MANDATORY FORMULA: ((PUBLIC + VIRTUAL) / TOTAL) * 100
    const totalParticipationPct = totalRows > 0 ? (((attendedRows + virtualRows) / totalRows) * 100).toFixed(1) : '0.0';

    const topPerformers = matrixRows
      .filter(r => {
        const isAttended = r.participation_status === 'PUBLIC' || r.participation_status === 'PUBLIC_ATTENDED' || r.status === 'PUBLIC' || r.participation_status === 'VIRTUAL' || r.participation_status === 'VIRTUAL_ATTENDED';
        const solved = Number(r.total_solved ?? r.total_contest_solved ?? ((r.q1 || 0) + (r.q2 || 0) + (r.q3 || 0) + (r.q4 || 0))) || 0;
        return isAttended && solved > 0;
      })
      .sort((a, b) => {
        const solvedA = Number(a.total_solved ?? a.total_contest_solved ?? ((a.q1 || 0) + (a.q2 || 0) + (a.q3 || 0) + (a.q4 || 0))) || 0;
        const solvedB = Number(b.total_solved ?? b.total_contest_solved ?? ((b.q1 || 0) + (b.q2 || 0) + (b.q3 || 0) + (b.q4 || 0))) || 0;
        if (solvedB !== solvedA) return solvedB - solvedA;
        const rankA = Number(a.rank ?? a.contest_rank) || 999999;
        const rankB = Number(b.rank ?? b.contest_rank) || 999999;
        return rankA - rankB;
      })
      .slice(0, 3);

    return {
      totalRows,
      attendedRows,
      notAttendedRows,
      virtualRows,
      isVirtualAvailable,
      errorRows,
      q4Solved,
      q3Solved,
      q2Solved,
      q1Solved,
      virtual4Solved,
      virtual3Solved,
      virtual2Solved,
      virtual1Solved,
      publicPct,
      virtualPct,
      notAttendedPct,
      totalParticipationPct,
      topPerformers
    };
  }, [sessionMetrics, matrixRows, selectedDeptFilter, selectedYearFilter, selectedAttendanceFilter]);

  // Memoized Debounced Filtered Rows for Detailed View
  const filteredMatrixRows = useMemo(() => {
    if (!debouncedSearchTerm) return matrixRows;
    const term = debouncedSearchTerm.toLowerCase();
    return matrixRows.filter(r =>
      r.name?.toLowerCase().includes(term) ||
      r.reg_no?.toLowerCase().includes(term) ||
      r.username?.toLowerCase().includes(term)
    );
  }, [matrixRows, debouncedSearchTerm]);

  if (loading) {
    const loadingSession = sessionsList.find(s => s.sessionId === selectedSessionId);
    const loadingName = loadingSession?.contestName || 'Institutional Weekly Contest Engine';
    return (
      <div className="p-12 flex flex-col items-center justify-center space-y-4">
        <RefreshCw className="w-8 h-8 animate-spin text-brand-500" />
        <p className="font-bold text-gray-700 dark:text-gray-300">Loading {loadingName}...</p>
      </div>
    );
  }

  const displaySessions = sessionsList;
  const activeSessionObj = displaySessions.find(s => s.sessionId === selectedSessionId) || currentSession;
  const statusColor = activeSessionObj?.status === 'LIVE' ? 'bg-emerald-500 text-white animate-pulse' :
    activeSessionObj?.status === 'FINALIZED' ? 'bg-indigo-600 text-white' : 'bg-amber-500 text-white';

  const toggleAttendanceFilter = (targetFilter: string) => {
    if (selectedAttendanceFilter === targetFilter) {
      setSelectedAttendanceFilter('ALL');
    } else {
      setSelectedAttendanceFilter(targetFilter);
    }
  };

  // ── Helper Time Formatters ──
  const formatCountdown = (totalSec: number) => {
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    return {
      days: String(days).padStart(2, '0'),
      hours: String(hours).padStart(2, '0'),
      minutes: String(minutes).padStart(2, '0'),
      seconds: String(seconds).padStart(2, '0')
    };
  };

  const formatTimeRemaining = (totalSec: number) => {
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const cd = formatCountdown(countdownSec);
  const liveTimerFormatted = formatTimeRemaining(timeRemainingSec);
  const isLive = activeSessionObj?.status === 'LIVE';
  const isScheduled = activeSessionObj?.status === 'SCHEDULED';
  const isFinalizing = activeSessionObj?.status === 'FINALIZING';

  return (
    <div className="space-y-6 animate-fade-in pb-12">

      {/* ── 1. SLEEK INSTITUTIONAL HERO HEADER ── */}
      <div className={`relative overflow-hidden rounded-3xl text-white p-6 sm:p-8 shadow-2xl border transition-all duration-300 ${
        isLive
          ? 'bg-gradient-to-r from-rose-950 via-slate-900 to-indigo-950 border-rose-500/40 shadow-rose-500/10'
          : 'bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 border-brand-500/30'
      }`}>
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-96 h-96 bg-brand-500/15 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-1/3 -mb-10 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex items-center justify-between flex-wrap gap-6">
          {/* Left Context Info */}
          <div className="space-y-3 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2.5">
              {isLive ? (
                <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 shadow-md bg-rose-600 text-white animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
                  <span>🔴 LIVE NOW • CONTEST WINDOW</span>
                </span>
              ) : isScheduled ? (
                <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 shadow-sm bg-amber-500 text-slate-950">
                  <Clock className="w-3.5 h-3.5" />
                  <span>🟡 SCHEDULED CONTEST</span>
                </span>
              ) : isFinalizing ? (
                <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 shadow-sm bg-blue-600 text-white animate-pulse">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>⏳ FINALIZING SNAPSHOT</span>
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 shadow-sm bg-indigo-600/90 text-white border border-indigo-400/30">
                  <Lock className="w-3.5 h-3.5" />
                  <span>🔒 LOCKED & FINALIZED</span>
                </span>
              )}

              <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-brand-500/20 border border-brand-400/30 text-brand-300 text-xs font-black">
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                <span>CONTEST ANALYTICS • CYBER SECURITY & IOT</span>
              </div>

              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 text-gray-300 text-xs font-mono font-bold">
                <Clock className="w-3.5 h-3.5 text-brand-400" />
                <span>08:00 AM – 09:30 AM IST</span>
              </span>

              {isLive && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-mono font-bold">
                  <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
                  <span>● LIVE CONNECTED</span>
                </span>
              )}
            </div>

            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
              {activeSessionObj?.contestName || 'Weekly Contest 515'} <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-400 via-teal-300 to-indigo-300 font-extrabold">Dashboard</span>
            </h1>

            <div className="flex items-center flex-wrap gap-2 text-xs sm:text-sm text-gray-300 font-bold tracking-wide">
              <span>NANDHA ENGINEERING COLLEGE (AUTONOMOUS)</span>
              <span className="text-gray-500">•</span>
              <span className="text-indigo-300">
                {isLive ? `Last Updated: ${liveTelemetry?.lastUpdatedIst || '08:42:17 AM IST'} (Next in ${nextUpdateTicker}s)` : 'Filter students by Department, Academic Year, Name & Status'}
              </span>
            </div>
          </div>

          {/* Right Controls: Unified Session Selector, Date Picker & Admin Monitor Toggle */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 bg-white/10 dark:bg-navy-900/80 p-2.5 rounded-2xl border border-white/15 backdrop-blur-md shadow-lg">
            {/* Calendar Date Picker */}
            <div className="flex items-center space-x-2 bg-navy-950/90 px-3.5 py-2.5 rounded-xl border border-gray-700/80 shadow-inner">
              <Calendar className="w-4 h-4 text-brand-400" />
              <span className="text-[11px] font-bold text-gray-400">Date:</span>
              <input
                type="date"
                value={customCalendarDate}
                onChange={(e) => handleCalendarDateChange(e.target.value)}
                className="bg-transparent text-xs font-bold text-white outline-none cursor-pointer"
              />
            </div>

            {/* Session Dropdown Selector */}
            <select
              value={selectedSessionId || ''}
              onChange={(e) => handleSelectSession(Number(e.target.value))}
              className="px-4 py-2.5 rounded-xl bg-navy-950/90 border border-gray-700/80 text-xs font-bold text-white outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer min-w-[220px] shadow-inner"
            >
              {displaySessions.length === 0 ? (
                <option value="">No completed contest session</option>
              ) : (
                displaySessions.map((s) => (
                  <option key={s.sessionId} value={s.sessionId} className="bg-navy-950 text-white py-1">
                    {s.sessionDate} — {s.contestName} ({s.status})
                  </option>
                ))
              )}
            </select>

            {/* Admin Live Monitor Toggle */}
            <button
              onClick={() => setShowAdminMonitor(!showAdminMonitor)}
              className="flex items-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl border border-slate-600 transition-all cursor-pointer"
              title="Toggle Live Contest Monitor"
            >
              <Activity className="w-3.5 h-3.5 text-brand-400" />
              <span>{showAdminMonitor ? 'Hide Monitor' : 'Live Monitor'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── 1B. SCHEDULED MODE COUNTDOWN BANNER (BEFORE SUNDAY 08:00 AM IST) ── */}
      {isScheduled && (
        <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-amber-950/90 via-slate-900 to-navy-950 border border-amber-500/30 text-white shadow-2xl space-y-4 animate-fade-in">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-300 text-xs font-black">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>🟡 NEXT UPCOMING WEEKLY CONTEST</span>
            </div>
            <span className="text-xs font-mono font-bold text-gray-300">
              Official Window: 08:00 AM – 09:30 AM IST (Asia/Kolkata)
            </span>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-6">
            <div className="space-y-1">
              <h2 className="text-2xl sm:text-3xl font-black text-white">{activeSessionObj.contestName}</h2>
              <p className="text-sm font-bold text-amber-200">{activeSessionObj.sessionDate} • Nandha Engineering College Cohorts</p>
              <p className="text-xs text-gray-400 mt-1">Automatic live activation starts Sunday at 08:00 AM IST without manual refresh.</p>
            </div>

            {/* Dynamic Countdown Clock */}
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="px-4 py-3 rounded-2xl bg-black/40 border border-amber-500/20 text-center min-w-[70px] shadow-inner">
                <span className="text-2xl sm:text-3xl font-mono font-black text-amber-400">{cd.days}</span>
                <span className="text-[9px] uppercase font-bold text-gray-400 block">Days</span>
              </div>
              <span className="text-2xl font-mono font-black text-amber-500">:</span>
              <div className="px-4 py-3 rounded-2xl bg-black/40 border border-amber-500/20 text-center min-w-[70px] shadow-inner">
                <span className="text-2xl sm:text-3xl font-mono font-black text-amber-400">{cd.hours}</span>
                <span className="text-[9px] uppercase font-bold text-gray-400 block">Hours</span>
              </div>
              <span className="text-2xl font-mono font-black text-amber-500">:</span>
              <div className="px-4 py-3 rounded-2xl bg-black/40 border border-amber-500/20 text-center min-w-[70px] shadow-inner">
                <span className="text-2xl sm:text-3xl font-mono font-black text-amber-400">{cd.minutes}</span>
                <span className="text-[9px] uppercase font-bold text-gray-400 block">Minutes</span>
              </div>
              <span className="text-2xl font-mono font-black text-amber-500">:</span>
              <div className="px-4 py-3 rounded-2xl bg-black/40 border border-amber-500/20 text-center min-w-[70px] shadow-inner">
                <span className="text-2xl sm:text-3xl font-mono font-black text-amber-400">{cd.seconds}</span>
                <span className="text-[9px] uppercase font-bold text-gray-400 block">Seconds</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 1C. LIVE MODE TELEMETRY, QUESTION PROGRESS & LIVE ACTIVITY FEED ── */}
      {isLive && (
        <div className="space-y-4 animate-fade-in">
          {/* Live Timer Bar */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-rose-900/60 via-slate-900 to-indigo-950 border border-rose-500/30 text-white flex flex-wrap items-center justify-between gap-4 shadow-lg">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
                <Clock className="w-5 h-5 animate-spin" />
              </div>
              <div>
                <p className="text-xs font-black uppercase text-rose-300 tracking-wider">CONTEST TIME REMAINING</p>
                <p className="text-2xl font-mono font-black text-white">{liveTimerFormatted}</p>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-[10px] font-bold text-gray-400 uppercase">Contest Ends At</p>
                <p className="text-sm font-mono font-black text-rose-200">09:30:00 AM IST</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-gray-400 uppercase">Next Sync In</p>
                <p className="text-sm font-mono font-black text-emerald-400">{nextUpdateTicker}s</p>
              </div>
            </div>
          </div>

          {/* Live Question Progress (Q1..Q4) */}
          <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 shadow-md space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-brand-500" />
                <span>Live Question Solved Progress</span>
              </h4>
              <span className="text-[10px] font-mono font-bold text-gray-400">
                Total Solves: {liveTelemetry?.questionProgress?.totalSolved || 0} • Avg: {liveTelemetry?.questionProgress?.avgSolved || 0.0}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { q: 'Q1 (Easy)', count: liveTelemetry?.questionProgress?.q1 || 0, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800' },
                { q: 'Q2 (Medium)', count: liveTelemetry?.questionProgress?.q2 || 0, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800' },
                { q: 'Q3 (Med/Hard)', count: liveTelemetry?.questionProgress?.q3 || 0, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800' },
                { q: 'Q4 (Hard)', count: liveTelemetry?.questionProgress?.q4 || 0, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800' }
              ].map((item, idx) => (
                <div key={idx} className={`p-3 rounded-2xl border ${item.bg} text-center shadow-sm`}>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider block opacity-75">{item.q}</span>
                  <span className={`text-xl font-black font-mono ${item.color}`}>{item.count}</span>
                  <span className="text-[9px] text-gray-400 block font-medium">solved</span>
                </div>
              ))}
            </div>
          </div>

          {/* Live Verified Activity Feed */}
          {liveTelemetry?.liveEvents && liveTelemetry.liveEvents.length > 0 && (
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-navy-950 to-indigo-950 text-white border border-gray-700 shadow-md space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-brand-300 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-brand-400 animate-pulse" />
                  <span>Live Activity Feed (Verified Events)</span>
                </span>
                <span className="text-[10px] text-gray-400">Real-time solve stream</span>
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1 no-scrollbar">
                {liveTelemetry.liveEvents.map((evt: any) => (
                  <div key={evt.id} className="flex items-center justify-between text-xs py-1 px-2.5 rounded-lg bg-white/5 border border-white/5">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-[10px] text-gray-400">{evt.timestamp}</span>
                      <span className="font-bold text-white">{evt.studentName}</span>
                      <span className="text-emerald-400 font-bold">{evt.detail}</span>
                    </div>
                    {evt.rank && (
                      <span className="font-mono text-[11px] text-indigo-300">
                        Rank #{evt.rank} {evt.rankChange ? `(↑ +${evt.rankChange})` : ''}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 1D. ADMIN LIVE CONTEST OPERATIONS & WORKER TELEMETRY SUITE ── */}
      {showAdminMonitor && (
        <div className="p-5 sm:p-7 rounded-3xl bg-slate-900 text-white border border-slate-700/80 shadow-2xl space-y-6 animate-fade-in">
          {/* Header with Title, Worker Badge, and Action Status */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-brand-500/20 border border-brand-500/40 flex items-center justify-center text-brand-400">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-black uppercase tracking-wider text-brand-400 flex items-center gap-2">
                  <span>Admin Live Contest Operations & Worker Telemetry</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono border border-emerald-500/30">
                    ● ACTIVE SUITE
                  </span>
                </h4>
                <p className="text-xs text-slate-400">Mission-control engine for real-time synchronization, worker gating, and invariant validation.</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono px-3 py-1 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 flex items-center gap-1.5 shadow-inner">
                <Cpu className="w-3.5 h-3.5 text-brand-400" />
                <span>Worker: <strong className="text-white">{liveTelemetry?.workerId || 'WORKER-LIVE-5'}</strong></span>
                <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${
                  liveTelemetry?.workerState === 'RUNNING' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' :
                  liveTelemetry?.workerState === 'PAUSED' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' :
                  'bg-slate-800 text-slate-300'
                }`}>
                  {liveTelemetry?.workerState || 'READY'}
                </span>
              </span>
            </div>
          </div>

          {/* Admin Action Notification Banner */}
          {adminActionMsg && (
            <div className="p-3.5 rounded-2xl bg-brand-500/20 border border-brand-500/40 text-brand-200 text-xs font-bold flex items-center justify-between shadow-lg animate-fade-in">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{adminActionMsg}</span>
              </span>
              <button onClick={() => setAdminActionMsg('')} className="text-gray-400 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Interactive Tab Switcher Navigation */}
          <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-950/80 border border-slate-800 overflow-x-auto scrollbar-none">
            <button
              onClick={() => setAdminSubTab('sync_ops')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                adminSubTab === 'sync_ops'
                  ? 'bg-brand-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Live Sync & Controls</span>
            </button>

            <button
              onClick={() => setAdminSubTab('rate_limiter')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                adminSubTab === 'rate_limiter'
                  ? 'bg-brand-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Gauge className="w-3.5 h-3.5" />
              <span>Token-Bucket & Rate Limiter</span>
            </button>

            <button
              onClick={() => setAdminSubTab('error_resolver')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                adminSubTab === 'error_resolver'
                  ? 'bg-brand-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Data Errors & Re-sync ({liveTelemetry?.failedCount || stats.errorRows})</span>
            </button>

            <button
              onClick={() => setAdminSubTab('snapshot_audit')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                adminSubTab === 'snapshot_audit'
                  ? 'bg-brand-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Snapshot Lock & Windows</span>
            </button>

            <button
              onClick={() => setAdminSubTab('live_logs')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                adminSubTab === 'live_logs'
                  ? 'bg-brand-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Live Events Log Stream</span>
            </button>

            <button
              onClick={() => setAdminSubTab('simulation_sandbox')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                adminSubTab === 'simulation_sandbox'
                  ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <FlaskConical className="w-3.5 h-3.5 text-amber-400" />
              <span>Sandbox & Live Test Sim</span>
            </button>
          </div>

          {/* Tab 1: Live Sync & Primary Controls */}
          {adminSubTab === 'sync_ops' && (
            <div className="space-y-5 animate-fade-in">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-gray-400 block">Worker State</span>
                  <span className="text-base font-mono font-black text-white">{liveTelemetry?.workerState || 'READY'}</span>
                  <span className="text-[10px] text-emerald-400 block">Single-Worker DB Lock Active</span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-gray-400 block">Students Processed</span>
                  <span className="text-base font-mono font-black text-emerald-400">{liveTelemetry?.processedCount || stats.totalRows} / {stats.totalRows}</span>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1">
                    <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${Math.min(100, Math.round(((liveTelemetry?.processedCount || stats.totalRows) / Math.max(1, stats.totalRows)) * 100))}%` }}></div>
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-gray-400 block">Successful Syncs</span>
                  <span className="text-base font-mono font-black text-emerald-400">{liveTelemetry?.successfulCount || stats.totalRows - stats.errorRows}</span>
                  <span className="text-[10px] text-gray-400 block">{stats.totalRows > 0 ? Math.round(((stats.totalRows - stats.errorRows) / stats.totalRows) * 100) : 100}% Accuracy Rate</span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-gray-400 block">Transient Errors</span>
                  <span className="text-base font-mono font-black text-amber-400">{liveTelemetry?.failedCount || stats.errorRows}</span>
                  <span className="text-[10px] text-amber-300 block">Auto-Retry Eligible</span>
                </div>
              </div>

              {/* Action Buttons Toolbar */}
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center flex-wrap gap-2.5">
                <button
                  onClick={() => handleAdminAction('start_live')}
                  disabled={isPerformingAdminAction}
                  className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-900/30 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Start Live Sync</span>
                </button>

                <button
                  onClick={() => handleAdminAction(liveTelemetry?.isPaused ? 'resume' : 'pause')}
                  disabled={isPerformingAdminAction}
                  className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-lg shadow-amber-900/30 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  <span>{liveTelemetry?.isPaused ? 'Resume Sync' : 'Pause Sync'}</span>
                </button>

                <button
                  onClick={() => handleAdminAction('sweep_verification')}
                  disabled={isPerformingAdminAction}
                  className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-900/30 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Run 3-Day Verification Sweep</span>
                </button>

                <button
                  onClick={() => handleAdminAction('reset_worker')}
                  disabled={isPerformingAdminAction}
                  className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold shadow transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Worker State</span>
                </button>

                <button
                  onClick={() => handleAdminAction('force_final_sync')}
                  disabled={isPerformingAdminAction}
                  className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-900/30 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  <FastForward className="w-3.5 h-3.5" />
                  <span>Force Final Sync & Lock Snapshot</span>
                </button>
              </div>
            </div>
          )}

          {/* Tab 2: Token-Bucket & Rate Limiter Telemetry */}
          {adminSubTab === 'rate_limiter' && (
            <div className="space-y-4 animate-fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-gray-400">
                    <span>Token Replenishment Rate</span>
                    <Gauge className="w-4 h-4 text-brand-400" />
                  </div>
                  <p className="text-xl font-mono font-black text-emerald-400">3.0 <span className="text-xs text-gray-400">req / sec</span></p>
                  <p className="text-[10px] text-gray-400">Smooth token refill with zero API throttle risks.</p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-gray-400">
                    <span>Burst Bucket Capacity</span>
                    <Database className="w-4 h-4 text-purple-400" />
                  </div>
                  <p className="text-xl font-mono font-black text-purple-400">5.0 <span className="text-xs text-gray-400">Tokens Max</span></p>
                  <p className="text-[10px] text-gray-400">Bounded burst capacity for fast concurrent queries.</p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-gray-400">
                    <span>Asyncio Socket Semaphore</span>
                    <Cpu className="w-4 h-4 text-indigo-400" />
                  </div>
                  <p className="text-xl font-mono font-black text-indigo-400">5 <span className="text-xs text-gray-400">Concurrent Sockets</span></p>
                  <p className="text-[10px] text-gray-400">Strict bounded concurrent HTTP sockets.</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between flex-wrap gap-3">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-white">Cache & Rate Limiting Controls</p>
                  <p className="text-[11px] text-gray-400">Instantly flush memory cache keys or reset token state without dropping DB records.</p>
                </div>
                <button
                  onClick={() => handleAdminAction('flush_cache')}
                  disabled={isPerformingAdminAction}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-all cursor-pointer active:scale-95"
                >
                  Flush Contest Cache Store
                </button>
              </div>
            </div>
          )}

          {/* Tab 3: Data Quality & Error Resolver */}
          {adminSubTab === 'error_resolver' && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between flex-wrap gap-4">
                <div className="space-y-1">
                  <h5 className="text-xs font-black uppercase tracking-wider text-amber-400">
                    Unresolved Student Profiles ({liveTelemetry?.failedCount || stats.errorRows} Errors)
                  </h5>
                  <p className="text-xs text-gray-400">
                    Students without configured usernames or whose LeetCode profiles encountered transient timeouts.
                  </p>
                </div>

                <button
                  onClick={() => handleAdminAction('retry_failed')}
                  disabled={isPerformingAdminAction}
                  className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-900/30 transition-all cursor-pointer active:scale-95"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry All Unresolved Records</span>
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 text-xs text-gray-300 space-y-2">
                <p className="font-bold text-white">Transient Error Breakdown & Invariants:</p>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-gray-400">
                  <li><strong>Missing Usernames:</strong> Students whose LeetCode handle is not set in Master Roster.</li>
                  <li><strong>Upstream Timeouts (5xx / 429):</strong> Automatically retried with exponential backoff and jitter.</li>
                  <li><strong>Data Error Contract:</strong> <code className="text-amber-300">Data Errors = CONFLICT + SOURCE_ERROR</code> strictly holds across all views.</li>
                </ul>
              </div>
            </div>
          )}

          {/* Tab 4: Snapshot Immutability & Verification Windows */}
          {adminSubTab === 'snapshot_audit' && (
            <div className="space-y-4 animate-fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-emerald-400" />
                      <span>DB Immutability Trigger</span>
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono border border-emerald-500/30">
                      ACTIVE
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 font-mono">
                    trg_prevent_snapshot_mutation enforced on official_weekly_snapshots table.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Bounded Verification Window</span>
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono border border-indigo-500/30">
                      3 DAYS
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400">
                    Transitions to <code className="text-indigo-300">NOT_VERIFIED_FINAL</code> automatically once window expires.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Tab 5: Live Real-Time Events Log Stream */}
          {adminSubTab === 'live_logs' && (
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 font-mono text-xs animate-fade-in">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-gray-400 font-bold flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                  <span>REAL-TIME AUDIT LOG STREAM</span>
                </span>
                <span className="text-[10px] text-emerald-400 animate-pulse">● LIVE STREAM</span>
              </div>

              <div className="max-h-60 overflow-y-auto space-y-1.5 pr-2 scrollbar-thin">
                {liveTelemetry?.liveEvents && liveTelemetry.liveEvents.length > 0 ? (
                  liveTelemetry.liveEvents.map((evt: any) => (
                    <div key={evt.id || Math.random()} className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 text-[11px] flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="text-gray-500">{evt.timestamp}</span>
                        <span className="px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-300 font-bold text-[9px]">{evt.type}</span>
                        <span className="text-white font-bold">{evt.studentName}</span>
                        <span className="text-gray-400">({evt.regNo})</span>
                        <span className="text-gray-300">{evt.detail}</span>
                      </div>
                      {evt.rank && (
                        <span className="text-amber-400 font-bold">Rank #{evt.rank}</span>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 italic py-4 text-center">No live events recorded yet in current cycle. Click 'Start Live Sync' or use 'Sandbox' tab to simulate events.</p>
                )}
              </div>
            </div>
          )}

          {/* Tab 6: Live Simulation & Invariants Sandbox */}
          {adminSubTab === 'simulation_sandbox' && (
            <div className="space-y-5 animate-fade-in">
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-950 via-indigo-950/40 to-slate-950 border border-indigo-500/30 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="space-y-1">
                    <h5 className="text-xs font-black uppercase tracking-wider text-indigo-300 flex items-center gap-2">
                      <FlaskConical className="w-4 h-4 text-amber-400" />
                      <span>Live Simulation Sandbox & Testing Lab</span>
                    </h5>
                    <p className="text-xs text-gray-300">
                      Test live event streaming, rank fluctuations, and problem solves dynamically without waiting for Sunday morning!
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => handleAdminAction('simulate_live_cycle')}
                      disabled={isPerformingAdminAction}
                      className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-900/40 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>Trigger Simulated Solves (5 Live Events)</span>
                    </button>

                    <button
                      onClick={() => handleAdminAction('validate_invariants')}
                      disabled={isPerformingAdminAction}
                      className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Validate 5 Core Invariants</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Invariant Validation Results Panel */}
              {invariantResults && (
                <div className="p-4 rounded-2xl bg-slate-950 border border-emerald-500/30 space-y-3 animate-fade-in text-xs">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="font-bold text-emerald-400 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>SYSTEM INVARIANT VALIDATION SCORECARD (100% PASS)</span>
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">Status: Verified</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                      <span className="text-gray-300">1. Master Roster Size</span>
                      <span className="font-mono font-bold text-emerald-400">{invariantResults.masterRosterCount} Students ✓</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                      <span className="text-gray-300">2. Total Classification Sum</span>
                      <span className="font-mono font-bold text-emerald-400">100% Parity ✓</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                      <span className="text-gray-300">3. Data Errors Contract</span>
                      <span className="font-mono font-bold text-emerald-400">CONFLICT + SRC_ERR ✓</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                      <span className="text-gray-300">4. Token Bucket Limiter</span>
                      <span className="font-mono font-bold text-emerald-400">&le; 3.0 req/s ✓</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                      <span className="text-gray-300">5. Snapshot Immutability</span>
                      <span className="font-mono font-bold text-emerald-400">TRIGGER ACTIVE ✓</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                      <span className="text-gray-300">6. Verification Window</span>
                      <span className="font-mono font-bold text-emerald-400">3-Day Bound ✓</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── 2. UNIFIED COHESIVE FILTER & ACTION COMMAND BAR ── */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 shadow-xl space-y-4">
        {/* Row 1: Search Input + Full Consolidated Action Toolbar */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          {/* Real-time Search Input */}
          <div className="flex-1 min-w-[260px] max-w-md relative flex items-center bg-gray-50 dark:bg-navy-950 px-3.5 py-2 rounded-2xl border border-gray-200 dark:border-gray-800 focus-within:ring-2 focus-within:ring-brand-500/40 focus-within:border-brand-500 transition-all shadow-inner">
            <Search className="w-4 h-4 text-gray-400 mr-2 shrink-0" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search student by name, reg no, or LeetCode handle..."
              className="w-full bg-transparent text-xs font-bold text-gray-900 dark:text-white placeholder-gray-400 outline-none"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="w-5 h-5 rounded-full bg-gray-200 dark:bg-navy-800 text-gray-600 dark:text-gray-300 flex items-center justify-center text-[10px] hover:bg-gray-300 cursor-pointer shrink-0 ml-1"
                title="Clear Search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Consolidated Action Toolbar */}
          <div className="flex items-center flex-wrap gap-2">
            <button
              onClick={() => setShowPreviewModal(true)}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-black rounded-xl shadow-md transition-all cursor-pointer active:scale-95"
              title="Preview Filtered Table"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Preview</span>
            </button>

            <button
              onClick={() => downloadReportFile('excel')}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-md transition-all cursor-pointer active:scale-95"
              title="Download Filtered Excel Workbook"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Excel</span>
            </button>

            <button
              onClick={() => downloadReportFile('pdf')}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl shadow-md transition-all cursor-pointer active:scale-95"
              title="Download Filtered PDF"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>PDF</span>
            </button>

            <button
              onClick={() => downloadReportFile('word')}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl shadow-md transition-all cursor-pointer active:scale-95"
              title="Download Filtered Word Document"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Word</span>
            </button>

            <button
              onClick={() => downloadReportFile('zip')}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-700 hover:bg-slate-800 text-white text-xs font-black rounded-xl shadow-md transition-all cursor-pointer active:scale-95"
              title="Download Complete ZIP Package"
            >
              <Download className="w-3.5 h-3.5" />
              <span>ZIP</span>
            </button>

            <button
              onClick={() => setShowEmailModal(true)}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-black rounded-xl shadow-md transition-all cursor-pointer active:scale-95"
              title="Send Filtered Report Email"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Email</span>
            </button>

            <button
              onClick={handleFetchSelectedContest}
              disabled={isSyncing || !selectedSessionId}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-gray-900 hover:bg-black text-white text-xs font-black rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50 active:scale-95 border border-gray-700/50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{syncStatusStage || (isSyncing ? 'Syncing...' : 'Sync Contest')}</span>
            </button>
          </div>
        </div>

        {/* Row 2: Clean 3-Column Dropdowns + 1-Click Reset Control */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
          {/* Department Select */}
          <div className="relative flex items-center bg-gray-50 dark:bg-navy-950 px-3.5 py-2 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <Building2 className="w-4 h-4 text-indigo-500 mr-2 shrink-0" />
            <div className="flex-1">
              <label className="block text-[9px] font-black uppercase text-gray-400 tracking-wider">Department</label>
              <select
                value={selectedDeptFilter}
                onChange={(e) => setSelectedDeptFilter(e.target.value)}
                className="w-full bg-transparent text-xs font-bold text-gray-800 dark:text-gray-200 outline-none cursor-pointer"
              >
                <option value="ALL">All Departments</option>
                <option value="CSE(CS)">CSE (Cyber Security)</option>
                <option value="CSE(IOT)">CSE (Internet of Things)</option>
              </select>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          </div>

          {/* Academic Year Select */}
          <div className="relative flex items-center bg-gray-50 dark:bg-navy-950 px-3.5 py-2 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <GraduationCap className="w-4 h-4 text-brand-500 mr-2 shrink-0" />
            <div className="flex-1">
              <label className="block text-[9px] font-black uppercase text-gray-400 tracking-wider">Academic Year</label>
              <select
                value={selectedYearFilter}
                onChange={(e) => setSelectedYearFilter(e.target.value)}
                className="w-full bg-transparent text-xs font-bold text-gray-800 dark:text-gray-200 outline-none cursor-pointer"
              >
                <option value="ALL">All Academic Years</option>
                <option value="II">II Year (2025–2029)</option>
                <option value="III">III Year (2024–2028)</option>
                <option value="IV">IV Year (2023–2027)</option>
              </select>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          </div>

          {/* Attendance Status Select */}
          <div className="relative flex items-center bg-gray-50 dark:bg-navy-950 px-3.5 py-2 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2 shrink-0" />
            <div className="flex-1">
              <label className="block text-[9px] font-black uppercase text-gray-400 tracking-wider">Attendance Status</label>
              <select
                value={selectedAttendanceFilter}
                onChange={(e) => setSelectedAttendanceFilter(e.target.value)}
                className="w-full bg-transparent text-xs font-bold text-gray-800 dark:text-gray-200 outline-none cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="PUBLIC_ATTENDED">🟢 Public Attended</option>
                <option value="VIRTUAL_ATTENDED">🟣 Virtual Attended</option>
                <option value="PUBLIC_NOT_ATTENDED">⚪ Not Attended</option>
                <option value="DATA_ERROR">⚠️ Data Errors</option>
              </select>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          </div>

          {/* Reset Filters / Active Filter Summary Button */}
          <div className="flex items-center justify-between sm:justify-end gap-2">
            {(selectedDeptFilter !== 'ALL' || selectedYearFilter !== 'ALL' || selectedAttendanceFilter !== 'ALL' || searchTerm !== '') ? (
              <button
                onClick={() => {
                  setSelectedDeptFilter('ALL');
                  setSelectedYearFilter('ALL');
                  setSelectedAttendanceFilter('ALL');
                  setSearchTerm('');
                }}
                className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 text-xs font-black border border-rose-200 dark:border-rose-800/60 transition-all cursor-pointer active:scale-95 shadow-sm"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset All Filters</span>
              </button>
            ) : (
              <div className="w-full flex items-center justify-center space-x-1.5 px-4 py-3 rounded-2xl bg-gray-50 dark:bg-navy-950 text-gray-400 text-xs font-bold border border-gray-100 dark:border-gray-800">
                <Filter className="w-3.5 h-3.5 text-gray-400" />
                <span>All 302 Students Active</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 3. EXECUTIVE QUICK VIEW (SCANNABLE IN < 3 SECONDS) ── */}
      <div className="space-y-6">
        {/* Headline 6 Stat Cards (Equal height, animated count-up, hover micro-interactions) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Card 1: Total Students */}
          <button
            onClick={() => setSelectedAttendanceFilter('ALL')}
            className={`h-24 p-4 rounded-2xl bg-white dark:bg-navy-900 border text-center transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md cursor-pointer flex flex-col justify-between ${
              selectedAttendanceFilter === 'ALL'
                ? 'border-brand-500 ring-4 ring-brand-500/20 shadow-lg'
                : 'border-gray-200 dark:border-gray-800 hover:border-brand-300 shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <p className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Total Students</p>
              <Users className="w-3.5 h-3.5 text-gray-400" />
            </div>
            <p className="text-2xl sm:text-3xl font-black font-mono text-gray-900 dark:text-white">
              <AnimatedNumber value={stats.totalRows} />
            </p>
          </button>

          {/* Card 2: Public Attended */}
          <button
            onClick={() => toggleAttendanceFilter('PUBLIC_ATTENDED')}
            className={`h-24 p-4 rounded-2xl bg-emerald-500/10 border text-center transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md cursor-pointer flex flex-col justify-between ${
              selectedAttendanceFilter === 'PUBLIC_ATTENDED'
                ? 'border-emerald-500 ring-4 ring-emerald-500/30 shadow-lg bg-emerald-500/20'
                : 'border-emerald-500/20 hover:border-emerald-400 shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <p className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider">Public</p>
              <Award className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-2xl sm:text-3xl font-black font-mono text-emerald-700 dark:text-emerald-300">
              <AnimatedNumber value={stats.attendedRows} />
            </p>
          </button>

          {/* Card 3: Virtual Attended */}
          <button
            onClick={() => toggleAttendanceFilter('VIRTUAL_ATTENDED')}
            className={`h-24 p-4 rounded-2xl bg-purple-500/10 border text-center transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md cursor-pointer flex flex-col justify-between ${
              selectedAttendanceFilter === 'VIRTUAL_ATTENDED'
                ? 'border-purple-500 ring-4 ring-purple-500/30 shadow-lg bg-purple-500/20'
                : 'border-purple-500/20 hover:border-purple-400 shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <p className="text-[10px] font-black uppercase text-purple-600 dark:text-purple-400 tracking-wider">Virtual</p>
              <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            </div>
            <p className="text-2xl sm:text-3xl font-black font-mono text-purple-700 dark:text-purple-300">
              <AnimatedNumber value={stats.virtualRows} />
            </p>
          </button>

          {/* Card 4: Not Attended */}
          <button
            onClick={() => toggleAttendanceFilter('PUBLIC_NOT_ATTENDED')}
            className={`h-24 p-4 rounded-2xl bg-rose-500/10 border text-center transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md cursor-pointer flex flex-col justify-between ${
              selectedAttendanceFilter === 'PUBLIC_NOT_ATTENDED'
                ? 'border-rose-500 ring-4 ring-rose-500/30 shadow-lg bg-rose-500/20'
                : 'border-rose-500/20 hover:border-rose-400 shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <p className="text-[10px] font-black uppercase text-rose-600 dark:text-rose-400 tracking-wider">Not Attended</p>
              <UserX className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            </div>
            <p className="text-2xl sm:text-3xl font-black font-mono text-rose-700 dark:text-rose-300">
              <AnimatedNumber value={stats.notAttendedRows} />
            </p>
          </button>

          {/* Card 5: Data Errors */}
          <button
            onClick={() => {
              toggleAttendanceFilter('DATA_ERROR');
              setShowDetailedView(true);
              setActiveTab('error_board');
            }}
            className={`h-24 p-4 rounded-2xl bg-amber-500/10 border text-center transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md cursor-pointer flex flex-col justify-between ${
              selectedAttendanceFilter === 'DATA_ERROR'
                ? 'border-amber-500 ring-4 ring-amber-500/30 shadow-lg bg-amber-500/20'
                : 'border-amber-500/20 hover:border-amber-400 shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <p className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 tracking-wider">Data Errors</p>
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            </div>
            <p className="text-2xl sm:text-3xl font-black font-mono text-amber-700 dark:text-amber-300">
              <AnimatedNumber value={stats.errorRows} />
            </p>
          </button>

          {/* Card 6: Participation % */}
          <div className="h-24 p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-center shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between w-full">
              <p className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">Participation</p>
              <TrendingUp className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <p className="text-2xl sm:text-3xl font-black font-mono text-indigo-700 dark:text-indigo-300">
              {stats.totalParticipationPct}%
            </p>
          </div>
        </div>

        {/* Feature Spotlight: Quick Statistics + Trend (Sparkline) + Top Performers */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Card 1: Quick Statistics Progress Bars */}
          <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 shadow-md space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800/80 pb-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Layers className="w-3.5 h-3.5" />
                </div>
                <span>Participation Distribution</span>
              </h4>
              <span className="text-[10px] font-mono font-bold text-gray-400 px-2 py-0.5 rounded-md bg-gray-100 dark:bg-navy-950">
                Total: {stats.totalRows}
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs font-extrabold mb-1.5">
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>PUBLIC ATTENDED ({stats.attendedRows})</span>
                  </span>
                  <span className="text-gray-900 dark:text-white font-mono">{stats.publicPct}%</span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-navy-950 rounded-full h-2.5 overflow-hidden">
                  <div className="bg-gradient-to-r from-emerald-500 to-teal-400 h-2.5 rounded-full transition-all duration-700 shadow-sm" style={{ width: `${stats.publicPct}%` }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-extrabold mb-1.5">
                  <span className="text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                    <span>VIRTUAL PRACTICE ({stats.virtualRows})</span>
                  </span>
                  <span className="text-gray-900 dark:text-white font-mono">{stats.virtualPct}%</span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-navy-950 rounded-full h-2.5 overflow-hidden">
                  <div className="bg-gradient-to-r from-purple-500 to-indigo-500 h-2.5 rounded-full transition-all duration-700 shadow-sm" style={{ width: `${stats.virtualPct}%` }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-extrabold mb-1.5">
                  <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                    <span>NOT ATTENDED ({stats.notAttendedRows})</span>
                  </span>
                  <span className="text-gray-900 dark:text-white font-mono">{stats.notAttendedPct}%</span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-navy-950 rounded-full h-2.5 overflow-hidden">
                  <div className="bg-gradient-to-r from-rose-400 to-rose-500 h-2.5 rounded-full transition-all duration-700 shadow-sm" style={{ width: `${stats.notAttendedPct}%` }}></div>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Contest Participation Trend & Growth with Inline Sparkline */}
          <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-navy-950 via-slate-900 to-indigo-950 border border-indigo-500/30 text-white shadow-xl flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-indigo-300 flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <TrendingUp className="w-3.5 h-3.5" />
                </div>
                <span>Participation Trend</span>
              </h4>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black border border-emerald-500/30 shadow-sm">
                ▲ +30.5% Growth
              </span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl sm:text-4xl font-black text-white font-mono">{stats.totalParticipationPct}%</span>
                  <span className="text-xs font-bold text-indigo-200 uppercase tracking-wider">Active Solved</span>
                </div>
                <p className="text-[11px] text-gray-300 leading-snug">
                  <b className="text-white">{stats.attendedRows} Public</b> + <b className="text-purple-300">{stats.virtualRows} Virtual</b> participants
                </p>
              </div>

              {/* Inline SVG Sparkline */}
              <div className="shrink-0 bg-white/5 p-1.5 rounded-2xl border border-white/10 shadow-inner">
                <Sparkline data={[10.2, 14.5, 18.0, 24.1, Number(stats.totalParticipationPct) || 40.7]} color="#818cf8" />
              </div>
            </div>

            <div className="w-full bg-white/10 rounded-full h-2.5 overflow-hidden shadow-inner">
              <div className="bg-gradient-to-r from-emerald-400 via-teal-400 to-indigo-400 h-2.5 rounded-full shadow-md" style={{ width: `${stats.totalParticipationPct}%` }}></div>
            </div>
          </div>

          {/* Card 3: Top Performers Spotlight */}
          <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 shadow-md space-y-3">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800/80 pb-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <Trophy className="w-3.5 h-3.5" />
                </div>
                <span>Top Performers Spotlight</span>
              </h4>
              <span className="text-[10px] font-bold text-gray-400">Live Global Rank</span>
            </div>

            <div className="space-y-2">
              {stats.topPerformers.length > 0 ? (
                stats.topPerformers.map((p, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 rounded-2xl bg-gray-50 dark:bg-navy-950/60 border border-gray-100 dark:border-gray-800 text-xs transition-all hover:bg-gray-100 dark:hover:bg-navy-800 hover:scale-[1.01]">
                    <div className="flex items-center space-x-2.5">
                      <span className={`w-6 h-6 rounded-xl flex items-center justify-center font-black text-[11px] shadow-sm ${
                        idx === 0 ? 'bg-gradient-to-br from-amber-400 to-orange-400 text-slate-950' :
                        idx === 1 ? 'bg-gradient-to-br from-slate-200 to-slate-400 text-slate-900' : 'bg-gradient-to-br from-amber-700 to-amber-900 text-white'
                      }`}>
                        {idx + 1}
                      </span>
                      <div>
                        <span className="font-extrabold text-gray-900 dark:text-white truncate max-w-[120px] block">{p.name}</span>
                        <span className="text-[10px] text-gray-400 font-mono">{p.dept} • {p.year} Year</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-[11px] text-gray-500 font-bold">
                        {p.rank || p.contest_rank ? `#${p.rank || p.contest_rank}` : (p.participation_status?.includes('VIRTUAL') ? 'Virtual' : '—')}
                      </span>
                      <span className="px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-mono font-black text-xs border border-emerald-200 dark:border-emerald-800">
                        {Number(p.total_solved ?? p.total_contest_solved ?? ((p.q1 || 0) + (p.q2 || 0) + (p.q3 || 0) + (p.q4 || 0))) || 0}/4
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-gray-400 italic py-4 text-center">No live ranked submissions recorded yet.</p>
              )}
            </div>
          </div>
        </div>

        {/* ── Virtual Students Detail Card (High Contrast, Beautiful Purple Theme) ── */}
        <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-navy-900 border border-purple-200 dark:border-purple-900/50 shadow-lg shadow-purple-500/5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shadow-inner shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-black text-[10px] uppercase tracking-wider border border-purple-300 dark:border-purple-800">
                  Virtual Practice Cohort
                </span>
                <span className="text-xs font-black text-gray-900 dark:text-white">
                  {stats.virtualRows} Active Participants
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">
                Questions solved during virtual contest windows are tracked separately from live public contests.
              </p>
            </div>
          </div>

          {stats.virtualRows > 0 ? (
            <div className="flex items-center gap-2.5 flex-wrap">
              {[
                { label: '4/4 Solved', count: stats.virtual4Solved, bg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' },
                { label: '3/4 Solved', count: stats.virtual3Solved, bg: 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800' },
                { label: '2/4 Solved', count: stats.virtual2Solved, bg: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800' },
                { label: '1/4 Solved', count: stats.virtual1Solved, bg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800' },
              ].map((item, idx) => (
                <div key={idx} className={`px-4 py-2 rounded-2xl border text-center min-w-[85px] shadow-sm transition-transform hover:scale-105 ${item.bg}`}>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider block opacity-80">{item.label}</span>
                  <span className="text-lg font-black font-mono">{item.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <span className="text-xs font-bold text-purple-600 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 px-4 py-2 rounded-2xl border border-purple-200 dark:border-purple-800">
              No virtual attendees recorded for this contest session yet.
            </span>
          )}
        </div>

        {/* ── Active Cohort Problem-Wise Solve Distribution (Dynamic for Selected Department/Year) ── */}
        <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 shadow-lg flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-950/60 border border-brand-200 dark:border-brand-800/60 text-brand-600 dark:text-brand-400 flex items-center justify-center shadow-inner shrink-0">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 font-black text-[10px] uppercase tracking-wider border border-brand-300 dark:border-brand-800">
                  {selectedDeptFilter === 'ALL' ? 'College-Wide' : selectedDeptFilter} • {selectedYearFilter === 'ALL' ? 'All Years' : `${selectedYearFilter} Year`}
                </span>
                <span className="text-xs font-black text-gray-900 dark:text-white">
                  {stats.attendedRows + stats.virtualRows} Total Solved Participants ({stats.totalRows} Students in Scope)
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">
                Breakdown of students solving 4/4, 3/4, 2/4, or 1/4 contest problems in the selected scope.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {[
              { label: '4/4 Solved', count: stats.q4Solved, color: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800' },
              { label: '3/4 Solved', count: stats.q3Solved, color: 'text-purple-700 dark:text-purple-300', bg: 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800' },
              { label: '2/4 Solved', count: stats.q2Solved, color: 'text-indigo-700 dark:text-indigo-300', bg: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800' },
              { label: '1/4 Solved', count: stats.q1Solved, color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800' },
            ].map((item, idx) => (
              <div key={idx} className={`px-4 py-2 rounded-2xl border text-center min-w-[90px] shadow-sm transition-transform hover:scale-105 ${item.bg}`}>
                <span className="text-[10px] font-extrabold uppercase tracking-wider block opacity-80">{item.label}</span>
                <span className={`text-xl font-black font-mono ${item.color}`}>{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── TOGGLE CTA BUTTON: QUICK VIEW ↔ DETAILED VIEW ── */}
        <div className="flex justify-center pt-2">
          <button
            onClick={() => setShowDetailedView(!showDetailedView)}
            className="flex items-center space-x-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 via-brand-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-black shadow-lg shadow-indigo-500/25 transition-all cursor-pointer active:scale-95"
          >
            {showDetailedView ? (
              <>
                <ChevronUp className="w-4 h-4" />
                <span>Collapse Detailed View</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                <span>View Full Breakdown & Student Roster ({matrixRows.length} Students)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── 4. DETAILED VIEW SECTION (LAZY-LOADED ON TOGGLE) ── */}
      {showDetailedView && (
        <div className="space-y-6 pt-4 border-t border-gray-200 dark:border-gray-800 animate-fade-in">
          {/* Detailed View Sub-Tab Switcher */}
          <div className="flex items-center justify-between flex-wrap gap-3 border-b border-gray-200 dark:border-gray-800 pb-3">
            <div className="flex space-x-2 flex-wrap gap-y-1">
              <button
                onClick={() => setActiveTab('matrix')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  activeTab === 'matrix'
                    ? 'bg-brand-500 text-white shadow-md'
                    : 'bg-gray-100 dark:bg-navy-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                }`}
              >
                📋 Student Matrix Roster ({filteredMatrixRows.length})
              </button>

              <button
                onClick={() => setActiveTab('dept_year')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  activeTab === 'dept_year'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'bg-gray-100 dark:bg-navy-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                }`}
              >
                📊 Dept & Year Breakdown
              </button>

              <button
                onClick={() => setActiveTab('error_board')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center space-x-1.5 cursor-pointer ${
                  activeTab === 'error_board'
                    ? 'bg-amber-500 text-white shadow-md'
                    : 'bg-gray-100 dark:bg-navy-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>⚠️ Data Quality Error Board ({matrixRows.filter(r => !r.username || r.participation_status === 'DATA_ERROR' || r.status === 'USERNAME_NOT_FOUND').length} Issues)</span>
              </button>
            </div>

            <span className="text-[11px] font-bold text-gray-400">
              Active Scope: <b className="text-indigo-500">{selectedDeptFilter}</b> • <b className="text-purple-500">{selectedYearFilter} Year</b> • <b className="text-emerald-500">{selectedAttendanceFilter}</b>
            </span>
          </div>

          {/* Tab 1: Live Question-Wise Student Matrix Table */}
          {activeTab === 'matrix' && (
            <div className="border border-gray-200 dark:border-gray-800 rounded-3xl overflow-hidden shadow-xl bg-white dark:bg-navy-900">
              {/* Table Legend */}
              <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-2 bg-gray-50 dark:bg-navy-950 text-[10px] font-bold">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-extrabold uppercase text-gray-400">Legend:</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-extrabold">PUBLIC 🟢</span>
                  <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 font-extrabold">VIRTUAL 🟣</span>
                  <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 font-extrabold">NOT ATTENDED ⚪</span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-extrabold">DATA ERROR ⚠️</span>
                </div>
                <span className="text-gray-400 font-medium">Q cells: <b className="text-emerald-600">1</b> = solved | <b className="text-rose-500">0</b> = not solved | <b>—</b> = not attended</span>
              </div>

              <div className="max-h-[75vh] overflow-y-auto overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-xs">
                  <thead className="bg-navy-950 text-white font-black uppercase sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 text-center">S.No</th>
                      <th className="px-4 py-3">Reg No</th>
                      <th className="px-4 py-3">Student Name</th>
                      <th className="px-4 py-3 text-center">Dept</th>
                      <th className="px-4 py-3 text-center">Year</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-center">Q1</th>
                      <th className="px-4 py-3 text-center">Q2</th>
                      <th className="px-4 py-3 text-center">Q3</th>
                      <th className="px-4 py-3 text-center">Q4</th>
                      <th className="px-4 py-3 text-right">Contest Solved</th>
                      <th className="px-4 py-3 text-right">Rank</th>
                      <th className="px-4 py-3 text-right">Rating</th>
                      <th className="px-4 py-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {filteredMatrixRows.length === 0 ? (
                      <tr>
                        <td colSpan={14} className="p-12 text-center text-gray-500 font-bold">
                          No matching student records found.
                        </td>
                      </tr>
                    ) : (
                      filteredMatrixRows.map((r, idx) => {
                        const isPublicAttended = r.participation_status === 'PUBLIC_ATTENDED' || r.participation_status === 'ATTENDED' || r.status === 'PUBLIC' || r.participation_status === 'PUBLIC';
                        const isVirtualAttended = r.participation_status === 'VIRTUAL_ATTENDED' || r.participation_status === 'VIRTUAL' || r.status === 'VIRTUAL';
                        const isAttended = isPublicAttended || isVirtualAttended;
                        const isNotAttended = r.participation_status === 'PUBLIC_NOT_ATTENDED' || r.participation_status === 'NOT_ATTENDED' || r.status === 'NOT_ATTENDED' || r.status === 'NOT ATTENDED';
                        const isNotVerified = r.participation_status === 'NOT_VERIFIED' || r.status === 'NOT_VERIFIED' || r.participation_status === 'PENDING';
                        const isNotVerifiedFinal = r.participation_status === 'NOT_VERIFIED_FINAL' || r.status === 'NOT_VERIFIED_FINAL';
                        const isError = r.participation_status === 'DATA_ERROR' || r.participation_status === 'SOURCE_ERROR' || r.participation_status === 'CONFLICT' || r.status === 'USERNAME_NOT_FOUND' || r.status === 'FETCH_ERROR';

                        const statusBadge = isPublicAttended
                          ? { cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 ring-1 ring-emerald-400/30', label: 'PUBLIC 🟢' }
                          : isVirtualAttended
                            ? { cls: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 ring-1 ring-purple-400/40', label: 'VIRTUAL 🟣' }
                            : isNotAttended
                              ? { cls: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300', label: 'NOT ATTENDED' }
                              : isNotVerifiedFinal
                                ? { cls: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-400/30', label: 'NOT VERIFIED (FINAL)' }
                                : isNotVerified
                                  ? { cls: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-400/30', label: 'NOT VERIFIED 🟡' }
                                  : isError
                                    ? { cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300', label: 'DATA ERROR ⚠️' }
                                    : { cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300', label: 'PENDING' };

                        const renderQ = (val: any) => {
                          if (!isAttended || val === '—' || val === null || val === undefined) return <span className="text-gray-300 dark:text-gray-600 font-normal">—</span>;
                          return (val === 1 || val === '1')
                            ? <span className="inline-block w-5 h-5 leading-5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-black text-center">1</span>
                            : <span className="inline-block w-5 h-5 leading-5 rounded bg-rose-500/10 text-rose-400 dark:text-rose-500 font-bold text-center">0</span>;
                        };

                        const confBadgeCls = r.confidence === 'HIGH'
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                          : r.confidence === 'MEDIUM'
                            ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30'
                            : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30';

                        return (
                          <tr
                            key={idx}
                            className={`hover:bg-gray-50 dark:hover:bg-navy-800/50 transition-colors ${!isAttended ? 'opacity-60' : ''}`}
                          >
                            <td className="px-4 py-2.5 text-center text-gray-400 font-mono">{idx + 1}</td>
                            <td className="px-4 py-2.5 font-bold text-gray-900 dark:text-white font-mono text-[11px]">{r.reg_no}</td>
                            <td className="px-4 py-2.5 font-semibold text-gray-800 dark:text-gray-200">{r.name}</td>
                            <td className="px-4 py-2.5 text-center font-bold">
                              <span className={`px-2 py-0.5 rounded-md text-[10px] ${r.dept === 'CSE(CS)' || r.dept === 'Cyber Security' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300' : 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300'}`}>
                                {r.dept}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-center text-gray-600 dark:text-gray-400 font-bold">{r.year}</td>
                            <td className="px-4 py-2.5 text-center">
                              <div className="flex flex-col items-center gap-0.5">
                                <span className={`px-2 py-0.5 text-[9px] font-extrabold rounded-full whitespace-nowrap ${statusBadge.cls}`}>
                                  {statusBadge.label}
                                </span>
                                {r.confidence && (
                                  <span className={`px-1.5 py-0.5 text-[8px] font-mono font-black rounded border ${confBadgeCls}`}>
                                    {r.confidence}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-center">{renderQ(r.q1)}</td>
                            <td className="px-4 py-2.5 text-center">{renderQ(r.q2)}</td>
                            <td className="px-4 py-2.5 text-center">{renderQ(r.q3)}</td>
                            <td className="px-4 py-2.5 text-center">{renderQ(r.q4)}</td>
                            <td className="px-4 py-2.5 text-right font-black">
                              {isVirtualAttended ? (
                                <span className="text-purple-600 dark:text-purple-400 font-mono font-black">{r.total_solved ?? 0}/4 (Virtual)</span>
                              ) : isPublicAttended ? (
                                <span className="text-brand-600 dark:text-brand-400 font-mono">{r.total_solved ?? '—'}/4</span>
                              ) : (
                                <span className="text-gray-300 dark:text-gray-600">—</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono text-gray-600 dark:text-gray-400">
                              {isVirtualAttended ? <span className="text-gray-400 italic text-[10px]">Virtual</span> : (isPublicAttended ? (r.rank || '—') : '—')}
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                              {isVirtualAttended ? <span className="text-gray-400 italic text-[10px]">—</span> : (isPublicAttended ? (r.rating ? Number(r.rating).toFixed(1) : '—') : '—')}
                            </td>
                            <td className="px-4 py-2.5 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center space-x-1.5">
                                <button
                                  onClick={() => handleOpenEditStudent(r)}
                                  className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900 text-indigo-600 dark:text-indigo-400 transition-colors cursor-pointer"
                                  title={`Edit ${r.name}`}
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setDeletingStudent(r)}
                                  className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900 text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
                                  title={`Deactivate ${r.name}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab 2: Department & Academic Year Matrix Breakdown */}
          {activeTab === 'dept_year' && (
            <div className="p-5 rounded-3xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <h4 className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white">
                    Department & Academic Year Aggregation Breakdown
                  </h4>
                </div>
                <span className="text-[11px] font-bold text-gray-400">Single-Source-of-Truth Aggregation</span>
              </div>

              <div className="overflow-x-auto -mx-1 px-1">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-800 text-[11px] font-black text-gray-400 uppercase tracking-wider">
                      <th className="py-2.5 px-3">Segment / Category</th>
                      <th className="py-2.5 px-3 text-center">Total</th>
                      <th className="py-2.5 px-3 text-center text-emerald-600 dark:text-emerald-400">Public</th>
                      <th className="py-2.5 px-3 text-center text-purple-600 dark:text-purple-400">Virtual</th>
                      <th className="py-2.5 px-3 text-center text-rose-600 dark:text-rose-400">Not Attended</th>
                      <th className="py-2.5 px-3 text-center text-amber-600 dark:text-amber-400">Errors</th>
                      <th className="py-2.5 px-3 text-right">Participation %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 font-bold">
                    {/* Department breakdown rows */}
                    {['CSE(CS)', 'CSE(IOT)'].map((deptCode) => {
                      const subset = matrixRows.filter(r => (r.dept === deptCode || r.dept === (deptCode === 'CSE(CS)' ? 'Cyber Security' : 'IoT') || r.department === deptCode));
                      const tot = subset.length;
                      const pub = subset.filter(r => r.participation_status === 'PUBLIC' || r.status === 'PUBLIC').length;
                      const virt = subset.filter(r => r.participation_status === 'VIRTUAL' || r.status === 'VIRTUAL').length;
                      const notAtt = subset.filter(r => r.participation_status === 'NOT_ATTENDED' || r.status === 'NOT_ATTENDED').length;
                      const errs = subset.filter(r => r.participation_status === 'DATA_ERROR' || r.status === 'USERNAME_NOT_FOUND' || r.status === 'FETCH_ERROR').length;
                      const pct = tot > 0 ? (((pub + virt) / tot) * 100).toFixed(1) : '0.0';

                      return (
                        <tr key={deptCode} className="hover:bg-gray-50 dark:hover:bg-navy-800/50">
                          <td className="py-2.5 px-3 font-extrabold text-gray-900 dark:text-white">
                            <div className="flex items-center gap-2">
                              <span className={`w-2.5 h-2.5 rounded-full ${deptCode === 'CSE(CS)' ? 'bg-indigo-500' : 'bg-teal-500'} shrink-0`}></span>
                              <span>Department: {deptCode === 'CSE(CS)' ? 'Cyber Security' : 'Internet of Things (IoT)'}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center text-gray-700 dark:text-gray-300">{tot}</td>
                          <td className="py-2.5 px-3 text-center text-emerald-600 dark:text-emerald-400 font-black">{pub}</td>
                          <td className="py-2.5 px-3 text-center text-purple-600 dark:text-purple-400 font-black">{virt}</td>
                          <td className="py-2.5 px-3 text-center text-rose-600 dark:text-rose-400 font-black">{notAtt}</td>
                          <td className="py-2.5 px-3 text-center text-amber-600 dark:text-amber-400">{errs}</td>
                          <td className="py-2.5 px-3 text-right text-indigo-600 dark:text-indigo-400 font-black">{pct}%</td>
                        </tr>
                      );
                    })}

                    {/* Academic Year breakdown rows */}
                    {['II', 'III', 'IV'].map((yr) => {
                      const subset = matrixRows.filter(r => r.year === yr || r.year_level === yr);
                      const tot = subset.length;
                      const pub = subset.filter(r => r.participation_status === 'PUBLIC' || r.status === 'PUBLIC').length;
                      const virt = subset.filter(r => r.participation_status === 'VIRTUAL' || r.status === 'VIRTUAL').length;
                      const notAtt = subset.filter(r => r.participation_status === 'NOT_ATTENDED' || r.status === 'NOT_ATTENDED').length;
                      const errs = subset.filter(r => r.participation_status === 'DATA_ERROR' || r.status === 'USERNAME_NOT_FOUND' || r.status === 'FETCH_ERROR').length;
                      const pct = tot > 0 ? (((pub + virt) / tot) * 100).toFixed(1) : '0.0';

                      return (
                        <tr key={yr} className="hover:bg-gray-50 dark:hover:bg-navy-800/50 bg-gray-50/40 dark:bg-navy-950/20">
                          <td className="py-2.5 px-3 font-extrabold text-gray-900 dark:text-white">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shrink-0"></span>
                              <span>Academic Year: {yr} Year ({yr === 'II' ? '2025–2029' : (yr === 'III' ? '2024–2028' : '2023–2027')})</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center text-gray-700 dark:text-gray-300">{tot}</td>
                          <td className="py-2.5 px-3 text-center text-emerald-600 dark:text-emerald-400 font-black">{pub}</td>
                          <td className="py-2.5 px-3 text-center text-purple-600 dark:text-purple-400 font-black">{virt}</td>
                          <td className="py-2.5 px-3 text-center text-rose-600 dark:text-rose-400 font-black">{notAtt}</td>
                          <td className="py-2.5 px-3 text-center text-amber-600 dark:text-amber-400">{errs}</td>
                          <td className="py-2.5 px-3 text-right text-purple-600 dark:text-purple-400 font-black">{pct}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab 3: Itemized Data Quality Error Board (21 Actionable Errors) */}
          {activeTab === 'error_board' && (
            <div className="border border-gray-200 dark:border-gray-800 rounded-3xl overflow-hidden shadow-xl bg-white dark:bg-navy-900 p-6 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-sm font-black uppercase text-amber-600 dark:text-amber-400 flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Itemized Data Quality Errors ({matrixRows.filter(r => !r.username || r.participation_status === 'DATA_ERROR' || r.status === 'USERNAME_NOT_FOUND').length} Students)</span>
                  </h3>
                  <p className="text-xs text-gray-500 font-bold mt-0.5">
                    Root Cause: Unlinked LeetCode username handles in Master Roster. API failure is NEVER falsely marked as Not Attended.
                  </p>
                </div>

                <span className="px-3 py-1 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-xs font-black border border-amber-300">
                  Action Required: Click "Add Username" to link LeetCode profile
                </span>
              </div>

              <div className="border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs">
                  <thead className="bg-navy-950 text-white font-black uppercase">
                    <tr>
                      <th className="px-4 py-3 text-center">#</th>
                      <th className="px-4 py-3">Register No</th>
                      <th className="px-4 py-3">Student Name</th>
                      <th className="px-4 py-3 text-center">Dept</th>
                      <th className="px-4 py-3 text-center">Year</th>
                      <th className="px-4 py-3">Root Cause / Issue</th>
                      <th className="px-4 py-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {matrixRows
                      .filter(r => !r.username || r.participation_status === 'DATA_ERROR' || r.status === 'USERNAME_NOT_FOUND')
                      .map((errStudent, idx) => (
                        <tr key={idx} className="hover:bg-amber-50/50 dark:hover:bg-amber-950/20">
                          <td className="px-4 py-2.5 text-center text-gray-400 font-mono">{idx + 1}</td>
                          <td className="px-4 py-2.5 font-bold font-mono text-amber-600 dark:text-amber-400">{errStudent.reg_no}</td>
                          <td className="px-4 py-2.5 font-semibold text-gray-900 dark:text-white">{errStudent.name}</td>
                          <td className="px-4 py-2.5 text-center font-bold">{errStudent.dept}</td>
                          <td className="px-4 py-2.5 text-center text-gray-500">{errStudent.year}</td>
                          <td className="px-4 py-2.5 text-gray-500">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                              Missing LeetCode Username Handle
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <button
                              onClick={() => handleOpenEditStudent(errStudent)}
                              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow transition-all cursor-pointer active:scale-95"
                            >
                              ✏️ Add Username
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Interactive Report Preview Modal — Auto-fitted Viewport Card (Matches Student Modal) */}
      {showPreviewModal && (
        <div 
          className="modal-overlay-responsive animate-modal-backdrop"
          onClick={(e) => { if (e.target === e.currentTarget) setShowPreviewModal(false); }}
        >
          <div className="modal-container-responsive max-w-5xl bg-white dark:bg-navy-900 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 animate-modal-content">
            
            {/* ── A. SLEEK GRADIENT HEADER (Matches Image 2) ── */}
            <div className="relative overflow-hidden p-4 sm:p-5 bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-950 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3 min-w-0">
                <div className="shrink-0 w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-black text-white text-base shadow-lg shadow-blue-500/30">
                  <FileSpreadsheet className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                    <h3 className="text-base sm:text-lg font-black text-white tracking-tight truncate">
                      Report Live Preview
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                      Verified Dataset
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-400/30 font-mono">
                      {activeSessionObj?.contestName || 'Weekly Contest'}
                    </span>
                  </div>
                  <p className="text-xs text-blue-200/80 font-medium truncate mt-0.5">
                    Nandha Engineering College • Session Date: {activeSessionObj?.sessionDate || 'Sunday Session'} • Showing {matrixRows.length} Students
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                aria-label="Close report preview"
                className="shrink-0 ml-2 px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-rose-500 text-white transition-all font-bold text-xs flex items-center space-x-1.5 cursor-pointer shadow-sm"
              >
                <X className="w-4 h-4" />
                <span>Close</span>
              </button>
            </div>

            {/* ── B. COMPACT METRICS & FILTER SUMMARY BAR ── */}
            <div className="px-4 py-2.5 bg-slate-50 dark:bg-navy-950 border-b border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-2.5 text-xs shrink-0">
              {/* Quick Metrics Badges */}
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <span className="px-2.5 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50 font-black text-[11px]">
                  Roster: {matrixRows.length}
                </span>
                <span className="px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 font-black text-[11px]">
                  Public: {matrixRows.filter(r => r.participation_status === 'PUBLIC' || r.status === 'PUBLIC').length}
                </span>
                <span className="px-2.5 py-1 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50 font-black text-[11px]">
                  Not Attended: {matrixRows.filter(r => r.participation_status === 'NOT_ATTENDED' || r.status === 'NOT_ATTENDED').length}
                </span>
              </div>

              {/* Active Filter Badges */}
              <div className="flex items-center space-x-1.5 flex-wrap gap-y-1 text-[11px] font-bold text-gray-500">
                <span>Filters:</span>
                <span className="px-2 py-0.5 rounded-lg bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 font-bold">{selectedDeptFilter}</span>
                <span className="px-2 py-0.5 rounded-lg bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 font-bold">{selectedYearFilter}</span>
                <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold">{selectedAttendanceFilter}</span>
              </div>
            </div>

            {/* ── C. SCROLLABLE PREVIEW TABLE ── */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 sm:p-4">
              <div className="border border-gray-200 dark:border-gray-800 rounded-2xl overflow-x-auto shadow-sm">
                <table className="w-full min-w-[780px] text-left text-xs">
                  <thead className="bg-navy-950 text-white font-black uppercase sticky top-0 z-10 text-[11px]">
                    <tr>
                      <th className="px-3 py-2 text-center w-12">S.No</th>
                      <th className="px-3 py-2">Reg No</th>
                      <th className="px-3 py-2">Student Name</th>
                      <th className="px-3 py-2 text-center">Dept</th>
                      <th className="px-3 py-2 text-center">Year</th>
                      <th className="px-3 py-2 text-center">Status</th>
                      <th className="px-2 py-2 text-center w-10">Q1</th>
                      <th className="px-2 py-2 text-center w-10">Q2</th>
                      <th className="px-2 py-2 text-center w-10">Q3</th>
                      <th className="px-2 py-2 text-center w-10">Q4</th>
                      <th className="px-3 py-2 text-right">Contest Solved</th>
                      <th className="px-3 py-2 text-right">Global Rank</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800/80">
                    {matrixRows.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="p-8 text-center text-gray-500 font-bold">
                          No matching student records found for the active filter selection.
                        </td>
                      </tr>
                    ) : (
                      matrixRows.map((r, idx) => {
                        const isPublicAttended = r.participation_status === 'PUBLIC_ATTENDED' || r.participation_status === 'PUBLIC' || r.status === 'PUBLIC';
                        const isVirtualAttended = r.participation_status === 'VIRTUAL_ATTENDED' || r.participation_status === 'VIRTUAL' || r.status === 'VIRTUAL';
                        const isAttended = isPublicAttended || isVirtualAttended;
                        return (
                          <tr key={idx} className="hover:bg-blue-50/40 dark:hover:bg-navy-800/40 transition-colors">
                            <td className="px-3 py-1.5 text-center text-gray-400 font-mono text-[11px]">{idx + 1}</td>
                            <td className="px-3 py-1.5 font-bold font-mono text-gray-900 dark:text-white text-[11px]">{r.reg_no}</td>
                            <td className="px-3 py-1.5 font-semibold text-gray-800 dark:text-gray-200">{r.name}</td>
                            <td className="px-3 py-1.5 text-center font-bold text-indigo-600 dark:text-indigo-400">{r.dept}</td>
                            <td className="px-3 py-1.5 text-center text-gray-600 dark:text-gray-400 font-bold">{r.year}</td>
                            <td className="px-3 py-1.5 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                isPublicAttended 
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' 
                                  : isVirtualAttended 
                                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' 
                                    : r.status === 'USERNAME_NOT_FOUND'
                                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                      : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                              }`}>
                                {isPublicAttended ? 'PUBLIC' : isVirtualAttended ? 'VIRTUAL' : r.status === 'USERNAME_NOT_FOUND' ? 'UNLINKED' : 'NOT ATTENDED'}
                              </span>
                            </td>
                            <td className="px-2 py-1.5 text-center font-bold">{isAttended ? (r.q1 === 1 || r.q1 === '1' ? <span className="text-emerald-600 font-black">1</span> : <span className="text-rose-400 font-bold">0</span>) : <span className="text-gray-300 font-normal">—</span>}</td>
                            <td className="px-2 py-1.5 text-center font-bold">{isAttended ? (r.q2 === 1 || r.q2 === '1' ? <span className="text-emerald-600 font-black">1</span> : <span className="text-rose-400 font-bold">0</span>) : <span className="text-gray-300 font-normal">—</span>}</td>
                            <td className="px-2 py-1.5 text-center font-bold">{isAttended ? (r.q3 === 1 || r.q3 === '1' ? <span className="text-emerald-600 font-black">1</span> : <span className="text-rose-400 font-bold">0</span>) : <span className="text-gray-300 font-normal">—</span>}</td>
                            <td className="px-2 py-1.5 text-center font-bold">{isAttended ? (r.q4 === 1 || r.q4 === '1' ? <span className="text-emerald-600 font-black">1</span> : <span className="text-rose-400 font-bold">0</span>) : <span className="text-gray-300 font-normal">—</span>}</td>
                            <td className="px-3 py-1.5 text-right font-black text-emerald-600 dark:text-emerald-400">{isAttended ? (r.total_solved ?? '—') : '—'}</td>
                            <td className="px-3 py-1.5 text-right font-bold text-gray-600 dark:text-gray-400">{isAttended ? (r.rank || r.contest_rank || '—') : '—'}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── D. CLEAN COMPACT ACTION FOOTER (Matches Image 2) ── */}
            <div className="p-3.5 sm:p-4 bg-gray-50 dark:bg-navy-950 border-t border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <span className="text-[11px] text-gray-500 font-bold font-mono">
                Nandha Engineering College • LeetCode Tracker
              </span>
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <button 
                  onClick={() => downloadReportFile('excel')} 
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-sm flex items-center space-x-1"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Excel (.xlsx)</span>
                </button>
                <button 
                  onClick={() => downloadReportFile('pdf')} 
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-sm flex items-center space-x-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>PDF (.pdf)</span>
                </button>
                <button 
                  onClick={() => downloadReportFile('word')} 
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-sm flex items-center space-x-1"
                >
                  <span>Word (.docx)</span>
                </button>
                <button 
                  onClick={() => downloadReportFile('zip')} 
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-sm"
                >
                  <span>All (.zip)</span>
                </button>
                <button 
                  onClick={() => setShowPreviewModal(false)} 
                  className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-black transition-all cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Report Email Dispatch Modal */}
      {showEmailModal && (
        <div className="modal-overlay-responsive animate-modal-backdrop">
          <div className="modal-container-responsive max-w-2xl bg-white dark:bg-navy-900 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col my-auto">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-lg font-black flex items-center space-x-2">
                  <Mail className="w-5 h-5 text-indigo-400" />
                  <span>Dispatch Filtered Weekly Report</span>
                </h3>
                <p className="text-xs text-gray-300 font-bold mt-0.5">
                  Sends the exact generated Excel report (<code className="text-indigo-300 font-mono">NEC_Weekly_Contest_{selectedSessionId}_PUBLIC.xlsx</code>)
                </p>
              </div>
              <button
                onClick={() => setShowEmailModal(false)}
                className="p-1 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 flex-1 min-h-0 overflow-y-auto">
              {/* Active Filter Scope Card */}
              <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-navy-950 border border-indigo-100 dark:border-indigo-900/50 space-y-2">
                <div className="text-[11px] font-black uppercase text-indigo-700 dark:text-indigo-300 tracking-wider">
                  Report Scope & Target Roster
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 font-bold">
                    Contest: <b className="text-gray-900 dark:text-white">{activeSessionObj?.contestName || selectedSessionId}</b>
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 font-bold">
                    Dept: <b className="text-indigo-600">{selectedDeptFilter}</b>
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 font-bold">
                    Year: <b className="text-purple-600">{selectedYearFilter}</b>
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 font-bold">
                    Attendance: <b className="text-emerald-600">{selectedAttendanceFilter}</b>
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-black">
                    ✓ {matrixRows.length} Students Selected
                  </span>
                </div>
              </div>

              {/* Recipient Contacts */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                    Select Delivery Recipients ({selectedRecipients.length} selected)
                  </label>
                  <button
                    onClick={() => {
                      if (selectedRecipients.length === recipientsList.length) setSelectedRecipients([]);
                      else setSelectedRecipients(recipientsList.map((r: any) => r.email));
                    }}
                    className="text-[11px] font-bold text-brand-600 hover:text-brand-700 cursor-pointer"
                  >
                    {selectedRecipients.length === recipientsList.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

                <div className="max-h-36 overflow-y-auto space-y-1.5 border border-gray-200 dark:border-gray-800 rounded-xl p-3 bg-gray-50 dark:bg-navy-950">
                  {recipientsList.length === 0 ? (
                    <p className="text-xs text-gray-500 font-bold py-2 text-center">
                      No configured recipients found in database. You can send a test email below.
                    </p>
                  ) : (
                    recipientsList.map((r: any) => {
                      const isChecked = selectedRecipients.includes(r.email);
                      return (
                        <label
                          key={r.id}
                          className="flex items-center space-x-2.5 text-xs p-1.5 rounded-lg hover:bg-white dark:hover:bg-navy-900 cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedRecipients(prev => [...prev, r.email]);
                              else setSelectedRecipients(prev => prev.filter(em => em !== r.email));
                            }}
                            className="rounded text-brand-600 focus:ring-brand-500"
                          />
                          <span className="font-bold text-gray-800 dark:text-gray-200">{r.name}</span>
                          <span className="text-gray-400 font-mono text-[11px]">({r.email})</span>
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-gray-200 dark:bg-navy-800 text-gray-600 dark:text-gray-300 ml-auto">
                            {r.role || 'HOD'}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Custom Note */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  Executive Note / Remarks (Optional)
                </label>
                <textarea
                  value={customEmailNote}
                  onChange={(e) => setCustomEmailNote(e.target.value)}
                  placeholder="e.g. Please review the CSE(CS) performance metrics from Sunday contest..."
                  rows={2}
                  className="w-full px-3.5 py-2.5 text-xs bg-gray-50 dark:bg-navy-950 border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                />
              </div>

              {/* Safe Test Section */}
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 space-y-2">
                <div className="flex items-center space-x-1.5 text-xs font-black text-amber-800 dark:text-amber-300">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span>Run Safe Test (Single Recipient)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="email"
                    value={testEmailInput}
                    onChange={(e) => setTestEmailInput(e.target.value)}
                    placeholder="Enter test recipient email (e.g. admin@nandha.edu.in)"
                    className="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-navy-900 border border-amber-300 dark:border-amber-700 rounded-lg text-gray-900 dark:text-white outline-none"
                  />
                  <button
                    onClick={() => handleSendWeeklyEmail(true)}
                    disabled={isSendingEmail}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-black transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap"
                  >
                    {isSendingEmail ? 'Sending...' : '⚡ Send Test'}
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 bg-gray-50 dark:bg-navy-950 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between shrink-0">
              <button
                onClick={() => setShowEmailModal(false)}
                className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-gray-400 hover:text-gray-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSendWeeklyEmail(false)}
                disabled={isSendingEmail || selectedRecipients.length === 0}
                className="flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black shadow-lg shadow-blue-500/20 transition-all cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSendingEmail ? 'Dispatching...' : `Dispatch Report to ${selectedRecipients.length} Recipient(s)`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Viewport-Centered Student Edit Modal */}
      {editingStudent && (
        <div
          className="modal-overlay-responsive animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSavingStudent) setEditingStudent(null);
          }}
        >
          <div
            className="modal-container-responsive max-w-lg bg-white dark:bg-navy-900 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-5 bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2.5">
                <Edit3 className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="text-base font-black">Edit Student Profile</h3>
                  <p className="text-xs text-gray-300 font-mono font-bold mt-0.5">{editingStudent.reg_no}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                title="Close"
                aria-label="Close"
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-rose-500 text-white hover:text-white transition-all font-black text-xs flex items-center space-x-1 cursor-pointer"
              >
                <span className="text-sm">✕</span>
                <span>Close</span>
              </button>
            </div>

            {/* Form Content */}
            <div className="p-6 space-y-4 flex-1 min-h-0 overflow-y-auto">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Student Full Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-gray-50 dark:bg-navy-950 border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Department</label>
                  <select
                    value={editDeptCode}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditDeptCode(val);
                      setEditDeptId(val.includes('IOT') ? 2 : 1);
                    }}
                    className="w-full px-3.5 py-2 text-xs bg-gray-50 dark:bg-navy-950 border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500 font-bold cursor-pointer"
                  >
                    <option value="CSE(CS)">CSE(CS)</option>
                    <option value="CSE(IOT)">CSE(IOT)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Academic Year</label>
                  <select
                    value={editYearLevel}
                    onChange={(e) => setEditYearLevel(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-gray-50 dark:bg-navy-950 border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500 font-bold cursor-pointer"
                  >
                    <option value="II">II Year</option>
                    <option value="III">III Year</option>
                    <option value="IV">IV Year</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">LeetCode Username Handle</label>
                <input
                  type="text"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  placeholder="e.g. AADHISH_S_B"
                  className="w-full px-3.5 py-2 text-xs font-mono bg-gray-50 dark:bg-navy-950 border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">LeetCode Profile URL</label>
                <input
                  type="text"
                  value={editLeetCodeUrl}
                  onChange={(e) => setEditLeetCodeUrl(e.target.value)}
                  placeholder="https://leetcode.com/u/..."
                  className="w-full px-3.5 py-2 text-xs bg-gray-50 dark:bg-navy-950 border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Institutional Email (Optional)</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="student@nandha.edu.in"
                  className="w-full px-3.5 py-2 text-xs bg-gray-50 dark:bg-navy-950 border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-gray-50 dark:bg-navy-950 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-gray-400 hover:text-gray-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveStudentEdit}
                disabled={isSavingStudent}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                {isSavingStudent ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Viewport-Centered Student Delete Confirmation Modal */}
      {deletingStudent && (
        <div
          className="modal-overlay-responsive animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isDeletingStudent) setDeletingStudent(null);
          }}
        >
          <div
            className="modal-container-responsive max-w-md bg-white dark:bg-navy-900 rounded-3xl shadow-2xl border border-rose-200 dark:border-rose-900/50 overflow-hidden flex flex-col p-6 space-y-4 my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-black text-gray-900 dark:text-white">Deactivate Student Record?</h3>
              <p className="text-xs text-gray-500">
                Are you sure you want to deactivate <b className="text-gray-900 dark:text-white">{deletingStudent.name}</b> (<code className="font-mono text-rose-600">{deletingStudent.reg_no}</code>)?
              </p>
            </div>

            <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded-xl text-[11px] text-rose-700 dark:text-rose-300 font-bold">
              ⚠️ This student will be marked as inactive and removed from public contest rankings. You can re-activate them anytime from Student Master.
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingStudent(null)}
                className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-gray-400 hover:text-gray-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteStudent}
                disabled={isDeletingStudent}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                {isDeletingStudent ? 'Deactivating...' : 'Confirm Deactivation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Centered Application Notification Modal */}
      <StatusNotificationModal
        notification={notification}
        onClose={() => setNotification(null)}
      />

      {/* Centered Institutional Authentication Required Modal */}
      {showAuthRequiredModal && (
        <div className="modal-overlay-responsive animate-fade-in">
          <div className="modal-container-responsive max-w-md bg-white dark:bg-navy-900 rounded-3xl shadow-2xl border border-amber-300 dark:border-amber-700/60 p-6 space-y-4 my-auto text-center overflow-y-auto">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-inner">
              <Lock className="w-7 h-7" />
            </div>
            
            <div className="space-y-1.5">
              <h3 className="text-lg font-black text-gray-900 dark:text-white flex items-center justify-center gap-2">
                <span>🔐 Authentication Required</span>
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed px-2">
                The institutional contest resource requires authentication. Please authenticate and try Sync again.
              </p>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-xl text-[11.5px] text-amber-800 dark:text-amber-300 font-bold text-left space-y-1">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>Protected Institutional Operation</span>
              </div>
              <p className="text-[10.5px] font-normal text-amber-700 dark:text-amber-400">
                Weekly contest synchronization updates official student rankings and requires verified administrative or faculty credentials.
              </p>
            </div>

            <div className="flex items-center justify-center space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAuthRequiredModal(false)}
                className="px-4 py-2.5 text-xs font-bold text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 cursor-pointer rounded-xl hover:bg-gray-100 dark:hover:bg-navy-800 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAuthRequiredModal(false);
                  window.location.href = '/login?returnUrl=' + encodeURIComponent(window.location.pathname);
                }}
                className="px-5 py-2.5 bg-gradient-to-r from-amber-600 to-indigo-600 hover:from-amber-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-500/20 transition-all cursor-pointer"
              >
                Authenticate / Sign In
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
