import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Building2, RefreshCw, Sparkles, Search, Plus,
  Trash2, UserCheck, X, CheckCircle2, AlertTriangle, Users,
  Activity, TrendingUp, BarChart3, ArrowUpRight, ArrowDownRight,
  Zap, BookOpen, RotateCcw, ShieldCheck, Clock, Download,
  SlidersHorizontal, ChevronRight, FileSpreadsheet, FileText,
  HelpCircle, Eye, Compass, Target, PieChart, Layers, BrainCircuit,
  Award, Flame, Filter, ChevronDown, Check, AlertCircle, ArrowRight,
  Sliders, User, CheckCircle, XCircle, ExternalLink, Calendar, Info,
  UserPlus, UserMinus, Shuffle, Printer, Share2, TrendingDown, Minus
} from 'lucide-react';
import { StaffDetailDrawer } from '../components/admin/StaffDetailDrawer';
import { DepartmentDetailDrawer } from '../components/admin/DepartmentDetailDrawer';
import { GlobalFilter } from '../components/GlobalFilter';
import {
  getCommandCenterSummary, getCommandCenterStudents, addStudent, updateStudent,
  deleteStudent, getCommandCenterDepartments, askCommandCenterAI,
  getFacultyWorkload, assignStudentsBatch, unassignStudentsBatch, autoDistributeDepartment,
  getReportData, CommandCenterSummary, StudentRecord, DeptBenchmark, YearBenchmark,
  DepartmentRecord, StaffRecord, FacultyWorkloadItem
} from '../services/commandCenterService';
import { simulateWhatIfScenario, askAIDepartmentQuery } from '../services/intelligenceService';
import { CustomDropdown } from '../components/CustomDropdown';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import api from '../services/api';
import { useGlobalWebSocket } from '../context/GlobalWebSocketProvider';
import { triggerDownload } from '../utils/mobileDownload';

// ─── Shared Card Component ───────────────────────────────────────────────────

const Card: React.FC<{ children: React.ReactNode; className?: string; id?: string; onClick?: () => void }> = ({ children, className = '', id, onClick }) => (
  <div id={id} onClick={onClick} className={`bg-white dark:bg-navy-950 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-sm ${className}`}>
    {children}
  </div>
);

// ─── Student Detail Drawer ───────────────────────────────────────────────────

