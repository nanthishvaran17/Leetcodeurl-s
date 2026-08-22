import { StudentData } from '../components/LeaderboardTable';

export type NormalizedDepartment = string;
export type NormalizedAcademicYear = 'all' | 'II' | 'III' | 'IV' | string;
export type PerformanceRangeKey = 'all' | '500_plus' | '251_500' | '101_250' | '1_100' | 'not_started';
export type SortByKey = 'top_solved' | 'low_solved' | 'name_asc' | 'name_desc' | 'streak' | 'rating' | string;

/**
 * Normalizes any department reference (object, ID, name, code, string) to a canonical key.
 * Handles all 12+ institutional departments accurately.
 */
export function normalizeDepartment(dept: any): string {
  if (!dept || dept === 'ALL' || dept === 'all' || dept === 'all_departments' || dept === 'ALL DEPARTMENTS') {
    return 'all';
  }

  // If object with id, name, or code
  if (typeof dept === 'object') {
    const code = (dept.code || '').trim().toUpperCase();
    const name = (dept.name || '').trim().toUpperCase();
    const combined = `${code} ${name}`.trim();

    if (combined.includes('CYBER') || combined.includes('CSE(CS)') || combined.includes('CSE-CS') || combined.includes('CSE (CS)')) {
      return 'cse_cs';
    }
    if (combined.includes('IOT') || combined.includes('CSE(IOT)') || combined.includes('CSE-IOT') || combined.includes('CSE (IOT)') || combined.includes('INTERNET')) {
      return 'cse_iot';
    }
    if (code === 'CSE' || combined.includes('COMPUTER SCIENCE')) return 'cse';
    if (code === 'IT' || combined.includes('INFORMATION TECH')) return 'it';
    if (code === 'AIDS' || code === 'AI&DS' || combined.includes('ARTIFICIAL INTELLIGENCE') || combined.includes('DATA SCIENCE')) return 'aids';
    if (code === 'AIML' || code === 'AI&ML' || combined.includes('MACHINE LEARNING')) return 'aiml';
    if (code === 'ECE' || combined.includes('ELECTRONICS AND COMM')) return 'ece';
    if (code === 'EEE' || combined.includes('ELECTRICAL AND ELECT')) return 'eee';
    if (code === 'AGRI' || combined.includes('AGRICULTUR')) return 'agri';
    if (code === 'MECH' || combined.includes('MECHANICAL')) return 'mech';
    if (code === 'CIVIL' || combined.includes('CIVIL')) return 'civil';
    if (code === 'BME' || combined.includes('BIOMEDICAL')) return 'bme';
    if (code === 'CHEM' || combined.includes('CHEMICAL')) return 'chem';

    if (code) return code.toLowerCase().replace(/[^a-z0-9]/g, '_');
    if (name) return name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    if (dept.id) return String(dept.id);
  }

  // If numeric ID
  if (typeof dept === 'number') {
    return String(dept);
  }

  // If string
  if (typeof dept === 'string') {
    const clean = dept.trim().toUpperCase();
    if (clean === 'ALL' || clean === 'ALL DEPARTMENTS' || clean === 'ALL_DEPARTMENTS') return 'all';

    if (clean.includes('CYBER') || clean.includes('CSE(CS)') || clean.includes('CSE-CS') || clean.includes('CSE (CS)')) {
      return 'cse_cs';
    }
    if (clean.includes('IOT') || clean.includes('CSE(IOT)') || clean.includes('CSE-IOT') || clean.includes('CSE (IOT)') || clean.includes('INTERNET')) {
      return 'cse_iot';
    }
    if (clean === 'CSE' || clean.includes('COMPUTER SCIENCE')) return 'cse';
    if (clean === 'IT' || clean.includes('INFORMATION TECHNOLOGY') || clean.includes('INFORMATION TECH')) return 'it';
    if (clean === 'AIDS' || clean === 'AI&DS' || clean === 'AI-DS' || clean.includes('ARTIFICIAL INTELLIGENCE') || clean.includes('DATA SCIENCE')) return 'aids';
    if (clean === 'AIML' || clean === 'AI&ML' || clean.includes('MACHINE LEARNING')) return 'aiml';
    if (clean === 'ECE' || clean.includes('ELECTRONICS AND COMMUNICATION') || clean.includes('ELECTRONICS & COMM')) return 'ece';
    if (clean === 'EEE' || clean.includes('ELECTRICAL AND ELECTRONICS') || clean.includes('ELECTRICAL & ELECT')) return 'eee';
    if (clean === 'AGRI' || clean.includes('AGRICULTURE') || clean.includes('AGRICULTURAL')) return 'agri';
    if (clean === 'MECH' || clean.includes('MECHANICAL')) return 'mech';
    if (clean === 'CIVIL' || clean.includes('CIVIL')) return 'civil';
    if (clean === 'BME' || clean.includes('BIOMEDICAL')) return 'bme';
    if (clean === 'CHEM' || clean.includes('CHEMICAL')) return 'chem';

    return clean.toLowerCase().replace(/[^a-z0-9]/g, '_');
  }

  return 'unknown';
}

