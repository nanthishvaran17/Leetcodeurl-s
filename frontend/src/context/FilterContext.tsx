import { isGlobalAccessRole, isHodRole, isStaffRole, getUserCollege, isCollegeFilterAllowed } from '../services/auth/authTypes';
import React, { createContext, useContext, useState, useMemo, useCallback, ReactNode } from 'react';
import { useDebounce } from '../hooks/useDebounce';
import { studentLiveStore, useStudentListIds, useStudentStoreVersion } from '../stores/studentLiveStore';
import { StudentEntity } from '../types/student';
import { matchesNameSearch, matchesAcademicYear, matchesDepartment } from '../utils/filterUtils';

type FilterState = {
  department: string;
  academicYear: string;
  attendanceStatus: string;
  searchQuery: string;
  college: 'ALL' | 'NEC' | 'NCT';
};

type FilterContextType = FilterState & {
  setDepartment: (dept: string) => void;
  setAcademicYear: (year: string) => void;
  setAttendanceStatus: (status: string) => void;
  setSearchQuery: (query: string) => void;
  setCollege: (college: 'ALL' | 'NEC' | 'NCT') => void;
  resetFilters: () => void;
  clearOneFilter: (key: keyof FilterState) => void;
  isFilteringActive: boolean;
  hodDefaultDepartment: string;
};

const FilterContext = createContext<FilterContextType | undefined>(undefined);

/** Returns the scoped default college filter for current user.
 *  Admin/Management: 'ALL'. Staff/HOD/Student: their college ('NEC' or 'NCT'). */
function getDefaultCollege(): 'ALL' | 'NEC' | 'NCT' {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return 'ALL';
    const user = JSON.parse(raw);
    if (isCollegeFilterAllowed(user)) return 'ALL';
    return getUserCollege(user);
  } catch {
    return 'ALL';
  }
}

/** Returns the scoped default department filter for current user.
 *  Staff: their assigned department. HOD: authorized codes / MY_DEPARTMENTS. Admin/Management: 'ALL'. */
function getDefaultDepartment(): string {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return 'ALL';
    const user = JSON.parse(raw);
    if (isGlobalAccessRole(user)) return 'ALL';
    if (isStaffRole(user)) {
      const code = user?.department_code || user?.department;
      if (code && code !== 'ALL') return code.trim();
      if (user?.department_id) return String(user.department_id);
      if (Array.isArray(user?.authorized_department_codes) && user.authorized_department_codes.length > 0) {
        return user.authorized_department_codes[0];
      }
      if (Array.isArray(user?.authorized_department_ids) && user.authorized_department_ids.length > 0) {
        return String(user.authorized_department_ids[0]);
      }
    }
    if (isHodRole(user)) {
      const codes: string[] = user?.authorized_department_codes || [];
      if (codes.length === 1) return codes[0];
      if (codes.length > 1) return 'MY_DEPARTMENTS';
      if (user?.department) return user.department;
      if (user?.department_code) return user.department_code;
    }
    return 'ALL';
  } catch {
    return 'ALL';
  }
}

function getHodDefaultDepartment(): string {
  return getDefaultDepartment();
}

