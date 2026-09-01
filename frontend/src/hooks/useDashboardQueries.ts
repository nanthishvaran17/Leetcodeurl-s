import { useQuery } from '@tanstack/react-query';
import api from '../services/api';

export const useSummaryQuery = () => {
  return useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: async () => {
      const res = await api.get('/sessions/dashboard-summary');
      return res.data;
    },
    staleTime: 30 * 1000,
  });
};

export const useDepartmentsQuery = () => {
  return useQuery({
    queryKey: ['dashboard', 'departments'],
    queryFn: async () => {
      const res = await api.get('/analytics/department-comparison');
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });
};

export const useDataQualityQuery = () => {
  return useQuery({
    queryKey: ['dashboard', 'dataQuality'],
    queryFn: async () => {
      const res = await api.get('/analytics/data-quality');
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });
};

export const useSystemHealthQuery = () => {
  return useQuery({
    queryKey: ['system', 'health'],
    queryFn: async () => {
      const res = await api.get('/system/health');
      return res.data;
    },
    staleTime: 10 * 1000,
  });
};

export const useSyncStatusQuery = () => {
  return useQuery({
    queryKey: ['sync', 'status'],
    queryFn: async () => {
      const res = await api.get('/sync/status');
      return res.data;
    },
    staleTime: 5 * 1000, // Frequent polling fallback, or rely on WS
  });
};
