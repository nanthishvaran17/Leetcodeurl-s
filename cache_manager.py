# cache_manager.py
# Complete Cache + Fallback Strategy for LeetCode Contest & Profile Data

import sqlite3
import json
import requests
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import time
import logging
import os
import sys

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

IST = ZoneInfo("Asia/Kolkata")
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

LEETCODE_GRAPHQL_URL = "https://leetcode.com/graphql"
CONTEST_API_BASE = "https://leetcode.com/contest/api/ranking"

# ============================================
# DATABASE SCHEMA
# ============================================

CREATE_TABLES = """
-- Contest Rankings Cache
CREATE TABLE IF NOT EXISTS contest_rankings_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contest_slug TEXT NOT NULL,
    username TEXT NOT NULL,
    solved INTEGER DEFAULT 0,
    rank INTEGER,
    finish_time INTEGER,
    fetch_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(contest_slug, username)
);

-- Student Profile Cache
CREATE TABLE IF NOT EXISTS student_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    total_solved INTEGER DEFAULT 0,
    rating REAL DEFAULT 0,
    ranking INTEGER DEFAULT 0,
    fetch_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Cache Metadata (track when last fetch happened)
CREATE TABLE IF NOT EXISTS cache_metadata (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cache_key TEXT UNIQUE NOT NULL,
    last_fetch TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fetch_status TEXT,
    data_count INTEGER DEFAULT 0
);

-- Indexes for speed
CREATE INDEX IF NOT EXISTS idx_rankings_contest ON contest_rankings_cache(contest_slug);
CREATE INDEX IF NOT EXISTS idx_rankings_username ON contest_rankings_cache(username);
CREATE INDEX IF NOT EXISTS idx_student_username ON student_cache(username);
"""

# ============================================
# CACHE MANAGER CLASS
# ============================================

