from typing import Any, Dict

def _is_valid_rank(val: Any) -> bool:
    if val is None: return False
    try:
        iv = int(val)
        return 0 < iv < 5000000
    except (ValueError, TypeError):
        return False

def _is_valid_rating(val: Any) -> bool:
    if val is None: return False
    try:
        fv = float(val)
        return fv > 0.0
    except (ValueError, TypeError):
        return False

def _merge_phase_a(res1: Dict[str, Any], res2: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(res1, dict) or res1.get("status") != "ok": return res2
    if not isinstance(res2, dict) or res2.get("status") != "ok": return res1

    d1 = res1.get("data", {})
    d2 = res2.get("data", {})

    merged = d1.copy()
    
    # Lossless profile ranking: prefer fresh valid rank from d2; otherwise preserve d1
    r2 = d2.get("profile_global_ranking") or d2.get("ranking")
    r1 = d1.get("profile_global_ranking") or d1.get("ranking")
    if _is_valid_rank(r2):
        merged["ranking"] = int(r2)
        merged["profile_global_ranking"] = int(r2)
    elif _is_valid_rank(r1):
        merged["ranking"] = int(r1)
        merged["profile_global_ranking"] = int(r1)
    else:
        merged["ranking"] = None
        merged["profile_global_ranking"] = None

    merged["reputation"] = max(d1.get("reputation") or 0, d2.get("reputation") or 0)
    merged["total_solved"] = max(d1.get("total_solved") or 0, d2.get("total_solved") or 0)
    merged["easy_solved"] = max(d1.get("easy_solved") or 0, d2.get("easy_solved") or 0)
    merged["medium_solved"] = max(d1.get("medium_solved") or 0, d2.get("medium_solved") or 0)
    merged["hard_solved"] = max(d1.get("hard_solved") or 0, d2.get("hard_solved") or 0)
    merged["streak"] = max(d1.get("streak") or 0, d2.get("streak") or 0)
    merged["max_streak"] = max(d1.get("max_streak") or 0, d2.get("max_streak") or 0)
    merged["total_active_days"] = max(d1.get("total_active_days") or 0, d2.get("total_active_days") or 0)

    b1 = {b["badge_id"]: b for b in d1.get("badges", []) if isinstance(b, dict) and b.get("badge_id")}
    b2 = {b["badge_id"]: b for b in d2.get("badges", []) if isinstance(b, dict) and b.get("badge_id")}
    b1.update(b2)
    merged["badges"] = list(b1.values())

    l1 = {lp["language_name"]: lp["problems_solved"] for lp in d1.get("languages", []) if isinstance(lp, dict) and lp.get("language_name")}
    l2 = {lp["language_name"]: lp["problems_solved"] for lp in d2.get("languages", []) if isinstance(lp, dict) and lp.get("language_name")}
    all_langs = set(l1.keys()).union(set(l2.keys()))
    merged["languages"] = [{"language_name": lang, "problems_solved": max(l1.get(lang, 0), l2.get(lang, 0))} for lang in all_langs]

    return {"status": "ok", "data": merged}

def _merge_phase_b(res1: Dict[str, Any], res2: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(res1, dict) or res1.get("status") != "ok": return res2
    if not isinstance(res2, dict) or res2.get("status") != "ok": return res1

    d1 = res1.get("data", {})
    d2 = res2.get("data", {})

    merged = d1.copy()
    
    merged["attended_contests_count"] = max(d1.get("attended_contests_count") or 0, d2.get("attended_contests_count") or 0)
    
    # Lossless contest rating: prefer fresh valid rating from d2; otherwise preserve d1
    rat2 = d2.get("contest_rating")
    rat1 = d1.get("contest_rating")
    if _is_valid_rating(rat2):
        merged["contest_rating"] = float(rat2)
    elif _is_valid_rating(rat1):
        merged["contest_rating"] = float(rat1)
    else:
        merged["contest_rating"] = None

    # Lossless contest global ranking: prefer fresh valid ranking from d2; otherwise preserve d1
    crank2 = d2.get("contest_global_ranking")
    crank1 = d1.get("contest_global_ranking")
    if _is_valid_rank(crank2):
        merged["contest_global_ranking"] = int(crank2)
    elif _is_valid_rank(crank1):
        merged["contest_global_ranking"] = int(crank1)
    else:
        merged["contest_global_ranking"] = None

    top_pct2 = d2.get("contest_top_percentage")
    top_pct1 = d1.get("contest_top_percentage")
    if top_pct2 is not None:
        merged["contest_top_percentage"] = top_pct2
    elif top_pct1 is not None:
        merged["contest_top_percentage"] = top_pct1

    h1 = {(h.get("contest", {}).get("title"), h.get("contest", {}).get("startTime")): h for h in d1.get("history", []) if isinstance(h, dict)}
    h2 = {(h.get("contest", {}).get("title"), h.get("contest", {}).get("startTime")): h for h in d2.get("history", []) if isinstance(h, dict)}
    
    for k, v in h2.items():
        if k in h1:
            if v.get("rating") and h1[k].get("rating"):
                h1[k]["rating"] = v["rating"]
        else:
            h1[k] = v
            
    merged["history"] = sorted(list(h1.values()), key=lambda x: x.get("contest", {}).get("startTime") or 0, reverse=True)
    return {"status": "ok", "data": merged}
