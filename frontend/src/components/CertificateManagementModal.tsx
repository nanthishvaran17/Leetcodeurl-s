import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  Lock,
  X
} from 'lucide-react';
import { GlobalModalBackdrop } from './GlobalModalBackdrop';
import api from '../services/api';
import { syncCertificateToFirestoreWeb } from '../services/firebaseSync';
import { useNotification } from '../context/NotificationContext';
import { triggerDownload } from '../utils/mobileDownload';

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

      await triggerDownload(blob, filename, 'application/pdf');
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

      await triggerDownload(blob, filename, 'application/pdf');
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

  return createPortal(
    <div
      className="fixed inset-0 z-[9999999] flex items-center justify-center p-2 sm:p-4 bg-slate-950/95 overflow-hidden animate-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="relative w-full max-w-[1550px] max-h-[96vh] h-[94vh] bg-slate-50 dark:bg-navy-950 border border-slate-300 dark:border-navy-700 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-900 dark:text-white antialiased my-auto"
        onClick={(e) => e.stopPropagation()}
      >

        {/* ── TOP INSTITUTIONAL HEADER & SYSTEM STATUS ───────────────────────── */}
        <div className="px-4 sm:px-6 py-3.5 bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 border-b border-brand-500/30 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0 shadow-lg">
          <div className="flex items-center space-x-3 sm:space-x-4">
            <div className="p-2.5 sm:p-3 rounded-2xl bg-brand-500/10 text-brand-400 border border-brand-500/30 shadow-lg shrink-0">
              <Award className="w-6 h-6 sm:w-8 sm:h-8 drop-shadow-md" />
            </div>
            <div className="space-y-1">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-brand-500/20 border border-brand-400/30 text-brand-300 text-xs font-black uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Nandha Engineering College (Autonomous)</span>
              </div>
              
              <div className="flex items-center space-x-2 sm:space-x-3 flex-wrap gap-1">
                <h2 className="text-base sm:text-xl md:text-2xl font-black text-white tracking-tight uppercase">
                  INSTITUTIONAL <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-400 via-teal-300 to-indigo-300">CREDENTIAL ISSUANCE HUB</span>
                </h2>
                <span className="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center space-x-1.5 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                  <span className="hidden sm:inline">● CREDENTIAL SYSTEM OPERATIONAL</span>
                  <span className="sm:hidden">OPERATIONAL</span>
                </span>
              </div>
              
              <p className="text-xs sm:text-sm text-slate-200 font-extrabold tracking-wide uppercase hidden sm:block">
                Create • Sign • Issue • Verify • Audit
              </p>
            </div>
          </div>

          {/* Right Navigation & Actions */}
          <div className="flex items-center justify-between md:justify-end space-x-2 sm:space-x-3 flex-wrap gap-2">
            <div className="flex bg-slate-900/90 p-1 rounded-2xl border border-slate-800 text-xs sm:text-sm font-bold shadow-inner overflow-x-auto max-w-full no-scrollbar">
              <button
                type="button"
                onClick={() => setActiveMainTab('studio')}
                className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center space-x-2 whitespace-nowrap text-xs sm:text-sm ${
                  activeMainTab === 'studio'
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black shadow-md border border-amber-400/40'
                    : 'text-slate-300 hover:text-white font-bold hover:bg-slate-800/60'
                }`}
              >
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Issuance Studio</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveMainTab('signatures')}
                className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center space-x-2 whitespace-nowrap text-xs sm:text-sm ${
                  activeMainTab === 'signatures'
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black shadow-md border border-amber-400/40'
                    : 'text-slate-300 hover:text-white font-bold hover:bg-slate-800/60'
                }`}
              >
                <Upload className="w-4 h-4 text-indigo-400" />
                <span>Signatures ({signatures.filter(s => s.is_active).length}/3)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveMainTab('registry')}
                className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center space-x-2 whitespace-nowrap text-xs sm:text-sm ${
                  activeMainTab === 'registry'
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black shadow-md border border-amber-400/40'
                    : 'text-slate-300 hover:text-white font-bold hover:bg-slate-800/60'
                }`}
              >
                <FileCheck2 className="w-4 h-4 text-emerald-400" />
                <span>Issued Registry ({metrics.total})</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-2xl bg-rose-500/10 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/30 transition-all font-black text-xs sm:text-sm flex items-center space-x-1.5 cursor-pointer shadow-sm shrink-0"
            >
              <X className="w-4.5 h-4.5 sm:hidden" />
              <span className="hidden sm:inline">Close Studio</span>
              <span className="sm:hidden">Close</span>
            </button>
          </div>
        </div>

        {/* ── METRICS RIBBON (GROUND TRUTH NUMBERS) ─────────────────────────── */}
        <div className="px-6 py-2.5 bg-white dark:bg-navy-950 border-b border-slate-200 dark:border-navy-700/80 flex items-center justify-between text-xs sm:text-sm font-black overflow-x-auto no-scrollbar shrink-0">
          <div className="flex items-center space-x-6 whitespace-nowrap">
            <div className="flex items-center space-x-2">
              <span className="text-slate-900 dark:text-slate-200 text-xs font-black">TOTAL ISSUED:</span>
              <span className="text-slate-950 dark:text-white font-mono text-sm sm:text-base font-black">{metrics.total}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-slate-900 dark:text-slate-200 text-xs font-black">VERIFIED ACTIVE:</span>
              <span className="text-emerald-700 dark:text-emerald-400 font-mono text-sm sm:text-base font-black">{metrics.valid}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-slate-900 dark:text-slate-200 text-xs font-black">REVOKED:</span>
              <span className="text-rose-700 dark:text-rose-400 font-mono text-sm sm:text-base font-black">{metrics.revoked}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-slate-900 dark:text-slate-200 text-xs font-black">AWAITING ISSUANCE:</span>
              <span className="text-amber-700 dark:text-amber-400 font-mono text-sm sm:text-base font-black">{metrics.pending}</span>
            </div>
          </div>

          <div className="flex items-center space-x-3 text-xs font-black text-slate-800 dark:text-slate-200">
            <span className="flex items-center space-x-1.5 text-emerald-800 dark:text-emerald-400 font-black">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
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
              <div className="px-6 py-2.5 bg-slate-100 dark:bg-navy-950 border-b border-slate-200 dark:border-navy-700 flex items-center justify-between overflow-x-auto no-scrollbar shrink-0">
                <div className="flex items-center space-x-2 sm:space-x-3">
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
                        className={`flex items-center space-x-2.5 px-4 py-2 rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
                          isActive
                            ? 'bg-amber-500/20 text-amber-900 dark:text-amber-300 border-2 border-amber-500 dark:border-amber-400 shadow-sm'
                            : isCompleted
                            ? 'bg-emerald-500/15 text-emerald-900 dark:text-emerald-300 border border-emerald-400/40 hover:bg-emerald-500/25'
                            : 'text-slate-950 dark:text-white hover:bg-slate-200 dark:hover:bg-navy-800 border border-slate-300/80 dark:border-navy-700/80'
                        }`}
                      >
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs sm:text-sm font-black shrink-0 transition-all ${
                          isActive
                            ? 'bg-amber-400 text-slate-950 shadow-md ring-2 ring-amber-400/30 border border-amber-300'
                            : isCompleted
                            ? 'bg-emerald-600 dark:bg-emerald-500 text-white shadow-md'
                            : 'bg-slate-900 dark:bg-navy-800 text-white dark:text-amber-400 border border-slate-700 dark:border-navy-600 shadow-xs'
                        }`}>
                          {isCompleted ? <Check className="w-4 h-4 text-white stroke-[3.5]" /> : s.step}
                        </span>
                        <div className="text-left">
                          <span className="block text-xs font-black tracking-tight">{s.label}</span>
                          <span className="block text-[10.5px] text-slate-700 dark:text-slate-300 font-bold -mt-0.5">{s.desc}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="hidden lg:flex items-center space-x-2 text-xs font-black text-slate-800 dark:text-slate-200">
                  <span className="px-3 py-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/30 text-emerald-900 dark:text-emerald-300 font-mono font-black shadow-xs">
                    RATIO: A4 LANDSCAPE (297mm × 210mm)
                  </span>
                </div>
              </div>

              {/* Two-Column Studio Layout */}
              <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 p-5 overflow-y-auto min-h-0">

                {/* ── LEFT COLUMN: WORKFLOW CONTROL PANEL (5 COLS) ──────────── */}
                <div className="lg:col-span-5 space-y-4 flex flex-col">

                  {/* STEP 1: RECIPIENT SELECTION */}
                  {currentStep === 1 && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="space-y-4"
                    >
                      <div className="p-5 rounded-3xl bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 space-y-3.5 shadow-xl">
                        <div className="flex items-center justify-between">
                          <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center space-x-1.5">
                            <UserCheck className="w-4.5 h-4.5" />
                            <span>Select Student Recipient</span>
                          </span>
                          <span className="text-xs text-slate-900 dark:text-slate-200 font-black">
                            {students.length} Verified Students
                          </span>
                        </div>

                        {/* Search Input */}
                        <div className="relative">
                          <Search className="w-4.5 h-4.5 absolute left-3.5 top-3.5 text-amber-600 dark:text-amber-400" />
                          <input
                            type="text"
                            placeholder="Search by Name, Register No, or LeetCode username..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-10 py-3 bg-slate-50 dark:bg-navy-950 border border-slate-300 dark:border-navy-600 rounded-2xl text-xs sm:text-sm text-slate-950 dark:text-white placeholder-slate-500 font-bold focus:ring-2 focus:ring-amber-500 focus:border-amber-500 shadow-inner transition-all"
                          />
                          {searchQuery && (
                            <button
                              type="button"
                              onClick={() => setSearchQuery('')}
                              className="absolute right-3.5 top-3.5 p-0.5 rounded-full bg-slate-200 dark:bg-navy-800 text-slate-700 dark:text-slate-300 hover:text-slate-950 cursor-pointer transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        {/* Intelligent Search Results Scroll Box */}
                        <div className="max-h-72 overflow-y-auto space-y-2.5 p-1 custom-scrollbar">
                          {filteredStudents.slice(0, 40).map((st) => {
                            const isSelected = selectedStudent?.id === st.id;
                            return (
                              <div
                                key={st.id}
                                onClick={() => { setSelectedStudent(st); setGeneratedCert(null); }}
                                className={`group p-3.5 rounded-2xl cursor-pointer transition-all duration-200 border relative overflow-hidden ${
                                  isSelected
                                    ? 'bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950 text-white border-2 border-amber-400 shadow-xl ring-2 ring-amber-400/30'
                                    : 'bg-white dark:bg-navy-900/90 hover:bg-slate-50 dark:hover:bg-navy-800/90 text-slate-900 dark:text-slate-100 border-slate-200/90 dark:border-navy-700/80 hover:border-amber-500/50 shadow-sm hover:shadow-md'
                                }`}
                              >
                                {/* Selected Left Accent Bar */}
                                {isSelected && (
                                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-amber-400 rounded-l-2xl"></div>
                                )}

                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex items-center space-x-3 min-w-0">
                                    {/* Student Initials Avatar */}
                                    <div className={`w-9 h-9 rounded-xl font-black text-xs flex items-center justify-center shrink-0 shadow-sm transition-all ${
                                      isSelected
                                        ? 'bg-amber-400 text-slate-950 shadow-amber-500/20'
                                        : 'bg-slate-200 dark:bg-navy-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-navy-600'
                                    }`}>
                                      {st.name.slice(0, 2).toUpperCase()}
                                    </div>

                                    <div className="min-w-0">
                                      <h5 className={`font-black text-sm sm:text-base tracking-tight truncate ${isSelected ? 'text-white' : 'text-slate-950 dark:text-white'}`}>
                                        {st.name}
                                      </h5>
                                      <p className={`text-xs font-bold truncate ${isSelected ? 'text-amber-200' : 'text-slate-600 dark:text-slate-300'}`}>
                                        {resolveDeptFullName(st.department?.code)}
                                      </p>
                                    </div>
                                  </div>

                                  {/* Register Number Badge */}
                                  <span className={`text-xs font-mono font-black px-2.5 py-1 rounded-lg border shrink-0 shadow-xs ${
                                    isSelected
                                      ? 'text-slate-950 bg-amber-400 border-amber-300 font-extrabold'
                                      : 'text-amber-900 dark:text-amber-300 bg-amber-100 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/30'
                                  }`}>
                                    {st.reg_no}
                                  </span>
                                </div>

                                {/* Metrics Strip */}
                                <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-navy-800/80 flex items-center justify-between gap-2 text-xs font-black">
                                  <div className="flex items-center space-x-2">
                                    <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-md border font-bold ${
                                      isSelected
                                        ? 'text-emerald-300 bg-emerald-500/20 border-emerald-400/40'
                                        : 'text-emerald-900 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/30'
                                    }`}>
                                      <span>⚡</span>
                                      <span>{st.stats?.total_solved ?? 0} Solved</span>
                                    </span>
                                    {st.stats?.contest_rating ? (
                                      <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-md border font-mono font-bold ${
                                        isSelected
                                          ? 'text-amber-300 bg-amber-500/20 border-amber-400/40'
                                          : 'text-amber-900 dark:text-amber-300 bg-amber-100 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/30'
                                      }`}>
                                        <span>⭐</span>
                                        <span>{st.stats.contest_rating.toFixed(1)} Rating</span>
                                      </span>
                                    ) : null}
                                  </div>

                                  {isSelected && (
                                    <span className="text-[11px] font-black text-slate-950 uppercase tracking-wider flex items-center space-x-1 bg-amber-400 px-2.5 py-1 rounded-full border border-amber-300 shadow-xs">
                                      <Check className="w-3.5 h-3.5 text-slate-950 stroke-[3]" />
                                      <span>Selected</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Selected Student Identity Card Preview */}
                      {selectedStudent && (
                        <div className="p-5 rounded-3xl bg-slate-950 border-2 border-amber-400 space-y-3.5 shadow-2xl relative overflow-hidden text-white">
                          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none"></div>

                          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 relative z-10">
                            <span className="text-xs sm:text-sm font-black text-amber-400 uppercase tracking-wider flex items-center space-x-1.5">
                              <Sparkles className="w-4 h-4 text-amber-400" />
                              <span>Selected Identity Card</span>
                            </span>
                            <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm flex items-center space-x-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Verified Record</span>
                            </span>
                          </div>

                          <div className="flex items-center space-x-4 relative z-10">
                            <div className="w-13 h-13 rounded-2xl bg-amber-400 text-slate-950 font-black text-2xl flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0 border border-amber-300">
                              {selectedStudent.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className="text-base sm:text-lg font-black text-white truncate tracking-tight">{selectedStudent.name}</h4>
                              <p className="text-xs sm:text-sm font-mono text-amber-400 font-black">{selectedStudent.reg_no}</p>
                              <p className="text-xs text-slate-300 font-bold truncate">{currentDeptTitle}</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-800 relative z-10 text-xs sm:text-sm">
                            <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 shadow-inner">
                              <span className="text-xs text-slate-300 block font-black uppercase tracking-wider">Solved Problems</span>
                              <span className="font-mono font-black text-emerald-400 text-base sm:text-xl flex items-center space-x-1.5 mt-0.5">
                                <span>⚡</span>
                                <span>{selectedStudent.stats?.total_solved ?? 0}</span>
                              </span>
                            </div>
                            <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 shadow-inner">
                              <span className="text-xs text-slate-300 block font-black uppercase tracking-wider">Contest Rating</span>
                              <span className="font-mono font-black text-amber-400 text-base sm:text-xl flex items-center space-x-1.5 mt-0.5">
                                <span>⭐</span>
                                <span>{selectedStudent.stats?.contest_rating ? selectedStudent.stats.contest_rating.toFixed(1) : '1500.0'}</span>
                              </span>
                            </div>
                          </div>

                          <button
                            onClick={() => setCurrentStep(2)}
                            className="w-full py-3.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center space-x-2 shadow-xl shadow-amber-500/25 cursor-pointer transition-all transform hover:scale-[1.01] active:scale-[0.99] relative z-10"
                          >
                            <span>Next: Configure Credential Type & Design</span>
                            <ChevronRight className="w-4 h-4 stroke-[3]" />
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
                      <div className="p-5 rounded-3xl bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 space-y-4 shadow-xl">
                        <span className="text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center space-x-1.5">
                          <Sliders className="w-4 h-4 text-amber-500" />
                          <span>Select Credential Recognition Type</span>
                        </span>

                        <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                          {CREDENTIAL_TYPES.map((type) => (
                            <div
                              key={type.id}
                              onClick={() => setSelectedCertType(type.id)}
                              className={`p-3.5 rounded-2xl border text-xs cursor-pointer transition-all ${
                                selectedCertType === type.id
                                  ? 'bg-amber-500/20 dark:bg-amber-500/20 border-2 border-amber-500 text-slate-950 dark:text-white shadow-md ring-1 ring-amber-500/40'
                                  : 'bg-slate-50 dark:bg-navy-900/90 border-slate-200 dark:border-navy-700 text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-navy-800'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-extrabold text-xs sm:text-sm text-slate-950 dark:text-white">{type.title}</span>
                                {selectedCertType === type.id && (
                                  <span className="text-[10px] font-black text-amber-900 dark:text-amber-300 bg-amber-100 dark:bg-amber-500/20 px-2.5 py-0.5 rounded-full border border-amber-400 dark:border-amber-500/40 shadow-xs">
                                    ACTIVE
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-700 dark:text-slate-300 font-bold mt-1 leading-relaxed">{type.desc}</p>
                            </div>
                          ))}
                        </div>

                        {/* Issue Date Override */}
                        <div className="space-y-1.5 pt-3 border-t border-slate-200 dark:border-navy-700">
                          <label className="text-xs font-black text-slate-900 dark:text-slate-200 uppercase tracking-wide flex items-center space-x-1">
                            <span>Issue Date Display (Optional Override)</span>
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Aug 15, 2026 (Defaults to today's date)"
                            value={customDate}
                            onChange={(e) => setCustomDate(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-navy-900 border border-slate-300 dark:border-navy-600 rounded-xl text-xs text-slate-950 dark:text-white font-mono font-bold placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-amber-500 shadow-inner"
                          />
                        </div>

                        <div className="flex items-center space-x-2 pt-2">
                          <button
                            onClick={() => setCurrentStep(1)}
                            className="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-navy-800 hover:bg-slate-300 dark:hover:bg-navy-700 text-slate-900 dark:text-slate-200 font-black text-xs cursor-pointer transition-colors"
                          >
                            Back
                          </button>
                          <button
                            onClick={() => setCurrentStep(3)}
                            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs flex items-center justify-center space-x-2 shadow-lg shadow-amber-500/20 cursor-pointer transition-all"
                          >
                            <span>Next: Verify Dual Signatures</span>
                            <ChevronRight className="w-4 h-4 stroke-[3]" />
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
                      <div className="p-5 rounded-3xl bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 space-y-4 shadow-xl">
                        <span className="text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center space-x-1.5">
                          <ShieldCheck className="w-4 h-4 text-amber-500" />
                          <span>Institutional Dual Signature Authority</span>
                        </span>

                        {/* Principal Signature Card */}
                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 space-y-2.5 shadow-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-xs sm:text-sm font-black text-slate-950 dark:text-white">1. PRINCIPAL SIGNATURE</span>
                            {principalSig?.image_preview ? (
                              <span className="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 dark:bg-emerald-500/20 text-emerald-900 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40">
                                CONFIGURED ({principalSig.version})
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-xs font-black bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40">
                                MISSING
                              </span>
                            )}
                          </div>
                          {principalSig?.image_preview ? (
                            <div className="h-16 rounded-xl bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 flex items-center justify-center p-2 shadow-inner">
                              <img src={principalSig.image_preview} alt="Principal Signature" className="max-h-12 max-w-[180px] object-contain" />
                            </div>
                          ) : (
                            <p className="text-xs text-amber-800 dark:text-amber-400 font-bold italic">No principal signature image uploaded yet.</p>
                          )}
                        </div>

                        {/* HOD Signature Card */}
                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 space-y-2.5 shadow-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-xs sm:text-sm font-black text-slate-950 dark:text-white">2. HOD SIGNATURE ({selectedStudent?.department?.code?.includes('IOT') ? 'IoT' : 'Cyber Security'})</span>
                            {currentHodSig?.image_preview ? (
                              <span className="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 dark:bg-emerald-500/20 text-emerald-900 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40">
                                CONFIGURED ({currentHodSig.version})
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-xs font-black bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40">
                                MISSING
                              </span>
                            )}
                          </div>
                          {currentHodSig?.image_preview ? (
                            <div className="h-16 rounded-xl bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 flex items-center justify-center p-2 shadow-inner">
                              <img src={currentHodSig.image_preview} alt="HOD Signature" className="max-h-12 max-w-[180px] object-contain" />
                            </div>
                          ) : (
                            <p className="text-xs text-amber-800 dark:text-amber-400 font-bold italic">No HOD signature image uploaded for this department.</p>
                          )}
                        </div>

                        <div className="flex items-center space-x-2 pt-2">
                          <button
                            onClick={() => setCurrentStep(2)}
                            className="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-navy-800 hover:bg-slate-300 dark:hover:bg-navy-700 text-slate-900 dark:text-slate-200 font-black text-xs cursor-pointer transition-colors"
                          >
                            Back
                          </button>
                          <button
                            onClick={() => setCurrentStep(4)}
                            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs flex items-center justify-center space-x-2 shadow-lg shadow-amber-500/20 cursor-pointer transition-all"
                          >
                            <span>Next: Pre-flight Eligibility & Issue</span>
                            <ChevronRight className="w-4 h-4 stroke-[3]" />
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
                      <div className="p-5 rounded-3xl bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 space-y-4 shadow-xl">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center space-x-1.5">
                            <Shield className="w-4 h-4 text-amber-500" />
                            <span>Pre-flight Eligibility Engine</span>
                          </span>
                          <span className={`px-3 py-1 rounded-full text-xs font-black ${
                            eligibilityChecks.allPassed
                              ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-900 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40'
                              : 'bg-rose-100 dark:bg-rose-500/20 text-rose-900 dark:text-rose-300 border border-rose-300 dark:border-rose-500/40'
                          }`}>
                            {eligibilityChecks.allPassed ? 'ELIGIBLE FOR ISSUANCE' : 'REQUIRES ATTENTION'}
                          </span>
                        </div>

                        {/* Duplicate Alert if Found */}
                        {existingCertificate && (
                          <div className="p-4 rounded-2xl bg-amber-100 dark:bg-amber-500/15 border border-amber-300 dark:border-amber-500/30 text-amber-950 dark:text-amber-300 text-xs space-y-1.5 shadow-sm">
                            <div className="flex items-center space-x-2 font-black text-amber-900 dark:text-amber-400 text-xs sm:text-sm">
                              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                              <span>EXISTING CREDENTIAL DETECTED</span>
                            </div>
                            <p className="text-xs text-slate-800 dark:text-amber-200/90 font-bold leading-relaxed">
                              A certificate has already been issued to {selectedStudent?.name} ({existingCertificate.verification_id}) on {existingCertificate.issue_date}.
                            </p>
                          </div>
                        )}

                        {/* Checklist */}
                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 space-y-2.5 text-xs sm:text-sm font-black shadow-inner">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-900 dark:text-slate-200">Student Record Exists</span>
                            <span className="text-emerald-700 dark:text-emerald-400 font-black">Verified</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-900 dark:text-slate-200">LeetCode Performance Data</span>
                            <span className="text-emerald-700 dark:text-emerald-400 font-black">Verified ({selectedStudent?.stats?.total_solved ?? 0} Solved)</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-900 dark:text-slate-200">Principal Signature Configured</span>
                            <span className={principalSig?.image_preview ? 'text-emerald-700 dark:text-emerald-400 font-black' : 'text-amber-700 dark:text-amber-400 font-black'}>
                              {principalSig?.image_preview ? 'Configured' : 'Missing'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-900 dark:text-slate-200">HOD Signature Configured</span>
                            <span className={currentHodSig?.image_preview ? 'text-emerald-700 dark:text-emerald-400 font-black' : 'text-amber-700 dark:text-amber-400 font-black'}>
                              {currentHodSig?.image_preview ? 'Configured' : 'Missing'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-900 dark:text-slate-200">QR Verification Endpoint</span>
                            <span className="text-emerald-700 dark:text-emerald-400 font-black">Active (Public Verification Ledger)</span>
                          </div>
                        </div>

                        {/* Controlled Review & Issue Button */}
                        <button
                          onClick={() => setShowConfirmIssueModal(true)}
                          disabled={isGenerating || !selectedStudent}
                          className="w-full py-3.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs sm:text-sm rounded-2xl shadow-xl shadow-emerald-500/25 flex items-center justify-center space-x-2 transition-all transform hover:scale-[1.02] cursor-pointer disabled:opacity-50"
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
                      <div className="p-5 rounded-3xl bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 space-y-4 shadow-xl">
                        <div className="flex items-center justify-between border-b border-slate-200 dark:border-navy-700 pb-2.5">
                          <span className="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center space-x-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            <span>Document Center & Verification</span>
                          </span>
                          <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-100 dark:bg-emerald-500/20 text-emerald-900 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40">
                            ● VALID CREDENTIAL
                          </span>
                        </div>

                        {/* Document Actions */}
                        <div className="space-y-2.5">
                          <button
                            onClick={() => handleDownloadPdf(activeVerificationId)}
                            className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs sm:text-sm rounded-2xl flex items-center justify-center space-x-2 shadow-lg shadow-emerald-600/20 cursor-pointer transition-all"
                          >
                            <Download className="w-4 h-4" />
                            <span>Download Official Certificate PDF</span>
                          </button>

                          <button
                            onClick={() => handleDownloadForensicPdf(cleanReg ? `CERT-${cleanReg}-FORENSIC` : activeVerificationId)}
                            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs sm:text-sm rounded-2xl flex items-center justify-center space-x-2 shadow-lg shadow-indigo-600/20 cursor-pointer transition-all"
                          >
                            <FileText className="w-4 h-4 text-indigo-200" />
                            <span>Download Forensic Audit Report PDF</span>
                          </button>

                          <button
                            onClick={handlePrint}
                            className="w-full py-3.5 bg-slate-100 dark:bg-navy-800 hover:bg-slate-200 dark:hover:bg-navy-700 text-slate-900 dark:text-white font-black text-xs sm:text-sm rounded-2xl flex items-center justify-center space-x-2 border border-slate-300 dark:border-navy-600 cursor-pointer transition-all"
                          >
                            <Printer className="w-4 h-4 text-amber-500" />
                            <span>Print A4 Landscape</span>
                          </button>

                          <a
                            href={generatedCert?.verification_url || `/verify-certificate/${cleanReg || activeVerificationId}`}
                            target="_blank"
                            rel="noreferrer"
                            className="w-full py-3.5 bg-amber-50 dark:bg-navy-900 hover:bg-amber-100 dark:hover:bg-navy-800 text-amber-900 dark:text-amber-300 font-black text-xs sm:text-sm rounded-2xl flex items-center justify-center space-x-2 border border-amber-300 dark:border-amber-500/40 shadow-xs transition-all"
                          >
                            <ExternalLink className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                            <span>Verify Public QR Code Ledger</span>
                          </a>
                        </div>

                        {/* Security Badge */}
                        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 text-xs space-y-1.5 shadow-sm">
                          <div className="flex items-center space-x-1.5 text-emerald-800 dark:text-emerald-400 font-black">
                            <ShieldCheck className="w-4 h-4" />
                            <span>Institutional Credential Protected</span>
                          </div>
                          <p className="text-xs text-slate-700 dark:text-slate-300 font-bold">
                            Digitally sealed with Certificate ID: <span className="font-mono text-slate-950 dark:text-amber-300 font-black">{activeVerificationId}</span>
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Security Panel */}
                  <div className="p-4 rounded-3xl bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 space-y-2.5 shadow-lg">
                    <span className="text-xs sm:text-sm font-black uppercase text-slate-900 dark:text-slate-200 tracking-wider flex items-center space-x-1.5">
                      <Lock className="w-4 h-4 text-indigo-500" />
                      <span>Institutional Security Credentials</span>
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm font-black">
                      <div className="flex items-center space-x-1.5 text-slate-900 dark:text-slate-200">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span>Identity Verified</span>
                      </div>
                      <div className="flex items-center space-x-1.5 text-slate-900 dark:text-slate-200">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span>Dual Signatures</span>
                      </div>
                      <div className="flex items-center space-x-1.5 text-slate-900 dark:text-slate-200">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span>QR Public Ledger</span>
                      </div>
                      <div className="flex items-center space-x-1.5 text-slate-900 dark:text-slate-200">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span>Audit Trail Active</span>
                      </div>
                    </div>
                  </div>

                </div>

                {/* ── RIGHT COLUMN: HIGH-FIDELITY A4 LANDSCAPE LIVE PREVIEW (7 COLS) ─ */}
                <div className="lg:col-span-7 space-y-3 flex flex-col justify-start">
                  <div className="flex items-center justify-between text-xs px-1">
                    <span className="font-extrabold text-slate-900 dark:text-slate-200 uppercase tracking-wider text-xs flex items-center space-x-1.5">
                      <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      <span>Live Official Certificate Preview Canvas</span>
                    </span>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs text-emerald-900 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-300 dark:border-emerald-500/30 font-black shadow-xs">
                        A4 Landscape (297 × 210 mm)
                      </span>
                    </div>
                  </div>

                  {/* ── THE A4 CERTIFICATE CANVAS (PRINT TARGET) ── */}
                  <div className="print-certificate-target relative w-full aspect-[297/210] bg-[#FCFCFA] text-slate-950 rounded-3xl p-4 sm:p-6 flex flex-col justify-between shadow-xl border-[5px] border-[#0B192C] overflow-hidden select-none font-sans">

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
                    <div className="text-center space-y-0.5 relative z-10">
                      <img
                        src="/nandha_emblem.png"
                        alt="Nandha College Emblem"
                        className="w-10 h-10 object-contain mx-auto drop-shadow-sm mb-0.5"
                        onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                      />
                      <h2 className="text-lg sm:text-xl font-black text-slate-950 tracking-wide uppercase font-sans">
                        NANDHA ENGINEERING COLLEGE
                      </h2>
                      <p className="text-xs font-black text-slate-900 tracking-widest">(AUTONOMOUS)</p>
                      <p className="text-[10.5px] sm:text-[11.5px] text-slate-800 font-extrabold leading-tight">
                        Approved by AICTE, New Delhi • Affiliated to Anna University, Chennai • Accredited by NAAC with 'A+' Grade
                      </p>
                      <div className="text-[#C5A059] text-xs font-black tracking-widest pt-0.5">
                        ────────────── ◆ ──────────────
                      </div>
                    </div>

                    {/* Certificate Title & Student (Animated Replacement) */}
                    <div className="text-center space-y-1.5 relative z-10 my-auto py-0.5">
                      <h3 className="text-xl sm:text-2xl font-black text-amber-700 tracking-wider uppercase drop-shadow-xs">
                        {currentTypeMeta.title}
                      </h3>
                      <p className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-widest">
                        THIS CERTIFICATE IS PROUDLY PRESENTED TO
                      </p>
                      <AnimatePresence mode="wait">
                        <motion.h4
                          key={studentName}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          transition={{ duration: 0.25 }}
                          className="text-2xl sm:text-3xl font-black text-slate-950 tracking-wide underline decoration-[#C5A059] decoration-2 underline-offset-4 uppercase"
                        >
                          {studentName}
                        </motion.h4>
                      </AnimatePresence>
                      <p className="text-xs sm:text-sm text-slate-900 font-black">
                        Register No: <strong className="font-mono text-slate-950">{studentReg}</strong> &nbsp;|&nbsp; <strong className="text-slate-950">{currentDeptTitle}</strong>
                      </p>
                      <p className="text-xs sm:text-sm text-slate-900 font-bold max-w-xl mx-auto leading-normal pt-0.5">
                        {currentTypeMeta.desc}
                      </p>
                      <div className="inline-block px-3.5 py-1 rounded-full bg-emerald-900/10 text-emerald-900 border border-emerald-800/30 text-xs font-black uppercase tracking-wider">
                        {currentTypeMeta.badge}
                      </div>
                    </div>

                    {/* Bottom Signatures & QR Section */}
                    <div className="grid grid-cols-3 gap-2 items-end text-center relative z-10 pt-1 text-slate-950">

                      {/* Left: Principal */}
                      <div className="space-y-0.5 flex flex-col justify-end">
                        {principalSig?.image_preview ? (
                          <img src={principalSig.image_preview} alt="Principal Signature" className="h-9 max-w-[130px] object-contain mx-auto mb-0.5" />
                        ) : (
                          <div className="h-9 flex items-center justify-center text-[10px] text-amber-800 font-mono italic">
                            [Authorized Signatory]
                          </div>
                        )}
                        <div className="w-32 border-b-2 border-slate-900 mx-auto"></div>
                        <p className="text-xs sm:text-sm font-black leading-tight mt-1 text-slate-950">PRINCIPAL</p>
                        <p className="text-[10px] sm:text-xs text-slate-800 font-bold">Nandha Engineering College</p>
                      </div>

                      {/* Center: Verification */}
                      <div className="space-y-0.5">
                        <div className="w-11 h-11 bg-white border border-slate-400 rounded-lg p-1 mx-auto flex items-center justify-center shadow-xs">
                          <QrCode className="w-9 h-9 text-slate-950" />
                        </div>
                        <p className="text-[10px] sm:text-xs font-black text-slate-900 leading-tight">
                          Verification ID: <strong className="font-mono text-slate-950">{activeVerificationId}</strong>
                        </p>
                        <p className="text-[9px] text-slate-700 font-bold">Scan QR for official verification</p>
                      </div>

                      {/* Right: HOD */}
                      <div className="space-y-0.5 flex flex-col justify-end">
                        {currentHodSig?.image_preview ? (
                          <img src={currentHodSig.image_preview} alt="HOD Signature" className="h-9 max-w-[130px] object-contain mx-auto mb-0.5" />
                        ) : (
                          <div className="h-9 flex items-center justify-center text-[10px] text-amber-800 font-mono italic">
                            [Authorized Signatory]
                          </div>
                        )}
                        <div className="w-32 border-b-2 border-slate-900 mx-auto"></div>
                        <p className="text-xs sm:text-sm font-black leading-tight mt-1 text-slate-950">HOD / COORDINATOR</p>
                        <p className="text-[10px] sm:text-xs text-slate-800 truncate max-w-[160px] mx-auto font-bold" title={currentDeptTitle}>{currentDeptTitle}</p>
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
              <div className="p-5 rounded-3xl bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 flex items-center justify-between flex-wrap gap-4 shadow-xl">
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center space-x-2">
                    <Upload className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    <span>Authorized Dual Signatures Management</span>
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-bold mt-0.5">
                    Upload official transparent PNG signatures. Signatures are automatically embedded above baseline lines in generated PDFs and certificates.
                  </p>
                </div>
                <span className="px-3.5 py-1.5 rounded-full text-xs font-black bg-indigo-100 dark:bg-indigo-500/20 text-indigo-900 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-500/30 shadow-xs">
                  Dual Signatory Architecture
                </span>
              </div>

              {/* CARD 1 & CARD 2 GRID */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">

                {/* ── CARD 1: PRINCIPAL SIGNATURE ── */}
                <div className="p-6 rounded-3xl bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 flex flex-col justify-between h-full space-y-4 shadow-xl">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-navy-700 pb-3">
                      <div>
                        <h4 className="text-sm font-black text-amber-800 dark:text-amber-400">CARD 1: PRINCIPAL SIGNATURE</h4>
                        <p className="text-xs text-slate-700 dark:text-slate-300 font-bold">Applies across all institutional certificates</p>
                      </div>
                      {principalSig?.image_preview ? (
                        <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-100 dark:bg-emerald-500/20 text-emerald-900 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30">
                          ACTIVE ({principalSig.version})
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30">
                          NOT CONFIGURED
                        </span>
                      )}
                    </div>

                    {/* Matching Sub-header Scope Bar */}
                    <div className="flex bg-slate-100 dark:bg-navy-950 p-1 rounded-2xl border border-slate-300 dark:border-navy-700 text-xs font-bold items-center justify-between px-4 py-2.5">
                      <span className="font-extrabold text-xs text-amber-800 dark:text-amber-300 flex items-center space-x-2">
                        <Building2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        <span>Institutional Global Scope</span>
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-200/60 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300 border border-amber-400/40">
                        All Departments
                      </span>
                    </div>

                    <div className="min-h-28 rounded-2xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 flex flex-col items-center justify-center p-3.5 relative overflow-hidden">
                      {principalSig?.image_preview ? (
                        <div className="text-center space-y-2">
                          <img src={principalSig.image_preview} alt="Principal Signature" className="max-h-16 max-w-[200px] object-contain mx-auto drop-shadow-sm" />
                          <span className="text-[11px] font-mono text-slate-800 dark:text-slate-200 font-bold inline-flex items-center space-x-1 bg-white dark:bg-navy-900 px-3 py-1 rounded-lg border border-slate-200 dark:border-navy-700 shadow-xs">
                            <Clock className="w-3.5 h-3.5 text-amber-500" />
                            <span>Uploaded: {principalSig.uploaded_at || 'Active'}</span>
                          </span>
                        </div>
                      ) : (
                        <div className="text-center space-y-1 py-2">
                          <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400 mx-auto" />
                          <span className="text-xs text-slate-700 dark:text-slate-300 font-extrabold">No Principal signature image uploaded</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3 pt-1">
                    <label className="block text-xs font-black text-slate-900 dark:text-slate-200 uppercase">
                      {principalSig?.image_preview ? 'Replace Principal Signature' : 'Upload Principal Signature'}
                    </label>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => { setUploadType('PRINCIPAL'); handleFileChange(e); }}
                      className="w-full p-2.5 bg-slate-50 dark:bg-navy-950 border border-slate-300 dark:border-navy-600 rounded-xl text-xs text-slate-950 dark:text-white font-bold file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-black file:bg-amber-400 file:text-slate-950 cursor-pointer"
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        onClick={() => { setUploadType('PRINCIPAL'); handleUploadSignature(); }}
                        disabled={isUploadingSig || !uploadFile || uploadType !== 'PRINCIPAL'}
                        className="py-3 bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-200 dark:disabled:bg-navy-800 disabled:text-slate-500 dark:disabled:text-slate-500 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center space-x-1.5 cursor-pointer disabled:cursor-not-allowed"
                      >
                        <Upload className="w-4 h-4" />
                        <span>{isUploadingSig && uploadType === 'PRINCIPAL' ? 'Saving...' : (principalSig ? 'Replace Signature' : 'Upload & Save')}</span>
                      </button>

                      {principalSig && (
                        <button
                          type="button"
                          onClick={async () => {
                            const confirmed = await confirmAction({
                              title: 'Delete Principal Signature?',
                              message: 'Are you sure you want to delete the active Principal signature image? Certificates will revert to un-signed placeholder.',
                              confirmLabel: 'Delete Signature',
                              category: 'SIGNATURE ENGINE',
                              variant: 'danger',
                            });
                            if (confirmed) {
                              try {
                                await api.delete(`/signatures/${principalSig.id}`);
                                notify.success('Signature Deleted', 'Principal signature deleted successfully.', { category: 'SIGNATURE ENGINE' });
                                await fetchSignatures();
                              } catch (e: any) {
                                notify.error('Deletion Failed', 'Could not delete signature.', { category: 'SIGNATURE ENGINE' });
                              }
                            }
                          }}
                          className="py-3 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-600 text-rose-700 dark:text-rose-300 hover:text-white border border-rose-500/30 transition-all font-black text-xs flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>Delete Signature</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── CARD 2: HOD SIGNATURES ── */}
                <div className="p-6 rounded-3xl bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 flex flex-col justify-between h-full space-y-4 shadow-xl">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-navy-700 pb-3">
                      <div>
                        <h4 className="text-sm font-black text-emerald-800 dark:text-emerald-400">CARD 2: HOD / COORDINATOR SIGNATURE</h4>
                        <p className="text-xs text-slate-700 dark:text-slate-300 font-bold">Dynamic Department Signature Mapping</p>
                      </div>
                    </div>

                    <div className="flex bg-slate-100 dark:bg-navy-950 p-1 rounded-2xl border border-slate-300 dark:border-navy-700 text-xs font-bold">
                      <button
                        onClick={() => setUploadType('HOD_CSE_CS')}
                        className={`flex-1 py-2.5 rounded-xl transition-all cursor-pointer text-center text-xs font-black ${
                          uploadType === 'HOD_CSE_CS' ? 'bg-emerald-700 text-white shadow-md' : 'text-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-navy-800'
                        }`}
                      >
                        Cyber Security {csHodSig ? `(${csHodSig.version})` : ''}
                      </button>
                      <button
                        onClick={() => setUploadType('HOD_CSE_IOT')}
                        className={`flex-1 py-2.5 rounded-xl transition-all cursor-pointer text-center text-xs font-black ${
                          uploadType === 'HOD_CSE_IOT' ? 'bg-indigo-700 text-white shadow-md' : 'text-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-navy-800'
                        }`}
                      >
                        IoT {iotHodSig ? `(${iotHodSig.version})` : ''}
                      </button>
                    </div>

                    {(() => {
                      const activeHod = uploadType === 'HOD_CSE_IOT' ? iotHodSig : csHodSig;
                      const deptLabel = uploadType === 'HOD_CSE_IOT' ? 'IoT' : 'Cyber Security';
                      return (
                        <div className="min-h-28 rounded-2xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 flex flex-col items-center justify-center p-3.5 relative overflow-hidden">
                          {activeHod?.image_preview ? (
                            <div className="text-center space-y-2">
                              <img src={activeHod.image_preview} alt="HOD Signature" className="max-h-16 max-w-[200px] object-contain mx-auto drop-shadow-sm" />
                              <span className="text-[11px] font-mono text-slate-800 dark:text-slate-200 font-bold inline-flex items-center space-x-1 bg-white dark:bg-navy-900 px-3 py-1 rounded-lg border border-slate-200 dark:border-navy-700 shadow-xs">
                                <Clock className="w-3.5 h-3.5 text-emerald-500" />
                                <span>{deptLabel} • {activeHod.version} • Uploaded: {activeHod.uploaded_at || 'Active'}</span>
                              </span>
                            </div>
                          ) : (
                            <div className="text-center space-y-1 py-2">
                              <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400 mx-auto" />
                              <span className="text-xs text-slate-700 dark:text-slate-300 font-extrabold">No signature uploaded for {deptLabel}</span>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {(() => {
                    const activeHod = uploadType === 'HOD_CSE_IOT' ? iotHodSig : csHodSig;
                    const deptLabel = uploadType === 'HOD_CSE_IOT' ? 'IoT' : 'Cyber Security';
                    return (
                      <div className="space-y-3 pt-1">
                        <label className="block text-xs font-black text-slate-900 dark:text-slate-200 uppercase">
                          Upload / Replace {deptLabel} Signature
                        </label>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={handleFileChange}
                          className="w-full p-2.5 bg-slate-50 dark:bg-navy-950 border border-slate-300 dark:border-navy-600 rounded-xl text-xs text-slate-950 dark:text-white font-bold file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-black file:bg-emerald-500 file:text-slate-950 cursor-pointer"
                        />

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <button
                            onClick={handleUploadSignature}
                            disabled={isUploadingSig || !uploadFile}
                            className="py-3 bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-200 dark:disabled:bg-navy-800 disabled:text-slate-500 dark:disabled:text-slate-500 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center space-x-1.5 cursor-pointer disabled:cursor-not-allowed"
                          >
                            <Upload className="w-4 h-4" />
                            <span>{isUploadingSig ? 'Saving...' : (activeHod ? `Replace ${deptLabel} Signature` : `Upload & Save ${deptLabel}`)}</span>
                          </button>

                          {activeHod && (
                            <button
                              type="button"
                              onClick={async () => {
                                const confirmed = await confirmAction({
                                  title: `Delete ${deptLabel} Signature?`,
                                  message: `Are you sure you want to delete the active ${deptLabel} signature image? Certificates for ${deptLabel} will revert to un-signed placeholder.`,
                                  confirmLabel: 'Delete Signature',
                                  category: 'SIGNATURE ENGINE',
                                  variant: 'danger',
                                });
                                if (confirmed) {
                                  try {
                                    await api.delete(`/signatures/${activeHod.id}`);
                                    notify.success('Signature Deleted', `${deptLabel} signature deleted successfully.`, { category: 'SIGNATURE ENGINE' });
                                    await fetchSignatures();
                                  } catch (e: any) {
                                    notify.error('Deletion Failed', 'Could not delete signature.', { category: 'SIGNATURE ENGINE' });
                                  }
                                }
                              }}
                              className="py-3 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-600 text-rose-700 dark:text-rose-300 hover:text-white border border-rose-500/30 transition-all font-black text-xs flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span>Delete {deptLabel} Signature</span>
                            </button>
                          )}
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
              <div className="p-5 rounded-3xl bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 space-y-4 shadow-xl">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center space-x-2">
                      <FileCheck2 className="w-5 h-5 text-amber-400" />
                      <span>Official Institutional Credential Registry & Verification Audit</span>
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-bold mt-0.5">
                      Authoritative ledger of issued certificates, verification IDs, forensic audit reports, and revocation statuses.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={fetchHistory}
                    className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-navy-800 hover:bg-slate-200 dark:hover:bg-navy-700 text-amber-400 border border-slate-300 dark:border-navy-600 text-xs sm:text-sm font-black flex items-center space-x-2 cursor-pointer shadow-sm transition-all"
                  >
                    <RefreshCw className={`w-4 h-4 ${isLoadingHistory ? 'animate-spin' : ''}`} />
                    <span>Refresh Ledger</span>
                  </button>
                </div>

                {/* Search & Filters */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-amber-400" />
                    <input
                      type="text"
                      placeholder="Search by ID, student name, or reg no..."
                      value={registrySearch}
                      onChange={(e) => setRegistrySearch(e.target.value)}
                      className="w-full pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-navy-900 border border-slate-300 dark:border-navy-600 rounded-xl text-xs sm:text-sm text-slate-950 dark:text-white placeholder-slate-400 font-bold focus:ring-2 focus:ring-amber-500 shadow-inner"
                    />
                  </div>

                  <select
                    value={registryDeptFilter}
                    onChange={(e) => setRegistryDeptFilter(e.target.value)}
                    className="px-3.5 py-2.5 bg-slate-50 dark:bg-navy-900 border border-slate-300 dark:border-navy-600 rounded-xl text-xs sm:text-sm text-slate-950 dark:text-white font-black cursor-pointer hover:border-amber-400/50 transition-colors shadow-sm"
                  >
                    <option value="all" className="bg-slate-900 text-white dark:bg-navy-950 dark:text-white font-bold py-1">All Departments</option>
                    <option value="CSE(CS)" className="bg-slate-900 text-white dark:bg-navy-950 dark:text-white font-bold py-1">Cyber Security</option>
                    <option value="CSE(IOT)" className="bg-slate-900 text-white dark:bg-navy-950 dark:text-white font-bold py-1">IoT</option>
                  </select>

                  <select
                    value={registryStatusFilter}
                    onChange={(e) => setRegistryStatusFilter(e.target.value)}
                    className="px-3.5 py-2.5 bg-slate-50 dark:bg-navy-900 border border-slate-300 dark:border-navy-600 rounded-xl text-xs sm:text-sm text-slate-950 dark:text-white font-black cursor-pointer hover:border-amber-400/50 transition-colors shadow-sm"
                  >
                    <option value="all" className="bg-slate-900 text-white dark:bg-navy-950 dark:text-white font-bold py-1">All Statuses ({history.length})</option>
                    <option value="VALID" className="bg-slate-900 text-white dark:bg-navy-950 dark:text-white font-bold py-1">Valid ({metrics.valid})</option>
                    <option value="REVOKED" className="bg-slate-900 text-white dark:bg-navy-950 dark:text-white font-bold py-1">Revoked ({metrics.revoked})</option>
                  </select>
                </div>
              </div>

              {/* Registry Table */}
              <div className="overflow-x-auto rounded-3xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 shadow-2xl">
                {filteredHistory.length === 0 ? (
                  <div className="p-12 text-center text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-bold space-y-2">
                    <p className="text-base sm:text-lg font-black text-slate-700 dark:text-slate-300">No matching credentials found in the registry.</p>
                    <p>Issue a new certificate from the "Issuance Studio" tab to record it in the ledger.</p>
                  </div>
                ) : (
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-navy-900 text-slate-900 dark:text-slate-200 uppercase tracking-wider font-black text-xs sm:text-sm border-b border-slate-300 dark:border-navy-700">
                        <th className="py-4 px-4">Certificate ID</th>
                        <th className="py-4 px-4">Student Name</th>
                        <th className="py-4 px-4">Register No</th>
                        <th className="py-4 px-4">Department</th>
                        <th className="py-4 px-4">Issue Date</th>
                        <th className="py-4 px-4 text-center">Status</th>
                        <th className="py-4 px-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-navy-800/80 font-bold text-slate-800 dark:text-slate-200">
                      {filteredHistory.map((rec) => (
                        <tr key={rec.id} className="hover:bg-slate-50 dark:hover:bg-navy-800/60 transition-colors">
                          <td className="py-4 px-4 text-xs sm:text-sm">
                            <span className="bg-amber-100/90 dark:bg-amber-500/10 text-amber-900 dark:text-amber-300 font-mono font-bold px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-500/40 inline-block shadow-xs tracking-tight">
                              {rec.verification_id}
                            </span>
                          </td>
                          <td className="py-4 px-4 font-black text-slate-950 dark:text-white text-sm sm:text-base">
                            {rec.student_name}
                          </td>
                          <td className="py-4 px-4 font-mono text-slate-900 dark:text-slate-100 font-extrabold text-xs sm:text-sm">
                            {rec.register_no}
                          </td>
                          <td className="py-4 px-4">
                            <span className="px-2.5 py-1 rounded-lg bg-indigo-100 dark:bg-indigo-500/10 text-indigo-900 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-500/30 inline-block font-mono font-bold text-xs sm:text-sm" title={rec.department_name}>
                              {rec.department || 'CSE'}
                            </span>
                          </td>
                          <td className="py-4 px-4 font-mono text-slate-900 dark:text-slate-100 font-bold text-xs sm:text-sm">
                            {rec.issue_date}
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className={`px-3 py-1.5 rounded-full text-xs font-black shadow-xs ${
                              rec.status === 'VALID'
                                ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-900 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40'
                                : 'bg-rose-100 dark:bg-rose-500/20 text-rose-900 dark:text-rose-300 border border-rose-300 dark:border-rose-500/40'
                            }`}>
                              {rec.status}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <div className="flex items-center justify-center space-x-2">
                              <button
                                type="button"
                                onClick={() => handleDownloadPdf(rec.verification_id)}
                                className="p-2 sm:p-2.5 rounded-xl bg-emerald-50 dark:bg-navy-800 hover:bg-emerald-100 dark:hover:bg-navy-700 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-navy-600 cursor-pointer shadow-xs hover:scale-105 transition-all"
                                title="Download Official Certificate PDF"
                              >
                                <Download className="w-4 h-4" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDownloadForensicPdf(`CERT-${rec.register_no}-FORENSIC`)}
                                className="p-2 sm:p-2.5 rounded-xl bg-indigo-50 dark:bg-navy-800 hover:bg-indigo-100 dark:hover:bg-navy-700 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-navy-600 cursor-pointer shadow-xs hover:scale-105 transition-all"
                                title="Download Forensic Audit Report PDF"
                              >
                                <FileText className="w-4 h-4" />
                              </button>

                              <a
                                href={rec.verification_url || `/verify-certificate/${rec.verification_id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="p-2 sm:p-2.5 rounded-xl bg-sky-50 dark:bg-navy-800 hover:bg-sky-100 dark:hover:bg-navy-700 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-navy-600 cursor-pointer shadow-xs hover:scale-105 transition-all"
                                title="Verify Public QR Page"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>

                              {rec.status === 'VALID' && (
                                <button
                                  type="button"
                                  onClick={() => handleRevokeCertificate(rec.verification_id)}
                                  className="p-2 sm:p-2.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 cursor-pointer shadow-xs hover:scale-105 transition-all"
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
          <GlobalModalBackdrop isOpen={true} onClose={() => setShowConfirmIssueModal(false)} className="flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 15 }}
              className="max-w-md w-full p-6 rounded-3xl bg-white dark:bg-navy-950 border border-slate-300 dark:border-navy-600 shadow-2xl space-y-4 text-slate-950 dark:text-white"
            >
              <div className="flex items-center space-x-3 border-b border-slate-200 dark:border-navy-700 pb-3">
                <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-950 dark:text-white">Review & Issue Credential</h3>
                  <p className="text-xs text-slate-700 dark:text-slate-300 font-bold">Institutional Authority Confirmation</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 space-y-2.5 text-xs font-black shadow-inner">
                <div className="flex justify-between">
                  <span className="text-slate-700 dark:text-slate-300 font-bold">Recipient:</span>
                  <span className="font-black text-slate-950 dark:text-white">{selectedStudent.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-700 dark:text-slate-300 font-bold">Register No:</span>
                  <span className="font-mono font-black text-amber-800 dark:text-amber-300">{selectedStudent.reg_no}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-700 dark:text-slate-300 font-bold">Department:</span>
                  <span className="font-bold text-slate-950 dark:text-slate-200">{currentDeptTitle}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-700 dark:text-slate-300 font-bold">Recognition:</span>
                  <span className="font-black text-emerald-700 dark:text-emerald-400">{currentTypeMeta.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-700 dark:text-slate-300 font-bold">Certificate ID:</span>
                  <span className="font-mono font-black text-slate-950 dark:text-slate-200">{canonicalCertId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-700 dark:text-slate-300 font-bold">Principal Signature:</span>
                  <span className={principalSig?.image_preview ? 'text-emerald-700 dark:text-emerald-400 font-black' : 'text-amber-700 dark:text-amber-400 font-black'}>
                    {principalSig?.image_preview ? 'Configured' : 'Missing'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-700 dark:text-slate-300 font-bold">HOD Signature:</span>
                  <span className={currentHodSig?.image_preview ? 'text-emerald-700 dark:text-emerald-400 font-black' : 'text-amber-700 dark:text-amber-400 font-black'}>
                    {currentHodSig?.image_preview ? 'Configured' : 'Missing'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-700 dark:text-slate-300 font-bold">QR Verification:</span>
                  <span className="text-emerald-700 dark:text-emerald-400 font-black">Ready & Sealed</span>
                </div>
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <button
                  onClick={() => setShowConfirmIssueModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-navy-800 hover:bg-slate-200 dark:bg-navy-700 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
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
          </GlobalModalBackdrop>
        )}
      </AnimatePresence>

    </div>,
    document.body
  );
};
