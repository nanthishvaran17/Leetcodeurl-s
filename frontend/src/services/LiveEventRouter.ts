import { QueryClient } from '@tanstack/react-query';
import { studentLiveStore } from '../stores/studentLiveStore';

// DEV telemetry logging — logs critical sync pipeline steps
const DEV = import.meta.env.DEV;
function devLog(...args: any[]) {
  if (DEV) console.log('[LiveEventRouter]', ...args);
}

export class LiveEventRouter {
  private queryClient: QueryClient;
  private invalidateTimeouts: Map<string, any> = new Map();

  /**
   * Sequence guard map: prevents stale VIRTUAL_RESULT_UPDATED events from
   * overwriting fresher data in the contest matrix cache.
   * Key: `virtual_${sessionId}_${studentId}` → last accepted sequence (epoch ms)
   */
  private lastVirtualSequence: Map<string, number> = new Map();

  constructor(queryClient: QueryClient) {
    this.queryClient = queryClient;
  }

  // Debounced invalidation + refetch — ensures cache re-syncs with server after batch changes
  private debouncedInvalidate(queryKey: any[], delay: number = 300) {
    const keyStr = JSON.stringify(queryKey);
    if (this.invalidateTimeouts.has(keyStr)) {
      clearTimeout(this.invalidateTimeouts.get(keyStr));
    }
    
    const timeout = setTimeout(() => {
      this.queryClient.invalidateQueries({
        queryKey,
        refetchType: 'active', // Only refetch if currently being observed
      });
      this.invalidateTimeouts.delete(keyStr);
    }, delay);
    
    this.invalidateTimeouts.set(keyStr, timeout);
  }

  /**
   * Sequence guard for virtual events.
   * Returns true if the incoming sequence is newer than the last accepted one for this scope.
   * Automatically updates the map when accepting.
   */
  private isVirtualEventFresh(sessionId: number, studentId: number, sequence: number): boolean {
    const key = `virtual_${sessionId}_${studentId}`;
    const last = this.lastVirtualSequence.get(key) ?? 0;
    if (sequence <= last) {
      devLog(`[SEQ_DROP] Dropping stale virtual event seq=${sequence} for ${key} (last=${last})`);
      return false;
    }
    this.lastVirtualSequence.set(key, sequence);
    return true;
  }

  /**
   * Surgically patch a single student's contest result row in the React Query
   * contest matrix cache. Only the changed student's object reference changes —
   * all other rows keep their references (structural sharing via RQ).
   *
   * Cache key convention: ['contests', 'matrix', sessionId]
   * Shape expected: { items: any[], total: number, metrics: any, ... }
   */
  private patchContestMatrixRow(
    sessionId: number,
    studentId: number,
    changes: Record<string, any>
  ) {
    const cacheKey = ['contests', 'matrix', sessionId];
    this.queryClient.setQueryData(cacheKey, (prev: any) => {
      if (!prev) return prev;
      const items: any[] = prev.items || prev.rows || [];
      if (!items.length) return prev;

      const idStr = String(studentId);
      let patched = false;
      const nextItems = items.map((row: any) => {
        if (String(row.student_id) !== idStr) return row;
        patched = true;
        devLog(`[MATRIX_PATCH] Patching contest matrix row student=${studentId} session=${sessionId}`, changes);
        return { ...row, ...changes };
      });

      if (!patched) return prev; // student not found in current page — no mutation
      return { ...prev, items: nextItems };
    });
  }

