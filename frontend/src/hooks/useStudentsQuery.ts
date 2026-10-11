import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { studentLiveStore } from '../stores/studentLiveStore';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { getCachedStudents, saveCachedStudents, isFacultyUser } from '../utils/rosterCache';
import { StudentEntity } from '../types/student';

function parseUtcTime(timeStr?: string | null): number {
  if (!timeStr) return 0;
  return new Date(timeStr).getTime();
}

export const useStudentsQuery = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isFaculty = isFacultyUser(user);
  const userScope = user?.id ? String(user.id) : 'public';
  // Include role in cache key to ensure HOD / Staff / Admin each get isolated caches
  const roleKey = user?.role ? String(user.role).trim().toLowerCase().replace(/\s+/g, '_') : 'none';
  const queryKey = ['students', 'canonical', `${roleKey}_${userScope}`];

  const query = useQuery<StudentEntity[]>({
    queryKey,
    initialData: () => (isFaculty ? getCachedStudents(user?.id) : getCachedStudents()) as StudentEntity[],
    queryFn: async () => {
      const res = await api.get('/students/leaderboard-fast');
      const data = Array.isArray(res.data) ? res.data : [];
      saveCachedStudents(data, isFaculty ? user?.id : undefined);

      if (isFaculty && data.length === 0) {
        return [];
      }

      const currentCache = queryClient.getQueryData<StudentEntity[]>(queryKey) || [];
      const cacheMap = new Map(currentCache.map(s => [String(s.id), s]));

      const merged = data.map(serverStudent => {
        const cachedStudent = cacheMap.get(String(serverStudent.id));
        if (!cachedStudent) return serverStudent;

        // Version guard: if the server student has a version, use it for strict comparison.
        // Otherwise, fallback to checking last_verified_at timestamp.
        const serverVersion = (serverStudent as any).version || 0;
        const cachedVersion = (cachedStudent as any).version || 0;

        const serverHasValidSum =
          serverStudent.stats &&
          (serverStudent.stats.total_solved ?? 0) > 0 &&
          ((serverStudent.stats.easy_solved ?? 0) + (serverStudent.stats.medium_solved ?? 0) + (serverStudent.stats.hard_solved ?? 0) === serverStudent.stats.total_solved);

        const cachedHasValidSum =
          cachedStudent.stats &&
          (cachedStudent.stats.total_solved ?? 0) > 0 &&
          ((cachedStudent.stats.easy_solved ?? 0) + (cachedStudent.stats.medium_solved ?? 0) + (cachedStudent.stats.hard_solved ?? 0) === cachedStudent.stats.total_solved);

        const mergedStats = (serverHasValidSum && !cachedHasValidSum)
          ? {
              ...(cachedStudent.stats || {}),
              ...(serverStudent.stats || {}),
            }
          : {
              ...(serverStudent.stats || {}),
              ...(cachedStudent.stats || {})
            };

        if (serverVersion > 0 && cachedVersion > 0) {
          if (cachedVersion > serverVersion) {
            return {
              ...serverStudent,
              ...cachedStudent,
              total_solved: mergedStats.total_solved ?? serverStudent.total_solved,
              easy_solved: mergedStats.easy_solved ?? serverStudent.easy_solved,
              medium_solved: mergedStats.medium_solved ?? serverStudent.medium_solved,
              hard_solved: mergedStats.hard_solved ?? serverStudent.hard_solved,
              stats: mergedStats
            };
          }
          return serverStudent;
        }

        // Fallback to timestamp comparison if version is missing
        const serverTime = parseUtcTime(serverStudent.stats?.last_verified_at);
        const cachedTime = parseUtcTime(cachedStudent.stats?.last_verified_at);

        if (cachedTime > serverTime) {
          return {
            ...serverStudent,
            ...cachedStudent,
            total_solved: mergedStats.total_solved ?? serverStudent.total_solved,
            easy_solved: mergedStats.easy_solved ?? serverStudent.easy_solved,
            medium_solved: mergedStats.medium_solved ?? serverStudent.medium_solved,
            hard_solved: mergedStats.hard_solved ?? serverStudent.hard_solved,
            stats: mergedStats
          };
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
