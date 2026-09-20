import asyncio
import os
import datetime
import httpx
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text
from backend.logger import logger
from backend.database import SessionLocal
from backend.models import Student, WeeklySession
from backend.services.token_bucket_limiter import global_token_bucket_limiter
from backend.websocket_manager import connection_manager
from backend.services.contest_discovery import discover_contest_metadata, get_upcoming_sunday_date, get_current_ist_datetime

class LiveDashboardTracker:
    def __init__(self):
        self.contest_id: Optional[str] = None
        self.session_id: Optional[int] = None
        self.title_slugs: List[str] = []
        self.total_participants: int = 0
        self.is_tracking: bool = False
        self.consecutive_failures: int = 0
        self.last_successful_counts: Dict[str, int] = {}
        self.last_successful_update: Optional[str] = None
        self.phase: str = "ended"
        self.last_broadcast_payload: Optional[Dict[str, Any]] = None
        self._lock = asyncio.Lock()
        
    async def get_active_students(self, db: Session) -> List[Student]:
        return db.query(Student).filter(
            (Student.is_active == True) | (Student.is_active.is_(None))
        ).all()

    async def start_tracking(self, contest_id: str, session_id: int):
        """Called by the scheduler at 8:00 AM IST."""
        async with self._lock:
            self.contest_id = contest_id
            self.session_id = session_id
            self.is_tracking = True
            self.consecutive_failures = 0
            self.phase = "active"
            self.last_successful_counts = {}
            self.last_successful_update = get_current_ist_datetime().isoformat()
            
            # Fetch contest metadata
            now_ist = get_current_ist_datetime()
            upcoming_sunday = get_upcoming_sunday_date(now_ist)
            meta = discover_contest_metadata(upcoming_sunday)
            self.title_slugs = meta.get("problem_slugs", [])
            
            db = SessionLocal()
            try:
                active_students = await self.get_active_students(db)
                self.total_participants = len(active_students)
                for slug in self.title_slugs:
                    self.last_successful_counts[slug] = 0
            finally:
                db.close()
                
            logger.info(f"[LIVE_TRACKER] Started live tracking for {contest_id}. Slugs: {self.title_slugs}")
            
            # Add polling job
            from backend.scheduler import scheduler
            from apscheduler.triggers.interval import IntervalTrigger
            
            poll_interval = int(os.environ.get('CONTEST_POLL_INTERVAL_SECONDS', 600))
            scheduler.add_job(
                self.poll_live_data,
                IntervalTrigger(seconds=poll_interval, timezone=now_ist.tzinfo),
                id='live_dashboard_poll',
                replace_existing=True
            )
            
            await self._broadcast_state("live")

    async def stop_tracking(self):
        """Called by the scheduler at 9:30 AM IST."""
        async with self._lock:
            self.is_tracking = False
            self.phase = "ended"
            
            # Remove polling job
            from backend.scheduler import scheduler
            if scheduler.get_job('live_dashboard_poll'):
                scheduler.remove_job('live_dashboard_poll')
                
            logger.info("[LIVE_TRACKER] Stopped live tracking.")
            await self._broadcast_state("live") # will send ended phase

    async def _fetch_student_submissions(self, client: httpx.AsyncClient, student: Student, slugs_set: set):
        username = student.username
        if not username:
            return []
            
        async with global_token_bucket_limiter:
            try:
                query = """
                query recentAcSubmissions($username: String!, $limit: Int!) {
                  recentAcSubmissionList(username: $username, limit: $limit) {
                    titleSlug
                    timestamp
                  }
                }
                """
                resp = await client.post(
                    "https://leetcode.com/graphql",
                    json={"query": query, "variables": {"username": username, "limit": 75}},
                    headers={
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                        "Accept-Encoding": "identity",
                        "Content-Type": "application/json"
                    },
                    timeout=15.0
                )
                if resp.status_code == 200:
                    data = resp.json().get("data", {}).get("recentAcSubmissionList", [])
                    matched = []
                    if data:
                        for sub in data:
                            if sub.get("titleSlug") in slugs_set:
                                matched.append({
                                    "student_id": student.id,
                                    "title_slug": sub.get("titleSlug"),
                                    "timestamp": int(sub.get("timestamp"))
                                })
                    return matched
            except Exception as e:
                logger.debug(f"[LIVE_TRACKER] Failed to fetch {username}: {e}")
        return None 

    async def poll_live_data(self):
        """
        Production-grade poll loop using bulk contest ranking pagination
        and local 590+ student roster join.
        """
        if not self.is_tracking or not self.contest_id:
            return

        logger.info(f"[LIVE_TRACKER] Starting bulk contest ranking poll cycle for {self.contest_id}...")
        
        db = SessionLocal()
        try:
            active_students = await self.get_active_students(db)
            roster_map = {s.username.strip().lower(): s for s in active_students if s.username and s.username.strip()}
            target_usernames = set(roster_map.keys())

            contest_slug = self.contest_id.lower().replace(" ", "-")
            
            # Step 1-4: Fetch bulk contest ranking pages and perform local join
            from backend.services.leetcode_adapter import ProductionLeetCodeAdapter
            adapter = ProductionLeetCodeAdapter()
            matched_map, capability_status = await adapter.fetch_contest_ranking_pages_bulk(
                contest_slug=contest_slug,
                max_pages=200,
                target_usernames=target_usernames
            )

            if capability_status in ("RATE_LIMITED", "UPSTREAM_ERROR", "FETCH_FAILED") and not matched_map:
                async with self._lock:
                    self.consecutive_failures += 1
                    logger.warning(f"[LIVE_TRACKER] Bulk ranking poll failed ({capability_status}). Consecutive: {self.consecutive_failures}")
                    freshness = "stale"
                    if self.consecutive_failures >= 3:
                        self.phase = "degraded"
                    await self._broadcast_state(freshness, capability_status)
                return

            fetched_at = int(get_current_ist_datetime().timestamp())
            all_submissions = []

            for u_norm, entry in matched_map.items():
                student = roster_map.get(u_norm)
                if not student:
                    continue
                for q in entry.questions:
                    all_submissions.append({
                        "student_id": student.id,
                        "title_slug": q.get("question_id") or "q_solved",
                        "timestamp": q.get("time") or fetched_at
                    })

            if all_submissions:
                try:
                    stmt = text("""
                        INSERT INTO submission_log (student_id, contest_id, title_slug, submitted_at, fetched_at)
                        VALUES (:student_id, :contest_id, :title_slug, :timestamp, :fetched_at)
                        ON CONFLICT (student_id, contest_id, title_slug, submitted_at) DO NOTHING
                    """)
                    for sub in all_submissions:
                        db.execute(stmt, {
                            "student_id": sub["student_id"],
                            "contest_id": self.contest_id,
                            "title_slug": sub["title_slug"],
                            "timestamp": sub["timestamp"],
                            "fetched_at": fetched_at
                        })
                    db.commit()
                except Exception as db_err:
                    logger.error(f"[LIVE_TRACKER] DB insert error: {db_err}")
                    db.rollback()

            counts = {}
            for slug in self.title_slugs:
                cnt = db.execute(text("""
                    SELECT COUNT(DISTINCT student_id) FROM submission_log
                    WHERE contest_id = :contest_id AND title_slug = :title_slug
                """), {"contest_id": self.contest_id, "title_slug": slug}).scalar()
                counts[slug] = cnt or 0

            # Compute matched participants count
            matched_count = len(matched_map)

            async with self._lock:
                self.consecutive_failures = 0
                self.phase = "active"
                self.last_successful_counts = counts
                self.last_successful_update = get_current_ist_datetime().isoformat()
                await self._broadcast_state("live", "PUBLIC_AVAILABLE", matched_count)
                
        except Exception as e:
            logger.error(f"[LIVE_TRACKER] Unexpected error in poll loop: {e}", exc_info=True)
            async with self._lock:
                self.consecutive_failures += 1
                freshness = "stale"
                if self.consecutive_failures >= 3:
                    self.phase = "degraded"
                await self._broadcast_state(freshness, "FETCH_FAILED")
        finally:
            db.close()

    async def _broadcast_state(self, freshness: str, capability_status: str = "PUBLIC_AVAILABLE", matched_count: int = 0):
        import hashlib
        now_iso = get_current_ist_datetime().isoformat()
        seq_num = int(get_current_ist_datetime().timestamp() * 1000)

        data_body = {
            "phase": self.phase,
            "counts": self.last_successful_counts,
            "data_freshness": freshness,
            "capability_status": capability_status,
            "last_successful_update": self.last_successful_update,
            "total_participants": self.total_participants,
            "matched_participants": matched_count,
            "contest_id": self.contest_id,
            "sequence_number": seq_num,
            "status_badge": "🟢 LIVE" if freshness == "live" else ("🟡 DEGRADED" if freshness == "stale" else "🔴 STALE")
        }

        payload_hash = hashlib.sha256(str(data_body).encode("utf-8")).hexdigest()[:16]

        payload = {
            "type": "contest_update",
            "timestamp": now_iso,
            "payload_hash": payload_hash,
            "data": data_body
        }

        # Deduplicate payload broadcast if unchanged
        if self.last_broadcast_payload and self.last_broadcast_payload.get("payload_hash") == payload_hash:
            return

        self.last_broadcast_payload = payload
        await connection_manager.broadcast(payload)
        
    def get_cached_state(self) -> Optional[Dict[str, Any]]:
        return self.last_broadcast_payload

live_dashboard_tracker = LiveDashboardTracker()
