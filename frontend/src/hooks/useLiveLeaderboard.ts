import { useEffect, useState, useRef } from 'react';

export function useLiveLeaderboard(onUpdate?: (data: any) => void) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<any>(null);
  const onUpdateRef = useRef(onUpdate);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    let isMounted = true;
    let socket: WebSocket | null = null;
    let pingInterval: ReturnType<typeof setInterval> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const envUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;
    let wsUrl: string;

    if (isLocal && import.meta.env.DEV) {
      wsUrl = 'ws://127.0.0.1:8000/ws/leaderboard';
    } else if (envUrl) {
      const targetHost = envUrl.replace(/^https?:\/\//, '').replace(/\/api\/?$/, '').replace(/\/+$/, '');
      const protocol = envUrl.startsWith('https') ? 'wss:' : 'ws:';
      wsUrl = `${protocol}//${targetHost}/ws/leaderboard`;
    } else {
      const loc = window.location;
      wsUrl = `${loc.protocol === 'https:' ? 'wss:' : 'ws:'}//${loc.host}/ws/leaderboard`;
    }

    const connect = () => {
      if (!isMounted) return;

      try {
        socket = new WebSocket(wsUrl);

        socket.onopen = () => {
          if (!isMounted) {
            socket?.close();
            return;
          }
          setIsConnected(true);
          if (pingInterval) clearInterval(pingInterval);
          pingInterval = setInterval(() => {
            if (socket && socket.readyState === WebSocket.OPEN) {
              socket.send('ping');
            }
          }, 30000);
        };

        socket.onmessage = (event) => {
          if (!isMounted || event.data === 'pong') return;
          try {
            const data = JSON.parse(event.data);
            setLastMessage(data);
            if (onUpdateRef.current) onUpdateRef.current(data);
          } catch (e) {
            console.error('WebSocket parse error:', e);
          }
        };

        socket.onclose = () => {
          if (pingInterval) clearInterval(pingInterval);
          if (!isMounted) return;

          setIsConnected(false);
          // Auto reconnect after 5s if still mounted
          reconnectTimer = setTimeout(connect, 5000);
        };

        socket.onerror = (err) => {
          if (!isMounted) return;
          console.warn('WebSocket connection note:', err);
        };
      } catch (err) {
        if (!isMounted) return;
        console.warn('WebSocket init exception:', err);
        reconnectTimer = setTimeout(connect, 5000);
      }
    };

    connect();

    return () => {
      isMounted = false;
      if (pingInterval) clearInterval(pingInterval);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (socket) {
        // Remove event handlers to prevent triggering onclose/onerror during cleanup teardown
        socket.onopen = null;
        socket.onmessage = null;
        socket.onclose = null;
        socket.onerror = null;
        socket.close();
      }
      setIsConnected(false);
    };
  }, []);

  return { isConnected, lastMessage };
}

