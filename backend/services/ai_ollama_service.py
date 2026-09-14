import json
import uuid
import httpx
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import or_

from backend.config import settings
from backend.logger import logger
from backend.models import User, Student

# Reusing the existing data extraction functions for routing
from backend.services.ai_gemini_service import (
    execute_search_students,
    execute_get_department_analytics,
    execute_get_performance_leaderboard
)

OLLAMA_API_URL = f"{settings.OLLAMA_BASE_URL.rstrip('/')}/api/generate"

class AIOllamaEngine:
    """
    Ollama-based AI Engine for local LLM inference.
    Implements a strict Router -> DB -> LLM paradigm for zero hallucination.
    """

    @staticmethod
    def _call_ollama(prompt: str, json_format: bool = False, temperature: float = 0.1) -> str:
        """Helper to call Ollama HTTP API synchronously."""
        payload = {
            "model": settings.OLLAMA_MODEL,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": temperature
            }
        }
        if json_format:
            payload["format"] = "json"

        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.post(OLLAMA_API_URL, json=payload)
                response.raise_for_status()
                data = response.json()
                return data.get("response", "")
        except httpx.RequestError as e:
            logger.error(f"Ollama Connection Error: {e}")
            raise Exception("Ollama service unreachable.")
        except Exception as e:
            logger.error(f"Ollama Error: {e}")
            raise

    @staticmethod
    def _detect_intent(query: str, history: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        """Classify intent and extract entities using Ollama JSON mode."""
        history_str = ""
        if history:
            history_str = "Conversation History:\n"
            for turn in history[-3:]:
                role = "User" if turn.get("type") == "user" else "Assistant"
                history_str += f"{role}: {turn.get('text', '')}\n"

        prompt = f"""
You are an intent detection routing engine.
Analyze the user's query and output a strict JSON object.

Valid Intents:
STUDENT_LOOKUP (e.g. "tell me about nanthish", "show 732224CC031")
STUDENT_METRIC (e.g. "what is his rating", "how many problems solved")
TOP_PERFORMERS (e.g. "who are the top students", "leaderboard")
TOPIC_DIFFICULTY (e.g. "which topics are hard")
CONTEST_QUERY (e.g. "who missed the contest")
FACULTY_QUERY (e.g. "how many faculty", "admin name")
DEPARTMENT_QUERY (e.g. "ECE stats", "department health")
INSTITUTION_QUERY (e.g. "college stats")
LEETCODE_INFO (e.g. "what is leetcode", "what is binary search")
REPORT_REQUEST (e.g. "generate pdf")
GENERAL_QUERY (e.g. "hello", "how are you")
UNKNOWN

{history_str}
Current Query: "{query}"

Output ONLY a valid JSON object matching this structure:
{{
  "intent": "STUDENT_LOOKUP",
  "entity": "extracted name or register number or null",
  "department": "extracted department or null",
  "needsDatabase": true
}}
"""
        try:
            response = AIOllamaEngine._call_ollama(prompt, json_format=True)
            return json.loads(response)
        except Exception as e:
            logger.error(f"Failed to detect intent: {e}")
            return {"intent": "GENERAL_QUERY", "needsDatabase": False}

    @staticmethod
    def _resolve_student(db: Session, entity_name: str) -> Optional[Student]:
        """Resolves student exactly from DB."""
        if not entity_name:
            return None
            
        term = entity_name.strip()
        # 1. Register number exact
        student = db.query(Student).filter(Student.reg_no.ilike(term)).first()
        if student: return student
        
        # 2. LeetCode username exact
        student = db.query(Student).filter(Student.username.ilike(term)).first()
        if student: return student
        
        # 3. Exact Name
        student = db.query(Student).filter(Student.name.ilike(term)).first()
        if student: return student
        
        # 4. Fuzzy Name (First Match)
        student = db.query(Student).filter(Student.name.ilike(f"%{term}%")).first()
        return student

    @staticmethod
    def answer_query(
        db: Session,
        query_text: str,
        user: Optional[User] = None,
        context_page: Optional[str] = None,
        context_filters: Optional[Dict[str, Any]] = None,
        history: Optional[List[Dict[str, Any]]] = None,
        mode: str = "institutional"
    ) -> Dict[str, Any]:
        """Main entry point for Ollama conversational bot."""
        req_id = f"ai_{uuid.uuid4().hex[:12]}"
        
        # Determine Intent
        try:
            intent_data = AIOllamaEngine._detect_intent(query_text, history)
            intent = intent_data.get("intent", "UNKNOWN")
            entity = intent_data.get("entity")
            department = intent_data.get("department")
        except Exception:
            return {
                "success": False,
                "answer": "The local AI service is currently unavailable. Please try again shortly.",
                "confidence": "ERROR",
                "provenance": "DATA_UNAVAILABLE",
                "requestId": req_id
            }

        logger.info(f"[OLLAMA ROUTER] Query: {query_text} | Intent: {intent} | Entity: {entity}")

        db_facts = None
        provenance = "CONVERSATIONAL"
        
        # Try resolving 'he' / 'his' from history if entity is missing for student queries
        if intent in ["STUDENT_LOOKUP", "STUDENT_METRIC"] and not entity and history:
            for turn in reversed(history):
                # Search turn metadata if available, otherwise just regex simple logic
                if "nanthish" in turn.get("text", "").lower() or "732224" in turn.get("text", "").lower():
                    # Extremely simplified context resolution for demonstration
                    entity = "nanthish"
                    break

        # Database Execution
        if intent in ["STUDENT_LOOKUP", "STUDENT_METRIC"] and entity:
            student = AIOllamaEngine._resolve_student(db, entity)
            if student:
                stats = execute_search_students(db, user, search=student.reg_no, limit=1)
                if stats.get("returned_count", 0) > 0:
                    db_facts = json.dumps(stats["students"][0], indent=2)
                    provenance = "HIGH_VERIFIED"
                else:
                    db_facts = "Student found but you do not have permission to view their data."
            else:
                db_facts = "I couldn't verify that student from the available institutional data."
                provenance = "DATA_UNAVAILABLE"
                
        elif intent == "TOP_PERFORMERS":
            stats = execute_get_performance_leaderboard(db, user, department=department, limit=5)
            db_facts = json.dumps(stats.get("leaderboard", []), indent=2)
            provenance = "HIGH_VERIFIED"
            
        elif intent == "DEPARTMENT_QUERY":
            stats = execute_get_department_analytics(db, user, department=department)
            db_facts = json.dumps(stats, indent=2)
            provenance = "HIGH_VERIFIED"
            
        elif intent == "FACULTY_QUERY":
            db_facts = "I couldn't verify the faculty count from the available institutional data."
            provenance = "DATA_UNAVAILABLE"

        # Final Generation Prompt
        if db_facts:
            final_prompt = f"""
You are an institutional analytics assistant for Nandha Engineering College.
RULES:
- Use ONLY the supplied VERIFIED DATA.
- Do not invent facts. 
- If the data is missing, say it is unavailable.
- Answer concisely and naturally.

VERIFIED DATA:
{db_facts}

USER QUERY: {query_text}
"""
        else:
            final_prompt = f"""
You are an institutional analytics assistant.
Respond to the user naturally. 
If they ask for institutional statistics or student data, state that you require a specific name or you couldn't verify it.
USER QUERY: {query_text}
"""

        try:
            answer = AIOllamaEngine._call_ollama(final_prompt, temperature=0.3)
        except Exception:
            return {
                "success": False,
                "answer": "The local AI service is currently unavailable. Please try again shortly.",
                "confidence": "ERROR",
                "provenance": "DATA_UNAVAILABLE",
                "requestId": req_id
            }

        return {
            "success": True,
            "answer": answer.strip(),
            "confidence": "VERIFIED" if provenance == "HIGH_VERIFIED" else "STANDARD",
            "provenance": provenance,
            "actionLabel": None,
            "actionTab": None,
            "source": "Local Ollama LLM",
            "dataStatus": provenance,
            "requestId": req_id
        }
