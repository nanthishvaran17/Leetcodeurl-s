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

const reportsShot = getBase64('live_audit_snapshots/07_reports.png');
const syncModalShot = getBase64('live_audit_snapshots/08b_sync_engine_modal.png');

async function renderScene08() {
  const outFile = path.join(OUT_DIR, 'scene_08_sync_status.mp4');
  console.log(`[SCENE 08] Rendering System Diagnostics & Sync Status (8.000s / 240 frames, Modal Pop-In & Telemetry Progress) -> ${outFile}...`);

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
    .bg-reports {
      position: absolute;
      inset: 0;
      width: 1920px;
      height: 1080px;
      object-fit: cover;
      filter: blur(5px) brightness(0.9);
      transform: scale(1.02);
    }
    .modal-backdrop {
      position: absolute;
      inset: 0;
      background: rgba(15, 23, 42, 0.45);
      opacity: 0;
    }
    /* Modal container pop-in */
    .sync-modal-card {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 980px;
      height: 640px;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 32px 72px -12px rgba(15, 23, 42, 0.4), 0 0 0 1px rgba(226, 232, 240, 0.9);
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
    /* Live Health Pulse Badge */
    .health-badge {
      position: absolute;
      top: 24px;
      right: 32px;
      background: rgba(16, 185, 129, 0.12);
      border: 1px solid rgba(16, 185, 129, 0.5);
      color: #065F46;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      padding: 6px 14px;
      border-radius: 999px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .pulse-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #10B981;
      box-shadow: 0 0 8px rgba(16, 185, 129, 0.8);
      animation: pulse 1.2s infinite;
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
  <img src="${reportsShot}" class="bg-reports" alt="Reports Background" />
  <div class="modal-backdrop" id="backdrop"></div>

  <div class="sync-modal-card" id="modalCard">
    <img src="${syncModalShot}" class="modal-img" alt="Sync Diagnostics Modal" />
    <div class="health-badge">
      <span class="pulse-dot"></span>
      <span>100% OPERATIONAL &bull; 563 SYNCED</span>
    </div>
  </div>

  <svg class="mouse-cursor" id="cursor" viewBox="0 0 24 24" fill="none">
    <path d="M5.5 3.5L18.5 11.5L12 13.5L9.5 20.5L5.5 3.5Z" fill="#0F172A" stroke="#FFFFFF" stroke-width="1.8" stroke-linejoin="round"/>
  </svg>

  <div class="caption-pill" id="caption">
    <span class="caption-dot"></span>
    <span class="caption-text">BUILT FOR RELIABLE INSIGHT.</span>
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
      } else if (sec >= 7.2) {
        // 7.2 - 8.0s: Outgoing white transition to Finale
        document.getElementById('whiteFade').style.opacity = lerp(0, 1, (sec - 7.2) / 0.8);
      } else {
        document.getElementById('whiteFade').style.opacity = 0;
      }

      // Modal Entrance (0.0s -> 1.2s):
      // Slides up from bottom with spring easing
      if (sec < 1.2) {
        const p = Math.min(1, sec / 1.0);
        const spring = easeOutBack(p);
        const yOffset = lerp(160, 0, spring);
        document.getElementById('modalCard').style.transform = 'translate(-50%, calc(-50% + ' + yOffset + 'px))';
        document.getElementById('modalCard').style.opacity = Math.min(1, p * 1.5);
        document.getElementById('backdrop').style.opacity = Math.min(0.45, p * 0.45);
      } else {
        document.getElementById('modalCard').style.transform = 'translate(-50%, -50%)';
        document.getElementById('modalCard').style.opacity = 1;
        document.getElementById('backdrop').style.opacity = 0.45;
      }

      // Cursor movement:
      // Glides across verified progress bar and student log records
      let curX = 960;
      let curY = 540;

      if (sec < 2.5) {
        const p = easeInOutCubic(sec / 2.5);
        curX = lerp(1200, 850, p);
        curY = lerp(300, 480, p);
      } else if (sec >= 2.5 && sec < 5.5) {
        curX = 850 + Math.sin(sec * 1.5) * 10;
        curY = 480 + Math.cos(sec * 1.2) * 6;
      } else {
        const p = easeInOutCubic((sec - 5.5) / 2.0);
        curX = lerp(850, 960, p);
        curY = lerp(480, 520, p);
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

  console.log(`[SUCCESS] Scene 08 rendered: ${outFile} (exact 240 frames / 8.000s)`);
  await browser.close();
}

if (require.main === module) {
  renderScene08().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { renderScene08 };
