import React, { useState, useEffect } from 'react';
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
  AlertTriangle
} from 'lucide-react';
import api from '../services/api';
import { syncCertificateToFirestoreWeb } from '../services/firebaseSync';

interface CertificateRecord {
  id: number;
  verification_id: string;
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
  department?: {
    code: string;
    name: string;
  };
  stats?: {
    total_solved?: number;
    contest_rating?: number;
  };
}

export const CertificateManagementModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  preselectedStudent?: StudentOption | null;
}> = ({ isOpen, onClose, preselectedStudent }) => {
  const [activeTab, setActiveTab] = useState<'generate' | 'signatures' | 'history'>('generate');

  // Student selection
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentOption | null>(preselectedStudent || null);
  const [searchQuery, setSearchQuery] = useState('');

  // Certificate Generation State
  const [certType, setCertType] = useState('Top Performer');
  const [customDate, setCustomDate] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCert, setGeneratedCert] = useState<any>(null);
  const [genSuccessMsg, setGenSuccessMsg] = useState<string | null>(null);

  // Signatures State
  const [signatures, setSignatures] = useState<AuthorizedSignature[]>([]);
  const [uploadType, setUploadType] = useState<'PRINCIPAL' | 'HOD_CSE_CS' | 'HOD_CSE_IOT'>('PRINCIPAL');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [isUploadingSig, setIsUploadingSig] = useState(false);

  // History State
  const [history, setHistory] = useState<CertificateRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
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
  }, [isOpen, preselectedStudent, onClose]);

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

  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.reg_no.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const resolveDeptFullName = (deptCode?: string) => {
    if (!deptCode) return "Department of Computer Science and Engineering";
    const code = deptCode.toUpperCase();
    if (code.includes('IOT')) return "Department of Computer Science and Engineering (IoT)";
    return "Department of Computer Science and Engineering (Cyber Security)";
  };

  const handleGenerateCertificate = async () => {
    if (!selectedStudent) return;
    setIsGenerating(true);
    setGenSuccessMsg(null);
    try {
      const res = await api.post('/certificates/generate', {
        student_id: selectedStudent.id,
        cert_type: certType,
        issue_date: customDate || undefined
      });
      setGeneratedCert(res.data);
      setGenSuccessMsg(`Official Certificate ${res.data.verification_id} generated successfully!`);
      await syncCertificateToFirestoreWeb(res.data);
      await fetchHistory();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to generate certificate.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadPdf = async (targetId?: string) => {
    const idToUse = targetId || generatedCert?.verification_id || selectedStudent?.reg_no || (selectedStudent ? String(selectedStudent.id) : null);
    if (!idToUse) {
      alert("Please select a student recipient first to download certificate.");
      return;
    }

    try {
      const response = await api.get(`/certificates/${encodeURIComponent(idToUse)}/download-pdf`, {
        responseType: 'blob'
      });

      // Handle JSON error payload returned as blob
      if (response.data && response.data.type === 'application/json') {
        const text = await response.data.text();
        try {
          const errJson = JSON.parse(text);
          alert(`Certificate Error: ${errJson.detail || 'Could not generate PDF.'}`);
          return;
        } catch (e) {}
      }

      const blob = new Blob([response.data], { type: 'application/pdf' });
      let filename = `Certificate_${idToUse}.pdf`;
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
      setTimeout(() => {
        window.URL.revokeObjectURL(blobUrl);
      }, 2000);
    } catch (err: any) {
      console.error("Download error:", err);
      alert("Failed to download official certificate PDF. Please try again.");
    }
  };

  const handleDownloadForensicPdf = async (targetId?: string) => {
    const idToUse = targetId || generatedCert?.verification_id || selectedStudent?.reg_no || (selectedStudent ? String(selectedStudent.id) : null);
    if (!idToUse) {
      alert("Please select a student recipient first to download Forensic Audit Report.");
      return;
    }

    try {
      const response = await api.get(`/certificates/${encodeURIComponent(idToUse)}/download-forensic-pdf`, {
        responseType: 'blob'
      });

      if (response.data && response.data.type === 'application/json') {
        const text = await response.data.text();
        try {
          const errJson = JSON.parse(text);
          alert(`Forensic Report Error: ${errJson.detail || 'Could not generate report.'}`);
          return;
        } catch (e) {}
      }

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
      setTimeout(() => {
        window.URL.revokeObjectURL(blobUrl);
      }, 2000);
    } catch (err: any) {
      console.error("Forensic Download error:", err);
      alert("Failed to download Official LeetCode Contest Forensic Verification Audit Report.");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        alert("Image must be smaller than 5MB.");
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
      alert("Signature uploaded successfully!");
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to upload signature.");
    } finally {
      setIsUploadingSig(false);
    }
  };

  const handleRevokeCertificate = async (verificationId: string) => {
    if (!confirm(`Are you sure you want to revoke Certificate ${verificationId}? This cannot be undone.`)) return;
    try {
      await api.post(`/certificates/${verificationId}/revoke`, {
        reason: "Revoked by Administrator"
      });
      await fetchHistory();
      if (generatedCert && generatedCert.verification_id === verificationId) {
        setGeneratedCert({ ...generatedCert, status: 'REVOKED' });
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to revoke certificate.");
    }
  };

  if (!isOpen) return null;

  const currentDeptTitle = resolveDeptFullName(selectedStudent?.department?.code);
  const studentName = selectedStudent?.name || "STUDENT NAME";
  const studentReg = selectedStudent?.reg_no || "732224CC001";
  const activeVerificationId = generatedCert?.verification_id || "CERT-PREVIEW";

  const principalSig = signatures.find(s => s.signature_type === 'PRINCIPAL' && s.is_active);
  const csHodSig = signatures.find(s => s.signature_type === 'HOD_CSE_CS' && s.is_active);
  const iotHodSig = signatures.find(s => s.signature_type === 'HOD_CSE_IOT' && s.is_active);
  const currentHodSig = (selectedStudent?.department?.code || '').toUpperCase().includes('IOT') ? iotHodSig : csHodSig;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md overflow-hidden animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl max-w-6xl w-full max-h-[calc(100vh-48px)] flex flex-col overflow-hidden animate-scaleUp mt-2 sm:mt-4"
        onClick={(e) => e.stopPropagation()}
      >

        {/* Modal Header — Fixed / Sticky at top */}
        <div className="sticky top-0 z-30 px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/95 backdrop-blur-md shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white flex items-center space-x-2.5">
                <span>Certificate of Excellence — Institutional Issuance Hub</span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  PRINT READY A4
                </span>
              </h3>
              <p className="text-xs text-slate-400 font-semibold mt-0.5">
                Nandha Engineering College (Autonomous) • Official Academic Credential System
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="flex bg-slate-800/80 p-1 rounded-xl border border-slate-700 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTab('generate')}
                className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${activeTab === 'generate' ? 'bg-amber-500 text-slate-950 font-black shadow' : 'text-slate-400 hover:text-white'}`}
              >
                Issue Certificate
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('signatures')}
                className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${activeTab === 'signatures' ? 'bg-amber-500 text-slate-950 font-black shadow' : 'text-slate-400 hover:text-white'}`}
              >
                Signatures
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${activeTab === 'history' ? 'bg-amber-500 text-slate-950 font-black shadow' : 'text-slate-400 hover:text-white'}`}
              >
                Issued Registry ({history.length})
              </button>
            </div>

            {/* Prominent High-Visibility Close Button */}
            <button
              type="button"
              onClick={onClose}
              title="Close"
              aria-label="Close"
              className="px-3.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/30 transition-all font-black text-xs flex items-center space-x-1.5 cursor-pointer shadow-sm ml-2"
            >
              <span className="text-base leading-none font-black">✕</span>
              <span>Close</span>
            </button>
          </div>
        </div>

        {/* Modal Body — Internal Scroll */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0 space-y-6 overscroll-contain">

          {/* TAB 1: GENERATE & PREVIEW CERTIFICATE */}
          {activeTab === 'generate' && (
            <div className="space-y-3">

              {/* Signature Pre-flight Validation Banner */}
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between flex-wrap gap-2 text-xs">
                <div className="flex items-center space-x-6 flex-wrap gap-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-slate-400 font-bold uppercase text-[10px]">Principal Signature:</span>
                    {principalSig?.image_preview ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold flex items-center space-x-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Configured ({principalSig.version})</span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold flex items-center space-x-1">
                        <AlertTriangle className="w-3 h-3" />
                        <span>⚠ NOT CONFIGURED</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="text-slate-400 font-bold uppercase text-[10px]">
                      HOD Signature ({selectedStudent?.department?.code?.includes('IOT') ? 'IoT' : 'Cyber Security'}):
                    </span>
                    {currentHodSig?.image_preview ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold flex items-center space-x-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Configured ({currentHodSig.version})</span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold flex items-center space-x-1">
                        <AlertTriangle className="w-3 h-3" />
                        <span>⚠ HOD SIGNATURE NOT CONFIGURED</span>
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => setActiveTab('signatures')}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 font-bold transition-all flex items-center space-x-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Configure Signatures</span>
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* Left Column: Student Selector & Parameters */}
                <div className="lg:col-span-4 space-y-4">
                  <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center space-x-1.5">
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Select Student Recipient</span>
                    </span>

                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search by name or reg no..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500"
                      />
                    </div>

                    <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-800/50">
                      {filteredStudents.slice(0, 30).map((st) => (
                        <div
                          key={st.id}
                          onClick={() => { setSelectedStudent(st); setGeneratedCert(null); }}
                          className={`p-2.5 rounded-xl text-xs cursor-pointer transition-all ${selectedStudent?.id === st.id
                              ? 'bg-amber-500/20 text-white border border-amber-500/40 font-bold'
                              : 'bg-slate-900/60 hover:bg-slate-800 text-slate-300'
                            }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold">{st.name}</span>
                            <span className="text-[10px] font-mono text-slate-400">{st.reg_no}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5 flex items-center justify-between">
                            <span>{st.department?.code || 'CSE'}</span>
                            {st.stats?.total_solved !== undefined && (
                              <span className="text-emerald-400 font-bold">{st.stats.total_solved} Solved</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Parameters */}
                  <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3.5 text-xs">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-400 uppercase text-[10px]">Recognition Title</label>
                      <input
                        type="text"
                        value={certType}
                        onChange={(e) => setCertType(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-bold"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-400 uppercase text-[10px]">Issue Date Display</label>
                      <input
                        type="text"
                        placeholder="e.g. Aug 15, 2026 (Defaults to today)"
                        value={customDate}
                        onChange={(e) => setCustomDate(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
                      />
                    </div>

                    <button
                      onClick={handleGenerateCertificate}
                      disabled={isGenerating || !selectedStudent}
                      className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center space-x-2 transition-all transform hover:scale-[1.02] cursor-pointer disabled:opacity-50"
                    >
                      <Award className="w-4 h-4" />
                      <span>{isGenerating ? 'Generating High-Res Certificate...' : 'Generate & Issue Certificate'}</span>
                    </button>

                    <div className="space-y-2 pt-2 border-t border-slate-800">
                      <button
                        onClick={() => handleDownloadPdf(generatedCert?.verification_id || selectedStudent?.reg_no)}
                        disabled={!selectedStudent}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center justify-center space-x-2 shadow-md cursor-pointer transition-all"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download Official Certificate PDF</span>
                      </button>

                      <button
                        onClick={() => handleDownloadForensicPdf(generatedCert?.verification_id || selectedStudent?.reg_no)}
                        disabled={!selectedStudent}
                        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center justify-center space-x-2 shadow-md cursor-pointer transition-all"
                      >
                        <FileText className="w-3.5 h-3.5 text-indigo-200" />
                        <span>Download Forensic Audit Report PDF</span>
                      </button>

                      <a
                        href={generatedCert?.verification_url || `/verify-certificate/${selectedStudent?.reg_no || ''}`}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl flex items-center justify-center space-x-2 border border-slate-700 transition-all"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Verify Public QR Page</span>
                      </a>
                    </div>
                  </div>
                </div>

                {/* Right Column: High-Fidelity A4 Landscape Live Preview */}
                <div className="lg:col-span-8 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] flex items-center space-x-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>A4 Landscape Live Institutional Preview</span>
                    </span>
                    <span className="font-mono text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-bold">
                      Ratio: 297mm × 210mm
                    </span>
                  </div>

                  {/* The Certificate Canvas */}
                  <div className="relative w-full aspect-[297/210] bg-[#FCFCFA] text-slate-900 rounded-2xl p-6 sm:p-8 flex flex-col justify-between shadow-2xl border-[5px] border-[#0B192C] overflow-hidden select-none font-serif">

                    {/* Inner Gold Border */}
                    <div className="absolute inset-2 border-[1.5px] border-[#C5A059] pointer-events-none"></div>

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

                    {/* Certificate Title & Student */}
                    <div className="text-center space-y-2 relative z-10 my-auto">
                      <h3 className="text-lg sm:text-xl font-black text-[#B45309] tracking-wider uppercase drop-shadow-xs">
                        CERTIFICATE OF EXCELLENCE
                      </h3>
                      <p className="text-[9px] font-bold text-[#475569] uppercase tracking-widest">
                        THIS CERTIFICATE IS PROUDLY PRESENTED TO
                      </p>
                      <h4 className="text-xl sm:text-2xl font-black text-[#0B192C] tracking-wide underline decoration-[#C5A059] decoration-2 underline-offset-4 uppercase">
                        {studentName}
                      </h4>
                      <p className="text-[10px] text-[#1E293B] font-sans font-semibold">
                        Register No: <strong>{studentReg}</strong> &nbsp;|&nbsp; <strong>{currentDeptTitle}</strong>
                      </p>
                      <p className="text-[9px] sm:text-[10px] text-[#334155] max-w-xl mx-auto leading-relaxed pt-1">
                        For exceptional algorithmic problem-solving competence, dedication, and achieving <strong>Top Performer</strong> distinction in the Institutional LeetCode Continuous Performance Tracking System during the academic session.
                      </p>
                      <div className="inline-block px-3 py-0.5 rounded-full bg-[#065F46]/10 text-[#065F46] border border-[#065F46]/30 text-[8px] font-black uppercase tracking-wider">
                        ★ TOP PERFORMER • WEEKLY LEETCODE PROGRAM ★
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
                          Verification Code: <strong className="font-mono text-[#0B192C]">{activeVerificationId}</strong>
                        </p>
                        <p className="text-[7px] text-slate-500">Scan QR to verify authenticity</p>
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

          {/* TAB 2: SIGNATURE MANAGEMENT */}
          {activeTab === 'signatures' && (
            <div className="space-y-6">

              {/* Header Info */}
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h4 className="text-sm font-black text-white flex items-center space-x-2">
                    <span>Authorized Signatures Management Center</span>
                  </h4>
                  <p className="text-xs text-slate-400">
                    Upload official transparent PNG signatures (max 5MB). Signatures are automatically embedded above baseline lines in generated PDFs.
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-black bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  Dual Signatory Architecture
                </span>
              </div>

              {/* CARD 1 & CARD 2 GRID */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* ── CARD 1: PRINCIPAL SIGNATURE ── */}
                <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div>
                      <h5 className="text-sm font-black text-amber-400">CARD 1: PRINCIPAL SIGNATURE</h5>
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

                  {/* Signature Preview Canvas */}
                  <div className="h-28 rounded-xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center p-3 relative overflow-hidden">
                    {principalSig?.image_preview ? (
                      <div className="text-center space-y-1">
                        <img
                          src={principalSig.image_preview}
                          alt="Principal Signature"
                          className="max-h-16 max-w-[200px] object-contain mx-auto"
                        />
                        <span className="text-[9px] font-mono text-slate-500 block">Uploaded: {principalSig.uploaded_at || 'Active'}</span>
                      </div>
                    ) : (
                      <div className="text-center space-y-1">
                        <AlertTriangle className="w-6 h-6 text-slate-600 mx-auto" />
                        <span className="text-xs text-slate-500 font-medium">No signature image uploaded</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="space-y-3 pt-1">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase">
                      {principalSig?.image_preview ? 'Replace Principal Signature' : 'Upload Principal Signature'}
                    </label>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => { setUploadType('PRINCIPAL'); handleFileChange(e); }}
                      className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-300 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-black file:bg-amber-500 file:text-slate-950 cursor-pointer"
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
                            if (confirm("Remove Principal signature image?")) {
                              await api.delete(`/signatures/${principalSig.id}`);
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

                {/* ── CARD 2: HOD / COORDINATOR SIGNATURES ── */}
                <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div>
                      <h5 className="text-sm font-black text-emerald-400">CARD 2: HOD / COORDINATOR SIGNATURE</h5>
                      <p className="text-[11px] text-slate-400">Dynamic Department Signature Mapping</p>
                    </div>
                  </div>

                  {/* Department Selector */}
                  <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-bold">
                    <button
                      onClick={() => setUploadType('HOD_CSE_CS')}
                      className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer text-center ${uploadType === 'HOD_CSE_CS' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
                        }`}
                    >
                      Cyber Security {csHodSig ? `(${csHodSig.version})` : '⚠'}
                    </button>
                    <button
                      onClick={() => setUploadType('HOD_CSE_IOT')}
                      className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer text-center ${uploadType === 'HOD_CSE_IOT' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-white'
                        }`}
                    >
                      IoT {iotHodSig ? `(${iotHodSig.version})` : '⚠'}
                    </button>
                  </div>

                  {/* Active HOD Preview Canvas */}
                  {(() => {
                    const activeHod = uploadType === 'HOD_CSE_IOT' ? iotHodSig : csHodSig;
                    const deptLabel = uploadType === 'HOD_CSE_IOT' ? 'IoT' : 'Cyber Security';
                    return (
                      <div className="space-y-3">
                        <div className="h-28 rounded-xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center p-3 relative overflow-hidden">
                          {activeHod?.image_preview ? (
                            <div className="text-center space-y-1">
                              <img
                                src={activeHod.image_preview}
                                alt="HOD Signature"
                                className="max-h-16 max-w-[200px] object-contain mx-auto"
                              />
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

                        {/* Upload Controls */}
                        <div className="space-y-3 pt-1">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase">
                            Upload / Replace {deptLabel} Signature
                          </label>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            onChange={handleFileChange}
                            className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-300 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-black file:bg-emerald-500 file:text-slate-950 cursor-pointer"
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
                                  if (confirm(`Remove ${deptLabel} signature image?`)) {
                                    await api.delete(`/signatures/${activeHod.id}`);
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

          {/* TAB 3: ISSUED REGISTRY HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black text-white flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-amber-400" />
                  <span>Authoritative Certificate Registry & Verification Audit</span>
                </h4>
                <button
                  onClick={fetchHistory}
                  className="text-xs font-bold text-amber-400 hover:underline flex items-center space-x-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Refresh Registry</span>
                </button>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950">
                {history.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 font-medium">
                    No issued certificates recorded yet. Generate a certificate from the "Issue Certificate" tab to record it in the ledger.
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-900/80 text-slate-400 uppercase tracking-wider font-bold text-[10px] border-b border-slate-800">
                        <th className="py-3 px-4">Verification ID</th>
                        <th className="py-3 px-4">Student Name</th>
                        <th className="py-3 px-4">Register No</th>
                        <th className="py-3 px-4">Department</th>
                        <th className="py-3 px-4">Issue Date</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-medium text-slate-300">
                      {history.map((rec) => (
                        <tr key={rec.id} className="hover:bg-slate-900/40">
                          <td className="py-3 px-4 font-mono font-bold text-amber-400">
                            {rec.verification_id}
                          </td>
                          <td className="py-3 px-4 font-bold text-white">
                            {rec.student_name}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-400">
                            {rec.register_no}
                          </td>
                          <td className="py-3 px-4">
                            <span className="truncate max-w-[180px] block" title={rec.department_name}>
                              {rec.department}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-400">
                            {rec.issue_date}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${rec.status === 'VALID'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              }`}>
                              {rec.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center space-x-2">
                              {rec.has_pdf && (
                                <button
                                  onClick={() => handleDownloadPdf(rec.verification_id)}
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 cursor-pointer"
                                  title="Download PDF"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>
                              )}

                              <a
                                href={rec.verification_url}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700 cursor-pointer"
                                title="Public QR Verification"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>

                              {rec.status === 'VALID' && (
                                <button
                                  onClick={() => handleRevokeCertificate(rec.verification_id)}
                                  className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 cursor-pointer"
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
      </div>
    </div>
  );
};
