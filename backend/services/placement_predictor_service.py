"""
placement_predictor_service.py — AI Predictive Placement Eligibility Score Engine

Evaluates student problem-solving patterns, contest ratings, and difficulty depth against
industry hiring benchmarks:

1. Tier-1 Companies (Product / FAANG: Google, Amazon, Microsoft, Uber, Atlassian):
   - Contest Rating > 1800 AND Hard Problems Solved >= 30.
   - Expected Compensation: ₹18 - ₹45 LPA.
2. Tier-2 Companies (Mid-Product / SaaS: Zoho, Freshworks, Juspay, Chargebee):
   - Contest Rating 1500 - 1800 AND Medium Problems Solved >= 100.
   - Expected Compensation: ₹8 - ₹18 LPA.
3. Tier-3 Companies (IT Services / High-Volume: TCS Digital, Infosys, Cognizant, Wipro Turbo):
   - Contest Rating 1300 - 1500 AND Total Solved >= 100.
   - Expected Compensation: ₹4.5 - ₹8 LPA.
4. Need Mentoring / At-Risk Tier:
   - Contest Rating < 1300 OR Total Solved < 50.
   - Triggers automated 1:20 Faculty Intervention.
"""

from typing import Dict, Any, Optional
from sqlalchemy.orm import Session

from backend.models import Student, LeetCodeProfileStats


