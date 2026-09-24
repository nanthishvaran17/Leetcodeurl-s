"""
Forensic-Grade Per-Question Time Estimation Engine
===================================================
Strictly separates OBSERVED, ESTIMATED, and UNAVAILABLE timing.
Never fabricates precision. Every output is fully traceable.

Calculation version: v1.0
"""
import datetime
from typing import Optional, Dict, Any

CALCULATION_VERSION = "v1.0"

DEFAULT_DIFFICULTY_WEIGHTS: Dict[str, float] = {
    "easy":        1.0,
    "medium":      1.5,
    "medium_hard": 2.0,
    "hard":        2.0,
}
QUESTION_DIFFICULTY_MAP: Dict[int, str] = {1: "easy", 2: "medium", 3: "medium_hard", 4: "hard"}

CONTEST_START_HOUR_IST, CONTEST_START_MINUTE_IST = 8, 0
CONTEST_END_HOUR_IST,   CONTEST_END_MINUTE_IST   = 9, 30

SOURCE_OBSERVED_LIVE               = "OBSERVED_LIVE"
SOURCE_AUTHORITATIVE_TELEMETRY     = "AUTHORITATIVE_TELEMETRY"
SOURCE_ESTIMATED_DIFFICULTY_WEIGHT = "ESTIMATED_DIFFICULTY_WEIGHT"
SOURCE_UNAVAILABLE                 = "UNAVAILABLE"

CONFIDENCE_MAP = {
    SOURCE_OBSERVED_LIVE: "HIGH",
    SOURCE_AUTHORITATIVE_TELEMETRY: "HIGH",
    SOURCE_ESTIMATED_DIFFICULTY_WEIGHT: "MEDIUM",
    SOURCE_UNAVAILABLE: "NONE",
}


def _parse_timestamp(ts):
    if ts is None: return None
    if isinstance(ts, datetime.datetime): return ts
    if isinstance(ts, str):
        for fmt in ["%I:%M %p", "%H:%M", "%H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S"]:
            try:
                return datetime.datetime.strptime(ts.strip(), fmt)
            except ValueError:
                continue
    return None


def _clamp_to_contest_window(entry, exit_, contest_date=None):
    base = contest_date or entry.date() if hasattr(entry, 'date') else datetime.date.today()
    try:
        base = entry.date()
    except Exception:
        base = datetime.date.today()
    window_start = datetime.datetime.combine(base, datetime.time(CONTEST_START_HOUR_IST, CONTEST_START_MINUTE_IST))
    window_end   = datetime.datetime.combine(base, datetime.time(CONTEST_END_HOUR_IST,   CONTEST_END_MINUTE_IST))
    if entry.year < 2000:
        entry = entry.replace(year=base.year, month=base.month, day=base.day)
    if exit_.year < 2000:
        exit_ = exit_.replace(year=base.year, month=base.month, day=base.day)
    valid_entry = max(entry, window_start)
    valid_exit  = min(exit_,  window_end)
    if valid_exit <= valid_entry: return None
    return valid_entry, valid_exit


def _format_seconds(secs, approximate=False):
    if secs is None or secs < 0: return None
    hrs  = secs // 3600
    mins = (secs % 3600) // 60
    s    = secs % 60
    prefix = "~" if approximate else ""
    if hrs > 0: return f"{prefix}{hrs}h {mins}m {s}s"
    return f"{prefix}{mins}m {s}s"


def _all_unavailable(solved_questions, reason="UNAVAILABLE"):
    result = {}
    for q_idx in range(1, 5):
        status = solved_questions.get(q_idx)
        result[f"q{q_idx}"] = {"status": "SOLVED" if status is True else ("NOT_SOLVED" if status is False else "UNKNOWN"), "seconds": None, "source": SOURCE_UNAVAILABLE, "method": reason, "confidence": "NONE", "display": None}
    result["metadata"] = {"calculation_version": CALCULATION_VERSION, "calculated_at": datetime.datetime.utcnow().isoformat(), "contest_presence_seconds": 0, "total_estimated_seconds": 0, "conservation_satisfied": True, "dominant_source": SOURCE_UNAVAILABLE, "timing_confidence": "NONE", "reason": reason}
    return result


