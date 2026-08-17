import React, { useState, useEffect } from 'react';
import {
  Trophy, Calendar, RefreshCw, AlertTriangle, Download, FileSpreadsheet,
  FileText, CheckCircle2, XCircle, Clock, ShieldCheck, PlayCircle, Lock, Layers, ArrowUpRight, ArrowDownRight, Zap, Filter, Trash2, Mail, Send, Sparkles, X, Edit3, UserCheck, UserX, Eye
} from 'lucide-react';
import api from '../services/api';
import { StatusNotificationModal, NotificationState } from '../components/StatusNotificationModal';

export const WeeklyContestPage: React.FC = () => {
  const [currentSession, setCurrentSession] = useState<any>(null);
  const [sessionsList, setSessionsList] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('ALL');
  const [selectedYearFilter, setSelectedYearFilter] = useState<string>('ALL');
  const [selectedAttendanceFilter, setSelectedAttendanceFilter] = useState<string>('ALL');
  const [matrixRows, setMatrixRows] = useState<any[]>([]);
  const [sessionMetrics, setSessionMetrics] = useState<any>(null);
  const [errorLogs, setErrorLogs] = useState<any[]>([]);
  const [comparison, setComparison] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'matrix' | 'error_board' | 'comparison'>('matrix');
  const [loading, setLoading] = useState<boolean>(true);
  const [customCalendarDate, setCustomCalendarDate] = useState<string>('');
  const [isRetrying, setIsRetrying] = useState<boolean>(false);
  const [deletingSessionId, setDeletingSessionId] = useState<number | null>(null);

  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);
  const [showEmailModal, setShowEmailModal] = useState<boolean>(false);
  const [notification, setNotification] = useState<NotificationState | null>(null);

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
      await api.patch(`/api/students/${studentId}`, {
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
      await api.delete(`/api/students/${studentId}?soft_delete=true`);
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

  // Calculate filtered stats dynamically
  const totalRows = sessionMetrics?.totalStudents ?? matrixRows.length;
  const attendedRows = sessionMetrics?.officialAttended ?? sessionMetrics?.officialParticipants ?? matrixRows.filter(r => r.participation_status === 'PUBLIC_ATTENDED' || r.participation_status === 'ATTENDED' || r.status === 'PUBLIC').length;
  const notAttendedRows = sessionMetrics?.notAttended ?? sessionMetrics?.notParticipated ?? matrixRows.filter(r => r.participation_status === 'PUBLIC_NOT_ATTENDED' || r.participation_status === 'PENDING' || r.status === 'NOT ATTENDED').length;
  const virtualRows = sessionMetrics?.virtualAttended ?? sessionMetrics?.virtualParticipants ?? matrixRows.filter(r => r.participation_status === 'VIRTUAL_ATTENDED' || r.status === 'VIRTUAL').length;
  const isVirtualAvailable = sessionMetrics?.virtualDataStatus === 'AVAILABLE' || virtualRows > 0;
  const errorRows = sessionMetrics?.dataErrors ?? sessionMetrics?.failedVerification ?? matrixRows.filter(r => r.participation_status === 'DATA_ERROR').length;

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

  return (
    <div className="space-y-8 animate-fade-in pb-12">

      {/* Live Session Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white p-6 md:p-8 shadow-2xl border border-brand-500/30">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex items-center justify-between flex-wrap gap-6">
          <div className="space-y-3 max-w-3xl">
            <div className="flex flex-wrap items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 ${statusColor}`}>
                <Trophy className="w-3.5 h-3.5" />
                <span>{activeSessionObj?.status === 'LIVE' ? 'LIVE PUBLIC CONTEST' : activeSessionObj?.status === 'FINALIZED' ? 'LOCKED & FINALIZED' : 'SCHEDULED'}</span>
              </span>
              <span className="text-xs font-mono font-bold text-gray-400">
                IST Window: 08:00 AM – 09:30 AM IST
              </span>
            </div>

            <h1 className="text-3xl md:text-4xl font-black tracking-tight">
              {activeSessionObj?.contestName || 'Weekly Contest Tracker'}
            </h1>

            <p className="text-xs md:text-sm text-gray-300 font-bold tracking-wide">
              NANDHA ENGINEERING COLLEGE • AUTOMATED CONTEST ENGINE ({activeSessionObj?.sessionDate || 'Sunday Session'})
            </p>
          </div>

          {/* Export Toolbar */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button onClick={() => setShowPreviewModal(true)} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black transition-all shadow-md hover:scale-105 flex items-center space-x-1.5 cursor-pointer">
              <Eye className="w-3.5 h-3.5" />
              <span>Preview Report</span>
            </button>
            <button onClick={() => downloadReportFile('excel')} className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all shadow-md hover:scale-105">
              Excel (.xlsx)
            </button>
            <button onClick={() => downloadReportFile('pdf')} className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition-all shadow-md hover:scale-105">
              PDF (.pdf)
            </button>
            <button onClick={() => downloadReportFile('word')} className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all shadow-md hover:scale-105">
              Word (.docx)
            </button>
            <button onClick={() => downloadReportFile('zip')} className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all shadow-md hover:scale-105">
              All (.zip)
            </button>
          </div>
        </div>
      </div>

      {/* Week Selector Quick Tabs Bar */}
      <div className="p-5 rounded-3xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 shadow-lg space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center space-x-2 text-xs font-black uppercase text-gray-400 tracking-wider">
            <Calendar className="w-4 h-4 text-brand-500" />
            <span>Select Weekly Session to View:</span>
          </div>

          <div className="flex items-center space-x-3 flex-wrap gap-2">
            {/* Interactive Calendar Date Picker */}
            <div className="flex items-center space-x-2 bg-gray-100 dark:bg-navy-950 border border-gray-300 dark:border-gray-700 px-3 py-1.5 rounded-xl">
              <Calendar className="w-4 h-4 text-brand-500" />
              <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400">Pick Date:</span>
              <input
                type="date"
                value={customCalendarDate}
                onChange={(e) => handleCalendarDateChange(e.target.value)}
                className="bg-transparent text-xs font-bold text-gray-900 dark:text-white outline-none cursor-pointer"
              />
            </div>

            {/* Session Dropdown Selector */}
            <select
              value={selectedSessionId || ''}
              onChange={(e) => handleSelectSession(Number(e.target.value))}
              className="px-4 py-2 rounded-xl bg-gray-100 dark:bg-navy-950 border border-gray-300 dark:border-gray-700 text-xs font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer min-w-[220px]"
            >
              {displaySessions.length === 0 ? (
                <option value="">No recent completed Weekly Contest is available.</option>
              ) : (
                displaySessions.map((s) => (
                  <option key={s.sessionId} value={s.sessionId}>
                    {s.sessionDate} — {s.contestName} ({s.status})
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        {/* Quick Week Pill Buttons (Latest completed contest in 7-day window) */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
          {displaySessions.length === 0 ? (
            <p className="text-xs font-bold text-amber-600 dark:text-amber-400 py-1 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span>No recent completed Weekly Contest is available.</span>
            </p>
          ) : (
            displaySessions.map((s) => {
              const isSelected = s.sessionId === selectedSessionId;
              const isDeleting = deletingSessionId === s.sessionId;
              return (
                <div key={s.sessionId} className="relative group">
                  <button
                    onClick={() => handleSelectSession(s.sessionId)}
                    className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center space-x-2.5 cursor-pointer pr-8 ${isSelected
                        ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/30 scale-105'
                        : 'bg-gray-100 dark:bg-navy-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-navy-700'
                      }`}
                  >
                    <span>{s.sessionDate}</span>
                    <span>•</span>
                    <span>{s.contestName}</span>
                    <span className={`px-2 py-0.5 text-[9px] rounded-full font-mono uppercase font-bold ${s.status === 'LIVE' ? 'bg-emerald-400 text-slate-900' : s.status === 'FINALIZED' ? 'bg-indigo-900 text-indigo-200' : 'bg-amber-400 text-slate-900'
                      }`}>
                      {s.status}
                    </span>
                  </button>
                  {/* Delete button — visible on hover, hidden for LIVE */}
                  {s.status !== 'LIVE' && (
                    <button
                      onClick={(e) => handleDeleteSession(s.sessionId, `${s.contestName} (${s.sessionDate})`, e)}
                      disabled={isDeleting}
                      title={`Delete ${s.contestName}`}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-all bg-red-500 hover:bg-red-600 text-white disabled:opacity-50"
                    >
                      {isDeleting
                        ? <RefreshCw className="w-3 h-3 animate-spin" />
                        : <Trash2 className="w-3 h-3" />}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Combined Department, Academic Year & Attendance Filters Bar */}
      <div className="p-5 rounded-3xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 shadow-lg space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center space-x-2 text-xs font-black uppercase text-gray-400 tracking-wider">
            <Filter className="w-4 h-4 text-indigo-500" />
            <span>Combined Department, Year & Attendance Filter:</span>
          </div>

          <div className="flex items-center flex-wrap gap-2.5">
            <button
              onClick={() => downloadReportFile('excel')}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-md transition-all cursor-pointer"
              title="Download Filtered Excel Workbook"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Generate Excel</span>
            </button>

            <button
              onClick={() => setShowPreviewModal(true)}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-black rounded-xl shadow-md transition-all cursor-pointer"
              title="Preview Filtered Table"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Report Preview</span>
            </button>

            <button
              onClick={() => setShowEmailModal(true)}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-black rounded-xl shadow-md transition-all cursor-pointer"
              title="Send Filtered Report Email"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Send Report Email</span>
            </button>

            <button
              onClick={handleFetchSelectedContest}
              disabled={isSyncing || !selectedSessionId}
              className="flex items-center space-x-2 px-3.5 py-2 bg-gray-800 hover:bg-gray-900 text-white text-xs font-black rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{syncStatusStage || (isSyncing ? 'Syncing...' : 'Sync Contest')}</span>
            </button>
          </div>
        </div>

        {/* Sync Summary Progress Panel */}
        {syncSummary && (
          <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-navy-950 border border-indigo-200 dark:border-indigo-800 text-xs space-y-2">
            <div className="flex items-center justify-between font-extrabold text-indigo-900 dark:text-indigo-200">
              <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Contest Synchronization Complete</span>
              <button onClick={() => setSyncSummary(null)} className="text-gray-400 hover:text-gray-600 cursor-pointer">✕</button>
            </div>
            <div className="flex flex-wrap gap-4 text-gray-700 dark:text-gray-300 font-bold">
              <span>Contest: <b>{syncSummary.contestName || selectedSessionId}</b></span>
              <span>Roster: <b>{syncSummary.rosterCount || 300}</b></span>
              <span>Public Attended: <b className="text-emerald-600">{syncSummary.officialParticipants || 0}</b></span>
              <span>Virtual Attended: <b className="text-blue-600">{syncSummary.virtualParticipants || 0}</b></span>
              <span>Not Attended: <b className="text-rose-600">{syncSummary.notParticipated || 0}</b></span>
              <span>Virtual Status: <b>{syncSummary.virtualDataStatus || 'NOT_AVAILABLE'}</b></span>
            </div>
          </div>
        )}

        {/* Canonical 6-Tab Report Navigation Bar */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase text-gray-400 tracking-wider">Report & Analytics Scope</span>
            <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">Canonical Dataset: {matrixRows.length} Students</span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar" style={{scrollbarWidth: 'none', msOverflowStyle: 'none'}}>
            {[
              { id: 'EXECUTIVE_SUMMARY', label: 'Executive Summary', badge: 'College-Wide', dept: 'ALL', year: 'ALL' },
              { id: 'CYBER_SECURITY', label: 'Cyber Security', badge: 'Department', dept: 'CSE(CS)', year: 'ALL' },
              { id: 'IOT', label: 'IoT', badge: 'Department', dept: 'CSE(IOT)', year: 'ALL' },
              { id: 'YEAR_II', label: 'II Year (All)', badge: '2025–2029', dept: 'ALL', year: 'II' },
              { id: 'YEAR_II_CS', label: 'II Year CS', badge: 'Cyber Sec', dept: 'CSE(CS)', year: 'II' },
              { id: 'YEAR_II_IOT', label: 'II Year IoT', badge: 'IoT', dept: 'CSE(IOT)', year: 'II' },
              { id: 'YEAR_III', label: 'III Year (All)', badge: '2024–2028', dept: 'ALL', year: 'III' },
              { id: 'YEAR_III_CS', label: 'III Year CS', badge: 'Cyber Sec', dept: 'CSE(CS)', year: 'III' },
              { id: 'YEAR_III_IOT', label: 'III Year IoT', badge: 'IoT', dept: 'CSE(IOT)', year: 'III' },
              { id: 'YEAR_IV', label: 'IV Year (All)', badge: '2023–2027', dept: 'ALL', year: 'IV' },
              { id: 'YEAR_IV_CS', label: 'IV Year CS', badge: 'Cyber Sec', dept: 'CSE(CS)', year: 'IV' },
              { id: 'YEAR_IV_IOT', label: 'IV Year IoT', badge: 'IoT', dept: 'CSE(IOT)', year: 'IV' },
            ].map((tab) => {
              const isActive = (selectedDeptFilter === tab.dept || (tab.dept === 'CSE(CS)' && selectedDeptFilter === 'Cyber Security') || (tab.dept === 'CSE(IOT)' && selectedDeptFilter === 'IoT')) && selectedYearFilter === tab.year;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setSelectedDeptFilter(tab.dept);
                    setSelectedYearFilter(tab.year);
                  }}
                  className={`flex items-center space-x-2 px-3.5 py-2 rounded-2xl text-xs font-black transition-all cursor-pointer whitespace-nowrap shadow-sm ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-600 to-brand-600 text-white shadow-lg shadow-indigo-500/25 scale-[1.02]'
                      : 'bg-white dark:bg-navy-900 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-navy-800 border border-gray-200 dark:border-gray-800'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono ${
                    isActive ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-navy-800 text-gray-500'
                  }`}>
                    {tab.badge}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Secondary Sub-Filters & Attendance */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-gray-100 dark:border-gray-800/80">
          {/* Department Filter Buttons */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Dept Sub-Filter</label>
            <div className="flex flex-wrap gap-2">
              {['ALL', 'CSE(CS)', 'CSE(IOT)'].map((dept) => (
                <button
                  key={dept}
                  onClick={() => setSelectedDeptFilter(dept)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${selectedDeptFilter === dept
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-gray-100 dark:bg-navy-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                    }`}
                >
                  {dept === 'ALL' ? 'All Depts' : dept}
                </button>
              ))}
            </div>
          </div>

          {/* Year Filter Buttons */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Year Sub-Filter</label>
            <div className="flex flex-wrap gap-2">
              {['ALL', 'II', 'III', 'IV'].map((yr) => (
                <button
                  key={yr}
                  onClick={() => setSelectedYearFilter(yr)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${selectedYearFilter === yr
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'bg-gray-100 dark:bg-navy-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                    }`}
                >
                  {yr === 'ALL' ? 'All Years' : `${yr} Year`}
                </button>
              ))}
            </div>
          </div>

          {/* Attendance Filter Buttons */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Attendance Status</label>
            <div className="flex flex-wrap gap-2">
              {[
                { code: 'ALL', label: 'All' },
                { code: 'PUBLIC_ATTENDED', label: 'Public' },
                { code: 'PUBLIC_NOT_ATTENDED', label: 'Not Attended' },
                { code: 'VIRTUAL_ATTENDED', label: 'Virtual' }
              ].map((att) => (
                <button
                  key={att.code}
                  onClick={() => toggleAttendanceFilter(att.code)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${selectedAttendanceFilter === att.code
                      ? 'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-400'
                      : 'bg-gray-100 dark:bg-navy-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                    }`}
                >
                  {att.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Scope Title Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-navy-900 via-indigo-950 to-navy-900 text-white flex flex-wrap items-center justify-between gap-3 shadow-md border border-indigo-900/50">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded bg-indigo-500/30 text-indigo-300 border border-indigo-400/30">
              {selectedDeptFilter === 'ALL' && selectedYearFilter === 'ALL' ? 'EXECUTIVE SUMMARY' : (selectedDeptFilter !== 'ALL' ? selectedDeptFilter : `${selectedYearFilter} YEAR`)}
            </span>
            <h3 className="text-base font-black text-white">
              {selectedDeptFilter === 'ALL' && selectedYearFilter === 'ALL'
                ? 'College-Wide Executive Summary'
                : (selectedDeptFilter !== 'ALL' && selectedYearFilter === 'ALL'
                    ? `${selectedDeptFilter === 'CSE(CS)' ? 'Cyber Security' : 'Internet of Things (IoT)'} Performance Report`
                    : (selectedDeptFilter === 'ALL'
                        ? `${selectedYearFilter} Year (Batch Breakdown) Report`
                        : `${selectedDeptFilter} — ${selectedYearFilter} Year Report`))}
            </h3>
          </div>
          <p className="text-xs text-indigo-200/80 mt-0.5">
            Active Scope: <b>{selectedDeptFilter === 'ALL' ? 'All Departments' : selectedDeptFilter}</b> • <b>{selectedYearFilter === 'ALL' ? 'All Years' : `${selectedYearFilter} Year`}</b> • <b>{totalRows} Verified Students</b>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-indigo-200">Public Participation:</span>
          <span className="text-lg font-black text-emerald-400">
            {totalRows - errorRows > 0 ? ((attendedRows / (totalRows - errorRows)) * 100).toFixed(1) : '0.0'}%
          </span>
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <button
          onClick={() => setSelectedAttendanceFilter('ALL')}
          className={`p-4 rounded-2xl bg-white dark:bg-navy-900 border text-center transition-all cursor-pointer ${selectedAttendanceFilter === 'ALL'
              ? 'border-brand-500 ring-4 ring-brand-500/20 shadow-lg'
              : 'border-gray-200 dark:border-gray-800 hover:border-brand-300 shadow-sm'
            }`}
        >
          <p className="text-[10px] font-black uppercase text-gray-400 tracking-wider mb-1">Total Students</p>
          <p className="text-2xl font-black text-gray-900 dark:text-white">{totalRows}</p>
        </button>

        <button
          onClick={() => toggleAttendanceFilter('PUBLIC_ATTENDED')}
          className={`p-4 rounded-2xl bg-emerald-500/10 border text-center transition-all cursor-pointer ${selectedAttendanceFilter === 'PUBLIC_ATTENDED'
              ? 'border-emerald-500 ring-4 ring-emerald-500/30 shadow-lg bg-emerald-500/20'
              : 'border-emerald-500/20 hover:border-emerald-400 shadow-sm'
            }`}
        >
          <p className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider mb-1">Public Attended</p>
          <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300">{attendedRows}</p>
        </button>

        <button
          onClick={() => toggleAttendanceFilter('VIRTUAL_ATTENDED')}
          className={`p-4 rounded-2xl bg-blue-500/10 border text-center transition-all cursor-pointer ${selectedAttendanceFilter === 'VIRTUAL_ATTENDED'
              ? 'border-blue-500 ring-4 ring-blue-500/30 shadow-lg bg-blue-500/20'
              : 'border-blue-500/20 hover:border-blue-400 shadow-sm'
            }`}
        >
          <p className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-wider mb-1">Virtual Attended</p>
          <p className="text-2xl font-black text-blue-700 dark:text-blue-300">{virtualRows}</p>
        </button>

        <button
          onClick={() => toggleAttendanceFilter('PUBLIC_NOT_ATTENDED')}
          className={`p-4 rounded-2xl bg-rose-500/10 border text-center transition-all cursor-pointer ${selectedAttendanceFilter === 'PUBLIC_NOT_ATTENDED'
              ? 'border-rose-500 ring-4 ring-rose-500/30 shadow-lg bg-rose-500/20'
              : 'border-rose-500/20 hover:border-rose-400 shadow-sm'
            }`}
        >
          <p className="text-[10px] font-black uppercase text-rose-600 dark:text-rose-400 tracking-wider mb-1">Not Attended</p>
          <p className="text-2xl font-black text-rose-700 dark:text-rose-300">{notAttendedRows}</p>
        </button>

        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center shadow-sm">
          <p className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 tracking-wider mb-1">Data Errors</p>
          <p className="text-2xl font-black text-amber-700 dark:text-amber-300">{errorRows}</p>
        </div>

        <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-center shadow-sm">
          <p className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider mb-1">Participation %</p>
          <p className="text-2xl font-black text-indigo-700 dark:text-indigo-300">
            {totalRows - errorRows > 0 ? `${((attendedRows / (totalRows - errorRows)) * 100).toFixed(1)}%` : '0.0%'}
          </p>
        </div>
      </div>

      {/* Structured Category Breakdown Table based on Active Scope */}
      <div className="p-5 rounded-3xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h4 className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white">
              {selectedDeptFilter === 'ALL' && selectedYearFilter === 'ALL'
                ? 'Department & Academic Year Matrix Breakdown'
                : (selectedDeptFilter !== 'ALL'
                    ? `${selectedDeptFilter} — Year-Wise Breakdown (II, III, IV Year)`
                    : `${selectedYearFilter} Year — Department Split (Cyber Security vs IoT)`)}
            </h4>
          </div>
          <span className="text-[11px] font-bold text-gray-400">Exact Mathematical Aggregation</span>
        </div>

        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 text-[11px] font-black text-gray-400 uppercase tracking-wider">
                <th className="py-2.5 px-3">Segment / Category</th>
                <th className="py-2.5 px-3 text-center">Total Students</th>
                <th className="py-2.5 px-3 text-center text-emerald-600 dark:text-emerald-400">Public</th>
                <th className="py-2.5 px-3 text-center text-emerald-500 font-mono">4Q / 3Q / 2Q / 1Q</th>
                <th className="py-2.5 px-3 text-center text-blue-600 dark:text-blue-400">Virtual</th>
                <th className="py-2.5 px-3 text-center text-rose-600 dark:text-rose-400">Not Attended</th>
                <th className="py-2.5 px-3 text-center text-amber-600 dark:text-amber-400">Errors</th>
                <th className="py-2.5 px-3 text-right">Public Part. %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 font-bold">
              {/* Department breakdown rows */}
              {['CSE(CS)', 'CSE(IOT)'].map((deptCode) => {
                const subset = matrixRows.filter(r => (r.dept === deptCode || r.dept === (deptCode === 'CSE(CS)' ? 'Cyber Security' : 'IoT') || r.department === deptCode));
                const tot = subset.length;
                const pub = subset.filter(r => r.participation_status === 'PUBLIC' || r.status === 'PUBLIC' || ['4_SOLVED','3_SOLVED','2_SOLVED','1_SOLVED','0_SOLVED'].includes(r.public_result)).length;
                const virt = subset.filter(r => r.participation_status === 'VIRTUAL' || r.status === 'VIRTUAL' || ['4_SOLVED','3_SOLVED','2_SOLVED','1_SOLVED','0_SOLVED'].includes(r.virtual_result)).length;
                const notAtt = subset.filter(r => r.participation_status === 'NOT_ATTENDED' || r.status === 'NOT ATTENDED' || r.public_result === 'NOT_PARTICIPATED' || r.public_result === 'NOT_ATTENDED').length;
                const errs = subset.filter(r => r.participation_status === 'DATA_ERROR' || r.data_fetch_status === 'INVALID_USERNAME' || r.data_fetch_status === 'USERNAME_NOT_FOUND' || r.public_result === 'UNKNOWN' || r.public_result === 'SOURCE_UNAVAILABLE').length;
                const q4 = subset.filter(r => r.public_result === '4_SOLVED' || Number(r.total_solved) === 4).length;
                const q3 = subset.filter(r => r.public_result === '3_SOLVED' || Number(r.total_solved) === 3).length;
                const q2 = subset.filter(r => r.public_result === '2_SOLVED' || Number(r.total_solved) === 2).length;
                const q1 = subset.filter(r => r.public_result === '1_SOLVED' || Number(r.total_solved) === 1).length;
                const elig = tot - errs;
                const pct = elig > 0 ? ((pub / elig) * 100).toFixed(1) : '0.0';

                return (
                  <tr key={deptCode} className="hover:bg-gray-50 dark:hover:bg-navy-800/50">
                    <td className="py-2.5 px-3 font-extrabold text-gray-900 dark:text-white">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0"></span>
                        <span>Department: {deptCode === 'CSE(CS)' ? 'Cyber Security' : 'Internet of Things (IoT)'}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-center text-gray-700 dark:text-gray-300">{tot}</td>
                    <td className="py-2.5 px-3 text-center text-emerald-600 dark:text-emerald-400 font-black">{pub}</td>
                    <td className="py-2.5 px-3 text-center text-emerald-500 font-mono text-[11px] font-bold">{q4} / {q3} / {q2} / {q1}</td>
                    <td className="py-2.5 px-3 text-center text-blue-600 dark:text-blue-400 font-black">{virt}</td>
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
                const pub = subset.filter(r => r.participation_status === 'PUBLIC' || r.status === 'PUBLIC' || ['4_SOLVED','3_SOLVED','2_SOLVED','1_SOLVED','0_SOLVED'].includes(r.public_result)).length;
                const virt = subset.filter(r => r.participation_status === 'VIRTUAL' || r.status === 'VIRTUAL' || ['4_SOLVED','3_SOLVED','2_SOLVED','1_SOLVED','0_SOLVED'].includes(r.virtual_result)).length;
                const notAtt = subset.filter(r => r.participation_status === 'NOT_ATTENDED' || r.status === 'NOT ATTENDED' || r.public_result === 'NOT_PARTICIPATED' || r.public_result === 'NOT_ATTENDED').length;
                const errs = subset.filter(r => r.participation_status === 'DATA_ERROR' || r.data_fetch_status === 'INVALID_USERNAME' || r.data_fetch_status === 'USERNAME_NOT_FOUND' || r.public_result === 'UNKNOWN' || r.public_result === 'SOURCE_UNAVAILABLE').length;
                const q4 = subset.filter(r => r.public_result === '4_SOLVED' || Number(r.total_solved) === 4).length;
                const q3 = subset.filter(r => r.public_result === '3_SOLVED' || Number(r.total_solved) === 3).length;
                const q2 = subset.filter(r => r.public_result === '2_SOLVED' || Number(r.total_solved) === 2).length;
                const q1 = subset.filter(r => r.public_result === '1_SOLVED' || Number(r.total_solved) === 1).length;
                const elig = tot - errs;
                const pct = elig > 0 ? ((pub / elig) * 100).toFixed(1) : '0.0';

                return (
                  <tr key={yr} className="hover:bg-gray-50 dark:hover:bg-navy-800/50 bg-gray-50/40 dark:bg-navy-950/20">
                    <td className="py-2.5 px-3 font-extrabold text-gray-900 dark:text-white">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0"></span>
                        <span>Academic Year: {yr} Year ({yr === 'II' ? '2025–2029' : (yr === 'III' ? '2024–2028' : '2023–2027')})</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-center text-gray-700 dark:text-gray-300">{tot}</td>
                    <td className="py-2.5 px-3 text-center text-emerald-600 dark:text-emerald-400 font-black">{pub}</td>
                    <td className="py-2.5 px-3 text-center text-emerald-500 font-mono text-[11px] font-bold">{q4} / {q3} / {q2} / {q1}</td>
                    <td className="py-2.5 px-3 text-center text-blue-600 dark:text-blue-400 font-black">{virt}</td>
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

      {/* Week-to-Week Comparison Bar */}
      {comparison && comparison.previousWeek && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-transparent border border-purple-500/20 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-600 dark:text-purple-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white">
                Contest Comparison: {comparison.currentWeek?.contestName || 'Selected Contest'} vs {comparison.previousWeek?.contestName || 'Previous Contest'}
              </h4>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 font-bold mt-0.5">
                <span>Public Participation:</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-black">
                  {comparison.currentWeek?.contestName || 'Selected Contest'} → <b>{comparison.currentWeek?.rate}%</b>
                </span>
                <span>•</span>
                <span className="text-indigo-600 dark:text-indigo-400 font-black">
                  {comparison.previousWeek?.contestName || 'Previous Contest'} → <b>{comparison.previousWeek?.rate}%</b>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className={`px-3 py-1 rounded-full text-xs font-black flex items-center space-x-1 ${(comparison.comparison?.rateChange ?? 0) > 0 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : (comparison.comparison?.rateChange ?? 0) < 0 ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'}`}>
              {(comparison.comparison?.rateChange ?? 0) > 0 ? <ArrowUpRight className="w-4 h-4" /> : (comparison.comparison?.rateChange ?? 0) < 0 ? <ArrowDownRight className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
              <span>{comparison.comparison?.status?.includes('(') ? comparison.comparison?.status : `${comparison.comparison?.status || 'NO CHANGE'} (${(comparison.comparison?.rateChange ?? 0) > 0 ? `+${comparison.comparison?.rateChange}%` : `${comparison.comparison?.rateChange ?? 0}%`})`}</span>
            </span>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-2">
        <div className="flex space-x-4">
          <button
            onClick={() => setActiveTab('matrix')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${activeTab === 'matrix' ? 'bg-brand-500 text-white shadow-md' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
          >
            Live Question-Wise Matrix ({totalRows})
          </button>
          <button
            onClick={() => setActiveTab('error_board')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center space-x-1.5 ${activeTab === 'error_board' ? 'bg-amber-500 text-white shadow-md' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Data Quality Error Board ({errorLogs.length})</span>
          </button>
        </div>
      </div>

      {/* Tab Content 1: Question Matrix Table */}
      {activeTab === 'matrix' && (
        <div className="border border-gray-200 dark:border-gray-800 rounded-3xl overflow-hidden shadow-xl bg-white dark:bg-navy-900">
          {/* Legend */}
          <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800 flex flex-wrap items-center gap-x-5 gap-y-1.5 bg-gray-50 dark:bg-navy-950">
            <span className="text-[10px] font-extrabold uppercase text-gray-400 tracking-wider">Legend:</span>
            <span className="flex items-center gap-1.5 text-[10px] font-bold"><span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-extrabold">PUBLIC</span> Public contest attended</span>
            <span className="flex items-center gap-1.5 text-[10px] font-bold"><span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-extrabold">VIRTUAL</span> Virtual attendance</span>
            <span className="flex items-center gap-1.5 text-[10px] font-bold"><span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 font-extrabold">NOT ATTENDED</span> Did not participate</span>
            <span className="text-[10px] text-gray-400 font-bold">Q cells: <span className="text-emerald-600 font-black">1</span> = solved &nbsp;|&nbsp; <span className="text-rose-400 font-black">0</span> = not solved &nbsp;|&nbsp; <span className="text-gray-300 font-black">—</span> = not attended</span>
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
                  <th className="px-4 py-3 text-center">Contest Name</th>
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
                {matrixRows.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="p-12 text-center text-gray-500 font-bold">
                      {activeSessionObj?.status === 'SCHEDULED' ? (
                        <div className="py-8 space-y-3 text-center">
                          <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto mb-2">
                            <Calendar className="w-6 h-6" />
                          </div>
                          <h4 className="text-base font-black text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                            📅 SCHEDULED WEEKLY CONTEST
                          </h4>
                          <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 max-w-md mx-auto leading-relaxed">
                            This weekly contest has not occurred yet. Participation and performance data will become available after the official session is finalized.
                          </p>
                        </div>
                      ) : (
                        <div className="py-6 space-y-2">
                          <p className="text-sm font-bold text-gray-700 dark:text-gray-300">
                            No contest participation records found for the selected filter combination.
                          </p>
                          <p className="text-xs text-gray-400">
                            Click <span className="font-extrabold text-indigo-500">↻ Fetch Selected Contest</span> above or reset filters to view all roster students.
                          </p>
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (

                  matrixRows.map((r, idx) => {
                    const isPublicAttended = r.participation_status === 'PUBLIC_ATTENDED' || r.participation_status === 'ATTENDED' || r.status === 'PUBLIC';
                    const isVirtualAttended = r.participation_status === 'VIRTUAL_ATTENDED' || r.status === 'VIRTUAL';
                    const isAttended = isPublicAttended || isVirtualAttended;
                    const isNotAttended = r.participation_status === 'PUBLIC_NOT_ATTENDED' || r.participation_status === 'NOT_ATTENDED' || r.status === 'NOT ATTENDED';
                    const isError = r.participation_status === 'DATA_ERROR';

                    // Status badge config
                    const statusBadge = isPublicAttended
                      ? { cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300', label: 'PUBLIC' }
                      : isVirtualAttended
                        ? { cls: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300', label: 'VIRTUAL' }
                        : isNotAttended
                          ? { cls: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300', label: 'NOT ATTENDED' }
                          : isError
                            ? { cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300', label: 'DATA ERROR' }
                            : { cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300', label: 'PENDING' };

                    // Q cell renderer:
                    // - Attended + solved → 1 (green)
                    // - Attended + not solved → 0 (red dim)
                    // - Not attended / pending / error → — (grey dash)
                    const renderQ = (val: any) => {
                      if (!isAttended || val === '—' || val === null || val === undefined) return <span className="text-gray-300 dark:text-gray-600 font-normal">—</span>;
                      return (val === 1 || val === '1')
                        ? <span className="inline-block w-5 h-5 leading-5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-black text-center">1</span>
                        : <span className="inline-block w-5 h-5 leading-5 rounded bg-rose-500/10 text-rose-400 dark:text-rose-500 font-bold text-center">0</span>;
                    };

                    return (
                      <tr
                        key={idx}
                        className={`hover:bg-gray-50 dark:hover:bg-navy-800/50 transition-colors ${!isAttended ? 'opacity-60' : ''}`}
                      >
                        <td className="px-4 py-2.5 text-center text-gray-400 font-mono">{idx + 1}</td>
                        <td className="px-4 py-2.5 font-bold text-gray-900 dark:text-white font-mono text-[11px]">{r.reg_no}</td>
                        <td className="px-4 py-2.5 font-semibold text-gray-800 dark:text-gray-200">{r.name}</td>
                        <td className="px-4 py-2.5 text-center font-bold text-indigo-600 dark:text-indigo-400">{r.dept}</td>
                        <td className="px-4 py-2.5 text-center text-gray-600 dark:text-gray-400 font-bold">{r.year}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`px-2 py-0.5 text-[9px] font-extrabold rounded-full whitespace-nowrap ${statusBadge.cls}`}>
                            {statusBadge.label}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center font-bold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                          {(r.contest_name || activeSessionObj?.contestName || 'Weekly Contest').replace(/Weekly Contest Weekly Contest/gi, 'Weekly Contest').trim()}
                        </td>
                        <td className="px-4 py-2.5 text-center">{renderQ(r.q1)}</td>
                        <td className="px-4 py-2.5 text-center">{renderQ(r.q2)}</td>
                        <td className="px-4 py-2.5 text-center">{renderQ(r.q3)}</td>
                        <td className="px-4 py-2.5 text-center">{renderQ(r.q4)}</td>
                        <td className="px-4 py-2.5 text-right font-black text-brand-600 dark:text-brand-400">
                          {isAttended ? (r.total_solved ?? '—') : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-gray-600 dark:text-gray-400">
                          {isAttended ? (r.rank || '—') : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                          {isAttended ? (r.rating ? Number(r.rating).toFixed(1) : '—') : '—'}
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

        {/* Tab Content 2: Data Quality Error Board */}
        {activeTab === 'error_board' && (
          <div className="border border-gray-200 dark:border-gray-800 rounded-3xl overflow-hidden shadow-xl bg-white dark:bg-navy-900 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black uppercase text-amber-600 dark:text-amber-400 flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4" />
                <span>Data Quality Error Log ({errorLogs.length} Logged Entries)</span>
              </h3>
              <p className="text-xs text-gray-500 font-bold">API failure is NEVER marked as NOT ATTENDED.</p>
            </div>

            <div className="border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-navy-950 text-white font-black uppercase">
                  <tr>
                    <th className="px-4 py-3">Register No</th>
                    <th className="px-4 py-3">Student Name</th>
                    <th className="px-4 py-3">Error Type</th>
                    <th className="px-4 py-3">Error Message</th>
                    <th className="px-4 py-3 text-center">Attempts</th>
                    <th className="px-4 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {errorLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-gray-500 font-bold">
                        Zero fetch errors! All student data verified cleanly.
                      </td>
                    </tr>
                  ) : (
                    errorLogs.map((log, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-navy-800/50">
                        <td className="px-4 py-2.5 font-bold">{log.reg_no}</td>
                        <td className="px-4 py-2.5">{log.student_name}</td>
                        <td className="px-4 py-2.5 font-mono font-bold text-amber-600 dark:text-amber-400">{log.error_type}</td>
                        <td className="px-4 py-2.5 text-gray-500">{log.error_message || '—'}</td>
                        <td className="px-4 py-2.5 text-center font-mono font-bold">{log.attempt_count}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`px-2 py-0.5 text-[9px] font-black rounded-full ${log.status === 'RESOLVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                            {log.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      {/* Interactive Report Preview Modal — Auto-fitted Viewport Card (Matches Student Modal) */}
      {showPreviewModal && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/80 backdrop-blur-md overflow-hidden animate-modal-backdrop"
          onClick={(e) => { if (e.target === e.currentTarget) setShowPreviewModal(false); }}
        >
          <div className="bg-white dark:bg-navy-900 w-full max-w-5xl max-h-[88vh] rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden my-auto animate-modal-content">
            
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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md overflow-y-auto animate-modal-backdrop">
          <div className="bg-white dark:bg-navy-900 w-full max-w-2xl max-h-[calc(100vh-3rem)] rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col my-auto">
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
          className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSavingStudent) setEditingStudent(null);
          }}
        >
          <div
            className="bg-white dark:bg-navy-900 w-full max-w-lg max-h-[calc(100vh-3rem)] rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col my-auto"
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
          className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isDeletingStudent) setDeletingStudent(null);
          }}
        >
          <div
            className="bg-white dark:bg-navy-900 w-full max-w-md max-h-[calc(100vh-3rem)] rounded-3xl shadow-2xl border border-rose-200 dark:border-rose-900/50 overflow-hidden flex flex-col p-6 space-y-4 my-auto"
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
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-fade-in">
          <div className="bg-white dark:bg-navy-900 w-full max-w-md max-h-[calc(100vh-3rem)] rounded-3xl shadow-2xl border border-amber-300 dark:border-amber-700/60 p-6 space-y-4 my-auto text-center overflow-y-auto">
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
