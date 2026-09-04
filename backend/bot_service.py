import httpx
from backend.config import settings
from backend.logger import logger

async def send_telegram_notification(message: str) -> bool:
    """
    Sends notification message to Telegram group / chat via Telegram Bot API.
    """
    if not settings.TELEGRAM_BOT_TOKEN or not settings.TELEGRAM_CHAT_ID:
        logger.info("Telegram bot credentials not set; skipping broadcast.")
        return False

    url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": settings.TELEGRAM_CHAT_ID,
        "text": message,
        "parse_mode": "HTML"
    }

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code == 200:
                logger.info("Telegram notification sent successfully!")
                return True
            else:
                logger.warning(f"Telegram API returned status {resp.status_code}: {resp.text}")
                return False
    except Exception as e:
        logger.error(f"Error sending Telegram notification: {e}")
        return False

async def notify_session_reminder():
    msg = "⏰ <b>REMINDER:</b> The Weekly Sunday LeetCode Session starts in 30 minutes (08:00 AM IST)! Get ready to solve!"
    await send_telegram_notification(msg)

async def notify_session_started():
    msg = "🟢 <b>SESSION STARTED:</b> Weekly Sunday LeetCode Session (08:00 AM – 09:30 AM IST) is NOW LIVE! Good luck!"
    await send_telegram_notification(msg)

async def notify_session_completed(top_student_name: str, active_count: int, total_count: int):
    msg = f"""
🏆 <b>SESSION COMPLETED:</b> Weekly Sunday LeetCode session is finished!
📊 <b>Participation:</b> {active_count}/{total_count} students active
🥇 <b>Top Performer:</b> {top_student_name}
Check the portal for full updated leaderboards and reports!
"""
    await send_telegram_notification(msg)
