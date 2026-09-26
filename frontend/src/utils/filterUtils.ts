import { StudentData } from '../components/LeaderboardTable';

export type NormalizedDepartment = string;
export type NormalizedAcademicYear = 'all' | 'II' | 'III' | 'IV' | string;
export type PerformanceRangeKey = 'all' | '500_plus' | '251_500' | '101_250' | '1_100' | 'not_started';
export type SortByKey = 'top_solved' | 'low_solved' | 'name_asc' | 'name_desc' | 'streak' | 'rating' | string;

export const normalizeSearchValue = (value: unknown) =>
  String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");


/**
 * Normalizes any department reference (object, ID, name, code, string) to a canonical key.
 * Production Website operates strictly on CSE(CS) and CSE(IOT).
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

    if (dept.id === 1 || combined.includes('CYBER') || combined.includes('CSE(CS)') || combined.includes('CSE-CS') || combined.includes('CSE (CS)')) {
      return 'cse_cs';
    }
    if (dept.id === 2 || combined.includes('IOT') || combined.includes('CSE(IOT)') || combined.includes('CSE-IOT') || combined.includes('CSE (IOT)') || combined.includes('INTERNET')) {
      return 'cse_iot';
    }
    if (dept.id === 7 || code === 'IT' || combined.includes('INFORMATION TECHNOLOGY') || combined.includes('INFO TECH') || combined.includes('B.TECH IT') || combined.includes('B.TECH (IT)')) {
      return 'it';
    }

    if (code) return code.toLowerCase().replace(/[^a-z0-9]/g, '_');
    if (name) return name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    if (dept.id) return String(dept.id);
  }

  // If numeric ID (1 = Cyber Security, 2 = IoT, 7 = Information Technology)
  if (typeof dept === 'number' || (!isNaN(Number(dept)) && String(dept).trim() !== '')) {
    const numId = Number(dept);
    if (numId === 1) return 'cse_cs';
    if (numId === 2) return 'cse_iot';
    if (numId === 7) return 'it';
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
    if (clean === 'IT' || clean === '7' || clean.includes('INFORMATION TECHNOLOGY') || clean.includes('INFO TECH') || clean.includes('B.TECH IT') || clean.includes('B.TECH (IT)')) {
      return 'it';
    }

    return clean.toLowerCase().replace(/[^a-z0-9]/g, '_');
  }

  return 'unknown';
}

/**
 * Formats department for user display (Full Name)
 */
export function formatDepartmentName(dept: any): string {
  const norm = normalizeDepartment(dept);
  if (norm === 'cse_cs') return 'Computer Science and Engineering (Cyber Security)';
  if (norm === 'cse_iot') return 'Computer Science and Engineering (IoT)';
  if (norm === 'it') return 'Information Technology';
  if (norm === 'eee') return 'Electrical and Electronics Engineering';
  if (norm === 'ece') return 'Electronics and Communication Engineering';
  if (norm === 'mech') return 'Mechanical Engineering';
  if (norm === 'civil') return 'Civil Engineering';
  if (norm === 'aids') return 'Artificial Intelligence and Data Science';
  if (typeof dept === 'object' && dept) {
    return dept.name || dept.code || String(dept);
  }
  if (typeof dept === 'string' && dept.trim()) {
    const clean = dept.trim().toUpperCase();
    if (clean === 'IT') return 'Information Technology';
    if (clean === 'EEE') return 'Electrical and Electronics Engineering';
    if (clean === 'ECE') return 'Electronics and Communication Engineering';
    if (clean === 'MECH') return 'Mechanical Engineering';
    if (clean === 'CIVIL') return 'Civil Engineering';
    if (clean === 'AIDS') return 'Artificial Intelligence and Data Science';
    return dept;
  }
  return String(dept || '');
}

/**
 * Formats department for short pill display (Code)
 */
export function formatDepartmentCode(dept: any): string {
  const norm = normalizeDepartment(dept);
  if (norm === 'cse_cs') return 'CSE(CS)';
  if (norm === 'cse_iot') return 'CSE(IOT)';
  if (norm === 'it') return 'IT';
  if (typeof dept === 'object' && dept) {
    return dept.code || dept.name || String(dept);
  }
  if (typeof dept === 'string' && dept.trim()) {
    return dept;
  }
  return String(dept || '');
}


/**
 * Derives canonical Roman numeral year level ('I' | 'II' | 'III' | 'IV') from a student object or reg_no string
 * - 23 (e.g. 732223..., 23CC...) -> IV Year (Final Year)
 * - 24 (e.g. 732224..., 24CC...) -> III Year (3rd Year)
 * - 25 (e.g. 732225..., 25CC...) -> II Year (2nd Year)
 * - 26 (e.g. 732226..., 26CC...) -> I Year (1st Year)
 */
