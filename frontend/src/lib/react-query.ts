import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10 * 60 * 1000, // 10 minutes (Instant navigation)
      gcTime: 60 * 60 * 1000, // 60 minutes memory cache
      refetchOnWindowFocus: false,
      retry: 2,
      refetchOnMount: false, // Serve instant cached data when navigating between tabs
      refetchOnReconnect: true,
    },
  },
});

