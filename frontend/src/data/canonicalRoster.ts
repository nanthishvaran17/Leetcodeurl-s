// Lightweight Canonical Roster & Instant Cache Provider
// CANONICAL_ROSTER data is lazily loaded on demand so initial JS bundle remains ultra-small.

export const CANONICAL_SUMMARY: any = {
  total_students: 297,
  verified_profiles: 291,
  pending_sync: 6,
  failed_sync: 0,
  total_problems_solved: 36590,
  active_solvers: 291
};

export function getCachedStudents(): any[] {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const cached = localStorage.getItem('nec_leetcode_students_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    }
  } catch (e) {
    console.warn('Could not read from localStorage:', e);
  }
  return [];
}

export async function getCanonicalRosterAsync(): Promise<any[]> {
  try {
    const mod = await import('./canonicalRosterData');
    return mod.CANONICAL_ROSTER || [];
  } catch (err) {
    console.warn('Dynamic canonical roster load notice:', err);
    return [];
  }
}

export function saveCachedStudents(students: any[]): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (Array.isArray(students) && students.length > 0) {
        localStorage.setItem('nec_leetcode_students_cache', JSON.stringify(students));
      }
    }
  } catch (e) {
    console.warn('Could not save to localStorage:', e);
  }
}

export function getCachedSummary(): any {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const cached = localStorage.getItem('nec_leetcode_summary_cache');
      if (cached) return JSON.parse(cached);
    }
  } catch (e) {
    console.warn('Could not read summary from localStorage:', e);
  }
  return CANONICAL_SUMMARY;
}

export function saveCachedSummary(summary: any): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('nec_leetcode_summary_cache', JSON.stringify(summary));
    }
  } catch (e) {
    console.warn('Could not save summary to localStorage:', e);
  }
}

export function getCanonicalSummary(): any {
  return CANONICAL_SUMMARY;
}
