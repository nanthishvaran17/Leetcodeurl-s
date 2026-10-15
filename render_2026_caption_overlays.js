const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OVERLAYS_DIR = path.resolve('output/overlays_2026');
fs.mkdirSync(OVERLAYS_DIR, { recursive: true });

const CAPTIONS = [
  {
    scene: "02",
    badge: "AUTHENTICATION",
    caption: "SECURE ACCESS. ONE CONNECTED PLATFORM."
  },
  {
    scene: "03",
    badge: "DASHBOARD",
    caption: "ONE VIEW. INSTITUTIONAL INSIGHT."
  },
  {
    scene: "04",
    badge: "STUDENT PROFILES",
    caption: "TRACK PROGRESS. UNDERSTAND PERFORMANCE."
  },
  {
    scene: "05",
    badge: "CONTESTS & COHORTS",
    caption: "CONTESTS. COHORTS. PERFORMANCE."
  },
  {
    scene: "06",
    badge: "DATA INTEGRITY",
    caption: "INSIGHTFUL ANALYTICS. DATA INTEGRITY."
  },
  {
    scene: "07",
    badge: "FACULTY & RECRUITMENT",
    caption: "ACTIONABLE INSIGHTS. BETTER SUPPORT."
  },
  {
    scene: "08",
    badge: "AI & TELEMETRY",
    caption: "INTELLIGENCE. MONITORING. ACCOUNTABILITY."
  },
  {
    scene: "09",
    badge: "REPORTS & LEADERBOARD",
    caption: "REPORTS READY. ACHIEVEMENTS VISIBLE."
  }
];

function generateHtml(item) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700;800;900&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 1920px;
      height: 1080px;
      background: transparent;
      font-family: 'Inter', -apple-system, sans-serif;
      overflow: hidden;
      position: relative;
    }
    .caption-pill {
      position: absolute;
      bottom: 42px;
      left: 50%;
      transform: translateX(-50%);
      display: inline-flex;
      align-items: center;
      gap: 16px;
      background: rgba(15, 23, 42, 0.92);
      border: 1px solid rgba(255, 255, 255, 0.18);
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5), 0 0 15px rgba(56, 189, 248, 0.15);
      border-radius: 9999px;
      padding: 10px 32px 10px 16px;
      backdrop-filter: blur(16px);
    }
    .badge {
      background: #0284c7;
      color: #FFFFFF;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 1.5px;
      padding: 5px 14px;
      border-radius: 9999px;
      text-transform: uppercase;
    }
    .caption-text {
      font-size: 16px;
      font-weight: 700;
      letter-spacing: 2px;
      color: #F8FAFC;
      text-transform: uppercase;
      white-space: nowrap;
    }
  </style>
</head>
<body>
  <div class="caption-pill">
    <span class="badge">${item.badge}</span>
    <span class="caption-text">${item.caption}</span>
  </div>
</body>
</html>`;
}

async function renderCaptions() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  for (const item of CAPTIONS) {
    const html = generateHtml(item);
    await page.setContent(html, { waitUntil: 'load' });
    const outPath = path.join(OVERLAYS_DIR, `caption_scene_${item.scene}.png`);
    await page.screenshot({ path: outPath, omitBackground: true });
    console.log(`[RENDERED] Caption Overlay Scene ${item.scene} -> ${outPath}`);
  }

  await browser.close();
  console.log('[SUCCESS] All Clean 2026 Caption Overlays Rendered!');
}

renderCaptions().catch(err => {
  console.error('[ERROR]', err);
  process.exit(1);
});
