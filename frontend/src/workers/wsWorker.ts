// In-memory buffer for the micro-batching window
let eventBuffer = new Map<string, any>();
let socket: WebSocket | null = null;
let pingInterval: any = null;
let batchTimeout: any = null;

const BATCH_WINDOW_MS = 50; // 50ms buffer window

const connect = (wsUrl: string) => {
  if (socket) {
    socket.close();
  }

  socket = new WebSocket(wsUrl);

  socket.onopen = () => {
    if (pingInterval) clearInterval(pingInterval);
    pingInterval = setInterval(() => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send('ping');
      }
    }, 30000);
    
    self.postMessage({ type: 'WS_STATUS', connected: true });
  };

  socket.onmessage = (event) => {
    if (event.data === 'pong') return;
    
    try {
      const data = JSON.parse(event.data);
      
      // We buffer and deduplicate events that have an ID
      const entityId = data.entityId || data.student_id || data.staff_id || data.id;
      
      if (entityId) {
        // Use a composite key to deduplicate identical entity updates for the same event type
        const dedupKey = `${data.type}:${entityId}`;
        eventBuffer.set(dedupKey, data);
        
        if (!batchTimeout) {
          batchTimeout = setTimeout(flushBatch, BATCH_WINDOW_MS);
        }
      } else {
        // Other events (like generic sync broadcasts) pass through immediately
        self.postMessage({ type: 'WS_MESSAGE', data });
      }
    } catch (e) {
      console.error('Worker WS parse error', e);
    }
  };

  socket.onclose = () => {
    if (pingInterval) clearInterval(pingInterval);
    self.postMessage({ type: 'WS_STATUS', connected: false });
    // Attempt auto-reconnect
    setTimeout(() => connect(wsUrl), 5000);
  };
  
  socket.onerror = (err) => {
    console.warn('Worker WS error:', err);
  };
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
    connect(payload.wsUrl);
  } else if (type === 'DISCONNECT') {
    if (socket) {
      socket.close();
      socket = null;
    }
    if (pingInterval) clearInterval(pingInterval);
    if (batchTimeout) clearTimeout(batchTimeout);
  }
};
