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
};

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export const FilterProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [department, setDepartment] = useState('ALL');
  const [academicYear, setAcademicYear] = useState('ALL');
  const [attendanceStatus, setAttendanceStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const resetFilters = useCallback(() => {
    setDepartment('ALL');
    setAcademicYear('ALL');
    setAttendanceStatus('ALL');
    setSearchQuery('');
  }, []);

  const clearOneFilter = useCallback((key: keyof FilterState) => {
    switch (key) {
      case 'department': setDepartment('ALL'); break;
      case 'academicYear': setAcademicYear('ALL'); break;
      case 'attendanceStatus': setAttendanceStatus('ALL'); break;
      case 'searchQuery': setSearchQuery(''); break;
    }
  }, []);

  const isFilteringActive = 
    department !== 'ALL' || 
    academicYear !== 'ALL' || 
    attendanceStatus !== 'ALL' || 
    searchQuery.trim() !== '';

  // Memoize context value so consumers only re-render when their specific slice changes
  const ctxValue = useMemo(() => ({
    department, setDepartment,
    academicYear, setAcademicYear,
    attendanceStatus, setAttendanceStatus,
    searchQuery, setSearchQuery,
    resetFilters,
    clearOneFilter,
    isFilteringActive
  }), [department, academicYear, attendanceStatus, searchQuery, resetFilters, clearOneFilter, isFilteringActive]);

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
 * Returns the mathematically exact array of students matching the active filter context.
 * Re-evaluates instantly in O(N) when filters change OR when the canonical live store notifies a general update.
 */
export const useFilteredStudents = (): StudentEntity[] => {
  const filters = useFilters();
  
  // Triggers re-render if store version changes OR if a student is added/deleted.
  const storeVersion = useStudentStoreVersion();
  const allIds = useStudentListIds(); 

  const filteredStudents = useMemo(() => {
    const allEntities = studentLiveStore.getAllEntities();
    const result: StudentEntity[] = [];

    for (let i = 0; i < allIds.length; i++) {
      const student = allEntities[allIds[i]];
      if (!student) continue;

      // 1. Search Filter
      if (filters.searchQuery && !matchesNameSearch(student as any, filters.searchQuery)) {
        continue;
      }

      // 2. Department Filter
      if (filters.department !== 'ALL' && !matchesDepartment(student as any, filters.department)) {
        continue;
      }

      // 3. Academic Year Filter
      if (filters.academicYear !== 'ALL' && !matchesAcademicYear(student as any, filters.academicYear)) {
        continue;
      }

      // 4. Attendance Status Filter (Contest/Weekly Context)
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
    
    // Sort logic from original Utils: Total Solved Descending
    return result.sort((a, b) => {
       const solvedA = a.stats?.total_solved ?? (a as any).total_solved ?? 0;
       const solvedB = b.stats?.total_solved ?? (b as any).total_solved ?? 0;
       return solvedB - solvedA;
    });

  }, [
    storeVersion,
    allIds, 
    filters.department, 
    filters.academicYear, 
    filters.attendanceStatus, 
    filters.searchQuery
  ]);

  return filteredStudents;
};
