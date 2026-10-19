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

const loginShot1 = getBase64('live_audit_snapshots/01_login_page.png');
const loginShot2 = getBase64('live_audit_snapshots/02_login_filled.png');

async function renderScene02() {
  const outFile = path.join(OUT_DIR, 'scene_02_login.mp4');
  console.log(`[SCENE 02] Rendering Secure Login (6.000s / 180 frames) -> ${outFile}...`);

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
    .viewport-container {
      position: absolute;
      inset: 0;
      transform-origin: 75% 45%;
      will-change: transform;
    }
    .page-shot {
      position: absolute;
      inset: 0;
      width: 1920px;
      height: 1080px;
      object-fit: cover;
    }
    #shotFilled {
      opacity: 0;
    }
    /* Simulated Authentic Cursor */
    .mouse-cursor {
      position: absolute;
      width: 22px;
      height: 22px;
      z-index: 100;
      pointer-events: none;
      filter: drop-shadow(0 4px 8px rgba(0,0,0,0.25));
      transition: transform 0.08s ease;
    }
    /* Button Click Ripple Effect */
    .click-ripple {
      position: absolute;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: rgba(37, 99, 235, 0.4);
      transform: translate(-50%, -50%) scale(0);
      opacity: 0;
      pointer-events: none;
      z-index: 99;
    }
    /* Cinematic Lower-Third Caption Pill */
    .caption-pill {
      position: absolute;
      bottom: 50px;
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
    .white-flash {
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
  <div class="viewport-container" id="viewport">
    <img src="${loginShot1}" class="page-shot" id="shotEmpty" alt="Login Empty" />
    <img src="${loginShot2}" class="page-shot" id="shotFilled" alt="Login Filled" />
  </div>

  <!-- Cursor SVG -->
  <svg class="mouse-cursor" id="cursor" viewBox="0 0 24 24" fill="none">
    <path d="M5.5 3.5L18.5 11.5L12 13.5L9.5 20.5L5.5 3.5Z" fill="#0F172A" stroke="#FFFFFF" stroke-width="1.8" stroke-linejoin="round"/>
  </svg>
  <div class="click-ripple" id="ripple"></div>

  <div class="caption-pill" id="caption">
    <span class="caption-dot"></span>
    <span class="caption-text">SECURE ACCESS. CLEAR VISIBILITY.</span>
  </div>

  <div class="white-flash" id="whiteFlash"></div>

  <script>
    function lerp(a, b, t) {
      return a + (b - a) * Math.min(1, Math.max(0, t));
    }
    function easeInOutCubic(t) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    window.updateFrame = function(sec) {
      // Stable 1:1 framing without artificial zoom
      document.getElementById('viewport').style.transform = 'scale(1.0)';

      // Caption reveal at 0.6s
      if (sec >= 0.6 && sec <= 5.2) {
        const capProg = easeInOutCubic(Math.min(1, (sec - 0.6) / 0.8));
        document.getElementById('caption').style.opacity = capProg;
        document.getElementById('caption').style.transform = 'translateX(-50%) translateY(' + lerp(20, 0, capProg) + 'px)';
      } else if (sec > 5.2) {
        document.getElementById('caption').style.opacity = lerp(1, 0, (sec - 5.2) / 0.6);
      }

      // Cursor movement:
      // Starts from center-right (1400, 380), moves to submit button (1410, 635)
      let curX = 1420;
      let curY = 420;
      if (sec < 1.4) {
        // Typing simulation
        curX = lerp(1200, 1360, sec / 1.4);
        curY = lerp(350, 420, sec / 1.4);
      } else if (sec >= 1.4 && sec < 2.8) {
        // Switch to filled state
        const fillProg = (sec - 1.4) / 0.4;
        document.getElementById('shotFilled').style.opacity = Math.min(1, fillProg);
        // Move towards Sign In button (x ~ 1410, y ~ 635 on 1920x1080)
        const moveProg = easeInOutCubic((sec - 1.8) / 1.0);
        curX = lerp(1360, 1410, Math.max(0, moveProg));
        curY = lerp(420, 635, Math.max(0, moveProg));
      } else if (sec >= 2.8 && sec < 3.4) {
        // Click action at 2.9s
        curX = 1410;
        curY = 635;
        if (sec >= 2.9 && sec < 3.3) {
          const ripProg = (sec - 2.9) / 0.4;
          const ripple = document.getElementById('ripple');
          ripple.style.left = '1410px';
          ripple.style.top = '635px';
          ripple.style.opacity = lerp(0.8, 0, ripProg);
          ripple.style.transform = 'translate(-50%, -50%) scale(' + lerp(0, 2.5, ripProg) + ')';
        }
      } else {
        curX = 1410;
        curY = 635;
      }

      document.getElementById('cursor').style.left = curX + 'px';
      document.getElementById('cursor').style.top = curY + 'px';

      // 5.2 - 6.0s: Clean white match-cut fade into Dashboard
      if (sec >= 5.2) {
        const fadeProg = (sec - 5.2) / 0.8;
        document.getElementById('whiteFlash').style.opacity = lerp(0, 1, fadeProg);
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

  const totalFrames = 180; // 6.0 seconds @ 30fps
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

  console.log(`[SUCCESS] Scene 02 rendered: ${outFile} (exact 180 frames / 6.000s)`);
  await browser.close();
}

renderScene02().catch(err => {
  console.error(err);
  process.exit(1);
});
