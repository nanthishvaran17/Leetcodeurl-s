from typing import List, Dict, Any, Optional
from fastapi import WebSocket, WebSocketDisconnect
from backend.logger import logger
import json
import asyncio

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self._message_queue = []
        self._batch_task: Optional[asyncio.Task] = None
        self._batch_interval = 0.5  # 500ms

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket client connected. Total clients: {len(self.active_connections)}")
        
        # Start background batch flush if not running
        if self._batch_task is None or self._batch_task.done():
            self._batch_task = asyncio.create_task(self._flush_loop())

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"WebSocket client disconnected. Remaining clients: {len(self.active_connections)}")

    async def _flush_loop(self):
        """Background loop that flushes queued messages in batches."""
        while True:
            await asyncio.sleep(self._batch_interval)
            if not self.active_connections:
                continue
            if not self._message_queue:
                continue
                
            # Take all currently queued messages
            batch = self._message_queue[:]
            self._message_queue.clear()
            
            if batch:
                await self.broadcast({"type": "BATCH_UPDATES", "events": batch})

    async def broadcast(self, message: dict):
        payload = json.dumps(message)
        disconnected = []
        for connection in list(self.active_connections):
            try:
                await connection.send_text(payload)
            except Exception as e:
                logger.error(f"Error broadcasting to WS client: {e}")
                disconnected.append(connection)
        
        for conn in disconnected:
            self.disconnect(conn)

    def broadcast_sync(self, message: dict):
        """Thread-safe synchronous wrapper around broadcast."""
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.create_task(self.broadcast(message))
            else:
                loop.run_until_complete(self.broadcast(message))
        except Exception as e:
            try:
                new_loop = asyncio.new_event_loop()
                new_loop.run_until_complete(self.broadcast(message))
                new_loop.close()
            except Exception as inner_e:
                logger.warning(f"Could not broadcast sync event: {inner_e}")

    async def broadcast_contest_result(
        self,
        student_id: int,
        student_name: str,
        reg_no: str,
        username: str,
        contest_id: str,
        session_id: int,
        q1: int,
        q2: int,
        q3: int,
        q4: int,
        solved_count: int,
        official_rank: Optional[int] = None,
        finish_time: Optional[str] = None,
        participation_status: str = "PUBLIC",
        evidence_state: str = "VERIFIED_LIVE",
        department_name: Optional[str] = None,
        year_level: Optional[str] = None,
        dataset_version: int = 1
    ):
        """Targeted broadcast when a student's question solve state updates. Uses batching."""
        payload = {
            "type": "CONTEST_RESULT_UPDATED",
            "studentId": student_id,
            "studentName": student_name,
            "regNo": reg_no,
            "username": username,
            "contestId": contest_id,
            "sessionId": session_id,
            "q1": q1,
            "q2": q2,
            "q3": q3,
            "q4": q4,
            "solvedCount": solved_count,
            "officialRank": official_rank,
            "finishTime": finish_time,
            "participationStatus": participation_status,
            "evidenceState": evidence_state,
            "departmentName": department_name,
            "yearLevel": year_level,
            "datasetVersion": dataset_version,
            "updatedAt": asyncio.get_event_loop().time() if asyncio.get_event_loop() else 0
        }
        self._message_queue.append(payload)

    async def broadcast_contest_summary(
        self,
        session_id: int,
        contest_id: str,
        metrics: Dict[str, Any],
        dataset_version: int = 1
    ):
        """Targeted broadcast when contest aggregates update. Queued for batching."""
        payload = {
            "type": "CONTEST_SUMMARY_UPDATED",
            "sessionId": session_id,
            "contestId": contest_id,
            "metrics": metrics,
            "datasetVersion": dataset_version
        }
        self._message_queue.append(payload)


manager = ConnectionManager()
connection_manager = manager
