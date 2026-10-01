import React from 'react';
import { AccountProfileSettings } from '../components/AccountProfileSettings';

export const AccountSettingsPage: React.FC = () => {
  return (
    <div className="pb-16 text-xs text-slate-800 dark:text-slate-200 animate-fade-in w-full px-2 sm:px-4 pt-2">
      <AccountProfileSettings />
    </div>
  );
};

export default AccountSettingsPage;
