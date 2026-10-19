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

const deptShot = getBase64('live_audit_snapshots/09_departments.png');

async function renderScene04() {
  const outFile = path.join(OUT_DIR, 'scene_04_leaderboard.mp4');
  console.log(`[SCENE 04] Rendering Leaderboard Experience (10.000s / 300 frames) -> ${outFile}...`);

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
    .pan-container {
      position: absolute;
      width: 1920px;
      height: 1080px;
      transform-origin: 50% 60%;
      will-change: transform;
    }
    .page-shot {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    /* Simulated Live Typing Text inside the Search Bar */
    .search-type-box {
      position: absolute;
      top: 524px;
      left: 55px;
      font-size: 14px;
      font-weight: 600;
      color: #0F172A;
      z-index: 50;
      pointer-events: none;
      display: flex;
      align-items: center;
      gap: 2px;
      opacity: 0;
    }
    .typing-cursor {
      width: 2px;
      height: 16px;
      background: #2563EB;
      animation: blink 0.7s infinite;
    }
    @keyframes blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0; }
    }
    /* Row 1 Selection Highlight */
    .row-highlight {
      position: absolute;
      top: 726px;
      left: 15px;
      width: 1890px;
      height: 62px;
      border-radius: 12px;
      border: 1.5px solid rgba(37, 99, 235, 0.4);
      background: rgba(37, 99, 235, 0.04);
      box-shadow: 0 4px 20px rgba(37, 99, 235, 0.12);
      opacity: 0;
      pointer-events: none;
      z-index: 40;
    }
    /* Simulated Cursor */
    .mouse-cursor {
      position: absolute;
      width: 22px;
      height: 22px;
      z-index: 100;
      pointer-events: none;
      filter: drop-shadow(0 4px 8px rgba(0,0,0,0.25));
    }
    /* Lower-Third Caption Pill */
    .caption-pill {
      position: absolute;
      bottom: 45px;
      left: 50%;
      transform: translateX(-50%) translateY(20px);
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(226, 232, 240, 0.9);
      box-shadow: 0 16px 40px -8px rgba(15, 23, 42, 0.12), 0 0 0 1px rgba(255,255,255,0.8);
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
      background: #F59E0B;
      box-shadow: 0 0 8px rgba(245, 158, 11, 0.6);
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
  <div class="pan-container" id="panBox">
    <img src="${deptShot}" class="page-shot" alt="Departments Leaderboard Live" />
    <div class="search-type-box" id="searchBox">
      <span id="searchText"></span>
      <span class="typing-cursor"></span>
    </div>
    <div class="row-highlight" id="rowHigh"></div>
  </div>

  <svg class="mouse-cursor" id="cursor" viewBox="0 0 24 24" fill="none">
    <path d="M5.5 3.5L18.5 11.5L12 13.5L9.5 20.5L5.5 3.5Z" fill="#0F172A" stroke="#FFFFFF" stroke-width="1.8" stroke-linejoin="round"/>
  </svg>

  <div class="caption-pill" id="caption">
    <span class="caption-dot"></span>
    <span class="caption-text">EVERY SOLVER COUNTS.</span>
  </div>

  <div class="white-fade" id="whiteFade"></div>

  <script>
    function lerp(a, b, t) {
      return a + (b - a) * Math.min(1, Math.max(0, t));
    }
    function easeInOutCubic(t) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    const fullSearchStr = "Nanthish";

    window.updateFrame = function(sec) {
      // 0.0 - 0.5s: Ingoing white fade
      if (sec < 0.5) {
        document.getElementById('whiteFade').style.opacity = lerp(0.8, 0, sec / 0.5);
      } else if (sec >= 9.2) {
        // 9.2 - 10.0s: Outgoing white fade to profile
        document.getElementById('whiteFade').style.opacity = lerp(0, 1, (sec - 9.2) / 0.8);
      } else {
        document.getElementById('whiteFade').style.opacity = 0;
      }

      // Camera choreography:
      // 0.0 - 3.5s: Overview, slow glide down toward student table
      // 3.5 - 7.0s: Zoom slightly onto top ranked solvers (scale 1.0 -> 1.1)
      // 7.0 - 10.0s: Focus on Rank #1 Nanthish S and view action
      let scale = 1.0;
      let transY = 0;
      let transX = 0;

      if (sec < 4.0) {
        const p = easeInOutCubic(sec / 4.0);
        scale = lerp(1.0, 1.08, p);
        transY = lerp(0, -60, p);
      } else if (sec >= 4.0 && sec < 7.5) {
        const p = (sec - 4.0) / 3.5;
        scale = lerp(1.08, 1.14, p);
        transY = lerp(-60, -110, p);
        transX = lerp(0, 20, p);
      } else {
        const p = easeInOutCubic((sec - 7.5) / 2.5);
        scale = 1.14;
        transY = lerp(-110, -125, p);
        transX = lerp(20, -10, p);
      }

      document.getElementById('panBox').style.transform = 'translate(' + transX + 'px, ' + transY + 'px) scale(' + scale + ')';

      // Cursor movement:
      // Moves from bottom right to row #1 action eye button (x ~ 1740, y ~ 755 on 1920x1080)
      let curX = 900;
      let curY = 600;

      if (sec < 3.0) {
        const p = easeInOutCubic(sec / 3.0);
        curX = lerp(1200, 400, p);
        curY = lerp(800, 530, p);
      } else if (sec >= 3.0 && sec < 5.5) {
        // Hovering search bar & typing simulation
        curX = 400;
        curY = 530;
        document.getElementById('searchBox').style.opacity = 1;
        const charCount = Math.floor(lerp(0, fullSearchStr.length, (sec - 3.2) / 1.5));
        document.getElementById('searchText').innerText = fullSearchStr.substring(0, Math.max(0, charCount));
      } else if (sec >= 5.5 && sec < 8.0) {
        // Move towards Rank #1 row eye button
        const p = easeInOutCubic((sec - 5.5) / 2.0);
        curX = lerp(400, 1740, p);
        curY = lerp(530, 755, p);
        document.getElementById('rowHigh').style.opacity = lerp(0, 0.9, Math.min(1, (sec - 6.0) / 0.8));
      } else {
        curX = 1740;
        curY = 755;
        document.getElementById('rowHigh').style.opacity = 1;
      }

      document.getElementById('cursor').style.left = curX + 'px';
      document.getElementById('cursor').style.top = curY + 'px';

      // Caption timing
      if (sec >= 0.8 && sec <= 8.8) {
        const capProg = easeInOutCubic(Math.min(1, (sec - 0.8) / 0.8));
        document.getElementById('caption').style.opacity = capProg;
        document.getElementById('caption').style.transform = 'translateX(-50%) translateY(' + lerp(20, 0, capProg) + 'px)';
      } else if (sec > 8.8) {
        document.getElementById('caption').style.opacity = lerp(1, 0, (sec - 8.8) / 0.6);
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

  const totalFrames = 300; // 10.0 seconds @ 30fps
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

  console.log(`[SUCCESS] Scene 04 rendered: ${outFile} (exact 300 frames / 10.000s)`);
  await browser.close();
}

renderScene04().catch(err => {
  console.error(err);
  process.exit(1);
});