class CacheManager:
    def __init__(self, db_path="contest_cache.db"):
        self.db_path = db_path
        self._init_db()
        self.cache_hits = 0
        self.cache_misses = 0
    
    def _init_db(self):
        """Initialize database with tables"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.executescript(CREATE_TABLES)
        conn.commit()
        conn.close()
        logger.info("✅ Cache database initialized")
    
    # ============================================
    # CONTEST RANKINGS CACHE
    # ============================================
    
    def save_contest_rankings(self, contest_slug, rankings):
        """Save contest rankings to cache"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Delete old cache for this contest
        cursor.execute("DELETE FROM contest_rankings_cache WHERE contest_slug = ?", (contest_slug,))
        
        # Insert new rankings
        for r in rankings:
            cursor.execute("""
                INSERT OR REPLACE INTO contest_rankings_cache 
                (contest_slug, username, solved, rank, finish_time, fetch_timestamp)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                contest_slug,
                r.get("username", ""),
                r.get("solved", 0),
                r.get("rank", 0),
                r.get("finish_time", 0),
                datetime.now(IST).isoformat()
            ))
        
        # Update metadata
        cursor.execute("""
            INSERT OR REPLACE INTO cache_metadata (cache_key, last_fetch, fetch_status, data_count)
            VALUES (?, ?, ?, ?)
        """, (
            f"contest_{contest_slug}",
            datetime.now(IST).isoformat(),
            "SUCCESS",
            len(rankings)
        ))
        
        conn.commit()
        conn.close()
        logger.info(f"✅ Cached {len(rankings)} rankings for {contest_slug}")
    
    def get_contest_rankings(self, contest_slug):
        """Get cached contest rankings"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT username, solved, rank, finish_time, fetch_timestamp
            FROM contest_rankings_cache
            WHERE contest_slug = ?
            ORDER BY rank ASC
        """, (contest_slug,))
        
        rows = cursor.fetchall()
        conn.close()
        
        if rows:
            rankings = []
            for row in rows:
                rankings.append({
                    "username": row[0],
                    "solved": row[1],
                    "rank": row[2],
                    "finish_time": row[3],
                    "fetch_timestamp": row[4]
                })
            self.cache_hits += 1
            return rankings
        else:
            self.cache_misses += 1
            return None
    
    # ============================================
    # STUDENT PROFILE CACHE
    # ============================================
    
    def save_student(self, username, total_solved, rating, ranking):
        """Save student profile to cache"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT OR REPLACE INTO student_cache 
            (username, total_solved, rating, ranking, fetch_timestamp)
            VALUES (?, ?, ?, ?, ?)
        """, (
            username,
            total_solved,
            rating,
            ranking,
            datetime.now(IST).isoformat()
        ))
        
        conn.commit()
        conn.close()
        logger.info(f"✅ Cached student: {username}")
    
    def get_student(self, username):
        """Get cached student profile"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT total_solved, rating, ranking, fetch_timestamp
            FROM student_cache
            WHERE username = ?
        """, (username,))
        
        row = cursor.fetchone()
        conn.close()
        
        if row:
            self.cache_hits += 1
            return {
                "total_solved": row[0],
                "rating": row[1],
                "ranking": row[2],
                "fetch_timestamp": row[3]
            }
        else:
            self.cache_misses += 1
            return None
    
    # ============================================
    # CACHE METADATA
    # ============================================
    
    def get_last_fetch_time(self, cache_key):
        """Get last fetch time for a cache key"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT last_fetch, fetch_status, data_count
            FROM cache_metadata
            WHERE cache_key = ?
        """, (cache_key,))
        
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return {
                "last_fetch": row[0],
                "status": row[1],
                "count": row[2]
            }
        return None
    
    def get_cache_stats(self):
        """Get cache statistics"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("SELECT COUNT(*) FROM contest_rankings_cache")
        contest_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM student_cache")
        student_count = cursor.fetchone()[0]
        
        conn.close()
        
        return {
            "contest_rankings": contest_count,
            "students": student_count,
            "cache_hits": self.cache_hits,
            "cache_misses": self.cache_misses
        }

# ============================================
# SMART FETCHER - WORKS EVEN WHEN LEETCODE IS DOWN
# ============================================

class SmartFetcher:
    def __init__(self, db_path="contest_cache.db"):
        self.cache = CacheManager(db_path=db_path)
    
    def fetch_contest_rankings(self, contest_slug, force_refresh=False):
        """
        SMART FETCH:
        1. Try cache (if not force_refresh)
        2. Try LeetCode API (if available)
        3. Fallback to cache (if API fails)
        """
        logger.info(f"🔍 Fetching contest rankings for: {contest_slug}")
        
        # Step 1: Check cache FIRST if not forcing refresh
        if not force_refresh:
            cached = self.cache.get_contest_rankings(contest_slug)
            if cached:
                logger.info(f"  ✅ Using CACHED data ({len(cached)} participants)")
                return {
                    "source": "CACHE",
                    "data": cached,
                    "timestamp": datetime.now(IST)
                }
        
        # Step 2: Try LeetCode API
        try:
            logger.info("  🌐 Fetching live from LeetCode Contest Page API...")
            api_data = self._fetch_from_leetcode_api(contest_slug)
            
            if api_data:
                # Save to cache
                self.cache.save_contest_rankings(contest_slug, api_data)
                logger.info(f"  ✅ API success! {len(api_data)} participants cached")
                return {
                    "source": "API",
                    "data": api_data,
                    "timestamp": datetime.now(IST)
                }
        except Exception as e:
            logger.warning(f"  ⚠️ API failed: {e}")
        
        # Step 3: Fallback - try GraphQL user history if students list is known or use cached
        cached = self.cache.get_contest_rankings(contest_slug)
        if cached:
            logger.warning(f"  ⚠️ Using LAST CACHED data (API was down/empty)")
            return {
                "source": "FALLBACK_CACHE",
                "data": cached,
                "timestamp": datetime.now(IST),
                "warning": "Using cached data - LeetCode API unavailable"
            }
        
        # Step 4: No data available
        logger.error("  ❌ No data available in API or Cache")
        return {
            "source": "EMPTY_OR_UNAVAILABLE",
            "data": [],
            "error": "No data available in cache yet"
        }
    
    def _fetch_from_leetcode_api(self, contest_slug):
        """Fetch from LeetCode Contest Page API with pagination"""
        all_rankings = []
        page = 1
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Referer": f"https://leetcode.com/contest/{contest_slug}/ranking/"
        }
        
        while True:
            url = f"{CONTEST_API_BASE}/{contest_slug}/"
            params = {"pagination": page, "region": "global"}
            
            try:
                response = requests.get(url, params=params, headers=headers, timeout=12)
                
                if response.status_code != 200:
                    break
                
                data = response.json()
                rankings = data.get("rankings", [])
                if not rankings:
                    break
                
                for user in rankings:
                    all_rankings.append({
                        "username": user.get("username", ""),
                        "solved": user.get("solved", 0),
                        "rank": user.get("rank", 0),
                        "finish_time": user.get("finish_time", 0)
                    })
                
                total = data.get("total_rank", 0)
                if len(all_rankings) >= total or page >= 50:
                    break
                
                page += 1
                time.sleep(0.3)
                
            except Exception as e:
                logger.error(f"  Error fetching page {page}: {e}")
                break
        
        return all_rankings
    
    def fetch_student_data(self, username, force_refresh=False):
        """Smart fetch student profile with cache + fallback"""
        # Step 1: Check cache
        if not force_refresh:
            cached = self.cache.get_student(username)
            if cached:
                return {
                    "source": "CACHE",
                    "data": cached
                }
        
        # Step 2: Try LeetCode API
        try:
            api_data = self._fetch_student_from_api(username)
            if api_data:
                self.cache.save_student(
                    username,
                    api_data.get("total_solved", 0),
                    api_data.get("rating", 0),
                    api_data.get("ranking", 0)
                )
                return {
                    "source": "API",
                    "data": api_data
                }
        except Exception as e:
            logger.warning(f"  ⚠️ Student API fetch failed for {username}: {e}")
        
        # Step 3: Fallback to existing cache
        cached = self.cache.get_student(username)
        if cached:
            return {
                "source": "FALLBACK_CACHE",
                "data": cached,
                "warning": "Using cached data - LeetCode API unavailable"
            }
        
        return {
            "source": "ERROR",
            "data": None,
            "error": "No data available"
        }
    
    def _fetch_student_from_api(self, username):
        """Fetch student profile from LeetCode GraphQL API"""
        query = """
        query userPublicProfile($username: String!) {
          matchedUser(username: $username) {
            username
            submitStats {
              acSubmissionNum {
                difficulty
                count
              }
            }
            contestRating
          }
          userContestRanking(username: $username) {
            rating
            globalRanking
          }
        }
        """
        payload = {"query": query, "variables": {"username": username}}
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        }
        
        response = requests.post(LEETCODE_GRAPHQL_URL, json=payload, headers=headers, timeout=12)
        if response.status_code != 200:
            return None
        
        data = response.json()
        if "errors" in data and not data.get("data"):
            return None
        
        user = data.get("data", {}).get("matchedUser", {}) or {}
        contest_info = data.get("data", {}).get("userContestRanking", {}) or {}
        
        submit_stats = user.get("submitStats", {}).get("acSubmissionNum", []) or []
        total_solved = 0
        for stat in submit_stats:
            if stat.get("difficulty") == "All":
                total_solved = stat.get("count", 0)
                break
        
        rating = contest_info.get("rating", 0) or user.get("contestRating", 0) or 0
        ranking = contest_info.get("globalRanking", 0) or 0
        
        return {
            "username": username,
            "total_solved": int(total_solved),
            "rating": round(float(rating), 1),
            "ranking": int(ranking)
        }
    
    def get_cache_stats(self):
        return self.cache.get_cache_stats()

