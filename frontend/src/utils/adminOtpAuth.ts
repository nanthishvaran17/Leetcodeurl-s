/**
 * Utility to verify whether the active session was authenticated
 * strictly via the /admin portal with Username, Password, and 2FA OTP verification.
 * 
 * Developer Studio is restricted exclusively to sessions with verified admin OTP.
 */

export const ADMIN_OTP_VERIFIED_KEY = 'admin_otp_verified';

export const isAdminOtpVerified = (): boolean => {
  if (typeof window === 'undefined') return false;

  try {
    // 1. Check in-memory/tab session storage
    if (sessionStorage.getItem(ADMIN_OTP_VERIFIED_KEY) === 'true') {
      return true;
    }

    // 2. Check local storage persistent flag
    if (localStorage.getItem(ADMIN_OTP_VERIFIED_KEY) === 'true') {
      return true;
    }

    // 3. Inspect JWT token claims
    const token = localStorage.getItem('token') || localStorage.getItem('access_token');
    if (token && typeof token === 'string' && token.split('.').length === 3) {
      try {
        const payloadBase64 = token.split('.')[1];
        if (payloadBase64) {
          let b64 = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
          while (b64.length % 4) b64 += '=';
          const payloadJson = atob(b64);
          const payload = JSON.parse(payloadJson);
          if (payload?.admin_otp_verified === true) {
            // Re-sync storage flags
            sessionStorage.setItem(ADMIN_OTP_VERIFIED_KEY, 'true');
            localStorage.setItem(ADMIN_OTP_VERIFIED_KEY, 'true');
            return true;
          }
        }
      } catch {
        // Ignore JWT parse error
      }
    }

    // 4. Check cached user object
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user?.admin_otp_verified === true) {
          return true;
        }
      } catch {
        // Ignore user parse error
      }
    }

    return false;
  } catch {
    return false;
  }
};

export const setAdminOtpVerified = (verified: boolean = true) => {
  if (typeof window === 'undefined') return;
  try {
    if (verified) {
      sessionStorage.setItem(ADMIN_OTP_VERIFIED_KEY, 'true');
      localStorage.setItem(ADMIN_OTP_VERIFIED_KEY, 'true');
    } else {
      sessionStorage.removeItem(ADMIN_OTP_VERIFIED_KEY);
      localStorage.removeItem(ADMIN_OTP_VERIFIED_KEY);
    }
  } catch {}
};

export const clearAdminOtpVerification = () => {
  setAdminOtpVerified(false);
};