/**
 * Normalizes academic year variations to canonical 'I' | 'II' | 'III' | 'IV' | 'all'
 */
export function normalizeAcademicYear(yr: any): NormalizedAcademicYear {
  if (!yr || yr === 'ALL' || yr === 'all' || yr === 'ALL YEARS' || yr === 'ALL_YEARS') {
    return 'all';
  }

  const clean = String(yr).trim().toUpperCase();

  if (clean === 'I' || clean === '1' || clean === '1ST' || clean === '1ST YEAR' || clean === 'I YEAR' || clean === '2029') return 'I';
  if (clean === 'II' || clean === '2' || clean === '2ND' || clean === '2ND YEAR' || clean === 'II YEAR' || clean === '2028') return 'II';
  if (clean === 'III' || clean === '3' || clean === '3RD' || clean === '3RD YEAR' || clean === 'III YEAR' || clean === '2027') return 'III';
  if (clean === 'IV' || clean === '4' || clean === '4TH' || clean === '4TH YEAR' || clean === 'IV YEAR' || clean === '2026') return 'IV';

  return clean;
}

/**
 * Safely extracts numeric solved count from student object
 */
export function getSolvedCount(student: StudentData): number {
  if (!student) return 0;
  const raw = student.stats?.total_solved ?? student.total_solved ?? (student as any).totalSolved;
  if (raw === null || raw === undefined) return 0;
  const num = Number(raw);
  return isNaN(num) ? 0 : Math.max(0, num);
}

/**
 * Department filter matching predicate
 */
export function matchesDepartment(student: StudentData, selectedDept: string | any): boolean {
  const targetNorm = normalizeDepartment(selectedDept);
  if (targetNorm === 'all') return true;

  if (typeof selectedDept === 'number' && student.department_id === selectedDept) {
    return true;
  }

  const studentNorm = normalizeDepartment(student.department ?? student.department_id);
  if (studentNorm === targetNorm) return true;

  const deptStr = typeof student.department === 'string' ? student.department : (student.department?.name || student.department?.code || '');
  const selStr = typeof selectedDept === 'string' ? selectedDept : (selectedDept?.name || selectedDept?.code || '');
  if (deptStr && selStr && String(deptStr).trim().toLowerCase() === String(selStr).trim().toLowerCase()) {
    return true;
  }

  return false;
}

/**
 * Academic Year filter matching predicate
 */
export function matchesAcademicYear(student: StudentData, selectedYear: string): boolean {
  const targetNorm = normalizeAcademicYear(selectedYear);
  if (targetNorm === 'all') return true;

  const studentNorm = normalizeAcademicYear(student.year_level || (student as any).batch);
  if (studentNorm === targetNorm) return true;

  if (String((student as any).batch) === String(selectedYear)) return true;

  return false;
}

/**
 * Name & General search matching predicate
 */
export function matchesNameSearch(student: StudentData, search: string): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;

  const name = String(student.name || '').toLowerCase();
  const regNo = String(student.reg_no || '').toLowerCase();
  const username = String(student.username || (student as any).leetcode_username || '').toLowerCase();
  const deptStr = typeof student.department === 'string'
    ? String(student.department).toLowerCase()
    : String((student.department?.name || '') + ' ' + (student.department?.code || '')).toLowerCase();
  const batchStr = String((student as any).batch || '').toLowerCase();

  return (
    name.includes(q) ||
    regNo.includes(q) ||
    username.includes(q) ||
    deptStr.includes(q) ||
    batchStr.includes(q)
  );
}

/**
 * Performance Range matching predicate using numeric values
 */
export function matchesPerformanceRange(student: StudentData, rangeKey: PerformanceRangeKey | string): boolean {
  if (!rangeKey || rangeKey === 'all') return true;
  const solved = getSolvedCount(student);

  switch (rangeKey) {
    case '500_plus':
    case 'above500':
      return solved >= 500;
    case '251_500':
    case 'between251And500':
      return solved >= 251 && solved <= 500;
    case '101_250':
    case 'between101And250':
      return solved >= 101 && solved <= 250;
    case '1_100':
    case 'between1And100':
      return solved >= 1 && solved <= 100;
    case 'not_started':
    case 'notStarted':
      return solved === 0;
    default:
      return true;
  }
}