# ============================================
# CONTEST PROCESSOR WITH CACHE
# ============================================

class ContestProcessor:
    def __init__(self, db_path="contest_cache.db"):
        self.fetcher = SmartFetcher(db_path=db_path)
        self.results = []
    
    def process_contest(self, contest_slug, students, force_refresh=False):
        """Process contest with smart cache + fallback"""
        print(f"\n🚀 Processing contest with Smart Cache: {contest_slug}")
        print("=" * 60)
        
        contest_result = self.fetcher.fetch_contest_rankings(contest_slug, force_refresh=force_refresh)
        
        rankings = contest_result.get("data", [])
        source = contest_result.get("source", "UNKNOWN")
        
        print(f"📊 Data Source: {source}")
        if "warning" in contest_result:
            print(f"⚠️ {contest_result['warning']}")
        print(f"✅ Found {len(rankings)} cached/live participants")
        
        rank_map = {r["username"]: r for r in rankings}
        
        results = []
        for student in students:
            username = student.get("username", "")
            name = student.get("name", "Unknown")
            roll = student.get("roll_number", "")
            dept = student.get("department", "")
            year = student.get("year", 0)
            
            if username in rank_map:
                data = rank_map[username]
                finish_time = data.get("finish_time", 0)
                solved = data.get("solved", 0)
                rank = data.get("rank", 0)
                
                participation = "LIVE" if finish_time <= 5400 else "VIRTUAL"
                
                results.append({
                    "name": name,
                    "username": username,
                    "roll": roll,
                    "department": dept,
                    "year": year,
                    "participation": participation,
                    "problems_solved": solved,
                    "rank": rank,
                    "finish_time": finish_time,
                    "source": source
                })
            else:
                results.append({
                    "name": name,
                    "username": username,
                    "roll": roll,
                    "department": dept,
                    "year": year,
                    "participation": "NONE",
                    "problems_solved": 0,
                    "rank": None,
                    "finish_time": None,
                    "source": source
                })
        
        self.results = results
        return results
    
    def generate_summary(self):
        total = len(self.results)
        live = sum(1 for r in self.results if r.get("participation") == "LIVE")
        virtual = sum(1 for r in self.results if r.get("participation") == "VIRTUAL")
        none = sum(1 for r in self.results if r.get("participation") == "NONE")
        
        solved = {}
        for i in range(5):
            solved[i] = sum(1 for r in self.results if r.get("problems_solved", 0) == i)
        
        return {
            "total": total,
            "live": live,
            "virtual": virtual,
            "none": none,
            "solved": solved,
            "source": self.results[0].get("source", "UNKNOWN") if self.results else "UNKNOWN"
        }

if __name__ == "__main__":
    sample_students = [
        {"name": "AJAY A", "username": "ajay_a1277", "roll_number": "732224CC001", "department": "CSE(CS)", "year": 3},
        {"name": "DHARSHINI", "username": "DHARSHINI_1605", "roll_number": "732224CC002", "department": "CSE(CS)", "year": 3},
    ]
    
    processor = ContestProcessor()
    results = processor.process_contest("weekly-contest-514", sample_students)
    summary = processor.generate_summary()
    
    print("\n" + "=" * 60)
    print("📊 SUMMARY RESULTS")
    print("=" * 60)
    print(f"Total: {summary['total']} | LIVE: {summary['live']} | NONE: {summary['none']}")
    print(f"Data Source: {summary['source']}")
    
    stats = processor.fetcher.get_cache_stats()
    print(f"\nCache Stats: {stats}")
