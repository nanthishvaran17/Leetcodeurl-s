// In-memory buffer for micro-batching window
let eventBuffer = new Map<string, any>();
let socket: WebSocket | null = null;
let pingInterval: any = null;
let batchTimeout: any = null;
let reconnectTimeout: any = null;
let currentWsUrl: string = '';
let retryCount: number = 0;
let isIntentionallyClosed: boolean = false;

const BATCH_WINDOW_MS = 50; // 50ms buffer window

const connect = (wsUrl?: string) => {
  if (wsUrl) {
    currentWsUrl = wsUrl;
  }
  const targetUrl = wsUrl || currentWsUrl;
  if (!targetUrl) return;

  isIntentionallyClosed = false;

  // 1. Idempotency Check: Avoid redundant connections if already OPEN or CONNECTING to the same URL
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
    socket = null;
  }

  try {
    socket = new WebSocket(targetUrl);

    socket.onopen = () => {
      retryCount = 0;
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
      
      // Start 15s keepalive ping interval
      if (pingInterval) clearInterval(pingInterval);
      pingInterval = setInterval(() => {
        if (socket && socket.readyState === WebSocket.OPEN) {
          try {
            socket.send('ping');
          } catch (_) {}
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

        // Buffer and deduplicate entity events that have an ID
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

    socket.onclose = (event) => {
      if (pingInterval) {
        clearInterval(pingInterval);
        pingInterval = null;
      }
      
      self.postMessage({ type: 'WS_STATUS', connected: false });
      
      // Only schedule auto-reconnect if connection was not intentionally closed on logout
      if (!isIntentionallyClosed && currentWsUrl) {
        if (reconnectTimeout) clearTimeout(reconnectTimeout);
        // Exponential backoff with jitter: 2s -> 4s -> 8s -> 15s max
        const baseDelay = Math.min(15000, Math.pow(2, retryCount) * 1000 + 1000);
        const jitter = Math.floor(Math.random() * 800);
        const backoffMs = baseDelay + jitter;
        retryCount++;
        
        reconnectTimeout = setTimeout(() => connect(currentWsUrl), backoffMs);
      }
    };
    
    socket.onerror = (err) => {
      console.warn('Worker WS error:', err);
    };
  } catch (err) {
    console.error('Worker WS connect exception:', err);
    self.postMessage({ type: 'WS_STATUS', connected: false });
    if (!isIntentionallyClosed && currentWsUrl) {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      reconnectTimeout = setTimeout(() => connect(currentWsUrl), 3000);
    }
  }
};

const flushBatch = () => {
  if (eventBuffer.size === 0) {
    batchTimeout = null;
    return;
  }
  
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
    isIntentionallyClosed = true;
    retryCount = 0;
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
    if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
    }
    if (batchTimeout) {
      clearTimeout(batchTimeout);
      batchTimeout = null;
    }
    if (socket) {
      try {
        socket.close();
      } catch (_) {}
      socket = null;
    }
    eventBuffer.clear();
  } else if (type === 'SEND_MESSAGE') {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(payload));
    } else {
      console.warn('Worker WS: Cannot send message, socket not open');
    }
  }
};

