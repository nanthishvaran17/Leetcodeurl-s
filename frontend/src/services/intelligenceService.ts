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
  const response = await api.get(`/api/intelligence/student/${studentId}/digital-profile`);
  return response.data;
};

export const getFacultyAttentionItems = async (deptId?: number) => {
  const response = await api.get('/api/intelligence/faculty/attention', { params: { dept_id: deptId } });
  return response.data;
};

export const getFacultyActionQueue = async (facultyId?: number, status = 'ALL'): Promise<ActionQueueItem[]> => {
  const response = await api.get('/api/intelligence/faculty/action-queue', { params: { faculty_id: facultyId, status } });
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
  const response = await api.post('/api/intelligence/faculty/interventions', payload);
  return response.data;
};

export const updateInterventionStatus = async (interventionId: number, status: string, improvementNotes?: string) => {
  const response = await api.put(`/api/intelligence/faculty/interventions/${interventionId}`, {
    status,
    improvement_notes: improvementNotes
  });
  return response.data;
};

export const getInterventionEffectiveness = async () => {
  const response = await api.get('/api/intelligence/faculty/interventions/effectiveness');
  return response.data;
};

export const getHODCommandCenterData = async (deptId?: number) => {
  const response = await api.get('/api/intelligence/hod/command-center', { params: { dept_id: deptId } });
  return response.data;
};

export const getInstitutionalBenchmarks = async () => {
  const response = await api.get('/api/intelligence/hod/benchmarks');
  return response.data;
};

export const simulateWhatIfScenario = async (currentPartPct: number, targetPartPct: number, currentAtRisk: number) => {
  const response = await api.post('/api/intelligence/hod/what-if', {
    current_participation_pct: currentPartPct,
    target_participation_pct: targetPartPct,
    current_at_risk_count: currentAtRisk
  });
  return response.data;
};

export const askAIDepartmentQuery = async (queryText: string) => {
  const response = await api.post('/api/intelligence/hod/ai-query', { query: queryText });
  return response.data;
};

export const getSystemAlerts = async (): Promise<SystemAlertItem[]> => {
  const response = await api.get('/api/intelligence/alerts');
  return response.data;
};

export const markAlertRead = async (alertId: number) => {
  const response = await api.post(`/api/intelligence/alerts/${alertId}/read`);
  return response.data;
};

export const markAlertResolve = async (alertId: number) => {
  const response = await api.post(`/api/intelligence/alerts/${alertId}/resolve`);
  return response.data;
};
