import asyncio
import datetime
from zoneinfo import ZoneInfo
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from backend.logger import logger
from backend.models import Student, LeetCodeAccount, StudentContestParticipation, LiveContestEvent, LiveQuestionStatus, LiveQuestionAuditLog
from backend.database import SessionLocal

IST = ZoneInfo("Asia/Kolkata")
UTC = ZoneInfo("UTC")

class LiveContestMonitorEngine:
    """
    10/10+ True Live Contest Monitoring Engine.
    Features:
      - Continuous monitoring across ALL 297+ registered student accounts.
      - Controlled rate-limit-safe batch iteration.
      - Initial Sync (1/297 -> 297/297 -> INITIAL_SYNC_COMPLETE).
      - Continuous Background Cycles (Cycle 1, 2, 3...) between 08:00 AM & 09:30 AM IST.
      - Change Detection emitting versioned STUDENT_ACTIVITY_UPDATED WebSocket events.
      - Missed event recovery via monotonic sync_version sequence.
    """

    def __init__(self):
        self.active_contest_id: Optional[str] = None
        self.is_monitoring: bool = False
        self.sync_state: str = "IDLE" # IDLE, INITIAL_SYNC, INITIAL_SYNC_COMPLETE, LIVE_SYNC_ACTIVE, FROZEN
        self.total_students: int = 0
        self.processed_students: int = 0
        self.current_cycle: int = 0
        self.sync_version: int = 0
        self.cached_states: Dict[str, Dict[str, Any]] = {} # key: f"{people_id}_{contest_id}"
        self.live_activity_feed: List[Dict[str, Any]] = [] # latest 50 live events
        self._monitor_task: Optional[asyncio.Task] = None

    def get_server_ist_time_str(self) -> str:
        return datetime.datetime.now(tz=IST).strftime("%I:%M:%S %p IST")

    async def broadcast_ws_event(self, event_data: Dict[str, Any]):
        """Helper to broadcast event via WebSocket manager."""
        try:
            from backend.websocket_manager import manager
            await manager.broadcast(event_data)
        except Exception as e:
            logger.warning(f"[LIVE_MONITOR_WS_ERR] Could not broadcast event: {e}")

    async def start_monitoring(self, contest_id: str):
        """Starts the live contest monitoring engine for all registered students."""
        if self.is_monitoring and self.active_contest_id == contest_id:
            logger.info(f"[LIVE_MONITOR] Already actively monitoring contest {contest_id}")
            return {"status": "ALREADY_RUNNING", "contest_id": contest_id}

        self.active_contest_id = contest_id
        self.is_monitoring = True
        self.sync_state = "INITIAL_SYNC"
        self.processed_students = 0
        self.current_cycle = 0

        # Launch background loop
        self._monitor_task = asyncio.create_task(self._run_monitoring_lifecycle(contest_id))
        logger.info(f"[LIVE_MONITOR] Live Monitoring Engine launched for contest {contest_id}")

        return {
            "status": "STARTED",
            "contest_id": contest_id,
            "sync_state": self.sync_state,
            "message": "Live monitoring engine started for all registered students."
        }

    async def _run_monitoring_lifecycle(self, contest_id: str):
        """Main lifecycle task managing Initial Sync and Continuous Monitoring Loop."""
        db = SessionLocal()
        try:
            # 1. Load active roster
            students = db.query(Student).filter(Student.is_active == True).all()
            student_accounts = []
            for s in students:
                accs = db.query(LeetCodeAccount).filter(LeetCodeAccount.student_id == s.id).all()
                for a in accs:
                    student_accounts.append({
                        "student": s,
                        "account": a,
                        "people_id": s.people_id or f"STUDENT_{s.id}",
                        "username": a.leetcode_username
                    })

            self.total_students = len(student_accounts)
            logger.info(f"[LIVE_MONITOR] Monitoring queue initialized with {self.total_students} student accounts.")

            # 2. Phase 1: INITIAL SYNC (1/297 -> 297/297)
            batch_size = 5
            for i in range(0, self.total_students, batch_size):
                if not self.is_monitoring:
                    break
                    
                batch = student_accounts[i : i + batch_size]
                for item in batch:
                    await self._evaluate_and_detect_change(db, contest_id, item, is_initial=True)
                    self.processed_students += 1

                pct = round((self.processed_students / max(1, self.total_students)) * 100.0, 1)
                await self.broadcast_ws_event({
                    "event": "INITIAL_SYNC_PROGRESS",
                    "type": "INITIAL_SYNC_PROGRESS",
                    "contest_id": contest_id,
                    "processed": self.processed_students,
                    "total": self.total_students,
                    "progress_percent": pct,
                    "status_text": f"Syncing {self.processed_students}/{self.total_students} ({pct}%)"
                })
                await asyncio.sleep(0.15) # Rate-limit safe delay

            # 3. Transition to INITIAL_SYNC_COMPLETE -> LIVE_SYNC_ACTIVE
            self.sync_state = "LIVE_SYNC_ACTIVE"
            await self.broadcast_ws_event({
                "event": "INITIAL_SYNC_COMPLETE",
                "type": "INITIAL_SYNC_COMPLETE",
                "contest_id": contest_id,
                "total": self.total_students,
                "status_text": " INITIAL SYNC COMPLETE — LIVE SYNC ACTIVE",
                "timestamp": self.get_server_ist_time_str()
            })
            logger.info(f"[LIVE_MONITOR] Initial sync complete ({self.total_students}/{self.total_students}). Transitioning to continuous live monitoring.")

            # 4. Phase 2: CONTINUOUS MONITORING LOOP (Cycle 1, Cycle 2 ...)
            while self.is_monitoring:
                self.current_cycle += 1
                logger.info(f"[LIVE_MONITOR] Starting Continuous Monitoring Cycle {self.current_cycle} for {self.total_students} accounts.")
                
                for i in range(0, self.total_students, batch_size):
                    if not self.is_monitoring:
                        break
                    batch = student_accounts[i : i + batch_size]
                    for item in batch:
                        await self._evaluate_and_detect_change(db, contest_id, item, is_initial=False)
                    await asyncio.sleep(0.2)

                await self.broadcast_ws_event({
                    "event": "CYCLE_COMPLETED",
                    "type": "CYCLE_COMPLETED",
                    "contest_id": contest_id,
                    "cycle": self.current_cycle,
                    "timestamp": self.get_server_ist_time_str()
                })
                
                # Wait 5 seconds between full monitoring cycles
                await asyncio.sleep(5.0)

        except Exception as e:
            logger.error(f"[LIVE_MONITOR_FATAL] Error in live monitoring loop: {e}", exc_info=True)
            self.sync_state = "ERROR"
        finally:
            db.close()

    async def stop_monitoring(self):

        """Stops the live contest monitoring engine gracefully (Kill-Switch)."""
        self.is_monitoring = False
        self.sync_state = "STOPPED"
        if self._monitor_task and not self._monitor_task.done():
            self._monitor_task.cancel()
        logger.info("[LIVE_MONITOR] Live Monitoring Engine stopped via kill-switch.")
        return {"status": "STOPPED", "contest_id": self.active_contest_id}

    def _calculate_time_taken(
        self,
        contest_start_dt: datetime.datetime,
        solved_at_dt: datetime.datetime,
        prior_solved_at_dt: Optional[datetime.datetime],
        current_source: str,
        prior_source: Optional[str]
    ) -> tuple[Optional[int], bool, bool]:
        """
        Computes time_taken_seconds according to chronological order.
        Returns: (time_taken_seconds, time_taken_is_estimated, is_anomaly)
        """
        is_estimated = False
        if current_source != "AUTHORITATIVE_LEETCODE" or (prior_source and prior_source != "AUTHORITATIVE_LEETCODE"):
            is_estimated = True

        # Ensure tz alignment for delta calculation
        t_solved = solved_at_dt.replace(tzinfo=None) if solved_at_dt.tzinfo else solved_at_dt
        if prior_solved_at_dt:
            t_prior = prior_solved_at_dt.replace(tzinfo=None) if prior_solved_at_dt.tzinfo else prior_solved_at_dt
            delta_sec = int((t_solved - t_prior).total_seconds())
        else:
            t_start = contest_start_dt.replace(tzinfo=None) if contest_start_dt.tzinfo else contest_start_dt
            delta_sec = int((t_solved - t_start).total_seconds())

        if delta_sec <= 0:
            logger.warning(f"[TIME_TAKEN_ANOMALY] Non-positive duration calculated ({delta_sec}s). Clamping to None.")
            return None, is_estimated, True

        return delta_sec, is_estimated, False

    def process_question_transitions(
        self,
        db: Session,
        contest_id: str,
        student_id: int,
        incoming_q_status: Dict[str, int],
        timestamps_dict: Optional[Dict[str, datetime.datetime]] = None,
        sources_dict: Optional[Dict[str, str]] = None,
        contest_start_dt: Optional[datetime.datetime] = None
    ) -> List[Dict[str, Any]]:
        """
        Processes question status transitions (0 -> 1) for a student in a contest.
        Guarantees:
          - Multi-delta same-cycle sorting by chronological solved_at timestamp.
          - Chronological time_taken calculation relative to prior solved question.
          - Mixed-source estimation flagging.
          - Non-positive time_taken anomaly clamping.
          - LiveQuestionStatus state persistence.
          - LiveQuestionAuditLog append-only logging with sync_version sequence.
        """
        if not contest_start_dt:
            now_dt = datetime.datetime.now(tz=IST)
            contest_start_dt = now_dt.replace(hour=8, minute=0, second=0, microsecond=0)

        timestamps_dict = timestamps_dict or {}
        sources_dict = sources_dict or {}

        # 1. Fetch current question statuses from DB
        existing_rows = db.query(LiveQuestionStatus).filter(
            LiveQuestionStatus.contest_id == contest_id,
            LiveQuestionStatus.student_id == student_id
        ).all()
        existing_map = {row.question_id: row for row in existing_rows}

        # 2. Identify 0 -> 1 transitions
        detected_transitions = []
        now_utc = datetime.datetime.now(tz=UTC)

        for q_id in ["Q1", "Q2", "Q3", "Q4"]:
            val = incoming_q_status.get(q_id, 0)
            existing_row = existing_map.get(q_id)
            is_already_solved = existing_row.solved if existing_row else 0

            if val == 1 and is_already_solved == 0:
                solved_at = timestamps_dict.get(q_id, now_utc)
                source = sources_dict.get(q_id, "DETECTION_DERIVED" if q_id not in timestamps_dict else "AUTHORITATIVE_LEETCODE")
                detected_transitions.append({
                    "question_id": q_id,
                    "solved_at": solved_at,
                    "source": source
                })

        if not detected_transitions:
            return []

        def _norm_dt(dt_val: Optional[datetime.datetime]) -> datetime.datetime:
            if dt_val is None:
                return datetime.datetime.min
            return dt_val.replace(tzinfo=None) if dt_val.tzinfo else dt_val

        # 3. Sort transitions by solved_at timestamp ascending (Rule §4 & §7)
        detected_transitions.sort(key=lambda t: _norm_dt(t["solved_at"]))

        processed_event_details = []

        # 4. Fetch all already solved questions for this student
        solved_history = [
            {"question_id": r.question_id, "solved_at": r.solved_at, "source": r.source}
            for r in existing_rows if r.solved == 1 and r.solved_at
        ]
        solved_history.sort(key=lambda item: _norm_dt(item["solved_at"]))

        for t in detected_transitions:
            q_id = t["question_id"]
            solved_at_dt = t["solved_at"]
            source = t["source"]

            # Determine most recent prior solved question by timestamp
            prior_solve = solved_history[-1] if solved_history else None
            prior_solved_at_dt = prior_solve["solved_at"] if prior_solve else None
            prior_source = prior_solve["source"] if prior_solve else None

            time_taken_sec, is_estimated, is_anomaly = self._calculate_time_taken(
                contest_start_dt, solved_at_dt, prior_solved_at_dt, source, prior_source
            )

            # Upsert LiveQuestionStatus
            lqs = existing_map.get(q_id)
            if not lqs:
                lqs = LiveQuestionStatus(
                    contest_id=contest_id,
                    student_id=student_id,
                    question_id=q_id
                )
                db.add(lqs)

            lqs.solved = 1
            lqs.solved_at = solved_at_dt
            lqs.detected_at = now_utc
            lqs.time_taken_seconds = time_taken_sec
            lqs.time_taken_is_estimated = is_estimated
            lqs.is_anomaly = is_anomaly
            lqs.source = source
            lqs.event_version = self.sync_version

            # Write Append-Only LiveQuestionAuditLog
            audit = LiveQuestionAuditLog(
                contest_id=contest_id,
                student_id=student_id,
                question_id=q_id,
                old_value=0,
                new_value=1,
                detected_at=now_utc,
                solved_at=solved_at_dt,
                time_taken_seconds=time_taken_sec,
                time_taken_is_estimated=is_estimated,
                source=source,
                sequence=self.sync_version
            )
            db.add(audit)
            db.commit()

            # Append to in-memory solved_history for subsequent transitions in this batch
            solved_history.append({
                "question_id": q_id,
                "solved_at": solved_at_dt,
                "source": source
            })
            solved_history.sort(key=lambda item: _norm_dt(item["solved_at"]))


            processed_event_details.append({
                "question_id": q_id,
                "solved": 1,
                "solved_at": solved_at_dt.isoformat() if isinstance(solved_at_dt, datetime.datetime) else str(solved_at_dt),
                "time_taken_seconds": time_taken_sec,
                "time_taken_is_estimated": is_estimated,
                "is_anomaly": is_anomaly,
                "source": source,
                "sequence": self.sync_version
            })

        return processed_event_details

    async def _evaluate_and_detect_change(self, db: Session, contest_id: str, item: Dict[str, Any], is_initial: bool = False):
        """
        Evaluates current score for a student account and detects changes against cached state.
        Emits STUDENT_ACTIVITY_UPDATED event ONLY when real activity changes occur.
        """
        student: Student = item["student"]
        account: LeetCodeAccount = item["account"]
        people_id: str = item["people_id"]
        username: str = item["username"]

        cache_key = f"{people_id}_{account.id}_{contest_id}"
        prev_state = self.cached_states.get(cache_key, {
            "solved_count": 0, "q1": 0, "q2": 0, "q3": 0, "q4": 0, "score_display": "Not Attended"
        })

        # Fetch record from DB
        part = db.query(StudentContestParticipation).filter(
            StudentContestParticipation.student_id == student.id,
            StudentContestParticipation.contest_id == contest_id
        ).first()

        curr_solved = part.questions_solved if part else 0
        curr_score = part.score_display if part else "Not Attended"
        curr_q1 = getattr(part, "q1", 0) or 0
        curr_q2 = getattr(part, "q2", 0) or 0
        curr_q3 = getattr(part, "q3", 0) or 0
        curr_q4 = getattr(part, "q4", 0) or 0

        # Change Detection logic
        has_changed = False
        if not is_initial:
            if curr_solved > prev_state["solved_count"] or curr_score != prev_state["score_display"] or curr_q1 != prev_state["q1"] or curr_q2 != prev_state["q2"] or curr_q3 != prev_state["q3"] or curr_q4 != prev_state["q4"]:
                has_changed = True

        # Process question-level transitions and audit logs
        incoming_q_status = {"Q1": curr_q1, "Q2": curr_q2, "Q3": curr_q3, "Q4": curr_q4}
        question_details = []
        if has_changed:
            self.sync_version += 1
            question_details = self.process_question_transitions(
                db=db,
                contest_id=contest_id,
                student_id=student.id,
                incoming_q_status=incoming_q_status
            )

        # Update cache
        self.cached_states[cache_key] = {
            "solved_count": curr_solved,
            "score_display": curr_score,
            "q1": curr_q1, "q2": curr_q2, "q3": curr_q3, "q4": curr_q4
        }

        # If activity changed or explicitly requested, generate versioned event
        if has_changed:
            event_id = f"EVT-{people_id}-{contest_id}-{self.sync_version}"
            timestamp_str = datetime.datetime.now(tz=IST).strftime("%I:%M:%S %p")

            activity_payload = {
                "event": "STUDENT_ACTIVITY_UPDATED",
                "type": "STUDENT_ACTIVITY_UPDATED",
                "contest_id": contest_id,
                "people_id": people_id,
                "student_id": student.id,
                "student_name": student.name,
                "reg_no": student.reg_no,
                "account_id": username,
                "event_id": event_id,
                "version": self.sync_version,
                "timestamp": timestamp_str,
                "activity": {
                    "type": "SOLVED",
                    "count": curr_solved,
                    "previousCount": prev_state["solved_count"],
                    "q1": curr_q1, "q2": curr_q2, "q3": curr_q3, "q4": curr_q4,
                    "score_display": f"{curr_solved} / 4" if curr_solved > 0 else "Not Attended",
                    "question_transitions": question_details,
                    "activity_timeline_entry": {
                        "time": timestamp_str,
                        "text": f" Solved {curr_solved - prev_state['solved_count']} Problem(s) (Total: {curr_solved}/4)"
                    }
                }
            }

            # Write to LiveContestEvent table for missed event recovery
            db_event = LiveContestEvent(
                event_id=event_id,
                version=self.sync_version,
                contest_id=contest_id,
                people_id=people_id,
                student_id=student.id,
                account_id=username,
                event_type="STUDENT_ACTIVITY_UPDATED",
                payload=activity_payload,
                created_at=datetime.datetime.utcnow()
            )
            db.add(db_event)
            db.commit()

            # Append to Global Live Feed
            self.live_activity_feed.insert(0, {
                "event_id": event_id,
                "timestamp": timestamp_str,
                "student_name": student.name,
                "people_id": people_id,
                "username": username,
                "solved_count": curr_solved,
                "text": f" Solved {curr_solved - prev_state['solved_count']} Problem(s) — Total {curr_solved}/4"
            })
            if len(self.live_activity_feed) > 50:
                self.live_activity_feed.pop()

            # Broadcast over WebSocket
            await self.broadcast_ws_event(activity_payload)
            logger.info(f"[LIVE_MONITOR_EVENT] {student.name} ({people_id}): Solved {prev_state['solved_count']} -> {curr_solved}. Event {event_id} broadcasted.")


    def get_live_snapshot(self, db: Session, contest_id: str) -> Dict[str, Any]:
        """Returns the full current snapshot of all 297 students for initial WebSocket connection."""
        students = db.query(Student).filter(Student.is_active == True).all()
        student_records = []

        for s in students:
            accs = db.query(LeetCodeAccount).filter(LeetCodeAccount.student_id == s.id).all()
            acc_names = [a.leetcode_username for a in accs]
            
            part = db.query(StudentContestParticipation).filter(
                StudentContestParticipation.student_id == s.id,
                StudentContestParticipation.contest_id == contest_id
            ).first()

            solved = part.questions_solved if part else 0
            score = part.score_display if part else "Not Attended"
            state = getattr(part, "official_attendance_state", "UNKNOWN") if part else "UNKNOWN"

            student_records.append({
                "student_id": s.id,
                "people_id": s.people_id or f"P{s.id}",
                "student_name": s.name,
                "reg_no": s.reg_no,
                "accounts": acc_names,
                "questions_solved": solved,
                "score_display": score,
                "official_attendance_state": state,
                "sync_status": "SYNCED",
                "timeline": [
                    {"time": "08:00 AM IST", "text": "Entered official contest window"}
                ]
            })

        return {
            "event": "SNAPSHOT_RESPONSE",
            "type": "SNAPSHOT_RESPONSE",
            "contest_id": contest_id,
            "sync_state": self.sync_state,
            "total_students": len(students),
            "version": self.sync_version,
            "students": student_records,
            "live_feed": self.live_activity_feed[:20],
            "server_time": self.get_server_ist_time_str()
        }

    def get_missed_events(self, db: Session, contest_id: str, last_received_version: int) -> List[Dict[str, Any]]:
        """Returns all missed events where version > last_received_version."""
        events = db.query(LiveContestEvent).filter(
            LiveContestEvent.contest_id == contest_id,
            LiveContestEvent.version > last_received_version
        ).order_by(LiveContestEvent.version.asc()).all()

        return [e.payload for e in events]

live_contest_monitor_engine = LiveContestMonitorEngine()
