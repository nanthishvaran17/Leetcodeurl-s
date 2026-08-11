import { useEffect, useState } from 'react';

export function useLiveLeaderboard(onUpdate?: (data: any) => void) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<any>(null);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // In prod use VITE_API_URL; in dev use backend port 8000 directly
    const apiUrl = import.meta.env.VITE_API_URL;
    const wsHost = apiUrl
      ? apiUrl.replace(/^https?:\/\//, '')
      : '127.0.0.1:8000';
    const wsUrl = `${protocol}//${wsHost}/ws/leaderboard`;

    let socket: WebSocket | null = null;
    let pingInterval: any = null;

    const connect = () => {
      try {
        socket = new WebSocket(wsUrl);

        socket.onopen = () => {
          setIsConnected(true);
          pingInterval = setInterval(() => {
            if (socket && socket.readyState === WebSocket.OPEN) {
              socket.send('ping');
            }
          }, 30000);
        };

        socket.onmessage = (event) => {
          if (event.data === 'pong') return;
          try {
            const data = JSON.parse(event.data);
            setLastMessage(data);
            if (onUpdate) onUpdate(data);
          } catch (e) {
            console.error('WebSocket parse error:', e);
          }
        };

        socket.onclose = () => {
          setIsConnected(false);
          if (pingInterval) clearInterval(pingInterval);
          // Auto reconnect after 5s
          setTimeout(connect, 5000);
        };

        socket.onerror = (err) => {
          console.warn('WebSocket connection note:', err);
        };
      } catch (err) {
        console.warn('WebSocket init exception:', err);
      }
    };

    connect();

    return () => {
      if (pingInterval) clearInterval(pingInterval);
      if (socket) socket.close();
    };
  }, []);

  return { isConnected, lastMessage };
}
