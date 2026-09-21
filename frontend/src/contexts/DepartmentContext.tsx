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
  const [departments, setDepartments] = useState<Department[]>([
    { id: 1, code: 'CSE(CS)', name: 'Computer Science and Engineering (Cyber Security)', pillText: 'CSE(CS)' },
    { id: 2, code: 'CSE(IOT)', name: 'Computer Science and Engineering (IoT)', pillText: 'CSE(IOT)' },
    { id: 7, code: 'IT', name: 'Information Technology', pillText: 'IT' }
  ]);
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
        const sourceData = res.data;
        const uniqueMap = new Map<string, Department>();

        sourceData.forEach((d: any) => {
          const code = (d.code || d.name || '').trim();
          const rawName = (d.name || d.code || '').trim();
          const upperCode = code.toUpperCase();
          const upperName = rawName.toUpperCase();
          
          let finalCode = code;
          let finalName = rawName;
          
          if (upperCode.includes('IOT') || upperName.includes('IOT') || upperName.includes('INTERNET')) {
            finalCode = 'CSE(IOT)';
            finalName = 'Computer Science and Engineering (IoT)';
          } else if (upperCode === 'CSE(CS)' || upperCode === 'CSE-CS' || upperCode === 'CS' || upperName.includes('CYBER') || upperName.includes('SECURITY')) {
            finalCode = 'CSE(CS)';
            finalName = 'Computer Science and Engineering (Cyber Security)';
          } else if (upperCode === 'IT' || upperName.includes('INFORMATION TECHNOLOGY') || upperName.includes('INFO TECH')) {
            finalCode = 'IT';
            finalName = 'Information Technology';
          }

          if (!uniqueMap.has(finalCode)) {
            uniqueMap.set(finalCode, {
              id: d.id,
              code: finalCode,
              name: finalName,
              pillText: finalCode
            });
          }
        });

        const mappedDepts = Array.from(uniqueMap.values());

        setDepartments(mappedDepts.length > 0 ? mappedDepts : [
          { id: 1, code: 'CSE(CS)', name: 'Computer Science and Engineering (Cyber Security)', pillText: 'CSE(CS)' },
          { id: 2, code: 'CSE(IOT)', name: 'Computer Science and Engineering (IoT)', pillText: 'CSE(IOT)' },
          { id: 7, code: 'IT', name: 'Information Technology', pillText: 'IT' }
        ]);
      } else {
        setDepartments([
          { id: 1, code: 'CSE(CS)', name: 'Computer Science and Engineering (Cyber Security)', pillText: 'CSE(CS)' },
          { id: 2, code: 'CSE(IOT)', name: 'Computer Science and Engineering (IoT)', pillText: 'CSE(IOT)' },
          { id: 7, code: 'IT', name: 'Information Technology', pillText: 'IT' }
        ]);
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
      // On error, fallback to the 3 production departments
      setDepartments([
        { id: 1, code: 'CSE(CS)', name: 'Computer Science and Engineering (Cyber Security)', pillText: 'CSE(CS)' },
        { id: 2, code: 'CSE(IOT)', name: 'Computer Science and Engineering (IoT)', pillText: 'CSE(IOT)' },
        { id: 7, code: 'IT', name: 'Information Technology', pillText: 'IT' }
      ]);
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

