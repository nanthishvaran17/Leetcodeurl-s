import React from 'react';
import { Building2 } from 'lucide-react';
import { GlobalFilter } from '../GlobalFilter';
import { useDepartments } from '../../contexts/DepartmentContext';

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
  const { departments, isLoading } = useDepartments();

  const options = [
    { value: 'ALL', label: 'All Departments', pillText: 'ALL' },
    ...departments.map(d => ({
      value: useIdAsValue ? String(d.id || '') : d.code,
      label: d.name,
      pillText: d.code
    }))
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

