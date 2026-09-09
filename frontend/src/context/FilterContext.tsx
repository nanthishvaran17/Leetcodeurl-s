import React, { createContext, useContext, useState, useMemo, useCallback, ReactNode } from 'react';
import { studentLiveStore, useStudentListIds, useStudentStoreVersion } from '../stores/studentLiveStore';
import { StudentEntity } from '../types/student';
import { matchesNameSearch, matchesAcademicYear, matchesDepartment } from '../utils/filterUtils';

type FilterState = {
  department: string;
  academicYear: string;
  attendanceStatus: string;
  searchQuery: string;
};

type FilterContextType = FilterState & {
  setDepartment: (dept: string) => void;
  setAcademicYear: (year: string) => void;
  setAttendanceStatus: (status: string) => void;
  setSearchQuery: (query: string) => void;
  resetFilters: () => void;
  clearOneFilter: (key: keyof FilterState) => void;
  isFilteringActive: boolean;
  hodDefaultDepartment: string;
};

const FilterContext = createContext<FilterContextType | undefined>(undefined);

/** Returns the HOD-scoped default department filter for the current user.
 *  HOD with 1 dept: that dept code. HOD with 2+ depts: 'MY_DEPARTMENTS'. Others: 'ALL'. */
function getHodDefaultDepartment(): string {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return 'ALL';
    const user = JSON.parse(raw);
    const role = ((user?.role) || '').trim().toLowerCase();
    const isHod = role === 'hod' || role === 'department hod' || role === 'department_hod';
    if (!isHod) return 'ALL';
    const codes: string[] = user?.authorized_department_codes || [];
    if (codes.length === 0) return 'ALL';
    if (codes.length === 1) return codes[0];
    return 'MY_DEPARTMENTS';
  } catch {
    return 'ALL';
  }
}

export const FilterProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const hodDefault = getHodDefaultDepartment();

  const [department, setDepartment] = useState(hodDefault);
  const [academicYear, setAcademicYear] = useState('ALL');
  const [attendanceStatus, setAttendanceStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const hodDefaultDepartment = getHodDefaultDepartment();

  const resetFilters = useCallback(() => {
    setDepartment(hodDefaultDepartment);
    setAcademicYear('ALL');
    setAttendanceStatus('ALL');
    setSearchQuery('');
  }, [hodDefaultDepartment]);

  const clearOneFilter = useCallback((key: keyof FilterState) => {
    switch (key) {
      case 'department': setDepartment(hodDefaultDepartment); break;
      case 'academicYear': setAcademicYear('ALL'); break;
      case 'attendanceStatus': setAttendanceStatus('ALL'); break;
      case 'searchQuery': setSearchQuery(''); break;
    }
  }, [hodDefaultDepartment]);

  const isFilteringActive =
    department !== hodDefaultDepartment ||
    academicYear !== 'ALL' ||
    attendanceStatus !== 'ALL' ||
    searchQuery.trim() !== '';

  const ctxValue = useMemo(() => ({
    department, setDepartment,
    academicYear, setAcademicYear,
    attendanceStatus, setAttendanceStatus,
    searchQuery, setSearchQuery,
    resetFilters,
    clearOneFilter,
    isFilteringActive,
    hodDefaultDepartment
  }), [department, academicYear, attendanceStatus, searchQuery, resetFilters, clearOneFilter, isFilteringActive, hodDefaultDepartment]);

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
  const storeVersion = useStudentStoreVersion();
  const allIds = useStudentListIds();

  const filteredStudents = useMemo(() => {
    const allEntities = studentLiveStore.getAllEntities();
    const result: StudentEntity[] = [];

    for (let i = 0; i < allIds.length; i++) {
      const student = allEntities[allIds[i]];
      if (!student) continue;

      if (filters.searchQuery && !matchesNameSearch(student as any, filters.searchQuery)) continue;

      if (
        filters.department !== 'ALL' &&
        filters.department !== 'MY_DEPARTMENTS' &&
        !matchesDepartment(student as any, filters.department)
      ) continue;

      if (filters.academicYear !== 'ALL' && !matchesAcademicYear(student as any, filters.academicYear)) continue;

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
  }, [storeVersion, allIds, filters.department, filters.academicYear, filters.attendanceStatus, filters.searchQuery]);

  return filteredStudents;
};
