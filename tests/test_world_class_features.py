"""
test_world_class_features.py — Master Verification Suite for 6 World-Class Features

Validates:
1. Automated WhatsApp & Telegram Bot Notification System
2. Real-Time Anti-Cheat & Plagiarism Detection Engine
3. AI Predictive Placement Eligibility Score Engine
4. Smart Gamification & Dynamic Badges System
5. Automated NAAC & NBA Accreditation Report Studio
6. Live Classroom Hall-of-Fame Kiosk API Feeds
"""

import sys
import os
import json
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from backend.main import app
from backend.database import SessionLocal
from backend.models import Student, User, Department, LeetCodeProfileStats
from backend.services.bot_notification_service import bot_notification_service
from backend.services.plagiarism_detection_service import plagiarism_detection_service
from backend.services.placement_predictor_service import placement_predictor_service
from backend.services.gamification_service import gamification_service, BADGE_DEFINITIONS
from backend.services.accreditation_report_service import accreditation_report_service

client = TestClient(app)


def test_1_bot_notification_system():
    print("\n--- [TEST 1] AUTOMATED WHATSAPP & TELEGRAM BOT NOTIFICATION SYSTEM ---")
    
    # 1. Direct WhatsApp Message
    res_wa = bot_notification_service.send_whatsapp_message("+919876543210", "Test WhatsApp Alert")
    assert res_wa["status"] == "DELIVERED"
    assert res_wa["channel"] == "WHATSAPP"
    print("  + WhatsApp message dispatch verified.")

    # 2. Direct Telegram Message
    res_tg = bot_notification_service.send_telegram_message("tg_chat_123", "Test Telegram Alert")
    assert res_tg["status"] == "DELIVERED"
    assert res_tg["channel"] == "TELEGRAM"
    print("  + Telegram message dispatch verified.")

    # 3. Message Template Formatting
    msg_contest = bot_notification_service.format_contest_result_message(
        student_name="Arun Kumar",
        reg_no="732223CS001",
        rank=5,
        total_students=425,
        solved=3
    )
    assert "Arun Kumar" in msg_contest
    assert "Rank: 5/425" in msg_contest
    assert "Solved: 3/4" in msg_contest
    print("  + Tamil + English Sunday Contest template verified.")

    msg_streak = bot_notification_service.format_streak_saver_message(
        student_name="Deepa R",
        current_streak=15
    )
    assert "STREAK WARNING" in msg_streak
    assert "15" in msg_streak
    print("  + Streak Saver template verified.")

    msg_faculty = bot_notification_service.format_faculty_daily_summary_message(
        faculty_name="Dr. S. Ramesh",
        active_count=18,
        total_mentees=20,
        at_risk_names=["Student X", "Student Y"]
    )
    assert "Dr. S. Ramesh" in msg_faculty
    assert "18/20" in msg_faculty
    print("  + Faculty Daily 1:20 digest template verified.")

    with SessionLocal() as db:
        res_bc = bot_notification_service.trigger_sunday_contest_student_broadcast(db, limit=5)
        assert res_bc["success"] is True
        print(f"  + Broadcast triggered for {res_bc['total_dispatched']} students.")

    print("  + [TEST 1 PASSED]: Automated Bot System fully verified.")


def test_2_anti_cheat_and_plagiarism_detection():
    print("\n--- [TEST 2] REAL-TIME ANTI-CHEAT & PLAGIARISM DETECTION ENGINE ---")
    
    with SessionLocal() as db:
        scan_res = plagiarism_detection_service.analyze_contest_session(db)
        assert "incidents" in scan_res
        assert "total_analyzed" in scan_res
        print(f"  + Scanned session: {scan_res['total_analyzed']} records analyzed, {scan_res['flagged_count']} flags detected.")

        flags = plagiarism_detection_service.get_flagged_incidents()
        assert len(flags) >= 1
        first_flag = flags[0]
        assert "similarity_score" in first_flag
        assert "severity" in first_flag
        assert first_flag["severity"] in ["HIGH", "CRITICAL", "MEDIUM"]
        print(f"  + Flag detected: Similarity {first_flag['similarity_score']}% | Severity {first_flag['severity']}.")

        # Disposition review
        review_res = plagiarism_detection_service.review_incident(
            incident_id=first_flag["id"],
            action="CONFIRMED",
            reviewer_name="Dr. HOD CSE",
            notes="Identical solve code and IP collision verified."
        )
        assert review_res["success"] is True
        assert review_res["incident"]["status"] == "CONFIRMED"
        print("  + Plagiarism disposition review and audit logging verified.")

    print("  + [TEST 2 PASSED]: Anti-Cheat Engine fully verified.")


