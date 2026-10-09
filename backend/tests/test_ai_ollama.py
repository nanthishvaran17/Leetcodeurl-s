import pytest
import json
from unittest.mock import patch, MagicMock
from backend.services.ai_ollama_service import AIOllamaEngine

class MockResponse:
    def __init__(self, json_data, status_code=200):
        self.json_data = json_data
        self.status_code = status_code

    def json(self):
        return self.json_data

    def raise_for_status(self):
        if self.status_code != 200:
            raise Exception("HTTP Error")

def test_ollama_detect_intent_student_lookup():
    with patch("httpx.Client.post") as mock_post:
        # Mock the intent detection response
        mock_post.return_value = MockResponse({
            "response": json.dumps({
                "intent": "STUDENT_LOOKUP",
                "entity": "Nanthish S",
                "needsDatabase": True
            })
        })

        result = AIOllamaEngine._detect_intent("Tell about Nanthish S")
        assert result.get("intent") == "STUDENT_LOOKUP"
        assert result.get("entity") == "Nanthish S"

def test_ollama_detect_intent_general_query():
    with patch("httpx.Client.post") as mock_post:
        # Mock the intent detection response
        mock_post.return_value = MockResponse({
            "response": json.dumps({
                "intent": "LEETCODE_INFO",
                "entity": None,
                "needsDatabase": False
            })
        })

        result = AIOllamaEngine._detect_intent("What is LeetCode?")
        assert result.get("intent") == "LEETCODE_INFO"
        assert result.get("needsDatabase") is False

def test_ollama_offline_fallback():
    with patch("httpx.Client.post", side_effect=Exception("Connection refused")):
        # The intent detection should gracefully fall back to GENERAL_QUERY
        result = AIOllamaEngine._detect_intent("Tell about Nanthish S")
        assert result.get("intent") == "GENERAL_QUERY"
        assert result.get("needsDatabase") is False
        
        # answer_query should return an error message
        db_mock = MagicMock()
        response = AIOllamaEngine.answer_query(db_mock, "Tell about Nanthish S")
        
        assert response["success"] is False
        assert response["provenance"] == "DATA_UNAVAILABLE"
        assert "unavailable" in response["answer"].lower()
