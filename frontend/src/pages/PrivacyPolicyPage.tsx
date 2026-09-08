import React from 'react';
import { Shield } from 'lucide-react';

export const PrivacyPolicyPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-navy-900 relative overflow-hidden selection:bg-brand-500/30">

      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-full pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl opacity-50 dark:opacity-20 animate-pulse-slow"></div>
        <div className="absolute top-40 -left-20 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl opacity-50 dark:opacity-20 animate-pulse-slow" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">

        {/* Header Section */}
        <div className="text-center space-y-6 mb-16">
          <div className="inline-flex items-center justify-center p-4 bg-brand-50 dark:bg-brand-950/40 rounded-3xl border border-brand-100 dark:border-brand-900 shadow-inner mb-2">
            <Shield className="w-10 h-10 text-brand-600 dark:text-brand-400" />
          </div>
          <h1 className="text-4xl lg:text-5xl font-display font-extrabold text-slate-900 dark:text-white tracking-tight">
            Privacy Policy - Nandha Intelligence
          </h1>
          <p className="text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
            <strong>Last Updated:</strong> September 8, 2026
          </p>
        </div>

        {/* Content Container (Glassmorphism) */}
        <div className="bg-white/80 dark:bg-navy-950/80 backdrop-blur-xl rounded-3xl shadow-xl border border-slate-200/50 dark:border-navy-800/50 p-8 md:p-12 space-y-8 prose prose-slate dark:prose-invert max-w-none">

          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-0">1. Information We Collect</h2>
          <p className="text-slate-600 dark:text-slate-400">We collect the following information from users who sign in with Google:</p>
          <ul className="text-slate-600 dark:text-slate-400 space-y-2">
            <li><strong>Email Address:</strong> To uniquely identify you and track your progress</li>
            <li><strong>Name:</strong> To display on leaderboards and profiles</li>
            <li><strong>Profile Picture:</strong> To display on leaderboards</li>
            <li><strong>LeetCode Data:</strong> Your submissions, contest history, and solved problems</li>
          </ul>

          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">2. How We Use Your Information</h2>
          <ul className="text-slate-600 dark:text-slate-400 space-y-2">
            <li>Authenticate you to the platform</li>
            <li>Track your LeetCode progress over time</li>
            <li>Display rankings on leaderboards</li>
            <li>Generate performance reports for faculty</li>
          </ul>

          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">3. Data Storage</h2>
          <p className="text-slate-600 dark:text-slate-400">Your data is stored securely in our database. Only authorized faculty and administrators have access to aggregated data.</p>

          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">4. Data Sharing</h2>
          <p className="text-slate-600 dark:text-slate-400">We do NOT sell or share your personal data with third parties. Your progress data may be visible to faculty and other students through the leaderboard.</p>

          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">5. Your Rights</h2>
          <ul className="text-slate-600 dark:text-slate-400 space-y-2">
            <li>You can request deletion of your account and data at any time</li>
            <li>You can opt out of leaderboard visibility</li>
            <li>You can access all data we store about you</li>
          </ul>

          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">6. Contact Us</h2>
          <p className="text-slate-600 dark:text-slate-400">Email: <a href="mailto:nanthishvaran17@gmail.com
          " className="text-brand-600 hover:text-brand-700 dark:text-brand-400">nanthishvaran17@gmail.com</a></p>
          <p className="text-slate-600 dark:text-slate-400">Address: Nandha Engineering College (Autonomous), Erode, Tamil Nadu</p>

          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">7. Changes to Privacy Policy</h2>
          <p className="text-slate-600 dark:text-slate-400">We may update this policy periodically. We will notify users of any significant changes.</p>

        </div>
      </div>
    </div>
  );
};
