"""
database.py — SQLite historical contest store.
Idempotent: inserting a contest that already exists is a no-op.
"""
import sqlite3
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional

DB_PATH = Path(__file__).parent / "data" / "history.db"


def _connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """Create tables if they don't already exist."""
    with _connect() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS contests (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                contest_title   TEXT NOT NULL UNIQUE,
                contest_start   INTEGER NOT NULL,        -- Unix timestamp
                rating          REAL,
                ranking         INTEGER,
                problems_solved INTEGER,
                total_problems  INTEGER,
                finish_time_s   INTEGER,
                trend_direction TEXT,
                recorded_at     TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS problem_attempts (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                contest_title   TEXT NOT NULL,
                problem_title   TEXT,
                difficulty      TEXT,
                accepted        INTEGER DEFAULT 0,       -- 1 = AC, 0 = WA/no-submit
                wrong_attempts  INTEGER DEFAULT 0,
                time_taken_s    INTEGER,
                tags            TEXT,                   -- JSON array string
                FOREIGN KEY (contest_title) REFERENCES contests(contest_title)
            );

            CREATE TABLE IF NOT EXISTS sent_emails (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                contest_title   TEXT NOT NULL UNIQUE,
                sent_at         TEXT DEFAULT (datetime('now')),
                recipients      TEXT                    -- JSON list
            );
        """)


def contest_exists(contest_title: str) -> bool:
    with _connect() as conn:
        row = conn.execute(
            "SELECT id FROM contests WHERE contest_title = ?", (contest_title,)
        ).fetchone()
        return row is not None


def email_already_sent(contest_title: str) -> bool:
    with _connect() as conn:
        row = conn.execute(
            "SELECT id FROM sent_emails WHERE contest_title = ?", (contest_title,)
        ).fetchone()
        return row is not None


def insert_contest(data: dict) -> None:
    """Insert or ignore (idempotent). `data` keys match column names."""
    with _connect() as conn:
        conn.execute("""
            INSERT OR IGNORE INTO contests
            (contest_title, contest_start, rating, ranking,
             problems_solved, total_problems, finish_time_s, trend_direction)
            VALUES
            (:contest_title, :contest_start, :rating, :ranking,
             :problems_solved, :total_problems, :finish_time_s, :trend_direction)
        """, data)


def insert_problems(contest_title: str, problems: list[dict]) -> None:
    with _connect() as conn:
        # Only insert once (idempotent)
        existing = conn.execute(
            "SELECT id FROM problem_attempts WHERE contest_title = ?", (contest_title,)
        ).fetchone()
        if existing:
            return
        for p in problems:
            conn.execute("""
                INSERT INTO problem_attempts
                (contest_title, problem_title, difficulty, accepted,
                 wrong_attempts, time_taken_s, tags)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                contest_title,
                p.get("problem_title"),
                p.get("difficulty"),
                int(p.get("accepted", False)),
                p.get("wrong_attempts", 0),
                p.get("time_taken_s"),
                p.get("tags", "[]"),
            ))


def mark_email_sent(contest_title: str, recipients: list[str]) -> None:
    import json
    with _connect() as conn:
        conn.execute("""
            INSERT OR REPLACE INTO sent_emails (contest_title, recipients)
            VALUES (?, ?)
        """, (contest_title, json.dumps(recipients)))


def fetch_history(limit: int = 20) -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM contests ORDER BY contest_start DESC LIMIT ?", (limit,)
        ).fetchall()
        return [dict(r) for r in rows]


def fetch_problems_for_contest(contest_title: str) -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM problem_attempts WHERE contest_title = ?", (contest_title,)
        ).fetchall()
        return [dict(r) for r in rows]
