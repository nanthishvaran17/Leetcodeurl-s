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

const dashShot = getBase64('live_audit_snapshots/04_dashboard.png');

async function renderScene03() {
  const outFile = path.join(OUT_DIR, 'scene_03_dashboard.mp4');
  console.log(`[SCENE 03] Rendering Dashboard (8.000s / 240 frames, Vertical Scroll & Navbar Click) -> ${outFile}...`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800;900&family=JetBrains+Mono:wght@500;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 1920px;
      height: 1080px;
      background: #FFFFFF;
      font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
      overflow: hidden;
      position: relative;
    }
    /* Natural 1:1 view with smooth vertical scroll */
    .scroll-container {
      position: absolute;
      top: 0;
      left: 0;
      width: 1920px;
      height: 1200px;
      will-change: transform;
    }
    .page-shot {
      width: 1920px;
      height: 1080px;
      object-fit: cover;
      display: block;
    }
    /* Hover elevation box on KPI card (Sunday Solvers: 313) */
    .kpi-hover-card {
      position: absolute;
      top: 300px;
      left: 968px;
      width: 456px;
      height: 168px;
      border-radius: 16px;
      border: 2px solid #2563EB;
      background: rgba(37, 99, 235, 0.04);
      box-shadow: 0 12px 28px -6px rgba(37, 99, 235, 0.18);
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s ease;
    }
    /* Authentic Cursor */
    .mouse-cursor {
      position: absolute;
      width: 24px;
      height: 24px;
      z-index: 150;
      pointer-events: none;
      filter: drop-shadow(0 4px 10px rgba(0,0,0,0.3));
    }
    /* Ripple Effect on Click */
    .click-ripple {
      position: absolute;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: rgba(37, 99, 235, 0.5);
      transform: translate(-50%, -50%) scale(0);
      opacity: 0;
      pointer-events: none;
      z-index: 140;
    }
    /* Launch Growth Engine Button Highlight */
    .nav-active-pill {
      position: absolute;
      top: 596px;
      left: 1650px;
      width: 229px;
      height: 45px;
      border-radius: 12px;
      border: 2px solid rgba(255, 255, 255, 0.9);
      box-shadow: 0 0 20px rgba(99, 102, 241, 0.5);
      opacity: 0;
      pointer-events: none;
    }
    /* Lower-Third Caption */
    .caption-pill {
      position: absolute;
      bottom: 50px;
      left: 50%;
      transform: translateX(-50%) translateY(20px);
      background: rgba(255, 255, 255, 0.96);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(226, 232, 240, 0.9);
      box-shadow: 0 16px 40px -8px rgba(15, 23, 42, 0.12);
      padding: 14px 34px;
      border-radius: 999px;
      display: flex;
      align-items: center;
      gap: 12px;
      opacity: 0;
      z-index: 200;
    }
    .caption-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #2563EB;
      box-shadow: 0 0 8px rgba(37, 99, 235, 0.6);
    }
    .caption-text {
      font-size: 14px;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #0F172A;
    }
    .white-fade {
      position: absolute;
      inset: 0;
      background: #FFFFFF;
      opacity: 0;
      z-index: 300;
      pointer-events: none;
    }
  </style>
