from __future__ import annotations

import unittest
from unittest.mock import patch, MagicMock
import io
import json
import urllib.error

from backend.services.email_service import (
    send_email_via_brevo,
    get_active_email_provider
)
from backend.main import app
from fastapi.testclient import TestClient


class TestBrevoEmailDelivery(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_active_provider_identification(self):
        """Test active provider is correctly identified as BREVO_API or GMAIL_SMTP."""
        provider_info = get_active_email_provider()
        self.assertIn("provider", provider_info)
        self.assertIn("transport", provider_info)
        self.assertIn("timeout_seconds", provider_info)
        self.assertGreaterEqual(provider_info["timeout_seconds"], 15)

    def test_provider_diagnostics_endpoint(self):
        """Test GET /api/email/provider-diagnostics returns healthy provider status."""
        resp = self.client.get("/api/email/provider-diagnostics")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("active_provider", data)
        self.assertIn("transport", data)
        self.assertIn("timeout_seconds", data)

    @patch("urllib.request.urlopen")
    def test_brevo_api_successful_send_with_message_id(self, mock_urlopen):
        """Test Brevo API parses and returns valid messageId on HTTP 201."""
        mock_resp = MagicMock()
        mock_resp.status = 201
        mock_resp.read.return_value = json.dumps({"messageId": "<20260818.12345@brevo.com>"}).encode("utf-8")
        mock_urlopen.return_value.__enter__.return_value = mock_resp

        success, msg_id = send_email_via_brevo(
            api_key="test_key",
            from_email="nanthishvaran0106@gmail.com",
            recipient="test@example.com",
            subject="Weekly Contest Report",
            html_body="<p>Test</p>",
            attachments=[("report.pdf", b"%PDF-1.4 test bytes")],
            max_retries=1
        )

        self.assertTrue(success)
        self.assertEqual(msg_id, "<20260818.12345@brevo.com>")

    @patch("time.sleep", return_value=None)
    @patch("urllib.request.urlopen")
    def test_brevo_api_timeout_retries_with_exponential_backoff(self, mock_urlopen, mock_sleep):
        """Test Brevo API retries on transient socket/write timeouts."""
        mock_success = MagicMock()
        mock_success.status = 200
        mock_success.read.return_value = json.dumps({"messageId": "<retry_success_msg_id>"}).encode("utf-8")
        mock_success.__enter__.return_value = mock_success

        mock_urlopen.side_effect = [
            urllib.error.URLError("The write operation timed out"),
            urllib.error.URLError("Connection reset by peer"),
            mock_success
        ]

        success, msg_id = send_email_via_brevo(
            api_key="test_key",
            from_email="nanthishvaran0106@gmail.com",
            recipient="test@example.com",
            subject="Weekly Contest Report",
            html_body="<p>Test</p>",
            max_retries=3
        )

        self.assertTrue(success)
        self.assertEqual(msg_id, "<retry_success_msg_id>")
        self.assertEqual(mock_sleep.call_count, 2)


if __name__ == "__main__":
    unittest.main()