/**
 * Applies deterministic sorting to a student array
 */
export function sortStudents(students: StudentData[], sortBy: SortByKey): StudentData[] {
  const sorted = [...students];

  switch (sortBy) {
    case 'top_solved':
      return sorted.sort((a, b) => {
        const diff = getSolvedCount(b) - getSolvedCount(a);
        if (diff !== 0) return diff;
        return (a.name || '').localeCompare(b.name || '');
      });

    case 'low_solved':
      return sorted.sort((a, b) => {
        const diff = getSolvedCount(a) - getSolvedCount(b);
        if (diff !== 0) return diff;
        return (a.name || '').localeCompare(b.name || '');
      });

    case 'name_asc':
      return sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    case 'name_desc':
      return sorted.sort((a, b) => (b.name || '').localeCompare(a.name || ''));

    case 'streak':
      return sorted.sort((a, b) => {
        const streakA = Number((a.stats as any)?.streak_count ?? (a as any).streak ?? 0);
        const streakB = Number((b.stats as any)?.streak_count ?? (b as any).streak ?? 0);
        return streakB - streakA;
      });

    case 'rating':
      return sorted.sort((a, b) => {
        const ratingA = Number(a.stats?.contest_rating ?? 0);
        const ratingB = Number(b.stats?.contest_rating ?? 0);
        return ratingB - ratingA;
      });

    default:
      return sorted;
  }
}

export interface FilterAndSortOptions {
  department?: string;
  academicYear?: string;
  nameSearch?: string;
  performanceRange?: string;
  sortBy?: string;
}

export interface PerformanceCounts {
  all: number;
  total: number;
  above500: number;
  between251And500: number;
  between101And250: number;
  between1And100: number;
  notStarted: number;
  '500_plus': number;
  '251_500': number;
  '101_250': number;
  '1_100': number;
  not_started: number;
}

export interface FilterAndSortResult {
  filteredAndSorted: StudentData[];
  counts: PerformanceCounts;
}

/**
 * Main filtering and sorting helper used by DepartmentDashboard & LandingPage
 */
export function filterAndSortStudents(
  students: StudentData[],
  options: FilterAndSortOptions
): FilterAndSortResult {
  if (!students || students.length === 0) {
    const emptyCounts: PerformanceCounts = {
      all: 0,
      total: 0,
      above500: 0,
      between251And500: 0,
      between101And250: 0,
      between1And100: 0,
      notStarted: 0,
      '500_plus': 0,
      '251_500': 0,
      '101_250': 0,
      '1_100': 0,
      not_started: 0
    };
    return {
      filteredAndSorted: [],
      counts: emptyCounts
    };
  }

  const dept = options.department || 'all';
  const year = options.academicYear || 'all';
  const search = options.nameSearch || '';
  const range = options.performanceRange || 'all';
  const sort = options.sortBy || 'top_solved';

  // Step 1: Base filter by Department + Academic Year + Search
  const baseFiltered = students.filter(s => {
    return (
      matchesDepartment(s, dept) &&
      matchesAcademicYear(s, year) &&
      matchesNameSearch(s, search)
    );
  });

  // Step 2: Compute performance counts on the base filtered cohort
  let above500 = 0;
  let between251And500 = 0;
  let between101And250 = 0;
  let between1And100 = 0;
  let notStarted = 0;

  for (const s of baseFiltered) {
    const solved = getSolvedCount(s);
    if (solved >= 500) above500++;
    else if (solved >= 251) between251And500++;
    else if (solved >= 101) between101And250++;
    else if (solved >= 1) between1And100++;
    else notStarted++;
  }

  const counts: PerformanceCounts = {
    all: baseFiltered.length,
    total: baseFiltered.length,
    above500,
    between251And500,
    between101And250,
    between1And100,
    notStarted,
    '500_plus': above500,
    '251_500': between251And500,
    '101_250': between101And250,
    '1_100': between1And100,
    not_started: notStarted
  };

  // Step 3: Filter by performance range
  const performanceFiltered = baseFiltered.filter(s => matchesPerformanceRange(s, range));

  // Step 4: Apply sort
  const filteredAndSorted = sortStudents(performanceFiltered, sort);

  return {
    filteredAndSorted,
    counts
  };
}
