from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_register_device_token_endpoint():
    """Verify that registering an FCM device token returns success without invoking deprecated IID topic subscription."""
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
    """Verify that publishing an APP_UPDATE notification dispatches FCM push message via HTTP v1 direct token delivery."""
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

        from backend.database import SessionLocal
        from backend.models import User
        from backend.services.notification_service import NotificationService

        db = SessionLocal()
        try:
            test_user = db.query(User).filter_by(email="fcm_test_broadcast_user@nandha.edu.in").first()
            if not test_user:
                test_user = User(
                    username="fcm_test_broadcast_user",
                    email="fcm_test_broadcast_user@nandha.edu.in",
                    hashed_password="dummy_password_hash",
                    role="Admin",
                    is_active=True
                )
                db.add(test_user)
                db.commit()
                db.refresh(test_user)

            reg_res = NotificationService.register_device_token(
                db=db,
                user_id=test_user.email,
                device_token="test_broadcast_token_123",
                platform="android"
            )
            assert reg_res.get("success") is True
        finally:
            db.close()

        results = NotificationService.send_app_update_broadcast(
            title="LeetCode Performance Update v2.0",
            message="Real-time leaderboard sync & growth delta engine activated!",
            feature_version="2.0.0",
            action_route="/dashboard",
            created_by="fcm_test_broadcast_user (Admin)"
        )

        assert results["success"] is True
        assert "event_id" in results
        
        # Verify FCM messaging.send was called with direct token delivery for test device
        assert mock_send.call_count >= 1
        target_call = None
        for call in mock_send.call_args_list:
            msg = call[0][0]
            if getattr(msg, "token", None) == "test_broadcast_token_123":
                target_call = msg
                break
        assert target_call is not None, "Push notification was not sent to test_broadcast_token_123"
        assert target_call.notification.title == "LeetCode Performance Update v2.0"
        assert target_call.data["type"] == "APP_UPDATE_AVAILABLE"
        assert target_call.data["actionRoute"] == "/dashboard"
        assert target_call.data["version"] == "2.0.0"
