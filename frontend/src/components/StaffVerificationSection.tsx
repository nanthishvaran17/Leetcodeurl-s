import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ShieldCheck, Upload, FileText, CheckCircle2, AlertCircle, Clock, XCircle,
  Eye, RefreshCw, Check, X, Building2, UserCheck, ChevronDown, Sparkles,
  ExternalLink, Download, Trash2, Image as ImageIcon, FileCheck
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { GlobalFilter } from './GlobalFilter';

const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
const ALLOWED_EXTS = ['.pdf', '.jpg', '.jpeg', '.png'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

interface DocumentPreviewInfo {
  url: string;
  name: string;
  isPdf: boolean;
  isLocal?: boolean;
}

export const StaffVerificationSection: React.FC = () => {
  const { user } = useAuth();
  const { notify } = useNotification();

  // Verification state for current logged in staff
  const [verificationState, setVerificationState] = useState<any>(null);
  const [loadingState, setLoadingState] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Form Fields
  const [employeeId, setEmployeeId] = useState<string>('');
  const [officialEmail, setOfficialEmail] = useState<string>('');
  const [departmentId, setDepartmentId] = useState<number | string>('');
  const [designation, setDesignation] = useState<string>('Assistant Professor');
  const [reportingToUserId, setReportingToUserId] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [localFilePreviewUrl, setLocalFilePreviewUrl] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [fileError, setFileError] = useState<string | null>(null);

  // Document Preview Modal State
  const [previewDoc, setPreviewDoc] = useState<DocumentPreviewInfo | null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState<boolean>(false);

  // Lists for dropdowns
  const [departments, setDepartments] = useState<any[]>([]);
  const [reporters, setReporters] = useState<any[]>([]);

  // Reviewer state
  const isReviewerRole = ['super admin', 'admin', 'super_admin', 'hod', 'department hod', 'principal', 'management'].includes((user?.role || '').toLowerCase());
  const [adminVerifications, setAdminVerifications] = useState<any[]>([]);
  const [adminLoading, setAdminLoading] = useState<boolean>(false);
  const [adminStatusFilter, setAdminStatusFilter] = useState<string>('ALL');
  
  // Rejection modal
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [rejecting, setRejecting] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoadingState(true);
    try {
      const [deptRes, repRes, myVerifRes] = await Promise.allSettled([
        api.get('/departments'),
        api.get('/staff-verification/reporters'),
        api.get('/staff-verification/me')
      ]);

      if (deptRes.status === 'fulfilled' && Array.isArray(deptRes.value.data)) {
        setDepartments(deptRes.value.data);
        if (deptRes.value.data.length > 0 && !departmentId) {
          setDepartmentId(deptRes.value.data[0].id);
        }
      }

      if (repRes.status === 'fulfilled' && Array.isArray(repRes.value.data)) {
        setReporters(repRes.value.data);
      }

      if (myVerifRes.status === 'fulfilled' && myVerifRes.value.data?.has_submission) {
        const v = myVerifRes.value.data.verification;
        setVerificationState(v);
        setEmployeeId(v.employee_id || '');
        setOfficialEmail(v.official_email || '');
        setDepartmentId(v.department_id || '');
        setDesignation(v.designation || 'Assistant Professor');
        setReportingToUserId(v.reporting_to_user_id ? String(v.reporting_to_user_id) : '');
      } else if (user) {
        setEmployeeId((user as any).institutional_id || '');
        setOfficialEmail(user.email || '');
        setDesignation((user as any).designation || 'Assistant Professor');
        if (user.department_id) setDepartmentId(user.department_id);
      }

      if (isReviewerRole) {
        fetchAdminVerifications();
      }
    } catch (err) {
      console.error("Error initializing Staff Verification component:", err);
    } finally {
      setLoadingState(false);
    }
  };

  const fetchAdminVerifications = async (silent = false) => {
    if (!silent) setAdminLoading(true);
    try {
      const res = await api.get('/staff-verification/all', {
        params: { status_filter: 'ALL' }
      });
      setAdminVerifications(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to load reviewer verification list:", err);
    } finally {
      setAdminLoading(false);
    }
  };

  const filteredAdminVerifications = React.useMemo(() => {
    if (adminStatusFilter === 'ALL') return adminVerifications;
    return adminVerifications.filter(row => (row.verification_status || '').toUpperCase() === adminStatusFilter);
  }, [adminVerifications, adminStatusFilter]);

  const statusCounts = React.useMemo(() => {
    const counts: Record<string, number> = {
      ALL: adminVerifications.length,
      PENDING: 0,
      UNDER_REVIEW: 0,
      VERIFIED: 0,
      REJECTED: 0,
    };
    adminVerifications.forEach((row) => {
      const st = (row.verification_status || '').toUpperCase();
      if (counts[st] !== undefined) {
        counts[st]++;
      }
    });
    return counts;
  }, [adminVerifications]);


  // Handle Local Object URL lifecycle for live file preview
  useEffect(() => {
    if (selectedFile) {
      const url = URL.createObjectURL(selectedFile);
      setLocalFilePreviewUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setLocalFilePreviewUrl(null);
    }
  }, [selectedFile]);

  const validateFile = (file: File): boolean => {
    setFileError(null);
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_EXTS.includes(ext) || !ALLOWED_MIME.includes(file.type)) {
      setFileError('Unsupported file type. Only PDF, JPG, and PNG files under 5 MB are allowed.');
      return false;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setFileError('File size exceeds the 5 MB limit. Please upload a smaller document.');
      return false;
    }
    return true;
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (validateFile(file)) {
        setSelectedFile(file);
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (validateFile(file)) {
        setSelectedFile(file);
      }
    }
  };

  const handleRemoveSelectedFile = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleOpenPreviewLocal = () => {
    if (!selectedFile || !localFilePreviewUrl) return;
    const isPdf = selectedFile.type === 'application/pdf' || selectedFile.name.toLowerCase().endsWith('.pdf');
    setPreviewDoc({
      url: localFilePreviewUrl,
      name: selectedFile.name,
      isPdf,
      isLocal: true,
    });
    setPreviewModalOpen(true);
  };

  const handleOpenPreviewServer = (verificationId: number, originalName?: string) => {
    const isPdf = (originalName || '').toLowerCase().endsWith('.pdf');
    setPreviewDoc({
      url: `/api/staff-verification/${verificationId}/document`,
      name: originalName || 'Staff_ID_Proof.pdf',
      isPdf,
      isLocal: false,
    });
    setPreviewModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFileError(null);

    // Client-side quick check
    if (!employeeId.trim()) {
      notify.error('Validation Error', 'Employee ID is required.');
      return;
    }
    if (!officialEmail.trim() || !officialEmail.includes('@')) {
      notify.error('Validation Error', 'A valid official institutional email is required.');
      return;
    }
    if (!departmentId) {
      notify.error('Validation Error', 'Department is required.');
      return;
    }
    if (!designation.trim()) {
      notify.error('Validation Error', 'Designation is required.');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('employee_id', employeeId.trim());
      formData.append('official_email', officialEmail.trim());
      formData.append('department_id', String(departmentId));
      formData.append('designation', designation.trim());
      if (reportingToUserId) {
        formData.append('reporting_to_user_id', reportingToUserId);
      }
      if (selectedFile) {
        formData.append('document', selectedFile);
      }

      const res = await api.post('/staff-verification', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const updated = res.data?.verification;
      if (updated) {
        setVerificationState(updated);
      }

      notify.success('Verification Submitted', 'Your account will be reviewed by an authorized institutional administrator before staff-level access is activated.');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (isReviewerRole) {
        fetchAdminVerifications();
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || 'Failed to submit staff verification.';
      notify.error('Submission Error', errMsg);
      setFileError(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdminAction = async (id: number, action: 'review' | 'verify') => {
    try {
      await api.post(`/staff-verification/${id}/${action}`);
      notify.success('Status Updated', `Verification status changed to ${action.toUpperCase()}.`);
      fetchAdminVerifications();
      if (verificationState?.id === id) {
        const meRes = await api.get('/staff-verification/me');
        if (meRes.data?.verification) setVerificationState(meRes.data.verification);
      }
    } catch (err: any) {
      notify.error('Action Failed', err.response?.data?.detail || 'Failed to update status.');
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectingId || !rejectionReason.trim()) {
      notify.error('Required Field', 'Please provide a valid rejection reason.');
      return;
    }
    setRejecting(true);
    try {
      await api.post(`/staff-verification/${rejectingId}/reject`, {
        rejection_reason: rejectionReason.trim()
      });
      notify.success('Verification Rejected', 'Staff verification marked as REJECTED.');
      setRejectingId(null);
      setRejectionReason('');
      fetchAdminVerifications();
    } catch (err: any) {
      notify.error('Rejection Failed', err.response?.data?.detail || 'Failed to reject verification.');
    } finally {
      setRejecting(false);
    }
  };

  const openDocument = (verificationId: number) => {
    window.open(`/api/staff-verification/${verificationId}/document`, '_blank');
  };

  if (loadingState) {
    return (
      <div className="p-8 text-center space-y-3">
        <RefreshCw className="w-6 h-6 animate-spin text-indigo-500 mx-auto" />
        <p className="text-xs font-bold text-slate-500">Loading Staff Verification Service...</p>
      </div>
    );
  }

  const currentStatus = verificationState?.verification_status || 'NOT_SUBMITTED';

  const departmentOptions = departments.map((d: any) => ({
    value: String(d.id),
    label: `${d.code} - ${d.name}`,
    hidePill: true
  }));

  const designationOptions = [
    'Assistant Professor',
    'Associate Professor',
    'Professor',
    'Head of Department (HOD)',
    'Faculty Mentor',
    'Class Advisor',
    'Lab Instructor / Programmer',
    'Placement Officer',
    'Institutional Administrator'
  ].map(label => ({ value: label, label, hidePill: true }));

  const reportsToOptions = [
    { value: '', label: 'Select Reporting Manager / HOD...', hidePill: true },
    ...reporters.map((rep: any) => ({
      value: String(rep.id),
      label: `${rep.name} (${rep.designation})`,
      hidePill: true
    }))
  ];

  return (
    <div className="space-y-8 animate-fade-in font-sans">
      
      {/* Container Card */}
      <div className="glass-card p-4 sm:p-6 md:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl space-y-6 bg-white dark:bg-navy-950">
        
        {/* Card Header */}
        <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-100 dark:border-slate-800 pb-5">
          <div className="flex items-center space-x-3">
            <div className="p-3 sm:p-3.5 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 shrink-0">
              <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight truncate">Staff Verification</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Verify your institutional staff identity and reporting role.
              </p>
            </div>
          </div>

          {/* Status Badge */}
          <div className="shrink-0">
            {currentStatus === 'PENDING' && (
              <span className="px-3.5 py-1.5 rounded-full text-xs font-black bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center space-x-1.5 animate-pulse">
                <Clock className="w-3.5 h-3.5" />
                <span>PENDING VERIFICATION</span>
              </span>
            )}
            {currentStatus === 'UNDER_REVIEW' && (
              <span className="px-3.5 py-1.5 rounded-full text-xs font-black bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 flex items-center space-x-1.5">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>UNDER REVIEW</span>
              </span>
            )}
            {currentStatus === 'VERIFIED' && (
              <span className="px-3.5 py-1.5 rounded-full text-xs font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>VERIFIED STAFF IDENTITY</span>
              </span>
            )}
            {currentStatus === 'REJECTED' && (
              <span className="px-3.5 py-1.5 rounded-full text-xs font-black bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex items-center space-x-1.5">
                <XCircle className="w-3.5 h-3.5" />
                <span>VERIFICATION REJECTED</span>
              </span>
            )}
            {currentStatus === 'NOT_SUBMITTED' && (
              <span className="px-3.5 py-1.5 rounded-full text-xs font-black bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-300 dark:border-slate-700">
                UNVERIFIED RECORD
              </span>
            )}
          </div>
        </div>

        {/* Rejection Notice Banner if Rejected */}
        {currentStatus === 'REJECTED' && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs font-medium space-y-1">
            <div className="flex items-center space-x-2 font-bold text-rose-600 dark:text-rose-400">
              <AlertCircle className="w-4 h-4" />
              <span>Verification Returned / Action Required</span>
            </div>
            <p>
              Rejection Reason: <strong className="font-semibold text-slate-900 dark:text-white">{verificationState?.rejection_reason || 'Information could not be verified.'}</strong>
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Please correct the fields below and re-submit your ID proof for administrative review.
            </p>
          </div>
        )}

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            
            {/* Field 1: Employee ID */}
            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Employee ID <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                placeholder="e.g. NEC-CSE-STF-001"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-navy-950 text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            {/* Field 2: Official Institutional Email */}
            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Official Institutional Email <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                required
                value={officialEmail}
                onChange={(e) => setOfficialEmail(e.target.value)}
                placeholder="e.g. staff.name@nandhaengg.org"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-navy-950 text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            {/* Field 3: Department */}
            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Department <span className="text-rose-500">*</span>
              </label>
              <GlobalFilter
                value={String(departmentId)}
                onChange={(val) => setDepartmentId(Number(val))}
                options={departmentOptions}
                placeholder="Select Department..."
              />
            </div>

            {/* Field 4: Designation */}
            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Designation <span className="text-rose-500">*</span>
              </label>
              <GlobalFilter
                value={designation}
                onChange={(val) => setDesignation(val)}
                options={designationOptions}
                placeholder="Select Designation..."
              />
            </div>

            {/* Field 5: Reports To */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Reports To <span className="text-slate-400 font-normal lowercase">(optional)</span>
              </label>
              <GlobalFilter
                value={reportingToUserId}
                onChange={(val) => setReportingToUserId(val)}
                options={reportsToOptions}
                placeholder="Select Reporting Manager / HOD..."
              />
            </div>
          </div>

          {/* Field 6: Employee ID Proof / Document Upload with Eye Preview */}
          <div className="space-y-2.5 pt-2">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Employee ID Proof / Document <span className="text-slate-400 font-normal lowercase">(optional • PDF, JPG, PNG up to 5 MB)</span>
              </label>
              {(selectedFile || verificationState?.has_document) && (
                <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center space-x-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Interactive Eye Preview Available</span>
                </span>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* Scenario 1: User has selected a new file locally */}
            {selectedFile ? (
              <div className="p-4 rounded-2xl border-2 border-indigo-500/40 bg-indigo-500/5 dark:bg-navy-900/70 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
                <div className="flex items-center space-x-3.5 min-w-0 flex-1">
                  {/* Thumbnail / File Icon */}
                  <div className="relative shrink-0">
                    {selectedFile.type.startsWith('image/') && localFilePreviewUrl ? (
                      <div className="relative group cursor-pointer" onClick={handleOpenPreviewLocal}>
                        <img
                          src={localFilePreviewUrl}
                          alt="Local preview"
                          className="w-14 h-14 rounded-xl object-cover border border-indigo-300 dark:border-indigo-700 shadow-sm"
                        />
                        <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Eye className="w-4 h-4 text-white" />
                        </div>
                      </div>
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex flex-col items-center justify-center font-bold text-[10px]">
                        <FileText className="w-6 h-6 mb-0.5" />
                        <span>PDF</span>
                      </div>
                    )}
                  </div>

                  {/* File Metadata */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center space-x-2">
                      <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">
                        {selectedFile.name}
                      </p>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-500/30 shrink-0">
                        Ready to Submit
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • {selectedFile.type || 'Document'}
                    </p>
                  </div>
                </div>

                {/* Actions: View / Change / Remove */}
                <div className="flex items-center space-x-2 w-full sm:w-auto justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/60 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={handleOpenPreviewLocal}
                    className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-500/20 transition-all flex items-center space-x-1.5 cursor-pointer"
                    title="Eye View / Preview File"
                  >
                    <Eye className="w-4 h-4" />
                    <span>View File</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 dark:hover:bg-navy-700 transition-all flex items-center space-x-1.5 cursor-pointer"
                    title="Choose a different file"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Change</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleRemoveSelectedFile}
                    className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-all cursor-pointer"
                    title="Remove selected file"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : verificationState?.has_document ? (
              /* Scenario 2: Existing Document on record from previous submission */
              <div className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 dark:bg-navy-900/70 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
                <div className="flex items-center space-x-3.5 min-w-0 flex-1">
                  <div className="w-14 h-14 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex flex-col items-center justify-center font-bold text-[10px] shrink-0">
                    <FileCheck className="w-6 h-6 mb-0.5" />
                    <span>PROOF</span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center space-x-2">
                      <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">
                        {verificationState.document_original_name || 'Staff_ID_Proof.pdf'}
                      </p>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-500/30 shrink-0">
                        Uploaded on Record
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                      Attached ID document on institutional record. Click Eye view to inspect or upload to replace.
                    </p>
                  </div>
                </div>

                {/* Actions: View / Replace */}
                <div className="flex items-center space-x-2 w-full sm:w-auto justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/60 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => handleOpenPreviewServer(verificationState.id, verificationState.document_original_name)}
                    className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-500/20 transition-all flex items-center space-x-1.5 cursor-pointer"
                    title="Eye View / Inspect Document"
                  >
                    <Eye className="w-4 h-4" />
                    <span>View Document</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 dark:hover:bg-navy-700 transition-all flex items-center space-x-1.5 cursor-pointer"
                    title="Upload replacement document"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Replace</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Scenario 3: Empty Dropzone */
              <div
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`p-6 sm:p-7 rounded-2xl border-2 border-dashed text-center transition-all cursor-pointer ${
                  dragActive
                    ? 'border-indigo-500 bg-indigo-500/10'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-navy-900/40 hover:border-indigo-400 hover:bg-indigo-500/5'
                }`}
              >
                <div className="flex flex-col items-center space-y-2.5">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-xs">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div className="text-xs sm:text-sm">
                    <span className="font-semibold text-slate-600 dark:text-slate-300">
                      Drag & drop your ID proof file here, or <strong className="text-indigo-600 dark:text-indigo-400 underline decoration-indigo-400/50 underline-offset-2">browse file</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-200/70 dark:bg-navy-800 text-slate-600 dark:text-slate-400">PDF</span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-200/70 dark:bg-navy-800 text-slate-600 dark:text-slate-400">JPG</span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-200/70 dark:bg-navy-800 text-slate-600 dark:text-slate-400">PNG</span>
                    <span className="text-[10px] text-slate-400 font-medium pl-1">Max 5 MB</span>
                  </div>
                </div>
              </div>
            )}

            {fileError && (
              <p className="text-xs font-bold text-rose-500 flex items-center space-x-1.5 mt-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{fileError}</span>
              </p>
            )}
          </div>

          {/* Helper Notice Alert Card */}
          <div className="p-4 rounded-2xl bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/30 dark:border-amber-500/20 text-xs text-amber-900 dark:text-amber-200 flex items-start space-x-3 shadow-xs">
            <Clock className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="font-extrabold text-amber-950 dark:text-amber-100 flex items-center space-x-1.5">
                <span>Helper Notice</span>
              </p>
              <p className="leading-relaxed mt-0.5 text-slate-600 dark:text-slate-300 font-medium">
                Your account will be reviewed by an authorized institutional administrator before staff-level access is activated.
              </p>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2 flex items-center justify-end space-x-3">
            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-brand-600 hover:from-indigo-700 hover:to-brand-700 text-white text-xs font-black shadow-lg shadow-indigo-500/25 transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
            >
              {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              <span>{verificationState ? 'Update Verification Details' : 'Submit Staff Verification'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Reviewer / Administrator View (Only visible for Authorized Reviewers) */}
      {isReviewerRole && (
        <div className="glass-card p-4 sm:p-6 md:p-8 rounded-3xl border border-indigo-500/30 dark:border-indigo-500/20 shadow-xl space-y-5 bg-white dark:bg-navy-950">
          {/* Review Board Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 sm:p-3 rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-400 shrink-0">
                <UserCheck className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">Staff Verifications Review Board</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Authorized Admin/HOD portal to review, approve, or reject institutional staff identity submissions.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start md:self-auto">
              <span className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-navy-900 text-slate-600 dark:text-slate-400 text-xs font-bold border border-slate-200/60 dark:border-slate-800">
                Total Records: <strong className="text-indigo-600 dark:text-indigo-400 font-black">{adminVerifications.length}</strong>
              </span>
            </div>
          </div>

          {/* Full-Width Responsive Filter Tabs - 100% Inside Container with Zero Overflow */}
          <div className="w-full">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1.5 p-1.5 bg-slate-100/90 dark:bg-navy-900/90 rounded-2xl border border-slate-200/70 dark:border-slate-800/80">
              {[
                { key: 'ALL', label: 'ALL' },
                { key: 'PENDING', label: 'PENDING' },
                { key: 'UNDER_REVIEW', label: 'UNDER REVIEW' },
                { key: 'VERIFIED', label: 'VERIFIED' },
                { key: 'REJECTED', label: 'REJECTED' },
              ].map((tab) => {
                const count = statusCounts[tab.key] || 0;
                const isActive = adminStatusFilter === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setAdminStatusFilter(tab.key)}
                    className={`w-full py-2 px-2 sm:px-3 rounded-xl transition-all cursor-pointer text-xs font-black flex items-center justify-center space-x-1.5 ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-navy-800'
                    }`}
                  >
                    <span className="truncate">{tab.label}</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                      isActive
                        ? 'bg-white/25 text-white'
                        : 'bg-slate-200 dark:bg-navy-800 text-slate-700 dark:text-slate-300'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="min-h-[220px]">
            {adminLoading ? (
              <div className="p-8 text-center text-xs font-bold text-slate-400">Loading reviewer records...</div>
            ) : filteredAdminVerifications.length > 0 ? (
              <>
                {/* MOBILE VIEW (< 768px): Card View */}
                <div className="block md:hidden space-y-3">
                  {filteredAdminVerifications.map((row: any) => (
                    <div key={row.id} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-navy-900/60 space-y-3 shadow-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white">{row.staff_name}</h4>
                          <p className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">{row.employee_id}</p>
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold shrink-0 ${
                          row.verification_status === 'VERIFIED'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-500/30'
                            : row.verification_status === 'PENDING'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-500/30'
                            : row.verification_status === 'UNDER_REVIEW'
                            ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-500/30'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-500/30'
                        }`}>
                          {row.verification_status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-200/60 dark:border-slate-800">
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold block uppercase">Dept / Role</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">{row.department_code || row.department_name} • {row.designation}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold block uppercase">Email</span>
                          <span className="font-medium text-slate-600 dark:text-slate-400 break-all text-[11px]">{row.official_email}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800">
                        {row.has_document ? (
                          <button
                            type="button"
                            onClick={() => handleOpenPreviewServer(row.id, row.document_original_name)}
                            className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/60 flex items-center space-x-1 text-[11px] cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View Proof</span>
                          </button>
                        ) : (
                          <span className="text-slate-400 text-[10px] italic">No document</span>
                        )}

                        <div className="flex items-center space-x-1.5">
                          {row.verification_status !== 'UNDER_REVIEW' && row.verification_status !== 'VERIFIED' && (
                            <button
                              type="button"
                              onClick={() => handleAdminAction(row.id, 'review')}
                              className="px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300 font-bold text-[11px] cursor-pointer"
                            >
                              Review
                            </button>
                          )}
                          {row.verification_status !== 'VERIFIED' && (
                            <button
                              type="button"
                              onClick={() => handleAdminAction(row.id, 'verify')}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[11px] cursor-pointer"
                            >
                              Verify
                            </button>
                          )}
                          {row.verification_status !== 'REJECTED' && (
                            <button
                              type="button"
                              onClick={() => { setRejectingId(row.id); setRejectionReason(''); }}
                              className="px-2.5 py-1 rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 font-bold text-[11px] cursor-pointer"
                            >
                              Reject
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* DESKTOP VIEW (>= 768px): Table View */}
                <div className="hidden md:block border border-slate-200 dark:border-slate-800 rounded-2xl overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-navy-950 text-white font-black uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="px-4 py-3">Staff Name</th>
                        <th className="px-4 py-3">Employee ID</th>
                        <th className="px-4 py-3">Email</th>
                        <th className="px-4 py-3">Department</th>
                        <th className="px-4 py-3">Designation</th>
                        <th className="px-4 py-3">Reports To</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-center">ID Proof</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredAdminVerifications.map((row: any) => (
                        <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-navy-900/50 transition-colors">
                          <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{row.staff_name}</td>
                          <td className="px-4 py-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">{row.employee_id}</td>
                          <td className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">{row.official_email}</td>
                          <td className="px-4 py-3 font-bold text-slate-700 dark:text-slate-200">{row.department_code || row.department_name}</td>
                          <td className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-400">{row.designation}</td>
                          <td className="px-4 py-3 text-slate-500 font-medium">{row.reporting_to_name || '—'}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                              row.verification_status === 'VERIFIED'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-500/30'
                                : row.verification_status === 'PENDING'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-500/30'
                                : row.verification_status === 'UNDER_REVIEW'
                                ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-500/30'
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-500/30'
                            }`}>
                              {row.verification_status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {row.has_document ? (
                              <button
                                type="button"
                                onClick={() => handleOpenPreviewServer(row.id, row.document_original_name)}
                                className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/60 flex items-center space-x-1 mx-auto text-[10px] cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>View Proof</span>
                              </button>
                            ) : (
                              <span className="text-slate-400 text-[10px] italic">No document</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end space-x-1.5">
                              {row.verification_status !== 'UNDER_REVIEW' && row.verification_status !== 'VERIFIED' && (
                                <button
                                  type="button"
                                  onClick={() => handleAdminAction(row.id, 'review')}
                                  className="px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300 font-bold text-[10px] hover:bg-indigo-200 cursor-pointer"
                                >
                                  Review
                                </button>
                              )}
                              {row.verification_status !== 'VERIFIED' && (
                                <button
                                  type="button"
                                  onClick={() => handleAdminAction(row.id, 'verify')}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[10px] hover:bg-emerald-700 shadow-sm cursor-pointer"
                                >
                                  Verify
                                </button>
                              )}
                              {row.verification_status !== 'REJECTED' && (
                                <button
                                  type="button"
                                  onClick={() => { setRejectingId(row.id); setRejectionReason(''); }}
                                  className="px-2.5 py-1 rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 font-bold text-[10px] hover:bg-rose-200 cursor-pointer"
                                >
                                  Reject
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="p-8 text-center text-xs font-semibold text-slate-400 border border-slate-200 dark:border-slate-800 rounded-2xl">
                No staff verification records found for selected filter.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Document Eye Preview Modal / Lightbox */}
      {previewModalOpen && previewDoc && (
        <div className="modal-overlay-responsive animate-modal-backdrop z-[999999]">
          <div className="modal-container-responsive max-w-4xl w-full bg-white dark:bg-navy-950 p-4 sm:p-6 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3.5 gap-2">
              <div className="flex items-center space-x-3 min-w-0">
                <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
                  {previewDoc.isPdf ? <FileText className="w-5 h-5" /> : <ImageIcon className="w-5 h-5" />}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center space-x-2">
                    <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white truncate">
                      Document Preview
                    </h3>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                      {previewDoc.isPdf ? 'PDF Document' : 'Image File'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">
                    {previewDoc.name}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-1.5 shrink-0">
                <a
                  href={previewDoc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-navy-900 dark:hover:bg-navy-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all flex items-center space-x-1"
                  title="Open in New Tab"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">New Tab</span>
                </a>
                <a
                  href={previewDoc.url}
                  download={previewDoc.name}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-navy-900 dark:hover:bg-navy-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all flex items-center space-x-1"
                  title="Download File"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Download</span>
                </a>
                <button
                  onClick={() => { setPreviewModalOpen(false); setPreviewDoc(null); }}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-900 transition-all cursor-pointer"
                  title="Close Preview"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body Preview Area */}
            <div className="bg-slate-100/70 dark:bg-navy-900/80 rounded-2xl p-2 sm:p-4 min-h-[300px] max-h-[70vh] flex items-center justify-center overflow-auto">
              {previewDoc.isPdf ? (
                <div className="w-full h-[65vh] flex flex-col">
                  <iframe
                    src={previewDoc.url}
                    title="Document Preview PDF"
                    className="w-full flex-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white"
                  />
                  <div className="pt-2 text-center text-xs text-slate-400 font-medium">
                    If PDF does not render inside the browser viewer, click <a href={previewDoc.url} target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 font-bold underline">New Tab</a> or <a href={previewDoc.url} download={previewDoc.name} className="text-indigo-600 dark:text-indigo-400 font-bold underline">Download</a>.
                  </div>
                </div>
              ) : (
                <div className="relative max-h-[65vh] max-w-full flex items-center justify-center">
                  <img
                    src={previewDoc.url}
                    alt={previewDoc.name}
                    className="max-h-[65vh] max-w-full object-contain rounded-xl shadow-lg border border-slate-200/60 dark:border-slate-800"
                  />
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-1 text-xs text-slate-500">
              <span className="font-semibold text-[11px] truncate">
                {previewDoc.isLocal ? 'Unsaved local document preview' : 'Verified server storage document'}
              </span>
              <button
                type="button"
                onClick={() => { setPreviewModalOpen(false); setPreviewDoc(null); }}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-navy-900 hover:bg-slate-200 dark:hover:bg-navy-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Reason Modal */}
      {rejectingId && (
        <div className="modal-overlay-responsive animate-modal-backdrop">
          <div className="modal-container-responsive max-w-md bg-white dark:bg-navy-950 p-6 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-black text-rose-600 dark:text-rose-400 flex items-center space-x-2">
                <AlertCircle className="w-5 h-5" />
                <span>Reject Staff Verification</span>
              </h3>
              <button onClick={() => setRejectingId(null)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
              Please enter a clear rejection reason. This will be shown to the staff member so they can correct their information.
            </p>

            <textarea
              required
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Employee ID does not match institutional registry records."
              className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-navy-900 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500"
            />

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectingId(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-navy-900 text-slate-600 dark:text-slate-300 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectSubmit}
                disabled={rejecting}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-black shadow-md hover:bg-rose-700"
              >
                {rejecting ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
