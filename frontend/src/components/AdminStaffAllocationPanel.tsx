import React, { useState, useEffect } from 'react';
import {
  Users, UserPlus, RefreshCw, CheckCircle2, AlertTriangle, ShieldAlert,
  Search, Sliders, ArrowRight, CheckSquare, PlusCircle, Power
} from 'lucide-react';
import api from '../services/api';

export const AdminStaffAllocationPanel: React.FC = () => {
  const [staffList, setStaffList] = useState<any[]>([]);
  const [unassigned, setUnassigned] = useState<any[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<number[]>([]);
  const [targetStaffId, setTargetStaffId] = useState<number | ''>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [search, setSearch] = useState<string>('');

  // Create Staff Form
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newUsername, setNewUsername] = useState<string>('');
  const [newEmail, setNewEmail] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('Staff@123');

  useEffect(() => {
    fetchAdminAllocationData();
  }, []);

  const fetchAdminAllocationData = async () => {
    setLoading(true);
    try {
      const [staffRes, unassignedRes] = await Promise.all([
        api.get('/admin/staff-list'),
        api.get('/admin/unassigned-students')
      ]);
      setStaffList(staffRes.data || []);
      setUnassigned(unassignedRes.data?.students || []);
    } catch (err) {
      console.error('Error loading admin allocation data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newEmail.trim()) return;

    setSubmitting(true);
    try {
      await api.post('/admin/staff', {
        username: newUsername.trim(),
        email: newEmail.trim(),
        password: newPassword
      });
      alert(`Staff account created successfully for ${newUsername}!`);
      setNewUsername('');
      setNewEmail('');
      setShowCreateModal(false);
      fetchAdminAllocationData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to create staff account.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkAssign = async () => {
    if (!targetStaffId || selectedStudents.length === 0) {
      alert('Please select a staff member and at least one student.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/admin/bulk-assign', {
        staff_id: Number(targetStaffId),
        student_ids: selectedStudents
      });
      alert(`Successfully assigned ${selectedStudents.length} students.`);
      setSelectedStudents([]);
      setTargetStaffId('');
      fetchAdminAllocationData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to assign students.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSmartAutoAssign = async () => {
    if (unassigned.length === 0) {
      alert('No unassigned students to allocate.');
      return;
    }

    if (!window.confirm('Run Smart Auto-Assignment to evenly distribute unassigned students up to max 30 per staff member?')) {
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/faculty-assignments/auto-distribute', {
        department_id: unassigned[0]?.department_id || 1
      });
      alert(res.data?.message || `Allocated ${res.data?.allocated_count || 0} students!`);
      fetchAdminAllocationData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed auto assignment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAutoRebalance = async () => {
    if (!window.confirm('Run Workload Auto-Rebalancing across staff allocations?')) return;

    setSubmitting(true);
    try {
      const res = await api.post('/admin/auto-rebalance');
      alert(res.data?.message || 'Rebalancing complete.');
      fetchAdminAllocationData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed auto rebalancing.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStaffStatus = async (staffId: number, currentUsername: string) => {
    if (!window.confirm(`Toggle active status for staff member '${currentUsername}'? Disabling will move their assigned students to the unassigned queue.`)) {
      return;
    }

    try {
      const res = await api.post(`/admin/staff/${staffId}/toggle-status`);
      alert(res.data?.message || 'Status updated.');
      fetchAdminAllocationData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to toggle status.');
    }
  };

  const toggleSelectStudent = (id: number) => {
    setSelectedStudents(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedStudents.length === unassigned.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(unassigned.map(s => s.id));
    }
  };

  return (
    <div className="space-y-8">

      {/* Staff Workload Matrix */}
      <div className="bg-white dark:bg-navy-900 p-6 rounded-3xl border border-slate-200 dark:border-navy-700 shadow-xl space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 className="text-base font-black text-slate-800 dark:text-slate-100 flex items-center space-x-2">
              <Users className="w-5 h-5 text-indigo-500" />
              <span>Staff Workload & Capacity Tracking</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-navy-400">
              Enforced Capacity Cap: 30 Students Max per Staff Member
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center space-x-2 shadow-md transition-all"
            >
              <UserPlus className="w-4 h-4" />
              <span>Create Staff Member</span>
            </button>

            <button
              onClick={handleAutoRebalance}
              disabled={submitting}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-navy-800 hover:bg-slate-200 dark:hover:bg-navy-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center space-x-2 border border-slate-200 dark:border-navy-700 transition-all"
            >
              <Sliders className="w-4 h-4 text-brand-500" />
              <span>Auto Rebalance</span>
            </button>
          </div>
        </div>

        {/* Staff Workload Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            <p className="text-xs text-slate-500 animate-pulse">Loading staff workload...</p>
          ) : staffList.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No staff accounts registered yet.</p>
          ) : (
            staffList.map((st: any) => {
              const count = st.assigned_count || 0;
              const maxCap = 30;
              const percent = Math.min(100, Math.round((count / maxCap) * 100));
              const isFull = count >= maxCap;

              return (
                <div
                  key={st.id}
                  className={`p-5 rounded-2xl border transition-all ${
                    !st.is_active
                      ? 'bg-slate-50 dark:bg-navy-950/40 border-slate-200 opacity-60'
                      : isFull
                      ? 'bg-rose-50/20 dark:bg-rose-950/10 border-rose-500/30'
                      : 'bg-slate-50/50 dark:bg-navy-800/50 border-slate-200 dark:border-navy-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center space-x-2">
                        <span>{st.username}</span>
                        {!st.is_active && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-500/20 text-rose-500">
                            DISABLED
                          </span>
                        )}
                      </h4>
                      <p className="text-xs text-slate-400">{st.email}</p>
                    </div>

                    <button
                      onClick={() => handleToggleStaffStatus(st.id, st.username)}
                      className={`p-2 rounded-xl text-xs transition-all ${
                        st.is_active
                          ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 hover:bg-rose-200'
                          : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 hover:bg-emerald-200'
                      }`}
                      title={st.is_active ? 'Disable Staff & Unassign Students' : 'Enable Staff Account'}
                    >
                      <Power className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-4 space-y-1.5">
                    <div className="flex justify-between text-xs font-bold text-slate-500">
                      <span>Workload Allocation</span>
                      <span className={isFull ? 'text-rose-500 font-black' : 'text-slate-800 dark:text-white'}>
                        {count} / {maxCap}
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-navy-700 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isFull ? 'bg-rose-500' : count >= 20 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Unassigned Students Queue */}
      <div className="bg-white dark:bg-navy-900 p-6 rounded-3xl border border-slate-200 dark:border-navy-700 shadow-xl space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 className="text-base font-black text-slate-800 dark:text-slate-100 flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <span>Unassigned Student Allocation Queue ({unassigned.length})</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-navy-400">
              Students without a primary mentor. Select students to assign in bulk or use Smart Auto-Assign.
            </p>
          </div>

          <div className="flex items-center space-x-3 flex-wrap gap-2">
            <button
              onClick={handleSmartAutoAssign}
              disabled={submitting || unassigned.length === 0}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold flex items-center space-x-2 shadow-md transition-all"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Smart Auto Assign</span>
            </button>
          </div>
        </div>

        {/* Bulk Assignment Bar */}
        {selectedStudents.length > 0 && (
          <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-navy-800 border border-indigo-200 dark:border-navy-700 flex items-center justify-between flex-wrap gap-3 animate-fade-in">
            <span className="text-xs font-black text-indigo-700 dark:text-indigo-300">
              {selectedStudents.length} Students Selected
            </span>

            <div className="flex items-center space-x-3">
              <select
                value={targetStaffId}
                onChange={(e) => setTargetStaffId(e.target.value ? Number(e.target.value) : '')}
                className="px-4 py-2 rounded-xl border border-indigo-300 dark:border-navy-600 bg-white dark:bg-navy-900 text-xs font-bold"
              >
                <option value="">Select Target Staff Member...</option>
                {staffList.filter(s => s.is_active && s.assigned_count < 30).map(s => (
                  <option key={s.id} value={s.id}>
                    {s.username} ({s.assigned_count}/30 assigned)
                  </option>
                ))}
              </select>

              <button
                onClick={handleBulkAssign}
                disabled={submitting || !targetStaffId}
                className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-bold flex items-center space-x-1.5 shadow-md"
              >
                <span>Assign Now</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Unassigned Students Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-navy-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-navy-950 text-slate-400 font-black uppercase text-[10px] tracking-wider border-b">
              <tr>
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={unassigned.length > 0 && selectedStudents.length === unassigned.length}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                  />
                </th>
                <th className="px-4 py-3">Register No</th>
                <th className="px-4 py-3">Student Name</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Year / Class</th>
                <th className="px-4 py-3">LeetCode Handle</th>
                <th className="px-4 py-3">Total Solved</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400 font-bold animate-pulse">
                    Loading unassigned students...
                  </td>
                </tr>
              ) : unassigned.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400 italic">
                    🎉 All active students are currently assigned to a primary mentor!
                  </td>
                </tr>
              ) : (
                unassigned.map((st: any) => (
                  <tr key={st.id} className="hover:bg-slate-50/50 dark:hover:bg-navy-850 transition-colors">
                    <td className="px-4 py-3.5">
                      <input
                        type="checkbox"
                        checked={selectedStudents.includes(st.id)}
                        onChange={() => toggleSelectStudent(st.id)}
                        className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                      />
                    </td>
                    <td className="px-4 py-3.5 font-mono text-slate-500">{st.reg_no}</td>
                    <td className="px-4 py-3.5 font-extrabold text-slate-900 dark:text-white">{st.name}</td>
                    <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300">{st.department}</td>
                    <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300">{st.year_level} Year ({st.section})</td>
                    <td className="px-4 py-3.5 font-bold text-brand-600 dark:text-brand-400">
                      {st.username ? `@${st.username}` : 'Not Linked'}
                    </td>
                    <td className="px-4 py-3.5 font-black text-slate-900 dark:text-white">
                      {st.total_solved || 0}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Staff Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-md p-6 rounded-3xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 shadow-2xl space-y-4">
            <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center space-x-2">
              <UserPlus className="w-5 h-5 text-indigo-500" />
              <span>Create New Staff Account</span>
            </h3>

            <form onSubmit={handleCreateStaff} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Staff Name / Username</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="e.g. Dr. K. Ramesh"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-900 text-xs font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Official Email Address</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="staff@nandhaengg.org"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-900 text-xs font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Initial Password</label>
                <input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-900 text-xs font-mono font-bold"
                  required
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-navy-800 text-slate-700 dark:text-slate-300 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md"
                >
                  Create Staff
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
