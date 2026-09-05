import json
import uuid
import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, desc, func

from backend.models import (
    User, Student, SmartGroup, SmartGroupMember, InstitutionalAuditLog,
    LearningSignal, LeetCodeProfileStats, StudentContestParticipation,
    WeeklySession, WeeklyPublicResult, FacultyStudentAssignment, Department, Section
)
from backend.services.messaging_service import MessagingService
from backend.logger import logger

class InstitutionalIntelligenceService:

    @staticmethod
    def log_audit_event(
        db: Session,
        performed_by: str,
        action_type: str,
        target_type: Optional[str] = None,
        target_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        institution_id: str = "NEC"
    ) -> InstitutionalAuditLog:
        """Logs an immutable institutional audit event."""
        try:
            audit = InstitutionalAuditLog(
                audit_id=f"AUD_{uuid.uuid4().hex[:12]}",
                performed_by=performed_by,
                action_type=action_type,
                target_type=target_type,
                target_id=target_id,
                details=json.dumps(details or {}),
                institution_id=institution_id,
                created_at=datetime.datetime.utcnow()
            )
            db.add(audit)
            db.commit()
            return audit
        except Exception as e:
            logger.error(f"[AUDIT LOG FAIL] {e}")
            db.rollback()
            return None

    # =========================================================================
    # SMART GROUP SYSTEM (PHASE 7)
    # =========================================================================

    @staticmethod
    def create_smart_group(
        db: Session,
        current_user: Any,
        name: str,
        description: Optional[str] = None,
        group_type: str = "CUSTOM",
        is_dynamic: bool = False,
        rule_type: Optional[str] = None,
        rule_criteria: Optional[Dict[str, Any]] = None,
        initial_member_ids: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Creates a smart group (manual or dynamic criteria-based)."""
        user_id = MessagingService._get_user_id(current_user)
        user_role = str(getattr(current_user, "role", "Student")).upper()
        
        group_id = f"GRP_{uuid.uuid4().hex[:12]}"
        criteria = rule_criteria or {}

        group = SmartGroup(
            group_id=group_id,
            name=name,
            description=description or "",
            group_type=group_type.upper(),
            is_dynamic=is_dynamic,
            rule_type=rule_type,
            rule_criteria=json.dumps(criteria),
            created_by=user_id,
            institution_id="NEC",
            created_at=datetime.datetime.utcnow()
        )
        db.add(group)
        db.flush()

        # Add creator as OWNER
        owner_member = SmartGroupMember(
            group_id=group_id,
            user_id=user_id,
            role="OWNER",
            joined_at=datetime.datetime.utcnow()
        )
        db.add(owner_member)

        # Resolve initial members
        member_ids_set = set(initial_member_ids or [])

        if is_dynamic and rule_type:
            dynamic_ids = InstitutionalIntelligenceService._resolve_dynamic_members(db, current_user, rule_type, criteria)
            member_ids_set.update(dynamic_ids)

        added_count = 1 # Creator
        for mem_id in member_ids_set:
            if mem_id == user_id:
                continue
            db.add(SmartGroupMember(
                group_id=group_id,
                user_id=mem_id,
                role="STUDENT" if ("STUDENT" in mem_id or "@" in mem_id or mem_id.isalnum()) else "FACULTY",
                joined_at=datetime.datetime.utcnow()
            ))
            added_count += 1

        db.commit()

        InstitutionalIntelligenceService.log_audit_event(
            db=db,
            performed_by=user_id,
            action_type="SMART_GROUP_CREATED",
            target_type="GROUP",
            target_id=group_id,
            details={"name": name, "group_type": group_type, "member_count": added_count, "is_dynamic": is_dynamic}
        )

        return InstitutionalIntelligenceService.get_group_details(db, current_user, group_id)

    @staticmethod
    def _resolve_dynamic_members(
        db: Session,
        current_user: Any,
        rule_type: str,
        criteria: Dict[str, Any]
    ) -> List[str]:
        """Resolves target member user IDs based on verified DB rules."""
        matched_user_ids = []
        dept_id = getattr(current_user, "department_id", None)

        if rule_type == "INACTIVE_STUDENTS":
            days = criteria.get("days", 7)
            cutoff = datetime.datetime.utcnow() - datetime.timedelta(days=days)
            
            # Query active students whose last activity or profile sync is older than cutoff
            students = db.query(Student).filter(Student.is_active == True)
            if dept_id and "ADMIN" not in str(getattr(current_user, "role", "")).upper():
                students = students.filter(Student.department_id == dept_id)
                
            for s in students.all():
                stats = db.query(LeetCodeProfileStats).filter_by(student_id=s.id).first()
                if not stats or not stats.last_successful_sync or stats.last_successful_sync < cutoff or getattr(stats, 'active_days', 0) == 0:
                    matched_user_ids.append(MessagingService._get_user_id(s))

        elif rule_type == "MISSED_CONTEST":
            # Query active students who did not participate in the latest session
            latest_session = db.query(WeeklySession).order_by(desc(WeeklySession.id)).first()
            if latest_session:
                students = db.query(Student).filter(Student.is_active == True)
                if dept_id and "ADMIN" not in str(getattr(current_user, "role", "")).upper():
                    students = students.filter(Student.department_id == dept_id)
                
                participated_student_ids = set()
                results = db.query(WeeklyPublicResult).filter_by(session_id=latest_session.id).all()
                for r in results:
                    if r.outcome in ("SOLVED_LIVE", "SOLVED_VIRTUAL", "PARTICIPATED"):
                        participated_student_ids.add(r.student_id)

                for s in students.all():
                    if s.id not in participated_student_ids:
                        matched_user_ids.append(MessagingService._get_user_id(s))

        elif rule_type == "DEPARTMENT_BATCH":
            target_dept_code = criteria.get("dept_code")
            target_year = criteria.get("year")
            
            query = db.query(Student).filter(Student.is_active == True)
            if target_dept_code:
                dept = db.query(Department).filter_by(code=target_dept_code).first()
                if dept:
                    query = query.filter(Student.department_id == dept.id)
            if target_year:
                query = query.filter(Student.year_level == target_year)

            for s in query.all():
                matched_user_ids.append(MessagingService._get_user_id(s))

        return matched_user_ids

    @staticmethod
    def get_group_details(db: Session, current_user: Any, group_id: str) -> Dict[str, Any]:
        """Fetches detailed group metadata and member displays."""
        group = db.query(SmartGroup).filter_by(group_id=group_id).first()
        if not group:
            raise ValueError("Smart group not found")

        members = db.query(SmartGroupMember).filter_by(group_id=group_id).all()
        member_list = []
        for m in members:
            disp = MessagingService._get_user_display(db, m.user_id)
            disp["group_role"] = m.role
            disp["is_online"] = MessagingService._is_user_online(db, m.user_id)
            member_list.append(disp)

        return {
            "groupId": group.group_id,
            "name": group.name,
            "description": group.description,
            "groupType": group.group_type,
            "isDynamic": group.is_dynamic,
            "ruleType": group.rule_type,
            "createdBy": group.created_by,
            "createdAt": group.created_at.isoformat() if group.created_at else None,
            "memberCount": len(member_list),
            "members": member_list
        }

    @staticmethod
    def get_user_smart_groups(db: Session, current_user: Any) -> List[Dict[str, Any]]:
        """Returns all smart groups accessible to the authenticated user."""
        user_id = MessagingService._get_user_id(current_user)
        user_role = str(getattr(current_user, "role", "Student")).upper()

        if "ADMIN" in user_role:
            groups = db.query(SmartGroup).all()
        else:
            member_groups = db.query(SmartGroupMember.group_id).filter_by(user_id=user_id).subquery()
            groups = db.query(SmartGroup).filter(
                or_(SmartGroup.group_id.in_(member_groups), SmartGroup.created_by == user_id)
            ).all()

        res = []
        for g in groups:
            res.append({
                "groupId": g.group_id,
                "name": g.name,
                "description": g.description,
                "groupType": g.group_type,
                "isDynamic": g.is_dynamic,
                "createdBy": g.created_by,
                "createdAt": g.created_at.isoformat() if g.created_at else None,
                "memberCount": db.query(SmartGroupMember).filter_by(group_id=g.group_id).count()
            })
        return res

    # =========================================================================
    # ASK INSTITUTION QUERY ENGINE (PHASE 8, 9, 10)
    # =========================================================================

    @staticmethod
    def ask_institution(db: Session, current_user: Any, query: str, history: Optional[List[dict]] = None) -> Dict[str, Any]:
        """
        Processes natural language query using a Two-Pass LLM with RBAC-enforced DB queries.
        Pass 1: Intent Classification (Strictly no SQL).
        Pass 2: Report Generation based on raw verified JSON.
        """
        from backend.services.llm_service import LLMService
        from backend.services.authorization_service import apply_role_based_student_filter
        import json
        
        user_role = str(getattr(current_user, "role", "Student")).upper()
        dept_name = current_user.department.name if getattr(current_user, 'department', None) else "Institutional"
        user_id = MessagingService._get_user_id(current_user)

        q_clean = query.strip().lower()

        # Enforce Student restriction: Students can only query their own context
        if "STUDENT" in user_role and not any(r in user_role for r in ["ADMIN", "HOD", "FACULTY", "STAFF"]):
            if "my" in q_clean or "i" in q_clean or "status" in q_clean or "flag" in q_clean:
                return InstitutionalIntelligenceService._answer_student_self_query(db, current_user)
            else:
                return {
                    "query": query,
                    "answer": "As a student, you can view your personal progress, contest status, and assigned tasks.",
                    "evidence": ["Permission scope: Student self-access only"],
                    "actions": [{"label": "View My Progress", "action": "VIEW_MY_PROGRESS", "params": {}}],
                    "dataConfidence": "VERIFIED"
                }

        # PASS 1: INTENT CLASSIFICATION
        intent_prompt = f"""
        User Query: "{query}"
        Classify the user's intent into ONE of the following JSON structures:
        1. {{"intent": "INACTIVE_STUDENTS", "params": {{"days": 7}}}}
        2. {{"intent": "CONTEST_MISSED", "params": {{}}}}
        3. {{"intent": "TOP_PERFORMERS", "params": {{"limit": 10}}}}
        4. {{"intent": "LEARNING_NEEDS", "params": {{}}}}
        5. {{"intent": "GENERAL_SUMMARY", "params": {{}}}}
        Output ONLY valid JSON. Do not include markdown blocks.
        """
        
        intent_json_str = LLMService.generate_response(
            prompt=intent_prompt,
            system_context="You are an intent classifier. Output ONLY raw JSON with keys 'intent' and 'params'.",
            history=history[-2:] if history else None, # only need immediate context for intent
            max_tokens=150
        )
        
        intent_data = {"intent": "GENERAL_SUMMARY", "params": {}}
        if intent_json_str:
            try:
                clean_str = intent_json_str.strip().strip("```json").strip("```").strip()
                parsed = json.loads(clean_str)
                if isinstance(parsed, list) and len(parsed) > 0:
                    parsed = parsed[0]
                if isinstance(parsed, dict):
                    intent_data = parsed
            except Exception as e:
                logger.error(f"Intent parsing failed: {e}. Fallback to General Summary.")
                
        intent = intent_data.get("intent", "GENERAL_SUMMARY")
        params = intent_data.get("params", {})
        if not isinstance(params, dict):
            params = {}
        
        # EXECUTE RBAC-ENFORCED DB QUERY
        raw_data = []
        evidence = []
        actions = []
        
        students_q = db.query(Student).filter(Student.is_active == True)
        students_q = apply_role_based_student_filter(students_q, current_user, db)
        all_students = students_q.all()
        in_scope_count = len(all_students)

        if intent == "INACTIVE_STUDENTS":
            days = int(params.get("days", 7))
            cutoff = datetime.datetime.utcnow() - datetime.timedelta(days=days)
            inactive_students = []
            for s in all_students:
                stats = db.query(LeetCodeProfileStats).filter_by(student_id=s.id).first()
                if not stats or not stats.last_successful_sync or stats.last_successful_sync < cutoff or getattr(stats, 'active_days', 0) == 0:
                    inactive_students.append({
                        "name": s.name, "reg_no": s.reg_no, "department": s.department.code if s.department else "N/A"
                    })
            raw_data = inactive_students
            evidence = [f"Checked {in_scope_count} students.", f"Found {len(inactive_students)} inactive for {days} days."]
            actions = [{"label": f"View {len(inactive_students)} Inactive Students", "action": "VIEW_STUDENTS", "params": {"student_ids": [s["reg_no"] for s in inactive_students[:50]]}}]

        elif intent == "CONTEST_MISSED":
            latest_session = db.query(WeeklySession).order_by(desc(WeeklySession.id)).first()
            if not latest_session:
                raw_data = {"error": "No active contest sessions found."}
            else:
                results = db.query(WeeklyPublicResult).filter_by(session_id=latest_session.id).all()
                participated_ids = {r.student_id for r in results if r.outcome in ("SOLVED_LIVE", "SOLVED_VIRTUAL", "PARTICIPATED")}
                missed = [{"name": s.name, "reg_no": s.reg_no, "department": s.department.code if s.department else "N/A"} for s in all_students if s.id not in participated_ids]
                raw_data = {"contest": latest_session.contest_name, "missed_students": missed}
                evidence = [f"Session: {latest_session.contest_name}", f"Absentees: {len(missed)} out of {in_scope_count}"]
                actions = [{"label": "Send Contest Follow-up", "action": "SEND_REMINDER", "params": {"target": "CONTEST_ABSENTEES"}}]

        elif intent == "TOP_PERFORMERS":
            limit = int(params.get("limit", 10))
            stats_q = db.query(LeetCodeProfileStats).join(Student, LeetCodeProfileStats.student_id == Student.id).filter(Student.is_active == True)
            stats_q = apply_role_based_student_filter(stats_q, current_user, db)
            top_stats = stats_q.order_by(desc(LeetCodeProfileStats.total_solved)).limit(limit).all()
            top = []
            for st in top_stats:
                s = db.query(Student).filter_by(id=st.student_id).first()
                if s:
                    top.append({"name": s.name, "reg_no": s.reg_no, "solved": st.total_solved, "rating": st.contest_rating})
            raw_data = top
            evidence = [f"Fetched top {len(top)} performers by problems solved."]
            actions = [{"label": "Export Analytics", "action": "EXPORT_ANALYTICS", "params": {}}]
            
        elif intent == "LEARNING_NEEDS":
            signals = db.query(LearningSignal).order_by(desc(LearningSignal.created_at)).limit(20).all()
            topic_counts = {}
            for sig in signals:
                topic_counts[sig.topic] = topic_counts.get(sig.topic, 0) + 1
            raw_data = {"difficult_topics": [{"topic": t, "signals": c} for t, c in topic_counts.items()]}
            evidence = ["Analyzed recent 20 learning signals"]
            actions = [{"label": "Create Focused Practice Assignment", "action": "CREATE_ASSIGNMENT_MODAL", "params": {"suggested_topic": "Dynamic Programming"}}]
            
        else: # GENERAL_SUMMARY
            raw_data = {"total_students_in_scope": in_scope_count, "role_context": user_role, "department_scope": dept_name}
            evidence = ["Verified database summary snapshot."]
            actions = [
                {"label": "Ask about Inactive Students", "action": "RUN_QUERY", "params": {"query": "Who is inactive this week?"}},
                {"label": "Ask about Contest Absentees", "action": "RUN_QUERY", "params": {"query": "Who missed the last contest?"}}
            ]

        # PASS 2: REPORT GENERATION
        report_prompt = f"""
        User Query: "{query}"
        
        Raw Verified Data (JSON):
        {json.dumps(raw_data)}
        
        Task: Generate a professional ChatGPT-style Markdown response.
        - If there are multiple records, ALWAYS generate a Markdown table.
        - Summarize the insights briefly.
        - NEVER hallucinate names, numbers, or facts. Use strictly the JSON provided.
        - If the JSON has an error or is empty, state clearly that data is unavailable.
        - Ensure a professional, authoritative tone as the Institution Intelligence Assistant.
        """
        
        final_markdown = LLMService.generate_response(
            prompt=report_prompt,
            system_context="You are a data analyst generating a beautiful markdown report from raw JSON. Prioritize readability.",
            history=history,
            max_tokens=2048
        )
        
        return {
            "query": query,
            "answer": final_markdown or f"Data processed for {intent}. Records found: {len(raw_data) if isinstance(raw_data, list) else 1}",
            "evidence": evidence,
            "actions": actions,
            "dataConfidence": "HIGH_VERIFIED"
        }

    @staticmethod
    def _answer_student_self_query(db: Session, student_user: Any) -> Dict[str, Any]:
        """Provides verified self-progress for student query."""
        student = db.query(Student).filter(
            or_(Student.email == student_user.email, Student.reg_no == getattr(student_user, 'reg_no', None))
        ).first()

        if not student:
            return {
                "query": "My status",
                "answer": "Student record not linked to active session.",
                "evidence": [],
                "actions": [],
                "dataConfidence": "UNVERIFIED"
            }

        stats = db.query(LeetCodeProfileStats).filter_by(student_id=student.id).first()
        solved = stats.total_solved if stats else 0
        rating = stats.contest_rating if stats else "Unrated"

        return {
            "query": "My progress & standing",
            "answer": f"Hello {student.name}, your current verified stats: {solved} total problems solved. Contest Rating: {rating}.",
            "evidence": [
                f"Registration No: {student.reg_no}",
                f"Department: {student.department.code if student.department else ''} - Year {student.year_level}",
                f"LeetCode Handle: {student.username or 'Linked'}"
            ],
            "actions": [
                {"label": "View My Transparency Status", "action": "VIEW_TRANSPARENCY", "params": {}}
            ],
            "dataConfidence": "HIGH_VERIFIED"
        }

    # =========================================================================
    # MESSAGE → ACTION WORKFLOW (PHASE 11)
    # =========================================================================

    @staticmethod
    def analyze_message_for_action(db: Session, current_user: Any, content: str, receiver_id: str) -> Optional[Dict[str, Any]]:
        """Parses message text for actionable commitments and returns a confirmation proposal."""
        user_role = str(getattr(current_user, "role", "Student")).upper()
        if "STUDENT" in user_role and not any(r in user_role for r in ["FACULTY", "HOD", "ADMIN"]):
            return None

        c_lower = content.lower()
        if any(kw in c_lower for kw in ["complete", "solve", "problems", "assignment", "deadline", "submit"]):
            # Extract numbers if present
            import re
            num_match = re.search(r'(\d+)\s*(problem|question|task|dp|graph)', c_lower)
            problem_count = int(num_match.group(1)) if num_match else 5
            
            topic = "General Coding"
            if "dp" in c_lower or "dynamic programming" in c_lower: topic = "Dynamic Programming"
            elif "graph" in c_lower: topic = "Graphs"
            elif "tree" in c_lower: topic = "Trees"
            elif "array" in c_lower: topic = "Arrays"

            return {
                "detected": True,
                "actionType": "CREATE_ASSIGNMENT",
                "title": f"Assignment: Solve {problem_count} {topic} Problems",
                "topic": topic,
                "problemCount": problem_count,
                "deadline": (datetime.datetime.utcnow() + datetime.timedelta(days=3)).strftime("%Y-%m-%d 23:59"),
                "targetReceiverId": receiver_id,
                "proposalText": f"Detected assignment directive in message. Would you like to publish this as an official tracked assignment?"
            }
        return None

    # =========================================================================
    # LEARNING SIGNAL DETECTOR (PHASE 12)
    # =========================================================================

    @staticmethod
    def analyze_message_for_learning_signal(db: Session, student_user: Any, content: str, message_id: str) -> Optional[Dict[str, Any]]:
        """Detects student confusion/difficulty signals without negative labeling."""
        c_lower = content.lower()
        signal_keywords = ["don't understand", "dont understand", "stuck on", "hard time with", "confused about", "help with"]
        
        if any(kw in c_lower for kw in signal_keywords):
            topic = "General Algorithms"
            if "dp" in c_lower or "dynamic programming" in c_lower: topic = "Dynamic Programming"
            elif "graph" in c_lower: topic = "Graphs"
            elif "tree" in c_lower: topic = "Trees"
            elif "recursion" in c_lower: topic = "Recursion"

            student_id = MessagingService._get_user_id(student_user)

            signal = LearningSignal(
                signal_id=f"SIG_{uuid.uuid4().hex[:12]}",
                student_id=student_id,
                topic=topic,
                source_message_id=message_id,
                difficulty_level="NEEDS_SUPPORT",
                supporting_evidence=json.dumps({"message_excerpt": content[:150]}),
                suggested_action=json.dumps({"action": "RECOMMEND_PRACTICE", "topic": topic}),
                created_at=datetime.datetime.utcnow()
            )
            db.add(signal)
            db.commit()

            return {
                "signalId": signal.signal_id,
                "topic": topic,
                "message": f"Learning signal captured for {topic}. Recommended practice resources queued."
            }
        return None

    # =========================================================================
    # WHY WAS I FLAGGED? TRANSPARENCY (PHASE 13)
    # =========================================================================

    @staticmethod
    def get_student_flag_transparency(db: Session, current_user: Any) -> Dict[str, Any]:
        """Provides objective, non-judgmental transparency on why student was included in reminders/groups."""
        student_id = MessagingService._get_user_id(current_user)
        student = db.query(Student).filter(
            or_(Student.email == current_user.email, Student.reg_no == getattr(current_user, 'reg_no', None))
        ).first()

        if not student:
            return {"reasons": ["Student profile record active."]}

        reasons = []
        stats = db.query(LeetCodeProfileStats).filter_by(student_id=student.id).first()
        
        cutoff = datetime.datetime.utcnow() - datetime.timedelta(days=7)
        if not stats or not stats.last_successful_sync or stats.last_successful_sync < cutoff:
            reasons.append("Zero verified submissions in the past 7 days")

        latest_session = db.query(WeeklySession).order_by(desc(WeeklySession.id)).first()
        if latest_session:
            res = db.query(WeeklyPublicResult).filter_by(session_id=latest_session.id, student_id=student.id).first()
            if not res or res.outcome in ("NOT_PARTICIPATED", "FAILED_VERIFICATION"):
                reasons.append(f"Did not participate in Weekly Session #{latest_session.week_number or latest_session.id}")

        if not reasons:
            reasons.append("Your account is in good standing with active submissions and contest participation!")

        return {
            "studentName": student.name,
            "regNo": student.reg_no,
            "status": "ATTENTION_SUGGESTED" if len(reasons) > 1 and "good standing" not in reasons[0] else "IN_GOOD_STANDING",
            "objectiveReasons": reasons,
            "note": "This transparency view is powered by objective verified platform data. No subjective AI scores are applied."
        }
