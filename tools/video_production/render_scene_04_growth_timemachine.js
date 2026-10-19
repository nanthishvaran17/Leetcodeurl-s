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

const growthImg = getBase64('tools/video_production/fresh_snapshots/02_growth.png');

async function renderScene04() {
  const outFile = path.join(OUT_DIR, 'seg_04_growth.mp4');
  console.log(`[SCENE 04] Rendering Growth Intelligence & Time Machine Scrubber (7.5s) -> ${outFile}...`);

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
      background: radial-gradient(circle at 50% 50%, #0d1b33 0%, #050b18 60%, #010308 100%);
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
      background: rgba(245, 158, 11, 0.15);
      border: 1px solid rgba(245, 158, 11, 0.4);
      color: #fbbf24;
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
      box-shadow: 0 35px 80px rgba(0,0,0,0.85), 0 0 40px rgba(245, 158, 11, 0.2);
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

    /* Floating Time Machine HUD Widget */
    .timemachine-hud {
      position: absolute;
      top: 38px;
      right: 70px;
      background: rgba(11, 20, 38, 0.92);
      border: 1px solid rgba(56, 189, 248, 0.4);
      box-shadow: 0 15px 35px rgba(0,0,0,0.6), 0 0 20px rgba(56, 189, 248, 0.2);
      border-radius: 9999px;
      padding: 8px 14px;
      display: flex;
      align-items: center;
      gap: 12px;
      backdrop-filter: blur(20px);
      z-index: 60;
    }
    .tm-tab {
      padding: 6px 16px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 800;
      color: #94a3b8;
      transition: all 0.3s;
    }
    .tm-tab.active {
      background: linear-gradient(135deg, #0284c7, #2563eb);
      color: #FFFFFF;
      box-shadow: 0 0 15px rgba(56, 189, 248, 0.5);
    }

    /* Macro Spotlight Callouts */
    .spotlight-card {
      position: absolute;
      bottom: 50px;
      right: 80px;
      width: 440px;
      background: rgba(11, 20, 38, 0.95);
      border: 1px solid rgba(56, 189, 248, 0.4);
      border-radius: 20px;
      padding: 24px 26px;
      box-shadow: 0 25px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(56, 189, 248, 0.2);
      backdrop-filter: blur(25px);
      z-index: 50;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .spot-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .spot-title {
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 1.5px;
      color: #38bdf8;
      text-transform: uppercase;
    }
    .improver-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      background: rgba(255, 255, 255, 0.04);
      border-radius: 12px;
    }
    .improver-info {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .rank-circle {
      width: 26px;
      height: 26px;
      border-radius: 50%;
      background: #fbbf24;
      color: #000;
      font-size: 11px;
      font-weight: 900;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .improver-name {
      font-size: 13px;
      font-weight: 800;
      color: #FFFFFF;
    }
    .improver-delta {
      font-family: 'Montserrat', sans-serif;
      font-size: 14px;
      font-weight: 900;
      color: #10b981;
      background: rgba(16, 185, 129, 0.15);
      padding: 3px 10px;
      border-radius: 8px;
    }
  </style>
</head>
<body>
  <div class="hud-title">
    <div class="hud-badge">VELOCITY INTELLIGENCE</div>
    <div class="hud-heading">GROWTH TIME MACHINE</div>
    <div class="hud-desc">Instantaneous Problem-Solving Deltas & Mastery Timeline</div>
  </div>

  <div class="timemachine-hud" id="tmHud">
    <div class="tm-tab" id="t1">Today</div>
    <div class="tm-tab" id="t2">Last 7 Days</div>
    <div class="tm-tab" id="t3">Last 30 Days</div>
    <div class="tm-tab" id="t4">All Time</div>
  </div>

  <div class="canvas-3d" id="canvas">
    <img src="${growthImg}" class="bg-img" alt="Growth Intelligence" />
  </div>

  <div class="spotlight-card" id="spotlight">
    <div class="spot-top">
      <div class="spot-title">Top Solvers Growth Delta</div>
      <div style="font-size:11px;color:#10b981;font-weight:700;">● Active Window</div>
    </div>
    <div class="improver-row">
      <div class="improver-info">
        <div class="rank-circle">#1</div>
        <div class="improver-name">MANOJ K • IT</div>
      </div>
      <div class="improver-delta">+85 Solved</div>
    </div>
    <div class="improver-row">
      <div class="improver-info">
        <div class="rank-circle" style="background:#cbd5e1;">#2</div>
        <div class="improver-name">NAVIN K R R • IT</div>
      </div>
      <div class="improver-delta">+82 Solved</div>
    </div>
    <div class="improver-row">
      <div class="improver-info">
        <div class="rank-circle" style="background:#d97706;color:#FFF;">#3</div>
        <div class="improver-name">SARAVANA KUMAR S • IT</div>
      </div>
      <div class="improver-delta">+78 Solved</div>
    </div>
  </div>

  <script>
    function lerp(a, b, t) {
      return a + (b - a) * Math.min(1, Math.max(0, t));
    }

    window.updateFrame = function(sec) {
      // 3D Isometric Dolly Zoom
      const rotX = lerp(8, 2, sec / 7.5);
      const rotY = lerp(-12, 0, sec / 7.5);
      const zoom = lerp(0.96, 1.05, sec / 7.5);
      document.getElementById('canvas').style.transform = \`rotateX(\${rotX}deg) rotateY(\${rotY}deg) scale(\${zoom})\`;

      // Scrub Time Machine Tabs:
      // 0 - 2s: Today
      // 2 - 4s: Last 7 Days
      // 4 - 6s: Last 30 Days
      // 6 - 7.5s: All Time
      const tabs = ['t1', 't2', 't3', 't4'];
      let activeIdx = 0;
      if (sec >= 2.0 && sec < 4.0) activeIdx = 1;
      else if (sec >= 4.0 && sec < 6.0) activeIdx = 2;
      else if (sec >= 6.0) activeIdx = 3;

      tabs.forEach((id, idx) => {
        const el = document.getElementById(id);
        if (idx === activeIdx) el.classList.add('active');
        else el.classList.remove('active');
      });

      // Spotlight Card rises up from 1.0s to 2.2s
      const spotProgress = Math.min(1, Math.max(0, (sec - 1.0) / 1.2));
      const spotY = lerp(60, 0, spotProgress);
      const spotOp = lerp(0, 1, spotProgress);
      document.getElementById('spotlight').style.opacity = spotOp;
      document.getElementById('spotlight').style.transform = \`translateY(\${spotY}px)\`;

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

  console.log(`[SUCCESS] Scene 04 rendered: ${outFile}`);
  await browser.close();
}

renderScene04().catch(err => {
  console.error(err);
  process.exit(1);
});
