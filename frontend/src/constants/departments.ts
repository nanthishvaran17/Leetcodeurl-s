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

export interface DepartmentConfig {
  id?: number;
  code: string;
  name: string;
  pillText: string;
}

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

  return true;
}
