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

        response = client.post("/api/bot-notifications/register-token", json={
            "token": "test_android_fcm_token_999",
            "topic": "all_app_users",
            "platform": "android"
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["topic"] == "all_app_users"


def test_publish_app_update_notification_endpoint():
    """Verify that publishing an APP_UPDATE notification dispatches FCM push message to topic 'all_app_users'."""
    with patch("firebase_admin.messaging.send") as mock_send, \
         patch("firebase_admin.firestore.client") as mock_firestore, \
         patch("backend.services.email_service.dispatch_notification_email") as mock_email:

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
                title=" LeetCode Performance Update v2.0",
                message="Real-time leaderboard sync & growth delta engine activated!",
                feature_version="2.0.0",
                action_route="/dashboard",
                created_by="admin_user (Admin)"
            )

            assert results["success"] is True
            assert "event_id" in results
            
            # Verify FCM messaging.send was called with correct payload & topic
            assert mock_send.call_count >= 1
            
            # Find the topic call
            topic_call = None
            for call in mock_send.call_args_list:
                fcm_arg = call[0][0]
                if getattr(fcm_arg, 'topic', None) == "all_app_users":
                    topic_call = fcm_arg
                    break
                    
            assert topic_call is not None, "Topic message to all_app_users was not sent"
            assert topic_call.notification.title == " LeetCode Performance Update v2.0"
            assert topic_call.data["type"] == "APP_UPDATE_AVAILABLE"
            assert topic_call.data["actionRoute"] == "/dashboard"
            assert topic_call.data["version"] == "2.0.0"
