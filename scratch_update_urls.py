import re
import requests
import datetime
from backend.database import SessionLocal
from backend.models import Student, LeetCodeProfileStats
from backend.services.faculty_action_engine import detect_and_sync_faculty_signals

STUDENT_UPDATES = [
    {"reg_no": "732225CI028", "name": "NAVIN V", "new_url": "https://leetcode.com/u/Navin_IOT_28"},
    {"reg_no": "732225CI004", "name": "DEVI SHREE M", "new_url": "https://leetcode.com/u/devishree2026"},
    {"reg_no": "732225CC059", "name": "TAMILARASAN S", "new_url": "https://leetcode.com/u/_Tamilarasan"},
    {"reg_no": "732225CC056", "name": "SUSITHA U", "new_url": "https://leetcode.com/u/SusithaU"},
    {"reg_no": "732225CC055", "name": "SURUTHI S", "new_url": "https://leetcode.com/u/ZYI7QEg6OO/"},
    {"reg_no": "732225CC051", "name": "SIDDHDEV V R", "new_url": "https://leetcode.com/u/SIDDHDEV/"},
    {"reg_no": "732225CC049", "name": "SASINESAN T", "new_url": "https://leetcode.com/u/LeueJEWPmY/"},
    {"reg_no": "732225CC045", "name": "SAHANAJ BANU M", "new_url": "https://leetcode.com/u/sahanajbanu"},
    {"reg_no": "732225CC025", "name": "KAVIN B", "new_url": "https://leetcode.com/u/KAVIN019/"},
    {"reg_no": "732225CC026", "name": "KEERTHEESH K R", "new_url": "https://leetcode.com/u/subil/"},
    {"reg_no": "732225CC007", "name": "DEEPIKA G L", "new_url": "https://leetcode.com/u/deepika1013/"},
    {"reg_no": "732225CC006", "name": "DEEPAK T", "new_url": "https://leetcode.com/u/0MGVas8msd/"},
    {"reg_no": "732224CI050", "name": "SATHYANARAYANAN R", "new_url": "https://leetcode.com/u/Sathyanarayanan_11062006/"},
    {"reg_no": "732224CI038", "name": "PRAVEEN S", "new_url": "https://leetcode.com/u/praveen___234/"},
    {"reg_no": "732224CI034", "name": "NISHA S", "new_url": "https://leetcode.com/u/Nisha_Sivakumar/"},
    {"reg_no": "732224CI020", "name": "KIRUTHIKA K", "new_url": "https://leetcode.com/u/kiruthika__23/"},
    {"reg_no": "732224CI008", "name": "BHARATH K", "new_url": "https://leetcode.com/u/Spidy_42/"},
    {"reg_no": "732224CI007", "name": "ANU SRI S", "new_url": "https://leetcode.com/u/anu_07/"},
    {"reg_no": "732224CI004", "name": "ABISHEK C", "new_url": "https://leetcode.com/u/Abishek0007/"},
    {"reg_no": "732224CC048", "name": "SOWMIYA S", "new_url": "https://leetcode.com/u/Sowmiya_7383/"},
    {"reg_no": "732224CC047", "name": "SHARMILA P", "new_url": "https://leetcode.com/u/Sharmila__27/"},
    {"reg_no": "732224CC044", "name": "SAKTHI S", "new_url": "https://leetcode.com/u/sakthi0407/"},
    {"reg_no": "732224CC035", "name": "POOMITHA KS", "new_url": "https://leetcode.com/u/Poomitha_23/"},
    {"reg_no": "732224CC027", "name": "MANJUNATH D", "new_url": "https://leetcode.com/u/ByNXF6IdWN/"},
    {"reg_no": "732224CC029", "name": "MOHAMED THARIQ J", "new_url": "https://leetcode.com/u/Thariq2625/"},
    {"reg_no": "732224CC025", "name": "MAGUDAPATHI S", "new_url": "https://leetcode.com/u/Magudapathi26/"},
    {"reg_no": "732224CC021", "name": "KIRUTHIKAA P T", "new_url": "https://leetcode.com/u/KIRUTHIKAA_05/"},
    {"reg_no": "732224CC017", "name": "JANANI S", "new_url": "https://leetcode.com/u/Jananii_26/"},
    {"reg_no": "732224CC002", "name": "AMRUTHA M", "new_url": "https://leetcode.com/u/Amruthauma/"},
]

