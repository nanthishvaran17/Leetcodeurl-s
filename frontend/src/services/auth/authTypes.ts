export type AuthState =
  | 'INITIALIZING'
  | 'AUTH_INITIALIZING'
  | 'AUTH_REDIRECT_PROCESSING'
  | 'UNAUTHENTICATED'
  | 'AUTH_UNAUTHENTICATED'
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
  /** HOD multi-department scope: list of department IDs this HOD is authorized to access.
   *  Empty array means global access (for Admin/Principal/Management roles). */
  authorized_department_ids?: number[];
  /** Corresponding department codes for the above IDs (e.g. ["CSE", "IT"]) */
  authorized_department_codes?: string[];
}

// Role type-guard helpers
export function isHodRole(user: AuthUser | null): boolean {
  if (!user) return false;
  const r = (user.role || '').trim().toLowerCase();
  return r === 'hod' || r === 'department hod' || r === 'department_hod';
}

export function isGlobalAccessRole(user: AuthUser | null): boolean {
  if (!user) return false;
  const r = (user.role || '').trim().toLowerCase();
  return ['admin', 'administrator', 'super admin', 'super_admin', 'principal', 'management'].includes(r);
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
  /** true when current user is HOD role */
  isHodScoped: boolean;
  /** true when current user has global (all-department) access */
  isGlobalAccess: boolean;
  /** HOD's authorized department IDs, or [] for global-access roles */
  authorizedDepartmentIds: number[];
  /** HOD's authorized department codes, or [] for global-access roles */
  authorizedDepartmentCodes: string[];
}
