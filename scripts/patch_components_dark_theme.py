import os

def update_contest_integrity():
    path = "frontend/src/pages/ContestIntegrityMonitor.tsx"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    replacements = [
        (
            'className="w-full h-10 pl-9 pr-8 rounded-xl border border-slate-200 bg-slate-50/60 text-xs font-bold text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:bg-white focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-left transition"',
            'className="w-full h-10 pl-9 pr-8 rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50/60 dark:bg-navy-900/60 text-xs font-bold text-slate-900 dark:text-white placeholder:font-normal placeholder:text-slate-400 focus:bg-white dark:focus:bg-navy-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-left transition"'
        ),
        (
            ": 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'",
            ": 'bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800'"
        ),
        (
            '<span className="inline-flex items-center px-2 py-0.5 rounded-md bg-white border border-slate-300 text-slate-900 text-[11px] font-mono font-black shrink-0">',
            '<span className="inline-flex items-center px-2 py-0.5 rounded-md bg-white dark:bg-navy-950 border border-slate-300 dark:border-navy-700 text-slate-900 dark:text-slate-200 text-[11px] font-mono font-black shrink-0">'
        ),
        (
            '<div className="hidden md:block bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_10px_rgba(15,23,42,0.03)] overflow-hidden w-full">',
            '<div className="hidden md:block bg-white dark:bg-navy-900 rounded-2xl border border-slate-200/80 dark:border-navy-700/80 shadow-[0_2px_10px_rgba(15,23,42,0.03)] overflow-hidden w-full">'
        ),
        (
            'className="hover:bg-purple-50/50 transition-colors bg-white cursor-pointer group"',
            'className="hover:bg-purple-50/50 dark:hover:bg-purple-950/25 transition-colors bg-white dark:bg-navy-900 cursor-pointer group"'
        ),
        (
            '<div className="bg-white rounded-2xl border border-slate-200/80 p-6 space-y-5 shadow-[0_2px_10px_rgba(15,23,42,0.03)] w-full">',
            '<div className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-200/80 dark:border-navy-700/80 p-6 space-y-5 shadow-[0_2px_10px_rgba(15,23,42,0.03)] w-full">'
        ),
        (
            'className="p-4 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50/80 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"',
            'className="p-4 rounded-xl border border-slate-200/80 dark:border-navy-700/80 bg-white dark:bg-navy-900 hover:bg-slate-50/80 dark:hover:bg-navy-800/80 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"'
        ),
        (
            '<div className="bg-white border border-slate-200 max-w-2xl w-full max-h-[78vh] flex flex-col rounded-3xl shadow-2xl overflow-hidden my-auto">',
            '<div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 max-w-2xl w-full max-h-[78vh] flex flex-col rounded-3xl shadow-2xl overflow-hidden my-auto">'
        ),
        (
            '<div className="bg-white border border-slate-200 max-w-xl w-full max-h-[78vh] flex flex-col rounded-3xl shadow-2xl overflow-hidden my-auto">',
            '<div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 max-w-xl w-full max-h-[78vh] flex flex-col rounded-3xl shadow-2xl overflow-hidden my-auto">'
        ),
        (
            '<div className="flex items-center justify-between border-b border-slate-200 p-4 shrink-0 bg-slate-50/50">',
            '<div className="flex items-center justify-between border-b border-slate-200 dark:border-navy-700 p-4 shrink-0 bg-slate-50/50 dark:bg-navy-950/50">'
        )
    ]

    for old, new in replacements:
        if old in content:
            content = content.replace(old, new, 1)
            print("ContestIntegrityMonitor: replaced", old[:35])
        else:
            print("ContestIntegrityMonitor: NOT matched", old[:35])

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

def update_report_preview():
    path = "frontend/src/components/ReportPreview.tsx"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    # In ReportPreview, mobile card items have `className="p-2.5 rounded-xl border border-slate-200/90 bg-white shadow-2xs`
    # Replace with dark variant
    old_card = 'className="p-2.5 rounded-xl border border-slate-200/90 bg-white shadow-2xs'
    new_card = 'className="p-2.5 rounded-xl border border-slate-200/90 dark:border-navy-700/80 bg-white dark:bg-navy-900/90 shadow-2xs'
    count = content.count(old_card)
    content = content.replace(old_card, new_card)
    print(f"ReportPreview: replaced {count} mobile cards")

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

