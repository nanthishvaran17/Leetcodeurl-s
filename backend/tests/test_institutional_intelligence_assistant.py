import pytest
from backend.database import SessionLocal
from backend.services.ai_knowledge_service import AIKnowledgeEngine

def test_ai_ambiguity_detection():
    """Verify ambiguous prompt 'top students' returns clarifying choices rather than guessing."""
    db = SessionLocal()
    try:
        res = AIKnowledgeEngine.answer_query(db, "top students")
        assert res["success"] is True
        assert res["confidence"] == "AMBIGUOUS"
        assert res["clarifyingOptions"] is not None
        assert len(res["clarifyingOptions"]) == 4
        assert "Contest Rating" in res["clarifyingOptions"]
    finally:
        db.close()

def test_ai_pdf_intent():
    """Verify 'make pdf' intent returns PDF generation result."""
    db = SessionLocal()
    try:
        res = AIKnowledgeEngine.answer_query(db, "make pdf report")
        assert res["success"] is True
        assert res["pdfAvailable"] is True
        assert "Institutional Intelligence PDF Report" in res["answer"]
    finally:
        db.close()

def test_ai_email_dispatch_intent():
    """Verify 'mail this report' intent triggers report email workflow."""
    db = SessionLocal()
    try:
        res = AIKnowledgeEngine.answer_query(db, "mail this report to admin")
        assert res["success"] is True
        assert "HOD Weekly Summary" in res["answer"] or "Dispatched" in res["answer"] or "Report" in res["answer"]
    finally:
        db.close()

def test_ai_greeting_briefing():
    """Verify greetings like 'hi' or 'hello' return human-style institutional briefing with real metrics."""
    db = SessionLocal()
    try:
        res = AIKnowledgeEngine.answer_query(db, "hello")
        assert res["success"] is True
        assert "DIRECT ANSWER" in res["answer"]
        assert "KEY EVIDENCE" in res["answer"]
        assert "IMPORTANT INSIGHT" in res["answer"]
        assert "NEXT ACTION" in res["answer"]
        assert "Enrolled Scope" in res["answer"]
    finally:
        db.close()