  /**
   * Patch the React Query canonical cache for a single student update.
   * This is O(n) on the canonical array but keeps RQ as the source of truth.
   * Structural sharing in RQ means unchanged entries keep their references.
   */
  private patchCanonicalStudent(
    studentId: string | number,
    changes: Record<string, any>,
    incomingVersion?: number
  ) {
    const idStr = String(studentId);
    this.queryClient.setQueryData(
      ['students', 'canonical'],
      (prev: any[] | undefined) => {
        if (!prev) return prev;

        let patched = false;
        const next = prev.map(s => {
          if (String(s.id) !== idStr) return s; // preserve reference for unchanged

          // Version guard — never apply stale events
          const liveVersion = s.version || 0;
          const rqVersion = incomingVersion || 0;
          if (rqVersion > 0 && rqVersion < liveVersion) {
            devLog(`Skipping stale event version=${rqVersion} for student=${idStr} (live=${liveVersion})`);
            return s;
          }

          patched = true;
          devLog(`Patching canonical cache: student=${idStr}`, changes);

          // Deep-merge stats if changes include stats-level fields
          const merged: any = { ...s };
          if (changes.stats) {
            merged.stats = { ...(s.stats || {}), ...changes.stats };
          }
          // Apply top-level fields from changes
          Object.entries(changes).forEach(([k, v]) => {
            if (k !== 'stats') merged[k] = v;
          });
          if (incomingVersion) merged.version = incomingVersion;

          return merged;
        });

        if (!patched) return prev; // No mutation — keep same reference
        return next;
      }
    );
  }

  /**
   * Add a brand new student to the React Query canonical cache.
   * Used when STUDENT_CREATED arrives via WebSocket.
   */
  private addToCanonicalCache(student: any) {
    this.queryClient.setQueryData(
      ['students', 'canonical'],
      (prev: any[] | undefined) => {
        if (!prev) return prev;
        const exists = prev.some(s => String(s.id) === String(student.id));
        if (exists) return prev;
        devLog(`Adding new student=${student.id} to canonical cache`);
        return [...prev, student];
      }
    );
  }

  /**
   * Remove a student from the React Query canonical cache.
   */
  private removeFromCanonicalCache(studentId: string | number) {
    const idStr = String(studentId);
    this.queryClient.setQueryData(
      ['students', 'canonical'],
      (prev: any[] | undefined) => {
        if (!prev) return prev;
        const next = prev.filter(s => String(s.id) !== idStr);
        if (next.length === prev.length) return prev;
        devLog(`Removed student=${idStr} from canonical cache`);
        return next;
      }
    );
  }

