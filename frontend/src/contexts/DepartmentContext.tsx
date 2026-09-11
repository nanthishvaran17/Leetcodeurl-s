import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

export interface Department {
  id?: number;
  code: string;
  name: string;
  pillText?: string;
}

interface DepartmentContextType {
  departments: Department[];
  isLoading: boolean;
  error: string | null;
  refreshDepartments: () => Promise<void>;
  /** true when the current user is HOD-scoped (departments list is already restricted) */
  isHodScope: boolean;
  /** true when the current user has global (all-dept) access */
  isGlobalAccess: boolean;
}

const DepartmentContext = createContext<DepartmentContextType | undefined>(undefined);

export const DepartmentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isHodScope, setIsHodScope] = useState(false);
  const [isGlobalAccess, setIsGlobalAccess] = useState(false);

  // Resolve user info from localStorage for reactivity (avoid circular provider dependency)
  const getUserSnapshot = () => {
    try {
      const raw = localStorage.getItem('user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const fetchDepartments = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Backend returns scoped list for HOD, full list for others
      const res = await api.get('/departments');
      if (res.data && Array.isArray(res.data)) {
        const mappedDepts = res.data.map((d: any) => {
          const code = d.code || d.name || '';
          const rawName = d.name || d.code || '';
          const name = (code.toUpperCase() === 'IT' || rawName.toUpperCase() === 'IT')
            ? 'Information Technology'
            : rawName;
          return {
            id: d.id,
            code,
            name,
            pillText: code
          };
        });
        setDepartments(mappedDepts);
      } else {
        setDepartments([]);
      }

      // Determine scope flags from user role
      const u = getUserSnapshot();
      const role = ((u?.role) || '').trim().toLowerCase();
      const hodRoles = ['hod', 'department hod', 'department_hod'];
      const globalRoles = ['admin', 'administrator', 'super admin', 'super_admin', 'principal', 'management'];
      setIsHodScope(hodRoles.includes(role));
      setIsGlobalAccess(globalRoles.includes(role));
    } catch (err: any) {
      console.error('[DepartmentContext] Failed to fetch departments:', err);
      setError(err.message || 'Failed to fetch departments');
      setDepartments([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  // Re-fetch when user identity or role changes (prevents stale cross-user department list)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'user') {
        fetchDepartments();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [fetchDepartments]);

  return (
    <DepartmentContext.Provider value={{
      departments,
      isLoading,
      error,
      refreshDepartments: fetchDepartments,
      isHodScope,
      isGlobalAccess
    }}>
      {children}
    </DepartmentContext.Provider>
  );
};

export const useDepartments = () => {
  const context = useContext(DepartmentContext);
  if (context === undefined) {
    console.warn('useDepartments must be used within a DepartmentProvider');
    return {
      departments: [],
      isLoading: false,
      error: null,
      refreshDepartments: async () => {},
      isHodScope: false,
      isGlobalAccess: false
    };
  }
  return context;
};

