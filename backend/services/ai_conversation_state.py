import time
import datetime
from typing import Dict, Any, Optional, List

class ConversationState:
    def __init__(self, conversation_id: str):
        self.conversation_id: str = conversation_id
        self.created_at: float = time.time()
        self.updated_at: float = time.time()

        # Context scope
        self.current_scope: Dict[str, Any] = {
            "department": None,
            "academic_year": None,
            "year_level": None,
            "section": None
        }

        # Query history & filters
        self.last_intent: Optional[str] = None
        self.last_filters: Dict[str, Any] = {}
        self.last_entities: Dict[str, Any] = {}
        self.last_result: Optional[Dict[str, Any]] = None

        # Action & Artifact tracking
        self.last_action: Optional[str] = None
        self.pending_action: Optional[Dict[str, Any]] = None
        self.generated_artifact: Optional[Dict[str, Any]] = None

    def update_from_query(
        self,
        intent: Optional[str] = None,
        filters: Optional[Dict[str, Any]] = None,
        entities: Optional[Dict[str, Any]] = None,
        result: Optional[Dict[str, Any]] = None,
        action: Optional[str] = None,
        artifact: Optional[Dict[str, Any]] = None,
        pending_action: Optional[Dict[str, Any]] = None
    ):
        self.updated_at = time.time()

        if intent:
            self.last_intent = intent

        if filters:
            # Preserve existing filters unless explicitly overwritten
            for k, v in filters.items():
                if v is not None:
                    if str(v).lower() in ["none", "clear", "all", "reset", "remove"]:
                        self.last_filters.pop(k, None)
                    else:
                        self.last_filters[k] = v

        if entities:
            self.last_entities.update({k: v for k, v in entities.items() if v is not None})

        if result:
            self.last_result = result

        if action:
            self.last_action = action

        if artifact:
            self.generated_artifact = artifact

        if pending_action is not None:
            self.pending_action = pending_action

    def to_dict(self) -> Dict[str, Any]:
        return {
            "conversation_id": self.conversation_id,
            "current_scope": self.current_scope,
            "last_intent": self.last_intent,
            "last_filters": self.last_filters,
            "last_entities": self.last_entities,
            "last_action": self.last_action,
            "pending_action": self.pending_action,
            "generated_artifact": self.generated_artifact,
            "updated_at": self.updated_at
        }


class ConversationStateManager:
    _store: Dict[str, ConversationState] = {}

    @classmethod
    def get_state(cls, conversation_id: str) -> ConversationState:
        if not conversation_id or not isinstance(conversation_id, str):
            conversation_id = "default_session"

        if conversation_id not in cls._store:
            cls._store[conversation_id] = ConversationState(conversation_id)
        return cls._store[conversation_id]

    @classmethod
    def update(cls, conversation_id: str, **kwargs) -> ConversationState:
        state = cls.get_state(conversation_id)
        state.update_from_query(**kwargs)
        return state

    @classmethod
    def clear(cls, conversation_id: str):
        if conversation_id in cls._store:
            del cls._store[conversation_id]

    @classmethod
    def is_confirmation_query(cls, text: str) -> bool:
        clean = text.strip().lower()
        confirm_phrases = [
            "yes", "yeah", "ok", "okay", "sure", "do it", "go ahead", "continue",
            "generate it", "send it", "download", "download it", "give it", "ok give it",
            "send", "mail it", "open it", "yes do it", "ya", "ha", "aama", "kudu"
        ]
        return clean in confirm_phrases or any(clean.startswith(p) for p in ["ok give", "send it", "download it", "give it"])


conversation_state_manager = ConversationStateManager()
