import React, { useState, useEffect } from 'react';
import {
  X, User, Award, ShieldAlert, AlertTriangle, CheckCircle2, Clock,
  Calendar, FileText, Send, TrendingUp, TrendingDown, Minus, ExternalLink,
  Target, Activity, CheckSquare, PlusCircle, Edit3
} from 'lucide-react';
import api from '../services/api';
import { StudentEditOverlay } from './StudentEditOverlay';

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

  useEffect(() => {
    if (student?.id) {
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
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to add note');
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
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to schedule follow-up');
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

  const totalSolved = student?.stats?.total_solved || 0;
  const easySolved = student?.stats?.easy_solved || 0;
  const mediumSolved = student?.stats?.medium_solved || 0;
  const hardSolved = student?.stats?.hard_solved || 0;
  const rating = student?.stats?.contest_rating || 0;
  const streak = student?.stats?.max_streak || 0;
  const statusLabel = student?.status_label || (totalSolved >= 100 ? 'Excellent' : totalSolved >= 30 ? 'Improving' : 'Needs Improvement');
  const statusColor = student?.badge_color || (statusLabel === 'Excellent' ? 'emerald' : statusLabel === 'At Risk' ? 'rose' : 'amber');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-3xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-navy-700 shadow-2xl overflow-hidden my-auto text-gray-900 dark:text-gray-100">

        {/* Modal Header */}
        <div className="p-6 bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white flex items-center justify-between border-b border-indigo-500/20">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600/30 border border-indigo-400/40 flex items-center justify-center font-black text-2xl text-indigo-300">
              {student.name ? student.name.charAt(0) : 'S'}
            </div>
            <div>
              <div className="flex items-center space-x-3">
                <h2 className="text-xl font-black">{student.name}</h2>
                <span className={`px-3 py-0.5 rounded-full text-xs font-black bg-${statusColor}-500/20 text-${statusColor}-400 border border-${statusColor}-500/30`}>
                  {statusLabel}
                </span>
              </div>
              <p className="text-xs text-gray-300 font-mono mt-0.5">
                Reg: <span className="font-bold text-white">{student.reg_no}</span> • {student.department?.code || student.department || 'CSE'} ({student.year_level} Year - {student.section?.name || student.section || 'A'})
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowEditOverlay(true)}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center space-x-1 transition-all cursor-pointer shadow"
            >
              <Edit3 className="w-4 h-4" />
              <span>Edit Details</span>
            </button>

            <button
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
              {student.username && (
                <div className="flex items-center justify-between p-4 rounded-2xl bg-indigo-50 dark:bg-navy-800 border border-indigo-100 dark:border-navy-700">
                  <div className="flex items-center space-x-3">
                    <User className="w-5 h-5 text-indigo-500" />
                    <div>
                      <p className="text-xs font-bold text-gray-700 dark:text-gray-300">LeetCode Profile Handle</p>
                      <p className="text-sm font-black text-brand-600 dark:text-brand-400">@{student.username}</p>
                    </div>
                  </div>
                  <a
                    href={`https://leetcode.com/u/${student.username}/`}
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
              <form onSubmit={handleAddNote} className="p-4 rounded-2xl bg-gray-50 dark:bg-navy-800 border space-y-3">
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
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-500 font-bold">Priority:</span>
                    <select
                      value={escalation}
                      onChange={(e) => setEscalation(e.target.value)}
                      className="px-3 py-1 rounded-lg border border-gray-300 dark:border-navy-700 bg-white dark:bg-navy-900 text-xs font-bold"
                    >
                      <option value="NORMAL">Normal</option>
                      <option value="WARNING">Warning</option>
                      <option value="CRITICAL">Critical Escalation</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={submittingNote || !newNote.trim()}
                    className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-bold flex items-center space-x-2 transition-all"
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
                    <div key={n.id} className="p-4 rounded-2xl bg-gray-50 dark:bg-navy-800 border space-y-2">
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
              <form onSubmit={handleAddFollowUp} className="p-4 rounded-2xl bg-gray-50 dark:bg-navy-800 border space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300">
                  Schedule Follow-Up Task
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={followUpTitle}
                    onChange={(e) => setFollowUpTitle(e.target.value)}
                    placeholder="Task Title (e.g. Check Weekly 10 Problems)"
                    className="px-4 py-2 rounded-xl border border-gray-300 dark:border-navy-700 bg-white dark:bg-navy-900 text-xs font-bold"
                    required
                  />
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="px-4 py-2 rounded-xl border border-gray-300 dark:border-navy-700 bg-white dark:bg-navy-900 text-xs font-bold"
                    required
                  />
                </div>
                <textarea
                  value={followUpNotes}
                  onChange={(e) => setFollowUpNotes(e.target.value)}
                  placeholder="Optional instruction details..."
                  rows={2}
                  className="w-full px-4 py-2 rounded-xl border border-gray-300 dark:border-navy-700 bg-white dark:bg-navy-900 text-xs"
                />
                <button
                  type="submit"
                  disabled={submittingFollowUp || !followUpTitle.trim()}
                  className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-bold flex items-center space-x-2 transition-all"
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
        student={student}
        onClose={() => setShowEditOverlay(false)}
        onSaveSuccess={() => {
          if (onRefresh) onRefresh();
          setShowEditOverlay(false);
        }}
      />
    </div>
  );
};
