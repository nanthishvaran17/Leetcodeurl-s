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

const logoData = getBase64('tools/video_production/brand_assets/nec_25_years_logo.png') || 
                 getBase64('tools/video_production/brand_assets/round_logo.png');

async function renderScene01() {
  const outFile = path.join(OUT_DIR, 'seg_01_hero.mp4');
  console.log(`[SCENE 01] Rendering The Dark Studio Specular Light Sweep (6.5s) -> ${outFile}...`);

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
      background: radial-gradient(circle at 50% 45%, #0d1b2e 0%, #050b14 60%, #010408 100%);
      font-family: 'Inter', -apple-system, sans-serif;
      color: #FFFFFF;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      position: relative;
    }
    .grid-bg {
      position: absolute;
      inset: 0;
      background-image: 
        linear-gradient(rgba(56, 189, 248, 0.05) 1px, transparent 1px),
        linear-gradient(90deg, rgba(56, 189, 248, 0.05) 1px, transparent 1px);
      background-size: 70px 70px;
      mask-image: radial-gradient(circle at 50% 50%, black 50%, transparent 85%);
      pointer-events: none;
    }
    .ambient-glow {
      position: absolute;
      width: 1000px;
      height: 600px;
      background: radial-gradient(circle, rgba(14, 165, 233, 0.22) 0%, rgba(99, 102, 241, 0.12) 40%, transparent 70%);
      filter: blur(100px);
      top: 25%;
      left: 24%;
      pointer-events: none;
    }
    /* 3D Glass Hero Monolith */
    .monolith {
      position: relative;
      z-index: 10;
      width: 1100px;
      padding: 55px 70px;
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 32px;
      box-shadow: 0 35px 80px rgba(0, 0, 0, 0.8), 0 0 50px rgba(56, 189, 248, 0.25);
      backdrop-filter: blur(30px);
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 24px;
      transform-style: preserve-3d;
      overflow: hidden;
    }
    /* Specular Light Sweep Streak */
    .light-streak {
      position: absolute;
      top: -100%;
      left: -150%;
      width: 80%;
      height: 300%;
      background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.03) 30%, rgba(255, 255, 255, 0.35) 50%, rgba(56, 189, 248, 0.4) 60%, transparent 100%);
      transform: rotate(25deg);
      pointer-events: none;
    }
    .top-badge-row {
      display: flex;
      align-items: center;
      gap: 16px;
      background: rgba(15, 23, 42, 0.8);
      border: 1px solid rgba(56, 189, 248, 0.4);
      padding: 8px 26px 8px 16px;
      border-radius: 9999px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.4);
    }
    .badge-logo {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: #FFFFFF;
      padding: 3px;
      object-fit: contain;
    }
    .badge-title {
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 2px;
      color: #38bdf8;
      text-transform: uppercase;
    }
    .main-title {
      font-family: 'Montserrat', sans-serif;
      font-size: 58px;
      font-weight: 900;
      letter-spacing: -1.5px;
      line-height: 1.1;
      background: linear-gradient(180deg, #FFFFFF 30%, #94a3b8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .main-title span {
      background: linear-gradient(135deg, #38bdf8 0%, #818cf8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .tagline {
      font-size: 21px;
      font-weight: 500;
      color: #cbd5e1;
      max-width: 820px;
      line-height: 1.5;
      letter-spacing: 0.3px;
    }
    .pill-specs {
      display: flex;
      gap: 20px;
      margin-top: 10px;
    }
    .spec-item {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 1.5px;
      color: #94a3b8;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      padding: 8px 20px;
      border-radius: 9999px;
      text-transform: uppercase;
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 10px #10b981;
    }
  </style>
</head>
<body>
  <div class="grid-bg"></div>
  <div class="ambient-glow"></div>

  <div class="monolith" id="monolith">
    <div class="light-streak" id="streak"></div>

    <div class="top-badge-row">
      <img src="${logoData}" class="badge-logo" alt="Logo" />
      <div class="badge-title">NANDHA ENGINEERING COLLEGE (AUTONOMOUS) • CSE (CYBER SECURITY)</div>
    </div>

    <h1 class="main-title">NANDHA <span>LEETCODE</span> INTELLIGENCE</h1>

    <p class="tagline">The Enterprise Coding Telemetry & Contest Analytics Engine. Transforming Campus Algorithmic Mastery into Verifiable Data.</p>

    <div class="pill-specs">
      <div class="spec-item"><div class="dot"></div>REAL-TIME CONTEST SYNC</div>
      <div class="spec-item"><div class="dot" style="background:#38bdf8;box-shadow:0 0 10px #38bdf8;"></div>680 ENGINEERS ON RECORD</div>
      <div class="spec-item"><div class="dot" style="background:#a855f7;box-shadow:0 0 10px #a855f7;"></div>FORENSIC PLAGIARISM RADAR</div>
    </div>
  </div>

  <script>
    function lerp(a, b, t) {
      return a + (b - a) * Math.min(1, Math.max(0, t));
    }
    window.updateFrame = function(sec) {
      // 0.0 - 1.2s: Monolith scale & fade in
      const scale = lerp(0.88, 1.0, sec / 1.5);
      const op = lerp(0, 1, sec / 0.8);
      const rotX = lerp(12, 0, sec / 2.0);
      document.getElementById('monolith').style.opacity = op;
      document.getElementById('monolith').style.transform = \`perspective(1200px) scale(\${scale}) rotateX(\${rotX}deg)\`;

      // 1.0 - 4.5s: Specular light streak moves across the glass
      const streakProgress = (sec - 1.0) / 3.2;
      const streakX = lerp(-150, 220, streakProgress);
      document.getElementById('streak').style.left = streakX + '%';

      // 5.5 - 6.5s: Master cinematic fade out
      if (sec >= 5.5) {
        document.body.style.opacity = lerp(1, 0, (sec - 5.5) / 1.0);
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

  const totalFrames = Math.floor(6.5 * 30); // 195 frames
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

  console.log(`[SUCCESS] Scene 01 rendered: ${outFile}`);
  await browser.close();
}

renderScene01().catch(err => {
  console.error(err);
  process.exit(1);
});
