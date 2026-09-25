// Lightweight localStorage Cache Manager for Student & Summary Data
// Eliminates ~300KB synchronous import of canonical static roster on initial bundle load

const CACHE_VERSION = '2026.09.25.v2'; // bumped: RBAC scoping fix — purge old unscoped caches

export function checkCacheVersion(): void {
  if (typeof window === 'undefined') return;
  try {
    const currentVersion = localStorage.getItem('nec_cache_version');
    if (currentVersion !== CACHE_VERSION) {
      localStorage.removeItem('nec_cached_students');
      localStorage.removeItem('nec_cached_summary');
      localStorage.setItem('nec_cache_version', CACHE_VERSION);
    }
  } catch (e) {
    console.warn('Could not check cache version:', e);
  }
}

function getLoggedInUser(): any {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function isFacultyUser(userObj?: any): boolean {
  const u = userObj || getLoggedInUser();
  if (!u || !u.role) return false;
  const roleClean = String(u.role).trim().toLowerCase();
  return ['staff', 'faculty', 'professor', 'faculty mentor', 'staff mentor', 'faculty_mentor', 'staff_mentor'].includes(roleClean);
}

export function getCachedStudents(userScope?: string | number): any[] {
  if (typeof window === 'undefined') return [];
  checkCacheVersion();
  try {
    const u = getLoggedInUser();
    const effectiveScope = userScope !== undefined ? String(userScope) : (u?.id ? String(u.id) : null);
    
    // For staff mentors / faculty, strictly use scoped cache key only
    if (isFacultyUser(u)) {
      if (!effectiveScope) return [];
      const scopedCached = localStorage.getItem(`nec_cached_students_${effectiveScope}`);
      if (scopedCached) {
        const parsed = JSON.parse(scopedCached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        // Empty or corrupt — purge and refetch
        localStorage.removeItem(`nec_cached_students_${effectiveScope}`);
      }
      return [];
    }

    const key = effectiveScope ? `nec_cached_students_${effectiveScope}` : 'nec_cached_students';
    const cached = localStorage.getItem(key);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Could not read cached students:', e);
  }
  return [];
}

export function saveCachedStudents(students: any[], userScope?: string | number): void {
  if (typeof window === 'undefined' || !Array.isArray(students)) return;
  try {
    const u = getLoggedInUser();
    const effectiveScope = userScope !== undefined ? String(userScope) : (u?.id ? String(u.id) : null);
    // For faculty: always store with user-scoped key. Backend already enforces the correct student boundary.
    const key = effectiveScope ? `nec_cached_students_${effectiveScope}` : 'nec_cached_students';
    localStorage.setItem(key, JSON.stringify(students));
    localStorage.setItem(`${key}_timestamp`, new Date().toISOString());
    localStorage.setItem('nec_cache_version', CACHE_VERSION);
  } catch (e) {
    console.warn('Could not save cached students to localStorage:', e);
  }
}

export function getCachedSummary(userScope?: string | number): any {
  if (typeof window === 'undefined') return { students: [], isStale: true, lastUpdated: null };
  checkCacheVersion();
  try {
    const u = getLoggedInUser();
    const effectiveScope = userScope !== undefined ? String(userScope) : (u?.id ? String(u.id) : null);
    if (isFacultyUser(u)) {
      if (!effectiveScope) return { students: [], isStale: true, lastUpdated: null };
      const scopedCached = localStorage.getItem(`nec_cached_summary_${effectiveScope}`);
      if (scopedCached) {
        const parsed = JSON.parse(scopedCached);
        if (parsed && typeof parsed === 'object') return parsed;
      }
      return { students: [], isStale: true, lastUpdated: null };
    }

    const key = effectiveScope ? `nec_cached_summary_${effectiveScope}` : 'nec_cached_summary';
    const cached = localStorage.getItem(key);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Could not read cached summary:', e);
  }
  return { students: [], isStale: true, lastUpdated: null };
}

export function saveCachedSummary(summary: any, userScope?: string | number): void {
  if (typeof window === 'undefined' || !summary) return;
  try {
    const u = getLoggedInUser();
    const effectiveScope = userScope !== undefined ? String(userScope) : (u?.id ? String(u.id) : null);
    const key = effectiveScope ? `nec_cached_summary_${effectiveScope}` : 'nec_cached_summary';
    localStorage.setItem(key, JSON.stringify(summary));
    localStorage.setItem(`${key}_timestamp`, new Date().toISOString());
    localStorage.setItem('nec_cache_version', CACHE_VERSION);
  } catch (e) {
    console.warn('Could not save cached summary to localStorage:', e);
  }
}

export async function getCanonicalRosterFallback(): Promise<any[]> {
  const { CANONICAL_ROSTER } = await import('../data/canonicalRoster');
  return CANONICAL_ROSTER;
}

export async function getCanonicalSummaryFallback(): Promise<any> {
  const { CANONICAL_SUMMARY } = await import('../data/canonicalRoster');
  return CANONICAL_SUMMARY;
}
