"""
metrics.py — Real-time Production Metrics Collector
Tracks contest status distributions, failure rates, and error logs for observability.
"""
from collections import defaultdict
import datetime
from typing import Dict, Any, List
from backend.services.contest_classifier import ContestStatus

class MetricsCollector:
    def __init__(self):
        self.counts: Dict[str, int] = defaultdict(int)
        self.errors: List[Dict[str, Any]] = []

    def record_status(self, status: ContestStatus | str):
        val = status.value if hasattr(status, 'value') else str(status)
        self.counts[val] += 1

    def record_error(self, student_id: int, contest_id: str, error: str):
        self.errors.append({
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "student_id": student_id,
            "contest_id": contest_id,
            "error": error,
        })
        # Keep last 500 errors to prevent unbounded growth
        if len(self.errors) > 500:
            self.errors = self.errors[-500:]

    def get_summary(self) -> Dict[str, Any]:
        return {
            "status_distribution": dict(self.counts),
            "total_errors": len(self.errors),
            "recent_errors": self.errors[-10:],
        }

    def reset(self):
        self.counts.clear()
        self.errors.clear()

# Global Singleton Instance
metrics = MetricsCollector()
