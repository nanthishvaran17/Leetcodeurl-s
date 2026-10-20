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

// Use the pristine, light-themed filled snapshot as our high-fidelity base
const loginBaseShot = getBase64('live_audit_snapshots/02_login_filled.png');

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
    
    /* Clean Pixel-Perfect White Input Overlays to ensure 100% natural typing */
    .input-overlay {
      position: absolute;
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 12px;
      display: flex;
      align-items: center;
      padding-left: 48px;
      font-size: 15px;
      font-weight: 500;
      color: #0F172A;
      z-index: 50;
    }
    .input-overlay.active {
      border: 1.5px solid #2563EB;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
      background: #FFFFFF;
    }
    .input-icon {
      position: absolute;
      left: 16px;
      top: 50%;
      transform: translateY(-50%);
      width: 18px;
      height: 18px;
      color: #94A3B8;
    }
    .placeholder-text {
      color: #94A3B8;
      font-size: 14px;
    }
    .typing-caret {
      display: inline-block;
      width: 2px;
      height: 18px;
      background: #2563EB;
      margin-left: 2px;
      vertical-align: middle;
      animation: blink 0.8s infinite;
    }

    #userOverlay {
      left: 1176px;
      top: 429px;
      width: 479px;
      height: 51px;
    }
    #passOverlay {
      left: 1176px;
      top: 526px;
      width: 479px;
      height: 51px;
    }

    /* Sign In Button Active Pressed State */
    .button-press-layer {
      position: absolute;
      left: 1176px;
      top: 660px;
      width: 466px;
      height: 50px;
      border-radius: 12px;
      background: rgba(30, 64, 175, 0.2);
      opacity: 0;
      z-index: 60;
      pointer-events: none;
      transition: opacity 0.1s ease;
    }

    /* Simulated Authentic Cursor */
    .mouse-cursor {
      position: absolute;
      width: 24px;
      height: 24px;
      z-index: 100;
      pointer-events: none;
      filter: drop-shadow(0 4px 8px rgba(0,0,0,0.3));
    }
    /* Button Click Ripple Effect */
    .click-ripple {
      position: absolute;
      width: 46px;
      height: 46px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.6);
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
      background: rgba(255, 255, 255, 0.96);
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
    <img src="${loginBaseShot}" class="page-shot" id="shotBase" alt="Login Base" />
    
    <!-- User Input Overlay -->
    <div class="input-overlay" id="userOverlay">
      <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
        <polyline points="22,6 12,13 2,6"/>
      </svg>
      <span id="userContent" class="placeholder-text">username or email</span>
      <span id="userCaret" class="typing-caret" style="display:none;"></span>
    </div>

    <!-- Password Input Overlay -->
    <div class="input-overlay" id="passOverlay">
      <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
      <span id="passContent" class="placeholder-text">••••••••</span>
      <span id="passCaret" class="typing-caret" style="display:none;"></span>
    </div>

    <!-- Sign In Button Active Pressed Overlay -->
    <div class="button-press-layer" id="btnPress"></div>
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

    const userStr = "admin";
    const passStr = "••••••••••••";

    window.updateFrame = function(sec) {
      document.getElementById('viewport').style.transform = 'scale(1.0)';

      // Caption reveal at 0.6s
      if (sec >= 0.6 && sec <= 5.2) {
        const capProg = easeInOutCubic(Math.min(1, (sec - 0.6) / 0.8));
        document.getElementById('caption').style.opacity = capProg;
        document.getElementById('caption').style.transform = 'translateX(-50%) translateY(' + lerp(20, 0, capProg) + 'px)';
      } else if (sec > 5.2) {
        document.getElementById('caption').style.opacity = lerp(1, 0, (sec - 5.2) / 0.6);
      }

      // Exact pixel coordinates:
      // Username field text start: (1240, 455)
      // Password field text start: (1240, 552)
      // Sign In button center: (1409, 685)
      let curX = 1350;
      let curY = 380;

      const userOverlay = document.getElementById('userOverlay');
      const passOverlay = document.getElementById('passOverlay');
      const userContent = document.getElementById('userContent');
      const passContent = document.getElementById('passContent');
      const userCaret = document.getElementById('userCaret');
      const passCaret = document.getElementById('passCaret');
      const btnPress = document.getElementById('btnPress');

      if (sec < 0.8) {
        // Glides from top to Username input
        const p = easeInOutCubic(sec / 0.8);
        curX = lerp(1380, 1240, p);
        curY = lerp(350, 455, p);
        userContent.innerText = "username or email";
        userContent.className = "placeholder-text";
        passContent.innerText = "••••••••";
        passContent.className = "placeholder-text";
      } else if (sec >= 0.8 && sec < 2.0) {
        // Typing username "admin" character-by-character
        curX = 1240;
        curY = 455;
        userOverlay.classList.add('active');
        userCaret.style.display = 'inline-block';
        const typeProg = (sec - 0.8) / 1.0;
        const count = Math.min(userStr.length, Math.floor(typeProg * (userStr.length + 1)));
        userContent.innerText = userStr.slice(0, count);
        userContent.className = "";
      } else if (sec >= 2.0 && sec < 2.5) {
        // Finishes username, moves down to password input
        userOverlay.classList.remove('active');
        userCaret.style.display = 'none';
        userContent.innerText = userStr;
        const p = easeInOutCubic((sec - 2.0) / 0.5);
        curX = 1240;
        curY = lerp(455, 552, p);
      } else if (sec >= 2.5 && sec < 3.7) {
        // Typing password "••••••••••••" dot-by-dot
        curX = 1240;
        curY = 552;
        passOverlay.classList.add('active');
        passCaret.style.display = 'inline-block';
        const typeProg = (sec - 2.5) / 1.0;
        const count = Math.min(passStr.length, Math.floor(typeProg * (passStr.length + 1)));
        passContent.innerText = passStr.slice(0, count);
        passContent.className = "";
      } else if (sec >= 3.7 && sec < 4.3) {
        // Moves from password down to Sign In button at (1409, 685)
        passOverlay.classList.remove('active');
        passCaret.style.display = 'none';
        passContent.innerText = passStr;
        const p = easeInOutCubic((sec - 3.7) / 0.6);
        curX = lerp(1240, 1409, p);
        curY = lerp(552, 685, p);
      } else if (sec >= 4.3 && sec < 5.2) {
        // Direct click on Sign In button at (1409, 685)
        curX = 1409;
        curY = 685;
        passOverlay.classList.remove('active');
        passCaret.style.display = 'none';
        
        // Button press visual feedback
        if (sec >= 4.35 && sec < 4.7) {
          btnPress.style.opacity = 0.8;
          const ripProg = (sec - 4.35) / 0.35;
          const ripple = document.getElementById('ripple');
          ripple.style.left = '1409px';
          ripple.style.top = '685px';
          ripple.style.opacity = lerp(0.8, 0, ripProg);
          ripple.style.transform = 'translate(-50%, -50%) scale(' + lerp(0, 3.0, ripProg) + ')';
        } else {
          btnPress.style.opacity = 0;
        }
      } else {
        curX = 1409;
        curY = 685;
        btnPress.style.opacity = 0;
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

if (require.main === module) {
  renderScene02().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { renderScene02 };
