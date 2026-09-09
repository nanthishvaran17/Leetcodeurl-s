from typing import Dict, Any

def _merge_phase_a(res1: Dict[str, Any], res2: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(res1, dict) or res1.get("status") != "ok": return res2
    if not isinstance(res2, dict) or res2.get("status") != "ok": return res1

    d1 = res1.get("data", {})
    d2 = res2.get("data", {})

    merged = d1.copy()
    
    merged["ranking"] = max(d1.get("ranking") or 0, d2.get("ranking") or 0)
    merged["profile_global_ranking"] = max(d1.get("profile_global_ranking") or 0, d2.get("profile_global_ranking") or 0)
    merged["reputation"] = max(d1.get("reputation") or 0, d2.get("reputation") or 0)
    merged["total_solved"] = max(d1.get("total_solved") or 0, d2.get("total_solved") or 0)
    merged["easy_solved"] = max(d1.get("easy_solved") or 0, d2.get("easy_solved") or 0)
    merged["medium_solved"] = max(d1.get("medium_solved") or 0, d2.get("medium_solved") or 0)
    merged["hard_solved"] = max(d1.get("hard_solved") or 0, d2.get("hard_solved") or 0)
    merged["streak"] = max(d1.get("streak") or 0, d2.get("streak") or 0)
    merged["max_streak"] = max(d1.get("max_streak") or 0, d2.get("max_streak") or 0)
    merged["total_active_days"] = max(d1.get("total_active_days") or 0, d2.get("total_active_days") or 0)

    b1 = {b["badge_id"]: b for b in d1.get("badges", [])}
    b2 = {b["badge_id"]: b for b in d2.get("badges", [])}
    b1.update(b2)
    merged["badges"] = list(b1.values())

    l1 = {lp["language_name"]: lp["problems_solved"] for lp in d1.get("languages", [])}
    l2 = {lp["language_name"]: lp["problems_solved"] for lp in d2.get("languages", [])}
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
    merged["contest_rating"] = max(d1.get("contest_rating") or 0.0, d2.get("contest_rating") or 0.0)
    merged["contest_global_ranking"] = max(d1.get("contest_global_ranking") or 0, d2.get("contest_global_ranking") or 0)
    merged["contest_top_percentage"] = max(d1.get("contest_top_percentage") or 0.0, d2.get("contest_top_percentage") or 0.0)

    h1 = {(h.get("contest", {}).get("title"), h.get("contest", {}).get("startTime")): h for h in d1.get("history", [])}
    h2 = {(h.get("contest", {}).get("title"), h.get("contest", {}).get("startTime")): h for h in d2.get("history", [])}
    
    for k, v in h2.items():
        if k in h1:
            if v.get("rating") and h1[k].get("rating"):
                h1[k]["rating"] = max(v["rating"], h1[k]["rating"])
        else:
            h1[k] = v
            
    merged["history"] = sorted(list(h1.values()), key=lambda x: x.get("contest", {}).get("startTime") or 0, reverse=True)
    return {"status": "ok", "data": merged}
