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
}

interface UseContestWebSocketProps {
  sessionId: number | null;
  onResultUpdate?: (event: ContestWSEvent) => void;
  onSummaryUpdate?: (event: ContestWSEvent) => void;
}

export function useContestWebSocket({ sessionId, onResultUpdate, onSummaryUpdate }: UseContestWebSocketProps) {
  const onResultRef = useRef(onResultUpdate);
  const onSummaryRef = useRef(onSummaryUpdate);
  useEffect(() => { onResultRef.current = onResultUpdate; }, [onResultUpdate]);
  useEffect(() => { onSummaryRef.current = onSummaryUpdate; }, [onSummaryUpdate]);

  const [lastEvent, setLastEvent] = useState<ContestWSEvent | null>(null);
  const [eventCount, setEventCount] = useState(0);

  const handleMessage = useCallback((data: ContestWSEvent) => {
    if (!data?.type) return;
    if (sessionId && data.sessionId && Number(data.sessionId) !== Number(sessionId)) return;
    setLastEvent(data);
    if (data.type === 'CONTEST_RESULT_UPDATED') {
      setEventCount(prev => prev + 1);
      if (onResultRef.current) onResultRef.current(data);
    } else if (data.type === 'CONTEST_SUMMARY_UPDATED') {
      if (onSummaryRef.current) onSummaryRef.current(data);
    }
  }, [sessionId]);

  const { isConnected } = useLiveLeaderboard(handleMessage);
  return { isConnected, lastEvent, eventCount, wsStatus: isConnected ? 'connected' : 'disconnected' };
}
