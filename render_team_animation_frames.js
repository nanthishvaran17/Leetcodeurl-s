const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const FRAMES_DIR = path.resolve('output/team_anim_frames');
fs.mkdirSync(FRAMES_DIR, { recursive: true });

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

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

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
      transition: opacity 0.3s;
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
      min-height: 28px;
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
      min-height: 26px;
    }
    .member-card.lead .member-name {
      font-size: 24px;
      color: #38bdf8;
      min-height: 30px;
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

    /* Animated typing cursor */
    .typing-cursor {
      display: inline-block;
      width: 2px;
      height: 1em;
      vertical-align: middle;
      background: #38bdf8;
      margin-left: 2px;
      animation: blink 0.7s infinite;
    }
  </style>
</head>
<body>
  <div class="grid-bg"></div>
  <div class="ambient-glow"></div>

  <!-- Header -->
  <div class="top-header" id="top-header">
    <img src="${logoData}" class="dept-logo" alt="NEC Logo" />
    <div class="header-text">
      <span class="clg-title">Nandha Engineering College (Autonomous)</span>
      <span class="dept-title">Department of Computer Science and Engineering (Cyber Security)</span>
    </div>
  </div>

  <!-- Faculty Advisor -->
  <div class="advisor-section" id="advisor-card">
    <div class="advisor-photo-wrap">
      <img src="${hodPhoto}" alt="Dr. S. Prabhu" />
    </div>
    <div class="advisor-details">
      <div class="advisor-badge">Faculty Advisor</div>
      <div class="advisor-name"><span id="hod-name"></span></div>
      <div class="advisor-role">Head of the Department — CSE (Cyber Security & IoT)</div>
    </div>
  </div>

  <!-- Team Trio -->
  <div class="team-container" id="team-container">
    <div class="member-card" id="card-affan">
      <div class="avatar-wrap">
        <img src="${affanPhoto}" alt="Mr. Mohammed Affan J A" />
      </div>
      <div class="role-badge role-security">Security Head</div>
      <div class="member-name"><span id="affan-name"></span></div>
      <div class="member-desc">Forensic Anti-Cheat & Auth Security</div>
    </div>

    <div class="member-card lead" id="card-nanthish">
      <div class="avatar-wrap">
        <img src="${nanthishPhoto}" alt="Mr. S. Nanthish" />
      </div>
      <div class="role-badge role-lead">Lead Developer</div>
      <div class="member-name"><span id="nanthish-name"></span></div>
      <div class="member-desc">Full-Stack Architect & Telemetry Engine</div>
    </div>

    <div class="member-card" id="card-kavin">
      <div class="avatar-wrap">
        <img src="${kavinPhoto}" alt="Mr. B. Kavin" />
      </div>
      <div class="role-badge role-testing">Testing Head</div>
      <div class="member-name"><span id="kavin-name"></span></div>
      <div class="member-desc">Quality Assurance & Contest Validation</div>
    </div>
  </div>

  <!-- Bottom Closing -->
  <div class="bottom-closing" id="bottom-closing">
    <div class="closing-motto">LEARN. BUILD. ACHIEVE.</div>
    <div class="closing-sub">Built for Institutional Coding Analytics • Nandha Engineering College, Erode</div>
  </div>

  <script>
    const FULL_TEXTS = {
      hod: "Dr. S. Prabhu",
      nanthish: "Mr. S. Nanthish",
      affan: "Mr. Mohammed Affan J A",
      kavin: "Mr. B. Kavin"
    };

    function lerp(a, b, t) {
      return a + (b - a) * Math.min(1, Math.max(0, t));
    }

    function getTextAt(full, progress) {
      const len = Math.floor(full.length * Math.min(1, Math.max(0, progress)));
      return full.substring(0, len);
    }

    window.updateFrame = function(sec) {
      // 0.0s - 0.6s: Header fade & drop
      const headerOpacity = lerp(0, 1, sec / 0.5);
      const headerY = lerp(-30, 0, sec / 0.5);
      document.getElementById('top-header').style.opacity = headerOpacity;
      document.getElementById('top-header').style.transform = 'translateY(' + headerY + 'px)';

      // 0.4s - 1.0s: Advisor card fade & drop
      const advOpacity = lerp(0, 1, (sec - 0.4) / 0.6);
      const advY = lerp(-20, 0, (sec - 0.4) / 0.6);
      document.getElementById('advisor-card').style.opacity = advOpacity;
      document.getElementById('advisor-card').style.transform = 'translateY(' + advY + 'px)';

      // 0.8s - 1.8s: HOD name letter reveal
      const hodProgress = (sec - 0.8) / 0.9;
      document.getElementById('hod-name').textContent = getTextAt(FULL_TEXTS.hod, hodProgress);

      // 1.4s - 2.2s: Team cards rise up
      const teamOpacity = lerp(0, 1, (sec - 1.4) / 0.6);
      const teamY = lerp(40, 0, (sec - 1.4) / 0.6);
      document.getElementById('team-container').style.opacity = teamOpacity;
      document.getElementById('team-container').style.transform = 'translateY(' + teamY + 'px)';

      // Center card extra elevation (-14px)
      const leadCardY = lerp(0, -14, (sec - 1.6) / 0.6);
      document.getElementById('card-nanthish').style.transform = 'translateY(' + leadCardY + 'px)';

      // 2.0s - 3.4s: Student team names letter reveals
      const leadProgress = (sec - 1.8) / 1.0;
      document.getElementById('nanthish-name').textContent = getTextAt(FULL_TEXTS.nanthish, leadProgress);

      const secProgress = (sec - 2.1) / 1.1;
      document.getElementById('affan-name').textContent = getTextAt(FULL_TEXTS.affan, secProgress);

      const testProgress = (sec - 2.3) / 0.9;
      document.getElementById('kavin-name').textContent = getTextAt(FULL_TEXTS.kavin, testProgress);

      // 3.2s - 4.0s: Bottom motto fade up
      const botOpacity = lerp(0, 1, (sec - 3.0) / 0.6);
      const botY = lerp(20, 0, (sec - 3.0) / 0.6);
      document.getElementById('bottom-closing').style.opacity = botOpacity;
      document.getElementById('bottom-closing').style.transform = 'translateY(' + botY + 'px)';

      // 5.6s - 7.0s: Master cinematic fade to black
      if (sec >= 5.6) {
        const fadeOut = lerp(1, 0, (sec - 5.6) / 1.4);
        document.body.style.opacity = fadeOut;
      } else {
        document.body.style.opacity = 1;
      }
    };
  </script>
</body>
</html>`;

  await page.setContent(html, { waitUntil: 'load' });

  const { spawn } = require('child_process');
  const FFMPEG = 'C:\\Users\\Nanth\\AppData\\Roaming\\Python\\Python314\\site-packages\\imageio_ffmpeg\\binaries\\ffmpeg-win-x86_64-v7.1.exe';
  const outVideo = path.resolve('output/brand_scenes_2026/scene_10_animated.mp4');

  console.log(`Starting FFmpeg stream encode to ${outVideo} (210 frames @ 30 FPS = 7.0s)...`);
  const ffmpeg = spawn(FFMPEG, [
    '-y',
    '-f', 'image2pipe',
    '-vcodec', 'png',
    '-r', '30',
    '-i', '-',
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '16',
    '-pix_fmt', 'yuv420p',
    '-an',
    outVideo
  ]);

  ffmpeg.stderr.on('data', (d) => {
    // quiet unless error
  });

  const totalFrames = 210; // 7.0 seconds at 30 fps
  for (let i = 0; i < totalFrames; i++) {
    const t = i / 30;
    await page.evaluate((sec) => window.updateFrame(sec), t);
    const buf = await page.screenshot({ type: 'png' });
    const ok = ffmpeg.stdin.write(buf);
    if (!ok) {
      await new Promise(res => ffmpeg.stdin.once('drain', res));
    }
    if (i % 30 === 0) {
      console.log(`Rendered frame ${i}/${totalFrames} (t=${t.toFixed(2)}s)`);
    }
  }

  ffmpeg.stdin.end();
  await new Promise((resolve, reject) => {
    ffmpeg.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exited with code ${code}`));
    });
  });

  console.log(`[SUCCESS] Scene 10 animated video created at: ${outVideo}`);
  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
