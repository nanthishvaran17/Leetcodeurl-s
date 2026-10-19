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

const kioskShot = getBase64('live_audit_snapshots/10_public_kiosk.png');

async function renderScene06() {
  const outFile = path.join(OUT_DIR, 'scene_06_contest.mp4');
  console.log(`[SCENE 06] Rendering Contest Analytics & Hall of Fame (9.000s / 270 frames) -> ${outFile}...`);

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
      transform-origin: 50% 45%;
      will-change: transform;
    }
    .page-shot {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    /* Subtle highlight box over podium cards */
    .podium-spotlight {
      position: absolute;
      top: 390px;
      left: 310px;
      width: 1000px;
      height: 380px;
      border-radius: 28px;
      border: 1.5px solid rgba(245, 158, 11, 0.35);
      background: rgba(245, 158, 11, 0.02);
      box-shadow: 0 0 40px rgba(245, 158, 11, 0.08);
      opacity: 0;
      pointer-events: none;
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
      background: #0284C7;
      box-shadow: 0 0 8px rgba(2, 132, 199, 0.6);
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
    <img src="${kioskShot}" class="page-shot" alt="Public Kiosk Live" />
    <div class="podium-spotlight" id="podiumSpot"></div>
  </div>

  <div class="caption-pill" id="caption">
    <span class="caption-dot"></span>
    <span class="caption-text">PERFORMANCE. MADE VISIBLE.</span>
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
      } else if (sec >= 8.2) {
        // 8.2 - 9.0s: Outgoing white fade to reports
        document.getElementById('whiteFade').style.opacity = lerp(0, 1, (sec - 8.2) / 0.8);
      } else {
        document.getElementById('whiteFade').style.opacity = 0;
      }

      // Camera glide:
      // 0.0 - 3.0s: Initial view with stats 563 / 57,320 / 102
      // 3.0 - 6.5s: Push into Gold, Silver, Bronze podium (scale 1.0 -> 1.09, translateY -25px)
      // 6.5 - 9.0s: Settle back
      let scale = 1.0;
      let transY = 0;
      let transX = 0;

      if (sec < 3.5) {
        const p = easeInOutCubic(sec / 3.5);
        scale = lerp(1.0, 1.06, p);
        transY = lerp(0, -15, p);
        transX = lerp(0, -10, p);
      } else if (sec >= 3.5 && sec < 6.8) {
        const p = easeInOutCubic((sec - 3.5) / 3.3);
        scale = lerp(1.06, 1.10, p);
        transY = lerp(-15, -35, p);
        transX = lerp(-10, -20, p);
        document.getElementById('podiumSpot').style.opacity = lerp(0, 0.9, Math.min(1, (sec - 3.8) / 0.8));
      } else {
        const p = easeInOutCubic((sec - 6.8) / 2.2);
        scale = lerp(1.10, 1.02, p);
        transY = lerp(-35, -10, p);
        transX = lerp(-20, 0, p);
        document.getElementById('podiumSpot').style.opacity = lerp(0.9, 0, p);
      }

      document.getElementById('panBox').style.transform = 'translate(' + transX + 'px, ' + transY + 'px) scale(' + scale + ')';

      // Caption timing
      if (sec >= 0.8 && sec <= 8.0) {
        const capProg = easeInOutCubic(Math.min(1, (sec - 0.8) / 0.8));
        document.getElementById('caption').style.opacity = capProg;
        document.getElementById('caption').style.transform = 'translateX(-50%) translateY(' + lerp(20, 0, capProg) + 'px)';
      } else if (sec > 8.0) {
        document.getElementById('caption').style.opacity = lerp(1, 0, (sec - 8.0) / 0.6);
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

  console.log(`[SUCCESS] Scene 06 rendered: ${outFile} (exact 270 frames / 9.000s)`);
  await browser.close();
}

renderScene06().catch(err => {
  console.error(err);
  process.exit(1);
});
