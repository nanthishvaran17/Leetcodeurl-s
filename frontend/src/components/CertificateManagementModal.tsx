import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Award,
  Download,
  QrCode,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Upload,
  RefreshCw,
  Search,
  ExternalLink,
  Trash2,
  FileText,
  UserCheck,
  Building2,
  Sparkles,
  Layers,
  Check,
  AlertTriangle,
  Printer,
  ChevronRight,
  Shield,
  Clock,
  Filter,
  Eye,
  RotateCcw,
  Zap,
  GraduationCap,
  Sliders,
  CheckCircle,
  FileCheck2,
  Hash,
  Crown,
  Lock
} from 'lucide-react';
import api from '../services/api';
import { syncCertificateToFirestoreWeb } from '../services/firebaseSync';
import { useNotification } from '../context/NotificationContext';

interface CertificateRecord {
  id: number;
  verification_id: string;
  document_type?: string;
  student_name: string;
  register_no: string;
  department: string;
  department_name: string;
  recognition: string;
  issue_date: string;
  status: string;
  verification_url: string;
  has_pdf: boolean;
  created_at: string;
}

interface AuthorizedSignature {
  id: number;
  signature_type: string;
  department: string;
  signatory_title: string;
  signatory_name?: string;
  version: string;
  has_image: boolean;
  image_preview?: string;
  is_active: boolean;
  uploaded_at: string;
}

interface StudentOption {
  id: number;
  name: string;
  reg_no: string;
  username?: string;
  year_level?: string;
  department?: {
    code: string;
    name: string;
  };
  stats?: {
    total_solved?: number;
    contest_rating?: number;
    sync_status?: string;
  };
}

const CREDENTIAL_TYPES = [
  {
    id: 'Certificate of Excellence',
    title: 'Certificate of Excellence',
    badge: 'TOP PERFORMER • WEEKLY LEETCODE PROGRAM',
    desc: 'For exceptional algorithmic problem-solving competence, consistent participation, and achieving Top Performer distinction in the Institutional LeetCode Continuous Performance Tracking System.'
  },
  {
    id: 'Top Performer',
    title: 'Top Performer Distinction',
    badge: 'ELITE CODER • RANK 1ST TIER',
    desc: 'For securing top-tier ranking in the institutional continuous DSA evaluation and demonstrating exemplary competitive programming mastery.'
  },
  {
    id: 'Contest Achievement',
    title: 'Contest Achievement Award',
    badge: 'SUNDAY CONTEST • EXCELLENCE AWARD',
    desc: 'For stellar performance, verified speed, and high-accuracy code submissions during official Sunday Institutional LeetCode contest sessions.'
  },
  {
    id: 'Outstanding Problem Solver',
    title: 'Outstanding Problem Solver',
    badge: 'HIGH SOLVER • ADVANCED ALGORITHMS',
    desc: 'For demonstrating outstanding persistence, rigorous analytical thinking, and solving advanced algorithmic challenges across diverse difficulty tiers.'
  },
  {
    id: 'Department Excellence',
    title: 'Department Excellence Recognition',
    badge: 'DEPARTMENT TOPPER • CSE SPECIALIZATION',
    desc: 'For leading academic department performance in technical coding benchmarks and inspiring peer engagement in algorithmic problem solving.'
  },
  {
    id: 'Special Recognition',
    title: 'Special Institutional Recognition',
    badge: 'INSTITUTIONAL MERIT • DISTINGUISHED CODER',
    desc: 'For remarkable commitment to self-directed coding growth, high streak consistency, and distinguished contributions to college coding excellence.'
  }
];

