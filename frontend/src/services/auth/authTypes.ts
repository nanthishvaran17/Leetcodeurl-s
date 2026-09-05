export type AuthState =
  | 'INITIALIZING'
  | 'UNAUTHENTICATED'
  | 'AUTHENTICATING'
  | 'AUTHENTICATED_PENDING_BACKEND'
  | 'AUTHORIZED'
  | 'AUTH_ERROR'
  | 'SESSION_EXPIRED'
  | 'UNAUTHORIZED'
  | 'NETWORK_ERROR';

export interface AuthUser {
  uid: string;
  name: string;
  email: string;
  photoURL?: string;
  role: 'student' | 'staff' | 'admin' | 'Super Admin' | 'hod' | 'faculty' | string;
  registerNo?: string | null;
  department?: string | null;
  department_id?: number | null;
  section_id?: number | null;
  year?: string | null;
  section?: string | null;
  leetcodeUsername?: string | null;
  isProfileLinked: boolean;
  id?: number;
  username?: string;
}

export interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  authState: AuthState;
  authError: string | null;
  authNotice: string | null;
  login: (token: string, user: any) => void;
  signInWithGoogle: () => Promise<void>;
  sendOtp: (email: string) => Promise<any>;
  verifyOtp: (email: string, otp: string) => Promise<any>;
  logout: () => Promise<void>;
  clearAuthError: () => void;
  isAuthenticated: boolean;
}
