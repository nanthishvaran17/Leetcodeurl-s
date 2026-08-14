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
  Check
} from 'lucide-react';
import api from '../services/api';

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
      fetchStudents();
      fetchSignatures();
      fetchHistory();
      if (preselectedStudent) {
        setSelectedStudent(preselectedStudent);
      }
    }
  }, [isOpen, preselectedStudent]);

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
      await fetchHistory();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to generate certificate.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadPdf = (verificationId: string) => {
    const baseApi = import.meta.env.VITE_API_URL || '';
    window.open(`${baseApi}/api/certificates/${verificationId}/download-pdf`, '_blank');
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
      formData.append('signature_type', uploadType);
      formData.append('file', uploadFile);

      await api.post('/signatures/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      alert(`Successfully saved authorized signature for ${uploadType}!`);
      setUploadFile(null);
      setUploadPreview(null);
      await fetchSignatures();
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl max-w-6xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-scaleUp">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white flex items-center space-x-2">
                <span>Certificate of Excellence — Institutional Issuance Hub</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  PRINT READY A4
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Nandha Engineering College (Autonomous) • Official Academic Credential System
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700 text-xs font-bold">
              <button
                onClick={() => setActiveTab('generate')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${activeTab === 'generate' ? 'bg-amber-500 text-slate-950 font-black shadow' : 'text-slate-400 hover:text-white'}`}
              >
                Issue Certificate
              </button>
              <button
                onClick={() => setActiveTab('signatures')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${activeTab === 'signatures' ? 'bg-amber-500 text-slate-950 font-black shadow' : 'text-slate-400 hover:text-white'}`}
              >
                Signatures
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${activeTab === 'history' ? 'bg-amber-500 text-slate-950 font-black shadow' : 'text-slate-400 hover:text-white'}`}
              >
                Issued Registry ({history.length})
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-2"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          
          {/* TAB 1: GENERATE & PREVIEW CERTIFICATE */}
          {activeTab === 'generate' && (
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
                        className={`p-2.5 rounded-xl text-xs cursor-pointer transition-all ${
                          selectedStudent?.id === st.id
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

                  {generatedCert && (
                    <div className="space-y-2 pt-2 border-t border-slate-800">
                      <button
                        onClick={() => handleDownloadPdf(generatedCert.verification_id)}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center space-x-2 shadow-md cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download Official PDF</span>
                      </button>

                      <a
                        href={generatedCert.verification_url}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl flex items-center justify-center space-x-2 border border-slate-700"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Verify Public QR Page</span>
                      </a>
                    </div>
                  )}
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
                    <div className="space-y-0.5">
                      {principalSig?.image_preview ? (
                        <img src={principalSig.image_preview} alt="Principal Signature" className="h-8 max-w-[120px] object-contain mx-auto mb-1" />
                      ) : (
                        <div className="h-6"></div>
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
                    <div className="space-y-0.5">
                      {currentHodSig?.image_preview ? (
                        <img src={currentHodSig.image_preview} alt="HOD Signature" className="h-8 max-w-[120px] object-contain mx-auto mb-1" />
                      ) : (
                        <div className="h-6"></div>
                      )}
                      <div className="w-32 border-b border-slate-800 mx-auto"></div>
                      <p className="text-[9px] font-black leading-tight mt-1">HOD / COORDINATOR</p>
                      <p className="text-[7px] text-slate-600 truncate max-w-[160px] mx-auto" title={currentDeptTitle}>{currentDeptTitle}</p>
                    </div>

                  </div>

                </div>

              </div>

            </div>
          )}

          {/* TAB 2: SIGNATURE MANAGEMENT */}
          {activeTab === 'signatures' && (
            <div className="space-y-6">
              <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-800 pb-3">
                  <div>
                    <h4 className="text-sm font-black text-white flex items-center space-x-2">
                      <span>Authorized Signature Management</span>
                    </h4>
                    <p className="text-xs text-slate-400">
                      Upload and manage transparent PNG signatures for Principal and Department HODs/Coordinators.
                    </p>
                  </div>

                  <span className="px-3 py-1 rounded-full text-xs font-black bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                    Version Controlled & Secure
                  </span>
                </div>

                {/* Upload Form */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-400 uppercase text-[10px]">Signatory Position</label>
                    <select
                      value={uploadType}
                      onChange={(e: any) => setUploadType(e.target.value)}
                      className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-bold"
                    >
                      <option value="PRINCIPAL">Principal (College-wide)</option>
                      <option value="HOD_CSE_CS">HOD / Coordinator — Cyber Security</option>
                      <option value="HOD_CSE_IOT">HOD / Coordinator — IoT</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-400 uppercase text-[10px]">Upload Signature File</label>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleFileChange}
                      className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-300 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-black file:bg-amber-500 file:text-slate-950"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      onClick={handleUploadSignature}
                      disabled={isUploadingSig || !uploadFile}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-lg transition-all disabled:opacity-50 flex items-center justify-center space-x-1.5 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isUploadingSig ? 'Uploading...' : 'Save Signature'}</span>
                    </button>
                  </div>
                </div>

                {uploadPreview && (
                  <div className="p-3 rounded-xl bg-slate-900 border border-amber-500/30 flex items-center space-x-4">
                    <span className="text-xs text-slate-400 font-bold">Selected Preview:</span>
                    <img src={uploadPreview} alt="Signature Upload Preview" className="h-10 bg-white/10 p-1 rounded object-contain border border-slate-700" />
                  </div>
                )}
              </div>

              {/* Active Signatures Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                
                {/* 1. Principal */}
                <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-amber-400">PRINCIPAL</span>
                    <span className="text-[10px] font-mono text-slate-400">{principalSig?.version || 'v1'}</span>
                  </div>
                  <div className="h-16 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-center p-2">
                    {principalSig?.image_preview ? (
                      <img src={principalSig.image_preview} alt="Principal Signature" className="h-full object-contain" />
                    ) : (
                      <span className="text-xs text-slate-500 font-medium">Text Line Only</span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Status: <strong className={principalSig ? 'text-emerald-400' : 'text-slate-500'}>{principalSig ? 'Active Signature Loaded' : 'Default Signatory Line'}</strong>
                  </div>
                </div>

                {/* 2. HOD CSE(CS) */}
                <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-emerald-400">HOD — CYBER SECURITY</span>
                    <span className="text-[10px] font-mono text-slate-400">{csHodSig?.version || 'v1'}</span>
                  </div>
                  <div className="h-16 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-center p-2">
                    {csHodSig?.image_preview ? (
                      <img src={csHodSig.image_preview} alt="Cyber Security HOD Signature" className="h-full object-contain" />
                    ) : (
                      <span className="text-xs text-slate-500 font-medium">Text Line Only</span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Status: <strong className={csHodSig ? 'text-emerald-400' : 'text-slate-500'}>{csHodSig ? 'Active Signature Loaded' : 'Default Signatory Line'}</strong>
                  </div>
                </div>

                {/* 3. HOD CSE(IoT) */}
                <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-sky-400">HOD — IOT</span>
                    <span className="text-[10px] font-mono text-slate-400">{iotHodSig?.version || 'v1'}</span>
                  </div>
                  <div className="h-16 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-center p-2">
                    {iotHodSig?.image_preview ? (
                      <img src={iotHodSig.image_preview} alt="IoT HOD Signature" className="h-full object-contain" />
                    ) : (
                      <span className="text-xs text-slate-500 font-medium">Text Line Only</span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Status: <strong className={iotHodSig ? 'text-emerald-400' : 'text-slate-500'}>{iotHodSig ? 'Active Signature Loaded' : 'Default Signatory Line'}</strong>
                  </div>
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
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                              rec.status === 'VALID'
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