export const CertificateManagementModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  preselectedStudent?: StudentOption | null;
}> = ({ isOpen, onClose, preselectedStudent }) => {
  const { notify, confirmAction } = useNotification();
  
  // Stepper State: 1 = Recipient, 2 = Design, 3 = Signatures, 4 = Issue, 5 = Verify & Registry
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [activeMainTab, setActiveMainTab] = useState<'studio' | 'signatures' | 'registry'>('studio');

  // Student selection
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentOption | null>(preselectedStudent || null);
  const [searchQuery, setSearchQuery] = useState('');

  // Certificate Generation State
  const [selectedCertType, setSelectedCertType] = useState('Certificate of Excellence');
  const [customDate, setCustomDate] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCert, setGeneratedCert] = useState<any>(null);
  const [showConfirmIssueModal, setShowConfirmIssueModal] = useState(false);

  // Signatures State
  const [signatures, setSignatures] = useState<AuthorizedSignature[]>([]);
  const [uploadType, setUploadType] = useState<'PRINCIPAL' | 'HOD_CSE_CS' | 'HOD_CSE_IOT'>('PRINCIPAL');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [isUploadingSig, setIsUploadingSig] = useState(false);

  // Registry & History State
  const [history, setHistory] = useState<CertificateRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [registrySearch, setRegistrySearch] = useState('');
  const [registryDeptFilter, setRegistryDeptFilter] = useState('all');
  const [registryStatusFilter, setRegistryStatusFilter] = useState('all');

  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          if (showConfirmIssueModal) {
            setShowConfirmIssueModal(false);
          } else {
            onClose();
          }
        }
      };

      window.addEventListener('keydown', handleKeyDown);

      fetchStudents();
      fetchSignatures();
      fetchHistory();
      if (preselectedStudent) {
        setSelectedStudent(preselectedStudent);
      }

      return () => {
        document.body.style.overflow = originalOverflow || 'unset';
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, preselectedStudent, onClose, showConfirmIssueModal]);

  const fetchStudents = async () => {
    try {
      const res = await api.get('/students');
      setStudents(res.data || []);
      if (!selectedStudent && res.data && res.data.length > 0) {
        setSelectedStudent(res.data[0]);
      }
    } catch (err) {
      console.error("Failed to fetch students:", err);
    }
  };

  const fetchSignatures = async () => {
    try {
      const res = await api.get('/signatures');
      setSignatures(res.data || []);
    } catch (err) {
      console.error("Failed to fetch signatures:", err);
    }
  };

  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await api.get('/certificates');
      setHistory(res.data || []);
    } catch (err) {
      console.error("Failed to fetch certificate history:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Filtered Students for Recipient Selector
  const filteredStudents = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return students;
    return students.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.reg_no.toLowerCase().includes(q) ||
      (s.username && s.username.toLowerCase().includes(q))
    );
  }, [students, searchQuery]);

  // Signatures mapped
  const principalSig = useMemo(() => signatures.find(s => s.signature_type === 'PRINCIPAL' && s.is_active), [signatures]);
  const csHodSig = useMemo(() => signatures.find(s => s.signature_type === 'HOD_CSE_CS' && s.is_active), [signatures]);
  const iotHodSig = useMemo(() => signatures.find(s => s.signature_type === 'HOD_CSE_IOT' && s.is_active), [signatures]);
  const currentHodSig = useMemo(() => {
    const code = (selectedStudent?.department?.code || '').toUpperCase();
    return code.includes('IOT') ? iotHodSig : csHodSig;
  }, [selectedStudent, csHodSig, iotHodSig]);

  const resolveDeptFullName = (deptCode?: string) => {
    if (!deptCode) return "Department of Computer Science and Engineering";
    const code = deptCode.toUpperCase();
    if (code.includes('IOT')) return "Department of Computer Science and Engineering (IoT)";
    return "Department of Computer Science and Engineering (Cyber Security)";
  };

  const currentDeptTitle = resolveDeptFullName(selectedStudent?.department?.code);
  const studentName = selectedStudent?.name || "STUDENT NAME";
  const studentReg = selectedStudent?.reg_no || "732224CC001";
  const cleanReg = (selectedStudent?.reg_no || '').replace(/[^A-Za-z0-9]+/g, '').toUpperCase();
  const canonicalCertId = cleanReg ? `CERT-${cleanReg}-EXCELLENCE` : 'NEC-COE-2026-00000';
  const activeVerificationId = generatedCert?.verification_id || canonicalCertId;

  // Selected Type Metadata
  const currentTypeMeta = useMemo(() => {
    return CREDENTIAL_TYPES.find(t => t.id === selectedCertType) || CREDENTIAL_TYPES[0];
  }, [selectedCertType]);

  // Duplicate Check
  const existingCertificate = useMemo(() => {
    if (!selectedStudent) return null;
    return history.find(h => 
      h.register_no?.toUpperCase() === selectedStudent.reg_no?.toUpperCase() && 
      h.status === 'VALID'
    );
  }, [selectedStudent, history]);

  // Pre-flight Eligibility Checklist
  const eligibilityChecks = useMemo(() => {
    const hasStudent = !!selectedStudent;
    const isVerifiedStudent = hasStudent && (selectedStudent.stats?.sync_status === 'success' || selectedStudent.stats?.sync_status === 'OK' || selectedStudent.stats?.sync_status === 'verified' || (selectedStudent.stats?.total_solved ?? 0) > 0);
    const hasPerfData = hasStudent && (selectedStudent.stats?.total_solved !== undefined);
    const hasPrincipal = !!principalSig?.image_preview;
    const hasHod = !!currentHodSig?.image_preview;
    const notDuplicated = !existingCertificate;

    return {
      studentVerified: hasStudent,
      profileVerified: isVerifiedStudent,
      perfAvailable: hasPerfData,
      criteriaSatisfied: hasPerfData && (selectedStudent.stats?.total_solved ?? 0) >= 0,
      notDuplicate: notDuplicated,
      signaturesReady: hasPrincipal && hasHod,
      allPassed: hasStudent && isVerifiedStudent && hasPrincipal && hasHod
    };
  }, [selectedStudent, principalSig, currentHodSig, existingCertificate]);

  // Handle Official Issue
  const handleConfirmAndIssue = async () => {
    if (!selectedStudent) return;
    setIsGenerating(true);
    setShowConfirmIssueModal(false);
    try {
      const res = await api.post('/certificates/generate', {
        student_id: selectedStudent.id,
        cert_type: selectedCertType,
        issue_date: customDate || undefined
      });
      setGeneratedCert(res.data);
      notify.success('Credential Officially Issued', `Certificate ID: ${res.data.verification_id} is now registered in the institutional ledger.`, { category: 'CREDENTIAL SYSTEM' });
      await syncCertificateToFirestoreWeb(res.data);
      await fetchHistory();
      setCurrentStep(5); // Go to step 5 (Verify & Registry)
    } catch (err: any) {
      notify.error('Issuance Failed', err.response?.data?.detail || "Failed to issue credential.", { category: 'CREDENTIAL SYSTEM' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadPdf = async (targetId?: string) => {
    const idToUse = targetId || generatedCert?.verification_id || canonicalCertId;
    if (!idToUse) {
      notify.warning('Select Student', 'Please select a student recipient first.', { category: 'CREDENTIAL SYSTEM' });
      return;
    }

    try {
      const response = await api.get(`/certificates/${encodeURIComponent(idToUse)}/download-pdf`, {
        responseType: 'blob'
      });

      if (response.data && response.data.type === 'application/json') {
        const text = await response.data.text();
        try {
          const errJson = JSON.parse(text);
          notify.error('Certificate Error', errJson.detail || 'Could not generate PDF.', { category: 'CREDENTIAL SYSTEM' });
          return;
        } catch (e) {}
      }

      const blob = new Blob([response.data], { type: 'application/pdf' });
      let filename = `Certificate_${cleanReg || idToUse}.pdf`;
      const disposition = response.headers['content-disposition'] || response.headers['Content-Disposition'];
      if (disposition && disposition.includes('filename=')) {
        const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
        if (matches != null && matches[1]) {
          filename = matches[1].replace(/['"]/g, '').trim();
        }
      }

      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 2000);
      notify.success('PDF Downloaded', `Official Credential ${filename} saved.`, { category: 'CREDENTIAL SYSTEM' });
    } catch (err: any) {
      console.error("Download error:", err);
      notify.error('Download Failed', 'Failed to stream official certificate PDF.', { category: 'CREDENTIAL SYSTEM' });
    }
  };

  const handleDownloadForensicPdf = async (targetId?: string) => {
    const idToUse = targetId || (cleanReg ? `CERT-${cleanReg}-FORENSIC` : null);
    if (!idToUse) {
      notify.warning('Select Student', 'Please select a student recipient first.', { category: 'FORENSIC AUDIT' });
      return;
    }

    try {
      const response = await api.get(`/certificates/${encodeURIComponent(idToUse)}/download-forensic-pdf`, {
        responseType: 'blob'
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      let filename = `Forensic_Audit_Report_${idToUse}.pdf`;
      const disposition = response.headers['content-disposition'] || response.headers['Content-Disposition'];
      if (disposition && disposition.includes('filename=')) {
        const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
        if (matches != null && matches[1]) {
          filename = matches[1].replace(/['"]/g, '').trim();
        }
      }

      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 2000);
      notify.success('Audit Report Saved', `Forensic Audit Report ${filename} saved.`, { category: 'FORENSIC AUDIT' });
    } catch (err: any) {
      console.error("Forensic Download error:", err);
      notify.error('Download Failed', 'Failed to generate Forensic Audit Report.', { category: 'FORENSIC AUDIT' });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        notify.warning('File Too Large', 'Image must be smaller than 5MB.', { category: 'SIGNATURE ENGINE' });
        return;
      }
      setUploadFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        setUploadPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUploadSignature = async () => {
    if (!uploadFile) return;
    setIsUploadingSig(true);
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("signature_type", uploadType);

      await api.post('/signatures/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setUploadFile(null);
      setUploadPreview(null);
      await fetchSignatures();
      notify.success('Signature Updated', `Authorized signature for ${uploadType} uploaded and active.`, { category: 'SIGNATURE ENGINE' });
    } catch (err: any) {
      notify.error('Upload Failed', err.response?.data?.detail || "Failed to upload signature.", { category: 'SIGNATURE ENGINE' });
    } finally {
      setIsUploadingSig(false);
    }
  };

  const handleRevokeCertificate = async (verificationId: string) => {
    const confirmed = await confirmAction({
      title: `Revoke Certificate ${verificationId}?`,
      message: `Are you sure you want to revoke Certificate ${verificationId}? The record will be permanently marked as REVOKED in the public verification ledger.`,
      confirmLabel: 'Revoke Credential',
      category: 'CREDENTIAL AUDIT',
      variant: 'danger',
    });
    if (!confirmed) return;

    try {
      await api.post(`/certificates/${verificationId}/revoke`, {
        reason: "Revoked by Administrator"
      });
      notify.success('Certificate Revoked', `Credential ${verificationId} status is now REVOKED.`, { category: 'CREDENTIAL AUDIT' });
      await fetchHistory();
      if (generatedCert && generatedCert.verification_id === verificationId) {
        setGeneratedCert({ ...generatedCert, status: 'REVOKED' });
      }
    } catch (err: any) {
      notify.error('Revocation Failed', err.response?.data?.detail || "Failed to revoke certificate.", { category: 'CREDENTIAL AUDIT' });
    }
  };

  // Filtered Registry List
  const filteredHistory = useMemo(() => {
    return history.filter(item => {
      const matchQuery = !registrySearch.trim() || 
        item.student_name?.toLowerCase().includes(registrySearch.toLowerCase()) ||
        item.register_no?.toLowerCase().includes(registrySearch.toLowerCase()) ||
        item.verification_id?.toLowerCase().includes(registrySearch.toLowerCase());
      
      const matchDept = registryDeptFilter === 'all' || item.department?.toLowerCase() === registryDeptFilter.toLowerCase();
      const matchStatus = registryStatusFilter === 'all' || item.status?.toUpperCase() === registryStatusFilter.toUpperCase();

      return matchQuery && matchDept && matchStatus;
    });
  }, [history, registrySearch, registryDeptFilter, registryStatusFilter]);

  // Overall Registry Metrics
  const metrics = useMemo(() => {
    const total = history.length;
    const valid = history.filter(h => h.status === 'VALID').length;
    const revoked = history.filter(h => h.status === 'REVOKED').length;
    const pending = students.length - valid;
    return { total, valid, revoked, pending: Math.max(0, pending) };
  }, [history, students]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay-responsive animate-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="modal-container-responsive max-w-[1600px] w-[96vw] h-[92vh] bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >

        {/* ── TOP INSTITUTIONAL HEADER & SYSTEM STATUS ───────────────────────── */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950/80 border-b border-slate-800 flex items-center justify-between flex-wrap gap-4 shrink-0">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 rounded-2xl bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-lg shadow-amber-500/10">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h2 className="text-lg font-black text-white tracking-tight">
                  INSTITUTIONAL CREDENTIAL ISSUANCE HUB
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  <span>● CREDENTIAL SYSTEM OPERATIONAL</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 font-semibold flex items-center space-x-2 mt-0.5">
                <span>Nandha Engineering College (Autonomous)</span>
                <span>•</span>
                <span className="text-amber-400 font-bold">Create • Sign • Issue • Verify • Audit</span>
              </p>
            </div>
          </div>

          {/* Right Navigation & Actions */}
          <div className="flex items-center space-x-3">
            <div className="flex bg-slate-900/90 p-1 rounded-2xl border border-slate-800 text-xs font-bold shadow-inner">
              <button
                type="button"
                onClick={() => setActiveMainTab('studio')}
                className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center space-x-1.5 ${
                  activeMainTab === 'studio'
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Issuance Studio</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveMainTab('signatures')}
                className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center space-x-1.5 ${
                  activeMainTab === 'signatures'
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Signatures ({signatures.filter(s => s.is_active).length}/3)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveMainTab('registry')}
                className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center space-x-1.5 ${
                  activeMainTab === 'registry'
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileCheck2 className="w-3.5 h-3.5" />
                <span>Issued Registry ({metrics.total})</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-2xl bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/30 transition-all font-black text-xs flex items-center space-x-1.5 cursor-pointer shadow-sm"
            >
              <span>✕ Close Studio</span>
            </button>
          </div>
        </div>

        {/* ── METRICS RIBBON (GROUND TRUTH NUMBERS) ─────────────────────────── */}
        <div className="px-6 py-2.5 bg-slate-900/90 border-b border-slate-800/80 flex items-center justify-between text-xs font-bold overflow-x-auto no-scrollbar shrink-0">
          <div className="flex items-center space-x-6 whitespace-nowrap">
            <div className="flex items-center space-x-2">
              <span className="text-slate-400 text-[11px]">TOTAL ISSUED:</span>
              <span className="text-white font-mono font-black">{metrics.total}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-slate-400 text-[11px]">VERIFIED ACTIVE:</span>
              <span className="text-emerald-400 font-mono font-black">{metrics.valid}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-slate-400 text-[11px]">REVOKED:</span>
              <span className="text-rose-400 font-mono font-black">{metrics.revoked}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-slate-400 text-[11px]">AWAITING ISSUANCE:</span>
              <span className="text-amber-400 font-mono font-black">{metrics.pending}</span>
            </div>
          </div>

          <div className="flex items-center space-x-3 text-[11px] text-slate-400">
            <span className="flex items-center space-x-1 text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Secure Institutional Issuance & Audit</span>
            </span>
          </div>
        </div>

        {/* ── BODY WORKSPACE ────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">

          {/* TAB 1: ISSUANCE STUDIO WITH 5-STEP WORKFLOW */}
          {activeMainTab === 'studio' && (
            <div className="flex-1 flex flex-col min-h-0">

              {/* 5-Step Workflow Stepper Bar */}
              <div className="px-6 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between overflow-x-auto no-scrollbar shrink-0">
                <div className="flex items-center space-x-2 sm:space-x-4">
                  {[
                    { step: 1, label: 'RECIPIENT', desc: 'Select Student' },
                    { step: 2, label: 'DESIGN & TYPE', desc: 'Recognition Text' },
                    { step: 3, label: 'SIGNATURES', desc: 'Dual Authority' },
                    { step: 4, label: 'ISSUE', desc: 'Controlled Review' },
                    { step: 5, label: 'VERIFY & AUDIT', desc: 'QR & Document Center' }
                  ].map((s) => {
                    const isCompleted = currentStep > s.step;
                    const isActive = currentStep === s.step;
                    return (
                      <button
                        key={s.step}
                        onClick={() => setCurrentStep(s.step)}
                        className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          isActive
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                            : isCompleted
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                            : 'text-slate-500 hover:text-slate-400 border border-transparent'
                        }`}
                      >
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                          isActive
                            ? 'bg-amber-400 text-slate-950'
                            : isCompleted
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-slate-800 text-slate-400'
                        }`}>
                          {isCompleted ? '✓' : s.step}
                        </span>
                        <div className="text-left">
                          <span className="block text-[11px] font-black tracking-tight">{s.label}</span>
                          <span className="block text-[9px] text-slate-400 -mt-0.5">{s.desc}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="hidden lg:flex items-center space-x-2 text-xs font-bold text-slate-400">
                  <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-emerald-400 font-mono">
                    RATIO: A4 LANDSCAPE (297mm × 210mm)
                  </span>
                </div>
              </div>

              {/* Two-Column Studio Layout */}
              <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 overflow-y-auto min-h-0">

                {/* ── LEFT COLUMN: WORKFLOW CONTROL PANEL (5 COLS) ──────────── */}
                <div className="lg:col-span-5 space-y-4 flex flex-col">

                  {/* STEP 1: RECIPIENT SELECTION */}
                  {currentStep === 1 && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="space-y-4"
                    >
                      <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-3.5 shadow-xl">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center space-x-1.5">
                            <UserCheck className="w-4 h-4" />
                            <span>Select Student Recipient</span>
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold">
                            {students.length} Verified Students
                          </span>
                        </div>

                        {/* Search Input */}
                        <div className="relative">
                          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Search by Name, Register No, or LeetCode username..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-700 rounded-2xl text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500 font-bold shadow-inner"
                          />
                        </div>

                        {/* Intelligent Search Results Scroll Box */}
                        <div className="max-h-56 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-800/40 custom-scrollbar">
                          {filteredStudents.slice(0, 40).map((st) => (
                            <div
                              key={st.id}
                              onClick={() => { setSelectedStudent(st); setGeneratedCert(null); }}
                              className={`p-3 rounded-2xl text-xs cursor-pointer transition-all ${
                                selectedStudent?.id === st.id
                                  ? 'bg-amber-500/20 text-white border border-amber-500/40 font-bold shadow-md'
                                  : 'bg-slate-950/60 hover:bg-slate-800/80 text-slate-300 border border-slate-800/60'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-extrabold text-white text-sm">{st.name}</span>
                                <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                                  {st.reg_no}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-400 mt-1.5 flex items-center justify-between">
                                <span>{resolveDeptFullName(st.department?.code)}</span>
                                <div className="flex items-center space-x-2">
                                  {st.stats?.total_solved !== undefined && (
                                    <span className="text-emerald-400 font-black">
                                      🟢 {st.stats.total_solved} Solved
                                    </span>
                                  )}
                                  {st.stats?.contest_rating && (
                                    <span className="text-amber-400 font-mono">
                                      ★ {st.stats.contest_rating.toFixed(1)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Selected Student Identity Card Preview */}
                      {selectedStudent && (
                        <div className="p-5 rounded-3xl bg-gradient-to-br from-slate-900 to-indigo-950/60 border border-slate-800 space-y-3 shadow-xl">
                          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                            <span className="text-[11px] font-black text-slate-400 uppercase">Selected Identity Card</span>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              ✓ Verified Record
                            </span>
                          </div>

                          <div className="flex items-center space-x-3.5">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-indigo-600 text-slate-950 font-black text-xl flex items-center justify-center shadow-lg">
                              {selectedStudent.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <h4 className="text-base font-black text-white">{selectedStudent.name}</h4>
                              <p className="text-xs font-mono text-amber-400 font-bold">{selectedStudent.reg_no}</p>
                              <p className="text-[11px] text-slate-400">{currentDeptTitle}</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-xs">
                            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                              <span className="text-[10px] text-slate-400 block font-bold">Solved Problems</span>
                              <span className="font-mono font-black text-emerald-400 text-sm">
                                {selectedStudent.stats?.total_solved ?? 0}
                              </span>
                            </div>
                            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                              <span className="text-[10px] text-slate-400 block font-bold">Contest Rating</span>
                              <span className="font-mono font-black text-amber-400 text-sm">
                                {selectedStudent.stats?.contest_rating ? selectedStudent.stats.contest_rating.toFixed(1) : '1500.0'}
                              </span>
                            </div>
                          </div>

                          <button
                            onClick={() => setCurrentStep(2)}
                            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs flex items-center justify-center space-x-2 shadow-lg shadow-amber-500/20 cursor-pointer transition-all"
                          >
                            <span>Next: Configure Credential Type & Design</span>
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* STEP 2: CREDENTIAL TYPE & DESIGN */}
                  {currentStep === 2 && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="space-y-4"
                    >
                      <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl">
                        <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center space-x-1.5">
                          <Sliders className="w-4 h-4" />
                          <span>Select Credential Recognition Type</span>
                        </span>

                        <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                          {CREDENTIAL_TYPES.map((type) => (
                            <div
                              key={type.id}
                              onClick={() => setSelectedCertType(type.id)}
                              className={`p-3 rounded-2xl border text-xs cursor-pointer transition-all ${
                                selectedCertType === type.id
                                  ? 'bg-amber-500/20 border-amber-500/40 text-white shadow-md'
                                  : 'bg-slate-950/60 border-slate-800/80 text-slate-300 hover:bg-slate-800/60'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-extrabold text-sm text-white">{type.title}</span>
                                {selectedCertType === type.id && (
                                  <span className="text-[10px] font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30">
                                    ACTIVE
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{type.desc}</p>
                            </div>
                          ))}
                        </div>

                        {/* Issue Date Override */}
                        <div className="space-y-1.5 pt-2 border-t border-slate-800">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">
                            Issue Date Display (Optional Override)
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Aug 15, 2026 (Defaults to today's date)"
                            value={customDate}
                            onChange={(e) => setCustomDate(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono placeholder-slate-500 focus:ring-2 focus:ring-amber-500"
                          />
                        </div>

                        <div className="flex items-center space-x-2 pt-2">
                          <button
                            onClick={() => setCurrentStep(1)}
                            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
                          >
                            Back
                          </button>
                          <button
                            onClick={() => setCurrentStep(3)}
                            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs flex items-center justify-center space-x-2 shadow-lg shadow-amber-500/20 cursor-pointer transition-all"
                          >
                            <span>Next: Verify Dual Signatures</span>
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* STEP 3: DUAL SIGNATURE VERIFICATION */}
                  {currentStep === 3 && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="space-y-4"
                    >
                      <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl">
                        <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center space-x-1.5">
                          <ShieldCheck className="w-4 h-4" />
                          <span>Institutional Dual Signature Authority</span>
                        </span>

                        {/* Principal Signature Card */}
                        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-white">1. PRINCIPAL SIGNATURE</span>
                            {principalSig?.image_preview ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                ✓ CONFIGURED ({principalSig.version})
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                ⚠ MISSING
                              </span>
                            )}
                          </div>
                          {principalSig?.image_preview ? (
                            <div className="h-16 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-center p-2">
                              <img src={principalSig.image_preview} alt="Principal Signature" className="max-h-12 max-w-[180px] object-contain" />
                            </div>
                          ) : (
                            <p className="text-[11px] text-slate-500 italic">No principal signature image uploaded yet.</p>
                          )}
                        </div>

                        {/* HOD Signature Card */}
                        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-white">2. HOD SIGNATURE ({selectedStudent?.department?.code?.includes('IOT') ? 'IoT' : 'Cyber Security'})</span>
                            {currentHodSig?.image_preview ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                ✓ CONFIGURED ({currentHodSig.version})
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                ⚠ MISSING
                              </span>
                            )}
                          </div>
                          {currentHodSig?.image_preview ? (
                            <div className="h-16 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-center p-2">
                              <img src={currentHodSig.image_preview} alt="HOD Signature" className="max-h-12 max-w-[180px] object-contain" />
                            </div>
                          ) : (
                            <p className="text-[11px] text-slate-500 italic">No HOD signature image uploaded for this department.</p>
                          )}
                        </div>

                        <div className="flex items-center space-x-2 pt-2">
                          <button
                            onClick={() => setCurrentStep(2)}
                            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
                          >
                            Back
                          </button>
                          <button
                            onClick={() => setCurrentStep(4)}
                            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs flex items-center justify-center space-x-2 shadow-lg shadow-amber-500/20 cursor-pointer transition-all"
                          >
                            <span>Next: Pre-flight Eligibility & Issue</span>
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* STEP 4: PRE-FLIGHT ELIGIBILITY & ISSUE */}
                  {currentStep === 4 && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="space-y-4"
                    >
                      <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center space-x-1.5">
                            <Shield className="w-4 h-4" />
                            <span>Pre-flight Eligibility Engine</span>
                          </span>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                            eligibilityChecks.allPassed
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          }`}>
                            {eligibilityChecks.allPassed ? '✓ ELIGIBLE FOR ISSUANCE' : '⚠ REQUIRES ATTENTION'}
                          </span>
                        </div>

                        {/* Duplicate Alert if Found */}
                        {existingCertificate && (
                          <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs space-y-1.5">
                            <div className="flex items-center space-x-2 font-black">
                              <AlertTriangle className="w-4 h-4 text-amber-400" />
                              <span>EXISTING CREDENTIAL DETECTED</span>
                            </div>
                            <p className="text-[11px] text-amber-200/90">
                              A certificate has already been issued to {selectedStudent?.name} ({existingCertificate.verification_id}) on {existingCertificate.issue_date}.
                            </p>
                          </div>
                        )}

                        {/* Checklist */}
                        <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-300">Student Record Exists</span>
                            <span className="text-emerald-400 font-bold">✓ Verified</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-300">LeetCode Performance Data</span>
                            <span className="text-emerald-400 font-bold">✓ Verified ({selectedStudent?.stats?.total_solved ?? 0} Solved)</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-300">Principal Signature Configured</span>
                            <span className={principalSig?.image_preview ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                              {principalSig?.image_preview ? '✓ Configured' : '⚠ Missing'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-300">HOD Signature Configured</span>
                            <span className={currentHodSig?.image_preview ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                              {currentHodSig?.image_preview ? '✓ Configured' : '⚠ Missing'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-300">QR Verification Endpoint</span>
                            <span className="text-emerald-400 font-bold">✓ Active (Public Verification Ledger)</span>
                          </div>
                        </div>

                        {/* Controlled Review & Issue Button */}
                        <button
                          onClick={() => setShowConfirmIssueModal(true)}
                          disabled={isGenerating || !selectedStudent}
                          className="w-full py-3.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs rounded-2xl shadow-xl shadow-emerald-500/25 flex items-center justify-center space-x-2 transition-all transform hover:scale-[1.02] cursor-pointer disabled:opacity-50"
                        >
                          <Award className="w-4 h-4 text-slate-950" />
                          <span>{isGenerating ? 'Registering & Generating Official Credential...' : 'Review & Confirm Issuance'}</span>
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* STEP 5: VERIFY & DOCUMENT CENTER */}
                  {currentStep === 5 && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="space-y-4"
                    >
                      <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                          <span className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center space-x-1.5">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Document Center & Verification</span>
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            ● VALID CREDENTIAL
                          </span>
                        </div>

                        {/* Document Actions */}
                        <div className="space-y-2.5">
                          <button
                            onClick={() => handleDownloadPdf(activeVerificationId)}
                            className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs rounded-2xl flex items-center justify-center space-x-2 shadow-lg shadow-emerald-600/20 cursor-pointer transition-all"
                          >
                            <Download className="w-4 h-4" />
                            <span>Download Official Certificate PDF</span>
                          </button>

                          <button
                            onClick={() => handleDownloadForensicPdf(cleanReg ? `CERT-${cleanReg}-FORENSIC` : activeVerificationId)}
                            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-2xl flex items-center justify-center space-x-2 shadow-lg shadow-indigo-600/20 cursor-pointer transition-all"
                          >
                            <FileText className="w-4 h-4 text-indigo-200" />
                            <span>Download Forensic Audit Report PDF</span>
                          </button>

                          <button
                            onClick={handlePrint}
                            className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-extrabold text-xs rounded-2xl flex items-center justify-center space-x-2 border border-slate-700 cursor-pointer transition-all"
                          >
                            <Printer className="w-4 h-4 text-amber-400" />
                            <span>Print A4 Landscape</span>
                          </button>

                          <a
                            href={generatedCert?.verification_url || `/verify-certificate/${cleanReg || activeVerificationId}`}
                            target="_blank"
                            rel="noreferrer"
                            className="w-full py-3 bg-slate-950 hover:bg-slate-900 text-amber-400 font-extrabold text-xs rounded-2xl flex items-center justify-center space-x-2 border border-amber-500/30 transition-all"
                          >
                            <ExternalLink className="w-4 h-4" />
                            <span>Verify Public QR Code Ledger</span>
                          </a>
                        </div>

                        {/* Security Badge */}
                        <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                          <div className="flex items-center space-x-1.5 text-emerald-400 font-bold">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Institutional Credential Protected</span>
                          </div>
                          <p className="text-[10px] text-slate-500">
                            Digitally sealed with Certificate ID: <span className="font-mono text-slate-300">{activeVerificationId}</span>
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Security Panel */}
                  <div className="p-4 rounded-3xl bg-slate-900/60 border border-slate-800/80 space-y-2 text-xs">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center space-x-1.5">
                      <Lock className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Institutional Security Credentials</span>
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-[10.5px]">
                      <div className="flex items-center space-x-1.5 text-slate-300">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span>Identity Verified</span>
                      </div>
                      <div className="flex items-center space-x-1.5 text-slate-300">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span>Dual Signatures</span>
                      </div>
                      <div className="flex items-center space-x-1.5 text-slate-300">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span>QR Public Ledger</span>
                      </div>
                      <div className="flex items-center space-x-1.5 text-slate-300">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span>Audit Trail Active</span>
                      </div>
                    </div>
                  </div>

                </div>

                {/* ── RIGHT COLUMN: HIGH-FIDELITY A4 LANDSCAPE LIVE PREVIEW (7 COLS) ─ */}
                <div className="lg:col-span-7 space-y-3 flex flex-col justify-center">
                  <div className="flex items-center justify-between text-xs px-1">
                    <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] flex items-center space-x-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>Live Official Certificate Preview Canvas</span>
                    </span>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 font-bold">
                        A4 Landscape (297 × 210 mm)
                      </span>
                    </div>
                  </div>

                  {/* ── THE A4 CERTIFICATE CANVAS (PRINT TARGET) ── */}
                  <div className="print-certificate-target relative w-full aspect-[297/210] bg-[#FCFCFA] text-slate-900 rounded-3xl p-6 sm:p-8 flex flex-col justify-between shadow-2xl border-[6px] border-[#0B192C] overflow-hidden select-none font-serif">

                    {/* Outer & Inner Gold Filigree Borders */}
                    <div className="absolute inset-2 border-[1.5px] border-[#C5A059] pointer-events-none"></div>
                    <div className="absolute inset-3 border-[0.5px] border-[#C5A059]/50 pointer-events-none"></div>

                    {/* Corner Ornaments */}
                    <div className="absolute top-2 left-2 w-3.5 h-3.5 bg-[#C5A059] flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#0B192C]"></div>
                    </div>
                    <div className="absolute top-2 right-2 w-3.5 h-3.5 bg-[#C5A059] flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#0B192C]"></div>
                    </div>
                    <div className="absolute bottom-2 left-2 w-3.5 h-3.5 bg-[#C5A059] flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#0B192C]"></div>
                    </div>
                    <div className="absolute bottom-2 right-2 w-3.5 h-3.5 bg-[#C5A059] flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#0B192C]"></div>
                    </div>

                    {/* Top Header */}
                    <div className="text-center space-y-1 relative z-10">
                      <img
                        src="/nandha_emblem.png"
                        alt="Nandha College Emblem"
                        className="w-12 h-12 object-contain mx-auto drop-shadow-sm mb-1"
                        onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                      />
                      <h2 className="text-base sm:text-lg font-black text-[#0B192C] tracking-wide uppercase font-serif">
                        NANDHA ENGINEERING COLLEGE
                      </h2>
                      <p className="text-[10px] font-bold text-[#0B192C] tracking-widest">(AUTONOMOUS)</p>
                      <p className="text-[8px] sm:text-[9px] text-[#475569] leading-tight">
                        Approved by AICTE, New Delhi • Affiliated to Anna University, Chennai • Accredited by NAAC with 'A+' Grade
                      </p>
                      <div className="text-[#C5A059] text-[10px] font-bold tracking-widest pt-0.5">
                        ────────────── ◆ ──────────────
                      </div>
                    </div>

                    {/* Certificate Title & Student (Animated Replacement) */}
                    <div className="text-center space-y-2 relative z-10 my-auto">
                      <h3 className="text-lg sm:text-xl font-black text-[#B45309] tracking-wider uppercase drop-shadow-xs">
                        {currentTypeMeta.title}
                      </h3>
                      <p className="text-[9px] font-bold text-[#475569] uppercase tracking-widest">
                        THIS CERTIFICATE IS PROUDLY PRESENTED TO
                      </p>
                      <AnimatePresence mode="wait">
                        <motion.h4
                          key={studentName}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          transition={{ duration: 0.25 }}
                          className="text-xl sm:text-2xl font-black text-[#0B192C] tracking-wide underline decoration-[#C5A059] decoration-2 underline-offset-4 uppercase"
                        >
                          {studentName}
                        </motion.h4>
                      </AnimatePresence>
                      <p className="text-[10px] text-[#1E293B] font-sans font-semibold">
                        Register No: <strong>{studentReg}</strong> &nbsp;|&nbsp; <strong>{currentDeptTitle}</strong>
                      </p>
                      <p className="text-[9px] sm:text-[10px] text-[#334155] max-w-xl mx-auto leading-relaxed pt-1">
                        {currentTypeMeta.desc}
                      </p>
                      <div className="inline-block px-3 py-0.5 rounded-full bg-[#065F46]/10 text-[#065F46] border border-[#065F46]/30 text-[8px] font-black uppercase tracking-wider">
                        ★ {currentTypeMeta.badge} ★
                      </div>
                    </div>

                    {/* Bottom Signatures & QR Section */}
                    <div className="grid grid-cols-3 gap-2 items-end text-center relative z-10 pt-2 text-[#0B192C]">

                      {/* Left: Principal */}
                      <div className="space-y-0.5 flex flex-col justify-end">
                        {principalSig?.image_preview ? (
                          <img src={principalSig.image_preview} alt="Principal Signature" className="h-10 max-w-[140px] object-contain mx-auto mb-1" />
                        ) : (
                          <div className="h-10 flex items-center justify-center text-[9px] text-amber-700/60 font-mono italic">
                            [Authorized Signatory]
                          </div>
                        )}
                        <div className="w-32 border-b border-slate-800 mx-auto"></div>
                        <p className="text-[9px] font-black leading-tight mt-1">PRINCIPAL</p>
                        <p className="text-[8px] text-slate-600">Nandha Engineering College</p>
                      </div>

                      {/* Center: Verification */}
                      <div className="space-y-0.5">
                        <div className="w-12 h-12 bg-white border border-slate-300 rounded p-1 mx-auto flex items-center justify-center shadow-xs">
                          <QrCode className="w-10 h-10 text-[#0B192C]" />
                        </div>
                        <p className="text-[8px] font-bold text-slate-700 leading-tight">
                          Verification ID: <strong className="font-mono text-[#0B192C]">{activeVerificationId}</strong>
                        </p>
                        <p className="text-[7px] text-slate-500">Scan QR for official verification</p>
                      </div>

                      {/* Right: HOD */}
                      <div className="space-y-0.5 flex flex-col justify-end">
                        {currentHodSig?.image_preview ? (
                          <img src={currentHodSig.image_preview} alt="HOD Signature" className="h-10 max-w-[140px] object-contain mx-auto mb-1" />
                        ) : (
                          <div className="h-10 flex items-center justify-center text-[9px] text-amber-700/60 font-mono italic">
                            [Authorized Signatory]
                          </div>
                        )}
                        <div className="w-32 border-b border-slate-800 mx-auto"></div>
                        <p className="text-[9px] font-black leading-tight mt-1">HOD / COORDINATOR</p>
                        <p className="text-[7px] text-slate-600 truncate max-w-[160px] mx-auto" title={currentDeptTitle}>{currentDeptTitle}</p>
                      </div>

                    </div>

                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB 2: SIGNATURES MANAGEMENT */}
          {activeMainTab === 'signatures' && (
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h3 className="text-base font-black text-white flex items-center space-x-2">
                    <Upload className="w-4 h-4 text-amber-400" />
                    <span>Authorized Dual Signatures Management</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Upload official transparent PNG signatures. Signatures are automatically embedded above baseline lines in generated PDFs and certificates.
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-black bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  Dual Signatory Architecture
                </span>
              </div>

              {/* CARD 1 & CARD 2 GRID */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* ── CARD 1: PRINCIPAL SIGNATURE ── */}
                <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div>
                      <h4 className="text-sm font-black text-amber-400">CARD 1: PRINCIPAL SIGNATURE</h4>
                      <p className="text-[11px] text-slate-400">Applies across all institutional certificates</p>
                    </div>
                    {principalSig?.image_preview ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        ✓ ACTIVE ({principalSig.version})
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        ⚠ NOT CONFIGURED
                      </span>
                    )}
                  </div>

                  <div className="h-28 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col items-center justify-center p-3 relative overflow-hidden">
                    {principalSig?.image_preview ? (
                      <div className="text-center space-y-1">
                        <img src={principalSig.image_preview} alt="Principal Signature" className="max-h-16 max-w-[200px] object-contain mx-auto" />
                        <span className="text-[9px] font-mono text-slate-500 block">Uploaded: {principalSig.uploaded_at || 'Active'}</span>
                      </div>
                    ) : (
                      <div className="text-center space-y-1">
                        <AlertTriangle className="w-6 h-6 text-slate-600 mx-auto" />
                        <span className="text-xs text-slate-500 font-medium">No signature image uploaded</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 pt-1">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase">
                      {principalSig?.image_preview ? 'Replace Principal Signature' : 'Upload Principal Signature'}
                    </label>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => { setUploadType('PRINCIPAL'); handleFileChange(e); }}
                      className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-300 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-black file:bg-amber-500 file:text-slate-950 cursor-pointer"
                    />

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => { setUploadType('PRINCIPAL'); handleUploadSignature(); }}
                        disabled={isUploadingSig || !uploadFile || uploadType !== 'PRINCIPAL'}
                        className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>{isUploadingSig && uploadType === 'PRINCIPAL' ? 'Saving...' : (principalSig ? 'Replace Signature' : 'Upload & Save')}</span>
                      </button>

                      {principalSig && (
                        <button
                          onClick={async () => {
                            const confirmed = await confirmAction({
                              title: 'Remove Principal Signature?',
                              message: 'Are you sure you want to remove the stored Principal signature image?',
                              confirmLabel: 'Remove Signature',
                              category: 'SIGNATURE ENGINE',
                              variant: 'danger',
                            });
                            if (confirmed) {
                              await api.delete(`/signatures/${principalSig.id}`);
                              notify.success('Signature Removed', 'Principal signature deleted.', { category: 'SIGNATURE ENGINE' });
                              await fetchSignatures();
                            }
                          }}
                          className="p-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 cursor-pointer"
                          title="Remove Signature"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── CARD 2: HOD SIGNATURES ── */}
                <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div>
                      <h4 className="text-sm font-black text-emerald-400">CARD 2: HOD / COORDINATOR SIGNATURE</h4>
                      <p className="text-[11px] text-slate-400">Dynamic Department Signature Mapping</p>
                    </div>
                  </div>

                  <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-800 text-xs font-bold">
                    <button
                      onClick={() => setUploadType('HOD_CSE_CS')}
                      className={`flex-1 py-2 rounded-xl transition-all cursor-pointer text-center ${
                        uploadType === 'HOD_CSE_CS' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Cyber Security {csHodSig ? `(${csHodSig.version})` : '⚠'}
                    </button>
                    <button
                      onClick={() => setUploadType('HOD_CSE_IOT')}
                      className={`flex-1 py-2 rounded-xl transition-all cursor-pointer text-center ${
                        uploadType === 'HOD_CSE_IOT' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      IoT {iotHodSig ? `(${iotHodSig.version})` : '⚠'}
                    </button>
                  </div>

                  {(() => {
                    const activeHod = uploadType === 'HOD_CSE_IOT' ? iotHodSig : csHodSig;
                    const deptLabel = uploadType === 'HOD_CSE_IOT' ? 'IoT' : 'Cyber Security';
                    return (
                      <div className="space-y-3">
                        <div className="h-28 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col items-center justify-center p-3 relative overflow-hidden">
                          {activeHod?.image_preview ? (
                            <div className="text-center space-y-1">
                              <img src={activeHod.image_preview} alt="HOD Signature" className="max-h-16 max-w-[200px] object-contain mx-auto" />
                              <span className="text-[9px] font-mono text-slate-500 block">
                                {deptLabel} • {activeHod.version} • Uploaded: {activeHod.uploaded_at || 'Active'}
                              </span>
                            </div>
                          ) : (
                            <div className="text-center space-y-1">
                              <AlertTriangle className="w-6 h-6 text-slate-600 mx-auto" />
                              <span className="text-xs text-slate-500 font-medium">No signature uploaded for {deptLabel}</span>
                            </div>
                          )}
                        </div>

                        <div className="space-y-3 pt-1">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase">
                            Upload / Replace {deptLabel} Signature
                          </label>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            onChange={handleFileChange}
                            className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-300 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-black file:bg-emerald-500 file:text-slate-950 cursor-pointer"
                          />

                          <div className="flex items-center space-x-2">
                            <button
                              onClick={handleUploadSignature}
                              disabled={isUploadingSig || !uploadFile}
                              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              <span>{isUploadingSig ? 'Saving...' : (activeHod ? `Replace ${deptLabel} Signature` : `Upload & Save ${deptLabel}`)}</span>
                            </button>

                            {activeHod && (
                              <button
                                onClick={async () => {
                                  const confirmed = await confirmAction({
                                    title: `Remove ${deptLabel} Signature?`,
                                    message: `Are you sure you want to remove the stored ${deptLabel} signature image?`,
                                    confirmLabel: 'Remove Signature',
                                    category: 'SIGNATURE ENGINE',
                                    variant: 'danger',
                                  });
                                  if (confirmed) {
                                    await api.delete(`/signatures/${activeHod.id}`);
                                    notify.success('Signature Removed', `${deptLabel} signature deleted.`, { category: 'SIGNATURE ENGINE' });
                                    await fetchSignatures();
                                  }
                                }}
                                className="p-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 cursor-pointer"
                                title="Remove Signature"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

              </div>
            </div>
          )}

          {/* TAB 3: ISSUED REGISTRY & AUDIT */}
          {activeMainTab === 'registry' && (
            <div className="flex-1 p-6 overflow-y-auto space-y-4">
              <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h3 className="text-base font-black text-white flex items-center space-x-2">
                      <FileCheck2 className="w-4 h-4 text-amber-400" />
                      <span>Official Institutional Credential Registry & Verification Audit</span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Authoritative ledger of issued certificates, verification IDs, forensic audit reports, and revocation statuses.
                    </p>
                  </div>
                  <button
                    onClick={fetchHistory}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 text-xs font-bold flex items-center space-x-1.5 cursor-pointer shadow-sm"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingHistory ? 'animate-spin' : ''}`} />
                    <span>Refresh Ledger</span>
                  </button>
                </div>

                {/* Search & Filters */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search by ID, student name, or reg no..."
                      value={registrySearch}
                      onChange={(e) => setRegistrySearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 font-bold"
                    />
                  </div>

                  <select
                    value={registryDeptFilter}
                    onChange={(e) => setRegistryDeptFilter(e.target.value)}
                    className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-bold cursor-pointer"
                  >
                    <option value="all">All Departments</option>
                    <option value="CSE(CS)">Cyber Security</option>
                    <option value="CSE(IOT)">IoT</option>
                  </select>

                  <select
                    value={registryStatusFilter}
                    onChange={(e) => setRegistryStatusFilter(e.target.value)}
                    className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-bold cursor-pointer"
                  >
                    <option value="all">All Statuses ({history.length})</option>
                    <option value="VALID">Valid ({metrics.valid})</option>
                    <option value="REVOKED">Revoked ({metrics.revoked})</option>
                  </select>
                </div>
              </div>

              {/* Registry Table */}
              <div className="overflow-x-auto rounded-3xl border border-slate-800 bg-slate-900 shadow-xl">
                {filteredHistory.length === 0 ? (
                  <div className="p-12 text-center text-xs text-slate-400 font-medium space-y-2">
                    <p className="text-base font-bold text-slate-300">No matching credentials found in the registry.</p>
                    <p>Issue a new certificate from the "Issuance Studio" tab to record it in the ledger.</p>
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-950 text-slate-400 uppercase tracking-wider font-bold text-[10px] border-b border-slate-800">
                        <th className="py-3.5 px-4">Certificate ID</th>
                        <th className="py-3.5 px-4">Student Name</th>
                        <th className="py-3.5 px-4">Register No</th>
                        <th className="py-3.5 px-4">Department</th>
                        <th className="py-3.5 px-4">Issue Date</th>
                        <th className="py-3.5 px-4 text-center">Status</th>
                        <th className="py-3.5 px-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-medium text-slate-300">
                      {filteredHistory.map((rec) => (
                        <tr key={rec.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold text-amber-400">
                            {rec.verification_id}
                          </td>
                          <td className="py-3.5 px-4 font-extrabold text-white">
                            {rec.student_name}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-400 font-bold">
                            {rec.register_no}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="truncate max-w-[180px] block" title={rec.department_name}>
                              {rec.department || 'CSE'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-400">
                            {rec.issue_date}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                              rec.status === 'VALID'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            }`}>
                              {rec.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center space-x-2">
                              <button
                                onClick={() => handleDownloadPdf(rec.verification_id)}
                                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 cursor-pointer shadow-sm"
                                title="Download Official Certificate PDF"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => handleDownloadForensicPdf(`CERT-${rec.register_no}-FORENSIC`)}
                                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-400 border border-slate-700 cursor-pointer shadow-sm"
                                title="Download Forensic Audit Report PDF"
                              >
                                <FileText className="w-3.5 h-3.5" />
                              </button>

                              <a
                                href={rec.verification_url || `/verify-certificate/${rec.verification_id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700 cursor-pointer shadow-sm"
                                title="Verify Public QR Page"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>

                              {rec.status === 'VALID' && (
                                <button
                                  onClick={() => handleRevokeCertificate(rec.verification_id)}
                                  className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 cursor-pointer shadow-sm"
                                  title="Revoke Certificate"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

        </div>

      </motion.div>

      {/* ── REVIEW & CONFIRM ISSUANCE MODAL ─────────────────────────────────── */}
      <AnimatePresence>
        {showConfirmIssueModal && selectedStudent && (
          <div className="fixed inset-0 z-[1000000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-modal-backdrop">
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 15 }}
              className="max-w-md w-full p-6 rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl space-y-4 text-slate-100"
            >
              <div className="flex items-center space-x-3 border-b border-slate-800 pb-3">
                <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Review & Issue Credential</h3>
                  <p className="text-xs text-slate-400">Institutional Authority Confirmation</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">Recipient:</span>
                  <span className="font-extrabold text-white">{selectedStudent.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">Register No:</span>
                  <span className="font-mono font-bold text-amber-400">{selectedStudent.reg_no}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">Department:</span>
                  <span className="font-bold text-slate-200">{currentDeptTitle}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">Recognition:</span>
                  <span className="font-bold text-emerald-400">{currentTypeMeta.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">Certificate ID:</span>
                  <span className="font-mono text-slate-300">{canonicalCertId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">Principal Signature:</span>
                  <span className={principalSig?.image_preview ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                    {principalSig?.image_preview ? '✓ Configured' : '⚠ Missing'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">HOD Signature:</span>
                  <span className={currentHodSig?.image_preview ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                    {currentHodSig?.image_preview ? '✓ Configured' : '⚠ Missing'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">QR Verification:</span>
                  <span className="text-emerald-400 font-bold">✓ Ready & Sealed</span>
                </div>
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <button
                  onClick={() => setShowConfirmIssueModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmAndIssue}
                  disabled={isGenerating}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/25 flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>Confirm & Issue</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
