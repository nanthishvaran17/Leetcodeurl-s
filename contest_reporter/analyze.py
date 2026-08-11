"""
analyze.py — Trend analysis, streak counter, milestone detection, narrative.
All functions accept clean Python dicts — no DB or API calls here.
"""
import json
import logging
from statistics import mean
from typing import Optional

log = logging.getLogger(__name__)

RATING_MILESTONES = [1400, 1500, 1600, 1700, 1800, 1900, 2000, 2100, 2200, 2400]


# ─── Rating & rank trends ──────────────────────────────────────────────────────

def rating_delta(history: list[dict]) -> Optional[float]:
    """Change in rating vs. previous contest. history: newest first."""
    if len(history) < 2:
        return None
    return round((history[0]["rating"] or 0) - (history[1]["rating"] or 0), 2)


def rank_delta(history: list[dict]) -> Optional[int]:
    """Change in ranking vs. previous contest (negative = improved)."""
    if len(history) < 2:
        return None
    r0 = history[0].get("ranking") or 0
    r1 = history[1].get("ranking") or 0
    return r0 - r1


def rolling_avg_rating(history: list[dict], n: int = 5) -> Optional[float]:
    """Rolling average rating over last N contests."""
    recent = [h["rating"] for h in history[:n] if h.get("rating")]
    if not recent:
        return None
    return round(mean(recent), 2)


# ─── Streak ────────────────────────────────────────────────────────────────────

def compute_streak(history: list[dict]) -> int:
    """Count consecutive weeks of participation (history: newest first)."""
    streak = 0
    for entry in history:
        if entry.get("problems_solved", 0) is not None:
            streak += 1
        else:
            break
    return streak


# ─── Topic / tag weakness ──────────────────────────────────────────────────────

def tag_accuracy(all_problems: list[dict]) -> list[dict]:
    """
    Returns per-tag accuracy sorted ascending (weakest first).
    `all_problems` is a flat list of problem_attempts rows (all contests).
    Each row has `tags` (JSON string) and `accepted` (0/1).
    """
    tag_stats: dict[str, dict] = {}
    for p in all_problems:
        tags = json.loads(p.get("tags") or "[]")
        accepted = bool(p.get("accepted", 0))
        for tag in tags:
            if tag not in tag_stats:
                tag_stats[tag] = {"total": 0, "accepted": 0}
            tag_stats[tag]["total"] += 1
            if accepted:
                tag_stats[tag]["accepted"] += 1

    result = []
    for tag, s in tag_stats.items():
        acc = round(s["accepted"] / max(1, s["total"]) * 100, 1)
        result.append({"tag": tag, "accuracy": acc, "total": s["total"], "accepted": s["accepted"]})

    # Sort by accuracy asc (weakest first), break ties by total desc
    return sorted(result, key=lambda x: (x["accuracy"], -x["total"]))


# ─── Milestones ────────────────────────────────────────────────────────────────

def detect_milestones(history: list[dict], milestones: list[int] = RATING_MILESTONES) -> list[int]:
    """
    Returns milestone ratings crossed IN THIS WEEK's contest.
    history: newest first.
    """
    if len(history) < 2:
        return []
    current = history[0].get("rating") or 0
    previous = history[1].get("rating") or 0
    return [m for m in milestones if previous < m <= current]


# ─── Narrative generator ───────────────────────────────────────────────────────

def generate_narrative(
    history: list[dict],
    latest_title: str,
    streak: int,
    milestones_crossed: list[int],
) -> str:
    """Auto-generates 2–4 sentences summarizing this week's performance."""
    lines = []
    if not history:
        return "No contest data available."

    current = history[0]
    solved  = current.get("problems_solved") or 0
    total   = current.get("total_problems") or 4
    rating  = current.get("rating") or 0
    ranking = current.get("ranking") or 0

    delta_r = rating_delta(history)
    delta_k = rank_delta(history)

    # Sentence 1: Contest name + solved
    lines.append(
        f"In {latest_title}, {solved} out of {total} problems were solved."
    )

    # Sentence 2: Rating movement
    if delta_r is not None:
        direction = "improved by" if delta_r >= 0 else "dropped by"
        lines.append(
            f"The contest rating {direction} {abs(delta_r):.0f} points, "
            f"now standing at {rating:.0f}."
        )
    else:
        lines.append(f"Current rating: {rating:.0f}.")

    # Sentence 3: Rank
    if delta_k is not None and delta_k != 0:
        rank_dir = "improved" if delta_k < 0 else "dropped"
        lines.append(
            f"Global rank {rank_dir} by {abs(delta_k):,} places to #{ranking:,}."
        )

    # Sentence 4: Streak
    if streak >= 3:
        lines.append(f"This marks {streak} consecutive weeks of contest participation — a commendable streak.")

    # Milestones
    if milestones_crossed:
        for m in milestones_crossed:
            lines.append(f"🎉 Rating milestone crossed: {m}!")

    return " ".join(lines)


# ─── Full analysis package ─────────────────────────────────────────────────────

def build_analysis(
    history_db: list[dict],
    all_problems_db: list[dict],
    milestones: list[int] = RATING_MILESTONES,
) -> dict:
    """
    Returns a structured analysis dict consumed by report generators.
    history_db: rows from database.fetch_history() (newest first).
    all_problems_db: ALL problem_attempts rows across all contests.
    """
    if not history_db:
        return {}

    latest = history_db[0]
    latest_title = latest["contest_title"]
    streak = compute_streak(history_db)
    milestones_crossed = detect_milestones(history_db, milestones)
    narrative = generate_narrative(history_db, latest_title, streak, milestones_crossed)
    weak_tags = tag_accuracy(all_problems_db)[:5]  # top 5 weakest

    return {
        "latest_title":         latest_title,
        "current_rating":       latest.get("rating"),
        "current_ranking":      latest.get("ranking"),
        "problems_solved":      latest.get("problems_solved"),
        "total_problems":       latest.get("total_problems"),
        "finish_time_s":        latest.get("finish_time_s"),
        "rating_delta":         rating_delta(history_db),
        "rank_delta":           rank_delta(history_db),
        "rolling_avg_5":        rolling_avg_rating(history_db, 5),
        "streak":               streak,
        "milestones_crossed":   milestones_crossed,
        "weak_tags":            weak_tags,
        "narrative":            narrative,
        "history":              history_db,
    }
