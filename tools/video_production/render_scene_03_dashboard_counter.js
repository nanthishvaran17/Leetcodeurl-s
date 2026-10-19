const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const FFMPEG = 'C:\\Users\\Nanth\\AppData\\Roaming\\Python\\Python314\\site-packages\\imageio_ffmpeg\\binaries\\ffmpeg-win-x86_64-v7.1.exe';
const OUT_DIR = path.resolve(__dirname, 'output_apple_60s');
fs.mkdirSync(OUT_DIR, { recursive: true });

function getBase64(filePath) {
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) return '';
  const ext = path.extname(fullPath).slice(1);
  const data = fs.readFileSync(fullPath).toString('base64');
  return `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${data}`;
}

const dashImg = getBase64('tools/video_production/fresh_snapshots/01_dashboard.png');

async function renderScene03() {
  const outFile = path.join(OUT_DIR, 'seg_03_dashboard.mp4');
  console.log(`[SCENE 03] Rendering Dashboard Particle Count & Interactive Cursor (7.5s) -> ${outFile}...`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&family=Montserrat:wght@800;900&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 1920px;
      height: 1080px;
      background: radial-gradient(circle at 50% 50%, #0d1930 0%, #050b16 60%, #010308 100%);
      font-family: 'Inter', -apple-system, sans-serif;
      color: #FFFFFF;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      perspective: 1400px;
      position: relative;
    }
    .hud-title {
      position: absolute;
      top: 45px;
      left: 70px;
      z-index: 50;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .hud-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(14, 165, 233, 0.15);
      border: 1px solid rgba(56, 189, 248, 0.4);
      color: #38bdf8;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 2px;
      padding: 5px 14px;
      border-radius: 9999px;
      width: fit-content;
      text-transform: uppercase;
    }
    .hud-heading {
      font-family: 'Montserrat', sans-serif;
      font-size: 26px;
      font-weight: 900;
      color: #FFFFFF;
    }
    .hud-desc {
      font-size: 14px;
      color: #94a3b8;
    }

    .canvas-3d {
      width: 1600px;
      height: 900px;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 35px 80px rgba(0,0,0,0.85), 0 0 35px rgba(56, 189, 248, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.2);
      position: relative;
      background: #0f172a;
      transform-style: preserve-3d;
    }
    .bg-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: top center;
    }

    /* Floating Metric Highlights with Dynamic Roll */
    .metric-overlay {
      position: absolute;
      bottom: 45px;
      left: 70px;
      right: 70px;
      display: flex;
      justify-content: space-between;
      gap: 20px;
      z-index: 40;
    }
    .metric-pill {
      background: rgba(11, 20, 38, 0.92);
      border: 1px solid rgba(56, 189, 248, 0.35);
      border-radius: 18px;
      padding: 16px 28px;
      backdrop-filter: blur(20px);
      box-shadow: 0 15px 35px rgba(0,0,0,0.6);
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .pill-icon {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: rgba(14, 165, 233, 0.15);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #38bdf8;
      font-size: 20px;
    }
    .pill-data {
      display: flex;
      flex-direction: column;
    }
    .pill-num {
      font-family: 'Montserrat', sans-serif;
      font-size: 28px;
      font-weight: 900;
      color: #FFFFFF;
    }
    .pill-lbl {
      font-size: 11px;
      font-weight: 700;
      color: #94a3b8;
      letter-spacing: 1px;
      text-transform: uppercase;
    }

    /* Smart Animated Glowing Cursor */
    .smart-cursor {
      position: absolute;
      width: 32px;
      height: 32px;
      z-index: 100;
      pointer-events: none;
      filter: drop-shadow(0 0 12px rgba(56, 189, 248, 0.9));
      transform: translate(0, 0);
    }
    .cursor-ripple {
      position: absolute;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      border: 2px solid #38bdf8;
      box-shadow: 0 0 25px #38bdf8;
      top: -14px;
      left: -14px;
      opacity: 0;
      transform: scale(0.2);
    }
  </style>
</head>
<body>
  <div class="hud-title">
    <div class="hud-badge">COMMAND CENTER</div>
    <div class="hud-heading">INSTITUTIONAL TELEMETRY</div>
    <div class="hud-desc">Synchronized Roster & Real-Time Performance Analytics</div>
  </div>

  <div class="canvas-3d" id="canvas">
    <img src="${dashImg}" class="bg-img" alt="Dashboard" />

    <div class="smart-cursor" id="cursor">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <path d="M5.5 3.2L18.5 10.8L12.5 13.2L9.5 19.8L5.5 3.2Z" fill="#38bdf8" stroke="#FFFFFF" stroke-width="1.8" stroke-linejoin="round"/>
      </svg>
      <div class="cursor-ripple" id="ripple"></div>
    </div>
  </div>

  <div class="metric-overlay">
    <div class="metric-pill">
      <div class="pill-icon">👥</div>
      <div class="pill-data">
        <div class="pill-num" id="c1">0</div>
        <div class="pill-lbl">Enrolled Engineers</div>
      </div>
    </div>
    <div class="metric-pill">
      <div class="pill-icon" style="color:#10b981;background:rgba(16,185,129,0.15);">⚡</div>
      <div class="pill-data">
        <div class="pill-num" id="c2" style="color:#10b981;">0</div>
        <div class="pill-lbl">Active Profiles (79.9%)</div>
      </div>
    </div>
    <div class="metric-pill">
      <div class="pill-icon" style="color:#fbbf24;background:rgba(251,191,36,0.15);">🏆</div>
      <div class="pill-data">
        <div class="pill-num" id="c3" style="color:#fbbf24;">0</div>
        <div class="pill-lbl">Verified Problems Solved</div>
      </div>
    </div>
    <div class="metric-pill">
      <div class="pill-icon" style="color:#c084fc;background:rgba(192,132,252,0.15);">⭐</div>
      <div class="pill-data">
        <div class="pill-num" id="c4" style="color:#c084fc;">0</div>
        <div class="pill-lbl">Peak Contest Rating</div>
      </div>
    </div>
  </div>

  <script>
    function lerp(a, b, t) {
      return a + (b - a) * Math.min(1, Math.max(0, t));
    }

    window.updateFrame = function(sec) {
      // 3D Tilt Orbit
      const rotX = lerp(12, 4, sec / 7.5);
      const rotY = lerp(-10, 2, sec / 7.5);
      const zoom = lerp(0.95, 1.03, sec / 7.5);
      document.getElementById('canvas').style.transform = \`rotateX(\${rotX}deg) rotateY(\${rotY}deg) scale(\${zoom})\`;

      // Numbers roll up from 0.4s to 3.5s
      const rollProgress = Math.min(1, Math.max(0, (sec - 0.4) / 3.0));
      // Ease out expo for snappy number roll
      const easeRoll = 1 - Math.pow(1 - rollProgress, 3);

      const val1 = Math.floor(lerp(0, 680, easeRoll));
      const val2 = Math.floor(lerp(0, 543, easeRoll));
      const val3 = Math.floor(lerp(0, 57181, easeRoll));
      const val4 = Math.floor(lerp(0, 1928, easeRoll));

      document.getElementById('c1').textContent = val1.toLocaleString();
      document.getElementById('c2').textContent = val2.toLocaleString();
      document.getElementById('c3').textContent = val3.toLocaleString();
      document.getElementById('c4').textContent = val4.toLocaleString();

      // Smart Cursor Motion: enters from bottom-right (1400, 700) -> glides to "Launch Growth Engine" button (1280, 480)
      const cursorT = Math.min(1, Math.max(0, (sec - 1.2) / 3.0));
      const easeCur = 1 - Math.pow(1 - cursorT, 3);
      const curX = lerp(1380, 1260, easeCur);
      const curY = lerp(750, 480, easeCur);
      document.getElementById('cursor').style.left = curX + 'px';
      document.getElementById('cursor').style.top = curY + 'px';

      // Click ripple at t=4.5s
      if (sec >= 4.4 && sec <= 5.2) {
        const ripT = (sec - 4.4) / 0.8;
        document.getElementById('ripple').style.opacity = lerp(1, 0, ripT);
        document.getElementById('ripple').style.transform = \`scale(\${lerp(0.2, 2.2, ripT)})\`;
      } else {
        document.getElementById('ripple').style.opacity = 0;
      }

      // Master fade out at t=6.7s
      if (sec >= 6.7) {
        document.body.style.opacity = lerp(1, 0, (sec - 6.7) / 0.8);
      } else {
        document.body.style.opacity = 1;
      }
    };
  </script>
</body>
</html>`;

  await page.setContent(html, { waitUntil: 'load' });

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
    outFile
  ]);

  const totalFrames = Math.floor(7.5 * 30); // 225 frames
  for (let i = 0; i < totalFrames; i++) {
    const t = i / 30;
    await page.evaluate((sec) => window.updateFrame(sec), t);
    const buf = await page.screenshot({ type: 'png' });
    const ok = ffmpeg.stdin.write(buf);
    if (!ok) {
      await new Promise(res => ffmpeg.stdin.once('drain', res));
    }
  }

  ffmpeg.stdin.end();
  await new Promise((resolve, reject) => {
    ffmpeg.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exited with code ${code}`));
    });
  });

  console.log(`[SUCCESS] Scene 03 rendered: ${outFile}`);
  await browser.close();
}

renderScene03().catch(err => {
  console.error(err);
  process.exit(1);
});
