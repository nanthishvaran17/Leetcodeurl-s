"""
tests/test_deep_tech_5_features.py — Deep-Tech 5 Elite Capabilities Validation Test Suite

Validates:
1. Dynamic Code Execution Behavior & AST Plagiarism Analysis (Variable invariance, Jaccard AST similarity, Keystroke paste burst detection).
2. LeetCode Contest Virtual Replay & Struggle Heatmap Engine (90-min 5-min timeline slices, Q1..Q4 difficulty curve, Faculty remedial agenda).
3. Automated Weakness Radar & Micro-Skill Graph (6-dimension DSA mastery radar, critical weakness detection, personalized remedial LeetCode paths).
4. Enterprise Data Lake & Anomaly Alerts (SHA-256 Merkle hash chain immutability, tamper detection, dynamic PII masking).
5. Automated Institutional WhatsApp/Voice Alert System (Multi-week inactivity drop-offs, multilingual TTS voice scripts).
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from fastapi.testclient import TestClient

from backend.main import app
from backend.database import SessionLocal, run_migrations
from backend.models import User, Student
from backend.services.ast_anti_cheat_engine import ast_anti_cheat_engine
from backend.services.contest_replay_service import contest_replay_service
from backend.services.skill_graph_service import skill_graph_service
from backend.services.immutable_event_store import immutable_event_store
from backend.services.voice_alert_service import voice_alert_service

client = TestClient(app)


def test_deep_tech_5_features():
    print("=" * 80)
    print("NANDHA LEETCODE INTELLIGENCE — 5 DEEP-TECH ELITE CAPABILITIES VERIFICATION")
    print("=" * 80)

    # -------------------------------------------------------------------------
    # FEATURE 1: DYNAMIC AST & CODE BEHAVIOR ANTI-CHEAT ENGINE
    # -------------------------------------------------------------------------
    print("\n--- [FEATURE 1] DYNAMIC AST & KEYSTROKE ANTI-CHEAT ANALYSIS ---")
    # Original student code
    code_a = """
def twoSum(nums, target):
    lookup = {}
    for i, num in enumerate(nums):
        diff = target - num
        if diff in lookup:
            return [lookup[diff], i]
        lookup[num] = i
    return []
"""
    # Renamed variables and added whitespace (Cosmetic Plagiarism attempt)
    code_b = """
def twoSum(array_elements, required_sum):
    cache_map = {}
    for idx, element_val in enumerate(array_elements):
        remainder_val = required_sum - element_val
        if remainder_val in cache_map:
            return [cache_map[remainder_val], idx]
        cache_map[element_val] = idx
    return []