class PlacementPredictorService:

    @staticmethod
    def evaluate_student_placement_tier(
        stats: Optional[LeetCodeProfileStats],
        year_level: str = "III"
    ) -> Dict[str, Any]:
        """
        Computes predictive placement tier, readiness percentage, target companies,
        and gap analysis for a single student.
        """
        if not stats:
            return {
                "tier": "NEED_MENTORING",
                "tier_label": "Need Mentoring (உடனடி கவனம் தேவை)",
                "readiness_score": 15,
                "badge_color": "rose",
                "target_companies": ["Skill Foundation & Mentoring Required"],
                "expected_salary_range": "Foundation Phase",
                "gap_analysis": ["Solve first 50 Easy & Medium problems", "Participate in weekly Sunday contests"],
                "is_eligible_for_placements": False
            }

        total = stats.total_solved or 0
        stats.easy_solved or 0
        medium = stats.medium_solved or 0
        hard = stats.hard_solved or 0
        rating = stats.contest_rating or 0.0

        # Tier 1 Evaluation
        if rating >= 1800 and hard >= 30:
            readiness = min(100, int(85 + (hard / 50) * 15))
            return {
                "tier": "TIER_1_PRODUCT",
                "tier_label": "Tier-1 Top Product / FAANG",
                "readiness_score": readiness,
                "badge_color": "emerald",
                "target_companies": ["Google", "Amazon", "Microsoft", "Uber", "Atlassian", "Adobe"],
                "expected_salary_range": "₹18 – ₹45 LPA",
                "gap_analysis": ["Maintain Top 5% contest rating", "Practice System Design & Graph Algorithms"],
                "is_eligible_for_placements": True
            }

        # Tier 2 Evaluation
        elif (rating >= 1500 and medium >= 80) or (total >= 250 and medium >= 120):
            readiness = min(88, int(70 + (medium / 150) * 18))
            return {
                "tier": "TIER_2_SAAS",
                "tier_label": "Tier-2 Mid-Product & SaaS",
                "readiness_score": readiness,
                "badge_color": "sky",
                "target_companies": ["Zoho", "Freshworks", "Juspay", "Chargebee", "Postman", "Kovai.co"],
                "expected_salary_range": "₹8 – ₹18 LPA",
                "gap_analysis": [f"Solve {max(0, 30 - hard)} more Hard problems to enter Tier-1", "Push Contest Rating to 1800+"],
                "is_eligible_for_placements": True
            }

        # Tier 3 Evaluation
        elif (rating >= 1300 and total >= 100) or total >= 120:
            readiness = min(72, int(50 + (total / 200) * 22))
            return {
                "tier": "TIER_3_SERVICES",
                "tier_label": "Tier-3 Premium IT Services",
                "readiness_score": readiness,
                "badge_color": "amber",
                "target_companies": ["TCS Digital", "Infosys DSE", "Cognizant GenC Elevate", "Wipro Turbo"],
                "expected_salary_range": "₹4.5 – ₹8 LPA",
                "gap_analysis": [f"Solve {max(0, 80 - medium)} more Medium problems for Tier-2 SaaS entry"],
                "is_eligible_for_placements": True
            }

        # At-Risk / Need Mentoring
        else:
            readiness = min(45, int((total / 100) * 45))
            return {
                "tier": "NEED_MENTORING",
                "tier_label": "Need Mentoring (உடனடி கவனம் தேவை)",
                "readiness_score": max(10, readiness),
                "badge_color": "rose",
                "target_companies": ["Institutional Mentoring Cohort"],
                "expected_salary_range": "Preparatory Phase",
                "gap_analysis": [
                    f"Needs {max(0, 50 - total)} more problems to achieve foundation benchmark",
                    "Attend 1:20 weekly faculty coaching sessions"
                ],
                "is_eligible_for_placements": False
            }

    @classmethod
    def get_institutional_placement_summary(cls, db: Session, dept_id: Optional[int] = None) -> Dict[str, Any]:
        """Aggregates institution-wide and department-level placement readiness tiers."""
        query = db.query(Student).join(Student.stats)
        if dept_id:
            query = query.filter(Student.department_id == dept_id)

        students = query.all()
        
        tier_counts = {
            "TIER_1_PRODUCT": 0,
            "TIER_2_SAAS": 0,
            "TIER_3_SERVICES": 0,
            "NEED_MENTORING": 0
        }

        tier_1_leaders = []
        tier_2_leaders = []
        at_risk_students = []

        for s in students:
            eval_res = cls.evaluate_student_placement_tier(s.stats, s.year_level)
            tier_code = eval_res["tier"]
            tier_counts[tier_code] = tier_counts.get(tier_code, 0) + 1

            s_summary = {
                "id": s.id,
                "reg_no": s.reg_no,
                "name": s.name,
                "dept": s.department.code if s.department else "CSE",
                "year": s.year_level,
                "total_solved": s.stats.total_solved if s.stats else 0,
                "contest_rating": s.stats.contest_rating if s.stats else 0.0,
                "hard_solved": s.stats.hard_solved if s.stats else 0,
                "readiness_score": eval_res["readiness_score"],
                "target_companies": eval_res["target_companies"]
            }

            if tier_code == "TIER_1_PRODUCT" and len(tier_1_leaders) < 15:
                tier_1_leaders.append(s_summary)
            elif tier_code == "TIER_2_SAAS" and len(tier_2_leaders) < 15:
                tier_2_leaders.append(s_summary)
            elif tier_code == "NEED_MENTORING" and len(at_risk_students) < 20:
                at_risk_students.append(s_summary)

        total = len(students) or 1
        return {
            "total_students": len(students),
            "tier_breakdown": {
                "tier_1_count": tier_counts["TIER_1_PRODUCT"],
                "tier_1_pct": round((tier_counts["TIER_1_PRODUCT"] / total) * 100, 1),
                "tier_2_count": tier_counts["TIER_2_SAAS"],
                "tier_2_pct": round((tier_counts["TIER_2_SAAS"] / total) * 100, 1),
                "tier_3_count": tier_counts["TIER_3_SERVICES"],
                "tier_3_pct": round((tier_counts["TIER_3_SERVICES"] / total) * 100, 1),
                "need_mentoring_count": tier_counts["NEED_MENTORING"],
                "need_mentoring_pct": round((tier_counts["NEED_MENTORING"] / total) * 100, 1),
            },
            "tier_1_leaders": sorted(tier_1_leaders, key=lambda x: x["readiness_score"], reverse=True),
            "tier_2_leaders": sorted(tier_2_leaders, key=lambda x: x["readiness_score"], reverse=True),
            "at_risk_students": at_risk_students
        }


placement_predictor_service = PlacementPredictorService()
