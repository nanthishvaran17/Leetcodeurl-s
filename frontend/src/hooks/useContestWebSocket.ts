import { useEffect, useCallback, useRef, useState } from 'react';
import { useLiveLeaderboard } from './useLiveLeaderboard';

export interface ContestWSEvent {
  type: string;
  studentId?: number;
  studentName?: string;
  regNo?: string;
  dept?: string;
  departmentName?: string;
  yearLevel?: string;
  contestId?: string;
  sessionId?: number;
  q1?: number;
  q2?: number;
  q3?: number;
  q4?: number;
  solvedCount?: number;
  officialRank?: number;
  participationStatus?: string;
  metrics?: Record<string, any>;
  detail?: string;
  rank?: number;
  rankChange?: number;
  timestamp?: string;
  events?: ContestWSEvent[]; // for BATCH_UPDATES
}

interface UseContestWebSocketProps {
  sessionId: number | null;
  onResultUpdate?: (event: ContestWSEvent) => void;
  onSummaryUpdate?: (event: ContestWSEvent) => void;
  onBatchUpdate?: (events: ContestWSEvent[]) => void;
  onSyncCompleted?: (event: ContestWSEvent) => void;
}

export function useContestWebSocket({ sessionId, onResultUpdate, onSummaryUpdate, onBatchUpdate, onSyncCompleted }: UseContestWebSocketProps) {
  const onResultRef = useRef(onResultUpdate);
  const onSummaryRef = useRef(onSummaryUpdate);
  const onBatchRef = useRef(onBatchUpdate);
  const onSyncCompletedRef = useRef(onSyncCompleted);

  useEffect(() => { onResultRef.current = onResultUpdate; }, [onResultUpdate]);
  useEffect(() => { onSummaryRef.current = onSummaryUpdate; }, [onSummaryUpdate]);
  useEffect(() => { onBatchRef.current = onBatchUpdate; }, [onBatchUpdate]);
  useEffect(() => { onSyncCompletedRef.current = onSyncCompleted; }, [onSyncCompleted]);

  const [lastEvent, setLastEvent] = useState<ContestWSEvent | null>(null);
  const [eventCount, setEventCount] = useState(0);

  const handleMessage = useCallback((data: ContestWSEvent) => {
    if (!data?.type) return;

    if (data.type === 'SYNC_COMPLETED') {
      if (onSyncCompletedRef.current) onSyncCompletedRef.current(data);
      return;
    }

    if (data.type === 'BATCH_UPDATES' && data.events) {
      // Filter events by session ID if required
      const validEvents = sessionId 
        ? data.events.filter(e => !e.sessionId || Number(e.sessionId) === Number(sessionId))
        : data.events;
      
      if (validEvents.length === 0) return;

      const resultEvents = validEvents.filter(e => e.type === 'CONTEST_RESULT_UPDATED');
      const summaryEvents = validEvents.filter(e => e.type === 'CONTEST_SUMMARY_UPDATED');

      if (resultEvents.length > 0) {
        setEventCount(prev => prev + resultEvents.length);
        setLastEvent(resultEvents[resultEvents.length - 1]);
        if (onBatchRef.current) {
          onBatchRef.current(resultEvents);
        } else if (onResultRef.current) {
          // Fallback if no batch handler is provided
          resultEvents.forEach(e => onResultRef.current!(e));
        }
      }

      if (summaryEvents.length > 0 && onSummaryRef.current) {
        // Typically summaries are just the latest aggregates, so we just process them
        summaryEvents.forEach(e => onSummaryRef.current!(e));
      }
      return;
    }

    // Handle legacy single events
    if (sessionId && data.sessionId && Number(data.sessionId) !== Number(sessionId)) return;
    setLastEvent(data);
    
    if (data.type === 'CONTEST_RESULT_UPDATED') {
      setEventCount(prev => prev + 1);
      if (onBatchRef.current) {
        onBatchRef.current([data]);
      } else if (onResultRef.current) {
        onResultRef.current(data);
      }
    } else if (data.type === 'CONTEST_SUMMARY_UPDATED') {
      if (onSummaryRef.current) onSummaryRef.current(data);
    }
  }, [sessionId]);

  const { isConnected } = useLiveLeaderboard(handleMessage);
  return { isConnected, lastEvent, eventCount, wsStatus: isConnected ? 'connected' : 'disconnected' };
}

