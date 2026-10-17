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

async function renderAnimatedScene10() {
  const videoDir = path.resolve('output/brand_scenes_2026/video_rec');
  if (fs.existsSync(videoDir)) {
    fs.rmSync(videoDir, { recursive: true, force: true });
  }
  fs.mkdirSync(videoDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
      dir: videoDir,
      size: { width: 1920, height: 1080 }
    }
  });

  const page = await context.newPage();

  const html = `<!DOCTYPE html>
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
      padding: 38px 60px 42px;
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
      width: 900px;
      height: 900px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(14, 165, 233, 0.18) 0%, rgba(99, 102, 241, 0.08) 45%, transparent 70%);
      filter: blur(90px);
      top: 15%;
      left: 28%;
      pointer-events: none;
    }

    /* Keyframes for kinetic reveal */
    @keyframes slideDownFade {
      0% { opacity: 0; transform: translateY(-40px); }
      100% { opacity: 1; transform: translateY(0); }
    }
    @keyframes zoomFadeIn {
      0% { opacity: 0; transform: scale(0.85); }
      100% { opacity: 1; transform: scale(1); }
    }
    @keyframes slideUpFade {
      0% { opacity: 0; transform: translateY(50px); }
      100% { opacity: 1; transform: translateY(0); }
    }
    @keyframes slideUpLead {
      0% { opacity: 0; transform: translateY(60px) scale(0.9); }
      100% { opacity: 1; transform: translateY(-14px) scale(1); }
    }
    @keyframes letterShimmer {
      0% { background-position: -200% center; }
      100% { background-position: 200% center; }
    }
    @keyframes pulseGlow {
      0%, 100% { box-shadow: 0 0 25px rgba(56, 189, 248, 0.4); }
      50% { box-shadow: 0 0 45px rgba(56, 189, 248, 0.7); }
    }

    /* Top Header */
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
      animation: slideDownFade 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both;
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

    /* Faculty Advisor Card */
    .advisor-section {
      position: relative;
      z-index: 10;
      display: flex;
      align-items: center;
      gap: 22px;
      background: rgba(15, 23, 42, 0.88);
      border: 1px solid rgba(251, 191, 36, 0.5);
      box-shadow: 0 16px 36px rgba(0, 0, 0, 0.5), 0 0 25px rgba(251, 191, 36, 0.15);
      border-radius: 20px;
      padding: 14px 34px;
      backdrop-filter: blur(16px);
      animation: zoomFadeIn 0.9s cubic-bezier(0.16, 1, 0.3, 1) 0.6s both;
    }
    .advisor-photo-wrap {
      width: 88px;
      height: 88px;
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
      font-size: 23px;
      font-weight: 800;
      letter-spacing: 0.6px;
      color: #FFFFFF;
    }
    .advisor-role {
      font-size: 13px;
      font-weight: 600;
      color: #94a3b8;
    }

    /* Core Engineering Trio */
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
    .card-left {
      animation: slideUpFade 0.9s cubic-bezier(0.16, 1, 0.3, 1) 1.2s both;
    }
    .card-right {
      animation: slideUpFade 0.9s cubic-bezier(0.16, 1, 0.3, 1) 1.5s both;
    }
    .member-card.lead {
      width: 410px;
      padding: 28px 30px;
      border: 2px solid #38bdf8;
      box-shadow: 0 20px 48px rgba(0, 0, 0, 0.75), 0 0 35px rgba(56, 189, 248, 0.35);
      background: linear-gradient(180deg, rgba(14, 165, 233, 0.14) 0%, rgba(11, 20, 38, 0.96) 100%);
      animation: slideUpLead 1.1s cubic-bezier(0.16, 1, 0.3, 1) 1.0s both;
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
      box-shadow: 0 0 35px rgba(56, 189, 248, 0.6);
      animation: pulseGlow 3s infinite 2.0s;
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
      box-shadow: 0 0 15px rgba(56, 189, 248, 0.4);
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
      display: inline-block;
    }
    .member-card.lead .member-name {
      font-size: 25px;
      background: linear-gradient(135deg, #FFFFFF 0%, #38bdf8 50%, #818cf8 100%);
      background-size: 200% auto;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      animation: letterShimmer 3s linear infinite;
    }
    .member-desc {
      font-size: 13px;
      font-weight: 600;
      color: #94a3b8;
    }

    /* Kinetic Letter Typewriter Effect */
    .char {
      display: inline-block;
      opacity: 0;
      transform: translateY(10px);
      animation: charFadeUp 0.3s forwards;
    }
    @keyframes charFadeUp {
      to { opacity: 1; transform: translateY(0); }
    }

    /* Bottom Closing */
    .bottom-closing {
      position: relative;
      z-index: 10;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      animation: slideUpFade 0.8s cubic-bezier(0.16, 1, 0.3, 1) 1.8s both;
    }
    .closing-motto {
      font-family: 'Montserrat', sans-serif;
      font-size: 17px;
      font-weight: 900;
      letter-spacing: 4px;
      color: #fbbf24;
      text-transform: uppercase;
      background: rgba(15, 23, 42, 0.88);
      border: 1px solid rgba(251, 191, 36, 0.4);
      padding: 6px 28px;
      border-radius: 9999px;
      box-shadow: 0 0 20px rgba(251, 191, 36, 0.2);
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
      <div class="advisor-name" id="hod-name">Dr. S. Prabhu</div>
      <div class="advisor-role">Head of the Department — CSE (Cyber Security & IoT)</div>
    </div>
  </div>

  <!-- Core Engineering Trio -->
  <div class="team-container">
    <!-- Left: Security Head -->
    <div class="member-card card-left">
      <div class="avatar-wrap">
        <img src="${affanPhoto}" alt="Mr. Mohammed Affan J A" />
      </div>
      <div class="role-badge role-security">Security Head</div>
      <div class="member-name" id="affan-name">Mr. Mohammed Affan J A</div>
      <div class="member-desc">Forensic Anti-Cheat & Auth Security</div>
    </div>

    <!-- Center: Lead Developer (Prominent) -->
    <div class="member-card lead">
      <div class="avatar-wrap">
        <img src="${nanthishPhoto}" alt="Mr. S. Nanthish" />
      </div>
      <div class="role-badge role-lead">Lead Developer</div>
      <div class="member-name" id="nanthish-name">Mr. S. Nanthish</div>
      <div class="member-desc">Full-Stack Architect & Telemetry Engine</div>
    </div>

    <!-- Right: Testing Head -->
    <div class="member-card card-right">
      <div class="avatar-wrap">
        <img src="${kavinPhoto}" alt="Mr. B. Kavin" />
      </div>
      <div class="role-badge role-testing">Testing Head</div>
      <div class="member-name" id="kavin-name">Mr. B. Kavin</div>
      <div class="member-desc">Quality Assurance & Contest Validation</div>
    </div>
  </div>

  <!-- Bottom Closing -->
  <div class="bottom-closing">
    <div class="closing-motto">LEARN. BUILD. ACHIEVE.</div>
    <div class="closing-sub">Built for Institutional Coding Analytics • Nandha Engineering College, Erode</div>
  </div>

  <script>
    // Kinetic letter-by-letter cascade reveal for names
    function animateText(id, delayStart) {
      const el = document.getElementById(id);
      if (!el) return;
      const text = el.textContent;
      el.textContent = '';
      [...text].forEach((char, i) => {
        const span = document.createElement('span');
        span.textContent = char;
        span.className = 'char';
        span.style.animationDelay = (delayStart + i * 0.04) + 's';
        el.appendChild(span);
      });
    }

    animateText('hod-name', 0.9);
    animateText('nanthish-name', 1.3);
    animateText('affan-name', 1.5);
    animateText('kavin-name', 1.7);
  </script>
</body>
</html>`;

  await page.setContent(html, { waitUntil: 'load' });
  
  // Wait 7.2 seconds for full animation sequence to play and hold
  console.log('[ANIMATION] Recording 7.2s animated sequence with letter reveals...');
  await page.waitForTimeout(7200);

  // Close context to flush video
  await page.close();
  await context.close();
  await browser.close();

  // Find recorded video file
  const videoFiles = fs.readdirSync(videoDir).filter(f => f.endsWith('.webm'));
  if (videoFiles.length > 0) {
    const rawWebm = path.join(videoDir, videoFiles[0]);
    const finalMp4 = path.resolve('output/brand_scenes_2026/scene_10_animated.mp4');
    console.log(`[SAVED] Raw WebM recorded -> ${rawWebm}`);
    return { rawWebm, finalMp4 };
  } else {
    throw new Error('No recorded video found in videoDir');
  }
}

renderAnimatedScene10().then(res => {
  console.log('[COMPLETE]', res);
}).catch(err => {
  console.error('[ERROR]', err);
  process.exit(1);
});