export function deriveYearLevelFromRegNo(regNoStr?: string, currentYearVal?: any): 'I' | 'II' | 'III' | 'IV' {
  const norm = (regNoStr || '').trim().toUpperCase();
  if (norm) {
    if (norm.includes('732223') || norm.includes('23CC') || norm.includes('23CI') || norm.includes('23CS') || norm.includes('23IT') || norm.includes('23AI') || norm.includes('23EC') || norm.includes('23EE') || norm.includes('23ME') || norm.includes('23AG')) {
      return 'IV';
    }
    if (norm.includes('732224') || norm.includes('24CC') || norm.includes('24CI') || norm.includes('24CS') || norm.includes('24IT') || norm.includes('24AI') || norm.includes('24EC') || norm.includes('24EE') || norm.includes('24ME') || norm.includes('24AG')) {
      return 'III';
    }
    if (norm.includes('732225') || norm.includes('73225') || norm.includes('25CC') || norm.includes('25CI') || norm.includes('25CS') || norm.includes('25IT') || norm.includes('25AI') || norm.includes('25EC') || norm.includes('25EE') || norm.includes('25ME') || norm.includes('25AG')) {
      return 'II';
    }
    if (norm.includes('732226') || norm.includes('26CC') || norm.includes('26CI') || norm.includes('26CS') || norm.includes('26IT') || norm.includes('26AI') || norm.includes('26EC') || norm.includes('26EE') || norm.includes('26ME') || norm.includes('26AG')) {
      return 'I';
    }
  }

  if (currentYearVal != null && currentYearVal !== '') {
    const valStr = String(currentYearVal).trim().toUpperCase();
    if (valStr === '1' || valStr === 'I' || valStr === '1ST' || valStr.includes('1ST')) return 'I';
    if (valStr === '2' || valStr === 'II' || valStr === '2ND' || valStr.includes('2ND')) return 'II';
    if (valStr === '3' || valStr === 'III' || valStr === '3RD' || valStr.includes('3RD')) return 'III';
    if (valStr === '4' || valStr === 'IV' || valStr === '4TH' || valStr.includes('4TH') || valStr.includes('FINAL')) return 'IV';
  }

  return 'III';
}

/**
 * Returns clean formatted year text (e.g. 'III Yr') for card badges and tables
 */
export function formatStudentYearBadge(student: any): string {
  if (!student) return 'III Yr';
  const yr = deriveYearLevelFromRegNo(student.reg_no, student.year_level || student.year);
  return `${yr} Yr`;
}

/**
 * Normalizes academic year variations to canonical '1' | '2' | '3' | '4' | 'all'
 */
export function normalizeAcademicYear(yr: any): NormalizedAcademicYear {
  if (!yr || yr === 'ALL' || yr === 'all' || yr === 'ALL YEARS' || yr === 'ALL_YEARS') {
    return 'all';
  }

  const raw = String(yr).trim().toUpperCase();
  const clean = raw.replace(/\b(YEAR|YR|BATCH|ST|ND|RD|TH)\b/gi, '').replace(/[\s\-\_]+/g, '').trim();

  if (['I', '1', '1ST', '2030'].includes(raw) || ['I', '1'].includes(clean)) return '1';
  if (['II', '2', '2ND', '2029'].includes(raw) || ['II', '2'].includes(clean)) return '2';
  if (['III', '3', '3RD', '2028'].includes(raw) || ['III', '3'].includes(clean)) return '3';
  if (['IV', '4', '4TH', '2027', '2026'].includes(raw) || ['IV', '4'].includes(clean)) return '4';

  return clean || raw;
}

/**
 * Formats a normalized academic year for display in the UI (e.g. 'Year III')
 */
