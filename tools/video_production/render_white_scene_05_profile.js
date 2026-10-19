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

const rosterShot = getBase64('live_audit_snapshots/09_departments.png');
const profileShot = getBase64('live_audit_snapshots/05e_aakash_profile.png');

async function renderScene05() {
  const outFile = path.join(OUT_DIR, 'scene_05_profile.mp4');
  console.log(`[SCENE 05] Rendering Student Intelligence (9.000s / 270 frames, Modal Pop-Up & Radar Focus) -> ${outFile}...`);

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
    /* Dimmed background table from previous scene */
    .bg-table {
      position: absolute;
      inset: 0;
      width: 1920px;
      height: 1080px;
      object-fit: cover;
      filter: blur(4px) brightness(0.92);
      transform: scale(1.02);
    }
    .modal-backdrop {
      position: absolute;
      inset: 0;
      background: rgba(15, 23, 42, 0.4);
      opacity: 0;
    }
    /* Modal container sliding up with spring easing */
    .modal-card {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 1140px;
      height: 720px;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 32px 72px -12px rgba(15, 23, 42, 0.35), 0 0 0 1px rgba(226, 232, 240, 0.8);
      background: #FFFFFF;
      opacity: 0;
      will-change: transform, opacity;
    }
    .modal-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    /* Spotlight overlay on the DSA Radar & Stats */
    .radar-focus-ring {
      position: absolute;
      top: 280px;
      right: 90px;
      width: 320px;
      height: 290px;
      border-radius: 16px;
      border: 2px solid #2563EB;
      background: rgba(37, 99, 235, 0.04);
      box-shadow: 0 0 24px rgba(37, 99, 235, 0.25);
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
    /* Ripple Effect */
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
  <img src="${rosterShot}" class="bg-table" alt="Table Background" />
  <div class="modal-backdrop" id="backdrop"></div>

  <div class="modal-card" id="modalCard">
    <img src="${profileShot}" class="modal-img" alt="Student Profile Modal" />
    <div class="radar-focus-ring" id="radarFocus"></div>
  </div>

  <svg class="mouse-cursor" id="cursor" viewBox="0 0 24 24" fill="none">
    <path d="M5.5 3.5L18.5 11.5L12 13.5L9.5 20.5L5.5 3.5Z" fill="#0F172A" stroke="#FFFFFF" stroke-width="1.8" stroke-linejoin="round"/>
  </svg>
  <div class="click-ripple" id="ripple"></div>

  <div class="caption-pill" id="caption">
    <span class="caption-dot"></span>
    <span class="caption-text">FROM RANK TO INSIGHT.</span>
  </div>

  <div class="white-fade" id="whiteFade"></div>

  <script>
    function lerp(a, b, t) {
      return a + (b - a) * Math.min(1, Math.max(0, t));
    }
    function easeOutBack(t) {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    }
    function easeInOutCubic(t) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    window.updateFrame = function(sec) {
      // 0.0 - 0.4s: Ingoing white fade
      if (sec < 0.4) {
        document.getElementById('whiteFade').style.opacity = lerp(0.8, 0, sec / 0.4);
      } else if (sec >= 8.2) {
        // 8.2 - 9.0s: Outgoing white transition to Contest Hall of Fame
        document.getElementById('whiteFade').style.opacity = lerp(0, 1, (sec - 8.2) / 0.8);
      } else {
        document.getElementById('whiteFade').style.opacity = 0;
      }

      // Modal Entry (0.0s -> 1.4s):
      // Slides up from bottom with spring back easing, opacity 0 -> 1
      if (sec < 1.4) {
        const p = Math.min(1, sec / 1.2);
        const spring = easeOutBack(p);
        const yOffset = lerp(180, 0, spring);
        document.getElementById('modalCard').style.transform = 'translate(-50%, calc(-50% + ' + yOffset + 'px))';
        document.getElementById('modalCard').style.opacity = Math.min(1, p * 1.5);
        document.getElementById('backdrop').style.opacity = Math.min(0.4, p * 0.4);
      } else {
        document.getElementById('modalCard').style.transform = 'translate(-50%, -50%)';
        document.getElementById('modalCard').style.opacity = 1;
        document.getElementById('backdrop').style.opacity = 0.4;
      }

      // Focus on Algorithmic Topic Radar from 2.2s -> 5.5s
      if (sec >= 2.2 && sec <= 5.8) {
        const fProg = easeInOutCubic(Math.min(1, (sec - 2.2) / 0.8));
        document.getElementById('radarFocus').style.opacity = fProg;
      } else if (sec > 5.8) {
        document.getElementById('radarFocus').style.opacity = lerp(1, 0, (sec - 5.8) / 0.6);
      }

      // Cursor movement:
      // Starts near center, moves to highlight radar at 2.5s, then moves to "Contest Tab" at 6.5s
      let curX = 960;
      let curY = 600;

      if (sec < 2.5) {
        const p = easeInOutCubic(sec / 2.5);
        curX = lerp(960, 1380, p);
        curY = lerp(600, 480, p);
      } else if (sec >= 2.5 && sec < 5.8) {
        // Hover inspection around radar chart
        curX = 1380 + Math.sin(sec * 1.4) * 12;
        curY = 480 + Math.cos(sec * 1.2) * 8;
      } else if (sec >= 5.8 && sec < 7.8) {
        // Move towards Contest History / Arena tab (x: 1040, y: 240)
        const p = easeInOutCubic((sec - 5.8) / 2.0);
        curX = lerp(1380, 1040, p);
        curY = lerp(480, 240, p);
      } else {
        curX = 1040;
        curY = 240;
        // Ripple click at 7.8s
        if (sec >= 7.8 && sec < 8.3) {
          const ripProg = (sec - 7.8) / 0.5;
          const ripple = document.getElementById('ripple');
          ripple.style.left = '1040px';
          ripple.style.top = '240px';
          ripple.style.opacity = lerp(0.8, 0, ripProg);
          ripple.style.transform = 'translate(-50%, -50%) scale(' + lerp(0, 2.5, ripProg) + ')';
        }
      }

      document.getElementById('cursor').style.left = curX + 'px';
      document.getElementById('cursor').style.top = curY + 'px';

      // Caption timing
      if (sec >= 0.8 && sec <= 8.0) {
        const capProg = easeInOutCubic(Math.min(1, (sec - 0.8) / 0.8));
        document.getElementById('caption').style.opacity = capProg;
        document.getElementById('caption').style.transform = 'translateX(-50%) translateY(' + lerp(20, 0, capProg) + 'px)';
      } else if (sec > 8.0) {
        document.getElementById('caption').style.opacity = lerp(1, 0, (sec - 8.0) / 0.5);
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

  const totalFrames = 270; // 9.0 seconds @ 30fps
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

  console.log(`[SUCCESS] Scene 05 rendered: ${outFile} (exact 270 frames / 9.000s)`);
  await browser.close();
}

if (require.main === module) {
  renderScene05().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { renderScene05 };
