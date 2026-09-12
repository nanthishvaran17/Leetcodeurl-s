"""
report_registry.py
Nandha Engineering College — LeetCode Intelligence Reporting System

Authoritative Central Report Registry & Configuration Specification Engine.
Defines immutable report codes, title schemas, authorization boundaries,
color tokens, dataset resolvers, and quality gate rules for all 12 institutional reports.
"""

from typing import Dict, Any, List, Optional

# ==========================================
# 1. EXACT COLOR SYSTEM (SECTION 27)
# ==========================================
REPORT_COLORS = {
    "FRIDAY_OFFICIAL_CONTEST": {"primary": "16324F", "light": "EEF3F7"},
    "PRINCIPAL_EXECUTIVE": {"primary": "16324F", "light": "EEF3F7"},
    "MANAGEMENT_EXECUTIVE_SUMMARY": {"primary": "16324F", "light": "EEF3F7"},
    "WEEKLY_STUDENT_PERFORMANCE": {"primary": "2F5D8A", "light": "EEF4FA"},
    "SUNDAY_LIVE_CONTEST": {"primary": "2E7D62", "light": "EAF5F0"},
    "CONTEST_ATTENDANCE_PARTICIPATION": {"primary": "2E7D62", "light": "EAF5F0"},
    "WEEKLY_CONTEST_INTELLIGENCE": {"primary": "317B78", "light": "EAF5F4"},
    "CONTEST_PERFORMANCE_RANKING": {"primary": "7057A8", "light": "F2EFF8"},
    "FIVE_WEEK_PERFORMANCE_TREND": {"primary": "4C8DBB", "light": "EDF5FA"},
    "PROBLEM_DIFFICULTY_INTELLIGENCE": {"primary": "526777", "light": "EEF2F5"},
    "FACULTY_CONSOLIDATED": {"primary": "D27A35", "light": "FCF1E8"},
    "FACULTY_COORDINATOR_CONSOLIDATED": {"primary": "D27A35", "light": "FCF1E8"},
    "HOD_DEPARTMENT_INTELLIGENCE": {"primary": "8A4054", "light": "F7EEF1"},
}

