import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { studentLiveStore } from '../stores/studentLiveStore';
import api from '../services/api';
import { StudentData } from '../components/LeaderboardTable';

function parseUtcTime(timeStr?: string | null): number {
  if (!timeStr) return 0;
  return new Date(timeStr).getTime();
}

export const useStudentsQuery = () => {
  const queryClient = useQueryClient();

  const query = useQuery<StudentData[]>({
    queryKey: ['students', 'canonical'],
    queryFn: async () => {
      const res = await api.get('/students/leaderboard-fast');
      const data = Array.isArray(res.data) ? res.data : [];
      
      const currentCache = queryClient.getQueryData<StudentData[]>(['students', 'canonical']) || [];
      const cacheMap = new Map(currentCache.map(s => [String(s.id), s]));

      const merged = data.map(serverStudent => {
        const cachedStudent = cacheMap.get(String(serverStudent.id));
        if (!cachedStudent) return serverStudent;

        // Version guard: if the server student has a version, use it for strict comparison.
        // Otherwise, fallback to checking last_verified_at timestamp.
        const serverVersion = serverStudent.version || 0;
        const cachedVersion = cachedStudent.version || 0;

        if (serverVersion > 0 && cachedVersion > 0) {
          if (cachedVersion > serverVersion) {
            return cachedStudent; // Keep our newer live patched version
          }
          return serverStudent;
        }

        // Fallback to timestamp comparison if version is missing
        const serverTime = parseUtcTime(serverStudent.stats?.last_verified_at);
        const cachedTime = parseUtcTime(cachedStudent.stats?.last_verified_at);
        
        if (cachedTime > serverTime) {
          return cachedStudent; // Keep our newer live patched version
        }
        
        return serverStudent;
      });

      // Sort by total solved as the canonical ranking
      return merged.sort((a: any, b: any) => {
        const aVal = a.stats?.total_solved || 0;
        const bVal = b.stats?.total_solved || 0;
        return bVal - aVal;
      });
    },
    staleTime: 60 * 1000, // 1 minute
  });

  // Reconcile the live store automatically whenever the canonical data fetch completes
  // This ensures all components subscribing to the live store get the fresh dataset.
  useEffect(() => {
    if (query.data && query.data.length > 0) {
      studentLiveStore.reconcile(query.data);
    }
  }, [query.data]);

  return query;
};
