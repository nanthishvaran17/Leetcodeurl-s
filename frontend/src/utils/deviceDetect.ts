/**
 * Ultra-lightweight device detection utilities with zero external dependencies.
 * Prevents dragging heavy SDKs (like Firebase) into the initial bundle.
 */

/** Check whether running inside native Android/iOS Capacitor container */
export const isNativeMobile = (): boolean => {
  try {
    // @ts-ignore — window.Capacitor is injected by native runtime bridge
    return !!(window?.Capacitor?.isNativePlatform?.());
  } catch {
    return false;
  }
};

/** Check whether running in a mobile web browser (e.g. Chrome on Android, Safari on iOS) */
export const isMobileBrowser = (): boolean => {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || navigator.vendor || (window as any).opera || '';
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isTouchScreen = ('ontouchstart' in window) || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0);
  const isSmallScreen = window.innerWidth <= 768;
  return isMobileUA || (isTouchScreen && isSmallScreen);
};

/** Detect common in-app browsers that block OAuth (Instagram, FB, LinkedIn, TikTok, etc.) */
export const isInAppBrowser = (): boolean => {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || navigator.vendor || (window as any).opera || '';
  return /FBAN|FBAV|Instagram|LinkedInApp|Line\/|Snapchat|Musical_ly|TikTok|Bytedance|MicroMessenger|WeChat/i.test(ua);
};
