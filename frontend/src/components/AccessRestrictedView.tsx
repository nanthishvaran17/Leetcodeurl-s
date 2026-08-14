import React from 'react';
import { Lock, ArrowLeft, LogIn } from 'lucide-react';

interface AccessRestrictedViewProps {
  resourceName?: string;
  onGoBack: () => void;
  onOpenLogin: () => void;
}

export const AccessRestrictedView: React.FC<AccessRestrictedViewProps> = ({
  resourceName = "this institutional resource",
  onGoBack,
  onOpenLogin
}) => {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-navy-900 border border-gray-200 dark:border-navy-700 rounded-2xl p-8 text-center shadow-xl">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner">
          <Lock className="w-8 h-8" />
        </div>

        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">
          🔒 Access Restricted
        </h2>

        <p className="text-gray-600 dark:text-gray-300 mb-8 text-sm leading-relaxed">
          You do not have permission to access {resourceName}.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={onGoBack}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-navy-800 dark:hover:bg-navy-700 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-xl transition-all duration-200"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>

          <button
            onClick={onOpenLogin}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-navy-600 hover:bg-navy-700 text-white text-sm font-medium rounded-xl shadow-md hover:shadow-lg transition-all duration-200"
          >
            <LogIn className="w-4 h-4" />
            Sign In / Switch Account
          </button>
        </div>
      </div>
    </div>
  );
};
