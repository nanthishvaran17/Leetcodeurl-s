import React, { createContext, useContext, useEffect, useMemo, useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { LiveEventRouter } from '../services/LiveEventRouter';
import { useAuth } from './AuthContext';

export type RealtimeVisualStatus = 'INITIALIZING' | 'LIVE' | 'RECONNECTING' | 'OFFLINE';

interface GlobalWebSocketContextType {
  isConnected: boolean;
  visualStatus: RealtimeVisualStatus;
  registerCallback: (id: string, callback: (data: any) => void) => void;
  unregisterCallback: (id: string) => void;
  sendMessage: (payload: any) => void;
}

const GlobalWebSocketContext = createContext<GlobalWebSocketContextType | null>(null);

export const GlobalWebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [visualStatus, setVisualStatus] = useState<RealtimeVisualStatus>('INITIALIZING');
  
  const workerRef = useRef<Worker | null>(null);
  const gracePeriodTimerRef = useRef<any>(null);
  const queryClient = useQueryClient();
  const eventRouter = useMemo(() => new LiveEventRouter(queryClient), [queryClient]);
  const { token, isAuthenticated } = useAuth();

  // Expose globally for virtual contest routing
  useEffect(() => {
    (window as any).__liveEventRouter = eventRouter;
    return () => { (window as any).__liveEventRouter = undefined; };
  }, [eventRouter]);
  
  const callbacksRef = useRef<Map<string, (data: any) => void>>(new Map());

  const registerCallback = (id: string, callback: (data: any) => void) => {
    callbacksRef.current.set(id, callback);
  };

  const unregisterCallback = (id: string) => {
    callbacksRef.current.delete(id);
  };

  const sendMessage = (payload: any) => {
    if (workerRef.current && isConnected) {
      workerRef.current.postMessage({ type: 'SEND_MESSAGE', payload });
    }
  };

  useEffect(() => {
    let isMounted = true;
    let worker: Worker | null = null;

    // If user is logged out, cleanly terminate any running socket worker
    if (!isAuthenticated) {
      if (gracePeriodTimerRef.current) {
        clearTimeout(gracePeriodTimerRef.current);
        gracePeriodTimerRef.current = null;
      }
      if (workerRef.current) {
        workerRef.current.postMessage({ type: 'DISCONNECT' });
        workerRef.current.terminate();
        workerRef.current = null;
      }
      setIsConnected(false);
      setVisualStatus('INITIALIZING');
      return;
    }

    const envUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;
    let wsUrl: string;

    if (envUrl) {
      const targetHost = envUrl.replace(/^https?:\/\//, '').replace(/\/api\/?$/, '').replace(/\/+$/, '');
      const protocol = envUrl.startsWith('https') ? 'wss:' : 'ws:';
      wsUrl = `${protocol}//${targetHost}/ws/leaderboard`;
    } else {
      const loc = window.location;
      wsUrl = `${loc.protocol === 'https:' ? 'wss:' : 'ws:'}//${loc.host}/ws/leaderboard`;
    }

    if (token) {
      wsUrl += `?token=${encodeURIComponent(token)}`;
    }

    try {
      worker = new Worker(new URL('../workers/wsWorker.ts', import.meta.url), {
        type: 'module'
      });
      workerRef.current = worker;

      let wasConnected = false;

      worker.onmessage = (event) => {
        if (!isMounted) return;
        const { type, connected, updates, data } = event.data;

        if (type === 'WS_STATUS') {
          setIsConnected(connected);

          if (connected) {
            // Connection is healthy: cancel any pending disconnect grace timer immediately
            if (gracePeriodTimerRef.current) {
              clearTimeout(gracePeriodTimerRef.current);
              gracePeriodTimerRef.current = null;
            }
            setVisualStatus('LIVE');

            if (!wasConnected) {
              requestAnimationFrame(() => eventRouter.handleReconnect());
            }
            wasConnected = true;
          } else {
            // Connection dropped or initializing: apply 4-second Visual Grace Period
            // This prevents transient flashes during tab focus, token refresh, or double mounts
            if (!gracePeriodTimerRef.current) {
              gracePeriodTimerRef.current = setTimeout(() => {
                if (isMounted && !wasConnected) {
                  setVisualStatus('RECONNECTING');
                }
              }, 4000); // 4 Second Grace Period
            }
            wasConnected = false;
          }
        } else if (type === 'WS_BATCH_UPDATE') {
          requestAnimationFrame(() => {
            eventRouter.handleBatch(updates);
            callbacksRef.current.forEach(cb => {
              updates.forEach((u: any) => cb(u));
            });
          });
        } else if (type === 'WS_MESSAGE') {
          eventRouter.handleMessage(data);
          callbacksRef.current.forEach(cb => cb(data));
        }
      };

      worker.postMessage({ type: 'CONNECT', payload: { wsUrl } });

      const handleResume = () => {
        if (document.visibilityState === 'visible' && workerRef.current && isConnected) {
          // Socket is already open & live, no need to post redundant CONNECT
          return;
        }
        if (document.visibilityState === 'visible' && workerRef.current) {
          workerRef.current.postMessage({ type: 'CONNECT', payload: { wsUrl } });
        }
      };

      document.addEventListener('visibilitychange', handleResume);
      window.addEventListener('focus', handleResume);

      return () => {
        isMounted = false;
        if (gracePeriodTimerRef.current) {
          clearTimeout(gracePeriodTimerRef.current);
          gracePeriodTimerRef.current = null;
        }
        document.removeEventListener('visibilitychange', handleResume);
        window.removeEventListener('focus', handleResume);
        if (worker) {
          worker.postMessage({ type: 'DISCONNECT' });
          worker.terminate();
          workerRef.current = null;
        }
        setIsConnected(false);
      };
    } catch (err) {
      console.warn('Worker WS init exception:', err);
    }
  }, [eventRouter, token, isAuthenticated]);

  return (
    <GlobalWebSocketContext.Provider value={{ isConnected, visualStatus, registerCallback, unregisterCallback, sendMessage }}>
      {children}
    </GlobalWebSocketContext.Provider>
  );
};

export const useGlobalWebSocket = () => {
  const context = useContext(GlobalWebSocketContext);
  if (!context) {
    throw new Error('useGlobalWebSocket must be used within a GlobalWebSocketProvider');
  }
  return context;
};

