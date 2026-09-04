"""
whatsapp_intent_router.py — Natural Language Intent Analyzer & AI Router

Design & Guardrails:
1. Translates Natural Language phrases (English, Tamil, Tanglish) and Slash Commands into strict Query Actions.
2. The AI Intent Router NEVER expands user authorization. All actions route to WhatsAppQueryEngine which enforces 4-tier isolation.
3. Completely Read-Only: No database writes or schema modifications.
4. Clean conversational response formatting with zero leakage of internal SQL/tokens.
"""

import re
from typing import Dict, Any, Tuple
from sqlalchemy.orm import Session

from backend.services.whatsapp_auth_service import WhatsAppIdentity
from backend.services.whatsapp_query_engine import whatsapp_query_engine


class WhatsAppIntentRouter:

    @classmethod
    def parse_and_route(
        cls,
        db: Session,
        identity: WhatsAppIdentity,
        user_message: str
    ) -> Dict[str, Any]:
        """
        Analyzes user message intent (Slash command or Natural Language)
        and executes the appropriate scoped read-only query.
        """
        raw_text = (user_message or "").strip()
        if not raw_text:
            return {
                "success": False,
                "intent": "EMPTY_MESSAGE",
                "message": "👋 Please send a message or type `/help` to see available commands."
            }

        # 1. Unregistered Number Check
        if identity.role == "UNREGISTERED":
            return {
                "success": False,
                "intent": "UNREGISTERED_ONBOARDING",
                "message": whatsapp_query_engine.get_help_menu(identity)
            }

        text_lower = raw_text.lower()
        cleaned_text = re.sub(r"[^\w\s\-\+/]", " ", text_lower).strip()

        # 2. Command or Natural Language Intent Classification
        intent, params = cls._classify_intent(cleaned_text, raw_text)

        # 3. Route to Scoped Query Engine
        return cls._execute_intent(db, identity, intent, params, raw_text)

    @classmethod
    def _classify_intent(cls, text: str, original_raw: str) -> Tuple[str, Dict[str, Any]]:
        """Classifies text into intent category and extracted parameters."""
        params: Dict[str, Any] = {}

        # Slash Commands
        if text.startswith("/"):
            parts = text.lstrip("/").split()
            cmd = parts[0]
            args = parts[1:] if len(parts) > 1 else []

            if cmd in ["help", "menu", "commands"]:
                return "HELP", {}
            elif cmd in ["profile", "stats", "mystats", "overview", "summary"]:
                return "OVERVIEW", {}
            elif cmd in ["contest", "weekly", "score"]:
                return "CONTEST", {}
            elif cmd in ["leaderboard", "top", "ranks"]:
                dept = args[0].upper() if args else None
                return "LEADERBOARD", {"department": dept}
            elif cmd in ["mentees", "students", "mentors"]:
                return "MENTEES_LIST", {}
            elif cmd in ["workload", "faculty"]:
                return "WORKLOAD", {}
            elif cmd in ["search", "find", "lookup"]:
                query = original_raw.split(maxsplit=1)[1] if len(original_raw.split()) > 1 else ""
                return "SEARCH", {"query": query}
            elif cmd in ["streak", "daily", "potd"]:
                return "STREAK", {}

        # -------------------------------------------------------------
        # Natural Language Intent Matching (English + Tamil + Tanglish)
        # -------------------------------------------------------------

        # Department detection in query (CSE, IT, ECE, EEE, MECH, CIVIL, AIDS, CSBS)
        dept_match = re.search(r"\b(cse|it|ece|eee|mech|civil|aids|csbs|bme|agri)\b", text, re.IGNORECASE)
        if dept_match:
            params["department"] = dept_match.group(1).upper()

        # 1. HELP / GREETING
        if any(w in text for w in ["help", "menu", "commands", "hi", "hello", "வணக்கம்", "vanakkam", "what can you do"]):
            return "HELP", params

        # 2. CONTEST STATUS / RESULTS (Checks contest keyword first)
        if any(p in text for p in [
            "contest", "sunday contest", "latest contest", "contest score", "weekly contest",
            "did i attend", "contest attendance", "கான்டெஸ்ட்", "போட்டி முடிவுகள்"
        ]):
            return "CONTEST", params

        # 3. STREAK
        if any(p in text for p in [
            "what is my streak", "my streak", "current streak", "daily streak",
            "streak status", "streak", "ஸ்ட்ரீக்"
        ]):
            return "STREAK", params

        # 4. AT RISK / LOW ACTIVITY / NOT SOLVED RECENTLY
        if any(p in text for p in [
            "low activity", "not solved recently", "not solved", "inactive students",
            "need attention", "at risk", "who is struggling", "inactive", "யார் படிக்கவில்லை"
        ]):
            return "AT_RISK", params

        # 5. SPECIFIC DEPARTMENT PERFORMANCE (e.g. "Show CSE performance", "Show IT department performance")
        if params.get("department") and any(w in text for w in ["performance", "stats", "status", "show", "how is"]):
            return "LEADERBOARD", params

        # 6. LEADERBOARD / TOP PERFORMERS / RANKS
        if any(p in text for p in [
            "top students", "top performers", "top 10", "top", "leaderboard",
            "best coders", "rank 1", "highest solved", "டாப் மாணவர்கள்",
            "department rank", "my rank", "ranks"
        ]):
            return "LEADERBOARD", params

        # 7. MENTEES / WORKLOAD
        if any(p in text for p in [
            "show my students", "list my students", "list my mentees", "who are my assigned students",
            "who are my mentees", "my assigned mentees", "my mentees", "faculty workload", "mentoring ratio"
        ]):
            return "MENTEES_LIST", params

        # 8. OVERVIEW / PROGRESS / GENERAL PERFORMANCE
        if any(p in text for p in [
            "how is the college performing", "college performance", "overall stats",
            "how is my department doing", "department performance", "dept stats",
            "how are my students doing", "mentee summary", "my mentees status",
            "how many problems have i solved", "what is my stats", "my progress",
            "overall college", "college summary", "dept summary", "profile stats",
            "performance", "doing", "progress", "solved",
            "கல்லூரி எப்படி", "என் நிலை", "மாணவர்கள் நிலை"
        ]):
            return "OVERVIEW", params

        # 9. SEARCH BY NAME OR REGISTER NUMBER
        search_match = re.search(r"(?:search|find|lookup|about|check|who is)\s+([a-zA-Z0-9_]+)", original_raw, re.IGNORECASE)
        if search_match:
            return "SEARCH", {"query": search_match.group(1).strip()}

        # Check if user typed a register number directly (e.g. 732224CC031, PROD_WA_CSE_01, WA_CSE_001)
        reg_match = re.search(r"\b([0-9]{2}[a-zA-Z]{2,4}[0-9]{3,4}|[a-zA-Z]+_[a-zA-Z]+_[0-9]+)\b", original_raw)
        if reg_match:
            return "SEARCH", {"query": reg_match.group(1).strip()}

        return "UNKNOWN", {}

    @classmethod
    def _execute_intent(
        cls,
        db: Session,
        identity: WhatsAppIdentity,
        intent: str,
        params: Dict[str, Any],
        original_query: str
    ) -> Dict[str, Any]:
        """Routes classified intent to WhatsAppQueryEngine with strict role bounds."""

        if intent == "HELP":
            return {
                "success": True,
                "intent": "HELP",
                "message": whatsapp_query_engine.get_help_menu(identity)
            }

        elif intent == "OVERVIEW":
            res = whatsapp_query_engine.get_overview(db, identity)
            return {
                "success": res.get("success", True),
                "intent": "OVERVIEW",
                "message": res.get("message", "Overview unavailable."),
                "data": res.get("data", {})
            }

        elif intent == "CONTEST":
            res = whatsapp_query_engine.get_weekly_contest(db, identity)
            return {
                "success": res.get("success", True),
                "intent": "CONTEST",
                "message": res.get("message", "Contest data unavailable.")
            }

        elif intent == "LEADERBOARD":
            dept = params.get("department")
            res = whatsapp_query_engine.get_leaderboard(db, identity, requested_dept_code=dept)
            return {
                "success": res.get("success", True),
                "intent": "LEADERBOARD",
                "message": res.get("message", "Leaderboard unavailable.")
            }

        elif intent == "MENTEES_LIST" or intent == "WORKLOAD":
            res = whatsapp_query_engine.get_mentees_or_workload(db, identity)
            return {
                "success": res.get("success", True),
                "intent": "MENTEES_OR_WORKLOAD",
                "message": res.get("message", "Workload data unavailable.")
            }

        elif intent == "AT_RISK":
            # Role tailored low-activity response
            if identity.role == "FACULTY":
                res = whatsapp_query_engine.get_overview(db, identity)
                return {
                    "success": True,
                    "intent": "AT_RISK",
                    "message": res.get("message", "")
                }
            elif identity.role == "HOD":
                res = whatsapp_query_engine.get_overview(db, identity)
                return {
                    "success": True,
                    "intent": "AT_RISK",
                    "message": res.get("message", "")
                }
            elif identity.role == "PRINCIPAL":
                res = whatsapp_query_engine.get_overview(db, identity)
                return {
                    "success": True,
                    "intent": "AT_RISK",
                    "message": res.get("message", "")
                }
            else:
                return {
                    "success": False,
                    "intent": "AT_RISK",
                    "message": "⛔ *Access Denied:* Only Faculty, HOD, and Principal can query student risk status."
                }

        elif intent == "SEARCH":
            query_str = params.get("query", "")
            res = whatsapp_query_engine.search_student(db, identity, query_term=query_str)
            return {
                "success": res.get("success", True),
                "intent": "SEARCH",
                "message": res.get("message", "Search query returned no results.")
            }

        elif intent == "STREAK":
            res = whatsapp_query_engine.get_overview(db, identity)
            return {
                "success": True,
                "intent": "STREAK",
                "message": res.get("message", "Streak data unavailable.")
            }

        # Fallback for unrecognized intent
        return {
            "success": False,
            "intent": "UNKNOWN",
            "message": (
                f"❓ I didn't quite catch that (*\"{original_query}\"*).\n\n"
                f"💡 Type `/help` to view available commands for *{identity.display_role}*, "
                f"or ask things like *\"Show my contest results\"* or *\"Who are the top students?\"*."
            )
        }


whatsapp_intent_router = WhatsAppIntentRouter()
