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

  const activeDepts = useMemo(() => {
    if (showAllDepartments || isGlobalAccess) {
      return (allDepartments && allDepartments.length > 0) ? allDepartments : departments;
    }
    return departments;
  }, [showAllDepartments, isGlobalAccess, allDepartments, departments]);

  // If HOD has scoped departments, auto-select their first department if current value is 'ALL' or invalid
  useEffect(() => {
    if (!showAllDepartments && isHodScope && !isGlobalAccess && activeDepts.length > 0) {
      const validValues = activeDepts.map(d => useIdAsValue ? String(d.id || '') : (formatDepartmentCode(d) || d.code));
      if (selectedDept === 'ALL' || !selectedDept || (!validValues.includes(selectedDept) && selectedDept !== 'MY_DEPARTMENTS')) {
        const defaultVal = validValues[0];
        if (defaultVal) {
          onChange(defaultVal);
        }
      }
    }
  }, [showAllDepartments, isHodScope, isGlobalAccess, activeDepts, selectedDept, useIdAsValue, onChange]);

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

    if (!showAllDepartments && isHodScope && !isGlobalAccess) {
      if (activeDepts.length > 1) {
        return [
          { value: 'MY_DEPARTMENTS', label: 'All My Authorized Departments', pillText: 'MY DEPTS' },
          ...deptOpts
        ];
      }
      return deptOpts;
    }

    return [
      { value: 'ALL', label: 'All Departments', pillText: 'ALL' },
      ...deptOpts
    ];
  }, [activeDepts, showAllDepartments, isHodScope, isGlobalAccess, useIdAsValue]);

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

