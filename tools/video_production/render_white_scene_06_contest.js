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
  console.log(`[SCENE 06] Rendering Contest Analytics & Hall of Fame (9.000s / 270 frames, Lateral Tracking Pan) -> ${outFile}...`);

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
    .pan-box {
      position: absolute;
      top: 0;
      left: 0;
      width: 1920px;
      height: 1080px;
      will-change: transform;
    }
    .page-shot {
      width: 1920px;
      height: 1080px;
      object-fit: cover;
      display: block;
    }
    /* Gold Trophy Shimmer on 1st Place Podium */
    .gold-shimmer {
      position: absolute;
      top: 360px;
      left: 775px;
      width: 370px;
      height: 480px;
      border-radius: 20px;
      border: 2px solid rgba(234, 179, 8, 0.6);
      background: linear-gradient(135deg, rgba(254, 240, 138, 0.12) 0%, rgba(234, 179, 8, 0.04) 100%);
      box-shadow: 0 16px 40px -8px rgba(234, 179, 8, 0.25);
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s ease;
    }
    /* Institutional Solved Metric Badge at top */
    .solved-metric-pill {
      position: absolute;
      top: 140px;
      left: 50%;
      transform: translateX(-50%);
      background: #FFFFFF;
      border: 1px solid rgba(226, 232, 240, 0.9);
      box-shadow: 0 8px 24px -4px rgba(15, 23, 42, 0.08);
      padding: 8px 20px;
      border-radius: 999px;
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 13px;
      font-weight: 700;
      color: #0F172A;
      opacity: 0;
      pointer-events: none;
      z-index: 100;
    }
    .metric-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #10B981;
      box-shadow: 0 0 8px rgba(16, 185, 129, 0.6);
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
  <div class="pan-box" id="panBox">
    <img src="${kioskShot}" class="page-shot" alt="Public Kiosk Live" />
    <div class="gold-shimmer" id="goldShimmer"></div>
    <div class="solved-metric-pill" id="solvedPill">
      <span class="metric-dot"></span>
      <span>57,320 Problems Solved &bull; 102 Avg/Student</span>
    </div>
  </div>

  <svg class="mouse-cursor" id="cursor" viewBox="0 0 24 24" fill="none">
    <path d="M5.5 3.5L18.5 11.5L12 13.5L9.5 20.5L5.5 3.5Z" fill="#0F172A" stroke="#FFFFFF" stroke-width="1.8" stroke-linejoin="round"/>
  </svg>
  <div class="click-ripple" id="ripple"></div>

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
        // 8.2 - 9.0s: Outgoing white transition to Reports
        document.getElementById('whiteFade').style.opacity = lerp(0, 1, (sec - 8.2) / 0.8);
      } else {
        document.getElementById('whiteFade').style.opacity = 0;
      }

      // Smooth horizontal lateral tracking:
      // Starts slightly shifted right (+40px) focused on Silver/Rank 2,
      // glides smoothly across Gold/Rank 1 center (-40px) over 0s -> 5s
      let panX = 0;
      if (sec < 5.0) {
        const p = easeInOutCubic(sec / 5.0);
        panX = lerp(30, -30, p);
      } else {
        const p = easeInOutCubic(Math.min(1, (sec - 5.0) / 2.5));
        panX = lerp(-30, 0, p);
      }
      document.getElementById('panBox').style.transform = 'translateX(' + panX + 'px)';

      // Gold shimmer reveal on 1st Place Podium (2.0s -> 5.5s)
      if (sec >= 1.8 && sec <= 6.0) {
        const sProg = easeInOutCubic(Math.min(1, (sec - 1.8) / 1.0));
        document.getElementById('goldShimmer').style.opacity = sProg;
        document.getElementById('solvedPill').style.opacity = sProg;
      } else if (sec > 6.0) {
        document.getElementById('goldShimmer').style.opacity = lerp(1, 0, (sec - 6.0) / 0.6);
        document.getElementById('solvedPill').style.opacity = lerp(1, 0, (sec - 6.0) / 0.6);
      }

      // Cursor movement:
      // Starts near Silver podium, moves to Gold trophy (center 960, 480), then glides to top-right nav "Reports" (1480, 44)
      let curX = 650;
      let curY = 560;

      if (sec < 2.5) {
        const p = easeInOutCubic(sec / 2.5);
        curX = lerp(650, 960, p) + panX;
        curY = lerp(560, 480, p);
      } else if (sec >= 2.5 && sec < 5.5) {
        curX = 960 + Math.sin(sec * 1.5) * 8 + panX;
        curY = 480 + Math.cos(sec * 1.3) * 6;
      } else if (sec >= 5.5 && sec < 7.8) {
        const p = easeInOutCubic((sec - 5.5) / 2.3);
        curX = lerp(960 + panX, 1380, p);
        curY = lerp(480, 44, p);
      } else {
        curX = 1380;
        curY = 44;
        // Ripple click at 7.8s
        if (sec >= 7.8 && sec < 8.3) {
          const ripProg = (sec - 7.8) / 0.5;
          const ripple = document.getElementById('ripple');
          ripple.style.left = '1380px';
          ripple.style.top = '44px';
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

  console.log(`[SUCCESS] Scene 06 rendered: ${outFile} (exact 270 frames / 9.000s)`);
  await browser.close();
}

if (require.main === module) {
  renderScene06().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { renderScene06 };
