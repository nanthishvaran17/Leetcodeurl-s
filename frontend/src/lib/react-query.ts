import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10 * 60 * 1000, // 10 minutes (less background refetching)
      gcTime: 60 * 60 * 1000, // 60 minutes in memory (instant back navigation)
      refetchOnWindowFocus: false,
      retry: 1,
      refetchOnMount: false, // Serve instant cached data when navigating between tabs
      refetchOnReconnect: true,
    },
  },
});

