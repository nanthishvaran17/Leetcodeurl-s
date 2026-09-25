/**
 * AuthContext.ts — Barrel re-export for auth context.
 *
 * All consumers (pages, components, hooks) import from this path:
 *   import { useAuth } from '../context/AuthContext';
 *   import { AuthProvider } from './context/AuthContext';
 *
 * - AuthContext, useAuth  → defined in authContextDef.ts  (no JSX)
 * - AuthProvider          → defined in AuthProvider.tsx    (component-only file)
 *
 * This separation satisfies Vite Fast Refresh's requirement that .tsx files
 * must only export React components — no mixing with hooks or plain values.
 */
export { AuthContext, useAuth } from './authContextDef';
export { AuthProvider } from './AuthProvider';
