from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_register_device_token_endpoint():
    """Verify that registering an Android FCM device token subscribes it to 'all_app_users'."""
    with patch("firebase_admin.messaging.subscribe_to_topic") as mock_sub:
        mock_response = MagicMock()
        mock_response.success_count = 1
        mock_response.failure_count = 0
        mock_sub.return_value = mock_response

        response = client.post("/bot-notifications/register-token", json={
            "token": "test_android_fcm_token_999",
            "topic": "all_app_users",
            "platform": "android"
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["topic"] == "all_app_users"
        assert data["success_count"] == 1


def test_publish_app_update_notification_endpoint():
    """Verify that publishing an APP_UPDATE notification dispatches FCM push message to topic 'all_app_users'."""
    with patch("firebase_admin.messaging.send") as mock_send, \
         patch("firebase_admin.firestore.client") as mock_firestore:

        mock_send.return_value = "projects/leetcode-student-data/messages/test-msg-12345"
        
        # Mock Firestore client
        mock_db = MagicMock()
        mock_coll = MagicMock()
        mock_doc = MagicMock()
        mock_doc.id = "app_update_doc_123"
        mock_coll.document.return_value = mock_doc
        mock_db.collection.return_value = mock_coll
        mock_firestore.return_value = mock_db

        # Mock authentication as Admin
        with patch("backend.routes.bot_notifications.require_role") as mock_auth:
            mock_user = MagicMock()
            mock_user.username = "admin_user"
            mock_user.role = "Admin"
            
            # Direct service call validation
            from backend.services.notification_service import NotificationService
            results = NotificationService.send_app_update_broadcast(
                title="⚡ LeetCode Performance Update v2.0",
                message="Real-time leaderboard sync & growth delta engine activated!",
                feature_version="2.0.0",
                action_route="/dashboard",
                created_by="admin_user (Admin)"
            )

            assert results["topic"] == "all_app_users"
            assert results["success"] is True
            assert results["fcm_message_id"] == "projects/leetcode-student-data/messages/test-msg-12345"
            assert results["firestore_id"] == "app_update_doc_123"
            
            # Verify FCM messaging.send was called with correct payload & topic
            assert mock_send.call_count == 1
            fcm_arg = mock_send.call_args[0][0]
            assert fcm_arg.topic == "all_app_users"
            assert fcm_arg.notification.title == "⚡ LeetCode Performance Update v2.0"
            assert fcm_arg.data["type"] == "APP_UPDATE"
            assert fcm_arg.data["actionRoute"] == "/dashboard"
            assert fcm_arg.data["version"] == "2.0.0"
