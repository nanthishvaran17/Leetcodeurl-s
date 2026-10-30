import re
import os

def update_index_css():
    path = "frontend/src/index.css"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Ensure html.dark has color-scheme and background
    if "html.dark {" not in content:
        content = content.replace(
            ".dark body {",
            "html.dark {\n  background-color: #060813 !important;\n  color-scheme: dark;\n}\n\n.dark body {"
        )
        print("Added html.dark rule")

    # 2. Add :not([class*=\"dark:bg-\"]) to .bg-white and related glassmorphic surfaces
    # Replace .dark .bg-white:not([data-keep-light="true"])
    content = content.replace(
        '.dark .bg-white:not([data-keep-light="true"]),',
        '.dark .bg-white:not([class*="dark:bg-"]):not([data-keep-light="true"]),'
    )
    content = content.replace(
        '.dark .bg-white:not([data-keep-light="true"]):hover,',
        '.dark .bg-white:not([class*="dark:bg-"]):not([data-keep-light="true"]):hover,'
    )

    # 3. Replace .dark .bg-slate-* etc.
    secondary_classes = [
        '.dark .bg-slate-50:not([data-keep-light="true"]),',
        '.dark .bg-slate-100:not([data-keep-light="true"]),',
        '.dark .bg-gray-50:not([data-keep-light="true"]),',
        '.dark .bg-gray-100:not([data-keep-light="true"]),',
        '.dark .bg-zinc-50:not([data-keep-light="true"]),',
        '.dark .bg-zinc-100:not([data-keep-light="true"]),',
        '.dark .bg-neutral-50:not([data-keep-light="true"]),',
        '.dark .bg-slate-200:not([data-keep-light="true"]),',
        '.dark .bg-gray-200:not([data-keep-light="true"]),',
        '.dark .bg-zinc-200:not([data-keep-light="true"])',
    ]
    for s in secondary_classes:
        rep = s.replace(':not([data-keep-light="true"])', ':not([class*="dark:bg-"]):not([data-keep-light="true"])')
        content = content.replace(s, rep)

    # 4. Borders - preserve explicit dark:border-
    border_targets = [
        '.dark [class*="border-slate-1"],',
        '.dark [class*="border-slate-2"],',
        '.dark [class*="border-slate-3"],',
        '.dark [class*="border-gray-1"],',
        '.dark [class*="border-gray-2"],',
        '.dark [class*="border-gray-3"],',
        '.dark [class*="border-zinc-1"],',
        '.dark [class*="border-zinc-2"],',
        '.dark [class*="border-zinc-3"],',
        '.dark [class*="border-neutral-1"],',
        '.dark [class*="border-neutral-2"],',
        '.dark [class*="divide-slate-1"],',
        '.dark [class*="divide-slate-2"],',
        '.dark [class*="divide-slate-3"],',
        '.dark [class*="divide-gray-1"],',
        '.dark [class*="divide-gray-2"],',
    ]
    for b in border_targets:
        rep = b.replace('],', ']:not([class*="dark:border-"]),')
        if "divide-" in b:
            rep = b.replace('],', ']:not([class*="dark:divide-"]),')
        content = content.replace(b, rep)

    # 5. Typography - preserve explicit dark:text-
    typo_targets = [
        '.dark .text-slate-950,',
        '.dark .text-slate-900,',
        '.dark .text-gray-950,',
        '.dark .text-gray-900,',
        '.dark .text-zinc-950,',
        '.dark .text-zinc-900,',
        '.dark .text-neutral-950,',
        '.dark .text-neutral-900,',
        '.dark .text-black {',
        '.dark .text-slate-800,',
        '.dark .text-gray-800,',
        '.dark .text-zinc-800,',
        '.dark .text-neutral-800 {',
        '.dark .text-slate-700,',
        '.dark .text-gray-700,',
        '.dark .text-zinc-700,',
        '.dark .text-neutral-700 {',
        '.dark .text-slate-600,',
        '.dark .text-gray-600,',
        '.dark .text-zinc-600,',
        '.dark .text-neutral-600 {',
        '.dark .text-slate-500,',
        '.dark .text-gray-500,',
        '.dark .text-zinc-500,',
        '.dark .text-neutral-500 {',
    ]
    for t in typo_targets:
        if t.endswith(','):
            rep = t[:-1] + ':not([class*="dark:text-"]):not([data-keep-light="true"]),'
        elif t.endswith('{'):
            rep = t[:-1].strip() + ':not([class*="dark:text-"]):not([data-keep-light="true"]) {'
        content = content.replace(t, rep)

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("index.css updated successfully!")

if __name__ == "__main__":
    update_index_css()
