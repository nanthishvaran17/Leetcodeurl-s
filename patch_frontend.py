with open("e:/Leetcode Web/frontend/src/components/PreviousWeekContestPanel.tsx", "r", encoding="utf-8") as f:
    t = f.read()

# Replace the old timing section (q.time span) with new structured rendering
old = """                            <div className="text-right shrink-0 font-mono space-y-1.5">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-black tracking-wider uppercase block border shadow-sm ${
                                isSolved 
                                  ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30' 
                                  : isFailed 
                                    ? 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-500/20 dark:text-rose-400 dark:border-rose-500/30' 
                                    : 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-navy-800 dark:text-slate-400 dark:border-navy-700'
                              }`}>
                                {q.status}
                              </span>
                              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">{q.time}</span>
                            </div>"""

new = """                            <div className="text-right shrink-0 font-mono space-y-1.5">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-black tracking-wider uppercase block border shadow-sm ${
                                isSolved 
                                  ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30' 
                                  : isFailed 
                                    ? 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-500/20 dark:text-rose-400 dark:border-rose-500/30' 
                                    : 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-navy-800 dark:text-slate-400 dark:border-navy-700'
                              }`}>
                                {q.status}
                              </span>
                              {q.timingSource === 'OBSERVED_LIVE' && q.timeDisplay && (
                                <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 block">{q.timeDisplay}</span>
                              )}
                              {q.timingSource === 'ESTIMATED_DIFFICULTY_WEIGHT' && q.timeDisplay && (
                                <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 block">{q.timeDisplay}</span>
                              )}
                              {q.timingSource === 'OBSERVED_LIVE' && q.timeDisplay && (
                                <span title="Calculated from verified live activity events" className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 border border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-400 dark:border-emerald-600">OBSERVED</span>
                              )}
                              {q.timingSource === 'ESTIMATED_DIFFICULTY_WEIGHT' && q.timeDisplay && (
                                <span title="Difficulty-weighted allocation from contest presence. Not exact." className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-amber-100 text-amber-700 border border-amber-300 dark:bg-amber-900/40 dark:text-amber-400 dark:border-amber-600">ESTIMATED</span>
                              )}
                              {(!q.timeDisplay) && isSolved && (
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 block">Time Unavailable</span>
                              )}
                            </div>"""

if old in t:
    t = t.replace(old, new)
    print("Replaced timing section")
else:
    print("Pattern not found - checking for whitespace issues")
    # Print lines around the section
    lines = t.split("\n")
    for i, l in enumerate(lines):
        if "q.time}" in l:
            print(f"Line {i}: {repr(l)}")

with open("e:/Leetcode Web/frontend/src/components/PreviousWeekContestPanel.tsx", "w", encoding="utf-8") as f:
    f.write(t)
