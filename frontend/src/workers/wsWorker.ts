// In-memory buffer for the micro-batching window
let eventBuffer = new Map<string, any>();
let socket: WebSocket | null = null;
let pingInterval: any = null;
let batchTimeout: any = null;
let reconnectTimeout: any = null;
let currentWsUrl: string = '';

const BATCH_WINDOW_MS = 50; // 50ms buffer window

const connect = (wsUrl: string) => {
  if (wsUrl) currentWsUrl = wsUrl;
  const targetUrl = wsUrl || currentWsUrl;
  if (!targetUrl) return;

  if (socket) {
    if (socket.readyState === WebSocket.OPEN) {
      self.postMessage({ type: 'WS_STATUS', connected: true });
      return;
    }
    if (socket.readyState === WebSocket.CONNECTING) {
      return;
    }
    try {
      socket.close();
    } catch (_) {}
  }

  try {
    socket = new WebSocket(targetUrl);

    socket.onopen = () => {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
      if (pingInterval) clearInterval(pingInterval);
      pingInterval = setInterval(() => {
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send('ping');
        }
      }, 15000);
      
      self.postMessage({ type: 'WS_STATUS', connected: true });
    };

    socket.onmessage = (event) => {
      if (event.data === 'pong') return;
      
      try {
        const data = JSON.parse(event.data);
        
        // Real-time notifications & messaging bypass micro-batching for instant delivery (<1ms)
        if (data.type === 'NEW_NOTIFICATION' || data.type === 'notification' || data.type === 'NEW_MESSAGE' || data.type === 'MESSAGE_STATUS_UPDATE') {
          self.postMessage({ type: 'WS_MESSAGE', data });
          return;
        }

        // We buffer and deduplicate entity events that have an ID
        const entityId = data.entityId || data.student_id || data.staff_id || data.id;
        
        if (entityId) {
          const dedupKey = `${data.type}:${entityId}`;
          eventBuffer.set(dedupKey, data);
          
          if (!batchTimeout) {
            batchTimeout = setTimeout(flushBatch, BATCH_WINDOW_MS);
          }
        } else {
          self.postMessage({ type: 'WS_MESSAGE', data });
        }
      } catch (e) {
        console.error('Worker WS parse error', e);
      }
    };

    socket.onclose = () => {
      if (pingInterval) clearInterval(pingInterval);
      self.postMessage({ type: 'WS_STATUS', connected: false });
      
      // Fast 2-second auto-reconnect
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (currentWsUrl) {
        reconnectTimeout = setTimeout(() => connect(currentWsUrl), 2000);
      }
    };
    
    socket.onerror = (err) => {
      console.warn('Worker WS error:', err);
    };
  } catch (err) {
    console.error('Worker WS connect exception:', err);
    if (reconnectTimeout) clearTimeout(reconnectTimeout);
    if (currentWsUrl) {
      reconnectTimeout = setTimeout(() => connect(currentWsUrl), 3000);
    }
  }
};

const flushBatch = () => {
  if (eventBuffer.size === 0) {
    batchTimeout = null;
    return;
  }
  
  // Extract values, clear buffer, and send to main thread in ONE message
  const updates = Array.from(eventBuffer.values());
  eventBuffer.clear();
  batchTimeout = null;
  
  self.postMessage({ 
    type: 'WS_BATCH_UPDATE', 
    updates 
  });
};

self.onmessage = (event: MessageEvent) => {
  const { type, payload } = event.data;
  
  if (type === 'CONNECT') {
    connect(payload?.wsUrl);
  } else if (type === 'DISCONNECT') {
    if (reconnectTimeout) clearTimeout(reconnectTimeout);
    if (pingInterval) clearInterval(pingInterval);
    if (batchTimeout) clearTimeout(batchTimeout);
    if (socket) {
      socket.close();
      socket = null;
    }
  } else if (type === 'SEND_MESSAGE') {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(payload));
    } else {
      console.warn('Worker WS: Cannot send message, socket not open');
    }
  }
};
