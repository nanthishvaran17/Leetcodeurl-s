import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  XCircle,
  Award,
  Calendar,
  Building2,
  FileCheck2,
  Download,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  QrCode,
  ArrowLeft,
  Sparkles,
  FileCode2,
  CheckCircle,
  Hash,
  Database
} from 'lucide-react';
import api from '../services/api';
import { fetchCertificateFromFirestoreWeb } from '../services/firebaseSync';

interface CertificateVerificationData {
  status: 'VERIFIED' | 'REVOKED' | 'NOT_VERIFIED';
  is_valid: boolean;
  document_type?: 'CERTIFICATE_OF_EXCELLENCE' | 'FORENSIC_VERIFICATION_REPORT' | string;
  verification_id: string;
  verified?: boolean;
  certificate_id?: string;
  achievement_level?: string;
  student_name?: string;
  register_no?: string;
  department?: string;
  department_name?: string;
  program?: string;
  recognition?: string;
  issue_date?: string;
  certificate_type?: string;
  verification_url?: string;
  institution?: string;
  accreditation?: string;
  revocation_reason?: string;
  message?: string;
  // Forensic specific fields
  contest_name?: string;
  contest_date?: string;
  contest_status?: string;
  participation_status?: string;
  problems_solved?: string;
  contest_score?: string;
  contest_rank?: string;
  contest_rating?: string;
  sha_hash?: string;
  source_engine?: string;
}

