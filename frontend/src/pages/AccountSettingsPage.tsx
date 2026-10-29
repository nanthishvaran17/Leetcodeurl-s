import React from 'react';
import { AccountProfileSettings } from '../components/AccountProfileSettings';
import { ShieldCheck, UserCheck, Lock, ChevronRight, ArrowLeft } from 'lucide-react';

export const AccountSettingsPage: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  return (
    <div className="relative min-h-screen w-full pb-32 sm:pb-20 text-slate-900 dark:text-slate-100 animate-fade-in">
      {/* Dynamic Ambient Background Glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand-500/10 dark:bg-brand-500/15 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-48 right-10 w-80 h-80 bg-indigo-500/10 dark:bg-indigo-500/15 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-20 left-10 w-96 h-96 bg-purple-500/5 dark:bg-purple-500/10 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="w-full px-0 sm:px-4 lg:px-6 pt-0 sm:pt-5">
        {/* Main Profile & Settings Engine with Native UI matching mockup */}
        <AccountProfileSettings onBack={onBack} />
      </div>
    </div>
  );
};

export default AccountSettingsPage;
