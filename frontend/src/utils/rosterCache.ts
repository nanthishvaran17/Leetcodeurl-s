// Lightweight localStorage Cache Manager for Student & Summary Data
// Eliminates ~300KB synchronous import of canonical static roster on initial bundle load

const CACHE_VERSION = '2026.09.06.v1';

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

export function getCachedStudents(): any[] {
  if (typeof window === 'undefined') return [];
  checkCacheVersion();
  try {
    const cached = localStorage.getItem('nec_cached_students');
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

export function saveCachedStudents(students: any[]): void {
  if (typeof window === 'undefined' || !Array.isArray(students)) return;
  try {
    localStorage.setItem('nec_cached_students', JSON.stringify(students));
    localStorage.setItem('nec_cached_students_timestamp', new Date().toISOString());
    localStorage.setItem('nec_cache_version', CACHE_VERSION);
  } catch (e) {
    console.warn('Could not save cached students to localStorage:', e);
  }
}

export function getCachedSummary(): any {
  if (typeof window === 'undefined') return null;
  checkCacheVersion();
  try {
    const cached = localStorage.getItem('nec_cached_summary');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Could not read cached summary:', e);
  }
  return null;
}

export function saveCachedSummary(summary: any): void {
  if (typeof window === 'undefined' || !summary) return;
  try {
    localStorage.setItem('nec_cached_summary', JSON.stringify(summary));
    localStorage.setItem('nec_cached_summary_timestamp', new Date().toISOString());
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
