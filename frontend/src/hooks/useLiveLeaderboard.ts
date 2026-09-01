import { useEffect, useRef } from 'react';
import { useGlobalWebSocket } from '../context/GlobalWebSocketProvider';

export function useLiveLeaderboard(callback?: (data: any) => void) {
  const { isConnected, registerCallback, unregisterCallback } = useGlobalWebSocket();
  
  // Stable ID — never changes for the lifetime of this hook instance
  const idRef = useRef(`hook-${Math.random().toString(36).substr(2, 9)}`);
  
  // Stable ref for the callback — always holds the latest callback without causing re-registration
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    if (!callbackRef.current) return;
    
    // Register a stable wrapper that always calls the latest callback via ref
    // This prevents re-registration on every render when an inline function is passed
    const stableWrapper = (data: any) => {
      if (callbackRef.current) callbackRef.current(data);
    };
    
    registerCallback(idRef.current, stableWrapper);
    
    return () => {
      unregisterCallback(idRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerCallback, unregisterCallback]); // intentionally omit callback — managed via ref

  return { isConnected };
}
