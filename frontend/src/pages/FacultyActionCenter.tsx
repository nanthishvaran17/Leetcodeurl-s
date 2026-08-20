import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, AlertTriangle, CheckCircle2, Zap, Clock, Search, Filter, 
  UserCheck, UserX, TrendingUp, RefreshCw, Plus, FileText, ArrowRight, Activity
} from 'lucide-react';
import { 
  getFacultyAttentionItems, getFacultyActionQueue, createFacultyIntervention, 
  updateInterventionStatus, getInterventionEffectiveness, AttentionItem, ActionQueueItem 
} from '../services/intelligenceService';

export const FacultyActionCenter: React.FC = () => {
  const [attentionData, setAttentionData] = useState<any>(null);
  const [actionQueue, setActionQueue] = useState<ActionQueueItem[]>([]);
  const [effectiveness, setEffectiveness] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal State
  const [showInterventionModal, setShowInterventionModal] = useState<boolean>(false);
  const [selectedStudent, setSelectedStudent] = useState<{ id: number; name: string } | null>(null);
  const [interventionTitle, setInterventionTitle] = useState<string>('5 Medium DP Problems & 1-on-1 Review');
  const [interventionReason, setInterventionReason] = useState<string>('Severe weekly progress drop & weak contest performance.');
  const [assignedTopicInput, setAssignedTopicInput] = useState<string>('Dynamic Programming, Graphs');
  const [priorityInput, setPriorityInput] = useState<string>('High');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [att, queue, eff] = await Promise.all([
        getFacultyAttentionItems(),
        getFacultyActionQueue(undefined, statusFilter),
        getInterventionEffectiveness()
      ]);
      setAttentionData(att);
      setActionQueue(queue);
      setEffectiveness(eff);
    } catch (err) {
      console.error("Failed to load faculty action center data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateIntervention = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;

    setIsSubmitting(true);
    try {
      const topics = assignedTopicInput.split(',').map(t => t.trim()).filter(Boolean);
      await createFacultyIntervention({
        student_id: selectedStudent.id,
        title: interventionTitle,
        reason: interventionReason,
        assigned_topics: topics,
        priority: priorityInput
      });

      setShowInterventionModal(false);
      setSelectedStudent(null);
      await loadData();
    } catch (err) {
      console.error("Intervention creation failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (queueId: number, newStatus: string) => {
    try {
      await updateInterventionStatus(queueId, newStatus, `Faculty marked as ${newStatus}`);
      await loadData();
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  const filteredQueue = actionQueue.filter(item => {
    const matchesSearch = item.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.reg_no.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">

      {/* ── HEADER (RICH GLOWING INSTITUTIONAL GRADIENT) ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white p-6 md:p-8 shadow-2xl border border-brand-500/30">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-80 h-80 bg-brand-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
          <div className="space-y-2.5 max-w-2xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-brand-500/20 border border-brand-400/30 text-brand-300 text-xs font-black">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>FACULTY ACTION CENTER & MENTORING HUB</span>
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-white">
              Faculty Action Center & <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-400 via-teal-300 to-indigo-300">Mentoring Hub</span>
            </h1>
            <p className="text-xs md:text-sm text-gray-300 font-bold tracking-wide">
              "What Needs My Attention?" Engine • Priority Action Queue • Intervention Lifecycle
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 disabled:opacity-50 text-white rounded-2xl text-xs font-bold shadow-lg shadow-brand-600/30 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Refreshing...' : 'Refresh Queue'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── 1. COLLEGE-WIDE INTERVENTION EFFECTIVENESS MATRIX ── */}
      {effectiveness && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-navy-900 rounded-3xl p-5 border border-gray-200 dark:border-gray-800 shadow-xl text-center">
            <span className="text-[10px] font-black uppercase text-gray-400 block">Total Interventions</span>
            <span className="text-2xl font-black text-gray-900 dark:text-white mt-1 block">{effectiveness.total_interventions}</span>
          </div>

          <div className="bg-white dark:bg-navy-900 rounded-3xl p-5 border border-gray-200 dark:border-gray-800 shadow-xl text-center">
            <span className="text-[10px] font-black uppercase text-gray-400 block">Avg Rating Improvement</span>
            <span className="text-2xl font-black text-emerald-500 mt-1 block">{effectiveness.avg_rating_delta} pts</span>
          </div>

          <div className="bg-white dark:bg-navy-900 rounded-3xl p-5 border border-gray-200 dark:border-gray-800 shadow-xl text-center">
            <span className="text-[10px] font-black uppercase text-gray-400 block">Solving Activity Boost</span>
            <span className="text-2xl font-black text-brand-500 mt-1 block">{effectiveness.avg_activity_boost_pct}</span>
          </div>

          <div className="bg-white dark:bg-navy-900 rounded-3xl p-5 border border-gray-200 dark:border-gray-800 shadow-xl text-center">
            <span className="text-[10px] font-black uppercase text-gray-400 block">Resolution Success Rate</span>
            <span className="text-2xl font-black text-purple-500 mt-1 block">{effectiveness.overall_success_rate_pct}%</span>
          </div>
        </div>
      )}

      {/* ── 2. "WHAT NEEDS MY ATTENTION?" ENGINE CAROUSEL ── */}
      {attentionData && (
        <div className="bg-white dark:bg-navy-900 rounded-3xl p-6 border border-gray-200 dark:border-gray-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                <AlertTriangle className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div>
                <h2 className="text-lg font-black text-gray-900 dark:text-white">"What Needs My Attention?" Engine</h2>
                <p className="text-xs text-gray-500 font-bold">
                  {attentionData.total_attention_items} Priority Items Requiring Faculty Review
                </p>
              </div>
            </div>

            <div className="hidden sm:flex items-center space-x-2 text-xs font-bold text-gray-500">
              <span className="px-2.5 py-1 rounded-xl bg-rose-500/10 text-rose-600 border border-rose-500/20">
                {attentionData.performance_drop_count} Perf Drops
              </span>
              <span className="px-2.5 py-1 rounded-xl bg-amber-500/10 text-amber-600 border border-amber-500/20">
                {attentionData.inactive_count} Inactive
              </span>
              <span className="px-2.5 py-1 rounded-xl bg-purple-500/10 text-purple-600 border border-purple-500/20">
                {attentionData.silent_disengaged_count} Silent Drops
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            {attentionData.items.slice(0, 6).map((item: AttentionItem) => (
              <div 
                key={item.id}
                className="p-5 rounded-2xl bg-gray-50 dark:bg-navy-950/60 border border-gray-200 dark:border-navy-800 flex flex-col justify-between space-y-3 hover:border-brand-500/40 transition-all shadow-sm"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded ${
                      item.severity === 'CRITICAL' ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20' : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                    }`}>
                      {item.severity}
                    </span>
                    <span className="text-xs font-bold text-gray-400">{item.dept_code}</span>
                  </div>

                  <h3 className="text-sm font-black text-gray-900 dark:text-white leading-tight">
                    {item.title}
                  </h3>

                  <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                    {item.reason}
                  </p>
                </div>

                <div className="pt-3 border-t border-gray-200 dark:border-navy-800 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-brand-600 dark:text-brand-400">
                    {item.action_type}
                  </span>

                  <button
                    onClick={() => {
                      setSelectedStudent({ id: item.student_id, name: item.student_name });
                      setShowInterventionModal(true);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-brand-600 text-white text-xs font-bold hover:bg-brand-700 transition-colors flex items-center space-x-1 cursor-pointer"
                  >
                    <span>Intervene</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 3. TASK-BASED FACULTY ACTION QUEUE ── */}
      <div className="bg-white dark:bg-navy-900 rounded-3xl p-6 border border-gray-200 dark:border-gray-800 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-gray-900 dark:text-white">Task-Based Faculty Action Queue</h2>
            <p className="text-xs text-gray-500 font-bold">Track, Manage & Update Student Intervention Lifecycles</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search student..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-navy-950 text-xs font-bold text-gray-900 dark:text-white outline-none focus:border-brand-500"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-navy-950 text-xs font-bold text-gray-900 dark:text-white outline-none focus:border-brand-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Monitoring">Monitoring</option>
              <option value="Completed">Completed</option>
              <option value="Resolved">Resolved</option>
            </select>
          </div>
        </div>

        {/* Action Queue Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 text-[11px] font-black text-gray-400 uppercase tracking-wider bg-gray-50/50 dark:bg-navy-950/50">
                <th className="p-3.5">Priority</th>
                <th className="p-3.5">Student</th>
                <th className="p-3.5">Reason / Signal</th>
                <th className="p-3.5">Recommended Action</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Update Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-xs font-semibold">
              {filteredQueue.map(item => (
                <tr key={item.id} className="hover:bg-gray-50/80 dark:hover:bg-navy-800/40 transition-colors">
                  <td className="p-3.5">
                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black ${
                      item.priority === 'High' ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20' : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                    }`}>
                      {item.priority}
                    </span>
                  </td>
                  <td className="p-3.5">
                    <div className="font-extrabold text-gray-900 dark:text-white">{item.student_name}</div>
                    <div className="text-[10px] text-gray-400">{item.reg_no} • {item.dept_code}</div>
                  </td>
                  <td className="p-3.5 text-gray-600 dark:text-gray-300 max-w-[200px]">
                    {item.reason}
                  </td>
                  <td className="p-3.5 text-gray-700 dark:text-gray-200 font-bold max-w-[220px]">
                    {item.recommended_action}
                  </td>
                  <td className="p-3.5">
                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black ${
                      item.status === 'Resolved' || item.status === 'Completed'
                        ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                        : item.status === 'In Progress'
                        ? 'bg-brand-500/10 text-brand-600 border border-brand-500/20'
                        : 'bg-gray-100 dark:bg-navy-800 text-gray-500'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="p-3.5 text-right">
                    <select
                      value={item.status}
                      onChange={e => handleUpdateStatus(item.id, e.target.value)}
                      className="px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-navy-800 text-[11px] font-bold text-gray-800 dark:text-gray-200 outline-none focus:border-brand-500"
                    >
                      <option value="Pending">Pending</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Monitoring">Monitoring</option>
                      <option value="Completed">Completed</option>
                      <option value="Resolved">Resolved</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 4. CREATE INTERVENTION MODAL ── */}
      {showInterventionModal && selectedStudent && (
        <div className="modal-overlay-responsive animate-fade-in">
          <div className="modal-container-responsive max-w-lg bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 rounded-3xl shadow-2xl p-6 space-y-4">
            <h3 className="text-lg font-black text-gray-900 dark:text-white flex items-center space-x-2">
              <Zap className="w-5 h-5 text-brand-500" />
              <span>Create Faculty Intervention: {selectedStudent.name}</span>
            </h3>

            <form onSubmit={handleCreateIntervention} className="space-y-4 text-xs font-bold text-gray-700 dark:text-gray-300">
              <div>
                <label className="block mb-1">Intervention Title</label>
                <input
                  type="text"
                  value={interventionTitle}
                  onChange={e => setInterventionTitle(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-navy-950 text-gray-900 dark:text-white outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block mb-1">Intervention Reason / Signal</label>
                <textarea
                  value={interventionReason}
                  onChange={e => setInterventionReason(e.target.value)}
                  rows={2}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-navy-950 text-gray-900 dark:text-white outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block mb-1">Assigned DSA Topics (Comma Separated)</label>
                <input
                  type="text"
                  value={assignedTopicInput}
                  onChange={e => setAssignedTopicInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-navy-950 text-gray-900 dark:text-white outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block mb-1">Priority</label>
                <select
                  value={priorityInput}
                  onChange={e => setPriorityInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-navy-950 text-gray-900 dark:text-white outline-none focus:border-brand-500"
                >
                  <option value="High">High Priority</option>
                  <option value="Medium">Medium Priority</option>
                  <option value="Low">Low Priority</option>
                </select>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowInterventionModal(false)}
                  className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-brand-600 text-white font-black shadow-md hover:bg-brand-700 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Assign Intervention'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
