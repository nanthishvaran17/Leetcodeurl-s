/**
 * commandCenterService.ts
 * ─────────────────────────────────────────────────────────────────
 * TypeScript API client for the Command Center CRUD & Analytics endpoints.
 * All endpoints backed by real-time SQLite database data.
 */

import api from './api';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DeptHealth {
  health_score: number;
  participation_score: number;
  consistency_score: number;
  growth_score: number;
  contest_performance_score: number;
  difficulty_progress_score: number;
  total_students: number;
  active_this_week: number;
  at_risk_count: number;
  improving_count: number;
  avg_rating: number;
  avg_solved: number;
}

export interface ExecutiveSummary {
  executive_title: string;
  timestamp: string;
  what_improved: string;
  what_declined: string;
  students_needing_attention: string;
  weakest_skill: string;
  recommended_intervention: string;
  management_action_item: string;
}

export interface DeptBenchmark {
  department_id: number;
  department_name: string;
  department_code: string;
  student_count: number;
  active_count: number;
  avg_rating: number;
  avg_solved: number;
  participation_rate_pct: number;
  health_score: number;
  growth_rate_pct: string;
}

export interface YearBenchmark {
  year: string;
  year_level: string;
  student_count: number;
  active_count: number;
  avg_rating: number;
  avg_solved: number;
  participation_pct: number;
  health_score: number;
}

export interface CommandCenterSummary {
  department_health: DeptHealth;
  executive_summary: ExecutiveSummary;
  benchmarks: {
    department_matrix: DeptBenchmark[];
    year_matrix: YearBenchmark[];
  };
  refreshed_at: string;
}

export interface StudentRecord {
  id: number;
  reg_no: string;
  name: string;
  year_level: string;
  department_id: number;
  department_name: string;
  department_code: string;
  leetcode_username: string;
  email: string;
  is_active: boolean;
  total_solved: number;
  contest_rating: number;
  easy_solved: number;
  medium_solved: number;
  hard_solved: number;
  last_updated: string;
}

export interface StudentListResponse {
  total: number;
  page: number;
  page_size: number;
  students: StudentRecord[];
}

export interface StudentAddPayload {
  reg_no: string;
  name: string;
  department_id: number;
  year_level: string;
  leetcode_username: string;
  email?: string;
  section_id?: number;
}

export interface StudentUpdatePayload {
  name?: string;
  department_id?: number;
  year_level?: string;
  leetcode_username?: string;
  email?: string;
}

export interface DepartmentRecord {
  id: number;
  name: string;
  code: string;
  student_count: number;
}

// ── API Functions ─────────────────────────────────────────────────────────────

/**
 * GET /api/command-center/summary
 * Returns live health score, executive summary, and benchmarks from DB.
 */
export async function getCommandCenterSummary(deptId?: number): Promise<CommandCenterSummary> {
  const params: Record<string, any> = {};
  if (deptId) params.dept_id = deptId;
  const res = await api.get('/api/command-center/summary', { params });
  return res.data;
}

/**
 * GET /api/command-center/students
 * Returns paginated, filtered student list with live LeetCode stats.
 */
export async function getCommandCenterStudents(params: {
  page?: number;
  page_size?: number;
  search?: string;
  dept_id?: number;
  year_level?: string;
  include_inactive?: boolean;
}): Promise<StudentListResponse> {
  const res = await api.get('/api/command-center/students', { params });
  return res.data;
}

/**
 * POST /api/command-center/students/add
 * Adds a new student with LeetCode username validation.
 */
export async function addStudent(payload: StudentAddPayload): Promise<{
  success: boolean;
  student_id: number;
  reg_no: string;
  message: string;
}> {
  const res = await api.post('/api/command-center/students/add', payload);
  return res.data;
}

/**
 * PUT /api/command-center/students/{reg_no}
 * Partial-update student metadata.
 */
export async function updateStudent(regNo: string, payload: StudentUpdatePayload): Promise<{
  success: boolean;
  reg_no: string;
  message: string;
  changed_fields: string[];
  resync_pending: boolean;
}> {
  const res = await api.put(`/api/command-center/students/${encodeURIComponent(regNo)}`, payload);
  return res.data;
}

/**
 * DELETE /api/command-center/students/{reg_no}
 * Soft-deletes student (sets is_active=False). Historical data preserved.
 */
export async function deleteStudent(regNo: string): Promise<{
  success: boolean;
  reg_no: string;
  name: string;
  message: string;
}> {
  const res = await api.delete(`/api/command-center/students/${encodeURIComponent(regNo)}`);
  return res.data;
}

/**
 * POST /api/command-center/students/{reg_no}/reactivate
 * Reactivates a previously soft-deleted student.
 */
export async function reactivateStudent(regNo: string): Promise<{ success: boolean; message: string }> {
  const res = await api.post(`/api/command-center/students/${encodeURIComponent(regNo)}/reactivate`);
  return res.data;
}

/**
 * GET /api/command-center/departments
 * Returns all real departments with live student counts.
 */
export async function getCommandCenterDepartments(): Promise<DepartmentRecord[]> {
  const res = await api.get('/api/command-center/departments');
  return res.data;
}

/**
 * GET /api/command-center/year-matrix
 * Returns real GROUP BY year_level benchmarking from DB.
 */
export async function getYearMatrix(): Promise<YearBenchmark[]> {
  const res = await api.get('/api/command-center/year-matrix');
  return res.data;
}

/**
 * POST /api/command-center/ai-query
 * Zero-hallucination natural language department query.
 */
export async function askCommandCenterAI(query: string): Promise<{
  query: string;
  answer: string;
  data_confidence: string;
  traceable_metrics: string[];
}> {
  const res = await api.post('/api/command-center/ai-query', { query });
  return res.data;
}