export const FilterProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const defaultCollege = getDefaultCollege();
  const defaultDept = getDefaultDepartment();

  const [department, setDepartmentState] = useState(defaultDept);
  const [academicYear, setAcademicYear] = useState('ALL');
  const [attendanceStatus, setAttendanceStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [college, setCollegeState] = useState<'ALL' | 'NEC' | 'NCT'>(defaultCollege);

  const hodDefaultDepartment = defaultDept;

  const setCollege = useCallback((newCol: 'ALL' | 'NEC' | 'NCT') => {
    try {
      const raw = localStorage.getItem('user');
      const user = raw ? JSON.parse(raw) : null;
      if (!isCollegeFilterAllowed(user)) {
        setCollegeState(defaultCollege);
        return;
      }
    } catch {}
    setCollegeState(newCol);
  }, [defaultCollege]);

  const setDepartment = useCallback((newDept: string) => {
    try {
      const raw = localStorage.getItem('user');
      const user = raw ? JSON.parse(raw) : null;
      if (isStaffRole(user)) {
        setDepartmentState(defaultDept);
        return;
      }
    } catch {}
    setDepartmentState(newDept);
  }, [defaultDept]);

  const resetFilters = useCallback(() => {
    setDepartmentState(defaultDept);
    setAcademicYear('ALL');
    setAttendanceStatus('ALL');
    setSearchQuery('');
    setCollegeState(defaultCollege);
  }, [defaultDept, defaultCollege]);

  const clearOneFilter = useCallback((key: keyof FilterState) => {
    switch (key) {
      case 'department': setDepartmentState(defaultDept); break;
      case 'academicYear': setAcademicYear('ALL'); break;
      case 'attendanceStatus': setAttendanceStatus('ALL'); break;
      case 'searchQuery': setSearchQuery(''); break;
      case 'college': setCollegeState(defaultCollege); break;
    }
  }, [defaultDept, defaultCollege]);

  const isFilteringActive =
    department !== defaultDept ||
    academicYear !== 'ALL' ||
    attendanceStatus !== 'ALL' ||
    searchQuery.trim() !== '' ||
    college !== defaultCollege;

  const ctxValue = useMemo(() => ({
    department, setDepartment,
    academicYear, setAcademicYear,
    attendanceStatus, setAttendanceStatus,
    searchQuery, setSearchQuery,
    college, setCollege,
    resetFilters,
    clearOneFilter,
    isFilteringActive,
    hodDefaultDepartment
  }), [department, academicYear, attendanceStatus, searchQuery, college, resetFilters, clearOneFilter, isFilteringActive, hodDefaultDepartment]);

  return (
    <FilterContext.Provider value={ctxValue}>
      {children}
    </FilterContext.Provider>
  );
};

export const useFilters = () => {
  const context = useContext(FilterContext);
  if (context === undefined) {
    throw new Error('useFilters must be used within a FilterProvider');
  }
  return context;
};

/**
 * Single Authoritative Hook for Derived Data.
 * HOD NOTE: studentLiveStore data is already backend-scoped to authorized departments.
 * MY_DEPARTMENTS sentinel means all HOD depts — no frontend filter needed for it.
 */
export const useFilteredStudents = (): StudentEntity[] => {
  const filters = useFilters();
  const debouncedSearch = useDebounce(filters.searchQuery, 300);
  const storeVersion = useStudentStoreVersion();
  const allIds = useStudentListIds();

  const filteredStudents = useMemo(() => {
    const allEntities = studentLiveStore.getAllEntities();
    const result: StudentEntity[] = [];

    for (let i = 0; i < allIds.length; i++) {
      const student = allEntities[allIds[i]];
      if (!student) continue;

      if (debouncedSearch && !matchesNameSearch(student as any, debouncedSearch)) continue;

      if (
        filters.department !== 'ALL' &&
        filters.department !== 'MY_DEPARTMENTS' &&
        !matchesDepartment(student as any, filters.department)
      ) continue;

      if (filters.academicYear !== 'ALL' && !matchesAcademicYear(student as any, filters.academicYear)) continue;

      if (filters.college !== 'ALL') {
        const studentCollege = ((student as any).college || 'NEC').toUpperCase();
        if (studentCollege !== filters.college) continue;
      }


      if (filters.attendanceStatus !== 'ALL') {
        const s = (student as any).contest_status || 'NOT_ATTENDED';
        if (filters.attendanceStatus === 'PUBLIC_ATTENDED' && s !== 'PUBLIC_ATTENDED') continue;
        if (filters.attendanceStatus === 'VIRTUAL_ATTENDED' && s !== 'VIRTUAL_ATTENDED') continue;
        if (filters.attendanceStatus === 'NOT_ATTENDED' && (s === 'PUBLIC_ATTENDED' || s === 'VIRTUAL_ATTENDED')) continue;
        if (filters.attendanceStatus === 'DATA_ERROR') {
          const s_stats = (student as any).stats || {};
          const hasError = (s_stats.sync_status === 'invalid_username' || s_stats.status === 'INVALID_USERNAME' || !(student as any).username);
          if (!hasError) continue;
        }
      }

      result.push(student);
    }

    return result.sort((a, b) => {
      const solvedA = a.stats?.total_solved ?? (a as any).total_solved ?? 0;
      const solvedB = b.stats?.total_solved ?? (b as any).total_solved ?? 0;
      return solvedB - solvedA;
    });
  }, [storeVersion, allIds, filters.department, filters.academicYear, filters.attendanceStatus, filters.college, debouncedSearch]);

  return filteredStudents;
};
