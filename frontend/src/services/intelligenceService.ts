import api from './api';

export interface DigitalCodingProfile {
  student_id: number;
  name: string;
  reg_no: string;
  department: string;
  department_code: string;
  year_level: string;
  overall_score: number;
  contest_skill: number;
  dsa_skill: number;
  consistency_score: number;
  growth_rate_pct: number;
  current_level: string;
  next_recommended_skill: string;
  strong_areas: string[];
  weak_areas: string[];
  dsa_topic_scores: Record<string, number>;
  contest_readiness: {
    contest_readiness_score: number;
    speed_score: number;
    accuracy_score: number;
    medium_problems_pct: number;
    hard_problems_pct: number;
    consistency_pct: number;
    status: string;
    recommendation: string;
  };
  consistency_intelligence: {
    consistency_score: number;
    active_days_label: string;
    active_days_count: number;
    longest_streak_days: number;
    weekly_average_problems: number;
    inactive_periods_count: number;
  };
  risk_engine: {
    risk_score: number;
    risk_level: string;
    is_silent_disengaged: boolean;
    disengagement_drop_pct: number;
    evidence: string[];
    explanation: string;
    recommended_action: string;
    confidence_pct: number;
  };
  learning_path: {
    title: string;
    status: string;
    current_week: number;
    weeks: Array<{
      week_number: number;
      title: string;
      focus_topic: string;
      target_problems: { easy: number; medium: number; hard: number; total: number };
      recommended_problem_titles: string[];
      goal: string;
      completed: boolean;
    }>;
  };
}

export interface AttentionItem {
  id: string;
  student_id: number;
  student_name: string;
  reg_no: string;
  dept_code: string;
  category: string;
  severity: string;
  title: string;
  reason: string;
  recommended_action: string;
  action_type: string;
}

export interface ActionQueueItem {
  id: number;
  student_id: number;
  student_name: string;
  reg_no: string;
  dept_code: string;
  priority: string;
  reason: string;
  recommended_action: string;
  status: string;
  category: string;
  created_at: string;
}

export interface SystemAlertItem {
  id: number;
  alert_type: 'CRITICAL' | 'WARNING' | 'ATTENTION' | 'ACHIEVEMENT';
  title: string;
  message: string;
  action_label?: string;
  action_route?: string;
  is_read: boolean;
  is_resolved: boolean;
  created_at: string;
}

export const getStudentDigitalProfile = async (studentId: number): Promise<DigitalCodingProfile> => {
  const response = await api.get(`/intelligence/student/${studentId}/digital-profile`);
  return response.data;
};

export const getFacultyAttentionItems = async (deptId?: number) => {
  const response = await api.get('/intelligence/faculty/attention', { params: { dept_id: deptId } });
  return response.data;
};

export const getFacultyActionQueue = async (facultyId?: number, status = 'ALL'): Promise<ActionQueueItem[]> => {
  const response = await api.get('/intelligence/faculty/action-queue', { params: { faculty_id: facultyId, status } });
  return response.data;
};

export const createFacultyIntervention = async (payload: {
  student_id: number;
  faculty_id?: number;
  title: string;
  reason: string;
  assigned_topics: string[];
  priority?: string;
}) => {
  const response = await api.post('/intelligence/faculty/interventions', payload);
  return response.data;
};

export const updateInterventionStatus = async (interventionId: number, status: string, improvementNotes?: string) => {
  const response = await api.put(`/intelligence/faculty/interventions/${interventionId}`, {
    status,
    improvement_notes: improvementNotes
  });
  return response.data;
};

export const getInterventionEffectiveness = async () => {
  const response = await api.get('/intelligence/faculty/interventions/effectiveness');
  return response.data;
};

export const getHODCommandCenterData = async (deptId?: number) => {
  const response = await api.get('/intelligence/hod/command-center', { params: { dept_id: deptId } });
  return response.data;
};

export const getInstitutionalBenchmarks = async () => {
  const response = await api.get('/intelligence/hod/benchmarks');
  return response.data;
};

export const simulateWhatIfScenario = async (currentPartPct: number, targetPartPct: number, currentAtRisk: number) => {
  const response = await api.post('/intelligence/hod/what-if', {
    current_participation_pct: currentPartPct,
    target_participation_pct: targetPartPct,
    current_at_risk_count: currentAtRisk
  });
  return response.data;
};

export const askAIDepartmentQuery = async (queryText: string) => {
  const response = await api.post('/intelligence/hod/ai-query', { query: queryText });
  return response.data;
};

export const getSystemAlerts = async (): Promise<SystemAlertItem[]> => {
  const response = await api.get('/intelligence/alerts');
  return response.data;
};

export const markAlertRead = async (alertId: number) => {
  const response = await api.post(`/intelligence/alerts/${alertId}/read`);
  return response.data;
};

export const markAlertResolve = async (alertId: number) => {
  const response = await api.post(`/intelligence/alerts/${alertId}/resolve`);
  return response.data;
};