def estimate_question_times(entry_timestamp_str, exit_timestamp_str, solved_questions, difficulty_weights=None, contest_date=None, existing_observed=None):
    weights  = difficulty_weights or DEFAULT_DIFFICULTY_WEIGHTS
    observed = existing_observed or {}
    entry = _parse_timestamp(entry_timestamp_str)
    exit_ = _parse_timestamp(exit_timestamp_str)
    if entry is None or exit_ is None:
        return _all_unavailable(solved_questions, reason="MISSING_TIMESTAMPS")
    clamped = _clamp_to_contest_window(entry, exit_, contest_date)
    if clamped is None:
        return _all_unavailable(solved_questions, reason="OUTSIDE_CONTEST_WINDOW")
    valid_entry, valid_exit = clamped
    presence_seconds = int((valid_exit - valid_entry).total_seconds())
    if presence_seconds <= 0:
        return _all_unavailable(solved_questions, reason="ZERO_PRESENCE")

    result_q = {}
    questions_needing_estimation = []
    total_already_observed = 0
    for q_idx in range(1, 5):
        status   = solved_questions.get(q_idx)
        obs_secs = observed.get(q_idx)
        if obs_secs and obs_secs > 1:
            result_q[f"q{q_idx}"] = {"status": "SOLVED" if status else "UNKNOWN", "seconds": obs_secs, "source": SOURCE_OBSERVED_LIVE, "method": "LIVE_ACTIVITY_TELEMETRY", "confidence": "HIGH", "display": _format_seconds(obs_secs, approximate=False)}
            total_already_observed += obs_secs
        elif status is True:
            questions_needing_estimation.append(q_idx)
        elif status is False:
            result_q[f"q{q_idx}"] = {"status": "NOT_SOLVED", "seconds": None, "source": SOURCE_UNAVAILABLE, "method": None, "confidence": "NONE", "display": None}
        else:
            result_q[f"q{q_idx}"] = {"status": "UNKNOWN", "seconds": None, "source": SOURCE_UNAVAILABLE, "method": None, "confidence": "NONE", "display": None}

    allocatable = max(0, presence_seconds - total_already_observed)
    total_weight = sum(weights.get(QUESTION_DIFFICULTY_MAP.get(q, "easy"), 1.0) for q in questions_needing_estimation)
    total_estimated = 0
    for i, q_idx in enumerate(questions_needing_estimation):
        difficulty = QUESTION_DIFFICULTY_MAP.get(q_idx, "easy")
        w = weights.get(difficulty, 1.0)
        if i == len(questions_needing_estimation) - 1:
            est_secs = allocatable - total_estimated
        else:
            raw_secs = (allocatable * w) / total_weight if total_weight > 0 else 0
            est_secs = round(raw_secs)
        
        total_estimated += est_secs
        result_q[f"q{q_idx}"] = {"status": "SOLVED", "seconds": est_secs, "source": SOURCE_ESTIMATED_DIFFICULTY_WEIGHT, "method": "DYNAMIC_DIFFICULTY_WEIGHT", "confidence": "MEDIUM", "display": _format_seconds(est_secs, approximate=True), "weight": w, "difficulty": difficulty}

    unallocated = presence_seconds - total_already_observed - total_estimated
    dominant_source = SOURCE_UNAVAILABLE
    if any(v.get("source") == SOURCE_OBSERVED_LIVE for v in result_q.values()): dominant_source = SOURCE_OBSERVED_LIVE
    elif any(v.get("source") == SOURCE_ESTIMATED_DIFFICULTY_WEIGHT for v in result_q.values()): dominant_source = SOURCE_ESTIMATED_DIFFICULTY_WEIGHT

    metadata = {
        "calculation_version": CALCULATION_VERSION,
        "calculated_at": datetime.datetime.utcnow().isoformat(),
        "contest_presence_seconds": presence_seconds,
        "total_observed_seconds": total_already_observed,
        "total_estimated_seconds": total_estimated,
        "unallocated_seconds": max(0, unallocated),
        "conservation_satisfied": (total_already_observed + total_estimated) <= presence_seconds,
        "dominant_source": dominant_source,
        "timing_confidence": CONFIDENCE_MAP.get(dominant_source, "NONE"),
        "difficulty_weights_used": {k: weights.get(QUESTION_DIFFICULTY_MAP[k], 1.0) for k in range(1, 5)},
    }
    return {**result_q, "metadata": metadata}


def estimate_and_persist(db_session, record, difficulty_weights=None):
    """Run estimation engine and persist results. Respects monotonic integrity."""
    solved = {}
    for q in range(1, 5):
        val = getattr(record, f"q{q}", 0)
        solved[q] = True if (val and val >= 1) else False

    existing_observed = {q: getattr(record, f"q{q}_observed_seconds", None) for q in range(1, 5)}
    entry_ts = getattr(record, "entry_time",  None) or getattr(record, "start_time",  None) or getattr(record, "finish_time", None)
    exit_ts  = getattr(record, "finish_time", None) or getattr(record, "exit_time",   None)

    result = estimate_question_times(
        entry_timestamp_str=entry_ts,
        exit_timestamp_str=exit_ts,
        solved_questions=solved,
        difficulty_weights=difficulty_weights,
        existing_observed=existing_observed,
    )

    meta = result.get("metadata", {})
    for q_idx in range(1, 5):
        qdata  = result.get(f"q{q_idx}", {})
        source = qdata.get("source", SOURCE_UNAVAILABLE)
        secs   = qdata.get("seconds")
        current_source = getattr(record, f"q{q_idx}_time_source", None)
        if current_source in (SOURCE_OBSERVED_LIVE, SOURCE_AUTHORITATIVE_TELEMETRY):
            continue
        if source == SOURCE_ESTIMATED_DIFFICULTY_WEIGHT and secs is not None:
            setattr(record, f"q{q_idx}_estimated_seconds", secs)
            setattr(record, f"q{q_idx}_time_source", source)
        elif source == SOURCE_UNAVAILABLE:
            setattr(record, f"q{q_idx}_time_source", SOURCE_UNAVAILABLE)

    setattr(record, "timing_calculation_version", meta.get("calculation_version", CALCULATION_VERSION))
    setattr(record, "timing_confidence",          meta.get("timing_confidence", "NONE"))
    try:
        setattr(record, "timing_calculated_at", datetime.datetime.utcnow())
    except Exception:
        pass
    db_session.commit()
    return result
