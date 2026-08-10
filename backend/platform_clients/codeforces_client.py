import httpx
from typing import Dict, Any, Optional
from backend.logger import logger

async def fetch_codeforces_profile(handle: Optional[str]) -> Dict[str, Any]:
    """
    Fetches public Codeforces statistics via Codeforces API.
    """
    if not handle or not handle.strip():
        return {"status": "MISSING LINK", "handle": handle, "rating": None, "max_rating": None, "rank": None}

    clean_handle = handle.strip()
    url = f"https://codeforces.com/api/user.info?handles={clean_handle}"

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("status") == "OK" and data.get("result"):
                    user_info = data["result"][0]
                    return {
                        "status": "OK",
                        "handle": clean_handle,
                        "rating": user_info.get("rating"),
                        "max_rating": user_info.get("maxRating"),
                        "rank": user_info.get("rank")
                    }
            return {"status": "PROFILE NOT FOUND", "handle": clean_handle, "rating": None, "max_rating": None, "rank": None}
    except Exception as e:
        logger.warning(f"Error fetching Codeforces stats for '{clean_handle}': {e}")
        return {"status": "DATA UNAVAILABLE", "handle": clean_handle, "rating": None, "max_rating": None, "rank": None}