def extract_username(url: str) -> str:
    url = url.strip().rstrip("/")
    m = re.search(r"leetcode\.com/u/([^/?#]+)", url)
    if m:
        return m.group(1).strip()
    m2 = re.search(r"leetcode\.com/([^/?#]+)", url)
    if m2 and m2.group(1) not in ("u", "contest", "profile", "problems"):
        return m2.group(1).strip()
    return url.split("/")[-1].strip()

def fetch_leetcode_data(username: str):
    query = """
    query getUserProfile($username: String!) {
        matchedUser(username: $username) {
            username
            githubUrl
            profile {
                realName
                userAvatar
                ranking
            }
            submitStats {
                acSubmissionNum {
                    difficulty
                    count
                }
            }
        }
        userContestRanking(username: $username) {
            attendedContestsCount
            rating
            globalRanking
            topPercentage
        }
    }
    """
    url = "https://leetcode.com/graphql"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Content-Type": "application/json",
        "Referer": f"https://leetcode.com/u/{username}/"
    }
    try:
        resp = requests.post(url, json={"query": query, "variables": {"username": username}}, headers=headers, timeout=12)
        if resp.status_code == 200:
            return resp.json().get("data", {})
    except Exception as e:
        print(f"Error fetching {username}: {e}")
    return None

def main():
    db = SessionLocal()
    updated_count = 0
    synced_count = 0

    print("=" * 75)
    print("UPDATING 28 STUDENT BROKEN LEETCODE URLS & FETCHING LIVE STATS")
    print("=" * 75)

    for item in STUDENT_UPDATES:
        reg_no = item["reg_no"]
        new_url = item["new_url"]
        username = extract_username(new_url)

        st = db.query(Student).filter(Student.reg_no == reg_no).first()
        if not st:
            print(f"[-] Student not found: {reg_no} ({item['name']})")
            continue

        old_url = st.leetcode_url
        old_user = st.username

        st.leetcode_url = new_url
        st.username = username
        st.updated_at = datetime.datetime.utcnow()

        # Fetch live stats from LeetCode
        lc_data = fetch_leetcode_data(username)
        if lc_data and lc_data.get("matchedUser"):
            mu = lc_data["matchedUser"]
            stats_list = mu.get("submitStats", {}).get("acSubmissionNum", [])
            total_solved, easy_solved, medium_solved, hard_solved = 0, 0, 0, 0
            for s in stats_list:
                d = s.get("difficulty")
                c = s.get("count", 0)
                if d == "All":
                    total_solved = c
                elif d == "Easy":
                    easy_solved = c
                elif d == "Medium":
                    medium_solved = c
                elif d == "Hard":
                    hard_solved = c

            cr = lc_data.get("userContestRanking") or {}
            rating = cr.get("rating")
            global_rank = cr.get("globalRanking")
            profile_rank = mu.get("profile", {}).get("ranking")

            if not st.stats:
                st.stats = LeetCodeProfileStats(student_id=st.id)

            st.stats.total_solved = total_solved
            st.stats.easy_solved = easy_solved
            st.stats.medium_solved = medium_solved
            st.stats.hard_solved = hard_solved
            st.stats.contest_rating = rating
            st.stats.contest_global_ranking = global_rank
            st.stats.public_profile_ranking = profile_rank
            st.stats.status = "SUCCESS" if total_solved > 0 else "NO_SOLVES"
            st.stats.last_verified_at = datetime.datetime.utcnow()
            st.stats.last_synced = datetime.datetime.utcnow()
            synced_count += 1
            print(f"[+] {reg_no:12s} | {st.name:22s} | User: {username:20s} | Solved: {total_solved:3d} (E:{easy_solved} M:{medium_solved} H:{hard_solved})")
        else:
            print(f"[~] {reg_no:12s} | {st.name:22s} | User: {username:20s} | Updated URL (Live stats pending/0)")

        updated_count += 1

    db.commit()

    # Recalculate faculty action signals and priority scores
    print("\nRecalculating Faculty Action Signals...")
    try:
        detect_and_sync_faculty_signals(db)
        print("Faculty action signals synchronized successfully.")
    except Exception as e:
        print(f"Error syncing faculty signals: {e}")

    db.close()
    print("=" * 75)
    print(f"SUMMARY: {updated_count} students updated, {synced_count} live profiles retrieved.")
    print("=" * 75)

if __name__ == "__main__":
    main()
