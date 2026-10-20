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

async function renderScene07() {
  const outFile = path.join(OUT_DIR, 'scene_07_reports.mp4');
  console.log(`[SCENE 07] Rendering Reporting & Evidence (9.000s / 270 frames, Export Interaction & Feedback) -> ${outFile}...`);

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
    .page-container {
      position: absolute;
      inset: 0;
      width: 1920px;
      height: 1080px;
    }
    .page-shot {
      width: 1920px;
      height: 1080px;
      object-fit: cover;
      display: block;
    }
    /* Report Card Selection Highlight */
    .report-card-select {
      position: absolute;
      top: 195px;
      left: 285px;
      width: 440px;
      height: 190px;
      border-radius: 14px;
      border: 2px solid #2563EB;
      background: rgba(37, 99, 235, 0.04);
      box-shadow: 0 12px 32px -6px rgba(37, 99, 235, 0.16);
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s ease;
    }
    /* Generate Preview Button Hover Highlight */
    .export-btn-glow {
      position: absolute;
      top: 635px;
      left: 1650px;
      width: 232px;
      height: 46px;
      border-radius: 12px;
      border: 2px solid rgba(255, 255, 255, 0.9);
      box-shadow: 0 0 20px rgba(99, 102, 241, 0.5);
      opacity: 0;
      pointer-events: none;
    }
    /* Success Confirmation Toast Pill */
    .success-toast {
      position: absolute;
      top: 90px;
      right: 320px;
      background: #FFFFFF;
      border: 1px solid rgba(16, 185, 129, 0.4);
      box-shadow: 0 16px 36px -6px rgba(16, 185, 129, 0.2);
      padding: 12px 24px;
      border-radius: 999px;
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 13px;
      font-weight: 700;
      color: #065F46;
      opacity: 0;
      transform: translateY(-10px);
      transition: transform 0.3s ease, opacity 0.3s ease;
      z-index: 120;
    }
    .check-icon {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #10B981;
      color: #FFFFFF;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 900;
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
  <div class="page-container" id="pageBox">
    <img src="${reportsShot}" class="page-shot" alt="Reports & Intelligence" />
    <div class="report-card-select" id="reportSelect"></div>
    <div class="export-btn-glow" id="exportGlow"></div>
    <div class="success-toast" id="toast">
      <span class="check-icon">&#10003;</span>
      <span>Report Generated &bull; 563 Records Ready (.XLSX)</span>
    </div>
  </div>

  <svg class="mouse-cursor" id="cursor" viewBox="0 0 24 24" fill="none">
    <path d="M5.5 3.5L18.5 11.5L12 13.5L9.5 20.5L5.5 3.5Z" fill="#0F172A" stroke="#FFFFFF" stroke-width="1.8" stroke-linejoin="round"/>
  </svg>
  <div class="click-ripple" id="ripple"></div>

  <div class="caption-pill" id="caption">
    <span class="caption-dot"></span>
    <span class="caption-text">DATA INTO ACTION.</span>
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
        // 8.2 - 9.0s: Outgoing white transition to Synchronization
        document.getElementById('whiteFade').style.opacity = lerp(0, 1, (sec - 8.2) / 0.8);
      } else {
        document.getElementById('whiteFade').style.opacity = 0;
      }

      // Exact verified element coordinates:
      // "Generate Preview" purple action button: (1766, 657.5)
      // "Sync Engine Status" header button: (1485, 32.5)
      let curX = 960;
      let curY = 600;

      if (sec < 2.0) {
        // Enters and glides over Report selection
        const p = easeInOutCubic(sec / 2.0);
        curX = lerp(850, 480, p);
        curY = lerp(650, 508, p);
      } else if (sec >= 2.0 && sec < 4.2) {
        // Glides across to the "Generate Preview" button at (1766, 657.5)
        const p = easeInOutCubic((sec - 2.0) / 2.2);
        curX = lerp(480, 1766, p);
        curY = lerp(508, 657.5, p);
        if (sec >= 3.6) {
          document.getElementById('exportGlow').style.opacity = 1;
        }
      } else if (sec >= 4.2 && sec < 5.5) {
        curX = 1766;
        curY = 657.5;
        document.getElementById('exportGlow').style.opacity = 1;
        // Ripple click on Generate Preview at 4.3s
        if (sec >= 4.3 && sec < 4.8) {
          const ripProg = (sec - 4.3) / 0.5;
          const ripple = document.getElementById('ripple');
          ripple.style.left = '1766px';
          ripple.style.top = '657.5px';
          ripple.style.opacity = lerp(0.8, 0, ripProg);
          ripple.style.transform = 'translate(-50%, -50%) scale(' + lerp(0, 2.5, ripProg) + ')';
        }
        // Toast notification enters
        if (sec >= 4.5) {
          const tProg = easeInOutCubic((sec - 4.5) / 0.6);
          document.getElementById('toast').style.opacity = tProg;
          document.getElementById('toast').style.transform = 'translateY(' + lerp(-10, 0, tProg) + 'px)';
        }
      } else if (sec >= 5.5 && sec < 7.8) {
        document.getElementById('toast').style.opacity = 1;
        document.getElementById('toast').style.transform = 'translateY(0px)';
        // Cursor glides up to top bar "Sync Engine Status" button at (1485, 32.5)
        const p = easeInOutCubic((sec - 5.5) / 2.3);
        curX = lerp(1766, 1485, p);
        curY = lerp(657.5, 32.5, p);
      } else {
        curX = 1485;
        curY = 32.5;
        document.getElementById('toast').style.opacity = 1;
        // Ripple click on Sync Engine Status at 7.8s
        if (sec >= 7.8 && sec < 8.3) {
          const ripProg = (sec - 7.8) / 0.5;
          const ripple = document.getElementById('ripple');
          ripple.style.left = '1485px';
          ripple.style.top = '32.5px';
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

  console.log(`[SUCCESS] Scene 07 rendered: ${outFile} (exact 270 frames / 9.000s)`);
  await browser.close();
}

if (require.main === module) {
  renderScene07().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { renderScene07 };
