"""
Independent Weekly Contest Data Verifier
==========================================
Run this YOURSELF (not through the coding AI) to check DB-recorded contest
results against LeetCode's live public GraphQL API. This exists specifically
because AI-generated "audit reports" have been caught reporting contradictory
claims for the same students. This script produces raw, reproducible output
you can inspect directly — no narrative summaries.

Usage:
    pip install requests
    python verify_contest_data.py --db data/leetcode_tracker.db --contest "Weekly Contest 514" --sample 30
    python verify_contest_data.py --db data/leetcode_tracker.db --contest "Weekly Contest 514" --all

Adjust DB_TABLE / column names below if your actual schema differs — check
with `.schema weekly_public_results` in sqlite3 first.
"""

import argparse
import csv
import random
import sqlite3
import sys
import time
from datetime import datetime

import requests

GRAPHQL_URL = "https://leetcode.com/graphql"
HEADERS = {
    "Content-Type": "application/json",
    "Referer": "https://leetcode.com",
    "User-Agent": "Mozilla/5.0 (independent-verification-script)",
}

QUERY = """
query getUserContest($username: String!) {
  userContestRankingHistory(username: $username) {
    attended
    problemsSolved
    totalProblems
    rating
    ranking
    contest {
      title
    }
  }
}
"""


def fetch_live_result(username: str, contest_title: str, retries: int = 2):
    """Hit LeetCode's live GraphQL endpoint for one student and pull out the
    entry matching contest_title. Returns a dict or an error marker — never
    silently guesses."""
    for attempt in range(retries + 1):
        try:
            resp = requests.post(
                GRAPHQL_URL,
                json={"query": QUERY, "variables": {"username": username}},
                headers=HEADERS,
                timeout=15,
            )
            if resp.status_code != 200:
                return {"error": f"HTTP {resp.status_code}"}
            data = resp.json()
            history = (
                data.get("data", {})
                .get("userContestRankingHistory")
                or []
            )
            for entry in history:
                if entry.get("contest", {}).get("title") == contest_title:
                    return {
                        "attended": entry.get("attended"),
                        "solved": entry.get("problemsSolved"),
                        "total": entry.get("totalProblems"),
                        "rank": entry.get("ranking"),
                        "rating": entry.get("rating"),
                    }
            # Username resolved but no entry for this contest = did not attend
            if history is not None:
                return {"attended": False, "solved": None, "rank": None, "rating": None}
            return {"error": "no_history_returned"}
        except requests.RequestException as e:
            if attempt < retries:
                time.sleep(2)
                continue
            return {"error": f"request_failed: {e}"}
    return {"error": "unknown"}


def load_db_rows(db_path: str, contest_title: str, sample: int, take_all: bool):
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute(
        """
        SELECT r.reg_no, r.name, s2.username AS username,
               r.participation_status, r.contest_rank, r.contest_score,
               r.total_contest_solved
        FROM weekly_public_results r
        JOIN weekly_sessions ws ON ws.id = r.session_id
        JOIN students s2 ON s2.id = r.student_id
        WHERE ws.contest_name = ?
        """,
        (contest_title,),
    )
    rows = [dict(row) for row in cur.fetchall()]
    conn.close()

    if not rows:
        print(f"[WARN] No rows found for contest '{contest_title}'. "
              f"Check table/column names against your actual schema.")
        sys.exit(1)

    if take_all:
        return rows
    return random.sample(rows, min(sample, len(rows)))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", required=True, help="Path to SQLite DB file")
    ap.add_argument("--contest", required=True, help="Exact contest_name / title, e.g. 'Weekly Contest 514'")
    ap.add_argument("--sample", type=int, default=30, help="Random sample size (ignored if --all)")
    ap.add_argument("--all", action="store_true", help="Check every student instead of a sample")
    ap.add_argument("--delay", type=float, default=1.0, help="Seconds to sleep between API calls (be polite)")
    ap.add_argument("--out", default=None, help="Output CSV path (default: verification_<contest>_<timestamp>.csv)")
    args = ap.parse_args()

    rows = load_db_rows(args.db, args.contest, args.sample, args.all)
    print(f"Checking {len(rows)} students against live LeetCode data for '{args.contest}'...\n")

    out_path = args.out or f"verification_{args.contest.replace(' ', '_')}_{datetime.now():%Y%m%d_%H%M%S}.csv"
    mismatches = 0
    errors = 0

    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow([
            "reg_no", "name", "username",
            "db_status", "db_rank", "db_score", "db_solved",
            "live_attended", "live_rank", "live_rating", "live_solved",
            "match", "notes",
        ])

        for i, row in enumerate(rows, 1):
            username = row["username"]
            print(f"[{i}/{len(rows)}] {row['reg_no']} ({username}) ...", end=" ")

            if not username:
                writer.writerow([row["reg_no"], row["name"], "", row["participation_status"],
                                  row["contest_rank"], row["contest_score"], row["total_contest_solved"],
                                  "", "", "", "", "ERROR", "missing_username"])
                errors += 1
                print("ERROR: missing username")
                continue

            live = fetch_live_result(username, args.contest)

            if "error" in live:
                writer.writerow([row["reg_no"], row["name"], username, row["participation_status"],
                                  row["contest_rank"], row["contest_score"], row["total_contest_solved"],
                                  "", "", "", "", "ERROR", live["error"]])
                errors += 1
                print(f"ERROR: {live['error']}")
            else:
                db_attended = row["participation_status"] in ("PUBLIC_ATTENDED", "ATTENDED")
                live_attended = bool(live.get("attended"))
                match = "YES" if db_attended == live_attended else "NO"
                if match == "NO":
                    mismatches += 1

                # If both attended, also flag rank mismatches (any drift is worth a look)
                rank_note = ""
                if db_attended and live_attended:
                    db_rank = row["contest_rank"]
                    live_rank = live.get("rank")
                    if db_rank is not None and live_rank is not None and db_rank != live_rank:
                        rank_note = f"rank_drift: db={db_rank} live={live_rank}"
                        if match == "YES":
                            match = "PARTIAL"
                            mismatches += 1

                writer.writerow([
                    row["reg_no"], row["name"], username, row["participation_status"],
                    row["contest_rank"], row["contest_score"], row["total_contest_solved"],
                    live_attended, live.get("rank"), live.get("rating"), live.get("solved"),
                    match, rank_note,
                ])
                print(f"attended(db={db_attended}, live={live_attended}) -> {match}")

            time.sleep(args.delay)

    print(f"\nDone. {len(rows)} checked, {mismatches} mismatches, {errors} errors.")
    print(f"Full results written to: {out_path}")
    if mismatches or errors:
        print("\n[WARNING] Do NOT treat the DB / dashboard as verified until these rows are resolved.")


if __name__ == "__main__":
    main()
