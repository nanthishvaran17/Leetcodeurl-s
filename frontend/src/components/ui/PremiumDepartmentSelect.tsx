import React, { useEffect, useMemo } from 'react';
import { Building2 } from 'lucide-react';
import { GlobalFilter } from '../GlobalFilter';
import { useDepartments } from '../../contexts/DepartmentContext';

import { normalizeDepartment, formatDepartmentName, formatDepartmentCode } from '../../utils/filterUtils';

interface PremiumDepartmentSelectProps {
  selectedDept: string;
  onChange: (deptIdOrCode: string) => void;
  className?: string;
  label?: string;
  useIdAsValue?: boolean;
  dropdownWidth?: string;
  variant?: 'default' | 'dark' | 'glass';
  compact?: boolean;
  showAllDepartments?: boolean;
}

const PremiumDepartmentSelect: React.FC<PremiumDepartmentSelectProps> = ({ 
  selectedDept, 
  onChange, 
  className = '', 
  label = 'Department Filter',
  useIdAsValue = true,
  dropdownWidth = 'min-w-[320px] max-w-[480px]',
  variant = 'default',
  compact = false,
  showAllDepartments = false
}) => {
  const { departments, allDepartments, isHodScope, isGlobalAccess } = useDepartments();

  const isRestrictedHod = isHodScope && !isGlobalAccess;

  const activeDepts = useMemo(() => {
    let list = departments;
    if (isRestrictedHod) {
      list = departments;
    } else if (showAllDepartments || isGlobalAccess) {
      list = (allDepartments && allDepartments.length > 0) ? allDepartments : departments;
    }
    // Strictly exclude any department with 0 students/stats unless explicitly scoped
    return list.filter(d => d.student_count === undefined || d.student_count > 0);
  }, [isRestrictedHod, showAllDepartments, isGlobalAccess, allDepartments, departments]);

  // If HOD has scoped departments, auto-select their first department if single dept, or allow 'ALL' / 'MY_DEPARTMENTS' for multi-dept
  useEffect(() => {
    if (isRestrictedHod && activeDepts.length > 0) {
      const validValues = activeDepts.map(d => useIdAsValue ? String(d.id || '') : (formatDepartmentCode(d) || d.code));
      if (activeDepts.length === 1) {
        if (selectedDept === 'ALL' || selectedDept === 'MY_DEPARTMENTS' || !validValues.includes(selectedDept)) {
          onChange(validValues[0]);
        }
      } else {
        // Multi-dept HOD: allow 'ALL' or 'MY_DEPARTMENTS' (combined view of all authorized depts, e.g. 150 + 150 = 300)
        const isCombined = selectedDept === 'ALL' || selectedDept === 'MY_DEPARTMENTS';
        if (!selectedDept || (!validValues.includes(selectedDept) && !isCombined)) {
          onChange('ALL');
        }
      }
    }
  }, [isRestrictedHod, activeDepts, selectedDept, useIdAsValue, onChange]);

  // Options generator strictly respecting HOD scope
  const options = useMemo(() => {
    const deptOpts = activeDepts.map(d => {
      const code = formatDepartmentCode(d) || d.code;
      const name = formatDepartmentName(d) || d.name;
      return {
        value: useIdAsValue ? String(d.id || '') : code,
        label: name,
        pillText: code
      };
    });

    if (isRestrictedHod) {
      if (activeDepts.length > 1) {
        return [
          { value: 'ALL', label: 'All My Authorized Departments', pillText: 'ALL' },
          ...deptOpts
        ];
      }
      return deptOpts;
    }

    return [
      { value: 'ALL', label: 'All Departments', pillText: 'ALL' },
      ...deptOpts
    ];
  }, [activeDepts, isRestrictedHod, useIdAsValue]);

  return (
    <GlobalFilter
      label={label}
      value={selectedDept}
      onChange={onChange}
      options={options}
      icon={<Building2 className="w-4 h-4" />}
      className={className}
      dropdownWidth={dropdownWidth}
      showSearch={true}
      searchPlaceholder="Search department..."
      variant={variant}
      compact={compact}
    />
  );
};

export default PremiumDepartmentSelect;

