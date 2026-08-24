import sys
from backend.services.email_service import send_email

subject = "🚀 NANDHA LEETCODE INTELLIGENCE — Live Production Deployment Complete"

body_html = """
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 20px; }
    .card { background-color: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 28px; max-width: 650px; margin: 0 auto; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    h1 { color: #38bdf8; font-size: 22px; margin-top: 0; }
    .status-badge { display: inline-block; background-color: #059669; color: #ffffff; padding: 6px 14px; border-radius: 20px; font-weight: bold; font-size: 13px; margin-bottom: 16px; }
    ul { background-color: #0f172a; padding: 16px 24px; border-radius: 12px; border: 1px solid #334155; }
    li { margin-bottom: 8px; line-height: 1.5; font-size: 14px; }
    a { color: #38bdf8; text-decoration: none; font-weight: bold; }
    .footer { margin-top: 24px; font-size: 12px; color: #94a3b8; border-top: 1px solid #334155; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="status-badge">✓ DEPLOYMENT COMPLETED</div>
    <h1>🚀 NANDHA LEETCODE INTELLIGENCE</h1>
    <p>Dear Nanthishvaran,</p>
    <p>All production updates, modal view-centering systems, zero page-jump enhancements, and responsive layout fixes have been successfully built, committed to GitHub, deployed to Render, and published live on Firebase Hosting!</p>
    
    <h3>🌐 Live Deployment Endpoints:</h3>
    <ul>
      <li><b>Firebase Production Web App:</b> <a href="https://leetcode-student-data.web.app">https://leetcode-student-data.web.app</a></li>
      <li><b>GitHub Repository:</b> Main branch pushed (Commit <code>9f761a8c</code>)</li>
      <li><b>Render Backend:</b> Triggered live deployment from GitHub <code>main</code></li>
    </ul>

    <h3>✨ Highlights of Deployed Enhancements:</h3>
    <ul>
      <li><b>Viewport-Centered Student Profile & Timeline Modals:</b> 100% dead-centered display mounted via <code>createPortal</code> to <code>document.body</code>.</li>
      <li><b>Zero Page Jump & Scroll Position Preservation:</b> Active tab and exact scroll position remain locked when opening or closing modals.</li>
      <li><b>Auto-Fit Header Bounds:</b> Header title bars sit 32px below the screen top, ensuring 100% visibility without top cut-off.</li>
      <li><b>Instant 0ms Display:</b> Instant modal pop-up on student click with background async data loading.</li>
    </ul>

    <div class="footer">
      Sent automatically by <b>Nandha LeetCode Intelligence Automated Deployment Engine</b>.<br/>
      Recipient: <code>nanthishvaran17@gmail.com</code>
    </div>
  </div>
</body>
</html>
"""

body_text = """
NANDHA LEETCODE INTELLIGENCE — PRODUCTION DEPLOYMENT COMPLETED

Dear Nanthishvaran,

All production updates and modal view-centering enhancements have been successfully built, committed to GitHub, deployed to Render, and published live on Firebase Hosting!

Live Web App: https://leetcode-student-data.web.app
GitHub Commit: 9f761a8c (main branch)

Recipient: nanthishvaran17@gmail.com
"""

print("Sending completion email to nanthishvaran17@gmail.com...")
success, err_msg = send_email('nanthishvaran17@gmail.com', subject, body_html, None, body_text)
print(f"Email Dispatch Result: Success={success}, Error={err_msg}")