def update_countdown_timer():
    path = "frontend/src/components/CountdownTimer.tsx"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    replacements = [
        (
            "? 'bg-white border-emerald-200/90 shadow-[0_10px_35px_-8px_rgba(16,185,129,0.15),0_4px_12px_rgba(0,0,0,0.03)]'",
            "? 'bg-white dark:bg-navy-900/90 border-emerald-200/90 dark:border-emerald-600/50 shadow-[0_10px_35px_-8px_rgba(16,185,129,0.15),0_4px_12px_rgba(0,0,0,0.03)]'"
        ),
        (
            ": 'bg-white border-slate-200/90 shadow-[0_10px_35px_-8px_rgba(99,102,241,0.12),0_4px_12px_rgba(0,0,0,0.03)]'",
            ": 'bg-white dark:bg-navy-900/90 border-slate-200/90 dark:border-navy-700/80 shadow-[0_10px_35px_-8px_rgba(99,102,241,0.12),0_4px_12px_rgba(0,0,0,0.03)]'"
        ),
        (
            ": 'bg-slate-50 border border-slate-200 text-slate-700'",
            ": 'bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-200'"
        ),
        (
            '<div className="relative px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-2xl bg-slate-50/90 border border-slate-200/80 backdrop-blur-xs flex items-center justify-between gap-3">',
            '<div className="relative px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-2xl bg-slate-50/90 dark:bg-navy-900/80 border border-slate-200/80 dark:border-navy-700 backdrop-blur-xs flex items-center justify-between gap-3">'
        )
    ]
    for old, new in replacements:
        if old in content:
            content = content.replace(old, new)
            print("CountdownTimer: replaced", old[:35])
        else:
            print("CountdownTimer: NOT matched", old[:35])

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

def update_system_health():
    path = "frontend/src/pages/SystemHealthPage.tsx"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    replacements = [
        (
            '<div className="modal-container-responsive max-w-3xl bg-white text-slate-900 rounded-3xl shadow-lg border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">',
            '<div className="modal-container-responsive max-w-3xl bg-white dark:bg-navy-950 text-slate-900 dark:text-slate-100 rounded-3xl shadow-lg border border-slate-200 dark:border-navy-700 overflow-hidden flex flex-col max-h-[85vh]">'
        ),
        (
            '<div className="p-2 rounded-lg bg-white border border-slate-300">',
            '<div className="p-2 rounded-lg bg-white dark:bg-navy-900 border border-slate-300 dark:border-navy-700">'
        )
    ]
    for old, new in replacements:
        if old in content:
            content = content.replace(old, new)
            print("SystemHealthPage: replaced", old[:35])
        else:
            print("SystemHealthPage: NOT matched", old[:35])

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

def update_all17_reports():
    path = "frontend/src/components/reports/All17ReportsManager.tsx"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    replacements = [
        (
            '<div className="no-print max-w-[1200px] mx-auto bg-white rounded-xl shadow-md p-4 mb-6 border border-slate-200">',
            '<div className="no-print max-w-[1200px] mx-auto bg-white dark:bg-navy-900 rounded-xl shadow-md p-4 mb-6 border border-slate-200 dark:border-navy-700">'
        ),
        (
            'className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-900 font-semibold"',
            'className="w-full border border-slate-300 dark:border-navy-700 rounded-lg p-2 bg-white dark:bg-navy-950 text-slate-900 dark:text-slate-100 font-semibold"'
        ),
        (
            '<div className="max-w-[1200px] mx-auto shadow-xl rounded-md overflow-hidden bg-white">',
            '<div className="max-w-[1200px] mx-auto shadow-xl rounded-md overflow-hidden bg-white dark:bg-navy-900">'
        )
    ]
    for old, new in replacements:
        if old in content:
            content = content.replace(old, new)
            print("All17ReportsManager: replaced", old[:35])
        else:
            print("All17ReportsManager: NOT matched", old[:35])

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

if __name__ == "__main__":
    update_contest_integrity()
    update_report_preview()
    update_countdown_timer()
    update_system_health()
    update_all17_reports()
