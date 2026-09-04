import React, { useState, useEffect } from 'react';
import { Download, Smartphone, X, Check, Share, PlusSquare } from 'lucide-react';
import { getApiUrl } from '../services/api';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export const InstallAppPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // 1. Check if already running in standalone mode (PWA installed & opened)
    const checkStandalone = () => {
      const standalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://');
      setIsStandalone(standalone);
    };

    checkStandalone();

    // 2. Detect iOS
    const ua = window.navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(ua);
    setIsIOS(ios);

    // 3. Check dismiss storage
    const dismissedAt = localStorage.getItem('pwa_prompt_dismissed_at');
    if (dismissedAt) {
      const daysSinceDismissed = (Date.now() - parseInt(dismissedAt, 10)) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 7) {
        return; // Don't prompt again within 7 days
      }
    }

    // 4. Capture standard Chrome/Android/Edge beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 5. Detect app installed event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsVisible(false);
      setDeferredPrompt(null);
    };
    window.addEventListener('appinstalled', handleAppInstalled);

    // Show prompt for iOS if not in standalone
    if (ios && !isStandalone) {
      // Delay prompt on iOS by 3 seconds for smooth UX
      const timer = setTimeout(() => setIsVisible(true), 3000);
      return () => clearTimeout(timer);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [isStandalone]);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setIsVisible(false);
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem('pwa_prompt_dismissed_at', Date.now().toString());
  };

  if (!isVisible || isStandalone || isInstalled) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 animate-slide-up">
      <div className="bg-slate-900/95 dark:bg-navy-950/95 backdrop-blur-md border border-brand-500/30 rounded-2xl p-4 shadow-2xl text-white relative">
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          title="Close"
          aria-label="Close app install banner"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start space-x-3.5 pr-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-500 to-cyan-600 p-0.5 shadow-lg flex-shrink-0">
            <div className="w-full h-full bg-slate-900 rounded-[10px] flex items-center justify-center">
              <Smartphone className="w-6 h-6 text-brand-400" />
            </div>
          </div>

          <div className="space-y-1">
            <h4 className="text-sm font-black text-white flex items-center gap-1.5">
              <span>Install NEC LeetCode App</span>
              <span className="px-1.5 py-0.2 text-[9px] font-black rounded bg-brand-500/20 text-brand-400 border border-brand-500/30">
                PWA
              </span>
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              {isIOS
                ? 'Add to your iPhone / iPad home screen for full-screen monitoring and fast access.'
                : 'Install as a lightweight app on your phone or desktop for quick access and offline status.'}
            </p>
          </div>
        </div>

        {isIOS ? (
          <div className="mt-3 pt-3 border-t border-slate-800 text-xs text-slate-300 space-y-1.5">
            <div className="flex items-center space-x-2 text-brand-300 font-semibold">
              <Share className="w-4 h-4" />
              <span>Tap Share button in Safari browser toolbar</span>
            </div>
            <div className="flex items-center space-x-2 text-slate-400">
              <PlusSquare className="w-4 h-4" />
              <span>Select "Add to Home Screen"</span>
            </div>
          </div>
        ) : (
          <div className="mt-3.5 flex flex-wrap items-center justify-end gap-2">
            {deferredPrompt && (
              <button
                onClick={handleInstallClick}
                className="px-4 py-2 bg-gradient-to-r from-brand-500 to-cyan-500 hover:from-brand-600 hover:to-cyan-600 text-white rounded-xl font-bold text-xs shadow-lg shadow-brand-500/25 transition-all flex items-center space-x-1.5 active:scale-95 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Install PWA</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
