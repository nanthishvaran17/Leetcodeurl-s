import React, { useState, useEffect, useRef } from 'react';
import { Building2, ChevronDown, Check } from 'lucide-react';
import api from '../../services/api';

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
  label = 'Select Department',
  useIdAsValue = true
}) => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedDeptData = useIdAsValue 
    ? departments.find(d => String(d.id) === selectedDept)
    : departments.find(d => d.code === selectedDept);

  return (
    <div className={`space-y-2 ${className}`} ref={dropdownRef}>
      {label && (
        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
          {label}
        </label>
      )}
      <div className={`relative ${isOpen ? 'z-30' : 'z-10'}`}>
        <button
          type="button"
          onClick={() => setIsOpen(p => !p)}
          className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-white dark:bg-navy-950 border text-left transition-all focus:outline-none ${
            isOpen ? 'border-brand-400 ring-2 ring-brand-400/20' : 'border-gray-200 dark:border-gray-800 hover:border-brand-300'
          }`}
        >
          <Building2 className="w-3.5 h-3.5 text-brand-500 shrink-0" />
          {selectedDept === 'ALL' ? (
            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md shrink-0 text-brand-600 bg-brand-50 dark:bg-brand-950 dark:text-brand-300">ALL</span>
          ) : (
            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md shrink-0 text-indigo-600 bg-indigo-50 dark:bg-indigo-950 dark:text-indigo-300">
              {selectedDeptData?.code || 'DEPT'}
            </span>
          )}
          <span className="text-xs font-bold text-gray-900 dark:text-white truncate flex-1">
            {selectedDept === 'ALL' ? 'All Departments' : selectedDeptData?.name || selectedDept}
          </span>
          <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
        </button>
        {isOpen && (
          <div className="absolute z-[200] top-full left-0 right-0 mt-1 bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-64 overflow-y-auto py-1">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange('ALL'); setIsOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors ${
                selectedDept === 'ALL' ? 'bg-brand-50 dark:bg-brand-950/60' : 'hover:bg-gray-50 dark:hover:bg-navy-800'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md shrink-0 text-brand-600 bg-brand-50 dark:bg-brand-950 dark:text-brand-300">ALL</span>
              <span className={`text-xs truncate flex-1 ${selectedDept === 'ALL' ? 'font-black text-brand-700 dark:text-brand-300' : 'font-semibold text-gray-700 dark:text-gray-300'}`}>All Departments</span>
              {selectedDept === 'ALL' && <Check className="w-3.5 h-3.5 text-brand-500 shrink-0" />}
            </button>
            {departments.map((d) => (
              <button
                key={d.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onChange(useIdAsValue ? String(d.id) : d.code); setIsOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors ${
                  selectedDept === (useIdAsValue ? String(d.id) : d.code) ? 'bg-brand-50 dark:bg-brand-950/60' : 'hover:bg-gray-50 dark:hover:bg-navy-800'
                }`}
              >
                <Building2 className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md shrink-0 text-indigo-600 bg-indigo-50 dark:bg-indigo-950 dark:text-indigo-300">{d.code}</span>
                <span className={`text-xs truncate flex-1 ${selectedDept === (useIdAsValue ? String(d.id) : d.code) ? 'font-black text-brand-700 dark:text-brand-300' : 'font-semibold text-gray-700 dark:text-gray-300'}`}>{d.name}</span>
                {selectedDept === (useIdAsValue ? String(d.id) : d.code) && <Check className="w-3.5 h-3.5 text-brand-500 shrink-0" />}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PremiumDepartmentSelect;
