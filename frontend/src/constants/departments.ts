/**
 * Centralized Production Department Configuration.
 * The production website operates strictly using the canonical academic departments of Nandha Engineering College.
 */

export interface DepartmentConfig {
  id?: number;
  code: string;
  name: string;
  pillText: string;
}

export const PRODUCTION_DEPARTMENTS: DepartmentConfig[] = [
  {
    id: 1,
    code: 'CSE(CS)',
    name: 'Computer Science and Engineering (Cyber Security)',
    pillText: 'CSE(CS)'
  },
  {
    id: 2,
    code: 'CSE(IOT)',
    name: 'Computer Science and Engineering (IoT)',
    pillText: 'CSE(IOT)'
  }
];

export const ALLOWED_DEPT_CODES = ['CSE(CS)', 'CSE(IOT)'];

export function isProductionDepartment(dept: any): boolean {
  if (!dept) return false;

  let code = '';
  let name = '';

  if (typeof dept === 'object') {
    code = (dept.code || '').trim().toUpperCase();
    name = (dept.name || '').trim().toUpperCase();
  } else if (typeof dept === 'string') {
    code = dept.trim().toUpperCase();
    name = dept.trim().toUpperCase();
  }

  // Reject any test/demo/dev department
  if (code.includes('TEST') || name.includes('TEST') || code.includes('DEMO') || name.includes('DEMO')) {
    return false;
  }

  if (code === 'CSE' && !code.includes('CS') && !code.includes('IOT')) {
    return false; // reject unspecialized legacy test record
  }

  // Match canonical codes or names
  if (code === 'CSE(CS)' || code === 'CSE-CS' || name.includes('CYBER')) return true;
  if (code === 'CSE(IOT)' || code === 'CSE-IOT' || name.includes('IOT') || name.includes('INTERNET OF THINGS')) return true;

  return false;
}
