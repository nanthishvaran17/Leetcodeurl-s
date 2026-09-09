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
}

const PremiumDepartmentSelect: React.FC<PremiumDepartmentSelectProps> = ({ 
  selectedDept, 
  onChange, 
  className = '', 
  label = 'DEPARTMENT FILTER',
  useIdAsValue = true
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
      icon={<Building2 className="w-5 h-5" />}
      className={className}
      dropdownWidth="w-full min-w-[280px]"
    />
  );
};

export default PremiumDepartmentSelect;