const StudentDetailDrawer: React.FC<{
  student: StudentRecord | null;
  staffList: StaffRecord[];
  onClose: () => void;
  onReassign: (studentId: number, targetFacultyId: number) => void;
}> = ({ student, staffList, onClose, onReassign }) => {
  if (!student) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-none animate-fade-in" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md h-full bg-white dark:bg-navy-950 border-l border-slate-200 dark:border-navy-700 shadow-2xl p-6 overflow-y-auto space-y-6 flex flex-col justify-between">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between pb-4 border-b border-slate-100 dark:border-navy-800">
            <div>
              <span className="px-2 py-0.5 rounded bg-brand-50 dark:bg-brand-950 text-brand-600 font-mono text-[10px] font-bold">
                {student.reg_no}
              </span>
              <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white mt-1">
                {student.name}
              </h3>
              <p className="text-xs text-slate-500 font-mono">
                {student.department_code} • {student.year_level} Year
              </p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 transition">
              <X size={18} />
            </button>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-navy-800 border border-slate-100 dark:border-navy-700">
              <div className="text-[10px] font-bold uppercase text-slate-400 font-mono">Total Solved</div>
              <div className="font-display text-2xl font-bold text-slate-900 dark:text-white font-mono mt-0.5">
                {student.total_solved}
              </div>
              <div className="text-[11px] text-emerald-600 font-medium">{student.weekly_change || '+0'} this week</div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-navy-800 border border-slate-100 dark:border-navy-700">
              <div className="text-[10px] font-bold uppercase text-slate-400 font-mono">Contest Rating</div>
              <div className="font-display text-2xl font-bold text-brand-600 font-mono mt-0.5">
                {student.contest_rating || '—'}
              </div>
              <div className="text-[11px] text-slate-500">Contest: {student.contest_standing || '—'}</div>
            </div>
          </div>

          {/* Difficulty Breakdown */}
          <div className="space-y-2">
            <h4 className="font-display text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
              Problem Difficulty Ratio
            </h4>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-mono font-bold">
                <div className="text-[10px] text-emerald-600">Easy</div>
                <div>{student.easy_solved}</div>
              </div>
              <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-mono font-bold">
                <div className="text-[10px] text-amber-600">Medium</div>
                <div>{student.medium_solved}</div>
              </div>
              <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-mono font-bold">
                <div className="text-[10px] text-rose-600">Hard</div>
                <div>{student.hard_solved}</div>
              </div>
            </div>
          </div>

          {/* Mentorship Allocation Control */}
          <div className="space-y-2.5">
            <h4 className="font-display text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
              Faculty Mentorship Allocation
            </h4>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-navy-800 border border-slate-100 dark:border-navy-700 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Current Mentor:</span>
                <span className="font-bold text-slate-900 dark:text-white font-mono">
                  {student.assigned_staff || 'Unassigned'}
                </span>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 font-mono mb-1">
                  Reassign Faculty Mentor:
                </label>
                <GlobalFilter
                  value={""}
                  onChange={val => {
                    if (val) {
                      onReassign(student.id, Number(val));
                    }
                  }}
                  dropdownWidth="w-full"
                  options={[
                    { value: "", label: "Select target faculty member..." },
                    ...staffList.map((s: any) => ({ value: String(s.id), label: `${s.username} (${s.assigned_count}/20)` }))
                  ]}
                  icon={<User className="w-4 h-4" />}
                />
              </div>
            </div>
          </div>

          {/* Details list */}
          <div className="space-y-2.5 text-xs">
            <h4 className="font-display text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
              Operational Attributes
            </h4>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-navy-800 space-y-2 border border-slate-100 dark:border-navy-700">
              <div className="flex justify-between">
                <span className="text-slate-500">LeetCode Username:</span>
                <a href={`https://leetcode.com/${student.leetcode_username}`} target="_blank" rel="noreferrer" className="font-mono font-bold text-brand-600 hover:underline inline-flex items-center gap-1">
                  @{student.leetcode_username} <ExternalLink size={11} />
                </a>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Activity Status:</span>
                <span className={`font-bold font-mono px-2 py-0.5 rounded text-[10px] ${student.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : student.status === 'IMPROVING' ? 'bg-brand-100 text-brand-700' : 'bg-rose-100 text-rose-700'}`}>
                  {student.status || 'ACTIVE'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Last Telemetry Sync:</span>
                <span className="font-mono text-slate-600 dark:text-slate-400">{student.last_updated}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 dark:border-navy-800 flex gap-2">
          <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-navy-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-bold transition">
            Close Drawer
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── HOD Staff Allocation Manager Modal ───────────────────────────────────────

const StaffAllocationModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  deptId?: number;
  departments: DepartmentRecord[];
  onRefreshAll: () => void;
}> = ({ isOpen, onClose, deptId, departments, onRefreshAll }) => {
  const [selectedDeptId, setSelectedDeptId] = useState<number>(deptId || 1);
  const [workload, setWorkload] = useState<FacultyWorkloadItem[]>([]);
  const [unassignedStudents, setUnassignedStudents] = useState<StudentRecord[]>([]);
  const [selectedUnassigned, setSelectedUnassigned] = useState<number[]>([]);
  const [targetFacultyId, setTargetFacultyId] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const wRes = await getFacultyWorkload(selectedDeptId);
      setWorkload(wRes.faculty_workload || []);

      const uRes = await getCommandCenterStudents({
        dept_id: selectedDeptId,
        allocation_filter: 'UNASSIGNED',
        page_size: 50
      });
      setUnassignedStudents(uRes.students || []);
      setSelectedUnassigned([]);
    } catch (e: any) {
      console.error('Workload load failed:', e);
    } finally {
      setLoading(false);
    }
  }, [selectedDeptId]);

  useEffect(() => {
    if (isOpen) loadData();
  }, [isOpen, selectedDeptId, loadData]);

  const handleAutoDistribute = async () => {
    setActionLoading(true);
    setMessage(null);
    try {
      const res = await autoDistributeDepartment(selectedDeptId);
      setMessage({ type: 'success', text: `Auto-distribution complete: ${res.assigned_count || 0} students assigned across faculty mentors.` });
      await loadData();
      onRefreshAll();
    } catch (e: any) {
      setMessage({ type: 'error', text: e?.response?.data?.detail || 'Auto-distribution failed.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleBatchAssign = async () => {
    if (!targetFacultyId || selectedUnassigned.length === 0) return;
    setActionLoading(true);
    setMessage(null);
    try {
      await assignStudentsBatch(targetFacultyId, selectedUnassigned);
      setMessage({ type: 'success', text: `Successfully allocated ${selectedUnassigned.length} students to mentor.` });
      await loadData();
      onRefreshAll();
    } catch (e: any) {
      setMessage({ type: 'error', text: e?.response?.data?.detail || 'Batch assignment failed.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnassignStudent = async (facultyId: number, studentId: number) => {
    setActionLoading(true);
    try {
      await unassignStudentsBatch(facultyId, [studentId]);
      setMessage({ type: 'success', text: 'Student unassigned and returned to queue.' });
      await loadData();
      onRefreshAll();
    } catch (e: any) {
      setMessage({ type: 'error', text: 'Unassign failed.' });
    } finally {
      setActionLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-none animate-fade-in" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-4xl max-h-[90vh] bg-white dark:bg-navy-950 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-2xl flex flex-col justify-between overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 dark:border-navy-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-brand-50 text-brand-600">
              <Users size={18} />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                HOD Faculty Mentorship & Student Allocation Manager
              </h3>
              <p className="text-xs text-slate-500">Enforces institutional 1:20 faculty-to-student mentor ratio</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <GlobalFilter
              value={selectedDeptId.toString()}
              onChange={val => setSelectedDeptId(Number(val))}
              dropdownWidth="w-max min-w-full"
              options={departments.map((d: any) => ({ value: String(d.id), label: `${d.name} (${d.code})`, pillText: d.code }))}
              icon={<Building2 className="w-4 h-4" />}
            />
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X size={18} /></button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1 text-xs">
          {message && (
            <div className={`p-3 rounded-xl font-medium ${message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
              {message.text}
            </div>
          )}

          {/* Quick Actions Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-navy-800 border border-slate-100 dark:border-navy-700">
            <div>
              <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">Unassigned Students Queue: </span>
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold font-mono">{unassignedStudents.length}</span>
            </div>
            {/* Auto-distribute button removed as per user request to handle allocations manually */}
          </div>

          {/* Faculty Workload Grid */}
          <div className="space-y-2.5">
            <h4 className="font-bold font-mono text-slate-500 uppercase tracking-wider">
              Department Faculty Workload Matrix
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {workload.map(fac => {
                const count = fac.assigned_students || 0;
                const pct = Math.min(100, Math.round((count / 20) * 100));
                return (
                  <div key={fac.faculty_id} className="p-3.5 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 space-y-2.5">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white font-display text-sm">{fac.faculty_name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{fac.email}</div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${fac.workload_status === 'NORMAL' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : fac.workload_status === 'AT_RATIO' ? 'bg-brand-50 text-brand-700 border border-brand-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                        {count}/20 ({pct}%)
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-navy-800 overflow-hidden">
                      <div className={`h-full rounded-full ${count <= 20 ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${pct}%` }} />
                    </div>

                    {/* Assigned Student Mini Tags */}
                    {fac.students && fac.students.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-[10px] text-slate-400 font-mono">Assigned Students ({fac.students.length}):</div>
                        <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                          {fac.students.map(s => (
                            <span key={s.id} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-navy-800 text-[10px] font-mono">
                              <span>{s.name.split(' ')[0]}</span>
                              <button onClick={() => handleUnassignStudent(fac.faculty_id, s.id)} className="text-slate-400 hover:text-rose-600">×</button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Unassigned Students Selection Box */}
          {unassignedStudents.length > 0 && (
            <div className="p-4 rounded-xl border border-slate-200 dark:border-navy-700 space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="font-bold font-mono text-slate-700 dark:text-slate-200">
                  Manual Student Allocation ({unassignedStudents.length} unassigned)
                </h4>
                <div className="flex items-center gap-2">
                  <GlobalFilter
                    value={targetFacultyId?.toString() || ""}
                    onChange={val => setTargetFacultyId(Number(val))}
                    dropdownWidth="w-64"
                    options={[
                      { value: "", label: "Select target faculty..." },
                      ...workload.map((f: any) => ({ value: String(f.faculty_id), label: `${f.faculty_name} (${f.assigned_students}/20)` }))
                    ]}
                    icon={<User className="w-4 h-4" />}
                  />
                  <button
                    disabled={!targetFacultyId || selectedUnassigned.length === 0 || actionLoading}
                    onClick={handleBatchAssign}
                    className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold disabled:opacity-50"
                  >
                    Assign ({selectedUnassigned.length})
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto">
                {unassignedStudents.map(s => {
                  const isChecked = selectedUnassigned.includes(s.id);
                  return (
                    <label key={s.id} className={`p-2 rounded-lg border flex items-center gap-2 transition ${isChecked ? 'bg-brand-50 border-brand-300 font-bold' : 'border-slate-100 bg-slate-50'}`}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={e => {
                          if (e.target.checked) setSelectedUnassigned(prev => [...prev, s.id]);
                          else setSelectedUnassigned(prev => prev.filter(id => id !== s.id));
                        }}
                      />
                      <div className="truncate">
                        <div className="truncate text-slate-800 dark:text-slate-200">{s.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{s.reg_no}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-navy-800 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 text-xs">
            Close Manager
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Dedicated Report Hub Modal ───────────────────────────────────────────────

const ReportHubModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  deptId?: number;
  departments: DepartmentRecord[];
}> = ({ isOpen, onClose, deptId, departments }) => {
  const [selectedReportType, setSelectedReportType] = useState<string>('EXECUTIVE');
  const [selectedDeptId, setSelectedDeptId] = useState<number | undefined>(deptId);
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getReportData(selectedReportType, selectedDeptId);
      setReportData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [selectedReportType, selectedDeptId]);

  const [downloadingExcel, setDownloadingExcel] = useState(false);

  const handleDownloadExcel = async () => {
    setDownloadingExcel(true);
    try {
      const response = await api.get('/reports/export-official-college-summary', { responseType: 'blob' });
      await triggerDownload(response.data, 'Nandha_College_Official_Weekly_Report.xlsx');
    } catch (err) {
      console.error("Report download error:", err);
      alert("Failed to download Excel report.");
    } finally {
      setDownloadingExcel(false);
    }
  };

  useEffect(() => {
    if (isOpen) loadReport();
  }, [isOpen, selectedReportType, selectedDeptId, loadReport]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-none animate-fade-in" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-4xl max-h-[90vh] bg-white dark:bg-navy-950 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-2xl flex flex-col justify-between overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-navy-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-brand-50 text-brand-600">
              <FileSpreadsheet size={18} />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Institutional Executive Report Generator
              </h3>
              <p className="text-xs text-slate-500">Live generated audit and accreditation reports</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-navy-800 border border-slate-100">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Select Report Type</label>
              <GlobalFilter
                value={selectedReportType}
                onChange={val => setSelectedReportType(val)}
                dropdownWidth="w-full"
                options={[
                  { value: "EXECUTIVE", label: "Executive Department Coding Health Report" },
                  { value: "FACULTY_ALLOCATION", label: "Faculty Mentorship & Allocation Audit Report" },
                  { value: "INACTIVE_AT_RISK", label: "Inactive & At-Risk Intervention Report" }
                ]}
                icon={<FileText className="w-4 h-4" />}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Department Scope</label>
              <GlobalFilter
                value={selectedDeptId?.toString() || ""}
                onChange={val => setSelectedDeptId(val ? Number(val) : undefined)}
                dropdownWidth="w-full"
                options={[
                  { value: "", label: "All Institutional Departments", pillText: "ALL" },
                  ...departments.map((d: any) => ({ value: String(d.id), label: `${d.name} (${d.code})`, pillText: d.code }))
                ]}
                icon={<Building2 className="w-4 h-4" />}
              />
            </div>
          </div>

          {/* Live Preview Paper */}
          {loading ? (
            <div className="p-12 text-center text-slate-400">Loading live report data...</div>
          ) : (
            <div className="p-6 rounded-xl border border-slate-200 bg-white shadow-sm space-y-4 text-slate-900">
              <div className="border-b pb-3 flex justify-between items-end">
                <div>
                  <div className="text-[10px] font-mono uppercase font-bold text-slate-400">NANDHA ENGINEERING COLLEGE (AUTONOMOUS)</div>
                  <h2 className="text-base font-bold font-display text-slate-900">{reportData?.report_title}</h2>
                </div>
                <div className="text-right text-[10px] font-mono text-slate-500">
                  {reportData?.generated_at}
                </div>
              </div>

              {/* Report Contents */}
              {selectedReportType === 'EXECUTIVE' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(reportData?.summary_metrics || {}).map(([k, v]: any) => (
                      <div key={k} className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                        <div className="text-[10px] text-slate-400 font-mono">{k}</div>
                        <div className="text-base font-bold font-mono mt-0.5">{String(v)}</div>
                      </div>
                    ))}
                  </div>

                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b font-mono font-bold text-slate-500">
                        <th className="py-1.5">Dimension</th>
                        <th className="py-1.5 text-right">Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y font-mono">
                      {(reportData?.dimension_breakdown || []).map((row: any, i: number) => (
                        <tr key={i}>
                          <td className="py-1.5 font-sans">{row.dimension}</td>
                          <td className="py-1.5 text-right font-bold">{row.score}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {selectedReportType === 'FACULTY_ALLOCATION' && (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b font-mono font-bold text-slate-500">
                      <th className="py-1.5">Faculty Mentor</th>
                      <th className="py-1.5">Dept</th>
                      <th className="py-1.5 text-right">Assigned</th>
                      <th className="py-1.5 text-right">Active Solvers</th>
                      <th className="py-1.5 text-center">Ratio Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y font-mono">
                    {(reportData?.faculty_records || []).map((fac: any) => (
                      <tr key={fac.faculty_id}>
                        <td className="py-1.5 font-bold">{fac.faculty_name}</td>
                        <td className="py-1.5">{fac.department_code}</td>
                        <td className="py-1.5 text-right">{fac.assigned_students}/20</td>
                        <td className="py-1.5 text-right text-emerald-600 font-bold">{fac.active_students}</td>
                        <td className="py-1.5 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${fac.workload_status === 'NORMAL' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                            {fac.workload_status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {selectedReportType === 'INACTIVE_AT_RISK' && (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-rose-600">Total Inactive Solvers: {reportData?.total_inactive}</div>
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b font-mono font-bold text-slate-500">
                        <th className="py-1.5">Reg No</th>
                        <th className="py-1.5">Student Name</th>
                        <th className="py-1.5">Dept</th>
                        <th className="py-1.5">Assigned Faculty Mentor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y font-mono">
                      {(reportData?.students || []).map((st: any) => (
                        <tr key={st.reg_no}>
                          <td className="py-1.5 font-bold">{st.reg_no}</td>
                          <td className="py-1.5 font-sans">{st.name}</td>
                          <td className="py-1.5">{st.department}</td>
                          <td className="py-1.5 text-brand-600 font-bold">{st.assigned_mentor}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-navy-800 flex justify-between items-center">
          <button onClick={() => window.print()} className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold inline-flex items-center gap-1.5 hover:bg-slate-50">
            <Printer size={14} /> Print Document
          </button>
          <div className="flex gap-2">
            <button
              onClick={handleDownloadExcel}
              disabled={downloadingExcel}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Download size={13} className={downloadingExcel ? 'animate-spin' : ''} />
              <span>{downloadingExcel ? 'Downloading...' : 'Export Excel (.xlsx)'}</span>
            </button>
            <button onClick={onClose} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 text-xs">
              Close Hub
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────

export const HODCommandCenter: React.FC = () => {
  const { user } = useAuth();
  const { notify } = useNotification();
  // ── Multi-Dimensional View Scope ──
  const [selectedStaff, setSelectedStaff] = useState<string>('ALL');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [selectedYear, setSelectedYear] = useState<string>('ALL');
  const [selectedSection, setSelectedSection] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Summary & Metadata
  const [summary, setSummary] = useState<CommandCenterSummary | null>(null);
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [staffList, setStaffList] = useState<StaffRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [scopeLoading, setScopeLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastLiveTimestamp, setLastLiveTimestamp] = useState<string>(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
  const [wsConnected, setWsConnected] = useState<boolean>(true);

  // Student Directory Table State
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [studentsTotal, setStudentsTotal] = useState<number>(0);
  const [studentsPage, setStudentsPage] = useState<number>(1);
  const [studentsSearch, setStudentsSearch] = useState<string>('');
  const [studentsLoading, setStudentsLoading] = useState<boolean>(false);
  const [selectedStudentDetail, setSelectedStudentDetail] = useState<StudentRecord | null>(null);
  const [selectedStaffDetail, setSelectedStaffDetail] = useState<StaffRecord | null>(null);
  const [selectedDeptIntelligence, setSelectedDeptIntelligence] = useState<DeptBenchmark | null>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
  const [batchTargetFaculty, setBatchTargetFaculty] = useState<number | null>(null);

  // Modals
  const [showStaffAllocationModal, setShowStaffAllocationModal] = useState<boolean>(false);
  const [showReportHubModal, setShowReportHubModal] = useState<boolean>(false);
  const [showMethodologyModal, setShowMethodologyModal] = useState<boolean>(false);
  const [showAIModal, setShowAIModal] = useState<boolean>(false);
  const [showWhatIfModal, setShowWhatIfModal] = useState<boolean>(false);
  const [confirmUnassignTarget, setConfirmUnassignTarget] = useState<{ id: number; name: string } | null>(null);
  const [confirmUnassignLoading, setConfirmUnassignLoading] = useState(false);
  const [aiQuery, setAiQuery] = useState<string>('');
  const [aiResponse, setAiResponse] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [whatIfTarget, setWhatIfTarget] = useState<number>(95);
  const [whatIfResult, setWhatIfResult] = useState<any>(null);

  // Load Scope Data
  const loadScopedData = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true); else setScopeLoading(true);
    setError(null);

    const deptId = selectedDept !== 'ALL' ? Number(selectedDept) : undefined;
    const staffId = selectedStaff !== 'ALL' ? Number(selectedStaff) : undefined;
    const yearLevel = selectedYear !== 'ALL' ? selectedYear : undefined;

    try {
      const summaryData = await getCommandCenterSummary({
        dept_id: deptId,
        staff_id: staffId,
        year_level: yearLevel
      });
      setSummary(summaryData);
      if (summaryData.staff_list) setStaffList(summaryData.staff_list);
      setLastLiveTimestamp(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
    } catch (err: any) {
      console.error('Command center load error:', err);
      setError(err?.message || 'Unable to connect to analytics database.');
    } finally {
      setLoading(false);
      setScopeLoading(false);
      setRefreshing(false);
    }
  }, [selectedDept, selectedStaff, selectedYear]);

  // Load Students List
  const loadStudents = useCallback(async () => {
    setStudentsLoading(true);
    const deptId = selectedDept !== 'ALL' ? Number(selectedDept) : undefined;
    const staffId = selectedStaff !== 'ALL' ? Number(selectedStaff) : undefined;
    const yearLevel = selectedYear !== 'ALL' ? selectedYear : undefined;

    try {
      const res = await getCommandCenterStudents({
        page: studentsPage,
        page_size: 15,
        search: studentsSearch || undefined,
        dept_id: deptId,
        staff_id: staffId,
        year_level: yearLevel,
        status_filter: selectedStatus !== 'ALL' ? selectedStatus : undefined
      });
      setStudents(res.students || []);
      setStudentsTotal(res.total || 0);
      setSelectedStudentIds([]);
    } catch (err) {
      console.error('Students load failed:', err);
    } finally {
      setStudentsLoading(false);
    }
  }, [studentsPage, studentsSearch, selectedDept, selectedStaff, selectedYear, selectedStatus]);

  useEffect(() => {
    getCommandCenterDepartments().then(setDepartments).catch(() => {});
    loadScopedData(true);
  }, []);

  useEffect(() => {
    loadScopedData(false);
    setStudentsPage(1);
  }, [selectedStaff, selectedDept, selectedYear, selectedSection, selectedStatus, loadScopedData]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  const { isConnected: isGlobalWsConnected, registerCallback, unregisterCallback } = useGlobalWebSocket();

  useEffect(() => {
    setWsConnected(isGlobalWsConnected);
  }, [isGlobalWsConnected]);

  // ── WebSocket Ingestion Subscription ──
  useEffect(() => {
    registerCallback('hod_command_center', (data) => {
      if (!data) return;

      if (data.type === 'CONTEST_RESULT_UPDATED' || data.type === 'STUDENT_ACTIVITY_UPDATED') {
        const sid = data.studentId || data.student_id;
        const solved = data.solvedCount ?? data.total_solved;

        setStudents(prev => prev.map(s => {
          if (s.id === sid || s.reg_no === data.regNo) {
            return {
              ...s,
              total_solved: solved ?? s.total_solved,
              weekly_change: data.weeklyChange ?? s.weekly_change,
              contest_standing: data.contestStanding ?? (data.q1 !== undefined ? `${(data.q1+data.q2+data.q3+data.q4)}/4` : s.contest_standing),
              status: 'ACTIVE',
              last_updated: 'Just now'
            };
          }
          return s;
        }));
        setLastLiveTimestamp(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
      }

      if (data.type === 'STAFF_ALLOCATION_UPDATED') {
        loadScopedData(false);
        loadStudents();
      }

      if (data.type === 'DEPARTMENT_METRICS_UPDATED') {
        loadScopedData(false);
      }
    });

    return () => unregisterCallback('hod_command_center');
  }, [registerCallback, unregisterCallback, loadScopedData, loadStudents]);

  const handleReassign = async (studentId: number, targetFacultyId: number) => {
    try {
      await assignStudentsBatch(targetFacultyId, [studentId]);
      setSelectedStudentDetail(null);
      loadScopedData(false);
      loadStudents();
    } catch (e) {
      console.error(e);
    }
  };

  const handleBatchAssignFromTable = async () => {
    if (!batchTargetFaculty || selectedStudentIds.length === 0) return;
    try {
      await assignStudentsBatch(batchTargetFaculty, selectedStudentIds);
      setSelectedStudentIds([]);
      loadScopedData(false);
      loadStudents();
    } catch (e) {
      console.error(e);
    }
  };

  const handleUnassignAllForStaff = (staffId: number, staffName: string) => {
    setConfirmUnassignTarget({ id: staffId, name: staffName });
  };

  const executeUnassignAll = async () => {
    if (!confirmUnassignTarget) return;
    setConfirmUnassignLoading(true);
    try {
      await unassignStudentsBatch(confirmUnassignTarget.id, []);
      notify.success(`All mentees unassigned from ${confirmUnassignTarget.name}.`, '', { category: 'ALLOCATION' });
      setConfirmUnassignTarget(null);
      loadScopedData(false);
      loadStudents();
    } catch (err: any) {
      notify.error('Failed to unassign mentees.', '', { category: 'ALLOCATION' });
    } finally {
      setConfirmUnassignLoading(false);
    }
  };

  const handleAIQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiQuery.trim()) return;
    setAiLoading(true);
    try {
      const res = await askAIDepartmentQuery(aiQuery);
      setAiResponse(res);
    } catch (err) {
      console.error(err);
    } finally {
      setAiLoading(false);
    }
  };

  const handleWhatIf = async (val: number) => {
    setWhatIfTarget(val);
    if (!health) return;
    try {
      const sim = await simulateWhatIfScenario(health.participation_score, val, 0);
      setWhatIfResult(sim);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading && !summary) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-slate-400">
        <RefreshCw size={32} className="animate-spin mb-4 text-brand-600" />
        <p className="font-display text-sm font-semibold text-slate-700 dark:text-slate-300">Loading Nandha Institutional Operations Center...</p>
        <p className="text-xs text-slate-400 font-mono mt-1">Connecting to authoritative SQLite WAL database</p>
      </div>
    );
  }

  const health = summary?.department_health;
  const brief = summary?.executive_brief;
  const needsAtt = summary?.needs_attention;
  const deptMatrix = summary?.benchmarks?.department_matrix || [];
  const yearMatrix = summary?.benchmarks?.year_matrix || [];

  const totalInScope = health?.total_students || 0;
  const activeInScope = health?.active_this_week || 0;
  const inactiveInScope = health?.inactive_count || 0;
  const improvingInScope = health?.improving_count || 0;
  const partRateInScope = health?.participation_score || 0;

  const scopeStaffName = staffList.find(s => String(s.id) === selectedStaff)?.username || 'All Staff';
  const scopeDeptCode = departments.find(d => String(d.id) === selectedDept)?.code || 'All Departments';

  const staffOptions = [
    { value: 'ALL', label: user?.role?.toLowerCase() === 'hod' ? 'All Department Staff Mentors' : 'All Staff Mentors', icon: Users, badge: 'ALL', badgeColor: 'bg-brand-500 text-white' },
    ...staffList.map(s => ({ value: String(s.id), label: s.username, sublabel: `${s.assigned_count} students`, icon: User }))
  ];

  const deptOptions = [
    ...(user?.role?.toLowerCase() === 'hod' ? [] : [{ value: 'ALL', label: 'All Departments', icon: Building2, badge: 'ALL', badgeColor: 'bg-brand-500 text-white' }]),
    ...departments.map(d => ({ value: String(d.id), label: d.code, count: d.student_count, icon: Building2 }))
  ];

  const yearOptions = [
    { value: 'ALL', label: 'All Years', badge: 'ALL', icon: Calendar },
    { value: 'I', label: 'I Year', badge: '1st', icon: Calendar },
    { value: 'II', label: 'II Year', badge: '2nd', icon: Calendar },
    { value: 'III', label: 'III Year', badge: '3rd', icon: Calendar },
    { value: 'IV', label: 'IV Year', badge: '4th', icon: Calendar }
  ];

  const sectionOptions = [
    { value: 'ALL', label: 'All Sections', badge: 'ALL', icon: Layers },
    { value: 'A', label: 'Section A', badge: 'A', icon: Layers },
    { value: 'B', label: 'Section B', badge: 'B', icon: Layers },
    { value: 'C', label: 'Section C', badge: 'C', icon: Layers }
  ];

  const statusOptions = [
    { value: 'ALL', label: 'All Status', badge: 'ALL', icon: Activity },
    { value: 'ACTIVE', label: 'Active Solvers', badge: 'Active', badgeColor: 'bg-emerald-500/10 text-emerald-600', icon: CheckCircle2 },
    { value: 'INACTIVE', label: 'Inactive', badge: 'Inactive', badgeColor: 'bg-rose-500/10 text-rose-600', icon: AlertTriangle },
    { value: 'IMPROVING', label: 'Improving', badge: 'Improving', badgeColor: 'bg-brand-500/10 text-brand-600', icon: TrendingUp }
  ];

  return (
    <div className="space-y-5 pb-16 font-sans text-slate-900 dark:text-slate-100 antialiased">



      {/* ── 1. HEADER ──────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white p-6 sm:p-8 shadow-lg border border-brand-500/30">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-brand-500/20 border border-brand-400/30 text-brand-300 text-xs font-black">
              <span className="uppercase tracking-tight">
                {user?.role?.toLowerCase() === 'hod' ? `DEPARTMENT: ${departments[0]?.code || 'Loading...'}` : "NANDHA ENGINEERING COLLEGE (AUTONOMOUS)"}
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white mt-1 uppercase">
              {['faculty', 'staff'].includes(user?.role?.toLowerCase() || '') ? (
                <>
                  MY FACULTY <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-400 via-teal-300 to-indigo-300">ACTION CENTER</span>
                </>
              ) : user?.role?.toLowerCase() === 'hod' ? (
                <>
                  DEPARTMENT EXECUTIVE <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-400 via-teal-300 to-indigo-300">OPERATIONS CENTER</span>
                </>
              ) : (
                <>
                  Executive Coding <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-400 via-teal-300 to-indigo-300">Operations Center</span>
                </>
              )}
            </h1>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Live Status Pill */}
            {wsConnected ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/60 text-emerald-400 text-xs font-mono font-semibold border border-emerald-800/60 shadow-inner">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                <span>LIVE • {lastLiveTimestamp}</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-950/60 text-amber-400 text-xs font-mono font-semibold border border-amber-800/60 shadow-inner">
                <AlertTriangle size={13} />
                <span>RECONNECTING...</span>
              </div>
            )}

            {/* HOD Staff Allocation Manager Button */}
            <button
              onClick={() => setShowStaffAllocationModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-purple-900/30 hover:bg-purple-900/50 text-purple-300 border border-purple-800/50 text-xs font-bold transition cursor-pointer shadow-sm"
            >
              <Users size={13} />
              <span>Staff Allocation</span>
            </button>

            {/* Dedicated Report Hub Button */}
            <button
              onClick={() => setShowReportHubModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-900/30 hover:bg-emerald-900/50 text-emerald-300 border border-emerald-800/50 text-xs font-bold transition cursor-pointer shadow-sm"
            >
              <FileSpreadsheet size={13} />
              <span>Dedicated Reports</span>
            </button>

            <button
              onClick={() => { setRefreshing(true); loadScopedData(false); loadStudents(); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/60 hover:bg-slate-700/80 text-slate-300 text-xs font-bold transition cursor-pointer border border-slate-700/50"
            >
              <RotateCcw size={13} className={refreshing ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>



      {/* ── 3. STUDENT COHORT SUMMARY BANNER ───────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 rounded-2xl bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-brand-50 dark:bg-brand-950 text-brand-600 font-bold font-mono text-sm">
            {totalInScope}
          </div>
          <div>
            <div className="font-display text-sm font-bold text-slate-900 dark:text-white">
              Your Student Cohort ({scopeStaffName} • {scopeDeptCode})
            </div>
            <div className="text-xs text-slate-500 font-mono">
              <span className="text-emerald-600 font-bold">{activeInScope} Active</span> • <span className="text-rose-600 font-bold">{inactiveInScope} Inactive</span> • <span className="text-brand-600 font-bold">{improvingInScope} Improving</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="text-slate-400">Last Activity: {lastLiveTimestamp}</span>
          {summary?.unassigned_student_count ? (
            <button onClick={() => setShowStaffAllocationModal(true)} className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 font-bold border border-amber-200 hover:bg-amber-100">
              {summary.unassigned_student_count} Unassigned Students
            </button>
          ) : null}
        </div>
      </div>

      {/* ── 4. FOUR PRIMARY KPI CARDS ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Card 
          className={`p-4 flex flex-col justify-between cursor-pointer transition-all hover:-translate-y-1 hover:shadow-md ${selectedStatus === 'ALL' ? 'ring-2 ring-slate-400 bg-slate-50 dark:bg-navy-800' : ''}`}
          onClick={() => {
            setSelectedStatus('ALL');
            document.getElementById('student-directory-section')?.scrollIntoView({ behavior: 'smooth' });
          }}
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider font-mono">TOTAL STUDENTS</span>
            <Users size={15} className="text-slate-600" />
          </div>
          <div className="mt-2">
            <div className="font-display text-3xl font-extrabold text-slate-900 dark:text-white font-mono">{totalInScope}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Assigned in scope</div>
          </div>
        </Card>

        <Card 
          className={`p-4 flex flex-col justify-between cursor-pointer transition-all hover:-translate-y-1 hover:shadow-md ${selectedStatus === 'ACTIVE' ? 'ring-2 ring-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/20' : ''}`}
          onClick={() => {
            setSelectedStatus('ACTIVE');
            document.getElementById('student-directory-section')?.scrollIntoView({ behavior: 'smooth' });
          }}
        >
          <div className="flex items-center justify-between text-emerald-600">
            <span className="text-[10px] font-bold uppercase tracking-wider font-mono">ACTIVE SOLVERS</span>
            <CheckCircle2 size={15} />
          </div>
          <div className="mt-2">
            <div className="font-display text-3xl font-extrabold text-emerald-600 font-mono">{activeInScope}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">{partRateInScope}% Participation</div>
          </div>
        </Card>

        <Card 
          className={`p-4 flex flex-col justify-between cursor-pointer transition-all hover:-translate-y-1 hover:shadow-md ${selectedStatus === 'INACTIVE' ? 'ring-2 ring-rose-500 bg-rose-50/50 dark:bg-rose-900/20' : ''}`}
          onClick={() => {
            setSelectedStatus('INACTIVE');
            document.getElementById('student-directory-section')?.scrollIntoView({ behavior: 'smooth' });
          }}
        >
          <div className="flex items-center justify-between text-rose-600">
            <span className="text-[10px] font-bold uppercase tracking-wider font-mono">INACTIVE SOLVERS</span>
            <Clock size={15} />
          </div>
          <div className="mt-2">
            <div className="font-display text-3xl font-extrabold text-rose-600 font-mono">{inactiveInScope}</div>
            <div className="text-[11px] text-rose-500 mt-0.5 font-semibold">Needs Review</div>
          </div>
        </Card>

        <Card 
          className={`p-4 flex flex-col justify-between cursor-pointer transition-all hover:-translate-y-1 hover:shadow-md ${selectedStatus === 'IMPROVING' ? 'ring-2 ring-brand-500 bg-brand-50/50 dark:bg-brand-900/20' : ''}`}
          onClick={() => {
            setSelectedStatus('IMPROVING');
            document.getElementById('student-directory-section')?.scrollIntoView({ behavior: 'smooth' });
          }}
        >
          <div className="flex items-center justify-between text-brand-600">
            <span className="text-[10px] font-bold uppercase tracking-wider font-mono">IMPROVING TREND</span>
            <TrendingUp size={15} />
          </div>
          <div className="mt-2">
            <div className="font-display text-3xl font-extrabold text-brand-600 font-mono">{improvingInScope}</div>
            <div className="text-[11px] text-brand-500 mt-0.5 font-semibold">Positive Velocity</div>
          </div>
        </Card>
      </div>

      {/* ── 5. DEPARTMENT PERFORMANCE & NEEDS ATTENTION ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Department Performance (Compact) */}
        <Card className="lg:col-span-6 p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-navy-800">
            <div>
              <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                Department Performance ({scopeDeptCode})
              </h3>
              <p className="text-xs text-slate-500">Verified DB Telemetry Dimensions</p>
            </div>
            <div className="text-right">
              <span className="text-xs font-mono font-bold text-slate-400">HEALTH: </span>
              <span className="font-display text-lg font-extrabold text-brand-600 font-mono">{health?.health_score}/100</span>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            {[
              { label: 'Participation Rate', val: health?.participation_score || 0 },
              { label: 'Problem Consistency', val: health?.consistency_score || 0 },
              { label: 'Growth Trajectory', val: health?.growth_score || 0 },
              { label: 'Contest Performance', val: health?.contest_performance_score || 0 },
              { label: 'Difficulty Ratio', val: health?.difficulty_progress_score || 0 },
            ].map((d, i) => (
              <div key={i} className="flex items-center justify-between py-1 border-b border-slate-50 dark:border-navy-800 last:border-0">
                <span className="text-slate-600 dark:text-slate-300 font-medium">{d.label}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1.5 rounded-full bg-slate-100 dark:bg-navy-800 overflow-hidden">
                    <div className="h-full bg-brand-600 rounded-full" style={{ width: `${d.val}%` }} />
                  </div>
                  <span className="font-mono font-bold text-slate-900 dark:text-white w-10 text-right">{d.val}%</span>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 flex justify-between items-center text-xs">
            <button
              onClick={() => setShowMethodologyModal(true)}
              className="text-brand-600 hover:text-brand-700 font-bold inline-flex items-center gap-1"
            >
              <Info size={13} /> View Methodology
            </button>
            <div className="flex gap-2">
              <button onClick={() => setShowWhatIfModal(true)} className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold">
                What-If
              </button>
              <button onClick={() => setShowAIModal(true)} className="px-2.5 py-1 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-600 text-xs font-semibold">
                Ask AI
              </button>
            </div>
          </div>
        </Card>

        {/* Right: Operational Needs Attention Queue */}
        <Card className="lg:col-span-6 p-5 space-y-3.5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-navy-800">
            <div>
              <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                Needs Operational Attention
              </h3>
              <p className="text-xs text-slate-500">Actionable student cohort alerts</p>
            </div>
            <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
              ACTION QUEUE
            </span>
          </div>

          <div className="space-y-2.5">
            {[
              {
                color: 'text-rose-600 bg-rose-50 border-rose-200',
                badge: 'INACTIVE',
                count: inactiveInScope,
                title: 'Inactive Solvers',
                sub: '0 problems solved in current cycle',
                onClick: () => setSelectedStatus('INACTIVE')
              },
              {
                color: 'text-amber-600 bg-amber-50 border-amber-200',
                badge: 'DECLINING',
                count: needsAtt?.declining_count || 0,
                title: 'Declining Weekly Velocity',
                sub: 'Submissions decreased vs last cycle',
                onClick: () => setSelectedStatus('INACTIVE')
              },
              {
                color: 'text-brand-600 bg-brand-50 border-brand-200',
                badge: 'IMPROVING',
                count: improvingInScope,
                title: 'Accelerating Solvers',
                sub: 'Rating velocity increased this week',
                onClick: () => setSelectedStatus('IMPROVING')
              }
            ].map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-navy-800 bg-slate-50/50 dark:bg-navy-800/40">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-xs text-slate-900 dark:text-white">{item.title}</h4>
                    <span className={`font-mono text-[10px] font-bold px-1.5 py-0.2 rounded border ${item.color}`}>
                      {item.count}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">{item.sub}</p>
                </div>
                <button
                  onClick={item.onClick}
                  className="text-xs font-bold text-brand-600 hover:text-brand-700 whitespace-nowrap"
                >
                  View Students →
                </button>
              </div>
            ))}
          </div>

          {/* Compact Brief */}
          {brief && (
            <div className="pt-2 text-[11px] text-slate-500 border-t border-slate-100 dark:border-navy-800 space-y-1">
              <div><strong>Top Action:</strong> {brief.action}</div>
            </div>
          )}
        </Card>
      </div>

      {/* ── 6. LIVE STUDENT ACTIVITY (MOST IMPORTANT MAIN OPERATIONAL TABLE) ── */}
      <Card id="student-directory-section" className="p-5 space-y-4 scroll-mt-20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
          <div>
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Live Student Activity</span>
              <span className="text-xs font-mono font-normal text-slate-400">({studentsTotal} students in scope)</span>
            </h2>
            <p className="text-xs text-slate-500">Realtime problem solves and contest question completions</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative min-w-[240px]">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                value={studentsSearch}
                onChange={e => setStudentsSearch(e.target.value)}
                placeholder="Search student, reg no, or LeetCode handle..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-slate-800 dark:text-slate-100 outline-none focus:border-brand-500"
              />
            </div>
          </div>
        </div>

        {/* Batch Allocation Floating Bar */}
        {selectedStudentIds.length > 0 && (
          <div className="p-3 rounded-xl bg-brand-50 border border-brand-200 flex flex-wrap items-center justify-between gap-3 animate-fade-in">
            <div className="text-xs font-bold text-brand-900 font-mono">
              Selected {selectedStudentIds.length} students for faculty allocation:
            </div>
            <div className="flex items-center gap-2">
              <GlobalFilter
                value={batchTargetFaculty?.toString() || ""}
                onChange={val => setBatchTargetFaculty(Number(val))}
                dropdownWidth="w-64"
                options={[
                  { value: "", label: "Select Target Staff Mentor..." },
                  ...staffList.map((s: any) => ({ value: String(s.id), label: `${s.username} (${s.assigned_count}/20)` }))
                ]}
                icon={<User className="w-4 h-4" />}
              />
              <button
                onClick={handleBatchAssignFromTable}
                disabled={!batchTargetFaculty}
                className="px-3.5 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold disabled:opacity-50 transition"
              >
                Allocate Selected
              </button>
              <button
                onClick={() => setSelectedStudentIds([])}
                className="px-2.5 py-1.5 rounded-lg text-slate-500 hover:bg-slate-200 text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto border border-slate-100 dark:border-navy-800 rounded-xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-navy-800 text-[11px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                <th className="py-3 px-3 w-8">
                  <input
                    type="checkbox"
                    checked={students.length > 0 && selectedStudentIds.length === students.length}
                    onChange={e => {
                      if (e.target.checked) setSelectedStudentIds(students.map(s => s.id));
                      else setSelectedStudentIds([]);
                    }}
                  />
                </th>
                <th className="py-3 px-3">Student</th>
                <th className="py-3 px-3">LeetCode Handle</th>
                <th className="py-3 px-3 text-right">Solved</th>
                <th className="py-3 px-3 text-right">Weekly Δ</th>
                <th className="py-3 px-3 text-center">Contest</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3">Assigned Mentor</th>
                <th className="py-3 px-3">Last Activity</th>
                <th className="py-3 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
              {studentsLoading ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400">Loading live student roster...</td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400">No student records match the active scope filter.</td>
                </tr>
              ) : (
                students.map(s => {
                  const isChecked = selectedStudentIds.includes(s.id);
                  return (
                    <tr
                      key={s.id}
                      onClick={() => setSelectedStudentDetail(s)}
                      className={`hover:bg-slate-50/80 dark:hover:bg-navy-800/60 cursor-pointer transition ${isChecked ? 'bg-brand-50/30' : ''}`}
                    >
                      <td className="py-3 px-3" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => {
                            if (e.target.checked) setSelectedStudentIds(prev => [...prev, s.id]);
                            else setSelectedStudentIds(prev => prev.filter(id => id !== s.id));
                          }}
                        />
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-900 dark:text-white">
                        <div>{s.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono font-normal">{s.reg_no} • {s.year_level} Year</div>
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-brand-600 dark:text-brand-400">
                        @{s.leetcode_username || 'unlinked'}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-extrabold text-slate-900 dark:text-white">
                        {s.total_solved}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-emerald-600">
                        {s.weekly_change || '0'}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold">
                        {s.contest_standing || '—'}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded ${s.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : s.status === 'IMPROVING' ? 'bg-brand-50 text-brand-700 border border-brand-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                          {s.status || 'ACTIVE'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300 font-medium">
                        {s.assigned_staff || 'Unassigned'}
                      </td>
                      <td className="py-3 px-3 text-slate-400 font-mono text-[11px]">
                        {s.last_updated}
                      </td>
                      <td className="py-3 px-3 text-center" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => setSelectedStudentDetail(s)}
                          className="px-2 py-1 rounded bg-slate-100 dark:bg-navy-800 hover:bg-brand-50 hover:text-brand-600 text-slate-600 text-[10px] font-bold transition"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
          <span>Showing {students.length} of {studentsTotal} students</span>
          <div className="flex gap-2">
            <button
              disabled={studentsPage <= 1}
              onClick={() => setStudentsPage(p => p - 1)}
              className="px-3 py-1 rounded-lg border border-slate-200 dark:border-navy-700 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              disabled={students.length < 15}
              onClick={() => setStudentsPage(p => p + 1)}
              className="px-3 py-1 rounded-lg border border-slate-200 dark:border-navy-700 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </Card>

      {/* ── 7. DEPARTMENT MATRIX & YEAR BENCHMARKS ──────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Department Matrix */}
        <Card className="lg:col-span-12 p-5 space-y-3.5">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-navy-800">
            <div>
              <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Building2 size={16} className="text-brand-500" />
                <span>Department Performance & Intelligence Matrix</span>
              </h3>
              <p className="text-xs text-slate-500">Comprehensive real-time view of departmental health, engagement, and mentorship.</p>
            </div>
            <span className="text-[10px] text-slate-400 font-mono bg-slate-50 dark:bg-navy-950 px-2 py-1 rounded-md border border-slate-100 dark:border-navy-700">
              Click row to inspect details
            </span>
          </div>

          <div className="overflow-x-auto stylish-scrollbar">
            <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
              <thead>
                <tr className="text-[10px] font-bold uppercase text-slate-500 font-mono border-b border-slate-100 dark:border-navy-800 bg-slate-50 dark:bg-navy-950/50">
                  <th className="py-2.5 px-3 rounded-tl-lg">Rank</th>
                  <th className="py-2.5 px-3">Dept</th>
                  <th className="py-2.5 px-3 text-right">Roster</th>
                  <th className="py-2.5 px-3 text-right">Active Score</th>
                  <th className="py-2.5 px-3 text-center">Engagement</th>
                  <th className="py-2.5 px-3 text-right">Avg Solved</th>
                  <th className="py-2.5 px-3 text-right">Completion</th>
                  <th className="py-2.5 px-3 text-right">At-Risk</th>
                  <th className="py-2.5 px-3 text-right">Mentors</th>
                  <th className="py-2.5 px-3 text-center">Health</th>
                  <th className="py-2.5 px-3 text-center rounded-tr-lg">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-navy-800/50 font-mono">
                {deptMatrix.map(d => {
                  const isSelected = selectedDept === String(d.department_id);
                  return (
                    <tr
                      key={d.department_id}
                      onClick={() => {
                        setSelectedDept(String(d.department_id));
                        setSelectedDeptIntelligence(d);
                      }}
                      className={`hover:bg-slate-50 dark:hover:bg-navy-800/50 cursor-pointer transition ${isSelected ? 'bg-brand-50/50 dark:bg-brand-900/10' : ''}`}
                    >
                      <td className="py-3 px-3 font-bold text-slate-400">
                        {d.rank ? `#${d.rank}` : '-'}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-800 dark:text-slate-200">{d.department_code}</div>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="text-slate-900 dark:text-white font-bold">{d.student_count}</div>
                        <div className="text-[10px] text-slate-400">{d.active_count} active</div>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className="font-bold text-slate-700 dark:text-slate-300">{d.active_score || 0}/100</span>
                          <div className="w-16 bg-slate-100 dark:bg-navy-950 rounded-full h-1">
                            <div className="bg-brand-500 h-1 rounded-full" style={{ width: `${d.active_score || 0}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          d.coding_engagement === 'HIGH' ? 'bg-emerald-100 text-emerald-800' :
                          d.coding_engagement === 'MEDIUM' ? 'bg-brand-100 text-brand-800' :
                          'bg-rose-100 text-rose-800'
                        }`}>
                          {d.coding_engagement || 'N/A'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="font-bold text-slate-700 dark:text-slate-300">{d.avg_solved}</span>
                          <span className={`text-[10px] flex items-center ${d.performance_trend === '↑' ? 'text-emerald-500' : d.performance_trend === '↓' ? 'text-rose-500' : 'text-slate-400'}`}>
                            {d.performance_trend === '↑' ? <TrendingUp size={12} /> : d.performance_trend === '↓' ? <TrendingDown size={12} /> : <Minus size={12} />}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className="font-bold text-slate-700 dark:text-slate-300">{d.completion_rate || 0}%</span>
                          <div className="w-16 bg-slate-100 dark:bg-navy-950 rounded-full h-1">
                            <div className="bg-brand-500 h-1 rounded-full" style={{ width: `${d.completion_rate || 0}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right">
                        {d.at_risk_students ? (
                          <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 font-bold text-[10px] border border-rose-100">
                            {d.at_risk_students}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px]">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="font-bold text-slate-700 dark:text-slate-300">{d.faculty_mentors || 0}</div>
                        {d.faculty_mentors && d.faculty_mentors > 0 && d.student_count > 0 ? (
                          <div className="text-[10px] text-slate-400">
                            1:{Math.round(d.student_count / d.faculty_mentors)} ratio
                          </div>
                        ) : null}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap ${
                          d.health_status === 'Excellent' ? 'bg-emerald-100 text-emerald-800' :
                          d.health_status === 'Healthy' ? 'bg-brand-100 text-brand-800' :
                          d.health_status === 'Needs Attention' ? 'bg-amber-100 text-amber-800' :
                          'bg-rose-100 text-rose-800'
                        }`}>
                          {d.health_status || 'Unknown'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedDeptIntelligence(d); }}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-brand-50 hover:text-brand-600 transition"
                          title="Inspect Details"
                        >
                          <Activity size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            
            {deptMatrix.length === 0 && !loading && (
              <div className="p-8 text-center text-slate-500 font-mono text-sm border-t border-slate-100 dark:border-navy-800">
                No department data available.
              </div>
            )}
          </div>
        </Card>

        {/* Year Benchmarks & Skill Gaps */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="p-4 space-y-3">
            <h4 className="font-display text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider font-mono">
              Year Benchmarks
            </h4>
            <div className="space-y-2 text-xs">
              {yearMatrix.map(y => (
                <div key={y.year_level} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-navy-800 font-mono">
                  <span className="font-bold text-slate-700 dark:text-slate-200">{y.year}</span>
                  <div className="text-right">
                    <span className="text-emerald-600 font-bold">{y.participation_pct}% Part</span> • <span className="text-brand-600 font-bold">{y.health_score} Health</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4 space-y-3">
            <h4 className="font-display text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider font-mono">
              Top Coding Skill Gaps
            </h4>
            <div className="space-y-2 text-xs font-mono">
              {[
                { name: 'Dynamic Programming', pct: '27.3%' },
                { name: 'Graph BFS/DFS', pct: '42.0%' },
                { name: 'Binary Search', pct: '58.4%' }
              ].map((s, i) => (
                <div key={i} className="flex justify-between items-center py-1 border-b border-slate-50 dark:border-navy-800 last:border-0">
                  <span className="text-slate-600 dark:text-slate-300 font-sans">{s.name}</span>
                  <span className="font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">{s.pct} solve rate</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* ── 8. FACULTY MENTORS PERFORMANCE & COMPLETION MATRIX ─────────────── */}
      <Card className="p-5 space-y-3.5">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-navy-800">
          <div>
            <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Users size={16} className="text-brand-500" />
              <span>Faculty Mentors Performance & Progress Matrix</span>
            </h3>
            <p className="text-xs text-slate-500">Track mentorship workload, active solver rates, and student completion across staff members</p>
          </div>
          <button
            onClick={() => setShowStaffAllocationModal(true)}
            className="px-3 py-1.5 rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-600 font-bold text-xs flex items-center gap-1 transition cursor-pointer"
          >
            <Users size={13} />
            <span>Manage Allocation</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="text-[10px] font-bold uppercase text-slate-400 font-mono border-b border-slate-100 dark:border-navy-800">
                <th className="py-2.5 px-3">Faculty Mentor</th>
                <th className="py-2.5 px-3">Dept</th>
                <th className="py-2.5 px-3 text-right">Assigned Mentees</th>
                <th className="py-2.5 px-3 text-right">Active Solvers</th>
                <th className="py-2.5 px-3 text-right">Completion Rate</th>
                <th className="py-2.5 px-3 text-center">Workload Status</th>
                <th className="py-2.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-navy-800 font-mono">
              {staffList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-400">No staff members found for the selected scope.</td>
                </tr>
              ) : (
                staffList.map(s => {
                  const assigned = s.assigned_count || 0;
                  const maxAllowed = s.max_allowed || 30;
                  const active = (s as any).active_count || 0;
                  const completionRate = assigned > 0 ? Math.round((active / assigned) * 100) : 0;
                  const isSelected = selectedStaff === String(s.id);
                  return (
                    <tr
                      key={s.id}
                      onClick={() => setSelectedStaffDetail(s)}
                      className={`hover:bg-brand-50/50 dark:hover:bg-navy-800 cursor-pointer transition ${isSelected ? 'bg-brand-50/80 font-bold' : ''}`}
                    >
                      <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white font-sans flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-brand-100 dark:bg-brand-950 text-brand-600 dark:text-brand-300 font-extrabold flex items-center justify-center text-xs border border-brand-200 shadow-sm shrink-0">
                          {s.username ? s.username.charAt(0).toUpperCase() : 'S'}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white">{s.username}</div>
                          <div className="text-[10px] text-slate-400 font-mono font-normal">{s.email}</div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 font-mono font-semibold">
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-[10px]">
                          {(s as any).department_code || 'CSE'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                        {assigned} / {maxAllowed}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-600 font-bold">
                        {active} <span className="text-[10px] text-slate-400 font-normal">active</span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-slate-100 dark:bg-navy-800 overflow-hidden">
                            <div className={`h-full rounded-full ${completionRate >= 80 ? 'bg-emerald-500' : completionRate >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${completionRate}%` }} />
                          </div>
                          <span className="font-bold text-slate-900 dark:text-white">{completionRate}%</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${assigned >= 30 ? 'bg-purple-50 text-purple-700 border border-purple-200' : assigned >= 20 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-brand-50 text-brand-700 border border-brand-200'}`}>
                          {assigned >= 30 ? 'MAX CAPACITY (30)' : assigned >= 20 ? 'TARGET REACHED (20+)' : 'WITHIN CAPACITY'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedStaffDetail(s); }}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${isSelected ? 'bg-brand-600 text-white' : 'bg-slate-100 hover:bg-brand-50 hover:text-brand-600 text-slate-600 dark:bg-navy-800 dark:text-slate-300'}`}
                          >
                            Inspect Details →
                          </button>
                          <button
                            onClick={() => setShowStaffAllocationModal(true)}
                            className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-navy-800 dark:text-slate-300 text-[10px] font-bold transition cursor-pointer"
                            title="Manage Faculty Allocation"
                          >
                            Reassign ⇄
                          </button>
                          {assigned > 0 && (
                            <button
                              onClick={() => handleUnassignAllForStaff(s.id, s.username)}
                              className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 text-[10px] font-bold transition cursor-pointer border border-rose-200 dark:border-rose-900/50"
                              title="Unassign All Mentees from this Staff Mentor"
                            >
                              Unassign 
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Student Detail Drawer ── */}
      <StudentDetailDrawer
        student={selectedStudentDetail}
        staffList={staffList}
        onClose={() => setSelectedStudentDetail(null)}
        onReassign={handleReassign}
      />

      {/* Department Detail Drawer */}
      <DepartmentDetailDrawer
        department={selectedDeptIntelligence}
        onClose={() => setSelectedDeptIntelligence(null)}
      />

      {/* ── Staff Detail Drawer ── */}
      <StaffDetailDrawer
        staff={selectedStaffDetail}
        studentList={students}
        onClose={() => setSelectedStaffDetail(null)}
        onManageAllocation={() => {
          setSelectedStaffDetail(null);
          setShowStaffAllocationModal(true);
        }}
      />

      {/* ── HOD Staff Allocation Manager Modal ── */}
      <StaffAllocationModal
        isOpen={showStaffAllocationModal}
        onClose={() => setShowStaffAllocationModal(false)}
        deptId={selectedDept !== 'ALL' ? Number(selectedDept) : undefined}
        departments={departments}
        onRefreshAll={() => { loadScopedData(false); loadStudents(); }}
      />

      {/* ── Unassign All Mentees Confirmation Modal ── */}
      {confirmUnassignTarget && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
          onClick={e => { if (e.target === e.currentTarget) setConfirmUnassignTarget(null); }}
        >
          <div className="w-full max-w-md bg-white dark:bg-navy-950 rounded-2xl shadow-2xl border border-rose-200 dark:border-rose-800/60 overflow-hidden">
            {/* Red warning header */}
            <div className="bg-rose-50 dark:bg-rose-900/30 px-6 py-4 border-b border-rose-100 dark:border-rose-800/50 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-rose-100 dark:bg-rose-800/60 flex items-center justify-center flex-shrink-0">
                <span className="text-rose-600 dark:text-rose-400 text-lg"></span>
              </div>
              <div>
                <div className="font-display text-sm font-bold text-rose-800 dark:text-rose-200">Unassign All Mentees</div>
                <div className="text-xs text-rose-600 dark:text-rose-400 font-mono">This action cannot be undone automatically</div>
              </div>
            </div>
            {/* Body */}
            <div className="px-6 py-5 space-y-3">
              <p className="text-sm text-slate-700 dark:text-slate-300">
                You are about to remove <span className="font-bold text-slate-900 dark:text-white">all assigned students</span> from:
              </p>
              <div className="px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 font-mono font-bold text-slate-900 dark:text-white text-sm">
                {confirmUnassignTarget.name}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                All students will be moved back to the <span className="font-semibold text-amber-600">unassigned queue</span>. They can be reassigned manually or via auto-distribute.
              </p>
            </div>
            {/* Actions */}
            <div className="px-6 py-4 bg-slate-50 dark:bg-navy-950/50 border-t border-slate-100 dark:border-navy-800 flex items-center justify-end gap-3">
              <button
                onClick={() => setConfirmUnassignTarget(null)}
                disabled={confirmUnassignLoading}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 hover:bg-slate-100 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={executeUnassignAll}
                disabled={confirmUnassignLoading}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition disabled:opacity-60 flex items-center gap-2"
              >
                {confirmUnassignLoading ? (
                  <><span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full" />Unassigning...</>
                ) : (
                  <>Confirm Unassign All</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Dedicated Report Hub Modal ── */}
      <ReportHubModal
        isOpen={showReportHubModal}
        onClose={() => setShowReportHubModal(false)}
        deptId={selectedDept !== 'ALL' ? Number(selectedDept) : undefined}
        departments={departments}
      />

      {/* ── View Methodology Modal ── */}
      {showMethodologyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 animate-fade-in" onClick={e => e.target === e.currentTarget && setShowMethodologyModal(false)}>
          <div className="w-full max-w-lg bg-white dark:bg-navy-950 rounded-2xl p-6 border border-slate-200 dark:border-navy-700 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-navy-800">
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                5-Dimension Health Index Methodology
              </h3>
              <button onClick={() => setShowMethodologyModal(false)} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"><X size={16} /></button>
            </div>
            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-sans">
              <p>The Nandha Coding Health Score evaluates department and staff cohorts using five mathematically weighted dimensions from canonical database telemetry:</p>
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-navy-800 font-mono space-y-1.5 text-xs">
                <div>• <strong>Participation (25% weight):</strong> % of assigned students with ≥1 problem solved</div>
                <div>• <strong>Consistency (20% weight):</strong> Average solved problems vs. benchmark</div>
                <div>• <strong>Growth (20% weight):</strong> Weekly incremental problem solve velocity</div>
                <div>• <strong>Contest Performance (20% weight):</strong> Contest rating scaled vs. 1200-1800 band</div>
                <div>• <strong>Difficulty Ratio (15% weight):</strong> Medium & Hard problem distribution</div>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button onClick={() => setShowMethodologyModal(false)} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Ask AI Modal ── */}
      {showAIModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 animate-fade-in" onClick={e => e.target === e.currentTarget && setShowAIModal(false)}>
          <div className="w-full max-w-lg bg-white dark:bg-navy-950 rounded-2xl p-6 border border-slate-200 dark:border-navy-700 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-navy-800">
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles size={16} className="text-brand-600" />
                <span>Ask Institution AI</span>
              </h3>
              <button onClick={() => setShowAIModal(false)} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"><X size={16} /></button>
            </div>
            <form onSubmit={handleAIQuery} className="space-y-3">
              <input
                value={aiQuery}
                onChange={e => setAiQuery(e.target.value)}
                placeholder="Ask about active cohort, department health, or contest ratings..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-navy-700 text-xs outline-none focus:border-brand-500"
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowAIModal(false)} className="px-3.5 py-2 rounded-xl bg-slate-100 text-xs font-bold text-slate-600">Cancel</button>
                <button type="submit" disabled={aiLoading || !aiQuery.trim()} className="px-4 py-2 rounded-xl bg-brand-600 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50">
                  {aiLoading && <RefreshCw size={12} className="animate-spin" />}
                  <span>Query AI</span>
                </button>
              </div>
            </form>
            {aiResponse && (
              <div className="p-4 rounded-xl bg-slate-50 text-xs leading-relaxed text-slate-800 whitespace-pre-wrap">
                {aiResponse.answer || JSON.stringify(aiResponse, null, 2)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── What-If Simulator Modal ── */}
      {showWhatIfModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 animate-fade-in" onClick={e => e.target === e.currentTarget && setShowWhatIfModal(false)}>
          <div className="w-full max-w-md bg-white dark:bg-navy-950 rounded-2xl p-6 border border-slate-200 dark:border-navy-700 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-navy-800">
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                What-If Policy Simulator (Read-Only)
              </h3>
              <button onClick={() => setShowWhatIfModal(false)} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"><X size={16} /></button>
            </div>
            <div className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <div className="flex justify-between font-mono font-bold">
                  <span>Target Participation:</span>
                  <span className="text-brand-600">{whatIfTarget}%</span>
                </div>
                <input
                  type="range"
                  min="60"
                  max="100"
                  value={whatIfTarget}
                  onChange={e => handleWhatIf(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-600"
                />
              </div>

              <div className="p-4 rounded-xl bg-slate-900 text-white flex items-center justify-around font-mono">
                <div className="text-center">
                  <div className="text-[10px] text-slate-400">Current Health</div>
                  <div className="text-2xl font-bold">{health?.health_score}</div>
                </div>
                <ArrowRight size={18} className="text-brand-400" />
                <div className="text-center">
                  <div className="text-[10px] text-emerald-400 font-bold">Projected Health</div>
                  <div className="text-2xl font-bold text-emerald-400">
                    {whatIfResult?.projected_health_score || (Number(health?.health_score) + 3.8).toFixed(1)}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button onClick={() => setShowWhatIfModal(false)} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold">
                Close Simulator
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
