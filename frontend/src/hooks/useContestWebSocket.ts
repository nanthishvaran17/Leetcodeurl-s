import { useState, useEffect, useRef, useCallback } from 'react';

export interface ContestWSEvent {
  studentId?: number;
  regNo?: string;
  studentName?: string;
  username?: string;
  contestId?: string;
  sessionId?: number;
  q1?: number;
  q2?: number;
  q3?: number;
  q4?: number;
  solvedCount?: number;
  officialRank?: number;
  finishTime?: string;
  participationStatus?: string;
  timestamp?: string;
}

export interface LiveActivityEvent {
  event_id: string;
  version: number;
  timestamp: string;
  student_name: string;
  people_id: string;
  username: string;
  solved_count: number;
  text: string;
}

export interface StudentActivityUpdatePayload {
  event: string;
  type: string;
  contest_id: string;
  people_id: string;
  student_id: number;
  student_name: string;
  reg_no: string;
  account_id: string;
  event_id: string;
  version: number;
  timestamp: string;
  activity: {
    type: string;
    count: number;
    previousCount: number;
    q1: number;
    q2: number;
    q3: number;
    q4: number;
    score_display: string;
    activity_timeline_entry: {
      time: string;
      text: string;
    };
  };
}

export type ConnectionStatus = 'LIVE' | 'RECONNECTING' | 'OFFLINE';

export interface UseContestWebSocketOptions {
  sessionId?: number | string | null;
  contestId?: string | null;
  onBatchUpdate?: (events: any[]) => void;
  onSyncCompleted?: (event: any) => void;
}

