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
  Sparkles
} from 'lucide-react';
import api from '../services/api';
import { fetchCertificateFromFirestoreWeb } from '../services/firebaseSync';

interface CertificateVerificationData {
  status: 'VERIFIED' | 'REVOKED' | 'NOT_VERIFIED';
  is_valid: boolean;
  verification_id: string;
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
}

export const CertificateVerificationPage: React.FC<{ verificationId?: string }> = ({ verificationId: propId }) => {
  const pathId = typeof window !== 'undefined' && window.location.pathname.startsWith('/verify/')
    ? window.location.pathname.replace('/verify/', '').split('/')[0].trim()
    : '';
  const verificationId = propId || pathId;
  const [data, setData] = useState<CertificateVerificationData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!verificationId) {
      setLoading(false);
      setError("No verification ID provided.");
      return;
    }
    fetchVerification();
  }, [verificationId]);

  const fetchVerification = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Primary: Authoritative Backend API
      const res = await api.get(`/certificates/verify/${verificationId}`);
      if (res.data && res.data.status) {
        setData(res.data);
        return;
      }
    } catch (err: any) {
      console.debug("Backend lookup note, attempting Cloud Firestore fallback:", err);
    }

    try {
      // 2. Secondary High-Availability Fallback: Cloud Firestore
      const firestoreCert = await fetchCertificateFromFirestoreWeb(verificationId);
      if (firestoreCert) {
        setData(firestoreCert as CertificateVerificationData);
        return;
      }
    } catch (firestoreErr) {
      console.debug("Firestore lookup error:", firestoreErr);
    }

    // Default Not Found State
    setData({
      status: 'NOT_VERIFIED',
      is_valid: false,
      verification_id: verificationId,
      message: 'Verification Code Not Found'
    });
    setLoading(false);
  };

  const handleDownloadPdf = () => {
    if (!verificationId) return;
    const baseApi = import.meta.env.VITE_API_URL || '';
    window.open(`${baseApi}/api/certificates/${verificationId}/download-pdf`, '_blank');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-brand-500 selection:text-white font-sans">
      
      {/* Background Ambience */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-emerald-500/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/3 -right-40 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl"></div>
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
            <div className="p-12 text-center rounded-3xl bg-slate-900/80 border border-slate-800 shadow-2xl backdrop-blur-xl space-y-4">
              <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto"></div>
              <h3 className="text-base font-black text-white">Cryptographically Verifying Institutional Certificate...</h3>
              <p className="text-xs text-slate-400 font-mono">Querying authoritative registry for {verificationId}</p>
            </div>
          )}

          {/* 1. VERIFIED CERTIFICATE STATE */}
          {!loading && data && data.status === 'VERIFIED' && (
            <div className="rounded-3xl bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-emerald-500/40 shadow-2xl shadow-emerald-500/10 p-6 sm:p-10 space-y-8 backdrop-blur-xl relative overflow-hidden">
              
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
                      ★ {data.recognition}
                    </strong>
                  </div>

                  <div className="space-y-1">
                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] flex items-center space-x-1">
                      <FileCheck2 className="w-3.5 h-3.5 text-sky-400" />
                      <span>Tracking Program</span>
                    </span>
                    <span className="text-slate-300 block font-medium">
                      {data.program}
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
              <div className="flex items-center justify-center space-x-3 pt-2">
                <button
                  onClick={handleDownloadPdf}
                  className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs rounded-xl shadow-xl shadow-emerald-600/30 flex items-center space-x-2 transition-all transform hover:scale-105 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Official PDF Certificate</span>
                </button>
              </div>

            </div>
          )}

          {/* 2. REVOKED CERTIFICATE STATE */}
          {!loading && data && data.status === 'REVOKED' && (
            <div className="rounded-3xl bg-slate-900 border border-rose-500/40 shadow-2xl p-8 space-y-6 text-center">
              <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-500 flex items-center justify-center mx-auto">
                <ShieldAlert className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <span className="px-3.5 py-1 rounded-full text-xs font-black bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  ❌ CERTIFICATE REVOKED
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

          {/* 3. NOT VERIFIED / INVALID ID STATE */}
          {!loading && (!data || data.status === 'NOT_VERIFIED' || error) && (
            <div className="rounded-3xl bg-slate-900 border border-amber-500/40 shadow-2xl p-8 space-y-6 text-center">
              <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-500 flex items-center justify-center mx-auto">
                <XCircle className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <span className="px-3.5 py-1 rounded-full text-xs font-black bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  ❌ CERTIFICATE NOT VERIFIED
                </span>
                <h3 className="text-xl font-black text-white">Verification Code Not Found</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  The requested certificate identifier <code>{verificationId}</code> does not exist in the institutional registry or is malformed.
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
