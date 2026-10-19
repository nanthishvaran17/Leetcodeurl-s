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

const contestImg = getBase64('tools/video_production/fresh_snapshots/04_contests.png');

async function renderScene06() {
  const outFile = path.join(OUT_DIR, 'seg_06_contest.mp4');
  console.log(`[SCENE 06] Rendering Weekly Contest 524 & Forensic Anti-Cheat Scan (7.5s) -> ${outFile}...`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&family=Montserrat:wght@800;900&family=JetBrains+Mono:wght@700;800&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 1920px;
      height: 1080px;
      background: radial-gradient(circle at 50% 50%, #0d1a33 0%, #050b16 60%, #010308 100%);
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
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.4);
      color: #10b981;
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
      box-shadow: 0 35px 80px rgba(0,0,0,0.85), 0 0 40px rgba(16, 185, 129, 0.2);
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

    /* Cyber Security Laser Scanner Bar */
    .laser-scanner {
      position: absolute;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(90deg, transparent 0%, #10b981 50%, transparent 100%);
      box-shadow: 0 0 25px 6px #10b981, 0 0 60px 15px rgba(16, 185, 129, 0.4);
      z-index: 80;
      pointer-events: none;
    }

    /* Floating Forensic Anti-Cheat Telemetry Pill */
    .anticheat-pill {
      position: absolute;
      bottom: 45px;
      right: 70px;
      background: rgba(11, 20, 38, 0.95);
      border: 1px solid rgba(16, 185, 129, 0.45);
      border-radius: 20px;
      padding: 20px 28px;
      box-shadow: 0 20px 50px rgba(0,0,0,0.8), 0 0 30px rgba(16, 185, 129, 0.25);
      backdrop-filter: blur(25px);
      z-index: 90;
      display: flex;
      align-items: center;
      gap: 20px;
    }
    .shield-icon {
      width: 50px;
      height: 50px;
      border-radius: 14px;
      background: rgba(16, 185, 129, 0.15);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #10b981;
      font-size: 24px;
      border: 1px solid rgba(16, 185, 129, 0.3);
    }
    .shield-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .shield-title {
      font-family: 'JetBrains Mono', monospace;
      font-size: 14px;
      font-weight: 800;
      letter-spacing: 1.5px;
      color: #10b981;
    }
    .shield-sub {
      font-size: 12px;
      color: #cbd5e1;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="hud-title">
    <div class="hud-badge">REAL-TIME FORENSICS</div>
    <div class="hud-heading">CONTEST 524 TELEMETRY</div>
    <div class="hud-desc">Instant Question-Level Ingestion & Automated Plagiarism Radar</div>
  </div>

  <div class="canvas-3d" id="canvas">
    <img src="${contestImg}" class="bg-img" alt="Contest Dashboard" />
    <div class="laser-scanner" id="scanner"></div>
  </div>

  <div class="anticheat-pill" id="acPill">
    <div class="shield-icon">🛡️</div>
    <div class="shield-info">
      <div class="shield-title">FORENSIC PLAGIARISM RADAR: ACTIVE</div>
      <div class="shield-sub">566 Submissions Scanned • 100% Timing & Integrity Verified</div>
    </div>
  </div>

  <script>
    function lerp(a, b, t) {
      return a + (b - a) * Math.min(1, Math.max(0, t));
    }

    window.updateFrame = function(sec) {
      // 3D Dolly Drift
      const rotX = lerp(8, 2, sec / 7.5);
      const rotY = lerp(-10, 2, sec / 7.5);
      const zoom = lerp(0.96, 1.04, sec / 7.5);
      document.getElementById('canvas').style.transform = \`rotateX(\${rotX}deg) rotateY(\${rotY}deg) scale(\${zoom})\`;

      // Laser Scanner sweeps down the screen from t=0.8s to t=5.0s
      const scanProgress = (sec - 0.8) / 4.2;
      const scanY = lerp(50, 850, Math.min(1, Math.max(0, scanProgress)));
      document.getElementById('scanner').style.top = scanY + 'px';

      // Anti-Cheat Pill subtle float
      const pillProgress = Math.min(1, Math.max(0, (sec - 1.2) / 1.0));
      const pillY = lerp(40, 0, pillProgress);
      document.getElementById('acPill').style.opacity = lerp(0, 1, pillProgress);
      document.getElementById('acPill').style.transform = \`translateY(\${pillY}px)\`;

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

  console.log(`[SUCCESS] Scene 06 rendered: ${outFile}`);
  await browser.close();
}

renderScene06().catch(err => {
  console.error(err);
  process.exit(1);
});