// ─────────────────────────────────────────────────────────────────────────────
// Faculty Action Center — Types & API
// ─────────────────────────────────────────────────────────────────────────────

export interface FacultyActionKPIs {
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  pending_count: number;
  in_progress_count: number;
  monitoring_count: number;
  completed_count: number;
  resolved_count: number;
  total_actions: number;
  overdue_count: number;
  escalated_count: number;
  immediate_attention_count: number;
  subtitle: string;
}

export interface FacultyActionItem {
  id: number;
  student_id: number;
  student_name: string;
  reg_no: string;
  leetcode_username: string;
  department_name: string;
  department_code: string;
  year_level: string;
  signal_type: string;
  priority: string;
  priority_score: number;
  priority_score_reason: string;
  status: string;
  recommended_action: string;
  assigned_faculty_name: string | null;
  due_date: string | null;
  follow_up_date: string | null;
  next_review_date: string | null;
  is_escalated: boolean;
  escalated_to: string | null;
  action_taken: string | null;
  faculty_notes: string | null;
  evidence_remarks: string | null;
  is_overdue_followup: boolean;
  days_overdue: number;
  created_at: string;
  updated_at: string;
  total_solved: number;
  current_rating: number;
  contests_attended: number;
  last_active_days_ago: number;
}

export interface ActionTimelineEvent {
  id: number;
  event_type: string;
  user_name: string;
  previous_value: string | null;
  new_value: string | null;
  reason: string | null;
  timestamp: string;
}

export interface UpdateActionPayload {
  status?: string;
  assigned_faculty_name?: string;
  action_taken?: string;
  faculty_notes?: string;
  evidence_remarks?: string;
  follow_up_date?: string;
  next_review_date?: string;
  updated_by_name?: string;
  reason?: string;
}

export const getFacultyActionKPIs = async (deptId?: number): Promise<FacultyActionKPIs> => {
  const response = await api.get('/intelligence/faculty/actions/kpis', { params: { dept_id: deptId } });
  return response.data;
};

export const getFacultyActionsList = async (params: {
  priority?: string;
  status?: string;
  dept_id?: number;
  year_level?: string;
  search?: string;
  sort_by?: string;
  sort_dir?: string;
  page?: number;
  page_size?: number;
}): Promise<{ items: FacultyActionItem[]; total: number; page: number; page_size: number }> => {
  const response = await api.get('/intelligence/faculty/actions', { params });
  return response.data;
};

export const getSingleFacultyAction = async (actionId: number): Promise<FacultyActionItem> => {
  const response = await api.get(`/intelligence/faculty/actions/${actionId}`);
  return response.data;
};

export const updateFacultyAction = async (
  actionId: number,
  payload: UpdateActionPayload
): Promise<{ status: string; message: string }> => {
  const response = await api.put(`/intelligence/faculty/actions/${actionId}`, payload);
  return response.data;
};

export const assignFacultyAction = async (
  actionId: number,
  facultyName: string,
  updatedByName?: string
): Promise<{ status: string; message: string }> => {
  const response = await api.post(`/intelligence/faculty/actions/${actionId}/assign`, {
    faculty_name: facultyName,
    updated_by_name: updatedByName,
  });
  return response.data;
};

export const updateActionStatus = async (
  actionId: number,
  status: string,
  reason?: string,
  updatedByName?: string
): Promise<{ status: string; message: string }> => {
  const response = await api.post(`/intelligence/faculty/actions/${actionId}/status`, {
    status,
    reason,
    updated_by_name: updatedByName,
  });
  return response.data;
};

export const scheduleActionFollowUp = async (
  actionId: number,
  followUpDate: string,
  nextReviewDate?: string,
  updatedByName?: string
): Promise<{ status: string; message: string }> => {
  const response = await api.post(`/intelligence/faculty/actions/${actionId}/follow-up`, {
    follow_up_date: followUpDate,
    next_review_date: nextReviewDate,
    updated_by_name: updatedByName,
  });
  return response.data;
};

export const escalateAction = async (
  actionId: number,
  escalatedTo: string,
  reason: string,
  updatedByName?: string
): Promise<{ status: string; message: string }> => {
  const response = await api.post(`/intelligence/faculty/actions/${actionId}/escalate`, {
    escalated_to: escalatedTo,
    reason,
    updated_by_name: updatedByName,
  });
  return response.data;
};

export const getActionTimeline = async (actionId: number): Promise<ActionTimelineEvent[]> => {
  const response = await api.get(`/intelligence/faculty/actions/${actionId}/timeline`);
  return response.data;
};

export const triggerSignalDetection = async (): Promise<{
  status: string;
  new_signals_created: number;
  existing_signals_updated: number;
  total_processed: number;
  message: string;
}> => {
  const response = await api.post('/intelligence/faculty/actions/detect-signals');
  return response.data;
};
