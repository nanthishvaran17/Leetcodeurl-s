const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT_IMAGE = path.resolve('output/brand_scenes/scene_team_credits.png');
fs.mkdirSync(path.resolve('output/brand_scenes'), { recursive: true });

// Convert images to base64 data URLs for seamless standalone rendering
function getBase64(filePath) {
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) return '';
  const ext = path.extname(fullPath).slice(1);
  const data = fs.readFileSync(fullPath).toString('base64');
  return `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${data}`;
}

const logoData = getBase64('round_logo.png') || getBase64('transparent_logo.png');
const hodPhoto = getBase64('output/team_photos/hod_dr_s_prabhu.png');
const nanthishPhoto = getBase64('output/team_photos/lead_dev_nanthish_s.jpg');
const kavinPhoto = getBase64('output/team_photos/testing_head_kavin_b.png');
const affanPhoto = getBase64('output/team_photos/security_head_affan.jpg');

async function renderCredits() {
  console.log('[CREDITS] Rendering Ultra-Premium Faculty Advisor & Engineering Team Showcase...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800;900&family=Inter:wght@400;600;700;800&display=swap');
    
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
      padding: 38px 60px 48px;
    }

    /* Animated Cyber Grid Layer */
    .grid-bg {
      position: absolute;
      inset: 0;
      background-image: 
        linear-gradient(rgba(56, 189, 248, 0.08) 1px, transparent 1px),
        linear-gradient(90deg, rgba(56, 189, 248, 0.08) 1px, transparent 1px);
      background-size: 60px 60px;
      mask-image: radial-gradient(circle at 50% 50%, black 55%, transparent 90%);
      pointer-events: none;
    }

    /* Ambient Lighting */
    .glow-cyan {
      position: absolute;
      width: 750px;
      height: 750px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(14, 165, 233, 0.22) 0%, rgba(99, 102, 241, 0.1) 40%, transparent 70%);
      filter: blur(85px);
      top: 15%;
      left: 30%;
      pointer-events: none;
    }

    .glow-gold {
      position: absolute;
      width: 450px;
      height: 450px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(251, 191, 36, 0.18) 0%, transparent 60%);
      filter: blur(80px);
      top: 5%;
      left: 50%;
      transform: translateX(-50%);
      pointer-events: none;
    }

    /* Cyber Corner Reticles */
    .hud-tag {
      position: absolute;
      font-family: monospace;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 2px;
      color: rgba(56, 189, 248, 0.7);
    }
    .hud-tl { top: 28px; left: 40px; }
    .hud-tr { top: 28px; right: 40px; }
    .hud-bl { bottom: 28px; left: 40px; }
    .hud-br { bottom: 28px; right: 40px; }

    /* Top Department & Institution Banner */
    .top-header {
      position: relative;
      z-index: 10;
      display: flex;
      align-items: center;
      gap: 22px;
      background: rgba(11, 20, 38, 0.85);
      border: 1px solid rgba(56, 189, 248, 0.4);
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.6), 0 0 25px rgba(56, 189, 248, 0.25);
      border-radius: 9999px;
      padding: 10px 38px 10px 22px;
      backdrop-filter: blur(16px);
    }

    .dept-logo {
      width: 58px;
      height: 58px;
      object-fit: contain;
      border-radius: 50%;
      box-shadow: 0 0 16px rgba(251, 191, 36, 0.4);
      background: #ffffff;
      padding: 3px;
    }

    .header-text {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .clg-title {
      font-family: 'Montserrat', sans-serif;
      font-size: 18px;
      font-weight: 900;
      letter-spacing: 2px;
      color: #fbbf24;
      text-transform: uppercase;
      text-shadow: 0 0 12px rgba(251, 191, 36, 0.4);
    }

    .dept-title {
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 1.2px;
      color: #38bdf8;
      text-transform: uppercase;
    }

    /* Section 1: Faculty Advisor Spotlight */
    .advisor-section {
      position: relative;
      z-index: 10;
      display: flex;
      align-items: center;
      gap: 24px;
      background: rgba(15, 23, 42, 0.82);
      border: 1px solid rgba(251, 191, 36, 0.45);
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6), 0 0 25px rgba(251, 191, 36, 0.2);
      border-radius: 24px;
      padding: 16px 36px;
      backdrop-filter: blur(16px);
      margin-top: 8px;
    }

    .advisor-photo-wrap {
      width: 96px;
      height: 96px;
      border-radius: 50%;
      border: 3px solid #fbbf24;
      box-shadow: 0 0 20px rgba(251, 191, 36, 0.5);
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
      gap: 4px;
    }

    .advisor-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
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
      font-size: 24px;
      font-weight: 900;
      letter-spacing: 0.8px;
      color: #FFFFFF;
    }

    .advisor-role {
      font-size: 14px;
      font-weight: 700;
      color: #94a3b8;
    }

    /* Section 2: Core Engineering Trio */
    .team-container {
      position: relative;
      z-index: 10;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      gap: 48px;
      width: 100%;
      max-width: 1400px;
      margin-top: 10px;
    }

    /* Left Card: Security Head */
    /* Center Card: Lead Developer (Prominent & Raised) */
    /* Right Card: Testing Head */
    .member-card {
      background: rgba(11, 20, 38, 0.88);
      border: 1px solid rgba(56, 189, 248, 0.35);
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.7), 0 0 20px rgba(56, 189, 248, 0.15);
      border-radius: 24px;
      padding: 24px 28px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 14px;
      backdrop-filter: blur(16px);
      width: 360px;
      transition: all 0.3s ease;
    }

    .member-card.lead {
      width: 420px;
      padding: 30px 32px;
      border: 2px solid #38bdf8;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8), 0 0 35px rgba(56, 189, 248, 0.35);
      transform: translateY(-16px);
      background: linear-gradient(180deg, rgba(14, 165, 233, 0.12) 0%, rgba(11, 20, 38, 0.94) 100%);
    }

    .avatar-wrap {
      width: 140px;
      height: 140px;
      border-radius: 50%;
      border: 3px solid #38bdf8;
      box-shadow: 0 0 22px rgba(56, 189, 248, 0.5);
      overflow: hidden;
      background: #0f172a;
    }

    .member-card.lead .avatar-wrap {
      width: 175px;
      height: 175px;
      border: 4px solid #38bdf8;
      box-shadow: 0 0 32px rgba(56, 189, 248, 0.7);
    }

    .avatar-wrap img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: top center;
    }

    .role-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
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
      box-shadow: 0 0 14px rgba(14, 165, 233, 0.6);
    }

    .role-security {
      color: #38bdf8;
      background: rgba(56, 189, 248, 0.15);
      border: 1px solid rgba(56, 189, 248, 0.4);
    }

    .role-testing {
      color: #a855f7;
      background: rgba(168, 85, 247, 0.15);
      border: 1px solid rgba(168, 85, 247, 0.4);
    }

    .member-name {
      font-family: 'Montserrat', sans-serif;
      font-size: 21px;
      font-weight: 900;
      letter-spacing: 0.6px;
      color: #FFFFFF;
    }

    .member-card.lead .member-name {
      font-size: 26px;
      letter-spacing: 0.8px;
      background: linear-gradient(135deg, #FFFFFF 0%, #38bdf8 60%, #818cf8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      text-shadow: 0 0 20px rgba(56, 189, 248, 0.35);
    }

    .member-desc {
      font-size: 13px;
      font-weight: 600;
      color: #94a3b8;
      letter-spacing: 0.5px;
    }

    /* Bottom Motto & Callout */
    .bottom-bar {
      position: relative;
      z-index: 10;
      display: flex;
      align-items: center;
      gap: 20px;
      background: rgba(3, 7, 18, 0.85);
      border: 1px solid rgba(251, 191, 36, 0.35);
      border-radius: 9999px;
      padding: 8px 32px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(12px);
    }

    .motto-en {
      font-family: 'Montserrat', sans-serif;
      font-size: 15px;
      font-weight: 900;
      letter-spacing: 2px;
      color: #fbbf24;
      text-transform: uppercase;
    }

    .motto-ta {
      font-family: 'Nirmala UI', sans-serif;
      font-size: 14px;
      font-weight: 700;
      color: #38bdf8;
      letter-spacing: 0.8px;
    }
  </style>
</head>
<body>
  <div class="grid-bg"></div>
  <div class="glow-cyan"></div>
  <div class="glow-gold"></div>

  <!-- Reticles -->
  <div class="hud-tag hud-tl">[SYS: CORE ARCHITECTURE TEAM]</div>
  <div class="hud-tag hud-tr">[NANDHA ENGINEERING COLLEGE // AUTONOMOUS]</div>
  <div class="hud-tag hud-bl">[DEPT: CSE (CYBER SECURITY)]</div>
  <div class="hud-tag hud-br">[PROMO MASTER // 2026]</div>

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
      <div class="advisor-badge">★ Faculty Advisor</div>
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
      <div class="role-badge role-security">🛡️ Security Head</div>
      <div class="member-name">Mr. Mohammed Affan J A</div>
      <div class="member-desc">Forensic Anti-Cheat & Auth Security</div>
    </div>

    <!-- Center: Lead Developer (Prominent) -->
    <div class="member-card lead">
      <div class="avatar-wrap">
        <img src="${nanthishPhoto}" alt="Mr. S. Nanthish" />
      </div>
      <div class="role-badge role-lead">⚡ Lead Developer</div>
      <div class="member-name">Mr. S. Nanthish</div>
      <div class="member-desc">Full-Stack Architect & Telemetry Engine</div>
    </div>

    <!-- Right: Testing Head -->
    <div class="member-card">
      <div class="avatar-wrap">
        <img src="${kavinPhoto}" alt="Mr. B. Kavin" />
      </div>
      <div class="role-badge role-testing">✓ Testing Head</div>
      <div class="member-name">Mr. B. Kavin</div>
      <div class="member-desc">Quality Assurance & Contest Validation</div>
    </div>
  </div>

  <!-- Bottom Institutional Motto -->
  <div class="bottom-bar">
    <span class="motto-en">LEARN • SERVE • SUCCEED</span>
    <span style="color: #64748b;">•</span>
    <span class="motto-ta">கற்போம் • சாதிப்போம் • வெல்வோம்</span>
  </div>
</body>
</html>`;

  await page.setContent(html, { waitUntil: 'load' });
  await page.screenshot({ path: OUT_IMAGE, omitBackground: false });
  await browser.close();
  console.log(`[SUCCESS] Ultra-Premium Team Credits Scene Saved: ${OUT_IMAGE}`);
}

renderCredits().catch(err => {
  console.error('[ERROR]', err);
  process.exit(1);
});
