const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT_PATH = path.resolve('output/nandha_tracker_agency_thumbnail.png');

async function renderThumbnail() {
  console.log('[THUMBNAIL] Generating 1920x1080 Agency Master Thumbnail with Glowing Crest...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@800;900&family=Inter:wght@500;700;800&display=swap');
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 1920px;
      height: 1080px;
      background: radial-gradient(circle at 50% 38%, #0f172a 0%, #030712 65%, #010409 100%);
      font-family: 'Inter', -apple-system, sans-serif;
      color: #FFFFFF;
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    /* Cyber Grid */
    .grid-layer {
      position: absolute;
      inset: 0;
      background-image: 
        linear-gradient(rgba(56, 189, 248, 0.07) 1px, transparent 1px),
        linear-gradient(90deg, rgba(56, 189, 248, 0.07) 1px, transparent 1px);
      background-size: 64px 64px;
      mask-image: radial-gradient(circle at 50% 50%, black 50%, transparent 85%);
      pointer-events: none;
    }

    /* Ambient Glow Flares */
    .glow-cyan {
      position: absolute;
      width: 800px;
      height: 800px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(14, 165, 233, 0.22) 0%, rgba(99, 102, 241, 0.12) 45%, transparent 70%);
      filter: blur(90px);
      top: 10%;
      left: 28%;
      pointer-events: none;
    }

    .glow-gold {
      position: absolute;
      width: 450px;
      height: 450px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(251, 191, 36, 0.18) 0%, transparent 65%);
      filter: blur(80px);
      top: 15%;
      right: 20%;
      pointer-events: none;
    }

    /* Cyber Corner Frame */
    .hud-frame {
      position: absolute;
      inset: 32px;
      border: 1px solid rgba(56, 189, 248, 0.25);
      border-radius: 24px;
      pointer-events: none;
      box-shadow: inset 0 0 40px rgba(56, 189, 248, 0.08);
    }
    .hud-tag {
      position: absolute;
      font-family: monospace;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 2px;
      color: rgba(56, 189, 248, 0.75);
    }
    .hud-tl { top: 48px; left: 56px; }
    .hud-tr { top: 48px; right: 56px; }
    .hud-bl { bottom: 48px; left: 56px; }
    .hud-br { bottom: 48px; right: 56px; }

    /* Center Content Container */
    .hero-content {
      position: relative;
      z-index: 10;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 24px;
      max-width: 1400px;
    }

    /* College Crest Emblem */
    .crest-container {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 10px 28px;
      background: rgba(15, 23, 42, 0.85);
      border: 1px solid rgba(251, 191, 36, 0.5);
      border-radius: 9999px;
      box-shadow: 0 0 25px rgba(251, 191, 36, 0.25);
    }
    .crest-icon {
      font-size: 26px;
      filter: drop-shadow(0 0 10px #fbbf24);
    }
    .college-name {
      font-family: 'Montserrat', sans-serif;
      font-size: 16px;
      font-weight: 800;
      letter-spacing: 2.5px;
      color: #fbbf24;
      text-transform: uppercase;
    }

    /* Main Showcase Title */
    .main-title {
      font-family: 'Montserrat', sans-serif;
      font-size: 78px;
      font-weight: 900;
      letter-spacing: 1.5px;
      line-height: 1.05;
      text-transform: uppercase;
      background: linear-gradient(135deg, #FFFFFF 0%, #38bdf8 45%, #818cf8 80%, #fbbf24 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      filter: drop-shadow(0 0 35px rgba(56, 189, 248, 0.45));
    }

    /* Subtitle Slogan */
    .subtitle {
      font-size: 24px;
      font-weight: 700;
      letter-spacing: 3px;
      color: #cbd5e1;
      text-transform: uppercase;
    }

    /* Tamil Motto */
    .tamil-motto {
      font-family: 'Nirmala UI', sans-serif;
      font-size: 19px;
      font-weight: 700;
      color: #fbbf24;
      background: rgba(3, 7, 18, 0.85);
      padding: 6px 26px;
      border-radius: 9999px;
      border: 1px solid rgba(251, 191, 36, 0.35);
      box-shadow: 0 0 15px rgba(251, 191, 36, 0.15);
      letter-spacing: 1px;
    }

    /* Metric Badges Grid */
    .metrics-row {
      display: flex;
      align-items: center;
      gap: 20px;
      margin-top: 12px;
    }
    .metric-pill {
      background: rgba(15, 23, 42, 0.85);
      border: 1px solid rgba(56, 189, 248, 0.4);
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5), 0 0 15px rgba(56, 189, 248, 0.2);
      border-radius: 14px;
      padding: 14px 26px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    }
    .metric-val {
      font-family: 'Montserrat', sans-serif;
      font-size: 28px;
      font-weight: 900;
      color: #38bdf8;
      text-shadow: 0 0 12px rgba(56, 189, 248, 0.6);
    }
    .metric-lbl {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1.5px;
      color: #94a3b8;
      text-transform: uppercase;
    }
  </style>
</head>
<body>
  <div class="grid-layer"></div>
  <div class="glow-cyan"></div>
  <div class="glow-gold"></div>

  <div class="hud-frame"></div>
  <div class="hud-tag hud-tl">SYS: LIVE INSTITUTIONAL INTELLIGENCE</div>
  <div class="hud-tag hud-tr">4K MASTER • 60 FPS HDR READY</div>
  <div class="hud-tag hud-bl">NANDHA ENGINEERING COLLEGE (AUTONOMOUS)</div>
  <div class="hud-tag hud-br">ERODE, TAMIL NADU // v2.8 PROMO</div>

  <div class="hero-content">
    <div class="crest-container">
      <span class="crest-icon">🛡️</span>
      <span class="college-name">Nandha Engineering College</span>
    </div>

    <h1 class="main-title">Nandha LeetCode<br/>Intelligence</h1>

    <div class="subtitle">Institutional Coding Analytics & Contest Engine</div>

    <div class="tamil-motto">கற்போம் • சாதிப்போம் • வெல்வோம்</div>

    <div class="metrics-row">
      <div class="metric-pill">
        <span class="metric-val">563</span>
        <span class="metric-lbl">Students Monitored</span>
      </div>
      <div class="metric-pill">
        <span class="metric-val">19</span>
        <span class="metric-lbl">Application Routes</span>
      </div>
      <div class="metric-pill">
        <span class="metric-val">24/7</span>
        <span class="metric-lbl">Autonomous AI Sync</span>
      </div>
      <div class="metric-pill">
        <span class="metric-val">100%</span>
        <span class="metric-lbl">Verified Anti-Cheat</span>
      </div>
    </div>
  </div>
</body>
</html>`;

  await page.setContent(html, { waitUntil: 'load' });
  await page.screenshot({ path: OUT_PATH, omitBackground: false });
  await browser.close();
  console.log(`[SUCCESS] Agency Thumbnail Saved: ${OUT_PATH}`);
}

renderThumbnail().catch(err => {
  console.error('[ERROR]', err);
  process.exit(1);
});