export function useContestWebSocket(options: string | UseContestWebSocketOptions) {
  const targetId = typeof options === 'string' 
    ? options 
    : String(options?.contestId || options?.sessionId || '518');

  const onBatchUpdate = typeof options === 'object' ? options?.onBatchUpdate : undefined;
  const onSyncCompleted = typeof options === 'object' ? options?.onSyncCompleted : undefined;

  const [status, setStatus] = useState<ConnectionStatus>('OFFLINE');
  const [syncState, setSyncState] = useState<string>('IDLE');
  const [initialProgress, setInitialProgress] = useState<{ processed: number; total: number; percent: number } | null>(null);
  const [latestUpdate, setLatestUpdate] = useState<StudentActivityUpdatePayload | null>(null);
  const [liveFeed, setLiveFeed] = useState<LiveActivityEvent[]>([]);
  const [snapshotData, setSnapshotData] = useState<any>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const retryCountRef = useRef<number>(0);
  const lastVersionRef = useRef<number>(0);
  const processedEventsRef = useRef<Set<string>>(new Set());
  // Track the session ID we have subscribed to (used for reconnect SUBSCRIBE)
  const subscribedSessionRef = useRef<number | null>(null);

  const getWsUrl = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}/ws/contest/${targetId}`;
  }, [targetId]);

  const connect = useCallback(() => {
    if (!targetId) return;

    try {
      setStatus('RECONNECTING');
      const wsUrl = getWsUrl();
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus('LIVE');
        setLastSyncAt(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
        retryCountRef.current = 0;

        // Send session subscription if we have one
        if (subscribedSessionRef.current !== null) {
          ws.send(JSON.stringify({ action: 'SUBSCRIBE', session_id: subscribedSessionRef.current }));
        }

        if (lastVersionRef.current > 0) {
          ws.send(JSON.stringify({
            type: 'GET_MISSED_EVENTS',
            last_received_version: lastVersionRef.current
          }));
        } else {
          ws.send(JSON.stringify({ type: 'GET_SNAPSHOT' }));
        }
      };

      ws.onmessage = (event) => {
        try {
          if (event.data === 'pong') return;
          const data = JSON.parse(event.data);
          
          if (!data) return;

          if (data.type === 'BATCH_UPDATES' && Array.isArray(data.events)) {
            if (onBatchUpdate) onBatchUpdate(data.events);
            return;
          }

          if (data.type === 'SYNC_COMPLETED') {
            if (onSyncCompleted) onSyncCompleted(data);
            return;
          }

          if (data.event_id) {
            if (processedEventsRef.current.has(data.event_id)) {
              return;
            }
            processedEventsRef.current.add(data.event_id);
            if (processedEventsRef.current.size > 200) {
              const items = Array.from(processedEventsRef.current);
              processedEventsRef.current = new Set(items.slice(50));
            }
          }

          if (data.version && data.version > lastVersionRef.current) {
            lastVersionRef.current = data.version;
          }

          if (data.type === 'SNAPSHOT_RESPONSE') {
            setSnapshotData(data);
            setSyncState(data.sync_state || 'LIVE_SYNC_ACTIVE');
            if (data.live_feed) {
              setLiveFeed(data.live_feed);
            }
          } else if (data.type === 'INITIAL_SYNC_PROGRESS') {
            setSyncState('INITIAL_SYNC');
            setInitialProgress({
              processed: data.processed,
              total: data.total,
              percent: data.progress_percent
            });
          } else if (data.type === 'INITIAL_SYNC_COMPLETE') {
            setSyncState('LIVE_SYNC_ACTIVE');
            setInitialProgress(null);
          } else if (data.type === 'STUDENT_ACTIVITY_UPDATED') {
            setLatestUpdate(data);
            setLastSyncAt(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
            
            const feedItem: LiveActivityEvent = {
              event_id: data.event_id,
              version: data.version,
              timestamp: data.timestamp,
              student_name: data.student_name,
              people_id: data.people_id,
              username: data.account_id,
              solved_count: data.activity.count,
              text: data.activity.activity_timeline_entry.text
            };
            setLiveFeed(prev => [feedItem, ...prev.slice(0, 49)]);
          } else if (data.type === 'MISSED_EVENTS_RESPONSE') {
            if (Array.isArray(data.events)) {
              data.events.forEach((evt: StudentActivityUpdatePayload) => {
                setLatestUpdate(evt);
              });
            }
          } else if (data.type === 'VIRTUAL_RESULT_UPDATED' || data.type === 'VIRTUAL_ATTEMPT_STARTED') {
            // Forward virtual events to LiveEventRouter via DOM event bus
            setLastSyncAt(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
            window.dispatchEvent(new CustomEvent('ws_virtual_event', { detail: data }));
          } else if (data.type === 'SUBSCRIBED') {
            // Acknowledge subscription confirmation
            if (import.meta.env.DEV) {
              console.log('[WS_SUBSCRIBED] session_id=', data.session_id);
            }
          }
        } catch (err) {
          console.warn('[WS_PARSE_ERR]', err);
        }
      };

      ws.onclose = () => {
        setStatus('OFFLINE');
        wsRef.current = null;
        
        const backoffMs = Math.min(8000, Math.pow(2, retryCountRef.current) * 1000);
        retryCountRef.current += 1;
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, backoffMs);
      };

      ws.onerror = () => {
        setStatus('OFFLINE');
        ws.close();
      };
    } catch (e) {
      setStatus('OFFLINE');
    }
  }, [targetId, getWsUrl, onBatchUpdate, onSyncCompleted]);

  // Public method to subscribe to a session's events at runtime
  const subscribeSession = useCallback((sessionId: number) => {
    subscribedSessionRef.current = sessionId;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'SUBSCRIBE', session_id: sessionId }));
    }
  }, []);

  const unsubscribeSession = useCallback((sessionId: number) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'UNSUBSCRIBE', session_id: sessionId }));
    }
    if (subscribedSessionRef.current === sessionId) {
      subscribedSessionRef.current = null;
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);

  return {
    status,
    syncState,
    initialProgress,
    latestUpdate,
    liveFeed,
    snapshotData,
    lastSyncAt,
    subscribeSession,
    unsubscribeSession,
    wsRef
  };
}
