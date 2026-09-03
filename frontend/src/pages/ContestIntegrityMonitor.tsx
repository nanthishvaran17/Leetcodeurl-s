import React, { useEffect, useState } from 'react';
import { ShieldAlert, CheckCircle, XCircle, Clock, Search, Filter, RefreshCw, Upload, User, AlertTriangle, FileText, Info } from 'lucide-react';
import { UrlImportModal } from '../components/UrlImportModal';

interface IntegrityCase {
  id: number;
  case_id: string;
  people_id: string;
  student_name: string;
  department_id: number;
  contest_id: string;
  account_ids: string[];
  participation_statuses: Record<string, any>;
  status: 'PENDING' | 'CONFIRMED' | 'DISMISSED' | 'IDENTITY_REVIEW_REQUIRED';
  created_at: string;
  reviewed_by?: string;
  reviewed_at?: string;
  student_email_sent?: boolean;
  staff_email_sent?: boolean;
  staff_push_sent?: boolean;
  audit_history?: any[];
}

export const ContestIntegrityMonitor: React.FC = () => {
  const [cases, setCases] = useState<IntegrityCase[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState<IntegrityCase | null>(null);
  const [activeTab, setActiveTab] = useState<'CASES' | 'AUDIT_LOGS'>('CASES');

  const fetchCases = async () => {
    setLoading(true);
    try {
      const url = filterStatus !== 'ALL' ? `/api/admin/integrity/cases?status=${filterStatus}` : '/api/admin/integrity/cases';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setCases(data);
      }
    } catch (err) {
      console.error('Failed to fetch cases', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await fetch('/api/admin/integrity/audit-logs');
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data);
      }
    } catch (err) {
      console.error('Failed to fetch audit logs', err);
    }
  };

  useEffect(() => {
    fetchCases();
    fetchAuditLogs();
  }, [filterStatus]);

  const handleReview = async (caseId: string, status: 'CONFIRMED' | 'DISMISSED') => {
    try {
      const res = await fetch(`/api/admin/integrity/cases/${caseId}/review`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          reviewed_by: 'Staff Administrator',
        }),
      });

      if (res.ok) {
        fetchCases();
        fetchAuditLogs();
        if (selectedCase?.case_id === caseId) {
          setSelectedCase(null);
        }
      }
    } catch (err) {
      console.error('Error updating case review', err);
    }
  };

  const filteredCases = cases.filter(
    (c) =>
      c.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.people_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.case_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.contest_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const pendingCount = cases.filter((c) => c.status === 'PENDING').length;
  const confirmedCount = cases.filter((c) => c.status === 'CONFIRMED').length;
  const dismissedCount = cases.filter((c) => c.status === 'DISMISSED').length;
  const identityReviewCount = cases.filter((c) => c.status === 'IDENTITY_REVIEW_REQUIRED').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/30">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Dual-ID Integrity Review System</h1>
              <p className="text-sm text-slate-400">
                Automated non-attendance detection across multiple contest accounts linked to same People ID
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('CASES')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                activeTab === 'CASES' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Cases ({cases.length})
            </button>
            <button
              onClick={() => setActiveTab('AUDIT_LOGS')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                activeTab === 'AUDIT_LOGS' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Audit Trail ({auditLogs.length})
            </button>
          </div>

          <button
            onClick={() => setIsImportOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm rounded-lg shadow-lg shadow-indigo-600/20 transition-all"
          >
            <Upload className="w-4 h-4" />
            <span>Bulk URL Import</span>
          </button>
          <button
            onClick={() => { fetchCases(); fetchAuditLogs(); }}
            className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-300 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Review Cases</p>
            <h3 className="text-2xl font-bold mt-1">{cases.length}</h3>
          </div>
          <div className="p-3 bg-slate-800/80 text-slate-300 rounded-lg">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900/60 border border-amber-500/30 p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Dual-ID Review Required</p>
            <h3 className="text-2xl font-bold text-amber-300 mt-1">{pendingCount}</h3>
          </div>
          <div className="p-3 bg-amber-500/10 text-amber-400 rounded-lg">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900/60 border border-purple-500/30 p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-purple-400 uppercase tracking-wider">Identity Review Required</p>
            <h3 className="text-2xl font-bold text-purple-300 mt-1">{identityReviewCount}</h3>
          </div>
          <div className="p-3 bg-purple-500/10 text-purple-400 rounded-lg">
            <User className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900/60 border border-emerald-500/30 p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Resolved / Reviewed</p>
            <h3 className="text-2xl font-bold text-emerald-300 mt-1">{confirmedCount + dismissedCount}</h3>
          </div>
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-lg">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {activeTab === 'CASES' ? (
        <>
          {/* Filters & Search */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/40 p-4 border border-slate-800 rounded-xl">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                placeholder="Search by People ID, Name, Case..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-400 font-medium">Status:</span>
              {['ALL', 'PENDING', 'CONFIRMED', 'DISMISSED', 'IDENTITY_REVIEW_REQUIRED'].map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                    filterStatus === status
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {/* Cases Table */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/80 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-4">Case ID</th>
                    <th className="px-6 py-4">Student Identity</th>
                    <th className="px-6 py-4">Contest</th>
                    <th className="px-6 py-4">Linked Accounts</th>
                    <th className="px-6 py-4">Review Reason</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                        Loading integrity cases...
                      </td>
                    </tr>
                  ) : filteredCases.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                        No integrity cases match your filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredCases.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-6 py-4 font-mono text-xs text-indigo-400 font-semibold">{c.case_id}</td>
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-100">{c.student_name}</div>
                          <div className="text-xs text-slate-400 font-mono">People ID: {c.people_id}</div>
                        </td>
                        <td className="px-6 py-4 font-medium text-slate-200">{c.contest_id}</td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {c.account_ids.map((acc, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-xs font-mono text-slate-300"
                              >
                                @{acc}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {c.status === 'IDENTITY_REVIEW_REQUIRED' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-500/10 border border-purple-500/30 text-purple-300">
                              <User className="w-3.5 h-3.5" />
                              Identity Review Required
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 border border-amber-500/30 text-amber-300">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              Dual-ID Review Required
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {c.status === 'PENDING' && (
                            <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-medium rounded-full">
                              Pending Review
                            </span>
                          )}
                          {c.status === 'CONFIRMED' && (
                            <span className="px-2.5 py-1 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium rounded-full">
                              Confirmed
                            </span>
                          )}
                          {c.status === 'DISMISSED' && (
                            <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium rounded-full">
                              Dismissed
                            </span>
                          )}
                          {c.status === 'IDENTITY_REVIEW_REQUIRED' && (
                            <span className="px-2.5 py-1 bg-purple-500/10 border border-purple-500/30 text-purple-400 text-xs font-medium rounded-full">
                              Identity Unlinked
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setSelectedCase(c)}
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded text-xs font-medium transition-all flex items-center gap-1"
                            >
                              <Info className="w-3.5 h-3.5" /> Details
                            </button>

                            {c.status === 'PENDING' && (
                              <>
                                <button
                                  onClick={() => handleReview(c.case_id, 'CONFIRMED')}
                                  className="px-2.5 py-1 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 rounded text-xs font-semibold transition-all"
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={() => handleReview(c.case_id, 'DISMISSED')}
                                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded text-xs font-medium transition-all"
                                >
                                  Dismiss
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Audit Logs View */
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-xl p-6 space-y-4">
          <h2 className="text-lg font-bold text-slate-200">System Integrity Audit Trail</h2>
          <p className="text-xs text-slate-400">
            Immutable log of contest syncs, attendance freeze events, duplicate account detections, case creations, and notification dispatches.
          </p>

          <div className="divide-y divide-slate-800 border border-slate-800 rounded-lg overflow-hidden font-mono text-xs">
            {auditLogs.length === 0 ? (
              <div className="p-8 text-center text-slate-500 font-sans">No audit events recorded yet.</div>
            ) : (
              auditLogs.map((log) => (
                <div key={log.id} className="p-3 bg-slate-950/60 hover:bg-slate-900 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 font-semibold rounded border border-indigo-500/30">
                      {log.event_type}
                    </span>
                    <span className="text-slate-300 font-sans font-medium">
                      {log.contest_id ? `[${log.contest_id}] ` : ''}
                      {log.people_id ? `People ID: ${log.people_id} — ` : ''}
                      {JSON.stringify(log.details)}
                    </span>
                  </div>
                  <div className="text-slate-500 shrink-0">{log.created_at}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Case Details Drawer / Modal */}
      {selectedCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-xl w-full p-6 shadow-2xl space-y-4 text-white relative">
            <button
              onClick={() => setSelectedCase(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
             
            </button>

            <h2 className="text-xl font-bold border-b border-slate-800 pb-2">Case Audit & Review Details</h2>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between border-b border-slate-800/60 py-1.5">
                <span className="text-slate-400">Case ID:</span>
                <span className="font-mono text-indigo-400 font-semibold">{selectedCase.case_id}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/60 py-1.5">
                <span className="text-slate-400">People ID:</span>
                <span className="font-mono text-slate-200">{selectedCase.people_id}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/60 py-1.5">
                <span className="text-slate-400">Student Name:</span>
                <span className="font-semibold text-slate-100">{selectedCase.student_name}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/60 py-1.5">
                <span className="text-slate-400">Contest:</span>
                <span>{selectedCase.contest_id}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/60 py-1.5">
                <span className="text-slate-400">Current Status:</span>
                <span className="font-bold text-amber-400">{selectedCase.status}</span>
              </div>
            </div>

            <div className="space-y-1">
              <h4 className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Account Participation Statuses</h4>
              <pre className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-slate-300 overflow-x-auto">
                {JSON.stringify(selectedCase.participation_statuses, null, 2)}
              </pre>
            </div>

            <div className="space-y-1">
              <h4 className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Notification Dispatch Log</h4>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className={`p-2 rounded border text-center font-medium ${selectedCase.student_email_sent ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>
                  Student Email: {selectedCase.student_email_sent ? 'SENT' : 'NOT SENT'}
                </div>
                <div className={`p-2 rounded border text-center font-medium ${selectedCase.staff_email_sent ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>
                  Staff Email: {selectedCase.staff_email_sent ? 'SENT' : 'NOT SENT'}
                </div>
                <div className={`p-2 rounded border text-center font-medium ${selectedCase.staff_push_sent ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>
                  Staff App Push: {selectedCase.staff_push_sent ? 'SENT' : 'NOT SENT'}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3">
              <button
                onClick={() => setSelectedCase(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      <UrlImportModal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} onSuccess={fetchCases} />
    </div>
  );
};