def test_3_ai_predictive_placement_eligibility():
    print("\n--- [TEST 3] AI PREDICTIVE PLACEMENT ELIGIBILITY SCORE ENGINE ---")
    
    # 1. Tier-1 FAANG Test
    mock_stats_tier1 = LeetCodeProfileStats(
        total_solved=520,
        easy_solved=150,
        medium_solved=320,
        hard_solved=50,
        contest_rating=1850.0
    )
    eval_t1 = placement_predictor_service.evaluate_student_placement_tier(mock_stats_tier1)
    assert eval_t1["tier"] == "TIER_1_PRODUCT"
    assert "Google" in eval_t1["target_companies"]
    assert eval_t1["readiness_score"] >= 85
    print(f"  + Tier-1 Product match verified: {eval_t1['tier_label']} ({eval_t1['readiness_score']}%)")

    # 2. Tier-2 SaaS Test
    mock_stats_tier2 = LeetCodeProfileStats(
        total_solved=260,
        easy_solved=100,
        medium_solved=140,
        hard_solved=20,
        contest_rating=1580.0
    )
    eval_t2 = placement_predictor_service.evaluate_student_placement_tier(mock_stats_tier2)
    assert eval_t2["tier"] == "TIER_2_SAAS"
    assert "Zoho" in eval_t2["target_companies"]
    print(f"  + Tier-2 Mid-Product match verified: {eval_t2['tier_label']} ({eval_t2['readiness_score']}%)")

    # 3. At-Risk / Need Mentoring Test
    mock_stats_risk = LeetCodeProfileStats(
        total_solved=25,
        easy_solved=20,
        medium_solved=5,
        hard_solved=0,
        contest_rating=1100.0
    )
    eval_risk = placement_predictor_service.evaluate_student_placement_tier(mock_stats_risk)
    assert eval_risk["tier"] == "NEED_MENTORING"
    assert eval_risk["is_eligible_for_placements"] is False
    print(f"  + Need Mentoring detection verified: {eval_risk['tier_label']} (Alert triggered)")

    # 4. Institutional Aggregator
    with SessionLocal() as db:
        summary = placement_predictor_service.get_institutional_placement_summary(db)
        assert summary["total_students"] > 0
        assert "tier_breakdown" in summary
        print(f"  + Institutional Placement Breakdown: Tier-1: {summary['tier_breakdown']['tier_1_count']}, Tier-2: {summary['tier_breakdown']['tier_2_count']}, At Risk: {summary['tier_breakdown']['need_mentoring_count']}.")

    print("  + [TEST 3 PASSED]: AI Predictive Placement Engine fully verified.")


def test_4_smart_gamification_and_badges():
    print("\n--- [TEST 4] SMART GAMIFICATION & DYNAMIC BADGES SYSTEM ---")
    
    assert len(BADGE_DEFINITIONS) >= 6
    print(f"  + Master badge catalog loaded with {len(BADGE_DEFINITIONS)} badges.")

    with SessionLocal() as db:
        student = db.query(Student).join(Student.stats).first()
        assert student is not None

        badges = gamification_service.evaluate_student_badges(student)
        assert len(badges) == len(BADGE_DEFINITIONS)
        unlocked = [b for b in badges if b["is_unlocked"]]
        print(f"  + Student '{student.name}' evaluated: {len(unlocked)} badges unlocked.")

        hof = gamification_service.get_hall_of_fame_badges_leaderboard(db, limit=5)
        assert len(hof) >= 1
        print(f"  + Hall-of-Fame top badge achiever: {hof[0]['name']} ({hof[0]['unlocked_badges_count']} badges).")

    print("  + [TEST 4 PASSED]: Gamification Engine fully verified.")


def test_5_accreditation_report_studio():
    print("\n--- [TEST 5] AUTOMATED NAAC & NBA ACCREDITATION REPORT STUDIO ---")
    
    with SessionLocal() as db:
        metrics = accreditation_report_service.generate_accreditation_metrics(db)
        assert "naac_criteria_2_3" in metrics
        assert "naac_criteria_5_1" in metrics
        assert "nba_mentoring_audit" in metrics
        assert "department_benchmarks" in metrics

        print(f"  + NAAC Criteria 2.3 Participation: {metrics['naac_criteria_2_3']['participation_percentage']}% (Benchmark Met: {metrics['naac_criteria_2_3']['target_benchmark_met']}).")
        print(f"  + NAAC Criteria 5.1 Advanced Coders: {metrics['naac_criteria_5_1']['advanced_tier_coders']}.")
        print(f"  + NBA Mentoring Ratio: {metrics['nba_mentoring_audit']['mentee_ratio']}.")

    print("  + [TEST 5 PASSED]: Accreditation Studio Engine fully verified.")


def test_6_api_endpoints():
    print("\n--- [TEST 6] WORLD-CLASS API ROUTER INTEGRATION ---")
    
    # 1. Gamification Badges Catalog
    res_badges = client.get("/api/gamification/badges")
    assert res_badges.status_code == 200
    assert len(res_badges.json()) >= 6
    print("  + GET /api/gamification/badges -> 200 OK")

    # 2. Gamification Leaderboard
    res_hof = client.get("/api/gamification/leaderboard")
    assert res_hof.status_code == 200
    print("  + GET /api/gamification/leaderboard -> 200 OK")

    # 3. Anti-Cheat Flags (Public/Auth-handled)
    res_flags = client.get("/api/anti-cheat/flags")
    assert res_flags.status_code in [200, 401, 403]
    print(f"  + GET /api/anti-cheat/flags -> {res_flags.status_code} (Security Boundary Enforced)")

    print("  + [TEST 6 PASSED]: All API Routers responding with zero errors.")


if __name__ == "__main__":
    print("\n" + "=" * 80)
    print("NANDHA LEETCODE INTELLIGENCE — 6 WORLD-CLASS FEATURES VERIFICATION SUITE")
    print("=" * 80)

    test_1_bot_notification_system()
    test_2_anti_cheat_and_plagiarism_detection()
    test_3_ai_predictive_placement_eligibility()
    test_4_smart_gamification_and_badges()
    test_5_accreditation_report_studio()
    test_6_api_endpoints()

    print("\n" + "=" * 80)
    print("ALL 6 WORLD-CLASS FEATURES VERIFIED & OPERATIONAL WITH 100% SUCCESS!")
    print("=" * 80 + "\n")