  public handleBatch(events: any[]) {
    if (!events || events.length === 0) return;
    
    const batchStartTime = performance.now();
    const serverTimestamps: number[] = [];

    const affectedDepartments = new Set<number>();
    let shouldInvalidateStaff = false;
    let shouldInvalidateContests = false;
    let shouldInvalidateDashboards = false;

    events.forEach(event => {
      const { type, entityId, student_id, staff_id, changes, data, version, server_timestamp } = event;
      const effectiveId = entityId || student_id || staff_id;
      
      if (server_timestamp) {
          serverTimestamps.push(server_timestamp);
      }

      switch (type) {
        case 'STUDENT_CREATED':
          if (data) {
            // 1. Add to live store for instant render
            studentLiveStore.addStudent(data);
            // 2. Add to RQ canonical cache so it persists across reconcile calls
            this.addToCanonicalCache(data);
            shouldInvalidateDashboards = true;
            if (data.department_id) affectedDepartments.add(data.department_id);
          }
          break;

        case 'STUDENT_UPDATED':
        case 'leaderboard_update': // legacy support
          if (effectiveId) {
            const student = studentLiveStore.getStudent(effectiveId);
            
            // 1. Patch the live store (O(1) — only re-renders the changed row)
            studentLiveStore.updateStudent(effectiveId, {
              ...changes,
              version
            });

            // 2. ALSO patch React Query canonical cache (keeps RQ as source of truth)
            // Without this, SYNC_COMPLETE reconcile would overwrite WS updates with stale RQ data
            this.patchCanonicalStudent(effectiveId, changes || {}, version);

            shouldInvalidateDashboards = true;
            if (student && student.department_id) {
              affectedDepartments.add(student.department_id);
            }
          }
          break;

        case 'STUDENT_BATCH_UPDATED':
          if (event.updates && Array.isArray(event.updates)) {
            event.updates.forEach((update: any) => {
              const uId = update.id;
              if (!uId) return;
              const student = studentLiveStore.getStudent(uId);
              
              // We mimic the changes payload structure expected by store/RQ
              const simulatedChanges = {
                reg_no: update.reg_no,
                name: update.name,
                username: update.username,
                stats: {
                  total_solved: update.stats?.total_solved ?? update.total_solved,
                  sync_status: update.stats?.sync_status ?? update.sync_status,
                  status: update.stats?.status ?? update.status,
                  last_verified_at: update.stats?.last_verified_at ?? update.last_verified_at ?? event.timestamp
                }
              };
              
              const v = update.version;
              studentLiveStore.updateStudent(uId, { ...simulatedChanges, version: v });
              this.patchCanonicalStudent(uId, simulatedChanges, v);

              shouldInvalidateDashboards = true;
              if (student && student.department_id) {
                affectedDepartments.add(student.department_id);
              }
            });
          }
          break;

        case 'STUDENT_DELETED':
          if (effectiveId) {
            const student = studentLiveStore.getStudent(effectiveId);
            if (student && student.department_id) {
              affectedDepartments.add(student.department_id);
            }
            // 1. Remove from live store
            studentLiveStore.deleteStudent(effectiveId);
            // 2. Remove from RQ canonical cache
            this.removeFromCanonicalCache(effectiveId);
            shouldInvalidateDashboards = true;
          }
          break;

        case 'sync_progress':
          if (event.student_update && event.student_update.id) {
            const u = event.student_update;
            const uId = u.id;
            const student = studentLiveStore.getStudent(uId);

            const simulatedChanges = {
              reg_no: u.reg_no,
              name: u.name,
              username: u.username,
              total_solved: u.total_solved,
              easy_solved: u.easy_solved,
              medium_solved: u.medium_solved,
              hard_solved: u.hard_solved,
              contest_rating: u.contest_rating,
              stats: {
                total_solved: u.total_solved,
                easy_solved: u.easy_solved,
                medium_solved: u.medium_solved,
                hard_solved: u.hard_solved,
                contest_rating: u.contest_rating,
                sync_status: u.sync_status || u.status,
                status: u.status,
                last_verified_at: event.timestamp || new Date().toISOString()
              }
            };

            const v = u.version || 1;
            studentLiveStore.updateStudent(uId, { ...simulatedChanges, version: v });
            this.patchCanonicalStudent(uId, simulatedChanges, v);

            shouldInvalidateDashboards = true;
            if (student && student.department_id) {
              affectedDepartments.add(student.department_id);
            }
          }
          break;

        case 'sync_complete':
        case 'SYNC_COMPLETED':
        case 'IMPORT_COMPLETED':
          shouldInvalidateDashboards = true;
          this.debouncedInvalidate(['students', 'canonical'], 100);
          this.debouncedInvalidate(['departments'], 100);
          break;

        case 'STAFF_CREATED':
        case 'STAFF_UPDATED':
        case 'STAFF_DELETED':
          shouldInvalidateStaff = true;
          break;
          
        case 'CONTEST_RESULT_UPDATED':
        case 'CONTEST_SUMMARY_UPDATED':
          shouldInvalidateContests = true;
          break;

        default:
          devLog('Unhandled batch event:', type, event);
      }
    });

    // Targeted invalidations only — never queryClient.invalidateQueries() with no key
    if (shouldInvalidateStaff) {
      this.debouncedInvalidate(['staff']);
      this.debouncedInvalidate(['users']);
    }

    if (shouldInvalidateContests) {
      this.debouncedInvalidate(['contests']);
    }

    if (shouldInvalidateDashboards) {
      this.debouncedInvalidate(['dashboard', 'summary']);
      this.debouncedInvalidate(['dashboard', 'metrics']);
      window.dispatchEvent(new Event('refresh_dashboard_summary'));
    }

    affectedDepartments.forEach(deptId => {
      this.debouncedInvalidate(['department', deptId, 'summary']);
    });

    // Latency Telemetry
    if (serverTimestamps.length > 0) {
        const avgServerTime = serverTimestamps.reduce((a, b) => a + b, 0) / serverTimestamps.length;
        const now = Date.now();
        const totalNetworkLatency = now - avgServerTime;
        const cacheUpdateTime = performance.now() - batchStartTime;
        
        devLog(
          `${events.length} events | Network: ~${Math.max(0, totalNetworkLatency).toFixed(0)}ms | ` +
          `Cache patch: ${cacheUpdateTime.toFixed(1)}ms | TOTAL: ~${(Math.max(0, totalNetworkLatency) + cacheUpdateTime).toFixed(0)}ms`
        );
    }
  }

