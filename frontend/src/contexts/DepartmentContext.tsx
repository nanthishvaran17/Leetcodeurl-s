import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

export interface Department {
  id?: number;
  code: string;
  name: string;
  pillText?: string;
}

interface DepartmentContextType {
  departments: Department[];
  isLoading: boolean;
  error: string | null;
  refreshDepartments: () => Promise<void>;
}

const DepartmentContext = createContext<DepartmentContextType | undefined>(undefined);

export const DepartmentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDepartments = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetch all departments (the backend now filters test/demo automatically)
      const res = await api.get('/departments');
      if (res.data && Array.isArray(res.data)) {
        // Map the backend structure to the frontend interface
        const mappedDepts = res.data.map((d: any) => ({
          id: d.id,
          code: d.code || d.name,
          name: d.name || d.code,
          pillText: d.code || d.name
        }));
        setDepartments(mappedDepts);
      } else {
        setDepartments([]);
      }
    } catch (err: any) {
      console.error('[DepartmentContext] Failed to fetch departments:', err);
      setError(err.message || 'Failed to fetch departments');
      setDepartments([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  return (
    <DepartmentContext.Provider value={{ departments, isLoading, error, refreshDepartments: fetchDepartments }}>
      {children}
    </DepartmentContext.Provider>
  );
};

export const useDepartments = () => {
  const context = useContext(DepartmentContext);
  if (context === undefined) {
    console.warn('useDepartments must be used within a DepartmentProvider');
    return { departments: [], isLoading: false, error: null, refreshDepartments: async () => {} };
  }
  return context;
};
