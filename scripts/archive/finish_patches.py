def finish_patches():
    # CountdownTimer
    path_cd = "frontend/src/components/CountdownTimer.tsx"
    with open(path_cd, "r", encoding="utf-8") as f:
        cd = f.read()

    cd = cd.replace(
        "? 'bg-white border-emerald-200/90 shadow-[0_10px_35px_-8px_rgba(16,185,129,0.15),0_4px_12px_rgba(0,0,0,0.02)]'",
        "? 'bg-white dark:bg-navy-900/95 border-emerald-200/90 dark:border-emerald-600/50 shadow-[0_10px_35px_-8px_rgba(16,185,129,0.15),0_4px_12px_rgba(0,0,0,0.02)]'"
    )
    cd = cd.replace(
        ": 'bg-white border-slate-200/90 shadow-[0_10px_35px_-8px_rgba(99,102,241,0.12),0_4px_12px_rgba(0,0,0,0.02)]'",
        ": 'bg-white dark:bg-navy-900/95 border-slate-200/90 dark:border-navy-700/80 shadow-[0_10px_35px_-8px_rgba(99,102,241,0.12),0_4px_12px_rgba(0,0,0,0.02)]'"
    )
    # Countdown day/hr/min/sec boxes
    old_box = 'className="relative px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-2xl bg-slate-50/90 border border-slate-200/90 shadow-sm min-w-[58px] sm:min-w-[66px] text-center"'
    new_box = 'className="relative px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-2xl bg-slate-50/90 dark:bg-navy-900/90 border border-slate-200/90 dark:border-navy-700 shadow-sm min-w-[58px] sm:min-w-[66px] text-center"'
    cd = cd.replace(old_box, new_box)

    with open(path_cd, "w", encoding="utf-8") as f:
        f.write(cd)
    print("CountdownTimer finished")

    # SystemHealthPage
    path_sh = "frontend/src/pages/SystemHealthPage.tsx"
    with open(path_sh, "r", encoding="utf-8") as f:
        sh = f.read()

    sh = sh.replace(
        '<div className="modal-container-responsive max-w-3xl bg-white text-slate-900 rounded-3xl shadow-lg border-4 border-amber-500/40 animate-modal-content">',
        '<div className="modal-container-responsive max-w-3xl bg-white dark:bg-navy-950 text-slate-900 dark:text-slate-100 rounded-3xl shadow-lg border-4 border-amber-500/40 animate-modal-content">'
    )
    with open(path_sh, "w", encoding="utf-8") as f:
        f.write(sh)
    print("SystemHealthPage finished")

if __name__ == "__main__":
    finish_patches()
