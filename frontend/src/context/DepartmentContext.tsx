import { normalizeDepartment } from '../utils/filterUtils';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { isGlobalAccessRole } from '../services/auth/authTypes';

export interface Department {
  id?: number;
  code: string;
  name: string;
  pillText?: string;
  student_count?: number;
}

interface DepartmentContextType {
  departments: Department[];
  allDepartments: Department[];
  isLoading: boolean;
  error: string | null;
  refreshDepartments: () => Promise<void>;
  /** true when the current user is HOD-scoped (departments list is already restricted) */
  isHodScope: boolean;
  /** true when the current user has global (all-dept) access */
  isGlobalAccess: boolean;
}

const DepartmentContext = createContext<DepartmentContextType | undefined>(undefined);

// Active institutional departments with enrolled students across Nandha Engineering College
const ALL_DEPARTMENTS_FALLBACK: Department[] = [
  { id: 1, code: 'CSE(CS)', name: 'Computer Science and Engineering (Cyber Security)', pillText: 'CSE(CS)', student_count: 159 },
  { id: 2, code: 'CSE(IOT)', name: 'Computer Science and Engineering (IoT)', pillText: 'CSE(IOT)', student_count: 148 },
  { id: 4, code: 'IT', name: 'Information Technology', pillText: 'IT', student_count: 256 },
];

