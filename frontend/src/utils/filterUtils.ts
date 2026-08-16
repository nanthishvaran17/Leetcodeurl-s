import { StudentData } from '../components/LeaderboardTable';

export type NormalizedDepartment = 'all' | 'cyber_security' | 'iot' | 'unknown';
export type NormalizedAcademicYear = 'all' | 'II' | 'III' | 'IV' | string;
export type PerformanceRangeKey = 'all' | '500_plus' | '251_500' | '101_250' | '1_100' | 'not_started';

/**
 * Normalizes any department reference (object, ID, name, code, string) to a canonical key:
 * 'all' | 'cyber_security' | 'iot'
 */
export function normalizeDepartment(dept: any): NormalizedDepartment {
  if (!dept || dept === 'ALL' || dept === 'all' || dept === 'all_departments' || dept === 'ALL DEPARTMENTS') {
    return 'all';
  }

  // If object with id, name, or code
  if (typeof dept === 'object') {
    if (dept.id === 1) return 'cyber_security';
    if (dept.id === 2) return 'iot';

    const text = `${dept.code || ''} ${dept.name || ''}`.toUpperCase();
    if (text.includes('CYBER') || text.includes('CSE(CS)') || text.includes('CSE-CS') || text.includes('CSE (CS)')) {
      return 'cyber_security';
    }
    if (text.includes('IOT') || text.includes('CSE(IOT)') || text.includes('CSE-IOT') || text.includes('CSE (IOT)') || text.includes('INTERNET')) {
      return 'iot';
    }
  }

  // If numeric ID
  if (typeof dept === 'number') {
    if (dept === 1) return 'cyber_security';
    if (dept === 2) return 'iot';
  }

  // If string
  if (typeof dept === 'string') {
    const clean = dept.trim().toUpperCase();
    if (clean === 'ALL' || clean === 'ALL DEPARTMENTS' || clean === 'ALL_DEPARTMENTS') return 'all';
    if (clean === '1' || clean === 'CYBER_SECURITY' || clean === 'CYBER' || clean.includes('CYBER') || clean.includes('CSE(CS)') || clean.includes('CSE-CS')) {
      return 'cyber_security';
    }
    if (clean === '2' || clean === 'IOT' || clean.includes('IOT') || clean.includes('CSE(IOT)') || clean.includes('CSE-IOT') || clean.includes('INTERNET')) {
      return 'iot';
    }
  }

  return 'unknown';
}

/**
 * Normalizes academic year variations to canonical 'II' | 'III' | 'IV' | 'all'
 * Supports: '2', '3', '4', 'II', 'III', 'IV', 'II Year', '2nd Year', etc.
 */
export function normalizeAcademicYear(yr: any): NormalizedAcademicYear {
  if (!yr || yr === 'ALL' || yr === 'all' || yr === 'ALL YEARS' || yr === 'ALL_YEARS') {
    return 'all';
  }

  const clean = String(yr).trim().toUpperCase().replace(/YEAR/g, '').replace(/ST|ND|RD|TH/g, '').trim();
  if (clean === '2' || clean === 'II' || clean === 'SECOND') return 'II';
  if (clean === '3' || clean === 'III' || clean === 'THIRD') return 'III';
  if (clean === '4' || clean === 'IV' || clean === 'FOURTH') return 'IV';

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

  const studentNorm = normalizeDepartment(student.department ?? student.department_id);
  return studentNorm === targetNorm;
}

/**
 * Academic Year filter matching predicate
 */
export function matchesAcademicYear(student: StudentData, selectedYear: string): boolean {
  const targetNorm = normalizeAcademicYear(selectedYear);
  if (targetNorm === 'all') return true;

  const studentNorm = normalizeAcademicYear(student.year_level);
  return studentNorm === targetNorm;
}

/**
 * Performance Range matching predicate using numeric values
 * - 500+: solved >= 500
 * - 251–500: solved >= 251 && solved <= 500 (also handles 250..500)
 * - 101–250: solved >= 101 && solved <= 250
 * - 1–100: solved >= 1 && solved <= 100
 * - Not Started: solved === 0
 */
export function matchesPerformanceRange(student: StudentData, range: string): boolean {
  if (!range || range === 'all' || range === 'ALL') return true;
  const solved = getSolvedCount(student);

  switch (range) {
    case '500_plus':
    case 'above_500':
      return solved >= 500;
    case '251_500':
    case '250_500':
      return solved >= 250 && solved <= 500;
    case '101_250':
      return solved >= 101 && solved <= 250;
    case '1_100':
    case 'less_100':
      return solved >= 1 && solved <= 100;
    case 'not_started':
      return solved === 0;
    default:
      return true;
  }
}

/**
 * Dynamically computes performance range counts from a given cohort
 */
export function computePerformanceCounts(studentsCohort: StudentData[]) {
  let above500 = 0;
  let between251And500 = 0;
  let between101And250 = 0;
  let between1And100 = 0;
  let notStarted = 0;

  for (const s of studentsCohort) {
    const solved = getSolvedCount(s);
    if (solved >= 500) {
      above500++;
    } else if (solved >= 251 || solved === 250) {
      between251And500++;
    } else if (solved >= 101) {
      between101And250++;
    } else if (solved >= 1) {
      between1And100++;
    } else {
      notStarted++;
    }
  }

  return {
    total: studentsCohort.length,
    above500,
    between251And500,
    between101And250,
    between1And100,
    notStarted
  };
}

/**
 * Executes full filter pipeline: Raw Students -> Normalize -> Filter Department -> Filter Year -> Filter Performance -> Apply Sort
 */
export function filterAndSortStudents(
  students: StudentData[],
  filters: {
    department: string;
    academicYear: string;
    performanceRange: string;
    sortBy: string;
  }
): {
  filteredAndSorted: StudentData[];
  deptAndYearCohort: StudentData[];
  counts: ReturnType<typeof computePerformanceCounts>;
} {
  // Step 1: Department + Academic Year Cohort
  const deptAndYearCohort = students.filter(s =>
    matchesDepartment(s, filters.department) && matchesAcademicYear(s, filters.academicYear)
  );

  // Step 2: Calculate dynamic performance counts based strictly on current Dept + Year cohort
  const counts = computePerformanceCounts(deptAndYearCohort);

  // Step 3: Apply Performance Range Filter
  const performanceFiltered = deptAndYearCohort.filter(s =>
    matchesPerformanceRange(s, filters.performanceRange)
  );

  // Step 4: Apply Sort
  const filteredAndSorted = [...performanceFiltered].sort((a, b) => {
    const aSolved = getSolvedCount(a);
    const bSolved = getSolvedCount(b);
    const aRating = Number(a.stats?.contest_rating || 0);
    const bRating = Number(b.stats?.contest_rating || 0);
    const aStreak = Number(a.streak_count || 0);
    const bStreak = Number(b.streak_count || 0);

    switch (filters.sortBy) {
      case 'top_solved':
        return bSolved - aSolved;
      case 'low_solved':
        return aSolved - bSolved;
      case 'name_asc':
        return (a.name || '').localeCompare(b.name || '');
      case 'name_desc':
        return (b.name || '').localeCompare(a.name || '');
      case 'streak':
        return bStreak - aStreak;
      case 'rating':
        return bRating - aRating;
      default:
        return bSolved - aSolved;
    }
  });

  return {
    filteredAndSorted,
    deptAndYearCohort,
    counts
  };
}
