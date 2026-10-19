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

const syncShot = getBase64('live_audit_snapshots/08b_sync_engine_modal.png');

async function renderScene08() {
  const outFile = path.join(OUT_DIR, 'scene_08_sync_status.mp4');
  console.log(`[SCENE 08] Rendering System Status & Live Sync Engine (8.000s / 240 frames) -> ${outFile}...`);

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
      transform-origin: 50% 50%;
      will-change: transform;
    }
    .page-shot {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    /* Pulse glow around the 100% sync badge */
    .sync-glow {
      position: absolute;
      top: 250px;
      left: 740px;
      width: 440px;
      height: 60px;
      border-radius: 999px;
      box-shadow: 0 0 35px rgba(16, 185, 129, 0.4);
      pointer-events: none;
      opacity: 0;
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
      background: #10B981;
      box-shadow: 0 0 8px rgba(16, 185, 129, 0.6);
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
    <img src="${syncShot}" class="page-shot" alt="Sync Engine Live" />
    <div class="sync-glow" id="syncGlow"></div>
  </div>

  <div class="caption-pill" id="caption">
    <span class="caption-dot"></span>
    <span class="caption-text">BUILT FOR RELIABLE INSIGHT.</span>
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
      } else if (sec >= 7.2) {
        // 7.2 - 8.0s: Outgoing white fade to Grand Finale
        document.getElementById('whiteFade').style.opacity = lerp(0, 1, (sec - 7.2) / 0.8);
      } else {
        document.getElementById('whiteFade').style.opacity = 0;
      }

      // Camera choreography:
      // 0.0 - 3.5s: Gentle zoom towards 100% sync badge (scale 1.0 -> 1.08)
      // 3.5 - 7.0s: Glide down towards recently synchronized student log records
      let scale = 1.0;
      let transY = 0;

      if (sec < 3.5) {
        const p = easeInOutCubic(sec / 3.5);
        scale = lerp(1.0, 1.08, p);
        transY = lerp(0, -15, p);
        document.getElementById('syncGlow').style.opacity = lerp(0, 0.8, Math.min(1, sec / 1.5));
      } else if (sec >= 3.5 && sec < 6.5) {
        const p = easeInOutCubic((sec - 3.5) / 3.0);
        scale = lerp(1.08, 1.12, p);
        transY = lerp(-15, -45, p);
        document.getElementById('syncGlow').style.opacity = lerp(0.8, 0.4, p);
      } else {
        const p = easeInOutCubic((sec - 6.5) / 1.5);
        scale = lerp(1.12, 1.03, p);
        transY = lerp(-45, -10, p);
        document.getElementById('syncGlow').style.opacity = lerp(0.4, 0, p);
      }

      document.getElementById('panBox').style.transform = 'translateY(' + transY + 'px) scale(' + scale + ')';

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

renderScene08().catch(err => {
  console.error(err);
  process.exit(1);
});