# ==========================================
# 2. AUTHORITATIVE REPORT REGISTRY (SECTION 3)
# ==========================================
REPORT_REGISTRY: Dict[str, Dict[str, Any]] = {
    "FRIDAY_OFFICIAL_CONTEST": {
        "code": "FRIDAY_OFFICIAL_CONTEST",
        "category": "A. Contest Reports",
        "name": "Friday Official Contest Result",
        "description": "Official Friday final LeetCode contest result with attendance, binary Q1-Q4 solve status, score, global rank, rating, solve distribution, leaderboard, and department results.",
        "allowed_roles": ["PRINCIPAL", "HOD", "STAFF", "FACULTY_COORDINATOR", "MANAGEMENT", "ADMINISTRATOR"],
        "primary_color": "16324F",
        "light_color": "EEF3F7",
        "resolver": "build_contest_performance_report",
        "has_historical_requirement": False,
        "empty_state_msg": "No validated contest data available for this reporting period."
    },
    "WEEKLY_CONTEST_INTELLIGENCE": {
        "code": "WEEKLY_CONTEST_INTELLIGENCE",
        "category": "A. Contest Reports",
        "name": "Weekly Contest Intelligence Report",
        "description": "Official weekly contest intelligence reconciling total roster, verified profiles, solve distribution (4/4, 3/4, 2/4, 1/4, 0/4), and accuracy metrics.",
        "allowed_roles": ["PRINCIPAL", "HOD", "STAFF", "FACULTY_COORDINATOR", "MANAGEMENT", "ADMINISTRATOR"],
        "primary_color": "317B78",
        "light_color": "EAF5F4",
        "resolver": "build_contest_performance_report",
        "has_historical_requirement": False,
        "empty_state_msg": "No validated contest data available for this reporting period."
    },
    "SUNDAY_LIVE_CONTEST": {
        "code": "SUNDAY_LIVE_CONTEST",
        "category": "A. Contest Reports",
        "name": "Sunday Live Contest Report",
        "description": "Real-time Sunday live contest tracking detailing PUBLIC_LIVE, VIRTUAL_PRACTICE, ABSENT, and UNLINKED participation statuses.",
        "allowed_roles": ["PRINCIPAL", "HOD", "STAFF", "FACULTY_COORDINATOR", "MANAGEMENT", "ADMINISTRATOR"],
        "primary_color": "2E7D62",
        "light_color": "EAF5F0",
        "resolver": "build_contest_performance_report",
        "has_historical_requirement": False,
        "empty_state_msg": "No live contest activity detected for this session."
    },
    "CONTEST_ATTENDANCE_PARTICIPATION": {
        "code": "CONTEST_ATTENDANCE_PARTICIPATION",
        "category": "A. Contest Reports",
        "name": "Contest Attendance & Participation Report",
        "description": "Granular participation analytics comparing registered roster vs actual solvers, verified vs unverified profiles, and departmental participation %.",
        "allowed_roles": ["PRINCIPAL", "HOD", "STAFF", "FACULTY_COORDINATOR", "MANAGEMENT", "ADMINISTRATOR"],
        "primary_color": "2E7D62",
        "light_color": "EAF5F0",
        "resolver": "build_contest_performance_report",
        "has_historical_requirement": False,
        "empty_state_msg": "No attendance records available for this reporting period."
    },
    "CONTEST_PERFORMANCE_RANKING": {
        "code": "CONTEST_PERFORMANCE_RANKING",
        "category": "A. Contest Reports",
        "name": "Contest Performance & Ranking Report",
        "description": "Official contest leaderboard sorting solvers by LeetCode contest rank, problem score, solved count, and individual Q1-Q4 accuracy.",
        "allowed_roles": ["PRINCIPAL", "HOD", "STAFF", "FACULTY_COORDINATOR", "MANAGEMENT", "ADMINISTRATOR"],
        "primary_color": "7057A8",
        "light_color": "F2EFF8",
        "resolver": "build_contest_performance_report",
        "has_historical_requirement": False,
        "empty_state_msg": "No ranking data available for this contest."
    },
    "WEEKLY_STUDENT_PERFORMANCE": {
        "code": "WEEKLY_STUDENT_PERFORMANCE",
        "category": "B. Performance Reports",
        "name": "Weekly Student Performance Report",
        "description": "Cumulative student solve metrics (Easy, Medium, Hard), contest rating tracking, and profile verification status.",
        "allowed_roles": ["PRINCIPAL", "HOD", "STAFF", "FACULTY_COORDINATOR", "MANAGEMENT", "ADMINISTRATOR"],
        "primary_color": "2F5D8A",
        "light_color": "EEF4FA",
        "resolver": "build_universal_report",
        "has_historical_requirement": False,
        "empty_state_msg": "No student performance records found."
    },
    "FIVE_WEEK_PERFORMANCE_TREND": {
        "code": "FIVE_WEEK_PERFORMANCE_TREND",
        "category": "B. Performance Reports",
        "name": "Five-Week Performance Trend Report",
        "description": "5-contest historical solve matrix with deterministic trajectory signals (IMPROVING ↑, STABLE →, DECLINING ↓, FOLLOW-UP).",
        "allowed_roles": ["PRINCIPAL", "HOD", "STAFF", "FACULTY_COORDINATOR", "MANAGEMENT", "ADMINISTRATOR"],
        "primary_color": "4C8DBB",
        "light_color": "EDF5FA",
        "resolver": "build_five_week_trend_report",
        "has_historical_requirement": True,
        "empty_state_msg": "Insufficient historical data."
    },
    "PROBLEM_DIFFICULTY_INTELLIGENCE": {
        "code": "PROBLEM_DIFFICULTY_INTELLIGENCE",
        "category": "B. Performance Reports",
        "name": "Problem Difficulty Intelligence Report",
        "description": "Comprehensive breakdown of Easy vs Medium vs Hard problem distributions across departments, showcasing problem-solving depth.",
        "allowed_roles": ["PRINCIPAL", "HOD", "STAFF", "FACULTY_COORDINATOR", "MANAGEMENT", "ADMINISTRATOR"],
        "primary_color": "526777",
        "light_color": "EEF2F5",
        "resolver": "build_universal_report",
        "has_historical_requirement": False,
        "empty_state_msg": "No problem difficulty data available."
    },
    "FACULTY_CONSOLIDATED": {
        "code": "FACULTY_CONSOLIDATED",
        "category": "C. Consolidated Reports",
        "name": "Faculty Consolidated Performance Report",
        "description": "Performance aggregated by assigned Faculty/Mentors, showing active solver %, total solves, and mentor follow-up signals.",
        "allowed_roles": ["PRINCIPAL", "HOD", "STAFF", "FACULTY_COORDINATOR", "MANAGEMENT", "ADMINISTRATOR"],
        "primary_color": "D27A35",
        "light_color": "FCF1E8",
        "resolver": "build_universal_report",
        "has_historical_requirement": False,
        "empty_state_msg": "Staff allocation not available."
    },
    "FACULTY_COORDINATOR_CONSOLIDATED": {
        "code": "FACULTY_COORDINATOR_CONSOLIDATED",
        "category": "C. Consolidated Reports",
        "name": "Faculty Coordinator Consolidated Report",
        "description": "Departmental coordinator overview comparing faculty team performance, student coverage, and section-wise solve totals.",
        "allowed_roles": ["PRINCIPAL", "HOD", "FACULTY_COORDINATOR", "MANAGEMENT", "ADMINISTRATOR"],
        "primary_color": "D27A35",
        "light_color": "FCF1E8",
        "resolver": "build_universal_report",
        "has_historical_requirement": False,
        "empty_state_msg": "No coordinator dataset available."
    },
    "HOD_DEPARTMENT_INTELLIGENCE": {
        "code": "HOD_DEPARTMENT_INTELLIGENCE",
        "category": "C. Consolidated Reports",
        "name": "HOD Department Intelligence Report",
        "description": "Departmental dashboard detailing total enrolled students, verified profiles, active solvers, 4/4 perfect solvers, and departmental average solved.",
        "allowed_roles": ["PRINCIPAL", "HOD", "MANAGEMENT", "ADMINISTRATOR"],
        "primary_color": "8A4054",
        "light_color": "F7EEF1",
        "resolver": "build_universal_report",
        "has_historical_requirement": False,
        "empty_state_msg": "No department data available."
    },
    "PRINCIPAL_EXECUTIVE": {
        "code": "PRINCIPAL_EXECUTIVE",
        "category": "D. Executive Reports",
        "name": "Principal Executive Intelligence Report",
        "description": "High-level institutional executive dashboard displaying overall college KPIs, verified profile coverage, active solvers, and college-wide participation.",
        "allowed_roles": ["PRINCIPAL", "MANAGEMENT", "ADMINISTRATOR"],
        "primary_color": "16324F",
        "light_color": "EEF3F7",
        "resolver": "build_universal_report",
        "has_historical_requirement": False,
        "empty_state_msg": "No executive dataset available."
    },
    "MANAGEMENT_EXECUTIVE_SUMMARY": {
        "code": "MANAGEMENT_EXECUTIVE_SUMMARY",
        "category": "D. Executive Reports",
        "name": "Management Executive Summary Report",
        "description": "Strategic executive summary for college management detailing institutional ROI, top performers, active solver benchmarks, and strategic growth metrics.",
        "allowed_roles": ["PRINCIPAL", "MANAGEMENT", "ADMINISTRATOR"],
        "primary_color": "16324F",
        "light_color": "EEF3F7",
        "resolver": "build_universal_report",
        "has_historical_requirement": False,
        "empty_state_msg": "No management summary data available."
    }
}