export function formatAcademicYear(yr: any): string {
  const norm = normalizeAcademicYear(yr);
  if (norm === 'all') return 'All Academic Years';
  if (norm === '1') return 'Year I';
  if (norm === '2') return 'Year II';
  if (norm === '3') return 'Year III';
  if (norm === '4') return 'Year IV';
  return String(yr);
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
 * Department Theme Color Mapping — Each department gets its own vibrant, distinct theme!
 */
export function getDepartmentThemeColor(dept: any): { bg: string; text: string; border: string; pillBg: string; pillText: string } {
  const norm = normalizeDepartment(dept);
  
  if (norm === 'cse_iot') {
    return {
      bg: 'bg-orange-50 dark:bg-orange-950/40',
      text: 'text-orange-700 dark:text-orange-300',
      border: 'border-orange-200 dark:border-orange-800/60',
      pillBg: 'bg-orange-100 dark:bg-orange-900/60',
      pillText: 'text-orange-800 dark:text-orange-200'
    };
  }
  if (norm === 'cse_cs') {
    return {
      bg: 'bg-purple-50 dark:bg-purple-950/40',
      text: 'text-purple-700 dark:text-purple-300',
      border: 'border-purple-200 dark:border-purple-800/60',
      pillBg: 'bg-purple-100 dark:bg-purple-900/60',
      pillText: 'text-purple-800 dark:text-purple-200'
    };
  }
  if (norm === 'it') {
    return {
      bg: 'bg-emerald-50 dark:bg-emerald-950/40',
      text: 'text-emerald-700 dark:text-emerald-300',
      border: 'border-emerald-200 dark:border-emerald-800/60',
      pillBg: 'bg-emerald-100 dark:bg-emerald-900/60',
      pillText: 'text-emerald-800 dark:text-emerald-200'
    };
  }
  if (norm === 'ece') {
    return {
      bg: 'bg-fuchsia-50 dark:bg-fuchsia-950/40',
      text: 'text-fuchsia-700 dark:text-fuchsia-300',
      border: 'border-fuchsia-200 dark:border-fuchsia-800/60',
      pillBg: 'bg-fuchsia-100 dark:bg-fuchsia-900/60',
      pillText: 'text-fuchsia-800 dark:text-fuchsia-200'
    };
  }
  if (norm === 'eee') {
    return {
      bg: 'bg-amber-50 dark:bg-amber-950/40',
      text: 'text-amber-700 dark:text-amber-300',
      border: 'border-amber-200 dark:border-amber-800/60',
      pillBg: 'bg-amber-100 dark:bg-amber-900/60',
      pillText: 'text-amber-900 dark:text-amber-200'
    };
  }
  if (norm === 'aids' || norm === 'aiml') {
    return {
      bg: 'bg-teal-50 dark:bg-teal-950/40',
      text: 'text-teal-700 dark:text-teal-300',
      border: 'border-teal-200 dark:border-teal-800/60',
      pillBg: 'bg-teal-100 dark:bg-teal-900/60',
      pillText: 'text-teal-800 dark:text-teal-200'
    };
  }
  if (norm === 'agri') {
    return {
      bg: 'bg-rose-50 dark:bg-rose-950/40',
      text: 'text-rose-700 dark:text-rose-300',
      border: 'border-rose-200 dark:border-rose-800/60',
      pillBg: 'bg-rose-100 dark:bg-rose-900/60',
      pillText: 'text-rose-800 dark:text-rose-200'
    };
  }

  // Fallback (Indigo / Brand)
  return {
    bg: 'bg-indigo-50 dark:bg-indigo-950/40',
    text: 'text-indigo-700 dark:text-indigo-300',
    border: 'border-indigo-200 dark:border-indigo-800/60',
    pillBg: 'bg-indigo-100 dark:bg-indigo-900/60',
    pillText: 'text-indigo-800 dark:text-indigo-200'
  };
}

/**
 * Campus filter matching predicate (NEC vs NCT vs ALL)
 */
export function matchesCampus(student: any, selectedCampus: string): boolean {
  if (!selectedCampus || selectedCampus === 'all' || selectedCampus === 'ALL' || selectedCampus === 'ALL CAMPUSES') return true;
  const sCampus = (student?.institution_id || student?.campus || student?.college || 'NEC').toUpperCase();
  const target = selectedCampus.toUpperCase();
  if (target.includes('NCT') && sCampus.includes('NCT')) return true;
  if (target.includes('NEC') && (sCampus.includes('NEC') || !sCampus.includes('NCT'))) return true;
  return sCampus.includes(target);
}

/**
 * Academic Year filter matching predicate
 */
export function matchesAcademicYear(student: StudentData, selectedYear: string): boolean {
  const targetNorm = normalizeAcademicYear(selectedYear);
  if (targetNorm === 'all') return true;

  const derivedYear = deriveYearLevelFromRegNo(student.reg_no, student.year_level || (student as any).batch);
  const studentNorm = normalizeAcademicYear(derivedYear);
  if (studentNorm === targetNorm) return true;

  if (String((student as any).batch) === String(selectedYear)) return true;

  return false;
}

/**
 * Name & General search matching predicate
 */
export function matchesNameSearch(student: StudentData, search: string): boolean {
  const query = normalizeSearchValue(search);
  if (!query) return true;

  const deptStr = typeof student.department === 'string'
    ? student.department
    : (student.department?.name || '') + ' ' + (student.department?.code || '');

  const searchableValues = [
    student.name,
    student.reg_no,
    (student as any).roll_no,
    student.username || (student as any).leetcode_username,
    student.email,
    deptStr,
    student.year_level || (student as any).batch,
    student.section || (student as any).section
  ];

  return searchableValues.some((value) =>
    normalizeSearchValue(value).includes(query)
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
        const streakA = Number((a as any).streak_count ?? (a.stats as any)?.streak_count ?? (a as any).streak ?? 0);
        const streakB = Number((b as any).streak_count ?? (b.stats as any)?.streak_count ?? (b as any).streak ?? 0);
        return streakB - streakA;
      });

    case 'rating':
      return sorted.sort((a, b) => {
        const ratingA = Number((a.stats as any)?.contest_rating ?? (a as any).contest_rating ?? (a as any).rating ?? (a as any).contestRating ?? 0);
        const ratingB = Number((b.stats as any)?.contest_rating ?? (b as any).contest_rating ?? (b as any).rating ?? (b as any).contestRating ?? 0);
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
