/**
 * authContextDef.ts — Defines AuthContext and useAuth hook.
 * Kept separate from AuthProvider (AuthContext.tsx) to satisfy Vite Fast Refresh
 * "consistent-components-exports" requirement.
 */
import { createContext, useContext } from 'react';
import { AuthContextType } from '../services/auth/authTypes';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
