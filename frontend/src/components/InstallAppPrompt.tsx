import React, { useState, useEffect } from 'react';
import { Download, Smartphone, X, Check, Share, PlusSquare, ShieldCheck, Zap } from 'lucide-react';

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
  const [downloadStarted, setDownloadStarted] = useState(false);

  useEffect(() => {
    // 1. Check if running in standalone mode (PWA installed)
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
      if (daysSinceDismissed < 3) {
        return; // Don't prompt again within 3 days
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

    // 6. Manual trigger listener from UI (e.g. Sidebar / Settings)
    const handleManualShow = () => {
      setIsVisible(true);
    };
    window.addEventListener('show-pwa-install', handleManualShow);

    // Show prompt automatically after 4 seconds on mobile browsers
    const isMobileDevice = /android|iphone|ipad|ipod/.test(ua);
    if (isMobileDevice && !isStandalone) {
      const timer = setTimeout(() => setIsVisible(true), 4000);
      return () => clearTimeout(timer);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('show-pwa-install', handleManualShow);
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

  const handleDownloadApk = () => {
    setDownloadStarted(true);
    const link = document.createElement('a');
    link.href = '/nandha-leetcode.apk';
    link.download = 'Nandha_LeetCode_Intelligence_v3.1.8_latest.apk';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => setDownloadStarted(false), 5000);
  };

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem('pwa_prompt_dismissed_at', Date.now().toString());
  };

  if (!isVisible || isStandalone || isInstalled) {
    return null;
  }

  return (
    <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] sm:bottom-6 left-3 right-3 sm:left-auto sm:right-6 sm:max-w-md z-50 animate-slide-up">
      <div className="bg-slate-900/95 dark:bg-navy-950/95 backdrop-blur-xl border border-indigo-500/30 rounded-3xl p-4 sm:p-5 shadow-2xl text-white relative ring-1 ring-white/10">
        <button
          onClick={handleDismiss}
          className="absolute top-3.5 right-3.5 text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800/80 transition-colors cursor-pointer"
          title="Close"
          aria-label="Close app install banner"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start space-x-3.5 pr-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-0.5 shadow-lg shadow-indigo-500/20 flex-shrink-0">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              <Smartphone className="w-6 h-6 text-indigo-400" />
            </div>
          </div>

          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-black text-white tracking-tight">
                Nandha LeetCode Mobile
              </h4>
              <span className="px-2 py-0.5 text-[9.5px] font-black rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                v3.1.8 APK
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-medium">
              {isIOS
                ? 'Add to your iPhone Home Screen for instant 0ms access & full-screen contest telemetry.'
                : 'Direct 1-tap download for Android. Faster loading, offline caching, and instant alerts.'}
            </p>
          </div>
        </div>

        {/* Feature Highlights Badges */}
        <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center gap-3 text-[10.5px] text-slate-400 font-semibold">
          <span className="flex items-center gap-1 text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" /> Verified Safe
          </span>
          <span className="flex items-center gap-1 text-indigo-300">
            <Zap className="w-3.5 h-3.5" /> 17 MB • Instant Install
          </span>
        </div>

        {isIOS ? (
          <div className="mt-3 pt-2 border-t border-slate-800/80 text-xs text-slate-300 space-y-2">
            <div className="flex items-center space-x-2 text-indigo-300 font-bold">
              <Share className="w-4 h-4 shrink-0" />
              <span>1. Tap Share in Safari browser toolbar</span>
            </div>
            <div className="flex items-center space-x-2 text-slate-300 font-medium">
              <PlusSquare className="w-4 h-4 shrink-0 text-slate-400" />
              <span>2. Select "Add to Home Screen"</span>
            </div>
          </div>
        ) : (
          <div className="mt-3.5 flex flex-wrap items-center justify-end gap-2">
            {/* Direct Android APK Download Button */}
            <button
              type="button"
              onClick={handleDownloadApk}
              className="flex-1 sm:flex-initial px-4 py-2.5 bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl font-extrabold text-xs shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center space-x-2 active:scale-95 cursor-pointer"
            >
              {downloadStarted ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300" />
                  <span>Downloading APK...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Download APK (17MB)</span>
                </>
              )}
            </button>

            {/* PWA Install Button (If browser supports BeforeInstallPrompt) */}
            {deferredPrompt && (
              <button
                type="button"
                onClick={handleInstallClick}
                className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl font-bold text-xs transition-all flex items-center justify-center space-x-1.5 active:scale-95 cursor-pointer"
              >
                <Smartphone className="w-3.5 h-3.5 text-indigo-400" />
                <span>Install PWA</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default InstallAppPrompt;