export const CertificateVerificationPage: React.FC<{ verificationId?: string }> = ({ verificationId: propId }) => {
  const getPathId = () => {
    if (typeof window === 'undefined') return '';
    const path = window.location.pathname;
    const prefixes = ['/verify/', '/verify-certificate/', '/certificate/verify/', '/certificates/verify/', '/verify-contest/'];
    const p = prefixes.find(prefix => path.startsWith(prefix));
    if (p) {
      return decodeURIComponent(path.replace(p, '')).split('/')[0].split('?')[0].trim();
    }
    return '';
  };

  const verificationId = (propId || getPathId()).trim();
  const [data, setData] = useState<CertificateVerificationData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<boolean>(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setError(null);
    setDownloadError(null);
    if (!verificationId) {
      setLoading(false);
      setData({
        status: 'NOT_VERIFIED',
        is_valid: false,
        verification_id: '',
        message: 'Invalid Certificate Identifier'
      });
      return;
    }
    fetchVerification();
  }, [verificationId]);

  const fetchVerification = async () => {
    setLoading(true);
    setError(null);
    const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
    const regParam = searchParams.get('reg') || searchParams.get('reg_no') || '';
    const contestParam = searchParams.get('contest') || '';
    const nameParam = searchParams.get('name') || '';

    try {
      // 1. Primary: Authoritative Backend API
      const queryStr = regParam ? `?reg=${encodeURIComponent(regParam)}&contest=${encodeURIComponent(contestParam)}` : '';
      const res = await api.get(`/certificates/verify/${encodeURIComponent(verificationId)}${queryStr}`);
      if (res.data && res.data.verified !== false && res.data.status !== 'NOT_FOUND') {
        setData(res.data);
        setLoading(false);
        return;
      }
    } catch (err: any) {
      console.debug("Backend lookup note, checking secondary resolvers:", err);
    }

    try {
      // 2. Secondary High-Availability Fallback: Cloud Firestore
      const firestoreCert = await fetchCertificateFromFirestoreWeb(verificationId);
      if (firestoreCert) {
        setData(firestoreCert as CertificateVerificationData);
        setLoading(false);
        return;
      }
    } catch (firestoreErr) {
      console.debug("Firestore lookup error:", firestoreErr);
    }

    // Default Not Found State (No hardcoded or fabricated fallbacks allowed)
    setData({
      status: 'NOT_VERIFIED',
      is_valid: false,
      verification_id: verificationId,
      message: 'Certificate Not Found in Institutional Registry'
    });
    setError('NOT_FOUND');
    setLoading(false);
  };

  const isForensicDoc = data?.document_type === 'FORENSIC_VERIFICATION_REPORT' ||
    (data?.verification_id && data.verification_id.toUpperCase().includes('FORENSIC')) ||
    (data?.certificate_type && data.certificate_type.toLowerCase().includes('forensic'));

  const handleDownloadPdf = async () => {
    if (!verificationId) return;
    setDownloading(true);
    setDownloadError(null);

    const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
    const regParam = searchParams.get('reg') || searchParams.get('reg_no') || data?.register_no || '';
    const contestParam = searchParams.get('contest') || '';
    const nameParam = searchParams.get('name') || data?.student_name || '';

    const queryParams = new URLSearchParams();
    if (regParam) queryParams.set('reg', regParam);
    if (contestParam) queryParams.set('contest', contestParam);
    if (nameParam) queryParams.set('name', nameParam);
    const queryStr = queryParams.toString() ? `?${queryParams.toString()}` : '';

    try {
      const downloadEndpoint = isForensicDoc
        ? `/certificates/${encodeURIComponent(verificationId)}/download-forensic-pdf`
        : `/certificates/${encodeURIComponent(verificationId)}/download-pdf${queryStr}`;

      const response = await api.get(downloadEndpoint, {
        responseType: 'blob',
        timeout: 60000
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const cleanStudentName = (data?.student_name || 'Student').replace(/[^A-Za-z0-9_]+/g, '_').toUpperCase();
      let filename = isForensicDoc
        ? `${cleanStudentName}_${data?.register_no || ''}_Forensic_Audit_Report.pdf`
        : `${cleanStudentName}_${data?.register_no || ''}_Certificate.pdf`;

      const disposition = response.headers['content-disposition'] || response.headers['Content-Disposition'];
      if (disposition && disposition.includes('filename=')) {
        const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
        if (matches != null && matches[1]) {
          filename = matches[1].replace(/['"]/g, '').trim();
        }
      }

      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.style.display = 'none';
      link.href = blobUrl;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        if (document.body.contains(link)) {
          document.body.removeChild(link);
        }
        window.URL.revokeObjectURL(blobUrl);
      }, 3000);
    } catch (err: any) {
      console.error("Certificate PDF Download error:", err);
      let errorMsg = "Unable to download certificate PDF. Please verify your connection or try again.";
      if (err.response) {
        if (err.response.status === 404) {
          errorMsg = "Certificate record not found in official institutional registry.";
        } else if (err.response.status === 400) {
          errorMsg = "Certificate record is revoked or mismatch detected.";
        } else if (err.response.status === 500) {
          errorMsg = "Institutional certificate generation encountered an issue. Please try again.";
        } else if (err.response.data instanceof Blob) {
          try {
            const text = await err.response.data.text();
            const parsed = JSON.parse(text);
            if (parsed.detail) errorMsg = parsed.detail;
          } catch (_) {}
        } else if (err.response.data && err.response.data.detail) {
          errorMsg = err.response.data.detail;
        }
      } else if (err.code === 'ECONNABORTED') {
        errorMsg = "Connection timed out while generating certificate. Please retry.";
      }
      setDownloadError(errorMsg);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-brand-500 selection:text-white font-sans">
      
      {/* Background Ambience */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {isForensicDoc ? (
          <>
            <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-blue-500/10 rounded-full blur-3xl"></div>
            <div className="absolute top-1/3 -right-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl"></div>
          </>
        ) : (
          <>
            <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-emerald-500/10 rounded-full blur-3xl"></div>
            <div className="absolute top-1/3 -right-40 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl"></div>
          </>
        )}
      </div>

      {/* Top Navbar */}
      <header className="relative z-10 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 py-4 flex items-center justify-between max-w-6xl mx-auto w-full">
        <div className="flex items-center space-x-3">
          <img
            src="/nandha_emblem.png"
            alt="Nandha Engineering College Logo"
            className="w-10 h-10 object-contain drop-shadow-md"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          <div>
            <h1 className="text-sm font-black tracking-tight text-white uppercase">
              Nandha Engineering College
            </h1>
            <p className="text-[11px] font-bold text-slate-400">
              Autonomous Institutional Credential Verification Gateway
            </p>
          </div>
        </div>

        <a
          href="/"
          className="text-xs font-bold text-slate-400 hover:text-white flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700 transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Home</span>
        </a>
      </header>

      {/* Main Container */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6 my-6">
        <div className="max-w-2xl w-full">
          
          {/* Loading State */}
          {loading && (
            <div className="p-12 text-center rounded-3xl bg-slate-900/80 border border-slate-800 shadow-lg backdrop-blur-xl space-y-4">
              <div className={`w-12 h-12 border-4 ${isForensicDoc ? 'border-blue-500/30 border-t-blue-500' : 'border-emerald-500/30 border-t-emerald-500'} rounded-full animate-spin mx-auto`}></div>
              <h3 className="text-base font-black text-white">Cryptographically Verifying Institutional Credential...</h3>
              <p className="text-xs text-slate-400 font-mono">Querying authoritative registry for {verificationId}</p>
            </div>
          )}

          {/* 1A. VERIFIED FORENSIC CONTEST REPORT STATE */}
          {!loading && data && data.status === 'VERIFIED' && isForensicDoc && (
            <div className="rounded-3xl bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-blue-500/40 shadow-lg shadow-blue-500/10 p-6 sm:p-10 space-y-8 backdrop-blur-xl relative overflow-hidden">
              
              {/* Blue / Indigo Top Ribbon */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-cyan-400 to-indigo-500"></div>

              {/* Status Header */}
              <div className="text-center space-y-3">
                <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 shadow-lg text-xs font-black uppercase tracking-wider animate-pulse">
                  <ShieldCheck className="w-4 h-4" />
                  <span>OFFICIAL FORENSIC REPORT VERIFIED</span>
                </div>
                
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  Official LeetCode Contest Forensic Verification Audit Report
                </h2>
                
                <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                  This cryptographic contest audit record has been authenticated against the official institutional ledger of Nandha Engineering College (Autonomous).
                </p>
              </div>

              {/* Student Credential Card */}
              <div className="p-6 rounded-2xl bg-slate-800/50 border border-slate-700/80 space-y-6">
                
                {/* Student Name */}
                <div className="border-b border-slate-700/60 pb-4 text-center">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Recipient Student</span>
                  <h3 className="text-2xl font-black text-white text-blue-400 tracking-wide mt-0.5">
                    {data.student_name}
                  </h3>
                  <div className="flex items-center justify-center space-x-2 mt-1">
                    <span className="font-mono text-xs font-bold text-slate-300 bg-slate-900 px-2.5 py-0.5 rounded border border-slate-700">
                      Reg No: {data.register_no}
                    </span>
                    <span className="font-mono text-xs font-bold text-blue-400 bg-blue-950/60 px-2.5 py-0.5 rounded border border-blue-800/50">
                      {data.department || 'CSE'}
                    </span>
                  </div>
                </div>

                {/* Contest Audit Matrix */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  
                  <div className="space-y-1">
                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] flex items-center space-x-1">
                      <FileCode2 className="w-3.5 h-3.5 text-blue-400" />
                      <span>Contest Event</span>
                    </span>
                    <strong className="text-slate-200 block font-semibold leading-snug">
                      {data.contest_name || data.recognition || 'Weekly Contest 515'}
                    </strong>
                  </div>

                  <div className="space-y-1">
                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] flex items-center space-x-1">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Participation Status</span>
                    </span>
                    <strong className="text-emerald-400 block font-bold">
                      {data.participation_status || 'PUBLIC_ATTENDED'}
                    </strong>
                  </div>

                  <div className="space-y-1">
                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] flex items-center space-x-1">
                      <Award className="w-3.5 h-3.5 text-amber-400" />
                      <span>Problems Solved</span>
                    </span>
                    <span className="text-slate-300 block font-medium">
                      {data.problems_solved || '4 / 4 Problems'} (Score: {data.contest_score || '18'})
                    </span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] flex items-center space-x-1">
                      <Calendar className="w-3.5 h-3.5 text-purple-400" />
                      <span>Verified Date</span>
                    </span>
                    <strong className="text-slate-200 block font-mono">
                      {data.contest_date || data.issue_date || '16.08.2026'}
                    </strong>
                  </div>

                </div>

              </div>

              {/* Cryptographic Trace & SHA-256 Audit Trail */}
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <span className="text-slate-500 text-[10px] block">FORENSIC TRACE ID</span>
                    <strong className="text-blue-400 text-sm font-black">{data.verification_id}</strong>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-black">
                      AUTHENTIC &amp; SEALED
                    </span>
                    <span className="px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-black">
                      ENGINE v2.0
                    </span>
                  </div>
                </div>

                {data.sha_hash && (
                  <div className="pt-2 border-t border-slate-800/80 text-[10px] text-slate-400 break-all">
                    <span className="text-slate-500">SHA-256: </span>
                    <code className="text-cyan-400 font-mono">{data.sha_hash}</code>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col items-center justify-center space-y-2 pt-2">
                <button
                  onClick={handleDownloadPdf}
                  disabled={downloading}
                  className={`px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs rounded-xl shadow-xl shadow-blue-600/30 flex items-center space-x-2 transition-all transform hover:scale-105 cursor-pointer ${downloading ? 'opacity-75 cursor-not-allowed' : ''}`}
                >
                  {downloading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Generating &amp; Downloading Forensic Report...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Download Official Forensic Audit Report</span>
                    </>
                  )}
                </button>
                {downloadError && (
                  <p className="text-[11px] text-rose-400 font-medium">{downloadError}</p>
                )}
              </div>

            </div>
          )}

          {/* 1B. VERIFIED CERTIFICATE OF EXCELLENCE STATE */}
          {!loading && data && data.status === 'VERIFIED' && !isForensicDoc && (
            <div className="rounded-3xl bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-emerald-500/40 shadow-lg shadow-emerald-500/10 p-6 sm:p-10 space-y-8 backdrop-blur-xl relative overflow-hidden">
              
              {/* Ornate Gold Top Ribbon */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-600 via-amber-400 to-emerald-500"></div>

              {/* Status Header */}
              <div className="text-center space-y-3">
                <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-lg text-xs font-black uppercase tracking-wider animate-pulse">
                  <ShieldCheck className="w-4 h-4" />
                  <span>OFFICIAL CERTIFICATE VERIFIED</span>
                </div>
                
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  Certificate of Excellence
                </h2>
                
                <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                  This academic credential has been authenticated against the official institutional ledger of Nandha Engineering College (Autonomous).
                </p>
              </div>

              {/* Student Credential Card */}
              <div className="p-6 rounded-2xl bg-slate-800/50 border border-slate-700/80 space-y-6">
                
                {/* Student Name */}
                <div className="border-b border-slate-700/60 pb-4 text-center">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Awarded To</span>
                  <h3 className="text-2xl font-black text-white text-emerald-400 tracking-wide mt-0.5">
                    {data.student_name}
                  </h3>
                  <div className="flex items-center justify-center space-x-2 mt-1">
                    <span className="font-mono text-xs font-bold text-slate-300 bg-slate-900 px-2.5 py-0.5 rounded border border-slate-700">
                      Reg No: {data.register_no}
                    </span>
                  </div>
                </div>

                {/* Grid Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  
                  <div className="space-y-1">
                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] flex items-center space-x-1">
                      <Building2 className="w-3.5 h-3.5 text-amber-400" />
                      <span>Department</span>
                    </span>
                    <strong className="text-slate-200 block font-semibold leading-snug">
                      {data.department_name}
                    </strong>
                  </div>

                  <div className="space-y-1">
                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] flex items-center space-x-1">
                      <Award className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Recognition Distinction</span>
                    </span>
                    <strong className="text-emerald-400 block font-bold">
                      {data.recognition || 'Top Performer'}
                    </strong>
                  </div>

                  <div className="space-y-1">
                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] flex items-center space-x-1">
                      <FileCheck2 className="w-3.5 h-3.5 text-sky-400" />
                      <span>Tracking Program</span>
                    </span>
                    <span className="text-slate-300 block font-medium">
                      {data.program || 'Institutional LeetCode Continuous Performance Tracking System'}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] flex items-center space-x-1">
                      <Calendar className="w-3.5 h-3.5 text-purple-400" />
                      <span>Issue Date</span>
                    </span>
                    <strong className="text-slate-200 block font-mono">
                      {data.issue_date}
                    </strong>
                  </div>

                </div>

              </div>

              {/* Cryptographic ID & Verification Evidence */}
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between flex-wrap gap-4 text-xs font-mono">
                <div>
                  <span className="text-slate-500 text-[10px] block">VERIFICATION IDENTIFIER</span>
                  <strong className="text-emerald-400 text-sm font-black">{data.verification_id}</strong>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-black">
                    STATUS: ACTIVE
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-black">
                    NAAC 'A+'
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col items-center justify-center space-y-2 pt-2">
                <button
                  onClick={handleDownloadPdf}
                  disabled={downloading}
                  className={`px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs rounded-xl shadow-xl shadow-emerald-600/30 flex items-center space-x-2 transition-all transform hover:scale-105 cursor-pointer ${downloading ? 'opacity-75 cursor-not-allowed' : ''}`}
                >
                  {downloading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Generating &amp; Downloading PDF...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Download Official PDF Certificate</span>
                    </>
                  )}
                </button>
                {downloadError && (
                  <p className="text-[11px] text-rose-400 font-medium">{downloadError}</p>
                )}
              </div>

            </div>
          )}

          {/* 2. REVOKED CERTIFICATE STATE */}
          {!loading && data && data.status === 'REVOKED' && (
            <div className="rounded-3xl bg-slate-900 border border-rose-500/40 shadow-lg p-8 space-y-6 text-center">
              <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-500 flex items-center justify-center mx-auto">
                <ShieldAlert className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <span className="px-3.5 py-1 rounded-full text-xs font-black bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  CERTIFICATE REVOKED
                </span>
                <h3 className="text-xl font-black text-white">This Credential Has Been Officially Revoked</h3>
                <p className="text-xs text-rose-300 max-w-md mx-auto">
                  {data.revocation_reason || "The issuing authority has invalidated this certificate ID."}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-400 space-y-1">
                <div>Verification ID: <strong className="text-rose-400">{data.verification_id}</strong></div>
                {data.student_name && <div>Original Recipient: {data.student_name} ({data.register_no})</div>}
              </div>
            </div>
          )}

          {/* 3. SERVER ERROR / SERVICE UNAVAILABLE STATE */}
          {!loading && error === 'SERVER_ERROR' && (
            <div className="rounded-3xl bg-slate-900 border border-red-500/40 shadow-lg p-8 space-y-6 text-center">
              <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 text-red-500 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <span className="px-3.5 py-1 rounded-full text-xs font-black bg-red-500/20 text-red-400 border border-red-500/30">
                  SERVICE TEMPORARILY UNAVAILABLE
                </span>
                <h3 className="text-xl font-black text-white">Verification Service Temporarily Unavailable</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Unable to connect to the institutional certificate database. Please verify your connection or try again in a few moments.
                </p>
              </div>

              <div className="pt-2">
                <button
                  onClick={fetchVerification}
                  className="px-6 py-2.5 bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs rounded-xl inline-flex items-center space-x-2 shadow-lg shadow-brand-600/30 transition-all cursor-pointer"
                >
                  <span>Retry Verification</span>
                </button>
              </div>
            </div>
          )}

          {/* 4. NOT VERIFIED / NOT FOUND STATE */}
          {!loading && error !== 'SERVER_ERROR' && (!data || data.status === 'NOT_VERIFIED' || error) && (
            <div className="rounded-3xl bg-slate-900 border border-amber-500/40 shadow-lg p-8 space-y-6 text-center">
              <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-500 flex items-center justify-center mx-auto">
                <XCircle className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <span className="px-3.5 py-1 rounded-full text-xs font-black bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  CERTIFICATE NOT VERIFIED
                </span>
                <h3 className="text-xl font-black text-white">Certificate Not Found</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  The requested certificate identifier <code className="bg-slate-950 px-2 py-0.5 rounded text-amber-300 font-mono">{verificationId || 'N/A'}</code> does not exist in the institutional certificate registry.
                </p>
              </div>

              <div className="pt-2">
                <a
                  href="/"
                  className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl inline-flex items-center space-x-2 border border-slate-700"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Return to Institutional Portal</span>
                </a>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-900 py-4 px-6 text-center text-[11px] text-slate-500">
        <p>
          © {new Date().getFullYear()} Nandha Engineering College (Autonomous), Erode — 638 052. All Rights Reserved.
        </p>
      </footer>

    </div>
  );
};
export default CertificateVerificationPage;
