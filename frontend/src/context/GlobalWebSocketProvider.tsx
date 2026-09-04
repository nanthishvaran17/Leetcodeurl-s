import React, { createContext, useContext, useEffect, useMemo, useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { LiveEventRouter } from '../services/LiveEventRouter';

interface GlobalWebSocketContextType {
  isConnected: boolean;
  registerCallback: (id: string, callback: (data: any) => void) => void;
  unregisterCallback: (id: string) => void;
}

const GlobalWebSocketContext = createContext<GlobalWebSocketContextType | null>(null);

export const GlobalWebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const queryClient = useQueryClient();
  const eventRouter = useMemo(() => new LiveEventRouter(queryClient), [queryClient]);

  // Expose globally so WeeklyContestPage's ws_virtual_event listener can route
  // virtual contest events through the established handleMessage pipeline.
  // This avoids prop drilling and context changes while keeping the router singleton.
  useEffect(() => {
    (window as any).__liveEventRouter = eventRouter;
    return () => { (window as any).__liveEventRouter = undefined; };
  }, [eventRouter]);
  
  // Store callbacks by an arbitrary ID so multiple hooks can listen safely if needed.
  const callbacksRef = useRef<Map<string, (data: any) => void>>(new Map());

  const registerCallback = (id: string, callback: (data: any) => void) => {
    callbacksRef.current.set(id, callback);
  };

  const unregisterCallback = (id: string) => {
    callbacksRef.current.delete(id);
  };

  useEffect(() => {
    let isMounted = true;
    let worker: Worker | null = null;

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

    try {
      worker = new Worker(new URL('../workers/wsWorker.ts', import.meta.url), {
        type: 'module'
      });

      let wasConnected = false;

      worker.onmessage = (event) => {
        if (!isMounted) return;
        const { type, connected, updates, data } = event.data;

        if (type === 'WS_STATUS') {
          setIsConnected(connected);
          if (connected && !wasConnected) {
             requestAnimationFrame(() => eventRouter.handleReconnect());
          }
          wasConnected = connected;
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

    } catch (err) {
      console.warn('Worker WS init exception:', err);
    }

    return () => {
      isMounted = false;
      if (worker) {
        worker.postMessage({ type: 'DISCONNECT' });
        worker.terminate();
      }
      setIsConnected(false);
    };
  }, [eventRouter]);

  return (
    <GlobalWebSocketContext.Provider value={{ isConnected, registerCallback, unregisterCallback }}>
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
