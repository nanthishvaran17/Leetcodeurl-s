import React, { useState, useEffect } from 'react';
import {
  X, User, Award, ShieldAlert, AlertTriangle, CheckCircle2, Clock,
  Calendar, FileText, Send, TrendingUp, TrendingDown, Minus, ExternalLink,
  Target, Activity, CheckSquare, PlusCircle, Edit3
} from 'lucide-react';
import api from '../services/api';
import { StudentEditOverlay } from './StudentEditOverlay';
import { useNotification } from '../context/NotificationContext';

interface StudentMentoringDetailProps {
  student: any;
  onClose: () => void;
  onRefresh?: () => void;
}

export const StaffMentoringDetailModal: React.FC<StudentMentoringDetailProps> = ({
  student,
  onClose,
  onRefresh
}) => {
  const { notify } = useNotification();
  const [currentStudent, setCurrentStudent] = useState<any>(student);
  const [activeTab, setActiveTab] = useState<'overview' | 'notes' | 'followups'>('overview');
  const [notes, setNotes] = useState<any[]>([]);
  const [followUps, setFollowUps] = useState<any[]>([]);
  const [loadingNotes, setLoadingNotes] = useState<boolean>(false);
  const [loadingFollowUps, setLoadingFollowUps] = useState<boolean>(false);
  const [showEditOverlay, setShowEditOverlay] = useState<boolean>(false);

  // New Note Form
  const [newNote, setNewNote] = useState<string>('');
  const [escalation, setEscalation] = useState<string>('NORMAL');
  const [submittingNote, setSubmittingNote] = useState<boolean>(false);

  // New Follow-Up Form
  const [followUpTitle, setFollowUpTitle] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split('T')[0];
  });
  const [followUpNotes, setFollowUpNotes] = useState<string>('');
  const [submittingFollowUp, setSubmittingFollowUp] = useState<boolean>(false);
  const [refreshingLive, setRefreshingLive] = useState<boolean>(false);

  const fetchStudentDetails = async () => {
    if (!student?.id) return;
    try {
      const res = await api.get(`/students/${student.id}`);
      if (res.data) {
        setCurrentStudent(res.data);
      }
    } catch (err) {
      console.error('Error fetching student details:', err);
    }
  };

  useEffect(() => {
    if (student?.id) {
      setCurrentStudent(student);
      fetchStudentDetails();
      fetchNotes();
      fetchFollowUps();
    }
  }, [student?.id]);

  const fetchNotes = async () => {
    setLoadingNotes(true);
    try {
      const res = await api.get(`/faculty-assignments/notes/${student.id}`);
      setNotes(res.data || []);
    } catch (err) {
      console.error('Error fetching notes:', err);
    } finally {
      setLoadingNotes(false);
    }
  };

  const fetchFollowUps = async () => {
    setLoadingFollowUps(true);
    try {
      const res = await api.get('/faculty-assignments/follow-ups');
      const studentFollowUps = (res.data || []).filter((f: any) => f.student_id === student.id);
      setFollowUps(studentFollowUps);
    } catch (err) {
      console.error('Error fetching follow ups:', err);
    } finally {
      setLoadingFollowUps(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    setSubmittingNote(true);
    try {
      await api.post('/faculty-assignments/notes', {
        student_id: student.id,
        note: newNote.trim(),
        escalation_level: escalation
      });
      setNewNote('');
      fetchNotes();
      notify.success('Note Logged', 'Mentoring note added successfully.');
      if (onRefresh) onRefresh();
    } catch (err: any) {
      notify.error('Action Failed', err.response?.data?.detail || 'Failed to add note');
    } finally {
      setSubmittingNote(false);
    }
  };

  const handleAddFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!followUpTitle.trim() || !dueDate) return;

    setSubmittingFollowUp(true);
    try {
      await api.post('/faculty-assignments/follow-ups', {
        student_id: student.id,
        title: followUpTitle.trim(),
        due_date: dueDate,
        notes: followUpNotes.trim() || undefined
      });
      setFollowUpTitle('');
      setFollowUpNotes('');
      fetchFollowUps();
      notify.success('Follow-Up Scheduled', 'Mentoring follow-up scheduled.');
      if (onRefresh) onRefresh();
    } catch (err: any) {
      notify.error('Action Failed', err.response?.data?.detail || 'Failed to schedule follow-up');
    } finally {
      setSubmittingFollowUp(false);
    }
  };

  const handleToggleFollowUpStatus = async (followUpId: number, currentStatus: string) => {
    const nextStatus = currentStatus === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
    try {
      await api.put(`/faculty-assignments/follow-ups/${followUpId}`, {
        status: nextStatus
      });
      fetchFollowUps();
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRefreshLive = async () => {
    if (refreshingLive || !student?.id) return;
    setRefreshingLive(true);
    notify.info('Live Sync Started', `Fetching live LeetCode stats for ${currentStudent.name || student.name}...`);
    try {
      const res = await api.post(`/students/${student.id}/refresh-live`);
      notify.success('Live Stats Updated', `Successfully updated live statistics for ${currentStudent.name || student.name}.`);
      await fetchStudentDetails();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      notify.error('Refresh Failed', err.response?.data?.detail || 'Failed to refresh live data.');
    } finally {
      setRefreshingLive(false);
    }
  };

  // Robust Stat Value Resolution across nested stats & root student object
  const totalSolved = currentStudent?.stats?.total_solved ?? currentStudent?.total_solved ?? student?.stats?.total_solved ?? student?.total_solved ?? 0;
  const easySolved = currentStudent?.stats?.easy_solved ?? currentStudent?.easy_solved ?? student?.stats?.easy_solved ?? student?.easy_solved ?? 0;
  const mediumSolved = currentStudent?.stats?.medium_solved ?? currentStudent?.medium_solved ?? student?.stats?.medium_solved ?? student?.medium_solved ?? 0;
  const hardSolved = currentStudent?.stats?.hard_solved ?? currentStudent?.hard_solved ?? student?.stats?.hard_solved ?? student?.hard_solved ?? 0;
  const rating = currentStudent?.stats?.contest_rating ?? currentStudent?.contest_rating ?? student?.stats?.contest_rating ?? student?.contest_rating ?? 0;
  const streak = currentStudent?.stats?.max_streak ?? currentStudent?.stats?.current_streak ?? currentStudent?.max_streak ?? student?.max_streak ?? 0;
  const leetcodeHandle = currentStudent?.stats?.leetcode_username || currentStudent?.username || student?.username;

  const statusLabel = currentStudent?.status_label || student?.status_label || (totalSolved >= 100 ? 'Excellent' : totalSolved >= 30 ? 'Improving' : 'Needs Improvement');
  const statusColor = currentStudent?.badge_color || student?.badge_color || (statusLabel === 'Excellent' ? 'emerald' : statusLabel === 'At Risk' ? 'rose' : 'amber');

  const displayName = currentStudent?.name || student?.name || 'Student';
  const displayRegNo = currentStudent?.reg_no || student?.reg_no;
  const displayDept = currentStudent?.department?.code || currentStudent?.department || student?.department?.code || student?.department || 'CSE';
  const displayYear = currentStudent?.year_level || student?.year_level || 'III';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 overflow-y-auto animate-fade-in">
      <div className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-3xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-navy-700 shadow-lg overflow-hidden my-auto text-gray-900 dark:text-gray-100">

        {/* Modal Header */}
        <div className="p-6 bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white flex items-center justify-between border-b border-indigo-500/20">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600/30 border border-indigo-400/40 flex items-center justify-center font-black text-2xl text-indigo-300">
              {displayName ? displayName.charAt(0) : 'S'}
            </div>
            <div>
              <div className="flex items-center space-x-3">
                <h2 className="text-xl font-black">{displayName}</h2>
                <span className={`px-3 py-0.5 rounded-full text-xs font-black ${
                  statusLabel === 'Excellent'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : (statusLabel === 'At Risk'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30')
                }`}>
                  {statusLabel}
                </span>
              </div>
              <p className="text-xs text-gray-300 font-mono mt-0.5">
                Reg: <span className="font-bold text-white">{displayRegNo}</span> • {displayDept} ({displayYear} Year)
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleRefreshLive}
              disabled={refreshingLive}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center space-x-1 transition-all cursor-pointer shadow disabled:opacity-50"
            >
              <Activity className={`w-3.5 h-3.5 ${refreshingLive ? 'animate-spin' : ''}`} />
              <span>{refreshingLive ? 'Syncing...' : 'Refresh Live Data'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowEditOverlay(true)}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center space-x-1 transition-all cursor-pointer shadow"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Details</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-gray-300 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center border-b border-gray-200 dark:border-navy-800 bg-gray-50 dark:bg-navy-950 px-6 space-x-4 text-xs font-bold">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 border-b-2 flex items-center space-x-2 transition-all ${
              activeTab === 'overview'
                ? 'border-brand-500 text-brand-600 dark:text-brand-400 font-black'
                : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Coding Performance</span>
          </button>

          <button
            onClick={() => setActiveTab('notes')}
            className={`py-3 border-b-2 flex items-center space-x-2 transition-all ${
              activeTab === 'notes'
                ? 'border-brand-500 text-brand-600 dark:text-brand-400 font-black'
                : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Private Notes ({notes.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('followups')}
            className={`py-3 border-b-2 flex items-center space-x-2 transition-all ${
              activeTab === 'followups'
                ? 'border-brand-500 text-brand-600 dark:text-brand-400 font-black'
                : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            <span>Follow-Ups ({followUps.length})</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">

              {/* Profile Link Banner */}
              {leetcodeHandle && (
                <div className="flex items-center justify-between p-4 rounded-2xl bg-indigo-50 dark:bg-navy-800 border border-indigo-100 dark:border-navy-700">
                  <div className="flex items-center space-x-3">
                    <User className="w-5 h-5 text-indigo-500" />
                    <div>
                      <p className="text-xs font-bold text-gray-700 dark:text-gray-300">LeetCode Profile Handle</p>
                      <p className="text-sm font-black text-brand-600 dark:text-brand-400">@{leetcodeHandle}</p>
                    </div>
                  </div>
                  <a
                    href={`https://leetcode.com/u/${leetcodeHandle}/`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold flex items-center space-x-1.5 transition-all shadow-md"
                  >
                    <span>View LeetCode</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}

              {/* Performance Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-navy-800 border space-y-1">
                  <span className="text-[10px] font-black uppercase text-gray-400">Total Solved</span>
                  <p className="text-2xl font-black text-brand-600 dark:text-brand-400">{totalSolved}</p>
                  <p className="text-[10px] text-gray-500">Problems</p>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-500/20 space-y-1">
                  <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400">Easy</span>
                  <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{easySolved}</p>
                  <p className="text-[10px] text-emerald-600/70">Solved</p>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-500/20 space-y-1">
                  <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400">Medium</span>
                  <p className="text-2xl font-black text-amber-600 dark:text-amber-400">{mediumSolved}</p>
                  <p className="text-[10px] text-amber-600/70">Solved</p>
                </div>

                <div className="p-4 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-500/20 space-y-1">
                  <span className="text-[10px] font-black uppercase text-rose-600 dark:text-rose-400">Hard</span>
                  <p className="text-2xl font-black text-rose-600 dark:text-rose-400">{hardSolved}</p>
                  <p className="text-[10px] text-rose-600/70">Solved</p>
                </div>
              </div>

              {/* Contest & Activity Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl bg-gray-50 dark:bg-navy-800 border space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-gray-500">
                    <span>Contest Rating</span>
                    <Award className="w-4 h-4 text-amber-500" />
                  </div>
                  <p className="text-2xl font-black text-gray-900 dark:text-white">
                    {rating ? Math.round(rating) : 'Unrated'}
                  </p>
                  <p className="text-xs text-gray-500">Institutional Contest Track</p>
                </div>

                <div className="p-5 rounded-2xl bg-gray-50 dark:bg-navy-800 border space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-gray-500">
                    <span>Active Streak</span>
                    <Activity className="w-4 h-4 text-emerald-500" />
                  </div>
                  <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                    {streak} Days
                  </p>
                  <p className="text-xs text-gray-500">Consecutive Activity</p>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: PRIVATE NOTES */}
          {activeTab === 'notes' && (
            <div className="space-y-6">

              {/* Add Note Form */}
              <form onSubmit={handleAddNote} className="p-5 rounded-2xl bg-gray-50 dark:bg-navy-800 border border-gray-200 dark:border-navy-700 space-y-3.5 shadow-sm">
                <h4 className="text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300">
                  Add Private Mentoring Note
                </h4>
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Record private observation or action recommendation for this student..."
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-navy-700 bg-white dark:bg-navy-900 text-xs focus:ring-2 focus:ring-brand-500"
                  required
                />
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-gray-500 font-bold mr-1">Priority:</span>
                    {[
                      { id: 'NORMAL', label: 'Normal', color: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30' },
                      { id: 'WARNING', label: 'Warning', color: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30' },
                      { id: 'CRITICAL', label: 'Critical Escalation', color: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30' }
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setEscalation(opt.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                          escalation === opt.id
                            ? `${opt.color} ring-2 ring-brand-500 shadow-sm font-black`
                            : 'bg-white dark:bg-navy-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-navy-700 hover:bg-gray-100 dark:hover:bg-navy-800'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  <button
                    type="submit"
                    disabled={submittingNote || !newNote.trim()}
                    className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-md shadow-brand-600/20"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Save Note</span>
                  </button>
                </div>
              </form>

              {/* Notes List */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase text-gray-400">Past Notes History</h4>
                {loadingNotes ? (
                  <p className="text-xs text-gray-500 animate-pulse">Loading notes...</p>
                ) : notes.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No private notes recorded yet.</p>
                ) : (
                  notes.map((n: any) => (
                    <div key={n.id} className="p-4 rounded-2xl bg-gray-50 dark:bg-navy-800 border border-gray-200 dark:border-navy-700 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-brand-600 dark:text-brand-400">{n.faculty_name}</span>
                        <span className="text-gray-400 text-[10px]">{n.created_at ? new Date(n.created_at).toLocaleDateString() : ''}</span>
                      </div>
                      <p className="text-xs text-gray-800 dark:text-gray-200">{n.note}</p>
                    </div>
                  ))
                )}
              </div>

            </div>
          )}

          {/* TAB 3: FOLLOW-UPS */}
          {activeTab === 'followups' && (
            <div className="space-y-6">

              {/* Schedule Follow-Up Form */}
              <form onSubmit={handleAddFollowUp} className="p-5 rounded-2xl bg-gray-50 dark:bg-navy-800 border border-gray-200 dark:border-navy-700 space-y-3.5 shadow-sm">
                <h4 className="text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300">
                  Schedule Follow-Up Task
                </h4>
                
                <div>
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Task Title</label>
                  <input
                    type="text"
                    value={followUpTitle}
                    onChange={(e) => setFollowUpTitle(e.target.value)}
                    placeholder="e.g. Check Weekly 10 Problems"
                    className="w-full px-4 py-2 rounded-xl border border-gray-300 dark:border-navy-700 bg-white dark:bg-navy-900 text-xs font-bold"
                    required
                  />
                </div>

                {/* Modern Due Date Selector with Quick Preset Chips */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold text-gray-600 dark:text-gray-400">
                    <span>Due Date Target</span>
                    <span className="font-mono text-brand-600 dark:text-brand-400 font-black">{dueDate}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[
                      { label: '+3 Days', days: 3 },
                      { label: '+7 Days (1 Wk)', days: 7 },
                      { label: '+14 Days (2 Wks)', days: 14 },
                      { label: '+30 Days (1 Mo)', days: 30 }
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          const d = new Date();
                          d.setDate(d.getDate() + preset.days);
                          setDueDate(d.toISOString().split('T')[0]);
                        }}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-navy-900 border border-gray-300 dark:border-navy-700 hover:border-brand-500 hover:text-brand-600 dark:hover:text-brand-400 text-gray-700 dark:text-gray-300 transition-all cursor-pointer shadow-sm"
                      >
                        {preset.label}
                      </button>
                    ))}
                    <input
                      type="text"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      placeholder="YYYY-MM-DD"
                      className="flex-1 min-w-[130px] px-3 py-1.5 rounded-xl border border-gray-300 dark:border-navy-700 bg-white dark:bg-navy-900 text-xs font-mono font-bold text-center"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Instruction Notes (Optional)</label>
                  <textarea
                    value={followUpNotes}
                    onChange={(e) => setFollowUpNotes(e.target.value)}
                    placeholder="Optional instruction details..."
                    rows={2}
                    className="w-full px-4 py-2 rounded-xl border border-gray-300 dark:border-navy-700 bg-white dark:bg-navy-900 text-xs"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingFollowUp || !followUpTitle.trim()}
                  className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-bold flex items-center space-x-2 transition-all cursor-pointer shadow-md shadow-brand-600/20"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Schedule Task</span>
                </button>
              </form>

              {/* Follow-Ups List */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase text-gray-400">Scheduled Follow-Ups</h4>
                {loadingFollowUps ? (
                  <p className="text-xs text-gray-500 animate-pulse">Loading tasks...</p>
                ) : followUps.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No scheduled follow-up tasks for this student.</p>
                ) : (
                  followUps.map((f: any) => (
                    <div key={f.id} className="p-4 rounded-2xl bg-gray-50 dark:bg-navy-800 border flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                            f.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-amber-500/20 text-amber-500'
                          }`}>
                            {f.status}
                          </span>
                          <span className="text-xs font-bold text-gray-900 dark:text-white">{f.title}</span>
                        </div>
                        <p className="text-[10px] text-gray-400">Due Date: {f.due_date}</p>
                        {f.notes && <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">{f.notes}</p>}
                      </div>

                      <button
                        onClick={() => handleToggleFollowUpStatus(f.id, f.status)}
                        className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                          f.status === 'COMPLETED'
                            ? 'bg-gray-200 dark:bg-navy-700 text-gray-700 dark:text-gray-300'
                            : 'bg-emerald-500 text-white hover:bg-emerald-600'
                        }`}
                      >
                        {f.status === 'COMPLETED' ? 'Mark Pending' : 'Complete'}
                      </button>
                    </div>
                  ))
                )}
              </div>

            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-navy-800 bg-gray-50 dark:bg-navy-950 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-gray-200 dark:bg-navy-800 hover:bg-gray-300 dark:hover:bg-navy-700 text-gray-800 dark:text-gray-200 text-xs font-bold transition-all"
          >
            Close Window
          </button>
        </div>

      </div>

      <StudentEditOverlay
        isOpen={showEditOverlay}
        student={currentStudent || student}
        onClose={() => setShowEditOverlay(false)}
        onSaveSuccess={() => {
          fetchStudentDetails();
          if (onRefresh) onRefresh();
          setShowEditOverlay(false);
        }}
      />
    </div>
  );
};
