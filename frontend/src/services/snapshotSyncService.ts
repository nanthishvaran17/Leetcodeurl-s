/**
 * snapshotSyncService.ts — FRONTEND LATEST SNAPSHOT SYNCHRONIZATION & CROSS-TAB BROADCAST
 * =======================================================================================
 * Enforces strict "Latest Successful Snapshot" behavior across all tabs, page opens,
 * and background updates without requiring user logout, login, or manual browser refresh.
 */

import api from './api';

export interface SnapshotVersionInfo {
  data_version: number;
  snapshot_id: string;
  synced_at: string;
  status: string;
  contest_name?: string;
  student_count?: number;
  dataset_hash?: string;
}

type SnapshotCallback = (info: SnapshotVersionInfo) => void;

class SnapshotSyncService {
  private currentVersion: number = 0;
  private listeners: Set<SnapshotCallback> = new Set();
  private broadcastChannel: BroadcastChannel | null = null;
  private pollIntervalId: any = null;

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.broadcastChannel = new BroadcastChannel('LEETCODE_STATS_SYNC');
      this.broadcastChannel.onmessage = (event) => {
        if (event.data && event.data.type === 'NEW_SNAPSHOT_PUBLISHED') {
          const newVer = event.data.info?.data_version;
          if (newVer && newVer > this.currentVersion) {
            this.currentVersion = newVer;
            this.notifyListeners(event.data.info);
          }
        }
      };
    }

    if (typeof window !== 'undefined') {
      // Revalidate version when tab regains focus or visibility
      window.addEventListener('focus', () => this.checkLatestVersion());
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.checkLatestVersion();
        }
      });
    }

    // Adaptive background check (every 30s)
    this.startPolling(30000);
  }

  public getCurrentVersion(): number {
    return this.currentVersion;
  }

  public setCurrentVersion(ver: number) {
    this.currentVersion = ver;
  }

  public subscribe(cb: SnapshotCallback): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private notifyListeners(info: SnapshotVersionInfo) {
    this.listeners.forEach((cb) => {
      try {
        cb(info);
      } catch (err) {
        console.error('[SNAPSHOT_SYNC] Error in listener callback:', err);
      }
    });
  }

  public async checkLatestVersion(): Promise<SnapshotVersionInfo | null> {
    try {
      const res = await api.get<SnapshotVersionInfo>('/stats/version');

      const latestInfo = res.data;
      if (latestInfo && latestInfo.data_version) {
        if (this.currentVersion === 0) {
          this.currentVersion = latestInfo.data_version;
        } else if (latestInfo.data_version > this.currentVersion) {
          console.log(`[SNAPSHOT_SYNC] New Authoritative Snapshot detected: V${latestInfo.data_version} (was V${this.currentVersion})`);
          this.currentVersion = latestInfo.data_version;
          
          // Broadcast to all other browser tabs
          if (this.broadcastChannel) {
            this.broadcastChannel.postMessage({
              type: 'NEW_SNAPSHOT_PUBLISHED',
              info: latestInfo
            });
          }

          this.notifyListeners(latestInfo);
        }
        return latestInfo;
      }
    } catch (_err) {
      // Silent fail during network transitions
    }
    return null;
  }

  public startPolling(intervalMs: number = 30000) {
    if (this.pollIntervalId) clearInterval(this.pollIntervalId);
    this.pollIntervalId = setInterval(() => this.checkLatestVersion(), intervalMs);
  }

  public stopPolling() {
    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }
  }
}

export const snapshotSyncService = new SnapshotSyncService();
