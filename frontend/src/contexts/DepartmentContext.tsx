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

const ALL_DEPARTMENTS_FALLBACK: Department[] = [
  { id: 1, code: 'CSE', name: 'Computer Science and Engineering', pillText: 'CSE' },
  { id: 2, code: 'CSE(CS)', name: 'Computer Science and Engineering (Cyber Security)', pillText: 'CSE(CS)' },
  { id: 3, code: 'CSE(IOT)', name: 'Computer Science and Engineering (IoT)', pillText: 'CSE(IOT)' },
  { id: 4, code: 'AIDS', name: 'Artificial Intelligence and Data Science', pillText: 'AIDS' },
  { id: 5, code: 'ECE', name: 'Electronics and Communication Engineering', pillText: 'ECE' },
  { id: 6, code: 'EEE', name: 'Electrical and Electronics Engineering', pillText: 'EEE' },
  { id: 7, code: 'IT', name: 'Information Technology', pillText: 'IT' },
  { id: 8, code: 'AGRI', name: 'Agricultural Engineering', pillText: 'AGRI' }
];

export const DepartmentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [departments, setDepartments] = useState<Department[]>(ALL_DEPARTMENTS_FALLBACK);
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
          } else if (upperCode === 'AIDS' || upperName.includes('DATA SCIENCE') || upperName.includes('ARTIFICIAL')) {
            finalCode = 'AIDS';
            finalName = 'Artificial Intelligence and Data Science';
          } else if (upperCode === 'ECE' || upperName.includes('ELECTRONICS AND COMM')) {
            finalCode = 'ECE';
            finalName = 'Electronics and Communication Engineering';
          } else if (upperCode === 'EEE' || upperName.includes('ELECTRICAL AND ELEC')) {
            finalCode = 'EEE';
            finalName = 'Electrical and Electronics Engineering';
          } else if (upperCode === 'AGRI' || upperName.includes('AGRICULTUR')) {
            finalCode = 'AGRI';
            finalName = 'Agricultural Engineering';
          } else if (upperCode === 'CSE' || upperName === 'COMPUTER SCIENCE AND ENGINEERING') {
            finalCode = 'CSE';
            finalName = 'Computer Science and Engineering';
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

        setDepartments(mappedDepts.length > 0 ? mappedDepts : ALL_DEPARTMENTS_FALLBACK);
      } else {
        setDepartments(ALL_DEPARTMENTS_FALLBACK);
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
      // On error, fallback to full institutional departments
      setDepartments(ALL_DEPARTMENTS_FALLBACK);
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