def get_report_definition(report_code: str) -> Dict[str, Any]:
    """
    Retrieves authoritative report definition from REPORT_REGISTRY.
    Raises ValueError("REPORT_CONFIGURATION_ERROR") if unregistered or invalid.
    STRICT ANTI-FALLBACK RULE (SECTION 2 & 58).
    """
    if not report_code:
        raise ValueError("REPORT_CONFIGURATION_ERROR: Report code is required and cannot be empty.")
    
    code_upper = str(report_code).strip().upper()
    
    # Aliases for backwards compatibility mapping
    ALIASES = {
        "FRIDAY_OFFICIAL": "FRIDAY_OFFICIAL_CONTEST",
        "FRIDAY_OFFICIAL_RESULT": "FRIDAY_OFFICIAL_CONTEST",
        "STUDENT_PERFORMANCE": "WEEKLY_STUDENT_PERFORMANCE",
        "COLLEGE_EXECUTIVE": "PRINCIPAL_EXECUTIVE",
        "DEPARTMENT_PERFORMANCE": "HOD_DEPARTMENT_INTELLIGENCE",
        "BATCH_PERFORMANCE": "FIVE_WEEK_PERFORMANCE_TREND",
        "CONTEST_PERFORMANCE": "WEEKLY_CONTEST_INTELLIGENCE",
        "OFFICIAL_CONTEST": "FRIDAY_OFFICIAL_CONTEST",
        "WEEKLY_CONTEST": "WEEKLY_CONTEST_INTELLIGENCE",
    }
    
    target_code = ALIASES.get(code_upper, code_upper)
    
    if target_code not in REPORT_REGISTRY:
        raise ValueError(
            f"REPORT_CONFIGURATION_ERROR: Selected report code '{report_code}' is not a registered institutional report."
        )
        
    return REPORT_REGISTRY[target_code]


def validate_report_uniqueness() -> bool:
    """Programmatically verifies that all report codes in registry are unique."""
    codes = list(REPORT_REGISTRY.keys())
    return len(codes) >= 12 and len(set(codes)) == len(codes)
