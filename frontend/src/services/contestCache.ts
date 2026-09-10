import api from './api';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const MEMORY_CACHE = new Map<string, CacheEntry<any>>();
const IN_FLIGHT = new Map<string, Promise<any>>();

export interface ContestTelemetry {
  sessionId: number | string;
  contestNumber?: number;
  firstUiMs: number;
  summaryApiMs: number;
  questionsApiMs: number;
  rosterApiMs: number;
  analyticsApiMs?: number;
  totalReadyMs: number;
  cacheHit: boolean;
}

const telemetryLog: ContestTelemetry[] = [];

export function logContestTelemetry(telem: ContestTelemetry) {
  telemetryLog.push(telem);
  console.log(
    `%c⚡ [CONTEST PERFORMANCE] Contest ${telem.contestNumber || telem.sessionId} | First UI: ${telem.firstUiMs.toFixed(0)}ms | Summary: ${telem.summaryApiMs.toFixed(0)}ms | Questions: ${telem.questionsApiMs.toFixed(0)}ms | Roster: ${telem.rosterApiMs.toFixed(0)}ms | Total Ready: ${telem.totalReadyMs.toFixed(0)}ms | Cache: ${telem.cacheHit ? 'HIT (SWR)' : 'NETWORK'}`,
    'color: #00e676; font-weight: bold; background: #0f172a; padding: 4px 8px; border-radius: 6px;'
  );
}

export function getCachedContestData<T>(key: string, maxAgeMs: number = 30 * 60 * 1000): T | null {
  const entry = MEMORY_CACHE.get(key);
  if (!entry) return null;
  return entry.data;
}

export function setCachedContestData<T>(key: string, data: T) {
  MEMORY_CACHE.set(key, { data, timestamp: Date.now() });
}

export async function fetchWithCacheDedupe<T>(
  key: string,
  fetcher: (signal?: AbortSignal) => Promise<T>,
  options?: { signal?: AbortSignal; ttlMs?: number; force?: boolean }
): Promise<T> {
  if (!options?.force) {
    const cached = getCachedContestData<T>(key, options?.ttlMs);
    if (cached) return cached;
  }

  if (IN_FLIGHT.has(key)) {
    return IN_FLIGHT.get(key) as Promise<T>;
  }

  const promise = fetcher(options?.signal)
    .then((data) => {
      setCachedContestData(key, data);
      return data;
    })
    .finally(() => {
      IN_FLIGHT.delete(key);
    });

  IN_FLIGHT.set(key, promise);
  return promise;
}

export function prefetchContest(sessionId: number | string) {
  if (!sessionId) return;
  // Prefetch summary and questions in parallel with zero UI blocking
  fetchWithCacheDedupe(
    `contest_summary_${sessionId}`,
    () => api.get(`/contests/sessions/${sessionId}/summary`).then(r => r.data),
    { ttlMs: 15 * 60 * 1000 }
  ).catch(() => {});

  fetchWithCacheDedupe(
    `contest_questions_${sessionId}`,
    () => api.get(`/contests/sessions/${sessionId}/questions`).then(r => r.data),
    { ttlMs: 15 * 60 * 1000 }
  ).catch(() => {});
}

export function clearContestCache(sessionId?: number | string) {
  if (sessionId) {
    for (const k of Array.from(MEMORY_CACHE.keys())) {
      if (k.includes(String(sessionId))) {
        MEMORY_CACHE.delete(k);
      }
    }
  } else {
    MEMORY_CACHE.clear();
  }
}
