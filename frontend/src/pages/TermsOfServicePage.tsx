import React from 'react';
import { Scale, FileSignature, AlertCircle, RefreshCw, Mail } from 'lucide-react';

export const TermsOfServicePage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-navy-900 relative overflow-hidden selection:bg-brand-500/30">
      
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-full pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl opacity-50 dark:opacity-20 animate-pulse-slow"></div>
        <div className="absolute bottom-40 -left-20 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl opacity-50 dark:opacity-20 animate-pulse-slow" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
        
        {/* Header Section */}
        <div className="text-center space-y-6 mb-16">
          <div className="inline-flex items-center justify-center p-4 bg-slate-200 dark:bg-navy-800 rounded-3xl shadow-inner mb-2">
            <Scale className="w-10 h-10 text-slate-700 dark:text-slate-300" />
          </div>
          <h1 className="text-4xl lg:text-5xl font-display font-extrabold text-slate-900 dark:text-white tracking-tight">
            Terms of <span className="text-transparent bg-clip-text bg-gradient-to-r from-slate-600 to-brand-600 dark:from-slate-400 dark:to-brand-400">Service</span>
          </h1>
          <p className="text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Please read these terms carefully before accessing the Nandha LeetCode Intelligence platform. By authenticating, you agree to these operational conditions.
          </p>
        </div>

        {/* Content Container (Glassmorphism) */}
        <div className="bg-white/80 dark:bg-navy-950/80 backdrop-blur-xl rounded-3xl shadow-xl border border-slate-200/50 dark:border-navy-800/50 p-8 md:p-12 space-y-12">
          
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl shrink-0 mt-1">
              <FileSignature className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">1. Acceptance of Terms</h2>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-base">
                By accessing, browsing, or utilizing this intelligence platform, you explicitly agree to be bound by these Terms of Service. If you do not agree with any part of these provisions, you must immediately revoke your OAuth authorization and cease using the platform.
              </p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl shrink-0 mt-1">
              <AlertCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">2. Description of Service & Purpose</h2>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-base">
                The Nandha LeetCode Tracker operates as an institutional analytics hub. It aggregates public LeetCode problem-solving telemetry, ranks cohort performance, and generates automated risk-reports for faculty evaluation. The service is strictly for academic monitoring and skill development.
              </p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="p-3 bg-rose-50 dark:bg-rose-900/20 rounded-2xl shrink-0 mt-1">
              <Scale className="w-6 h-6 text-rose-600 dark:text-rose-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">3. Code of Conduct & Integrity</h2>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-base">
                You are required to link your authentic LeetCode username. Any attempt to map false accounts, exploit synchronization protocols, or engage in academic dishonesty (e.g., automated submission bots) will be flagged by our <strong>Contest Integrity Engine</strong> and reported directly to the administration.
              </p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="p-3 bg-slate-100 dark:bg-navy-800 rounded-2xl shrink-0 mt-1">
              <RefreshCw className="w-6 h-6 text-slate-600 dark:text-slate-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">4. Platform Modifications</h2>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-base">
                We reserve the absolute right to modify, pause, or permanently discontinue any feature of the service (including sync intervals and historical analytics) without prior notice to individual users. Core operational decisions remain at the discretion of the HOD and platform administrators.
              </p>
            </div>
          </div>

          <div className="my-8 border-t border-slate-100 dark:border-navy-800"></div>

          <div className="bg-slate-50 dark:bg-navy-900/50 rounded-2xl p-8 border border-slate-100 dark:border-navy-800 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Legal or Account Inquiries?</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Contact the primary administrator regarding terms.</p>
            </div>
            <a href="mailto:nanthishvaran17@gmail.com" className="inline-flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-900 dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 text-white font-bold rounded-xl transition-all shadow-md">
              <Mail className="w-4 h-4" />
              nanthishvaran17@gmail.com
            </a>
          </div>

        </div>
      </div>
    </div>
  );
};
