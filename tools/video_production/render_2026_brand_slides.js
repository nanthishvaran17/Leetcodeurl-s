const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SCENES_DIR = path.resolve('output/brand_scenes_2026');
fs.mkdirSync(SCENES_DIR, { recursive: true });

function getBase64(filePath) {
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) return '';
  const ext = path.extname(fullPath).slice(1);
  const data = fs.readFileSync(fullPath).toString('base64');
  return `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${data}`;
}

const logoData = getBase64('frontend/dist/nec_25_years_logo_transparent.png') || 
                 getBase64('round_logo.png') || 
                 getBase64('transparent_logo.png');
const hodPhoto = getBase64('output/team_photos/hod_dr_s_prabhu.png');
const nanthishPhoto = getBase64('output/team_photos/lead_dev_nanthish_s.jpg');
const kavinPhoto = getBase64('output/team_photos/testing_head_kavin_b.png');
const affanPhoto = getBase64('output/team_photos/security_head_affan.jpg');

async function renderSlides() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  // 1. Scene 01: Institutional Brand Opening (Clean, Bright Enterprise Style)
  const scene01Html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Montserrat:wght@700;800;900&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 1920px;
      height: 1080px;
      background: radial-gradient(circle at 50% 45%, #0f172a 0%, #070d19 60%, #030712 100%);
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      color: #FFFFFF;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      position: relative;
      overflow: hidden;
      text-align: center;
    }
    .grid-bg {
      position: absolute;
      inset: 0;
      background-image: 
        linear-gradient(rgba(56, 189, 248, 0.05) 1px, transparent 1px),
        linear-gradient(90deg, rgba(56, 189, 248, 0.05) 1px, transparent 1px);
      background-size: 60px 60px;
      mask-image: radial-gradient(circle at 50% 50%, black 50%, transparent 85%);
      pointer-events: none;
    }
    .ambient-glow {
      position: absolute;
      width: 700px;
      height: 700px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(14, 165, 233, 0.18) 0%, rgba(99, 102, 241, 0.08) 45%, transparent 70%);
      filter: blur(80px);
      pointer-events: none;
    }
    .content-box {
      position: relative;
      z-index: 10;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 24px;
      max-width: 1300px;
    }
    .crest-wrap {
      width: 120px;
      height: 120px;
      border-radius: 50%;
      background: #FFFFFF;
      padding: 8px;
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.6), 0 0 30px rgba(56, 189, 248, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .crest-wrap img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    .institution-tag {
      font-family: 'Inter', sans-serif;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 3px;
      color: #38bdf8;
      text-transform: uppercase;
      background: rgba(14, 165, 233, 0.12);
      border: 1px solid rgba(56, 189, 248, 0.3);
      padding: 6px 20px;
      border-radius: 9999px;
    }
    .main-title {
      font-family: 'Montserrat', sans-serif;
      font-size: 68px;
      font-weight: 900;
      letter-spacing: 1.5px;
      line-height: 1.1;
      text-transform: uppercase;
      background: linear-gradient(135deg, #FFFFFF 0%, #E2E8F0 40%, #38bdf8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      text-shadow: 0 0 30px rgba(56, 189, 248, 0.25);
    }
    .subtitle {
      font-size: 22px;
      font-weight: 600;
      letter-spacing: 4px;
      color: #94a3b8;
      text-transform: uppercase;
    }
    .college-name {
      font-size: 18px;
      font-weight: 700;
      letter-spacing: 2px;
      color: #fbbf24;
      text-transform: uppercase;
      margin-top: 6px;
    }
  </style>
</head>
<body>
  <div class="grid-bg"></div>
  <div class="ambient-glow"></div>
  <div class="content-box">
    <div class="crest-wrap">
      <img src="${logoData}" alt="Nandha Engineering College" />
    </div>
    <div class="institution-tag">Enterprise Software Showcase • 2026</div>
    <h1 class="main-title">Nandha LeetCode<br/>Intelligence</h1>
    <div class="subtitle">Institutional Coding Analytics & Real-Time Contest Tracker</div>
    <div class="college-name">Nandha Engineering College (Autonomous), Erode</div>
  </div>
</body>
</html>`;

  await page.setContent(scene01Html, { waitUntil: 'load' });
  const scene01Path = path.join(SCENES_DIR, 'scene_01_intro.png');
  await page.screenshot({ path: scene01Path });
  console.log(`[RENDERED] Scene 01 Intro Slide -> ${scene01Path}`);

  // 2. Scene 10: Team Credits & Closing Slide (English Only, Professional Enterprise Aesthetic)
  const scene10Html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Montserrat:wght@700;800;900&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 1920px;
      height: 1080px;
      background: radial-gradient(circle at 50% 40%, #0d1a33 0%, #050b16 60%, #02050b 100%);
      font-family: 'Inter', -apple-system, sans-serif;
      color: #FFFFFF;
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      padding: 40px 60px 45px;
    }
    .grid-bg {
      position: absolute;
      inset: 0;
      background-image: 
        linear-gradient(rgba(56, 189, 248, 0.06) 1px, transparent 1px),
        linear-gradient(90deg, rgba(56, 189, 248, 0.06) 1px, transparent 1px);
      background-size: 60px 60px;
      mask-image: radial-gradient(circle at 50% 50%, black 60%, transparent 90%);
      pointer-events: none;
    }
    .ambient-glow {
      position: absolute;
      width: 800px;
      height: 800px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(14, 165, 233, 0.16) 0%, rgba(99, 102, 241, 0.08) 45%, transparent 70%);
      filter: blur(90px);
      top: 15%;
      left: 30%;
      pointer-events: none;
    }
    .top-header {
      position: relative;
      z-index: 10;
      display: flex;
      align-items: center;
      gap: 20px;
      background: rgba(11, 20, 38, 0.88);
      border: 1px solid rgba(56, 189, 248, 0.35);
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5), 0 0 20px rgba(56, 189, 248, 0.2);
      border-radius: 9999px;
      padding: 10px 36px 10px 20px;
      backdrop-filter: blur(16px);
    }
    .dept-logo {
      width: 54px;
      height: 54px;
      object-fit: contain;
      border-radius: 50%;
      background: #FFFFFF;
      padding: 3px;
    }
    .header-text {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .clg-title {
      font-family: 'Montserrat', sans-serif;
      font-size: 17px;
      font-weight: 800;
      letter-spacing: 1.8px;
      color: #fbbf24;
      text-transform: uppercase;
    }
    .dept-title {
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 1px;
      color: #38bdf8;
      text-transform: uppercase;
    }
    .advisor-section {
      position: relative;
      z-index: 10;
      display: flex;
      align-items: center;
      gap: 22px;
      background: rgba(15, 23, 42, 0.85);
      border: 1px solid rgba(251, 191, 36, 0.45);
      box-shadow: 0 16px 36px rgba(0, 0, 0, 0.5);
      border-radius: 20px;
      padding: 14px 34px;
      backdrop-filter: blur(16px);
    }
    .advisor-photo-wrap {
      width: 88px;
      height: 88px;
      border-radius: 50%;
      border: 3px solid #fbbf24;
      box-shadow: 0 0 18px rgba(251, 191, 36, 0.45);
      overflow: hidden;
      flex-shrink: 0;
      background: #0f172a;
    }
    .advisor-photo-wrap img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: top center;
    }
    .advisor-details {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .advisor-badge {
      display: inline-flex;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 1.5px;
      color: #fbbf24;
      background: rgba(251, 191, 36, 0.15);
      border: 1px solid rgba(251, 191, 36, 0.35);
      padding: 3px 12px;
      border-radius: 9999px;
      width: fit-content;
      text-transform: uppercase;
    }
    .advisor-name {
      font-family: 'Montserrat', sans-serif;
      font-size: 22px;
      font-weight: 800;
      letter-spacing: 0.6px;
      color: #FFFFFF;
    }
    .advisor-role {
      font-size: 13px;
      font-weight: 600;
      color: #94a3b8;
    }
    .team-container {
      position: relative;
      z-index: 10;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      gap: 44px;
      width: 100%;
      max-width: 1350px;
    }
    .member-card {
      background: rgba(11, 20, 38, 0.88);
      border: 1px solid rgba(56, 189, 248, 0.3);
      box-shadow: 0 14px 36px rgba(0, 0, 0, 0.6);
      border-radius: 20px;
      padding: 22px 26px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 12px;
      backdrop-filter: blur(16px);
      width: 350px;
    }
    .member-card.lead {
      width: 410px;
      padding: 28px 30px;
      border: 2px solid #38bdf8;
      box-shadow: 0 20px 48px rgba(0, 0, 0, 0.75), 0 0 30px rgba(56, 189, 248, 0.3);
      transform: translateY(-14px);
      background: linear-gradient(180deg, rgba(14, 165, 233, 0.12) 0%, rgba(11, 20, 38, 0.94) 100%);
    }
    .avatar-wrap {
      width: 130px;
      height: 130px;
      border-radius: 50%;
      border: 3px solid #38bdf8;
      box-shadow: 0 0 20px rgba(56, 189, 248, 0.4);
      overflow: hidden;
      background: #0f172a;
    }
    .member-card.lead .avatar-wrap {
      width: 165px;
      height: 165px;
      border: 4px solid #38bdf8;
      box-shadow: 0 0 28px rgba(56, 189, 248, 0.6);
    }
    .avatar-wrap img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: top center;
    }
    .role-badge {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 1.5px;
      padding: 4px 14px;
      border-radius: 9999px;
      text-transform: uppercase;
    }
    .role-lead {
      color: #FFFFFF;
      background: linear-gradient(135deg, #0284c7, #2563eb);
      border: 1px solid #38bdf8;
    }
    .role-security {
      color: #38bdf8;
      background: rgba(56, 189, 248, 0.15);
      border: 1px solid rgba(56, 189, 248, 0.35);
    }
    .role-testing {
      color: #a855f7;
      background: rgba(168, 85, 247, 0.15);
      border: 1px solid rgba(168, 85, 247, 0.35);
    }
    .member-name {
      font-family: 'Montserrat', sans-serif;
      font-size: 20px;
      font-weight: 800;
      letter-spacing: 0.5px;
      color: #FFFFFF;
    }
    .member-card.lead .member-name {
      font-size: 24px;
      background: linear-gradient(135deg, #FFFFFF 0%, #38bdf8 60%, #818cf8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .member-desc {
      font-size: 13px;
      font-weight: 600;
      color: #94a3b8;
    }
    .bottom-closing {
      position: relative;
      z-index: 10;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
    }
    .closing-motto {
      font-family: 'Montserrat', sans-serif;
      font-size: 17px;
      font-weight: 900;
      letter-spacing: 4px;
      color: #fbbf24;
      text-transform: uppercase;
      background: rgba(15, 23, 42, 0.85);
      border: 1px solid rgba(251, 191, 36, 0.4);
      padding: 6px 28px;
      border-radius: 9999px;
    }
    .closing-sub {
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 1.5px;
      color: #64748b;
      text-transform: uppercase;
    }
  </style>
</head>
<body>
  <div class="grid-bg"></div>
  <div class="ambient-glow"></div>

  <!-- Top Header -->
  <div class="top-header">
    <img src="${logoData}" class="dept-logo" alt="NEC Logo" />
    <div class="header-text">
      <span class="clg-title">Nandha Engineering College (Autonomous)</span>
      <span class="dept-title">Department of Computer Science and Engineering (Cyber Security)</span>
    </div>
  </div>

  <!-- Faculty Advisor Card -->
  <div class="advisor-section">
    <div class="advisor-photo-wrap">
      <img src="${hodPhoto}" alt="Dr. S. Prabhu" />
    </div>
    <div class="advisor-details">
      <div class="advisor-badge">Faculty Advisor</div>
      <div class="advisor-name">Dr. S. Prabhu</div>
      <div class="advisor-role">Head of the Department — CSE (Cyber Security & IoT)</div>
    </div>
  </div>

  <!-- Core Engineering Trio: Left = Security Head, Center = Lead Developer, Right = Testing Head -->
  <div class="team-container">
    <!-- Left: Security Head -->
    <div class="member-card">
      <div class="avatar-wrap">
        <img src="${affanPhoto}" alt="Mr. Mohammed Affan J A" />
      </div>
      <div class="role-badge role-security">Security Head</div>
      <div class="member-name">Mr. Mohammed Affan J A</div>
      <div class="member-desc">Forensic Anti-Cheat & Auth Security</div>
    </div>

    <!-- Center: Lead Developer (Prominent) -->
    <div class="member-card lead">
      <div class="avatar-wrap">
        <img src="${nanthishPhoto}" alt="Mr. S. Nanthish" />
      </div>
      <div class="role-badge role-lead">Lead Developer</div>
      <div class="member-name">Mr. S. Nanthish</div>
      <div class="member-desc">Full-Stack Architect & Telemetry Engine</div>
    </div>

    <!-- Right: Testing Head -->
    <div class="member-card">
      <div class="avatar-wrap">
        <img src="${kavinPhoto}" alt="Mr. B. Kavin" />
      </div>
      <div class="role-badge role-testing">Testing Head</div>
      <div class="member-name">Mr. B. Kavin</div>
      <div class="member-desc">Quality Assurance & Contest Validation</div>
    </div>
  </div>

  <!-- Bottom Closing (100% English Only) -->
  <div class="bottom-closing">
    <div class="closing-motto">LEARN. BUILD. ACHIEVE.</div>
    <div class="closing-sub">Built for Institutional Coding Analytics • Nandha Engineering College, Erode</div>
  </div>
</body>
</html>`;

  await page.setContent(scene10Html, { waitUntil: 'load' });
  const scene10Path = path.join(SCENES_DIR, 'scene_10_closing_credits.png');
  await page.screenshot({ path: scene10Path });
  console.log(`[RENDERED] Scene 10 Closing Credits -> ${scene10Path}`);

  await browser.close();
  console.log('[SUCCESS] Both 2026 Brand Slides Rendered (100% English Only)!');
}

renderSlides().catch(err => {
  console.error('[ERROR]', err);
  process.exit(1);
});
