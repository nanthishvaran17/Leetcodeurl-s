import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { useLiveLeaderboard } from '../hooks/useLiveLeaderboard';

interface GlobalDataContextProps {
  loading: boolean;
  refreshAllData: (isBackground?: boolean) => Promise<void>;
}

const GlobalDataContext = createContext<GlobalDataContextProps | undefined>(undefined);

export const GlobalDataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  // A generic refresh trigger if needed manually
  const fetchAllData = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['system'] }),
        queryClient.invalidateQueries({ queryKey: ['sync'] }),
        queryClient.invalidateQueries({ queryKey: ['students'] })
      ]);
    } catch (err) {
      console.warn('Failed to invalidate queries globally', err);
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [queryClient]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Listen for sync-level events only.
  // STUDENT_UPDATED patching is handled exclusively by LiveEventRouter to avoid dual-write.
  const { isConnected } = useLiveLeaderboard((data) => {
    if (data?.type === 'sync_complete' || data?.type === 'SYNC_COMPLETED') {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['sync'] });
    } else if (data?.type === 'sync_progress') {
      queryClient.setQueryData(['dashboard', 'summary'], (prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          sync: {
            ...prev.sync,
            is_running: true,
            processed: data.processed,
            total: data.total,
            percentage: data.total > 0 ? (data.processed / data.total) * 100 : 0
          }
        };
      });
    }
  });

  return (
    <GlobalDataContext.Provider value={{ loading, refreshAllData: fetchAllData }}>
      {children}
    </GlobalDataContext.Provider>
  );
};

export const useGlobalData = () => {
  const context = useContext(GlobalDataContext);
  if (!context) {
    throw new Error('useGlobalData must be used within a GlobalDataProvider');
  }
  return context;
};
