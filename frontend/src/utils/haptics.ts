/**
 * Native Haptic Feedback Utility
 * Provides tactile vibration feedback on Android Native (Capacitor APK)
 * and mobile browsers via navigator.vibrate.
 */

export type HapticFeedbackType = 
  | 'light' 
  | 'medium' 
  | 'heavy' 
  | 'selection' 
  | 'success' 
  | 'warning' 
  | 'error';

export const triggerHaptic = (type: HapticFeedbackType = 'light'): void => {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      switch (type) {
        case 'light':
        case 'selection':
          navigator.vibrate(12);
          break;
        case 'medium':
          navigator.vibrate(22);
          break;
        case 'heavy':
          navigator.vibrate(40);
          break;
        case 'success':
          navigator.vibrate([12, 45, 18]);
          break;
        case 'warning':
          navigator.vibrate([20, 50, 25]);
          break;
        case 'error':
          navigator.vibrate([30, 60, 30, 60, 40]);
          break;
        default:
          navigator.vibrate(12);
      }
    }
  } catch (_err) {
    // Graceful fallback on devices/browsers without vibration hardware/permissions
  }
};