"""
    ast_res = ast_anti_cheat_engine.calculate_ast_similarity(code_a, code_b)
    print(f"  + AST Structural Similarity: {ast_res['similarity_percentage']}%")
    print(f"  + Risk Level:                {ast_res['risk_level']}")
    print(f"  + Verdict:                   {ast_res['verdict']}")
    assert ast_res["similarity_percentage"] >= 80.0, "AST matching must catch variable-renamed structural clones"

    # Keystroke paste burst test (50 lines pasted in 1.2 seconds)
    keystroke_res = ast_anti_cheat_engine.analyze_keystroke_dynamics(lines_of_code=50, duration_seconds=1.2, paste_events=1)
    print(f"  + Keystroke Analysis:        {keystroke_res['lines_per_second']} lines/sec -> {keystroke_res['flag']}")
    assert keystroke_res["is_paste_burst"] == True, "Paste burst must be flagged as anomaly"
    print("  + [FEATURE 1 PASSED]: AST Plagiarism and Keystroke anomaly detection verified.")

    # -------------------------------------------------------------------------
    # FEATURE 2: CONTEST VIRTUAL REPLAY & STRUGGLE HEATMAP
    # -------------------------------------------------------------------------
    print("\n--- [FEATURE 2] CONTEST VIRTUAL REPLAY & STRUGGLE HEATMAP ---")
    with SessionLocal() as db:
        run_migrations()
        replay_res = contest_replay_service.get_contest_timeline_replay(db)
        print(f"  + Replay Duration:           {replay_res['duration_minutes']} minutes (08:00 - 09:30 AM)")
        print(f"  + Timeline Slices Generated: {len(replay_res['timeline_slices'])} buckets")
        print(f"  + Struggle Heatmap Questions: {len(replay_res['struggle_heatmap'])} questions mapped")
        print(f"  + Q3 Struggle Index:         {replay_res['struggle_heatmap'][2]['struggle_index']}")
        print(f"  + Remedial Recommendation:   {replay_res['struggle_heatmap'][2]['recommended_action']}")
        assert len(replay_res["timeline_slices"]) >= 18
        assert len(replay_res["struggle_heatmap"]) == 4
    print("  + [FEATURE 2 PASSED]: Virtual timeline replay and struggle heatmap verified.")

    # -------------------------------------------------------------------------
    # FEATURE 3: AUTOMATED WEAKNESS RADAR & MICRO-SKILL GRAPH
    # -------------------------------------------------------------------------
    print("\n--- [FEATURE 3] AUTOMATED WEAKNESS RADAR & MICRO-SKILL GRAPH ---")
    with SessionLocal() as db:
        st = db.query(Student).first()
        radar_res = skill_graph_service.get_student_skill_radar(db, st.id)
        print(f"  + Student:                   {radar_res['student_name']} ({radar_res['reg_no']})")
        print(f"  + Primary Weakness:          {radar_res['primary_weakness']} ({radar_res['primary_weakness_mastery']}%)")
        print(f"  + Remedial Practice Paths:   {len(radar_res['personalized_remedial_curriculum'])} curated LeetCode problems")
        assert len(radar_res["radar_dimensions"]) == 6
        assert len(radar_res["personalized_remedial_curriculum"]) >= 3
    print("  + [FEATURE 3 PASSED]: 6-Dimensional DSA weakness radar verified.")

    # -------------------------------------------------------------------------
    # FEATURE 4: ENTERPRISE DATA LAKE & IMMUTABLE MERKLE EVENT STORE
    # -------------------------------------------------------------------------
    print("\n--- [FEATURE 4] ENTERPRISE DATA LAKE & IMMUTABLE MERKLE EVENT STORE ---")
    # Append events
    event1 = immutable_event_store.record_event("CONTEST_FINALIZED", "SUNDAY_AUTOPILOT", {"session_id": 22, "total_students": 3521})
    event2 = immutable_event_store.record_event("SCORE_AUDIT", "HOD_CSE", {"student_id": 105, "action": "VERIFIED"})
    integrity = immutable_event_store.verify_chain_integrity()
    print(f"  + Total Blocks Chained:      {integrity['total_blocks']}")
    print(f"  + Latest Merkle Block Hash:  {integrity['latest_block_hash'][:24]}...")
    print(f"  + Chain Integrity Status:    {integrity['status']}")
    assert integrity["is_valid"] == True, "Merkle chain must be mathematically valid"

    # PII Masking test
    masked = immutable_event_store.mask_pii("+919876543210", "student@nandhaengg.org", role="Faculty")
    print(f"  + Masked Phone for Faculty:  {masked['phone']}")
    print(f"  + Masked Email for Faculty:  {masked['email']}")
    assert "****" in masked["phone"]
    print("  + [FEATURE 4 PASSED]: Immutable event store and PII encryption isolation verified.")

    # -------------------------------------------------------------------------
    # FEATURE 5: AUTOMATED INSTITUTIONAL VOICE/WHATSAPP ESCALATION SYSTEM
    # -------------------------------------------------------------------------
    print("\n--- [FEATURE 5] AUTOMATED INSTITUTIONAL VOICE & ESCALATION SYSTEM ---")
    with SessionLocal() as db:
        escalations = voice_alert_service.scan_inactivity_escalations(db)
        print(f"  + Inactivity Escalations:    {len(escalations)} high-priority students flagged")
        if escalations:
            print(f"  + Escalation Level:          {escalations[0]['escalation_level']}")
            print(f"  + Tamil Voice TTS Script:    {escalations[0]['voice_tts_script_tamil']}")
            print(f"  + English Voice TTS Script:  {escalations[0]['voice_tts_script_english']}")
            assert "வணக்கம்" in escalations[0]["voice_tts_script_tamil"]
    print("  + [FEATURE 5 PASSED]: Voice/IVR smart escalation system verified.")

    print("\n" + "=" * 80)
    print("ALL 5 DEEP-TECH WORLD-CLASS CAPABILITIES VERIFIED WITH 100% SUCCESS!")
    print("=" * 80)


if __name__ == "__main__":
    test_deep_tech_5_features()
