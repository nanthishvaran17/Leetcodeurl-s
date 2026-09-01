import { useSyncExternalStore } from 'react';
import { StudentEntity } from '../types/student';

// Define the store structure
let byId: Record<string, StudentEntity> = {};
let allIds: string[] = [];
let storeVersion = 0; // Global store revision counter
let listeners = new Set<() => void>();
let studentListeners = new Map<string, Set<() => void>>();

// Helper to notify general listeners (e.g. for list changes)
const notifyGeneral = () => {
  storeVersion++;
  listeners.forEach((listener) => listener());
};

// Helper to notify specific student row listeners
const notifyStudent = (id: string) => {
  const cbs = studentListeners.get(id);
  if (cbs) {
    cbs.forEach((listener) => listener());
  }
};

export const studentLiveStore = {
  getVersion() {
    return storeVersion;
  },

  // Initialize the store with data fetched from the backend (React Query)
  init(students: StudentEntity[]) {
    const newById: Record<string, StudentEntity> = {};
    const newAllIds: string[] = [];
    
    students.forEach(s => {
      const idStr = String(s.id);
      newById[idStr] = s;
      newAllIds.push(idStr);
    });

    byId = newById;
    allIds = newAllIds;
    notifyGeneral(); // Tell anyone mapping over allIds to re-render
  },

  // Deterministically reconcile incoming canonical students with the live store
  reconcile(students: StudentEntity[]) {
    let hasChanges = false;
    const incomingIds = new Set<string>();

    students.forEach(incoming => {
      const idStr = String(incoming.id);
      incomingIds.add(idStr);
      const existing = byId[idStr];

      if (!existing) {
        // New student
        byId[idStr] = incoming;
        allIds.push(idStr);
        hasChanges = true;
      } else {
        if (existing !== incoming) {
           const liveVersion = existing.version || 0;
           const rqVersion = incoming.version || 0;

           if (rqVersion > liveVersion || (rqVersion === liveVersion && JSON.stringify(existing) !== JSON.stringify(incoming))) {
             byId[idStr] = incoming;
             notifyStudent(idStr);
             hasChanges = true;
           }
        }
      }
    });

    // Remove deleted students
    const initialCount = allIds.length;
    allIds = allIds.filter(id => {
      if (!incomingIds.has(id)) {
        delete byId[id];
        return false;
      }
      return true;
    });

    if (allIds.length !== initialCount) {
      hasChanges = true;
    }

    if (hasChanges) {
      notifyGeneral();
    }
  },

  // Incremental patch for a single student (O(1) update)
  updateStudent(id: string | number, patch: Partial<StudentEntity>) {
    const idStr = String(id);
    const prev = byId[idStr];
    if (!prev) return; // Ignore if student doesn't exist

    // Optimistic Version Check
    if (patch.version && prev.version && patch.version < prev.version) {
        return; // Ignore stale event
    }

    const merged = { ...prev, ...patch };
    if (patch.stats && prev.stats) {
      merged.stats = { ...prev.stats, ...patch.stats };
    }
    // Promote top-level total_solved if stats has total_solved
    if (merged.stats?.total_solved !== undefined && merged.stats.total_solved !== null) {
      (merged as any).total_solved = merged.stats.total_solved;
    }
    if ((patch as any).total_solved !== undefined && (patch as any).total_solved !== null) {
      (merged as any).total_solved = (patch as any).total_solved;
      if (merged.stats) merged.stats.total_solved = (patch as any).total_solved;
    }

    byId[idStr] = merged;
    
    // Notify ONLY the single row component observing this specific ID
    notifyStudent(idStr);

    // Also notify general list listeners so filtered & sorted lists re-evaluate immediately
    notifyGeneral();
  },

  // Subscribe to whole-list changes (e.g., length or data changed)
  subscribeList(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  // Subscribe to single-student changes (for memoized rows)
  subscribeStudent(id: string | number, listener: () => void) {
    const idStr = String(id);
    if (!studentListeners.has(idStr)) {
      studentListeners.set(idStr, new Set());
    }
    studentListeners.get(idStr)!.add(listener);
    return () => studentListeners.get(idStr)!.delete(listener);
  },

  getAllIds() {
    return allIds;
  },

  getStudent(id: string | number) {
    return byId[String(id)];
  },
  
  // Gets the full map for workers/utils
  getAllEntities() {
      return byId;
  },

  addStudent(student: StudentEntity) {
    const idStr = String(student.id);
    if (byId[idStr]) return; // Already exists
    
    byId[idStr] = student;
    allIds = [...allIds, idStr];
    notifyGeneral();
  },

  deleteStudent(id: string | number) {
    const idStr = String(id);
    if (!byId[idStr]) return;
    
    const newById = { ...byId };
    delete newById[idStr];
    
    byId = newById;
    allIds = allIds.filter(i => i !== idStr);
    notifyGeneral();
  }
};

// --- Custom Hooks for Components ---

// For store version state (triggers re-render when ANY student data updates)
export function useStudentStoreVersion() {
  return useSyncExternalStore(
    studentLiveStore.subscribeList,
    studentLiveStore.getVersion
  );
}

// For the parent list (only re-renders when list of IDs changes)
export function useStudentListIds() {
  return useSyncExternalStore(
    studentLiveStore.subscribeList,
    studentLiveStore.getAllIds
  );
}

// For individual rows (only re-renders when this exact ID changes)
export function useStudentEntity(id: string | number) {
  return useSyncExternalStore(
    (onStoreChange) => studentLiveStore.subscribeStudent(id, onStoreChange),
    () => studentLiveStore.getStudent(id)
  );
}