</head>
<body>
  <div class="scroll-container" id="scrollBox">
    <img src="${dashShot}" class="page-shot" alt="Dashboard Live" />
    <div class="kpi-hover-card" id="kpiHover"></div>
    <div class="nav-active-pill" id="navActive"></div>
  </div>

  <svg class="mouse-cursor" id="cursor" viewBox="0 0 24 24" fill="none">
    <path d="M5.5 3.5L18.5 11.5L12 13.5L9.5 20.5L5.5 3.5Z" fill="#0F172A" stroke="#FFFFFF" stroke-width="1.8" stroke-linejoin="round"/>
  </svg>
  <div class="click-ripple" id="ripple"></div>

  <div class="caption-pill" id="caption">
    <span class="caption-dot"></span>
    <span class="caption-text">ONE PLATFORM. INSTITUTIONAL CLARITY.</span>
  </div>

  <div class="white-fade" id="whiteFade"></div>

  <script>
    function lerp(a, b, t) {
      return a + (b - a) * Math.min(1, Math.max(0, t));
    }
    function easeInOutCubic(t) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    window.updateFrame = function(sec) {
      // 0.0 - 0.5s: Ingoing white fade
      if (sec < 0.5) {
        document.getElementById('whiteFade').style.opacity = lerp(0.8, 0, sec / 0.5);
      } else if (sec >= 7.3) {
        // 7.3 - 8.0s: Outgoing white transition to Leaderboard
        document.getElementById('whiteFade').style.opacity = lerp(0, 1, (sec - 7.3) / 0.7);
      } else {
        document.getElementById('whiteFade').style.opacity = 0;
      }

      // Smooth vertical camera glide:
      // 0.0 - 1.5s: Sits comfortably at top (0px)
      // 1.5 - 3.8s: Gently scrolls down 60px to inspect KPI cards & velocity curve
      // 3.8 - 5.5s: Holds at scroll position
      // 5.5 - 7.0s: Smoothly glides back up to top (0px) as cursor clicks navbar
      let scrollY = 0;
      if (sec >= 1.5 && sec < 3.8) {
        const p = easeInOutCubic((sec - 1.5) / 2.3);
        scrollY = lerp(0, -60, p);
      } else if (sec >= 3.8 && sec < 5.5) {
        scrollY = -60;
      } else if (sec >= 5.5 && sec < 7.0) {
        const p = easeInOutCubic((sec - 5.5) / 1.5);
        scrollY = lerp(-60, 0, p);
      } else if (sec >= 7.0) {
        scrollY = 0;
      }
      document.getElementById('scrollBox').style.transform = 'translateY(' + scrollY + 'px)';

      // Cursor movement:
      // Exact coordinates:
      // Sunday Solvers KPI card: (1198, 384)
      // Launch Growth Engine button: (1765, 618.5)
      let curX = 960;
      let curY = 600;

      if (sec < 2.0) {
        const p = easeInOutCubic(sec / 2.0);
        curX = lerp(750, 1198, p);
        curY = lerp(580, 384 + scrollY, p);
      } else if (sec >= 2.0 && sec < 4.5) {
        curX = 1198 + Math.sin(sec * 1.5) * 8;
        curY = 384 + scrollY;
        document.getElementById('kpiHover').style.opacity = 1;
      } else if (sec >= 4.5 && sec < 6.7) {
        document.getElementById('kpiHover').style.opacity = lerp(1, 0, (sec - 4.5) / 0.5);
        const p = easeInOutCubic((sec - 4.5) / 2.2);
        curX = lerp(1198, 1765, p);
        curY = lerp(384 + scrollY, 618.5 + scrollY, p);
      } else {
        curX = 1765;
        curY = 618.5 + scrollY;
        document.getElementById('navActive').style.opacity = 1;
        // Ripple on Launch Growth Engine button at 6.7s
        if (sec >= 6.7 && sec < 7.2) {
          const ripProg = (sec - 6.7) / 0.5;
          const ripple = document.getElementById('ripple');
          ripple.style.left = '1765px';
          ripple.style.top = (618.5 + scrollY) + 'px';
          ripple.style.opacity = lerp(0.8, 0, ripProg);
          ripple.style.transform = 'translate(-50%, -50%) scale(' + lerp(0, 2.5, ripProg) + ')';
        }
      }

      document.getElementById('cursor').style.left = curX + 'px';
      document.getElementById('cursor').style.top = curY + 'px';

      // Caption timing
      if (sec >= 0.8 && sec <= 7.0) {
        const capProg = easeInOutCubic(Math.min(1, (sec - 0.8) / 0.8));
        document.getElementById('caption').style.opacity = capProg;
        document.getElementById('caption').style.transform = 'translateX(-50%) translateY(' + lerp(20, 0, capProg) + 'px)';
      } else if (sec > 7.0) {
        document.getElementById('caption').style.opacity = lerp(1, 0, (sec - 7.0) / 0.5);
      }
    };
  </script>
</body>
</html>`;

  await page.setContent(html, { waitUntil: 'load' });

  const ffmpeg = spawn(FFMPEG, [
    '-loglevel', 'error',
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
  ], { stdio: ['pipe', 'ignore', 'inherit'] });

  const totalFrames = 240; // 8.0 seconds @ 30fps
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

  console.log(`[SUCCESS] Scene 03 rendered: ${outFile} (exact 240 frames / 8.000s)`);
  await browser.close();
}

if (require.main === module) {
  renderScene03().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { renderScene03 };
