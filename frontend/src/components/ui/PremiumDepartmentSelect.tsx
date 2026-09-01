import React, { useState, useEffect } from 'react';
import { Building2 } from 'lucide-react';
import api from '../../services/api';
import { GlobalFilter } from '../GlobalFilter';

interface Department {
  id: number;
  code: string;
  name: string;
}

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
  const [departments, setDepartments] = useState<Department[]>([]);

  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const res = await api.get('/departments');
        setDepartments(res.data);
      } catch (err) {
        console.error('Failed to fetch departments', err);
      }
    };
    fetchDepartments();
  }, []);

  const options = [
    { value: 'ALL', label: 'All Departments', pillText: 'ALL' },
    ...departments.map(d => ({
      value: useIdAsValue ? String(d.id) : d.code,
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
