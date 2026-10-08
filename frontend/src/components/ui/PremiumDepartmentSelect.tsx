import React from 'react';
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
}

const PremiumDepartmentSelect: React.FC<PremiumDepartmentSelectProps> = ({ 
  selectedDept, 
  onChange, 
  className = '', 
  label = 'Department Filter',
  useIdAsValue = true,
  dropdownWidth = 'min-w-[320px] max-w-[480px]',
  variant = 'default'
}) => {
  const { departments } = useDepartments();

  // Active production departments
  const options = [
    { value: 'ALL', label: 'All Departments', pillText: 'ALL' },
    ...departments
      .filter(d => {
        const norm = normalizeDepartment(d);
        return norm === 'cse_cs' || norm === 'cse_iot' || norm === 'it';
      })
      .map(d => {
        const code = formatDepartmentCode(d) || d.code;
        const name = formatDepartmentName(d) || d.name;
        return {
          value: useIdAsValue ? String(d.id || '') : code,
          label: name,
          pillText: code
        };
      })
  ];

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
    />
  );
};

export default PremiumDepartmentSelect;

