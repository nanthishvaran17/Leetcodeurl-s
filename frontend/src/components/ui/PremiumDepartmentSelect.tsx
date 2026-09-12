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
}

const PremiumDepartmentSelect: React.FC<PremiumDepartmentSelectProps> = ({ 
  selectedDept, 
  onChange, 
  className = '', 
  label = 'DEPARTMENT FILTER',
  useIdAsValue = true,
  dropdownWidth = 'min-w-[580px]'
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
    />
  );
};

export default PremiumDepartmentSelect;