  public handleMessage(event: any) {
    const { type } = event;
    devLog('handleMessage:', type, event);
    
    switch (type) {
      case 'STUDENT_BATCH_UPDATED':
      case 'STUDENT_UPDATED':
        this.handleBatch([event]);
        break;

      case 'VIRTUAL_RESULT_UPDATED': {
        // Direct single-event delivery (not batched) from VIRTUAL_RESULT_UPDATED
        const { session_id, student_id, metrics, sequence = 0, version } = event;
        if (!session_id || !student_id) break;

        if (!this.isVirtualEventFresh(session_id, student_id, sequence)) break;

        // Surgically patch the contest matrix row — zero full re-fetch
        this.patchContestMatrixRow(session_id, student_id, {
          participation_status: 'VIRTUAL',
          status: 'VIRTUAL',
          q1: metrics?.q1 ?? 0,
          q2: metrics?.q2 ?? 0,
          q3: metrics?.q3 ?? 0,
          q4: metrics?.q4 ?? 0,
          total_solved: metrics?.solved_count ?? 0,
          total_contest_solved: metrics?.solved_count ?? 0,
          version,
        });

        // Debounced aggregate metrics refresh (triggers re-fetch of full metrics block)
        this.debouncedInvalidate(['contests', 'matrix', session_id], 500);
        devLog(`[VIRTUAL_RESULT_UPDATED] session=${session_id} student=${student_id} solved=${metrics?.solved_count}`);
        break;
      }

      case 'VIRTUAL_ATTEMPT_STARTED': {
        const { session_id } = event;
        if (session_id) {
          // Debounced invalidation so the virtual attempt count reflects in the UI
          this.debouncedInvalidate(['contests', 'virtual-attempts', session_id], 300);
        }
        devLog('[VIRTUAL_ATTEMPT_STARTED]', event);
        break;
      }

      case 'IMPORT_COMPLETED':
        // A new import happened — we must refetch the full canonical list and reconcile
        devLog('IMPORT_COMPLETED: forcing canonical refetch');
        this.queryClient.invalidateQueries({
          queryKey: ['students', 'canonical'],
          refetchType: 'active',
        });
        this.debouncedInvalidate(['dashboard']);
        this.debouncedInvalidate(['department']);
        break;
        
      case 'SYNC_COMPLETED':
      case 'sync_complete':
        // Sync is done — force the authoritative refetch from the backend.
        // When the new data arrives, LeaderboardTable's useEffect will call
        // studentLiveStore.reconcile(), completing the full pipeline:
        //   DB → RQ canonical cache → reconcile → live store → filters → UI
        devLog('SYNC_COMPLETED: forcing canonical refetch for full reconciliation');
        this.queryClient.invalidateQueries({
          queryKey: ['students', 'canonical'],
          refetchType: 'active',
        });
        this.debouncedInvalidate(['dashboard', 'summary']);
        this.debouncedInvalidate(['sync']);
        window.dispatchEvent(new Event('refresh_dashboard_summary'));
        break;
        
      default:
        devLog('Unhandled single WS message:', type);
    }
  }

  public handleReconnect(subscribedSessionId?: number) {
    devLog('WebSocket reconnected. Performing targeted reconciliation...');
    // Invalidate everything that might have changed while offline.
    // The canonical student refetch triggers reconcile, keeping the live store fresh.
    this.queryClient.invalidateQueries({
      queryKey: ['students', 'canonical'],
      refetchType: 'active',
    });
    this.debouncedInvalidate(['dashboard']);
    this.debouncedInvalidate(['contests']);
    this.debouncedInvalidate(['staff']);

    // If we were watching a specific session, refresh its matrix
    if (subscribedSessionId) {
      this.debouncedInvalidate(['contests', 'matrix', subscribedSessionId], 200);
    }
  }
}
