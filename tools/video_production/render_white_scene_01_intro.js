const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const FFMPEG = 'C:\\Users\\Nanth\\AppData\\Roaming\\Python\\Python314\\site-packages\\imageio_ffmpeg\\binaries\\ffmpeg-win-x86_64-v7.1.exe';
const OUT_DIR = path.resolve(__dirname, 'output_white_70s');
fs.mkdirSync(OUT_DIR, { recursive: true });

function getBase64(filePath) {
  let fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) fullPath = path.resolve(__dirname, filePath);
  if (!fs.existsSync(fullPath)) return '';
  const ext = path.extname(fullPath).slice(1);
  const data = fs.readFileSync(fullPath).toString('base64');
  return `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${data}`;
}

const logoData = getBase64('brand_assets/logo.png') || getBase64('brand_assets/round_logo.png');

async function renderScene01() {
  const outFile = path.join(OUT_DIR, 'scene_01_opening.mp4');
  console.log(`[SCENE 01] Rendering Pure White Premium Opening (4.000s / 120 frames) -> ${outFile}...`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 1920px;
      height: 1080px;
      background: #FFFFFF;
      font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
      color: #0F172A;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      position: relative;
    }
    /* Subtle Soft Studio Light */
    .studio-light {
      position: absolute;
      width: 1200px;
      height: 700px;
      background: radial-gradient(circle at 50% 50%, rgba(241, 245, 249, 0.8) 0%, rgba(255, 255, 255, 0) 70%);
      pointer-events: none;
    }
    /* Delicate horizontal architectural drawing line */
    .draw-line {
      position: absolute;
      top: 50%;
      left: 50%;
      height: 1.5px;
      background: linear-gradient(90deg, transparent, #CBD5E1 20%, #94A3B8 50%, #CBD5E1 80%, transparent);
      transform: translate(-50%, -50%);
      width: 0px;
      opacity: 0.8;
    }
    /* Premium Centered Brand Card */
    .hero-container {
      position: relative;
      z-index: 10;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      opacity: 0;
      transform: scale(0.96);
    }
    .logo-wrapper {
      width: 124px;
      height: 124px;
      border-radius: 50%;
      background: #FFFFFF;
      box-shadow: 0 16px 36px -8px rgba(15, 23, 42, 0.12), 0 0 0 1px #E2E8F0;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 28px;
    }
    .logo-img {
      width: 106px;
      height: 106px;
      object-fit: contain;
      border-radius: 50%;
    }
    .brand-title {
      font-size: 44px;
      font-weight: 900;
      letter-spacing: -0.035em;
      color: #0F172A;
      margin-bottom: 12px;
      line-height: 1.1;
    }
    .brand-title span {
      color: #2563EB;
    }
    .brand-subtitle {
      font-size: 16px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #64748B;
      margin-bottom: 18px;
    }
    .inst-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 7px 18px;
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.05em;
      color: #334155;
      box-shadow: 0 2px 6px rgba(0,0,0,0.03);
    }
    .inst-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #10B981;
    }
  </style>
</head>
<body>
  <div class="studio-light"></div>
  <div class="draw-line" id="drawLine"></div>

  <div class="hero-container" id="heroCard">
    <div class="logo-wrapper">
      <img src="${logoData}" class="logo-img" alt="NEC Logo" />
    </div>
    <h1 class="brand-title">NANDHA <span>LEETCODE INTELLIGENCE</span></h1>
    <p class="brand-subtitle">Institutional Coding Performance Platform</p>
    <div class="inst-badge">
      <span class="inst-dot"></span>
      NANDHA ENGINEERING COLLEGE &bull; AUTONOMOUS
    </div>
  </div>

  <script>
    function lerp(a, b, t) {
      return a + (b - a) * Math.min(1, Math.max(0, t));
    }
    window.updateFrame = function(sec) {
      // 0.0 - 1.2s: Delicate grey line draws across canvas
      if (sec < 1.2) {
        const lineProg = sec / 1.0;
        const width = lerp(0, 1100, Math.pow(lineProg, 1.2));
        document.getElementById('drawLine').style.width = width + 'px';
      } else {
        document.getElementById('drawLine').style.opacity = lerp(0.8, 0, (sec - 1.2) / 0.8);
      }

      // 0.8 - 2.5s: Authentic mark and title reveal
      if (sec >= 0.6) {
        const revealProg = (sec - 0.6) / 1.2;
        const op = lerp(0, 1, revealProg);
        const scale = lerp(0.96, 1.0, revealProg);
        document.getElementById('heroCard').style.opacity = op;
        document.getElementById('heroCard').style.transform = 'scale(' + scale + ')';
      }

      // 3.6 - 4.0s: Clean white match-cut transition
      if (sec >= 3.6) {
        const fadeProg = (sec - 3.6) / 0.4;
        document.getElementById('heroCard').style.opacity = lerp(1, 0.95, fadeProg);
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

  const totalFrames = 120; // 4.0 seconds @ 30fps
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

  console.log(`[SUCCESS] Scene 01 rendered: ${outFile} (exact 120 frames / 4.000s)`);
  await browser.close();
}

renderScene01().catch(err => {
  console.error(err);
  process.exit(1);
});