export const DepartmentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Resolve user info from localStorage for reactivity (avoid circular provider dependency)
  const getUserSnapshot = () => {
    try {
      const raw = localStorage.getItem('user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const getInitialDepartments = (): Department[] => {
    try {
      const raw = localStorage.getItem('user');
      if (!raw) return [];
      const u = JSON.parse(raw);
      if (isGlobalAccessRole(u)) {
        return ALL_DEPARTMENTS_FALLBACK;
      }
      const authCodes: string[] = Array.isArray(u?.authorized_department_codes) ? u.authorized_department_codes : [];
      const authIds: number[] = Array.isArray(u?.authorized_department_ids) ? u.authorized_department_ids : [];
      if (authCodes.length > 0) {
        return authCodes.map((c, i) => {
          const norm = normalizeDepartment(c) || c;
          return {
            id: authIds[i] || i + 1,
            code: norm,
            name: c,
            pillText: norm,
            student_count: 0
          };
        });
      }
      if (u?.department || u?.department_code) {
        const rawCode = u.department_code || u.department;
        const norm = normalizeDepartment(rawCode) || rawCode;
        return [{
          id: u.department_id || 1,
          code: norm,
          name: u.department_name || rawCode,
          pillText: norm,
          student_count: 0
        }];
      }
    } catch {}
    return [];
  };

  const [departments, setDepartments] = useState<Department[]>(getInitialDepartments);
  const [allDepartments, setAllDepartments] = useState<Department[]>(getInitialDepartments);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isHodScope, setIsHodScope] = useState(false);
  const [isGlobalAccess, setIsGlobalAccess] = useState(false);

  const fetchDepartments = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetch departments (and full list with all_depts=true)
      const [resScoped, resAll] = await Promise.allSettled([
        api.get('/departments'),
        api.get('/departments?all_depts=true')
      ]);

      const parseDeptList = (rawData: any[]) => {
        const uniqueMap = new Map<string, Department>();
        rawData.forEach((d: any) => {
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
          } else if (upperCode === 'MECH' || upperName.includes('MECHANICAL')) {
            finalCode = 'MECH';
            finalName = 'Mechanical Engineering';
          } else if (upperCode === 'CIVIL' || upperName.includes('CIVIL')) {
            finalCode = 'CIVIL';
            finalName = 'Civil Engineering';
          } else if (upperCode === 'AIML' || upperName.includes('MACHINE LEARNING')) {
            finalCode = 'AIML';
            finalName = 'Artificial Intelligence and Machine Learning';
          }

          const studentCount = d.student_count ?? d.students_count ?? 0;
          if (!uniqueMap.has(finalCode)) {
            uniqueMap.set(finalCode, {
              id: d.id,
              code: finalCode,
              name: finalName,
              pillText: finalCode,
              student_count: studentCount
            });
          } else {
            const existing = uniqueMap.get(finalCode)!;
            if (studentCount > 0 && (!existing.student_count || existing.student_count === 0)) {
              existing.student_count = studentCount;
            }
          }
        });
        return Array.from(uniqueMap.values());
      };

      const scopedData = (resScoped.status === 'fulfilled' && Array.isArray(resScoped.value.data)) ? resScoped.value.data : [];
      const allData = (resAll.status === 'fulfilled' && Array.isArray(resAll.value.data)) ? resAll.value.data : [];

      let allDeptsList: Department[] = ALL_DEPARTMENTS_FALLBACK;
      if (allData.length > 0) {
        const parsedAll = parseDeptList(allData);
        allDeptsList = parsedAll.length > 0 ? parsedAll : ALL_DEPARTMENTS_FALLBACK;
      }
      setAllDepartments(allDeptsList);

      let scopedDeptsList: Department[] = allDeptsList;
      if (scopedData.length > 0) {
        const parsedScoped = parseDeptList(scopedData);
        scopedDeptsList = parsedScoped.length > 0 ? parsedScoped : allDeptsList;
      }
      setDepartments(scopedDeptsList);

      // Determine scope flags from user role and departmental allocation
      const u = getUserSnapshot();
      const isGlobal = isGlobalAccessRole(u);
      const isScoped = !isGlobal;
      setIsHodScope(isScoped);
      setIsGlobalAccess(isGlobal);

      if (isScoped && u) {
        const authIds: number[] = Array.isArray(u?.authorized_department_ids) ? u.authorized_department_ids.map(Number) : [];
        const authCodes: string[] = (Array.isArray(u?.authorized_department_codes) ? u.authorized_department_codes : []).map((c: string) => String(c).trim());
        const uDeptId = u?.department_id ? Number(u.department_id) : null;
        const uDeptCode = String(u?.department || u?.department_code || '').trim();

        // Canonical set of normalized authorized identifiers
        const authorizedKeys = new Set<string>();
        if (uDeptId) authorizedKeys.add(normalizeDepartment(uDeptId));
        if (uDeptCode) authorizedKeys.add(normalizeDepartment(uDeptCode));
        authIds.forEach(id => authorizedKeys.add(normalizeDepartment(id)));
        authCodes.forEach(code => authorizedKeys.add(normalizeDepartment(code)));

        const isAuthorizedDept = (d: Department) => {
          if (d.id && authIds.includes(Number(d.id))) return true;
          if (uDeptId && d.id && Number(d.id) === uDeptId) return true;
          const normD = normalizeDepartment(d);
          if (authorizedKeys.has(normD)) return true;
          const normCode = normalizeDepartment(d.code);
          if (authorizedKeys.has(normCode)) return true;
          return false;
        };

        // Filter both scoped and all data strictly to authorized departments
        const validScoped = parseDeptList(scopedData).filter(isAuthorizedDept);
        const validAll = parseDeptList(allData).filter(isAuthorizedDept);
        let resolved = validScoped.length > 0 ? validScoped : validAll;

        if (resolved.length === 0) {
          if (authCodes.length > 0) {
            resolved = authCodes.map((code, idx) => ({
              id: authIds[idx] || (uDeptId && idx === 0 ? uDeptId : idx + 1),
              code: code,
              name: code,
              pillText: code,
              student_count: 0
            }));
          } else if (uDeptCode || uDeptId) {
            resolved = [{
              id: uDeptId || 1,
              code: uDeptCode || 'DEPT',
              name: u?.department_name || uDeptCode || 'Department',
              pillText: uDeptCode || 'DEPT',
              student_count: 0
            }];
          }
        }

        setDepartments(resolved);
        setAllDepartments(resolved);

        // Sync fresh department IDs & codes into localStorage user so other components stay updated
        try {
          if (u && resolved.length > 0) {
            const newIds = resolved.map(d => d.id).filter(Boolean) as number[];
            const newCodes = resolved.map(d => d.code).filter(Boolean) as string[];
            const updatedUser = {
              ...u,
              authorized_department_ids: newIds.length > 0 ? newIds : u.authorized_department_ids,
              authorized_department_codes: newCodes.length > 0 ? newCodes : u.authorized_department_codes
            };
            localStorage.setItem('user', JSON.stringify(updatedUser));
          }
        } catch (_) {}
        return;
      }
    } catch (err: any) {
      console.error('[DepartmentContext] Failed to fetch departments:', err);
      setError(err.message || 'Failed to fetch departments');
      const u = getUserSnapshot();
      const role = ((u?.role) || '').trim().toLowerCase();
      const isRestrictedRole = !['admin', 'administrator', 'super admin', 'super_admin', 'principal', 'management', 'coordinator', 'academic coordinator', 'director', 'executive'].includes(role);
      if (isRestrictedRole && u) {
        const authCodes: string[] = Array.isArray(u?.authorized_department_codes) ? u.authorized_department_codes : [];
        const authIds: number[] = Array.isArray(u?.authorized_department_ids) ? u.authorized_department_ids : [];
        if (authCodes.length > 0) {
          const list = authCodes.map((c, i) => ({
            id: authIds[i] || i + 1,
            code: c,
            name: c,
            pillText: c,
            student_count: 0
          }));
          setDepartments(list);
          setAllDepartments(list);
        } else {
          const code = u.department_code || u.department || 'DEPT';
          const list = [{
            id: u.department_id || 1,
            code: code,
            name: u.department_name || code,
            pillText: code,
            student_count: 0
          }];
          setDepartments(list);
          setAllDepartments(list);
        }
      } else {
        setDepartments(ALL_DEPARTMENTS_FALLBACK);
        setAllDepartments(ALL_DEPARTMENTS_FALLBACK);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  // Re-fetch when user identity, role, or department creation events fire
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'user' || e.key === 'department_update') {
        fetchDepartments();
      }
    };
    const handleCustomDeptUpdate = () => {
      fetchDepartments();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('department_updated', handleCustomDeptUpdate);
    window.addEventListener('departments_changed', handleCustomDeptUpdate);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('department_updated', handleCustomDeptUpdate);
      window.removeEventListener('departments_changed', handleCustomDeptUpdate);
    };
  }, [fetchDepartments]);

  return (
    <DepartmentContext.Provider value={{
      departments,
      allDepartments,
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
      allDepartments: [],
      isLoading: false,
      error: null,
      refreshDepartments: async () => { },
      isHodScope: false,
      isGlobalAccess: false
    };
  }
  return context;
};

