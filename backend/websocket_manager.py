from typing import List, Dict, Any, Optional
from fastapi import WebSocket
from backend.logger import logger
import json
import time
import asyncio
import os
try:
    import redis.asyncio as redis
except ImportError:
    redis = None

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self._message_queue = []
        self._batch_task: Optional[asyncio.Task] = None
        self._batch_interval = 0.5  # 500ms

        # Contest-scoped subscriptions: session_id → set of WebSocket connections
        # Allows targeted delivery of VIRTUAL_RESULT_UPDATED events to only the
        # clients watching that specific session.
        self._subscriptions: Dict[int, set] = {}  # session_id -> Set[WebSocket]

        # Per-WebSocket user context (populated on authenticated connect)
        # _ws_user: ws -> {user_id, role, active_conversation: str | None}
        self._ws_user: Dict[WebSocket, Dict[str, Any]] = {}

        # Sequence tracking: prevents stale events from overwriting fresher state.
        # Key: "virtual_{session_id}_{student_id}" → last_seen_sequence (epoch ms)
        self._event_sequences: Dict[str, int] = {}

        self.redis_url = os.environ.get("REDIS_URL")
        self.redis_client = None
        self.redis_pubsub = None
        self._redis_task = None

    async def _init_redis(self):
        if self.redis_url and redis and not self.redis_client:
            try:
                self.redis_client = redis.from_url(self.redis_url)
                self.redis_pubsub = self.redis_client.pubsub()
                await self.redis_pubsub.subscribe("live_events")
                self._redis_task = asyncio.create_task(self._redis_listener())
                logger.info("Connected to Redis Pub/Sub for WebSockets")
            except Exception as e:
                logger.error(f"Failed to connect to Redis: {e}")
                self.redis_url = None # fallback to memory

    async def _redis_listener(self):
        try:
            async for message in self.redis_pubsub.listen():
                if message["type"] == "message":
                    data = message["data"]
                    payload = data.decode("utf-8") if isinstance(data, bytes) else data
                    await self._broadcast_to_local_connections(payload)
        except Exception as e:
            logger.error(f"Redis listener failed: {e}")


    async def connect(self, websocket: WebSocket, token: Optional[str] = None) -> bool:
        """Accept a WebSocket connection. Enforces strict authentication when a token is provided."""
        await websocket.accept()

        user_ctx: Dict[str, Any] = {"user_id": None, "role": "anonymous", "authenticated": False}
        if token:
            try:
                user_ctx = self._decode_ws_token(token)
                logger.info(
                    f"[WS_AUTH] authentication_success user_id={user_ctx.get('user_id')} "
                    f"email={user_ctx.get('email')} role={user_ctx.get('role')}"
                )
            except Exception as _auth_err:
                logger.error(f"[WS_AUTH] authentication_failed token_provided=true error={_auth_err}")
                await websocket.close(code=1008, reason="Authentication failed: invalid or expired JWT token")
                return False

        self.active_connections.append(websocket)
        self._ws_user[websocket] = user_ctx

        logger.info(
            f"WebSocket connected. user={user_ctx.get('user_id')} role={user_ctx.get('role')} "
            f"authenticated={user_ctx.get('authenticated')} total={len(self.active_connections)}"
        )

        if self.redis_url and not self.redis_client:
            await self._init_redis()

        # Start background batch flush if not running
        if self._batch_task is None or self._batch_task.done():
            self._batch_task = asyncio.create_task(self._flush_loop())

        return True

    def _decode_ws_token(self, token: str) -> Dict[str, Any]:
        """Validate a JWT token and return user context dict. Accepts standard app JWT and Firebase ID tokens."""
        if not token:
            raise ValueError("Token is empty")

        clean_token = token.strip()
        if clean_token.lower().startswith("bearer "):
            clean_token = clean_token[7:].strip()

        # 1. Gather candidate secret keys
        secret_keys = []
        try:
            from backend.config import settings
            if getattr(settings, "SECRET_KEY", None):
                secret_keys.append(settings.SECRET_KEY)
        except Exception as _cfg_err:
            logger.warning(f"[WS-AUTH] Could not load settings.SECRET_KEY: {_cfg_err}")

        env_key = os.environ.get("SECRET_KEY", "")
        if env_key and env_key not in secret_keys:
            secret_keys.append(env_key)

        fallback_key = "super-secret-key-change-this-in-production-2026"
        if fallback_key not in secret_keys:
            secret_keys.append(fallback_key)

        last_jwt_error = None
        for s_key in secret_keys:
            for algo in ["HS256", "RS256"]:
                # Try standard PyJWT
                try:
                    import jwt
                    payload = jwt.decode(clean_token, s_key, algorithms=[algo])
                    sub = payload.get("sub") or payload.get("user_id") or payload.get("email")
                    email = payload.get("email")
                    role = payload.get("role", "authenticated")
                    dept_id = payload.get("department_id")
                    logger.info(f"[WS-AUTH] Successfully decoded JWT token via PyJWT. sub={sub} email={email} role={role}")
                    return {
                        "user_id": str(sub),
                        "email": email,
                        "role": role,
                        "department_id": dept_id,
                        "authenticated": True
                    }
                except Exception as _jwt_err:
                    last_jwt_error = _jwt_err

                # Fallback to python-jose
                try:
                    from jose import jwt as jose_jwt
                    payload = jose_jwt.decode(clean_token, s_key, algorithms=[algo])
                    sub = payload.get("sub") or payload.get("user_id") or payload.get("email")
                    email = payload.get("email")
                    role = payload.get("role", "authenticated")
                    dept_id = payload.get("department_id")
                    logger.info(f"[WS-AUTH] Successfully decoded JWT token via python-jose. sub={sub} email={email} role={role}")
                    return {
                        "user_id": str(sub),
                        "email": email,
                        "role": role,
                        "department_id": dept_id,
                        "authenticated": True
                    }
                except Exception as _jose_err:
                    if not last_jwt_error:
                        last_jwt_error = _jose_err

        logger.warning(f"[WS-AUTH] Standard JWT decode failed across {len(secret_keys)} keys. Last error: {last_jwt_error}")

        # 2. Try Firebase ID Token
        try:
            import firebase_admin
            from firebase_admin import auth as firebase_auth
            if firebase_admin._apps:
                fb_decoded = firebase_auth.verify_id_token(clean_token)
                fb_email = (fb_decoded.get("email") or "").strip().lower()
                fb_uid = fb_decoded.get("uid") or fb_email
                logger.info(f"[WS-AUTH] Successfully decoded Firebase token. uid={fb_uid} email={fb_email}")
                return {
                    "user_id": str(fb_uid),
                    "email": fb_email,
                    "role": "authenticated",
                    "authenticated": True
                }
        except Exception as _fb_err:
            logger.warning(f"[WS-AUTH] Firebase token verify notice: {_fb_err}")

        raise ValueError(f"Could not decode or verify WebSocket auth token. Last JWT error: {last_jwt_error}")

    def subscribe_session(self, websocket: WebSocket, session_id: int):
        """Subscribe a WebSocket to a specific contest session's events."""
        if session_id not in self._subscriptions:
            self._subscriptions[session_id] = set()
        self._subscriptions[session_id].add(websocket)
        logger.info(f"[WS_SUB] ws subscribed to session={session_id}")

    def unsubscribe_session(self, websocket: WebSocket, session_id: int):
        """Unsubscribe a WebSocket from a contest session's events."""
        if session_id in self._subscriptions:
            self._subscriptions[session_id].discard(websocket)

    def unsubscribe_all(self, websocket: WebSocket):
        """Remove a WebSocket from all session subscriptions (on disconnect)."""
        for subs in self._subscriptions.values():
            subs.discard(websocket)
        self._ws_user.pop(websocket, None)

    def set_active_conversation(self, websocket: WebSocket, conversation_id: Optional[str]):
        """Sets the currently active conversation for a WebSocket connection."""
        if websocket in self._ws_user:
            self._ws_user[websocket]["active_conversation"] = conversation_id

    def is_user_in_conversation(self, user_id: str, conversation_id: str) -> bool:
        """Checks if a user has an active WebSocket looking at the specified conversation."""
        for ctx in self._ws_user.values():
            if ctx.get("user_id") == user_id and ctx.get("active_conversation") == conversation_id:
                return True
        return False

    def is_sequence_fresh(self, scope_key: str, incoming_sequence: int) -> bool:
        """
        Returns True if the incoming event is newer than the last seen for this scope.
        Scope key format: 'virtual_{session_id}_{student_id}'
        Thread-safe only under asyncio single-thread assumption.
        """
        last = self._event_sequences.get(scope_key, 0)
        if incoming_sequence <= last:
            return False
        self._event_sequences[scope_key] = incoming_sequence
        return True

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"WebSocket client disconnected. Remaining clients: {len(self.active_connections)}")
        self.unsubscribe_all(websocket)

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
        if self.redis_client:
            try:
                await self.redis_client.publish("live_events", payload)
            except Exception as e:
                logger.error(f"Redis publish failed: {e}")
                await self._broadcast_to_local_connections(payload)
        else:
            await self._broadcast_to_local_connections(payload)

    async def _broadcast_to_local_connections(self, payload: str):
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

    async def send_to_user(self, user_id: str, message: dict):
        """Sends a WebSocket message to all active connections matching user_id, email, or username."""
        if not user_id:
            return
        target = str(user_id).strip().lower()
        payload = json.dumps(message)
        disconnected = []
        sent_count = 0

        logger.info(f"[NOTIF-DEBUG] WEBSOCKET_SEND_STARTED target={target} active_total={len(self.active_connections)}")

        for ws, ctx in list(self._ws_user.items()):
            ws_uid = str(ctx.get("user_id") or "").strip().lower()
            ws_email = str(ctx.get("email") or "").strip().lower()
            
            # Check match against user_id, email, or substring match
            is_match = (
                ws_uid == target or 
                ws_email == target or 
                (ws_uid and target in ws_uid) or 
                (ws_email and target in ws_email) or
                (target.startswith("staff_") and target.replace("staff_", "") == ws_uid)
            )

            if is_match:
                try:
                    await ws.send_text(payload)
                    sent_count += 1
                    logger.info(f"[NOTIF-DEBUG] WEBSOCKET_SEND_SUCCESS target={target} ws_uid={ws_uid} ws_email={ws_email}")
                except Exception as e:
                    logger.warning(f"[WS_SEND_USER] Error sending to user {user_id}: {e}")
                    disconnected.append(ws)

        if sent_count == 0:
            logger.warning(f"[NOTIF-DEBUG] WEBSOCKET_SEND_FAILED target={target} - No active matching WebSocket connection found!")

        for conn in disconnected:
            self.disconnect(conn)

    def send_to_user_sync(self, user_id: str, message: dict):
        """Thread-safe synchronous wrapper around send_to_user."""
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.create_task(self.send_to_user(user_id, message))
            else:
                loop.run_until_complete(self.send_to_user(user_id, message))
        except Exception as e:
            try:
                new_loop = asyncio.new_event_loop()
                new_loop.run_until_complete(self.send_to_user(user_id, message))
                new_loop.close()
            except Exception as inner_e:
                logger.warning(f"Could not send sync message to user {user_id}: {inner_e}")

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


    async def broadcast_entity_created(self, entity_type: str, entity_id: Any, data: Dict[str, Any], version: int = 1):
        """Broadcasts that a new entity was created."""
        payload = {
            "type": f"{entity_type.upper()}_CREATED",
            "entityId": entity_id,
            "data": data,
            "version": version,
            "server_timestamp": int(time.time() * 1000)
        }
        self._message_queue.append(payload)

    async def broadcast_entity_updated(self, entity_type: str, entity_id: Any, changes: Dict[str, Any], version: int = 1):
        """Broadcasts that an entity was updated."""
        payload = {
            "type": f"{entity_type.upper()}_UPDATED",
            "entityId": entity_id,
            "changes": changes,
            "version": version,
            "server_timestamp": int(time.time() * 1000)
        }
        self._message_queue.append(payload)

    async def broadcast_entity_deleted(self, entity_type: str, entity_id: Any, version: int = 1):
        """Broadcasts that an entity was deleted."""
        payload = {
            "type": f"{entity_type.upper()}_DELETED",
            "entityId": entity_id,
            "version": version,
            "server_timestamp": int(time.time() * 1000)
        }
        self._message_queue.append(payload)

    def broadcast_virtual_result(self, session_id: int, event_payload: dict):
        """
        Delivers a VIRTUAL_RESULT_UPDATED or VIRTUAL_ATTEMPT_STARTED event ONLY to
        WebSocket clients subscribed to the given session_id.

        Falls back to broadcast_sync (all clients) if no session subscriptions exist,
        preserving backward compatibility.

        Enforces sequence guard: stale events (lower sequence than previously seen)
        are silently dropped.
        """
        sequence = event_payload.get("sequence", 0)
        student_id = event_payload.get("student_id")
        scope_key = f"virtual_{session_id}_{student_id}"

        # Sequence guard — drop stale events
        if sequence and student_id and not self.is_sequence_fresh(scope_key, sequence):
            logger.debug(f"[WS_SEQ_DROP] Dropping stale event seq={sequence} for {scope_key}")
            return

        subscribers = self._subscriptions.get(session_id)
        if subscribers:
            payload_str = json.dumps(event_payload)
            disconnected = []
            for ws in list(subscribers):
                try:
                    # Schedule delivery without blocking the caller
                    loop = asyncio.get_event_loop()
                    if loop.is_running():
                        asyncio.create_task(ws.send_text(payload_str))
                    else:
                        loop.run_until_complete(ws.send_text(payload_str))
                except Exception as _e:
                    logger.warning(f"[WS_VIRT] Failed to send to subscriber: {_e}")
                    disconnected.append(ws)
            for dead_ws in disconnected:
                self.disconnect(dead_ws)
        else:
            # No session-specific subscribers → fall back to global broadcast
            self.broadcast_sync(event_payload)


manager = ConnectionManager()
connection_manager = manager
