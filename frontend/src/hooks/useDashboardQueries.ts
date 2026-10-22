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
      if (Array.isArray(res.data)) return res.data;
      if (Array.isArray(res.data?.departments)) return res.data.departments;
      if (Array.isArray(res.data?.data)) return res.data.data;
      return [];
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

export const useCurrentContestSessionQuery = () => {
  return useQuery({
    queryKey: ['contests', 'current-session'],
    queryFn: async () => {
      const res = await api.get('/contests/current-session');
      return res.data;
    },
    staleTime: 15 * 1000,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      // Auto-poll every 15s when contest is LIVE (Sundays 08:00 - 09:30 AM), otherwise 60s
      return status === 'LIVE' ? 15000 : 60000;
    },
  });
};

export const useContestSessionsListQuery = () => {
  return useQuery({
    queryKey: ['contests', 'sessions-list'],
    queryFn: async () => {
      const res = await api.get('/contests/sessions');
      return Array.isArray(res.data) ? res.data : [];
    },
    staleTime: 60 * 1000,
  });
};

export const usePost930SolversQuery = () => {
  return useQuery({
    queryKey: ['contests', 'post-930-solvers'],
    queryFn: async () => {
      const res = await api.get('/contests/post-930-solvers');
      return res.data;
    },
    staleTime: 30 * 1000,
  });
};

